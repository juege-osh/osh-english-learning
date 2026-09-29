package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

type duoMember struct {
	User string `json:"user"`
	Name string `json:"name"`
}
type duoTeam struct {
	ID               string       `json:"id"`
	Members          [2]duoMember `json:"members"`
	Active           bool         `json:"active"`
	Created          int64        `json:"created"`
	Points           int          `json:"points"`
	Wins             int          `json:"wins"`
	Losses           int          `json:"losses"`
	PracticeTotal    int          `json:"practiceTotal"`
	PracticeGoal     int          `json:"practiceGoal"`
	PracticeProgress int          `json:"practiceProgress"`
	PracticeErrors   int          `json:"practiceErrors"`
	PracticeSeed     string       `json:"practiceSeed"`
	CurrentMatch     string       `json:"currentMatch"`
}
type duoQueue struct {
	TeamID   string `json:"teamId"`
	Goal     int    `json:"goal"`
	Since    int64  `json:"since"`
	LastSeen int64  `json:"lastSeen"`
}
type duoSide struct {
	TeamID   string `json:"teamId"`
	Progress int    `json:"progress"`
	Errors   int    `json:"errors"`
}
type duoMatch struct {
	ID      string     `json:"id"`
	Goal    int        `json:"goal"`
	Started int64      `json:"started"`
	Ended   int64      `json:"ended"`
	Status  string     `json:"status"`
	Winner  string     `json:"winner"`
	Reason  string     `json:"reason"`
	Sides   [2]duoSide `json:"sides"`
}
type duoNotice struct {
	Team    string `json:"team"`
	Goal    int    `json:"goal"`
	Seconds int64  `json:"seconds"`
	At      int64  `json:"at"`
}
type duoStore struct {
	Teams    map[string]*duoTeam  `json:"teams"`
	UserTeam map[string]string    `json:"userTeam"`
	Queue    map[string]duoQueue  `json:"queue"`
	Matches  map[string]*duoMatch `json:"matches"`
	Notices  []duoNotice          `json:"notices"`
}

