package main

import (
	cryptorand "crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type member struct {
	Created          int64 `json:"created"`
	Until            int64 `json:"until"`
	LegacyTrialUntil int64 `json:"legacyTrialUntil,omitempty"`
	Lifetime         bool  `json:"lifetime"`
}
type dailyEntry struct {
	User    string `json:"user"`
	Name    string `json:"name"`
	Correct int    `json:"correct"`
	TimeMs  int64  `json:"timeMs"`
}
type siteState struct {
	Members   map[string]member       `json:"members"`
	Codes     map[string]string       `json:"codes"`
	Starts    map[string]int64        `json:"starts"`
	Daily     map[string][]dailyEntry `json:"daily"`
	Payments  map[string]paymentOrder `json:"payments,omitempty"`
	Community communitySettings       `json:"community,omitempty"`
}
type features struct {
	mu              sync.Mutex
	path            string
	codeDir         string
	bookingDir      string
	racePath        string
	races           raceStore
	duoPath         string
	duos            duoStore
	friendPath      string
	friends         friendStore
	authPath        string
	auth            authStore
	accountIDs      map[string]bool
	authTries       map[string]roomAttempt
	proofPath       string
	proofs          proofStore
	proofDir        string
	roomTries       map[string]roomAttempt
	chatPath        string
	chat            chatStore
	progressDir     string
	data            siteState
	words           []quizWord
	extraWords      map[int]quizWord
	industries      []industry
	paymentProvider string
	huifu           *huifuPayClient
}
type quizWord struct {
	ID   int    `json:"id"`
	Word string `json:"word"`
	Zh   string `json:"zh"`
}
type quizQuestion struct {
	ID      int          `json:"-"`
	Word    string       `json:"word"`
	Options []quizOption `json:"options"`
}
type quizOption struct {
	ID int    `json:"id"`
	Zh string `json:"zh"`
}

