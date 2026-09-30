package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"net/http"
	"sort"
	"time"
)

type industry struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Category     string         `json:"category,omitempty"`
	Description  string         `json:"description"`
	CoreCount    int            `json:"coreCount,omitempty"`
	Glosses      map[int]string `json:"glosses,omitempty"`
	DisplayWords map[int]string `json:"displayWords,omitempty"`
	WordIDs      []int          `json:"wordIds"`
}

// Specialist terms live outside f.words, so main progression and competitive
// races continue to use exactly the same 20,000-word dictionary.
func (f *features) industryWord(id int) quizWord {
	if id >= 1 && id <= len(f.words) {
		return f.words[id-1]
	}
	return f.extraWords[id]
}

func (sector *industry) display(word quizWord) string {
	if label := sector.DisplayWords[word.ID]; label != "" {
		return label
	}
	return word.Word
}

func (sector *industry) gloss(word quizWord) string {
	if meaning := sector.Glosses[word.ID]; meaning != "" {
		return meaning
	}
	return word.Zh
}

func (f *features) findIndustry(id string) *industry {
	for i := range f.industries {
		if f.industries[i].ID == id {
			return &f.industries[i]
		}
	}
	return nil
}

func (f *features) industryCatalog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	type item struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Category    string `json:"category,omitempty"`
		Description string `json:"description"`
		Count       int    `json:"count"`
	}
	items := make([]item, 0, len(f.industries))
	for _, v := range f.industries {
		items = append(items, item{v.ID, v.Name, v.Category, v.Description, len(v.WordIDs)})
	}
	writeJSON(w, map[string]any{"industries": items})
}

func (sector *industry) edition() string {
	pool := sector.WordIDs
	if sector.Category == "industry" {
		pool = pool[:sector.CoreCount]
	}
	// Meaning edits and pool changes start a separate board, so scores from
	// different question sets are never silently compared on the same day.
	body, _ := json.Marshal(struct {
		IDs      []int
		Glosses  map[int]string
		Displays map[int]string `json:",omitempty"`
	}{pool, sector.Glosses, sector.DisplayWords})
	h := sha256.Sum256(body)
	return fmt.Sprintf("%x", h[:6])
}

func industryBoard(date string, sector *industry) string {
	return "industry:" + date + ":" + sector.ID + ":" + sector.edition()
}

func (f *features) industryChallenge(date string, sector *industry) []quizQuestion {
	h := sha256.Sum256([]byte(fmt.Sprintf("industry-v3:%s:%s:%s", date, sector.ID, sector.edition())))
	rng := rand.New(rand.NewPCG(uint64(h[0])<<56|uint64(h[1])<<48|uint64(h[2])<<40|uint64(h[3])<<32|uint64(h[4])<<24|uint64(h[5])<<16|uint64(h[6])<<8|uint64(h[7]), uint64(h[8])<<56|uint64(h[9])<<48|uint64(h[10])<<40|uint64(h[11])<<32|uint64(h[12])<<24|uint64(h[13])<<16|uint64(h[14])<<8|uint64(h[15])))
	pool := sector.WordIDs
	if sector.Category == "industry" {
		pool = pool[:sector.CoreCount]
	}
	perm := rng.Perm(len(pool))
	questions := make([]quizQuestion, 0, 20)
	for _, position := range perm[:20] {
		word := f.industryWord(pool[position])
		meaning := sector.gloss(word)
		q := quizQuestion{ID: word.ID, Word: sector.display(word), Options: []quizOption{{ID: word.ID, Zh: meaning}}}
		seen := map[string]bool{meaning: true}
		optionIDs := pool
		for len(q.Options) < 4 {
			other := f.industryWord(optionIDs[rng.IntN(len(optionIDs))])
			otherMeaning := sector.gloss(other)
			if !seen[otherMeaning] {
				q.Options = append(q.Options, quizOption{ID: other.ID, Zh: otherMeaning})
				seen[otherMeaning] = true
			}
		}
		rng.Shuffle(len(q.Options), func(i, j int) { q.Options[i], q.Options[j] = q.Options[j], q.Options[i] })
		questions = append(questions, q)
	}
	return questions
}