func (f *features) loadDuos() error {
	if b, err := os.ReadFile(f.duoPath); err == nil {
		if err = json.Unmarshal(b, &f.duos); err != nil {
			return err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if f.duos.Teams == nil {
		f.duos.Teams = map[string]*duoTeam{}
	}
	if f.duos.UserTeam == nil {
		f.duos.UserTeam = map[string]string{}
	}
	if f.duos.Queue == nil {
		f.duos.Queue = map[string]duoQueue{}
	}
	if f.duos.Matches == nil {
		f.duos.Matches = map[string]*duoMatch{}
	}
	if f.duos.Notices == nil {
		f.duos.Notices = []duoNotice{}
	}
	return nil
}
func (f *features) saveDuos() error {
	b, err := json.Marshal(f.duos)
	if err != nil {
		return err
	}
	tmp := f.duoPath + ".tmp"
	if err = os.WriteFile(tmp, b, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, f.duoPath)
}
func (f *features) myDuo(user string) *duoTeam {
	team := f.duos.Teams[f.duos.UserTeam[user]]
	if team == nil || !team.Active {
		return nil
	}
	return team
}
func duoNames(team *duoTeam) string {
	if team == nil {
		return ""
	}
	if team.Members[1].User == "" {
		return team.Members[0].Name
	}
	return team.Members[0].Name + " & " + team.Members[1].Name
}
func (f *features) duoBoards() map[string]any {
	type row struct {
		Name          string `json:"name"`
		PracticeTotal int    `json:"practiceTotal"`
		Tier          string `json:"tier"`
		Points        int    `json:"points"`
		Wins          int    `json:"wins"`
	}
	practice := make([]row, 0)
	ranked := make([]row, 0)
	for _, team := range f.duos.Teams {
		if !team.Active || team.Members[1].User == "" {
			continue
		}
		x := row{duoNames(team), team.PracticeTotal, raceTiers[raceTier(team.Points)], team.Points, team.Wins}
		practice = append(practice, x)
		ranked = append(ranked, x)
	}
	sort.Slice(practice, func(i, j int) bool {
		if practice[i].PracticeTotal != practice[j].PracticeTotal {
			return practice[i].PracticeTotal > practice[j].PracticeTotal
		}
		return practice[i].Name < practice[j].Name
	})
	sort.Slice(ranked, func(i, j int) bool {
		if ranked[i].Points != ranked[j].Points {
			return ranked[i].Points > ranked[j].Points
		}
		return ranked[i].Name < ranked[j].Name
	})
	if len(practice) > 50 {
		practice = practice[:50]
	}
	if len(ranked) > 50 {
		ranked = ranked[:50]
	}
	return map[string]any{"practice": practice, "competitive": ranked}
}
func (f *features) duoQuestion(seed string, goal, index int) quizQuestion {
	pseudo := &raceMatch{ID: "duo:" + seed, Goal: goal}
	return f.raceQuestion(pseudo, index)
}
func (f *features) duoState(user string) map[string]any {
	result := map[string]any{"mode": "solo", "goals": raceGoals, "boards": f.duoBoards(), "notices": f.duos.Notices}
	team := f.myDuo(user)
	if team == nil {
		return result
	}
	result["team"] = map[string]any{"id": team.ID, "inviteCode": team.ID, "names": duoNames(team), "members": []string{team.Members[0].Name, team.Members[1].Name}, "points": team.Points, "tier": raceTiers[raceTier(team.Points)], "tierIndex": raceTier(team.Points), "wins": team.Wins, "losses": team.Losses, "practiceTotal": team.PracticeTotal, "practiceGoal": team.PracticeGoal, "practiceProgress": team.PracticeProgress, "practiceErrors": team.PracticeErrors}
	if team.Members[1].User == "" {
		result["mode"] = "inviting"
		return result
	}
	if match := f.duos.Matches[team.CurrentMatch]; match != nil {
		index := 0
		if match.Sides[1].TeamID == team.ID {
			index = 1
		}
		mine, opponent := match.Sides[index], match.Sides[1-index]
		result["matchId"] = match.ID
		result["goal"] = match.Goal
		result["myProgress"] = mine.Progress
		result["myErrors"] = mine.Errors
		result["opponentProgress"] = opponent.Progress
		result["opponentErrors"] = opponent.Errors
		result["opponentName"] = duoNames(f.duos.Teams[opponent.TeamID])
		if match.Status == "active" {
			result["mode"] = "racing"
			result["question"] = f.duoQuestion(match.ID, match.Goal, mine.Progress)
		} else {
			result["mode"] = "finished"
			result["won"] = match.Winner == team.ID
			result["reason"] = match.Reason
		}
		return result
	}
	if wait, ok := f.duos.Queue[team.ID]; ok {
		result["mode"] = "waiting"
		result["goal"] = wait.Goal
		return result
	}
	if team.PracticeGoal > 0 {
		if team.PracticeProgress < team.PracticeGoal {
			result["mode"] = "practicing"
			result["question"] = f.duoQuestion(team.PracticeSeed, team.PracticeGoal, team.PracticeProgress)
		} else {
			result["mode"] = "practice_done"
		}
		return result
	}
	result["mode"] = "ready"
	return result
}
func (f *features) duoStatus(w http.ResponseWriter, r *http.Request) {
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
	if team := f.myDuo(user); team != nil {
		if wait, ok := f.duos.Queue[team.ID]; ok {
			wait.LastSeen = time.Now().Unix()
			f.duos.Queue[team.ID] = wait
			if err = f.saveDuos(); err != nil {
				http.Error(w, "storage unavailable", 500)
				return
			}
		}
	}
	writeJSON(w, f.duoState(user))
}

func (f *features) duoCreate(w http.ResponseWriter, r *http.Request) {
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
		Name string `json:"name"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 512)
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		http.Error(w, "invalid name", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.myDuo(user) != nil {
		http.Error(w, "请先解除现有搭档", 409)
		return
	}
	id, err := randomCode()
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	team := &duoTeam{ID: id, Members: [2]duoMember{{User: user, Name: cleanName(body.Name)}}, Active: true, Created: time.Now().Unix()}
	f.duos.Teams[id] = team
	f.duos.UserTeam[user] = id
	if err = f.saveDuos(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.duoState(user))
}
func (f *features) duoJoin(w http.ResponseWriter, r *http.Request) {
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
		Code string `json:"code"`
		Name string `json:"name"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 512)
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		http.Error(w, "invalid invitation", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.myDuo(user) != nil {
		http.Error(w, "请先解除现有搭档", 409)
		return
	}
	id := strings.ToUpper(strings.TrimSpace(body.Code))
	team := f.duos.Teams[id]
	if team == nil || !team.Active || team.Members[1].User != "" || team.Members[0].User == user {
		http.Error(w, "邀请口令无效或队伍已满", 400)
		return
	}
	team.Members[1] = duoMember{User: user, Name: cleanName(body.Name)}
	f.duos.UserTeam[user] = id
	if err = f.saveDuos(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.duoState(user))
}
func (f *features) duoFinish(match *duoMatch, winner int, reason string) {
	match.Status = "finished"
	match.Winner = match.Sides[winner].TeamID
	match.Reason = reason
	match.Ended = time.Now().UnixMilli()
	w := f.duos.Teams[match.Winner]
	w.Wins++
	w.Points += 30
	l := f.duos.Teams[match.Sides[1-winner].TeamID]
	l.Losses++
	l.Points -= 20
	if l.Points < 0 {
		l.Points = 0
	}
	if reason == "completed" {
		f.duos.Notices = append([]duoNotice{{Team: duoNames(w), Goal: match.Goal, Seconds: (match.Ended - match.Started) / 1000, At: match.Ended}}, f.duos.Notices...)
		if len(f.duos.Notices) > 20 {
			f.duos.Notices = f.duos.Notices[:20]
		}
	}
}
func (f *features) duoLeave(w http.ResponseWriter, r *http.Request) {
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
	team := f.myDuo(user)
	if team == nil {
		http.Error(w, "没有双排队伍", 409)
		return
	}
	if match := f.duos.Matches[team.CurrentMatch]; match != nil && match.Status == "active" {
		winner := 0
		if match.Sides[0].TeamID == team.ID {
			winner = 1
		}
		f.duoFinish(match, winner, "forfeit")
	}
	delete(f.duos.Queue, team.ID)
	delete(f.duos.UserTeam, team.Members[0].User)
	delete(f.duos.UserTeam, team.Members[1].User)
	team.Active = false
	if err = f.saveDuos(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.duoState(user))
}

func (f *features) duoPracticeStart(w http.ResponseWriter, r *http.Request) {
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
		Goal int `json:"goal"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 512)
	if json.NewDecoder(r.Body).Decode(&body) != nil || !validRaceGoal(body.Goal) {
		http.Error(w, "invalid goal", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	team := f.myDuo(user)
	if team == nil || team.Members[1].User == "" {
		http.Error(w, "请先邀请一位搭档", 403)
		return
	}
	if match := f.duos.Matches[team.CurrentMatch]; match != nil && match.Status == "active" {
		http.Error(w, "请先完成双排竞技", 409)
		return
	}
	seed, err := randomCode()
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	team.CurrentMatch = ""
	team.PracticeGoal = body.Goal
	team.PracticeProgress = 0
	team.PracticeErrors = 0
	team.PracticeSeed = seed
	if err = f.saveDuos(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.duoState(user))
}
func (f *features) duoPracticeAnswer(w http.ResponseWriter, r *http.Request) {
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
		Index  int `json:"index"`
		Choice int `json:"choice"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 512)
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		http.Error(w, "invalid answer", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	team := f.myDuo(user)
	if team == nil || team.Members[1].User == "" || team.PracticeGoal == 0 || team.PracticeProgress >= team.PracticeGoal {
		http.Error(w, "没有进行中的双排练习", 409)
		return
	}
	if body.Index != team.PracticeProgress {
		http.Error(w, "搭档已完成这题，请刷新", 409)
		return
	}
	q := f.duoQuestion(team.PracticeSeed, team.PracticeGoal, body.Index)
	valid := false
	for _, v := range q.Options {
		if v.ID == body.Choice {
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
		team.PracticeProgress++
		team.PracticeTotal++
	} else {
		team.PracticeErrors++
	}
	if err = f.saveDuos(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, map[string]any{"correct": correct, "answer": q.ID, "state": f.duoState(user)})
}

func (f *features) duoPracticeStop(w http.ResponseWriter, r *http.Request) {
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
	team := f.myDuo(user)
	if team == nil {
		http.Error(w, "no team", 403)
		return
	}
	if match := f.duos.Matches[team.CurrentMatch]; match != nil && match.Status == "active" {
		http.Error(w, "请先完成双排竞技", 409)
		return
	}
	team.CurrentMatch = ""
	team.PracticeGoal = 0
	team.PracticeProgress = 0
	team.PracticeSeed = ""
	team.PracticeErrors = 0
	if err = f.saveDuos(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.duoState(user))
}

func (f *features) duoRaceJoin(w http.ResponseWriter, r *http.Request) {
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
		Goal int `json:"goal"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 512)
	if json.NewDecoder(r.Body).Decode(&body) != nil || !validRaceGoal(body.Goal) {
		http.Error(w, "invalid goal", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	team := f.myDuo(user)
	if team == nil || team.Members[1].User == "" {
		http.Error(w, "请先邀请一位搭档", 403)
		return
	}
	if match := f.duos.Matches[team.CurrentMatch]; match != nil && match.Status == "active" {
		http.Error(w, "已有进行中的双排竞技", 409)
		return
	}
	delete(f.duos.Queue, team.ID)
	now := time.Now().Unix()
	for id, wait := range f.duos.Queue {
		if now-wait.LastSeen > 120 {
			delete(f.duos.Queue, id)
		}
	}
	myTier := raceTier(team.Points)
	candidates := make([]duoQueue, 0)
	for _, wait := range f.duos.Queue {
		other := f.duos.Teams[wait.TeamID]
		if other == nil || !other.Active || other.Members[1].User == "" {
			continue
		}
		gap := raceTier(other.Points) - myTier
		if gap < 0 {
			gap = -gap
		}
		if wait.Goal == body.Goal && gap <= 1 {
			candidates = append(candidates, wait)
		}
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].Since < candidates[j].Since })
	if len(candidates) == 0 {
		f.duos.Queue[team.ID] = duoQueue{TeamID: team.ID, Goal: body.Goal, Since: now, LastSeen: now}
		team.CurrentMatch = ""
	} else {
		other := f.duos.Teams[candidates[0].TeamID]
		delete(f.duos.Queue, other.ID)
		id, err := randomCode()
		if err != nil {
			http.Error(w, "storage unavailable", 500)
			return
		}
		match := &duoMatch{ID: id, Goal: body.Goal, Started: time.Now().UnixMilli(), Status: "active", Sides: [2]duoSide{{TeamID: other.ID}, {TeamID: team.ID}}}
		f.duos.Matches[id] = match
		team.CurrentMatch = id
		other.CurrentMatch = id
	}
	if err = f.saveDuos(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.duoState(user))
}
func (f *features) duoRaceAnswer(w http.ResponseWriter, r *http.Request) {
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
	r.Body = http.MaxBytesReader(w, r.Body, 512)
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		http.Error(w, "invalid answer", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	team := f.myDuo(user)
	if team == nil {
		http.Error(w, "no team", 403)
		return
	}
	match := f.duos.Matches[team.CurrentMatch]
	if match == nil || match.ID != body.MatchID || match.Status != "active" {
		http.Error(w, "对局已结束", 409)
		return
	}
	index := 0
	if match.Sides[1].TeamID == team.ID {
		index = 1
	}
	side := &match.Sides[index]
	if body.Index != side.Progress || body.Index < 0 || body.Index >= match.Goal {
		http.Error(w, "搭档已完成这题，请刷新", 409)
		return
	}
	q := f.duoQuestion(match.ID, match.Goal, body.Index)
	valid := false
	for _, v := range q.Options {
		if v.ID == body.Choice {
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
		side.Progress++
		if side.Progress == match.Goal {
			f.duoFinish(match, index, "completed")
		}
	} else {
		side.Errors++
	}
	if err = f.saveDuos(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, map[string]any{"correct": correct, "answer": q.ID, "state": f.duoState(user)})
}
func (f *features) duoRaceCancel(w http.ResponseWriter, r *http.Request) {
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
	team := f.myDuo(user)
	if team == nil {
		http.Error(w, "no team", 403)
		return
	}
	delete(f.duos.Queue, team.ID)
	if err = f.saveDuos(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.duoState(user))
}
func (f *features) duoRaceForfeit(w http.ResponseWriter, r *http.Request) {
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
	team := f.myDuo(user)
	if team == nil {
		http.Error(w, "no team", 403)
		return
	}
	match := f.duos.Matches[team.CurrentMatch]
	if match == nil || match.Status != "active" {
		http.Error(w, "no active match", 409)
		return
	}
	winner := 0
	if match.Sides[0].TeamID == team.ID {
		winner = 1
	}
	f.duoFinish(match, winner, "forfeit")
	if err = f.saveDuos(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.duoState(user))
}