func newFeatures(dir string) (*features, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	f := &features{path: filepath.Join(dir, "state.json"), codeDir: filepath.Join(dir, "codes"), bookingDir: filepath.Join(dir, "bookings"), racePath: filepath.Join(dir, "races.json"), duoPath: filepath.Join(dir, "duos.json"), friendPath: filepath.Join(dir, "friends.json"), authPath: filepath.Join(dir, "accounts.json"), accountIDs: map[string]bool{}, authTries: map[string]roomAttempt{}, proofPath: filepath.Join(dir, "applications.json"), proofDir: filepath.Join(dir, "proofs"), roomTries: map[string]roomAttempt{}, chatPath: filepath.Join(dir, "chat.json"), progressDir: filepath.Join(dir, "progress"), data: siteState{Members: map[string]member{}, Codes: map[string]string{}, Starts: map[string]int64{}, Daily: map[string][]dailyEntry{}}}
	if err := os.MkdirAll(f.codeDir, 0700); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(f.bookingDir, 0700); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(f.proofDir, 0700); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(f.progressDir, 0700); err != nil {
		return nil, err
	}
	if b, err := os.ReadFile(f.path); err == nil {
		if err = json.Unmarshal(b, &f.data); err != nil {
			return nil, err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	if f.data.Members == nil {
		f.data.Members = map[string]member{}
	}
	if f.data.Codes == nil {
		f.data.Codes = map[string]string{}
	}
	if f.data.Starts == nil {
		f.data.Starts = map[string]int64{}
	}
	if f.data.Daily == nil {
		f.data.Daily = map[string][]dailyEntry{}
	}
	if f.data.Payments == nil {
		f.data.Payments = map[string]paymentOrder{}
	}
	f.paymentProvider = strings.ToLower(strings.TrimSpace(os.Getenv("ENGLISH_PAYMENT_PROVIDER")))
	if f.paymentProvider == "huifu" {
		f.huifu = newHuifuPayClientFromEnv()
	}
	if err := f.loadAuth(); err != nil {
		return nil, err
	}
	if err := f.loadProofs(); err != nil {
		return nil, err
	}
	if err := f.loadChat(); err != nil {
		return nil, err
	}
	b, err := assets.ReadFile("data/words.json")
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(b, &f.words); err != nil {
		return nil, err
	}
	if len(f.words) != 20000 {
		return nil, fmt.Errorf("unexpected word count %d", len(f.words))
	}
	b, err = assets.ReadFile("data/industry_words.json")
	if err != nil {
		return nil, err
	}
	var extras []quizWord
	if err = json.Unmarshal(b, &extras); err != nil {
		return nil, err
	}
	f.extraWords = make(map[int]quizWord, len(extras))
	headwords := make(map[string]bool, len(f.words)+len(extras))
	for _, word := range f.words {
		headwords[word.Word] = true
	}
	for _, word := range extras {
		if word.ID <= len(f.words) || word.ID > 30000 || word.Word == "" || word.Zh == "" || headwords[word.Word] || f.extraWords[word.ID].ID != 0 {
			return nil, fmt.Errorf("invalid specialist word %d", word.ID)
		}
		headwords[word.Word] = true
		f.extraWords[word.ID] = word
	}
	b, err = assets.ReadFile("data/industries.json")
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(b, &f.industries); err != nil {
		return nil, err
	}
	for _, sector := range f.industries {
		if len(sector.WordIDs) < 20 {
			return nil, fmt.Errorf("industry %s has too few words", sector.ID)
		}
		if sector.Category == "industry" && (sector.CoreCount < 20 || sector.CoreCount > len(sector.WordIDs) || len(sector.Glosses) < sector.CoreCount || len(sector.Glosses) > len(sector.WordIDs)) {
			return nil, fmt.Errorf("industry %s has invalid glossary size %d", sector.ID, len(sector.Glosses))
		}
		for _, id := range sector.WordIDs {
			if f.industryWord(id).ID == 0 || (sector.Category == "exam" && id > len(f.words)) {
				return nil, fmt.Errorf("invalid industry word %d", id)
			}
		}
		allowed := make(map[int]bool, len(sector.WordIDs))
		for _, id := range sector.WordIDs {
			allowed[id] = true
		}
		for id, label := range sector.DisplayWords {
			if !allowed[id] || label == "" || len(label) > 40 {
				return nil, fmt.Errorf("industry %s has invalid display word %d", sector.ID, id)
			}
		}
		for _, id := range sector.WordIDs[:sector.CoreCount] {
			if sector.Category == "industry" && sector.Glosses[id] == "" {
				return nil, fmt.Errorf("industry %s lacks core meaning for %d", sector.ID, id)
			}
		}
	}
	if err = f.loadRaces(); err != nil {
		return nil, err
	}
	if err = f.loadDuos(); err != nil {
		return nil, err
	}
	if err = f.loadFriends(); err != nil {
		return nil, err
	}
	return f, nil
}
func (f *features) save() error {
	b, err := json.Marshal(f.data)
	if err != nil {
		return err
	}
	tmp := f.path + ".tmp"
	if err = os.WriteFile(tmp, b, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, f.path)
}
func randomCode() (string, error) {
	b := make([]byte, 15)
	if _, err := cryptorand.Read(b); err != nil {
		return "", err
	}
	s := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)
	return s[:6] + "-" + s[6:12] + "-" + s[12:18] + "-" + s[18:], nil
}
func codeHash(code string) string {
	h := sha256.Sum256([]byte(strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(code), "-", ""))))
	return hex.EncodeToString(h[:])
}
func (f *features) generateCode(kind string) (string, error) {
	if kind != "month" && kind != "year" && kind != "lifetime" {
		return "", errors.New("kind must be month, year, or lifetime")
	}
	code, err := randomCode()
	if err != nil {
		return "", err
	}
	path := filepath.Join(f.codeDir, codeHash(code))
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return "", err
	}
	if _, err = file.WriteString(kind); err != nil {
		file.Close()
		os.Remove(path)
		return "", err
	}
	if err = file.Close(); err != nil {
		os.Remove(path)
		return "", err
	}
	return code, nil
}
func (f *features) visitor(w http.ResponseWriter, r *http.Request) (string, member, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if account := f.accountFromRequest(r); account != nil {
		if m, ok := f.data.Members[account.ID]; ok {
			return account.ID, m, nil
		}
	}
	if c, err := r.Cookie("eq_visitor"); err == nil {
		if m, ok := f.data.Members[c.Value]; ok && !f.accountIDs[c.Value] {
			return c.Value, m, nil
		}
	}
	id, err := randomCode()
	if err != nil {
		return "", member{}, err
	}
	m := member{Created: time.Now().Unix()}
	f.data.Members[id] = m
	if err = f.save(); err != nil {
		delete(f.data.Members, id)
		return "", member{}, err
	}
	setVisitorCookie(w, r, id, 3*365*86400)
	return id, m, nil
}
func (f *features) membership(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	_, m, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	now := time.Now().Unix()
	trial := m.LegacyTrialUntil
	status := "free"
	until := int64(0)
	if m.Lifetime {
		status = "lifetime"
	} else if m.Until > now {
		status = "member"
		until = m.Until
	} else if trial > now {
		status = "trial"
		until = trial
	}
	writeJSON(w, map[string]any{"status": status, "until": until, "freeStudy": true})
}
func (f *features) redeem(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" || r.Header.Get("Content-Type") != "application/json" || !sameOrigin(r) {
		http.Error(w, "JSON POST required", 405)
		return
	}
	var body struct {
		Code string `json:"code"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		http.Error(w, "invalid JSON", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	a := f.accountFromRequest(r)
	if a == nil {
		http.Error(w, "请先注册并登录，再兑换到账号", 401)
		return
	}
	id := a.ID
	hash := codeHash(body.Code)
	if _, used := f.data.Codes[hash]; used {
		http.Error(w, "兑换码不存在或已使用", 400)
		return
	}
	codePath := filepath.Join(f.codeDir, hash)
	codeBytes, err := os.ReadFile(codePath)
	if err != nil {
		http.Error(w, "兑换码不存在或已使用", 400)
		return
	}
	kind := string(codeBytes)
	if kind != "month" && kind != "year" && kind != "lifetime" {
		http.Error(w, "兑换码无效", 400)
		return
	}
	usedPath := codePath + ".used"
	m := f.data.Members[id]
	previous := m
	now := time.Now().Unix()
	base := now
	if m.Until > base {
		base = m.Until
	}
	if m.LegacyTrialUntil > base {
		base = m.LegacyTrialUntil
	}
	switch kind {
	case "month":
		m.Until = base + 30*86400
	case "year":
		m.Until = base + 365*86400
	case "lifetime":
		m.Lifetime = true
	}
	f.data.Members[id] = m
	f.data.Codes[hash] = id
	if err = f.save(); err != nil {
		f.data.Members[id] = previous
		delete(f.data.Codes, hash)
		http.Error(w, "storage unavailable", 500)
		return
	}
	// Entitlement and consumption are committed in the same state file. A
	// crash before renaming the code cannot grant it to another account.
	_ = os.Rename(codePath, usedPath)
	writeJSON(w, map[string]any{"ok": true, "kind": kind})
}

func (f *features) createMemberCode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !sameOrigin(r) || r.Header.Get("Content-Type") != "application/json" {
		http.Error(w, "request denied", 403)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.requireAdmin(r) {
		http.Error(w, "只有站长能生成兑换码", 403)
		return
	}
	var body struct {
		Kind string `json:"kind"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	if json.NewDecoder(r.Body).Decode(&body) != nil || (body.Kind != "month" && body.Kind != "year" && body.Kind != "lifetime") {
		http.Error(w, "请选择月卡、年卡或永久权益", 400)
		return
	}
	code, err := f.generateCode(body.Kind)
	if err != nil {
		http.Error(w, "生成失败，请重试", 500)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, map[string]any{"code": code, "kind": body.Kind})
}
func dailyDate() string {
	return time.Now().In(time.FixedZone("北京时间", 8*3600)).Format("2006-01-02")
}
func validGoal(goal int) bool               { return goal == 5000 || goal == 10000 || goal == 20000 }
func dailyKey(date string, goal int) string { return fmt.Sprintf("%s:%d", date, goal) }
func (f *features) challenge(date string, goal int) []quizQuestion {
	seed := sha256.Sum256([]byte(fmt.Sprintf("english-quest-daily-v2:%s:%d", date, goal)))
	rng := rand.New(rand.NewPCG(uint64(seed[0])<<56|uint64(seed[1])<<48|uint64(seed[2])<<40|uint64(seed[3])<<32|uint64(seed[4])<<24|uint64(seed[5])<<16|uint64(seed[6])<<8|uint64(seed[7]), uint64(seed[8])<<56|uint64(seed[9])<<48|uint64(seed[10])<<40|uint64(seed[11])<<32|uint64(seed[12])<<24|uint64(seed[13])<<16|uint64(seed[14])<<8|uint64(seed[15])))
	perm := rng.Perm(goal)
	out := make([]quizQuestion, 0, 20)
	for _, n := range perm[:20] {
		word := f.words[n]
		q := quizQuestion{ID: word.ID, Word: word.Word, Options: []quizOption{{word.ID, word.Zh}}}
		seen := map[string]bool{word.Zh: true}
		for len(q.Options) < 4 {
			other := f.words[rng.IntN(goal)]
			if !seen[other.Zh] {
				q.Options = append(q.Options, quizOption{other.ID, other.Zh})
				seen[other.Zh] = true
			}
		}
		rng.Shuffle(4, func(i, j int) { q.Options[i], q.Options[j] = q.Options[j], q.Options[i] })
		out = append(out, q)
	}
	return out
}
func (f *features) dailyQuiz(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	id, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	goal := 10000
	if r.URL.Query().Get("goal") != "" {
		parsed, err := strconv.Atoi(r.URL.Query().Get("goal"))
		goal = parsed
		if err != nil || !validGoal(goal) {
			http.Error(w, "invalid goal", 400)
			return
		}
	}
	date := dailyDate()
	board := dailyKey(date, goal)
	key := board + ":" + id
	f.mu.Lock()
	if f.data.Starts[key] == 0 {
		f.data.Starts[key] = time.Now().UnixMilli()
		if err = f.save(); err != nil {
			f.mu.Unlock()
			http.Error(w, "storage unavailable", 500)
			return
		}
	}
	submitted := false
	for _, v := range f.data.Daily[board] {
		if v.User == id {
			submitted = true
			break
		}
	}
	f.mu.Unlock()
	writeJSON(w, map[string]any{"date": date, "goal": goal, "questions": f.challenge(date, goal), "submitted": submitted})
}
func cleanName(s string) string {
	s = strings.TrimSpace(s)
	r := []rune(s)
	if len(r) > 16 {
		r = r[:16]
	}
	s = string(r)
	if s == "" {
		return "英语旅人"
	}
	return s
}
func (f *features) dailySubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" || r.Header.Get("Content-Type") != "application/json" {
		http.Error(w, "JSON POST required", 405)
		return
	}
	id, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	var body struct {
		Name    string `json:"name"`
		Answers []int  `json:"answers"`
		Goal    int    `json:"goal"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 2048)
	if json.NewDecoder(r.Body).Decode(&body) != nil || len(body.Answers) != 20 || !validGoal(body.Goal) {
		http.Error(w, "invalid answers", 400)
		return
	}
	date := dailyDate()
	board := dailyKey(date, body.Goal)
	f.mu.Lock()
	defer f.mu.Unlock()
	start := f.data.Starts[board+":"+id]
	if start == 0 {
		http.Error(w, "请先开始今日挑战", 400)
		return
	}
	for _, v := range f.data.Daily[board] {
		if v.User == id {
			http.Error(w, "今天已经提交过", 409)
			return
		}
	}
	correct := 0
	for i, q := range f.challenge(date, body.Goal) {
		if q.ID == body.Answers[i] {
			correct++
		}
	}
	elapsed := time.Now().UnixMilli() - start
	if elapsed < 1000 {
		elapsed = 1000
	}
	item := dailyEntry{User: id, Name: cleanName(body.Name), Correct: correct, TimeMs: elapsed}
	f.data.Daily[board] = append(f.data.Daily[board], item)
	delete(f.data.Starts, board+":"+id)
	if err = f.save(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, map[string]any{"correct": correct, "timeMs": elapsed})
}
func (f *features) leaderboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	goal := 10000
	if r.URL.Query().Get("goal") != "" {
		parsed, err := strconv.Atoi(r.URL.Query().Get("goal"))
		goal = parsed
		if err != nil || !validGoal(goal) {
			http.Error(w, "invalid goal", 400)
			return
		}
	}
	date := dailyDate()
	board := dailyKey(date, goal)
	f.mu.Lock()
	items := append([]dailyEntry{}, f.data.Daily[board]...)
	f.mu.Unlock()
	sort.Slice(items, func(i, j int) bool {
		if items[i].Correct != items[j].Correct {
			return items[i].Correct > items[j].Correct
		}
		if items[i].TimeMs != items[j].TimeMs {
			return items[i].TimeMs < items[j].TimeMs
		}
		return items[i].Name < items[j].Name
	})
	if len(items) > 50 {
		items = items[:50]
	}
	for i := range items {
		items[i].User = ""
	}
	writeJSON(w, map[string]any{"date": date, "goal": goal, "entries": items})
}
func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(v)
}
