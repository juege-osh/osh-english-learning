package main

import (
	"crypto/subtle"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"time"
)

type roomAttempt struct {
	Count int
	Until int64
}

// Call with f.mu held. Nginx replaces X-Real-IP before forwarding requests.
func (f *features) roomPasswordCheck(w http.ResponseWriter, r *http.Request, roomID, password, salt, hash string) bool {
	if hash == "" {
		return true
	}
	ip := r.Header.Get("X-Real-IP")
	if net.ParseIP(ip) == nil {
		ip, _, _ = net.SplitHostPort(r.RemoteAddr)
	}
	key := roomID + ":" + ip
	now := time.Now().Unix()
	if len(f.roomTries) > 1000 {
		for id, attempt := range f.roomTries {
			if attempt.Until <= now {
				delete(f.roomTries, id)
			}
		}
	}
	attempt := f.roomTries[key]
	if attempt.Until > now && attempt.Count >= 5 {
		http.Error(w, "密码错误次数过多，请一分钟后再试", http.StatusTooManyRequests)
		return false
	}
	if checkRoomPassword(password, salt, hash) {
		delete(f.roomTries, key)
		return true
	}
	if attempt.Until <= now {
		attempt = roomAttempt{Until: now + 60}
	}
	attempt.Count++
	f.roomTries[key] = attempt
	http.Error(w, "房间密码错误", http.StatusForbidden)
	return false
}

func validRoomPassword(password string) bool {
	return len([]rune(password)) >= 4 && len([]rune(password)) <= 32 && strings.TrimSpace(password) == password
}

func roomPassword(password string) (string, string, error) {
	if password == "" {
		return "", "", nil
	}
	salt, err := randomHex(16)
	if err != nil {
		return "", "", err
	}
	hash, err := passHash(password, salt)
	return salt, hash, err
}

func checkRoomPassword(password, salt, hash string) bool {
	if hash == "" {
		return true
	}
	if !validRoomPassword(password) {
		return false
	}
	actual, err := passHash(password, salt)
	return err == nil && subtle.ConstantTimeCompare([]byte(actual), []byte(hash)) == 1
}

func roomPost(w http.ResponseWriter, r *http.Request, body any) bool {
	if r.Method != http.MethodPost || !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		http.Error(w, "JSON POST required", 405)
		return false
	}
	if !sameOrigin(r) {
		http.Error(w, "origin denied", 403)
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	if json.NewDecoder(r.Body).Decode(body) != nil {
		http.Error(w, "invalid room request", 400)
		return false
	}
	return true
}

func (f *features) raceRoomCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Goal     int    `json:"goal"`
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if !roomPost(w, r, &body) {
		return
	}
	if !validRaceGoal(body.Goal) || !validRoomPassword(body.Password) {
		http.Error(w, "请选择词量并设置 4 到 32 个字符的密码", 400)
		return
	}
	user, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	salt, hash, err := roomPassword(body.Password)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if match := f.races.Matches[f.races.Active[user]]; match != nil && match.Status == "active" {
		http.Error(w, "请先完成当前对局", 409)
		return
	}
	id, err := randomCode()
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	now := time.Now().Unix()
	f.races.Waiting[user] = raceWaiting{User: user, Name: cleanName(body.Name), Goal: body.Goal, Since: now, LastSeen: now, RoomID: id, RoomSalt: salt, RoomHash: hash}
	if f.saveRaces() != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.raceState(user))
}