func (f *features) industryQuiz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	sector := f.findIndustry(r.URL.Query().Get("sector"))
	if sector == nil {
		http.Error(w, "invalid industry", 400)
		return
	}
	id, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	date := dailyDate()
	board := industryBoard(date, sector)
	f.mu.Lock()
	if f.data.Starts[board+":"+id] == 0 {
		f.data.Starts[board+":"+id] = time.Now().UnixMilli()
		if err = f.save(); err != nil {
			f.mu.Unlock()
			http.Error(w, "storage unavailable", 500)
			return
		}
	}
	submitted := false
	for _, entry := range f.data.Daily[board] {
		if entry.User == id {
			submitted = true
			break
		}
	}
	f.mu.Unlock()
	writeJSON(w, map[string]any{"sector": sector.ID, "date": date, "edition": sector.edition(), "submitted": submitted, "questions": f.industryChallenge(date, sector)})
}

func (f *features) industrySubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.Header.Get("Content-Type") != "application/json" {
		http.Error(w, "JSON POST required", 405)
		return
	}
	id, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	var body struct {
		Sector  string `json:"sector"`
		Edition string `json:"edition"`
		Name    string `json:"name"`
		Answers []int  `json:"answers"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 2048)
	if json.NewDecoder(r.Body).Decode(&body) != nil || len(body.Answers) != 20 {
		http.Error(w, "invalid answers", 400)
		return
	}
	sector := f.findIndustry(body.Sector)
	if sector == nil {
		http.Error(w, "invalid industry", 400)
		return
	}
	if body.Edition != sector.edition() {
		http.Error(w, "专项词表已更新，请重新开始今日挑战；本次未扣除参赛机会", http.StatusConflict)
		return
	}
	date := dailyDate()
	board := industryBoard(date, sector)
	f.mu.Lock()
	defer f.mu.Unlock()
	start := f.data.Starts[board+":"+id]
	if start == 0 {
		http.Error(w, "请先开始专项挑战", 400)
		return
	}
	for _, entry := range f.data.Daily[board] {
		if entry.User == id {
			http.Error(w, "今天已提交过", 409)
			return
		}
	}
	correct := 0
	for i, q := range f.industryChallenge(date, sector) {
		if body.Answers[i] == q.ID {
			correct++
		}
	}
	elapsed := time.Now().UnixMilli() - start
	if elapsed < 1000 {
		elapsed = 1000
	}
	f.data.Daily[board] = append(f.data.Daily[board], dailyEntry{User: id, Name: cleanName(body.Name), Correct: correct, TimeMs: elapsed})
	delete(f.data.Starts, board+":"+id)
	if err = f.save(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, map[string]any{"correct": correct, "timeMs": elapsed})
}

func (f *features) industryLeaderboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	sector := f.findIndustry(r.URL.Query().Get("sector"))
	if sector == nil {
		http.Error(w, "invalid industry", 400)
		return
	}
	date := dailyDate()
	f.mu.Lock()
	entries := append([]dailyEntry{}, f.data.Daily[industryBoard(date, sector)]...)
	f.mu.Unlock()
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Correct != entries[j].Correct {
			return entries[i].Correct > entries[j].Correct
		}
		if entries[i].TimeMs != entries[j].TimeMs {
			return entries[i].TimeMs < entries[j].TimeMs
		}
		return entries[i].Name < entries[j].Name
	})
	if len(entries) > 50 {
		entries = entries[:50]
	}
	for i := range entries {
		entries[i].User = ""
	}
	writeJSON(w, map[string]any{"sector": sector.ID, "date": date, "entries": entries})
}
