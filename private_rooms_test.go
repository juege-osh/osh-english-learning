package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func roomRequest(t *testing.T, handler func(http.ResponseWriter, *http.Request), visitor *httptest.ResponseRecorder, path string, payload map[string]any, want int) map[string]any {
	t.Helper()
	b, _ := json.Marshal(payload)
	r := httptest.NewRequest("POST", path, bytes.NewReader(b))
	r.Header.Set("Content-Type", "application/json")
	r.AddCookie(visitor.Result().Cookies()[0])
	w := httptest.NewRecorder()
	handler(w, r)
	if w.Code != want {
		t.Fatalf("%s: got %d want %d: %s", path, w.Code, want, w.Body.String())
	}
	if want != 200 {
		return nil
	}
	var state map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &state); err != nil {
		t.Fatal(err)
	}
	return state
}

func TestPrivateRaceRoom(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	a, b, c := raceVisit(t, f), raceVisit(t, f), raceVisit(t, f)
	created := roomRequest(t, f.raceRoomCreate, a, "/api/race/room/create", map[string]any{"goal": 100, "name": "甲", "password": "secret8"}, 200)
	code := created["roomId"].(string)
	if created["mode"] != "waiting" || code == "" {
		t.Fatal(created)
	}
	if got := raceJoinTest(t, f, c, 100, "随机选手"); got["mode"] != "waiting" {
		t.Fatal("private room leaked into random match")
	}
	roomRequest(t, f.raceRoomJoin, b, "/api/race/room/join", map[string]any{"code": code, "name": "乙", "password": "wrong"}, 403)
	joined := roomRequest(t, f.raceRoomJoin, b, "/api/race/room/join", map[string]any{"code": code, "name": "乙", "password": "secret8"}, 200)
	if joined["mode"] != "racing" || joined["goal"] != float64(100) {
		t.Fatal(joined)
	}
	if got := f.raceState(a.Result().Cookies()[0].Value); got["mode"] != "racing" {
		t.Fatal(got)
	}
}

func TestPasswordRoomStopsRepeatedGuesses(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	host, guest := raceVisit(t, f), raceVisit(t, f)
	created := roomRequest(t, f.raceRoomCreate, host, "/api/race/room/create", map[string]any{"goal": 100, "password": "secret8"}, 200)
	code := created["roomId"].(string)
	for range 5 {
		roomRequest(t, f.raceRoomJoin, guest, "/api/race/room/join", map[string]any{"code": code, "password": "wrong"}, 403)
	}
	roomRequest(t, f.raceRoomJoin, guest, "/api/race/room/join", map[string]any{"code": code, "password": "secret8"}, 429)
	for key := range f.roomTries {
		delete(f.roomTries, key)
	}
	joined := roomRequest(t, f.raceRoomJoin, guest, "/api/race/room/join", map[string]any{"code": code, "password": "secret8"}, 200)
	if joined["mode"] != "racing" {
		t.Fatal(joined)
	}
}

func TestPasswordRoomDoesNotLockOutAnotherVisitor(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	host, wrongGuest, rightGuest := raceVisit(t, f), raceVisit(t, f), raceVisit(t, f)
	created := roomRequest(t, f.raceRoomCreate, host, "/api/race/room/create", map[string]any{"goal": 100, "password": "secret8"}, 200)
	code := created["roomId"].(string)
	for range 5 {
		roomRequest(t, f.raceRoomJoin, wrongGuest, "/api/race/room/join", map[string]any{"code": code, "password": "wrong"}, 403)
	}
	roomRequest(t, f.raceRoomJoin, wrongGuest, "/api/race/room/join", map[string]any{"code": code, "password": "secret8"}, 429)
	joined := roomRequest(t, f.raceRoomJoin, rightGuest, "/api/race/room/join", map[string]any{"code": code, "password": "secret8"}, 200)
	if joined["mode"] != "racing" {
		t.Fatal(joined)
	}
}

func TestPrivateDuoRoom(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	a, b, c, d := raceVisit(t, f), raceVisit(t, f), raceVisit(t, f), raceVisit(t, f)
	first := roomRequest(t, f.duoCreate, a, "/api/duo/create", map[string]any{"name": "甲", "password": "team8"}, 200)
	teamCode := first["team"].(map[string]any)["inviteCode"].(string)
	roomRequest(t, f.duoJoin, b, "/api/duo/join", map[string]any{"code": teamCode, "name": "乙", "password": "bad"}, 403)
	roomRequest(t, f.duoJoin, b, "/api/duo/join", map[string]any{"code": teamCode, "name": "乙", "password": "team8"}, 200)
	second := roomRequest(t, f.duoCreate, c, "/api/duo/create", map[string]any{"name": "丙"}, 200)
	secondCode := second["team"].(map[string]any)["inviteCode"].(string)
	roomRequest(t, f.duoJoin, d, "/api/duo/join", map[string]any{"code": secondCode, "name": "丁"}, 200)
	created := roomRequest(t, f.duoRoomCreate, a, "/api/duo/race/room/create", map[string]any{"goal": 100, "password": "race8"}, 200)
	code := created["roomId"].(string)
	if code == "" || created["mode"] != "waiting" {
		t.Fatal(created)
	}
	roomRequest(t, f.duoRoomJoin, c, "/api/duo/race/room/join", map[string]any{"code": code, "password": "bad"}, 403)
	joined := roomRequest(t, f.duoRoomJoin, c, "/api/duo/race/room/join", map[string]any{"code": code, "password": "race8"}, 200)
	if joined["mode"] != "racing" {
		t.Fatal(joined)
	}
	if got := f.duoState(b.Result().Cookies()[0].Value); got["mode"] != "racing" {
		t.Fatal(got)
	}
}
