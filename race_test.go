package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestRaceOrderCoversEveryWordWithoutRepeats(t *testing.T) {
	for _, goal := range raceGoals {
		seen := make([]bool, goal)
		for index := 0; index < goal; index++ {
			position := raceOrderIndex("new-match-123", goal, index)
			if position < 0 || position >= goal || seen[position] {
				t.Fatalf("goal %d index %d produced duplicate/out-of-range word %d", goal, index, position)
			}
			seen[position] = true
		}
	}
}

func TestExistingRaceKeepsItsOriginalQuestionOrder(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	legacy := &raceMatch{ID: "existing-match", Goal: 100}
	order := seededRaceRNG("order:" + legacy.ID).Perm(legacy.Goal)
	for index := 0; index < legacy.Goal; index++ {
		if got := f.raceQuestion(legacy, index).ID; got != f.words[order[index]].ID {
			t.Fatalf("legacy question %d changed from %d to %d", index, f.words[order[index]].ID, got)
		}
	}
}

func raceVisit(t *testing.T, f *features) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	f.membership(w, httptest.NewRequest("GET", "/api/membership", nil))
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	return w
}

func raceJoinTest(t *testing.T, f *features, visitor *httptest.ResponseRecorder, goal int, name string) map[string]any {
	t.Helper()
	b, _ := json.Marshal(map[string]any{"goal": goal, "name": name})
	r := httptest.NewRequest("POST", "/api/race/join", bytes.NewReader(b))
	r.Header.Set("Content-Type", "application/json")
	r.AddCookie(visitor.Result().Cookies()[0])
	w := httptest.NewRecorder()
	f.raceJoin(w, r)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var result map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestRaceMatchFinishAndAnnouncement(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	a, b := raceVisit(t, f), raceVisit(t, f)
	first := raceJoinTest(t, f, a, 100, "甲")
	if first["mode"] != "waiting" {
		t.Fatalf("first not waiting: %+v", first)
	}
	second := raceJoinTest(t, f, b, 100, "乙")
	if second["mode"] != "racing" {
		t.Fatalf("second not matched: %+v", second)
	}
	matchID := second["matchId"].(string)
	for i := 0; i < 100; i++ {
		q := f.raceQuestion(f.races.Matches[matchID], i)
		body, _ := json.Marshal(map[string]any{"matchId": matchID, "index": i, "choice": q.ID})
		r := httptest.NewRequest("POST", "/api/race/answer", bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.AddCookie(b.Result().Cookies()[0])
		w := httptest.NewRecorder()
		f.raceAnswer(w, r)
		if w.Code != 200 {
			t.Fatalf("answer %d: %s", i, w.Body.String())
		}
	}
	status := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/api/race/status", nil)
	r.AddCookie(b.Result().Cookies()[0])
	f.raceStatus(status, r)
	var state map[string]any
	if err := json.Unmarshal(status.Body.Bytes(), &state); err != nil || state["mode"] != "finished" || state["won"] != true {
		t.Fatalf("winner state: %s", status.Body.String())
	}
	if len(f.races.Notices) != 1 || f.races.Notices[0].Winner != "乙" {
		t.Fatalf("announcement: %+v", f.races.Notices)
	}
	if f.races.Profiles[b.Result().Cookies()[0].Value].Wins != 1 {
		t.Fatal("win not recorded")
	}
	if f.races.Profiles[a.Result().Cookies()[0].Value].Losses != 1 {
		t.Fatal("loss not recorded")
	}
	loaded, err := newFeatures(f.racePath[:len(f.racePath)-len("/races.json")])
	if err != nil || len(loaded.races.Notices) != 1 {
		t.Fatal("race result not persisted", err)
	}
	if again := raceJoinTest(t, f, b, 100, "乙"); again["mode"] != "waiting" {
		t.Fatalf("rematch must enter queue instead of reopening finished result: %+v", again)
	}
	private := roomRequest(t, f.raceRoomCreate, a, "/api/race/room/create", map[string]any{"goal": 100, "name": "甲", "password": "secret8"}, 200)
	if private["mode"] != "waiting" || private["roomId"] == "" {
		t.Fatalf("private room after a match must stay visible: %+v", private)
	}
}

func TestRaceTierGap(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	a, b, c := raceVisit(t, f), raceVisit(t, f), raceVisit(t, f)
	aID, bID, cID := a.Result().Cookies()[0].Value, b.Result().Cookies()[0].Value, c.Result().Cookies()[0].Value
	f.races.Profiles[aID] = raceProfile{Points: 0}
	f.races.Profiles[bID] = raceProfile{Points: 200}
	f.races.Profiles[cID] = raceProfile{Points: 100}
	raceJoinTest(t, f, a, 500, "青铜")
	if got := raceJoinTest(t, f, b, 500, "黄金"); got["mode"] != "waiting" {
		t.Fatal("two-tier gap matched")
	}
	if got := raceJoinTest(t, f, c, 500, "白银"); got["mode"] != "racing" {
		t.Fatal("adjacent tier did not match")
	}
}
