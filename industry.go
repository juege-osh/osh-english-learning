package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"net/http"
	"time"
)

type industry struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Category      string         `json:"category,omitempty"`
	Description   string         `json:"description"`
	CoreCount     int            `json:"coreCount,omitempty"`
	Glosses       map[int]string `json:"glosses,omitempty"`
	DisplayWords  map[int]string `json:"displayWords,omitempty"`
	WordIDs       []int          `json:"wordIds"`
	SourceVersion string         `json:"-"`
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
	// different question sets are never silently compared on the same board.
	body, _ := json.Marshal(struct {
		IDs           []int
		Glosses       map[int]string
		Displays      map[int]string `json:",omitempty"`
		SourceVersion string         `json:",omitempty"`
	}{pool, sector.Glosses, sector.DisplayWords, sector.SourceVersion})
	h := sha256.Sum256(body)
	return fmt.Sprintf("%x", h[:6])
}

func industryBoard(_ string, sector *industry) string {
	return "permanent:v1:industry:" + sector.ID + ":" + sector.edition()
}

func (f *features) industryChallenge(_ string, sector *industry) []quizQuestion {
	h := sha256.Sum256([]byte(fmt.Sprintf("industry-permanent-v1:%s:%s", sector.ID, sector.edition())))
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
	attemptID, err := f.beginBoardAttempt(board, id)
	if err != nil {
		f.mu.Unlock()
		http.Error(w, "storage unavailable", 500)
		return
	}
	best, hasBest := bestEntry(f.data.Daily[board], id)
	f.mu.Unlock()
	writeJSON(w, map[string]any{"sector": sector.ID, "date": date, "edition": sector.edition(), "period": "all-time", "attemptId": attemptID, "submitted": false, "hasBest": hasBest, "best": publicEntry(best, hasBest), "questions": f.industryChallenge(date, sector)})
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
		Sector    string `json:"sector"`
		Edition   string `json:"edition"`
		Name      string `json:"name"`
		Answers   []int  `json:"answers"`
		AttemptID string `json:"attemptId"`
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
		http.Error(w, "专项词表已更新，请重新开始永久榜挑战", http.StatusConflict)
		return
	}
	date := dailyDate()
	board := industryBoard(date, sector)
	f.mu.Lock()
	defer f.mu.Unlock()
	attempt, exists := f.data.Attempts[body.AttemptID]
	if !exists || attempt.User != id || attempt.Board != board {
		http.Error(w, "请先开始专项挑战；每轮只能提交一次", 400)
		return
	}
	start := attempt.Started
	correct := 0
	for i, q := range f.industryChallenge(date, sector) {
		if body.Answers[i] == q.ID {
			correct++
		}
	}
	now := time.Now().UnixMilli()
	elapsed := now - start
	if elapsed < 1000 {
		elapsed = 1000
	}
	item := dailyEntry{User: id, Name: cleanName(body.Name), Correct: correct, TimeMs: elapsed, SubmittedAt: now, Username: f.accountUsername(id)}
	previous := append([]dailyEntry{}, f.data.Daily[board]...)
	entries, best, improved := retainBest(previous, item)
	f.data.Daily[board] = entries
	delete(f.data.Attempts, body.AttemptID)
	if err = f.save(); err != nil {
		f.data.Daily[board] = previous
		f.data.Attempts[body.AttemptID] = attempt
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, map[string]any{"correct": correct, "timeMs": elapsed, "submittedAt": now, "improved": improved, "best": publicEntry(best, true), "edition": body.Edition, "period": "all-time"})
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
	query := leaderboardQuery(r.URL.Query().Get("q"))
	f.mu.Lock()
	view := filterBoard(f.data.Daily[industryBoard("", sector)], query)
	legacy := filterBoard(f.data.Daily[legacyIndustryBoard(sector.ID)], query).Entries
	f.mu.Unlock()
	writeJSON(w, map[string]any{"sector": sector.ID, "date": dailyDate(), "edition": sector.edition(), "period": "all-time", "entries": view.Entries, "legacyEntries": legacy, "total": view.Total, "matched": view.Matched, "limit": view.Limit, "q": query})
}
