package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

func restStart(t *testing.T, f *features, cookie *http.Cookie, goal int) string {
	t.Helper()
	b := permanentDecode(t, permanentRequest(t, f.dailyQuiz, fmt.Sprintf("/api/daily?goal=%d", goal), nil, cookie))
	var id string
	json.Unmarshal(b["attemptId"], &id)
	if id == "" || string(b["restLimit"]) != fmt.Sprint(goal/1000*2) || string(b["paused"]) != "false" {
		t.Fatalf("start timer: %v", b)
	}
	return id
}
func restAction(t *testing.T, f *features, c *http.Cookie, id string, goal int, action string) *httptest.ResponseRecorder {
	t.Helper()
	return permanentRequest(t, f.dailyAttempt, "/api/daily/attempt", map[string]any{"attemptId": id, "goal": goal, "edition": f.mainEdition(goal), "action": action}, c)
}
func TestMainGoalsTwentyIndependentBoards(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	c := permanentVisitor(t, f)
	seen := map[string]bool{}
	for _, g := range mainGoals() {
		if !validGoal(g) {
			t.Fatal(g)
		}
		id := restStart(t, f, c, g)
		if len(f.challenge("", g)) != 20 {
			t.Fatal("question count")
		}
		board := f.data.Attempts[id].Board
		if seen[board] {
			t.Fatal("shared board")
		}
		seen[board] = true
	}
	if len(seen) != 20 {
		t.Fatal(len(seen))
	}
	for _, g := range []int{0, 999, 1500, 20001, -1000} {
		if validGoal(g) {
			t.Fatal(g)
		}
		r := permanentRequest(t, f.dailyQuiz, fmt.Sprintf("/api/daily?goal=%d", g), nil, c)
		if r.Code != 400 {
			t.Fatal(r.Code)
		}
	}
}
func TestMainRestQuotaAndIdempotency(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	c := permanentVisitor(t, f)
	id := restStart(t, f, c, 1000)
	a := f.data.Attempts[id]
	a.Started = time.Now().UnixMilli() - 10000
	f.data.Attempts[id] = a
	for n := 1; n <= 3; n++ {
		permanentDecode(t, restAction(t, f, c, id, 1000, "pause"))
		a = f.data.Attempts[id]
		if a.RestUsed != min(n, 2) || a.FreePause != (n <= 2) || a.PauseAt == 0 {
			t.Fatalf("pause %d: %+v", n, a)
		}
		before := a
		permanentDecode(t, restAction(t, f, c, id, 1000, "pause"))
		if f.data.Attempts[id] != before {
			t.Fatal("duplicate pause consumed quota")
		}
		// Move the server-owned timestamp, rather than relying on sleeping or client durations.
		a.PauseAt -= 2000
		f.data.Attempts[id] = a
		elapsed := boardElapsed(a, time.Now().UnixMilli())
		if n <= 2 && elapsed > 10050 {
			t.Fatal("free pause charged")
		}
		permanentDecode(t, restAction(t, f, c, id, 1000, "resume"))
		a = f.data.Attempts[id]
		if a.PauseAt != 0 || a.FreePause {
			t.Fatal("still paused")
		}
		if n <= 2 && a.RestMs < int64(n*2000) {
			t.Fatal("missing free rest time")
		}
		before = a
		permanentDecode(t, restAction(t, f, c, id, 1000, "resume"))
		if f.data.Attempts[id] != before {
			t.Fatal("duplicate resume changed timer")
		}
	}
	a = f.data.Attempts[id]
	a.PauseAt = time.Now().UnixMilli() - 3000
	a.FreePause = false
	if boardElapsed(a, a.PauseAt+3000)-boardElapsed(a, a.PauseAt) != 3000 {
		t.Fatal("over-quota pause stopped clock")
	}
	state := attemptTimer(id, 1000, a, time.Now().UnixMilli())
	if state["restRemaining"] != 0 {
		t.Fatal(state)
	}
}
func TestMainRestOwnerOriginPauseSubmitAbandon(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	c := permanentVisitor(t, f)
	other := permanentVisitor(t, f)
	id := restStart(t, f, c, 1000)
	if r := restAction(t, f, other, id, 1000, "pause"); r.Code != 400 {
		t.Fatal("foreign visitor", r.Code)
	}
	data, _ := json.Marshal(map[string]any{"attemptId": id, "goal": 1000, "edition": f.mainEdition(1000), "action": "pause"})
	req := httptest.NewRequest("POST", "/api/daily/attempt", bytes.NewReader(data))
	req.AddCookie(c)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://attacker.invalid")
	res := httptest.NewRecorder()
	f.dailyAttempt(res, req)
	if res.Code != 403 || f.data.Attempts[id].PauseAt != 0 {
		t.Fatal("cross-origin mutation")
	}
	permanentDecode(t, restAction(t, f, c, id, 1000, "pause"))
	body := map[string]any{"attemptId": id, "goal": 1000, "edition": f.mainEdition(1000), "answers": permanentAnswers(f.challenge("", 1000), 20), "timeMs": 1}
	if r := permanentRequest(t, f.dailySubmit, "/api/daily/submit", body, c); r.Code != 409 {
		t.Fatal("paused submit", r.Code)
	}
	permanentDecode(t, restAction(t, f, c, id, 1000, "resume"))
	a := f.data.Attempts[id]
	a.Started = time.Now().UnixMilli() - 10000
	f.data.Attempts[id] = a
	b := permanentDecode(t, permanentRequest(t, f.dailySubmit, "/api/daily/submit", body, c))
	var ms int64
	json.Unmarshal(b["timeMs"], &ms)
	if ms < 9000 {
		t.Fatal("trusted client time", ms)
	}
	id = restStart(t, f, c, 1000)
	permanentDecode(t, restAction(t, f, c, id, 1000, "abandon"))
	body["attemptId"] = id
	if r := permanentRequest(t, f.dailySubmit, "/api/daily/submit", body, c); r.Code != 400 {
		t.Fatal("abandoned token accepted")
	}
	if r := restAction(t, f, c, id, 1000, "status"); r.Code != 400 {
		t.Fatal("abandoned token alive")
	}
	fresh := restStart(t, f, c, 1000)
	if fresh == id {
		t.Fatal("token reused")
	}
}
func TestMainRestPersistsAndRollsBackStorageFailure(t *testing.T) {
	dir := t.TempDir()
	f, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	c := permanentVisitor(t, f)
	id := restStart(t, f, c, 1000)
	permanentDecode(t, restAction(t, f, c, id, 1000, "pause"))
	old := f.data.Attempts[id]
	restarted, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	if restarted.data.Attempts[id] != old {
		t.Fatal("restart lost pause")
	}
	permanentDecode(t, restAction(t, restarted, c, id, 1000, "status"))
	realPath := restarted.path
	restarted.path = filepath.Join(dir, "missing", "state.json")
	for _, action := range []string{"resume", "abandon"} {
		r := restAction(t, restarted, c, id, 1000, action)
		if r.Code != 500 || !reflect.DeepEqual(restarted.data.Attempts[id], old) {
			t.Fatalf("%s rollback: %d", action, r.Code)
		}
	}
	restarted.path = realPath
	permanentDecode(t, restAction(t, restarted, c, id, 1000, "resume"))
	old = restarted.data.Attempts[id]
	restarted.path = filepath.Join(dir, "missing", "state.json")
	if r := restAction(t, restarted, c, id, 1000, "pause"); r.Code != 500 || restarted.data.Attempts[id] != old {
		t.Fatal("pause rollback")
	}
}

