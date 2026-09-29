package main

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"os"
	"sort"
	"time"
)

var raceGoals = []int{100, 500, 1000, 3000, 5000, 10000, 20000}
var raceTiers = []string{"青铜", "白银", "黄金", "铂金", "翡翠", "钻石", "大师", "宗师", "王者"}

type raceProfile struct {
	Points int `json:"points"`
	Wins   int `json:"wins"`
	Losses int `json:"losses"`
}
type raceWaiting struct {
	User     string `json:"user"`
	Name     string `json:"name"`
	Goal     int    `json:"goal"`
	Since    int64  `json:"since"`
	LastSeen int64  `json:"lastSeen"`
	RoomID   string `json:"roomId,omitempty"`
	RoomSalt string `json:"roomSalt,omitempty"`
	RoomHash string `json:"roomHash,omitempty"`
}
type racePlayer struct {
	User     string `json:"user"`
	Name     string `json:"name"`
	Progress int    `json:"progress"`
	Errors   int    `json:"errors"`
}
type raceMatch struct {
	ID      string        `json:"id"`
	Goal    int           `json:"goal"`
	Started int64         `json:"started"`
	Ended   int64         `json:"ended"`
	Status  string        `json:"status"`
	Winner  string        `json:"winner"`
	Reason  string        `json:"reason"`
	Players [2]racePlayer `json:"players"`
}
type raceNotice struct {
	Winner  string `json:"winner"`
	Goal    int    `json:"goal"`
	Seconds int64  `json:"seconds"`
	At      int64  `json:"at"`
}
type raceStore struct {
	Profiles map[string]raceProfile `json:"profiles"`
	Waiting  map[string]raceWaiting `json:"waiting"`
	Matches  map[string]*raceMatch  `json:"matches"`
	Active   map[string]string      `json:"active"`
	Notices  []raceNotice           `json:"notices"`
}

func validRaceGoal(goal int) bool {
	for _, v := range raceGoals {
		if v == goal {
			return true
		}
	}
	return false
}
func raceTier(points int) int {
	if points < 0 {
		points = 0
	}
	n := points / 100
	if n >= len(raceTiers) {
		return len(raceTiers) - 1
	}
	return n
}

