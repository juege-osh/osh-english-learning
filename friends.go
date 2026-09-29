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

type friendProfile struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Goal     int    `json:"goal"`
	BaseTier string `json:"baseTier"`
	Learned  int    `json:"learned"`
	Passed   int    `json:"passed"`
	Activity string `json:"activity"`
	Updated  int64  `json:"updated"`
}
type friendRequest struct {
	ID   string `json:"id"`
	From string `json:"from"`
	To   string `json:"to"`
	At   int64  `json:"at"`
}
type friendStore struct {
	Profiles map[string]friendProfile   `json:"profiles"`
	Requests map[string]friendRequest   `json:"requests"`
	Links    map[string]map[string]bool `json:"links"`
}

func (f *features) loadFriends() error {
	if b, err := os.ReadFile(f.friendPath); err == nil {
		if err = json.Unmarshal(b, &f.friends); err != nil {
			return err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if f.friends.Profiles == nil {
		f.friends.Profiles = map[string]friendProfile{}
	}
	if f.friends.Requests == nil {
		f.friends.Requests = map[string]friendRequest{}
	}
	if f.friends.Links == nil {
		f.friends.Links = map[string]map[string]bool{}
	}
	return nil
}
func (f *features) saveFriends() error {
	b, err := json.Marshal(f.friends)
	if err != nil {
		return err
	}
	tmp := f.friendPath + ".tmp"
	if err = os.WriteFile(tmp, b, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, f.friendPath)
}
func (f *features) ensureFriendProfile(user string) (friendProfile, error) {
	if profile, ok := f.friends.Profiles[user]; ok {
		return profile, nil
	}
	code, err := randomCode()
	if err != nil {
		return friendProfile{}, err
	}
	profile := friendProfile{Code: code, Name: "英语旅人", Goal: 10000, BaseTier: "待结算"}
	f.friends.Profiles[user] = profile
	return profile, nil
}
func (f *features) friendActivity(user string) string {
	if match := f.races.Matches[f.races.Active[user]]; match != nil && match.Status == "active" {
		return "单排竞技中"
	}
	if _, ok := f.races.Waiting[user]; ok {
		return "单排匹配中"
	}
	if team := f.myDuo(user); team != nil {
		if match := f.duos.Matches[team.CurrentMatch]; match != nil && match.Status == "active" {
			return "双排竞技中"
		}
		if _, ok := f.duos.Queue[team.ID]; ok {
			return "双排匹配中"
		}
		if team.PracticeGoal > 0 && team.PracticeProgress < team.PracticeGoal {
			return "双排协作刷题中"
		}
	}
	profile := f.friends.Profiles[user]
	if time.Now().Unix()-profile.Updated <= 120 {
		if profile.Activity == "studying" {
			return "主线刷题中"
		}
		return "在线"
	}
	return "离线"
}
func (f *features) friendPublic(user string) map[string]any {
	p := f.friends.Profiles[user]
	solo := f.races.Profiles[user]
	duoTier := "尚未组队"
	duoPoints := 0
	if team := f.myDuo(user); team != nil && team.Members[1].User != "" {
		duoTier = raceTiers[raceTier(team.Points)]
		duoPoints = team.Points
	}
	return map[string]any{"code": p.Code, "name": p.Name, "goal": p.Goal, "baseTier": p.BaseTier, "learned": p.Learned, "passed": p.Passed, "updated": p.Updated, "status": f.friendActivity(user), "soloTier": raceTiers[raceTier(solo.Points)], "soloPoints": solo.Points, "duoTier": duoTier, "duoPoints": duoPoints}
}
func (f *features) friendState(user string) map[string]any {
	me := f.friendPublic(user)
	type requestView struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		At   int64  `json:"at"`
	}
	incoming := make([]requestView, 0)
	outgoing := make([]requestView, 0)
	for _, request := range f.friends.Requests {
		if request.To == user {
			incoming = append(incoming, requestView{request.ID, f.friends.Profiles[request.From].Name, request.At})
		} else if request.From == user {
			outgoing = append(outgoing, requestView{request.ID, f.friends.Profiles[request.To].Name, request.At})
		}
	}
	sort.Slice(incoming, func(i, j int) bool { return incoming[i].At > incoming[j].At })
	friends := make([]map[string]any, 0)
	for other := range f.friends.Links[user] {
		if _, ok := f.friends.Profiles[other]; ok {
			friends = append(friends, f.friendPublic(other))
		}
	}
	sort.Slice(friends, func(i, j int) bool { return friends[i]["name"].(string) < friends[j]["name"].(string) })
	return map[string]any{"me": me, "incoming": incoming, "outgoing": outgoing, "friends": friends}
}
func (f *features) friendStatus(w http.ResponseWriter, r *http.Request) {
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
	if _, ok := f.friends.Profiles[user]; !ok {
		if _, err = f.ensureFriendProfile(user); err != nil {
			http.Error(w, "storage unavailable", 500)
			return
		}
		if err = f.saveFriends(); err != nil {
			http.Error(w, "storage unavailable", 500)
			return
		}
	}
	writeJSON(w, f.friendState(user))
}
func (f *features) friendProfileUpdate(w http.ResponseWriter, r *http.Request) {
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
		Name     string `json:"name"`
		Goal     int    `json:"goal"`
		BaseTier string `json:"baseTier"`
		Learned  int    `json:"learned"`
		Passed   int    `json:"passed"`
		Activity string `json:"activity"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	if json.NewDecoder(r.Body).Decode(&body) != nil || !validGoal(body.Goal) || body.Learned < 0 || body.Learned > body.Goal || body.Passed < 0 || body.Passed > body.Goal/10 || (body.Activity != "idle" && body.Activity != "studying") {
		http.Error(w, "invalid profile", 400)
		return
	}
	validTier := body.BaseTier == "待结算" || body.BaseTier == "最强王者"
	for _, tier := range raceTiers {
		if body.BaseTier == tier {
			validTier = true
		}
	}
	if !validTier {
		http.Error(w, "invalid tier", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	profile, err := f.ensureFriendProfile(user)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	profile.Name = cleanName(body.Name)
	profile.Goal = body.Goal
	profile.BaseTier = body.BaseTier
	profile.Learned = body.Learned
	profile.Passed = body.Passed
	profile.Activity = body.Activity
	profile.Updated = time.Now().Unix()
	f.friends.Profiles[user] = profile
	if err = f.saveFriends(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.friendState(user))
}
func (f *features) friendRequestCreate(w http.ResponseWriter, r *http.Request) {
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
	}
	r.Body = http.MaxBytesReader(w, r.Body, 512)
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		http.Error(w, "invalid code", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, err = f.ensureFriendProfile(user); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	code := strings.ToUpper(strings.TrimSpace(body.Code))
	target := ""
	for id, p := range f.friends.Profiles {
		if p.Code == code {
			target = id
			break
		}
	}
	if target == "" || target == user {
		http.Error(w, "好友口令无效", 400)
		return
	}
	if f.friends.Links[user][target] {
		http.Error(w, "已经是好友", 409)
		return
	}
	for _, request := range f.friends.Requests {
		if request.From == user && request.To == target || request.From == target && request.To == user {
			http.Error(w, "好友申请已经存在", 409)
			return
		}
	}
	id, err := randomCode()
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	f.friends.Requests[id] = friendRequest{ID: id, From: user, To: target, At: time.Now().Unix()}
	if err = f.saveFriends(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.friendState(user))
}
func (f *features) friendRequestAccept(w http.ResponseWriter, r *http.Request) {
	f.friendRequestDecision(w, r, true)
}
func (f *features) friendRequestDecline(w http.ResponseWriter, r *http.Request) {
	f.friendRequestDecision(w, r, false)
}
func (f *features) friendRequestDecision(w http.ResponseWriter, r *http.Request, accept bool) {
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
		ID string `json:"id"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 512)
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		http.Error(w, "invalid request", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	request, ok := f.friends.Requests[body.ID]
	if !ok || request.To != user {
		http.Error(w, "没有这条好友申请", 404)
		return
	}
	delete(f.friends.Requests, body.ID)
	if accept {
		if f.friends.Links[user] == nil {
			f.friends.Links[user] = map[string]bool{}
		}
		if f.friends.Links[request.From] == nil {
			f.friends.Links[request.From] = map[string]bool{}
		}
		f.friends.Links[user][request.From] = true
		f.friends.Links[request.From][user] = true
	}
	if err = f.saveFriends(); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.friendState(user))
}
func (f *features) friendRemove(w http.ResponseWriter, r *http.Request) {
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
	}
	r.Body = http.MaxBytesReader(w, r.Body, 512)
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		http.Error(w, "invalid code", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	for other := range f.friends.Links[user] {
		if f.friends.Profiles[other].Code == body.Code {
			delete(f.friends.Links[user], other)
			delete(f.friends.Links[other], user)
			if err = f.saveFriends(); err != nil {
				http.Error(w, "storage unavailable", 500)
				return
			}
			writeJSON(w, f.friendState(user))
			return
		}
	}
	http.Error(w, "不是好友", 404)
}