func (f *features) raceRoomJoin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code     string `json:"code"`
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if !roomPost(w, r, &body) {
		return
	}
	user, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	code := strings.ToUpper(strings.TrimSpace(body.Code))
	f.mu.Lock()
	defer f.mu.Unlock()
	if match := f.races.Matches[f.races.Active[user]]; match != nil && match.Status == "active" {
		http.Error(w, "请先完成当前对局", 409)
		return
	}
	var host raceWaiting
	for _, wait := range f.races.Waiting {
		if wait.RoomID == code {
			host = wait
			break
		}
	}
	if host.RoomID == "" || host.User == user || time.Now().Unix()-host.LastSeen > 120 {
		http.Error(w, "房间不存在或已过期", 404)
		return
	}
	gap := raceTier(f.races.Profiles[host.User].Points) - raceTier(f.races.Profiles[user].Points)
	if gap < -1 || gap > 1 {
		http.Error(w, "双方段位最多相差一阶", 403)
		return
	}
	if !f.roomPasswordCheck(w, r, host.RoomID, body.Password, host.RoomSalt, host.RoomHash) {
		return
	}
	id, err := randomCode()
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	delete(f.races.Waiting, user)
	delete(f.races.Waiting, host.User)
	match := &raceMatch{ID: id, Goal: host.Goal, Started: time.Now().UnixMilli(), Status: "active", Players: [2]racePlayer{{User: host.User, Name: host.Name}, {User: user, Name: cleanName(body.Name)}}}
	f.races.Matches[id] = match
	f.races.Active[user] = id
	f.races.Active[host.User] = id
	if f.saveRaces() != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.raceState(user))
}

func (f *features) duoRoomCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Goal     int    `json:"goal"`
		Password string `json:"password"`
	}
	if !roomPost(w, r, &body) {
		return
	}
	if !validRaceGoal(body.Goal) || !validRoomPassword(body.Password) {
		http.Error(w, "请选择词量并设置 4 到 32 个字符的密码", 400)
		return
	}
	user, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	salt, hash, err := roomPassword(body.Password)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	team := f.myDuo(user)
	if team == nil || team.Members[1].User == "" {
		http.Error(w, "请先组成两人队伍", 403)
		return
	}
	if match := f.duos.Matches[team.CurrentMatch]; match != nil && match.Status == "active" {
		http.Error(w, "已有进行中的双排竞技", 409)
		return
	}
	id, err := randomCode()
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	now := time.Now().Unix()
	f.duos.Queue[team.ID] = duoQueue{TeamID: team.ID, Goal: body.Goal, Since: now, LastSeen: now, RoomID: id, RoomSalt: salt, RoomHash: hash}
	team.CurrentMatch = ""
	if f.saveDuos() != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.duoState(user))
}

func (f *features) duoRoomJoin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code     string `json:"code"`
		Password string `json:"password"`
	}
	if !roomPost(w, r, &body) {
		return
	}
	user, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	code := strings.ToUpper(strings.TrimSpace(body.Code))
	f.mu.Lock()
	defer f.mu.Unlock()
	team := f.myDuo(user)
	if team == nil || team.Members[1].User == "" {
		http.Error(w, "请先组成两人队伍", 403)
		return
	}
	if match := f.duos.Matches[team.CurrentMatch]; match != nil && match.Status == "active" {
		http.Error(w, "已有进行中的双排竞技", 409)
		return
	}
	var wait duoQueue
	for _, item := range f.duos.Queue {
		if item.RoomID == code {
			wait = item
			break
		}
	}
	other := f.duos.Teams[wait.TeamID]
	if wait.RoomID == "" || other == nil || !other.Active || other.Members[1].User == "" || other.ID == team.ID || time.Now().Unix()-wait.LastSeen > 120 {
		http.Error(w, "房间不存在或已过期", 404)
		return
	}
	gap := raceTier(other.Points) - raceTier(team.Points)
	if gap < -1 || gap > 1 {
		http.Error(w, "双方队伍段位最多相差一阶", 403)
		return
	}
	if !f.roomPasswordCheck(w, r, wait.RoomID, body.Password, wait.RoomSalt, wait.RoomHash) {
		return
	}
	id, err := randomCode()
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	delete(f.duos.Queue, team.ID)
	delete(f.duos.Queue, other.ID)
	match := &duoMatch{ID: id, Goal: wait.Goal, Started: time.Now().UnixMilli(), Status: "active", Sides: [2]duoSide{{TeamID: other.ID}, {TeamID: team.ID}}}
	f.duos.Matches[id] = match
	team.CurrentMatch = id
	other.CurrentMatch = id
	if f.saveDuos() != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, f.duoState(user))
}