func (f *features) loadRaces() error {
	if b, err := os.ReadFile(f.racePath); err == nil {
		if err = json.Unmarshal(b, &f.races); err != nil {
			return err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if f.races.Profiles == nil {
		f.races.Profiles = map[string]raceProfile{}
	}
	if f.races.Waiting == nil {
		f.races.Waiting = map[string]raceWaiting{}
	}
	if f.races.Matches == nil {
		f.races.Matches = map[string]*raceMatch{}
	}
	if f.races.Active == nil {
		f.races.Active = map[string]string{}
	}
	if f.races.Notices == nil {
		f.races.Notices = []raceNotice{}
	}
	return nil
}
func (f *features) saveRaces() error {
	b, err := json.Marshal(f.races)
	if err != nil {
		return err
	}
	tmp := f.racePath + ".tmp"
	if err = os.WriteFile(tmp, b, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, f.racePath)
}

func seededRaceRNG(seed string) *rand.Rand {
	h := sha256.Sum256([]byte(seed))
	first := uint64(0)
	second := uint64(0)
	for i := 0; i < 8; i++ {
		first = first<<8 | uint64(h[i])
		second = second<<8 | uint64(h[i+8])
	}
	return rand.New(rand.NewPCG(first, second))
}
func (f *features) raceQuestion(match *raceMatch, index int) quizQuestion {
	order := seededRaceRNG("order:" + match.ID).Perm(match.Goal)
	word := f.words[order[index]]
	q := quizQuestion{ID: word.ID, Word: word.Word, Options: []quizOption{{ID: word.ID, Zh: word.Zh}}}
	rng := seededRaceRNG(fmt.Sprintf("options:%s:%d", match.ID, index))
	seen := map[string]bool{word.Zh: true}
	for len(q.Options) < 4 {
		other := f.words[rng.IntN(match.Goal)]
		if !seen[other.Zh] {
			q.Options = append(q.Options, quizOption{ID: other.ID, Zh: other.Zh})
			seen[other.Zh] = true
		}
	}
	rng.Shuffle(4, func(i, j int) { q.Options[i], q.Options[j] = q.Options[j], q.Options[i] })
	return q
}
func (f *features) racePlayerIndex(match *raceMatch, user string) int {
	for i := range match.Players {
		if match.Players[i].User == user {
			return i
		}
	}
	return -1
}
func (f *features) raceProfilePublic(user string) map[string]any {
	profile := f.races.Profiles[user]
	return map[string]any{"tier": raceTiers[raceTier(profile.Points)], "tierIndex": raceTier(profile.Points), "points": profile.Points, "wins": profile.Wins, "losses": profile.Losses}
}
func (f *features) raceState(user string) map[string]any {
	result := map[string]any{"mode": "idle", "profile": f.raceProfilePublic(user), "goals": raceGoals, "notices": f.races.Notices}
	if matchID := f.races.Active[user]; matchID != "" {
		if match := f.races.Matches[matchID]; match != nil {
			index := f.racePlayerIndex(match, user)
			if index >= 0 {
				me, opponent := match.Players[index], match.Players[1-index]
				result["matchId"] = match.ID
				result["goal"] = match.Goal
				result["started"] = match.Started
				result["me"] = map[string]any{"name": me.Name, "progress": me.Progress, "errors": me.Errors}
				result["opponent"] = map[string]any{"name": opponent.Name, "progress": opponent.Progress, "errors": opponent.Errors}
				if match.Status == "active" {
					result["mode"] = "racing"
					result["question"] = f.raceQuestion(match, me.Progress)
				} else {
					result["mode"] = "finished"
					result["winner"] = match.Winner
					result["won"] = match.Winner == user
					result["reason"] = match.Reason
					result["ended"] = match.Ended
				}
				return result
			}
		}
	}
	if wait, ok := f.races.Waiting[user]; ok {
		result["mode"] = "waiting"
		result["goal"] = wait.Goal
		result["since"] = wait.Since
		result["roomId"] = wait.RoomID
	}
	return result
}

func (f *features) raceStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	user, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if wait, ok := f.races.Waiting[user]; ok {
		wait.LastSeen = time.Now().Unix()
		f.races.Waiting[user] = wait
		if err = f.saveRaces(); err != nil {
			http.Error(w, "storage unavailable", 500)
			return
		}
	}
	writeJSON(w, f.raceState(user))
}
func (f *features) raceJoin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.Header.Get("Content-Type") != "application/json" {
		http.Error(w, "JSON POST required", 405)
		return
	}
	user, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	var body struct {
		Goal int    `json:"goal"`
		Name string `json:"name"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	if json.NewDecoder(r.Body).Decode(&body) != nil || !validRaceGoal(body.Goal) {
		http.Error(w, "invalid race goal", 400)
		return
	}
	body.Name = cleanName(body.Name)
	f.mu.Lock()
	defer f.mu.Unlock()
	if active := f.races.Matches[f.races.Active[user]]; active != nil && active.Status == "active" {
		http.Error(w, "请先完成当前对局", 409)
		return
	}
	delete(f.races.Waiting, user)
	now := time.Now().Unix()
	for id, wait := range f.races.Waiting {
		if now-wait.LastSeen > 120 {
			delete(f.races.Waiting, id)
		}
	}
	myTier := raceTier(f.races.Profiles[user].Points)
	candidates := make([]raceWaiting, 0)
	for _, wait := range f.races.Waiting {
		tier := raceTier(f.races.Profiles[wait.User].Points)
		gap := tier - myTier
		if gap < 0 {
			gap = -gap
		}
		if wait.RoomID == "" && wait.Goal == body.Goal && gap <= 1 {
			candidates = append(candidates, wait)
		}
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].Since < candidates[j].Since })
	if len(candidates) == 0 {
		f.races.Waiting[user] = raceWaiting{User: user, Name: body.Name, Goal: body.Goal, Since: now, LastSeen: now}
	} else {
		other := candidates[0]
		delete(f.races.Waiting, other.User)
		id, err := randomCode()
		if err != nil {
			http.Error(w, "storage unavailable", 500)
			return
		}
		match := &raceMatch{ID: id, Goal: body.Goal, Started: time.Now().UnixMilli(), Status: "active", Players: [2]racePlayer{{User: other.User, Name: other.Name}, {User: user, Name: body.Name}}}
		f.races.Matches[id] = match
		f.races.Active[user] = id
		f.races.Active[other.User] = id
	}
	if err = f.saveRaces(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.raceState(user))
}
func (f *features) finishRace(match *raceMatch, winner int, reason string) {
	match.Status = "finished"
	match.Winner = match.Players[winner].User
	match.Reason = reason
	match.Ended = time.Now().UnixMilli()
	w := f.races.Profiles[match.Players[winner].User]
	w.Wins++
	w.Points += 30
	f.races.Profiles[match.Players[winner].User] = w
	l := f.races.Profiles[match.Players[1-winner].User]
	l.Losses++
	l.Points -= 20
	if l.Points < 0 {
		l.Points = 0
	}
	f.races.Profiles[match.Players[1-winner].User] = l
	if reason == "completed" {
		f.races.Notices = append([]raceNotice{{Winner: match.Players[winner].Name, Goal: match.Goal, Seconds: (match.Ended - match.Started) / 1000, At: match.Ended}}, f.races.Notices...)
		if len(f.races.Notices) > 20 {
			f.races.Notices = f.races.Notices[:20]
		}
	}
}
func (f *features) raceAnswer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.Header.Get("Content-Type") != "application/json" {
		http.Error(w, "JSON POST required", 405)
		return
	}
	user, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	var body struct {
		MatchID string `json:"matchId"`
		Index   int    `json:"index"`
		Choice  int    `json:"choice"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		http.Error(w, "invalid answer", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	match := f.races.Matches[f.races.Active[user]]
	if match == nil || match.ID != body.MatchID || match.Status != "active" {
		http.Error(w, "对局已结束", 409)
		return
	}
	playerIndex := f.racePlayerIndex(match, user)
	if playerIndex < 0 {
		http.Error(w, "not a player", 403)
		return
	}
	player := &match.Players[playerIndex]
	if body.Index != player.Progress || body.Index < 0 || body.Index >= match.Goal {
		http.Error(w, "题目序号不匹配，请刷新", 409)
		return
	}
	q := f.raceQuestion(match, body.Index)
	valid := false
	for _, option := range q.Options {
		if option.ID == body.Choice {
			valid = true
			break
		}
	}
	if !valid {
		http.Error(w, "invalid choice", 400)
		return
	}
	correct := body.Choice == q.ID
	if correct {
		player.Progress++
		if player.Progress == match.Goal {
			f.finishRace(match, playerIndex, "completed")
		}
	} else {
		player.Errors++
	}
	if err = f.saveRaces(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, map[string]any{"correct": correct, "answer": q.ID, "state": f.raceState(user)})
}
func (f *features) raceForfeit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", 405)
		return
	}
	user, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	match := f.races.Matches[f.races.Active[user]]
	if match == nil || match.Status != "active" {
		http.Error(w, "没有进行中的对局", 409)
		return
	}
	index := f.racePlayerIndex(match, user)
	if index < 0 {
		http.Error(w, "not a player", 403)
		return
	}
	f.finishRace(match, 1-index, "forfeit")
	if err = f.saveRaces(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.raceState(user))
}
func (f *features) raceCancel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", 405)
		return
	}
	user, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.races.Waiting, user)
	if err = f.saveRaces(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.raceState(user))
}