func TestMainRestRegisteredAccountIsolationAndLegacyAttempt(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	join := func(name string) *http.Cookie {
		body, _ := json.Marshal(map[string]string{"name": name, "password": "test-password-long-enough"})
		w := httptest.NewRecorder()
		f.accountRegister(w, httptest.NewRequest("POST", "/api/account/register", bytes.NewReader(body)))
		if w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
		for _, c := range w.Result().Cookies() {
			if c.Name == "eq_session" {
				return c
			}
		}
		t.Fatal("no account session")
		return nil
	}
	a, b := join("rest_account_a"), join("rest_account_b")
	id := restStart(t, f, a, 1000)
	if r := restAction(t, f, b, id, 1000, "pause"); r.Code != 400 {
		t.Fatal("foreign account", r.Code)
	}
	var old boardAttempt
	if json.Unmarshal([]byte(`{"user":"old-user","board":"old-board","started":100}`), &old) != nil || old.PauseAt != 0 || old.RestUsed != 0 || boardElapsed(old, 1000) != 900 {
		t.Fatal("legacy timer incompatible")
	}
	// Industry challenges cannot be paused through the main-only endpoint.
	route := f.findIndustry("travel")
	req := permanentDecode(t, permanentRequest(t, f.industryQuiz, "/api/industries/challenge?sector=travel", nil, a))
	var industryID string
	json.Unmarshal(req["attemptId"], &industryID)
	if route == nil {
		t.Fatal("travel missing")
	}
	if r := restAction(t, f, a, industryID, 1000, "pause"); r.Code != 400 {
		t.Fatal("main endpoint accepted industry attempt")
	}
}

func TestMainAttemptRejectsStaleEditionAndCrossOriginStartSubmit(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	c := permanentVisitor(t, f)
	id := restStart(t, f, c, 1000)
	if r := permanentRequest(t, f.dailyAttempt, "/api/daily/attempt", map[string]any{"attemptId": id, "goal": 1000, "edition": "old", "action": "pause"}, c); r.Code != 409 {
		t.Fatal("stale edition")
	}
	for _, tc := range []struct {
		handler      http.HandlerFunc
		method, path string
		body         any
	}{
		{f.dailyQuiz, "GET", "/api/daily?goal=1000", nil},
		{f.dailySubmit, "POST", "/api/daily/submit", map[string]any{"attemptId": id, "goal": 1000, "edition": f.mainEdition(1000), "answers": permanentAnswers(f.challenge("", 1000), 20)}},
	} {
		data, _ := json.Marshal(tc.body)
		req := httptest.NewRequest(tc.method, tc.path, bytes.NewReader(data))
		req.AddCookie(c)
		req.Header.Set("Origin", "https://other.invalid")
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		tc.handler(w, req)
		if w.Code != 403 {
			t.Fatal("cross-origin accepted", tc.path, w.Code)
		}
	}
	if _, ok := f.data.Attempts[id]; !ok {
		t.Fatal("cross-origin deleted token")
	}
	old := f.data.Attempts[id]
	f.path = filepath.Join(t.TempDir(), "missing", "state.json")
	body := map[string]any{"attemptId": id, "goal": 1000, "edition": f.mainEdition(1000), "answers": permanentAnswers(f.challenge("", 1000), 20)}
	if r := permanentRequest(t, f.dailySubmit, "/api/daily/submit", body, c); r.Code != 500 || f.data.Attempts[id] != old || len(f.data.Daily[f.mainBoard(1000)]) != 0 {
		t.Fatal("submit storage failure lost attempt or wrote score")
	}
}
