package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestMembershipCodeAndDailyBoard(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	first := httptest.NewRecorder()
	f.membership(first, httptest.NewRequest("GET", "/api/membership", nil))
	if first.Code != 200 {
		t.Fatal(first.Body.String())
	}
	var profile struct {
		Status    string `json:"status"`
		FreeStudy bool   `json:"freeStudy"`
	}
	if err = json.Unmarshal(first.Body.Bytes(), &profile); err != nil {
		t.Fatal(err)
	}
	if profile.Status != "free" || !profile.FreeStudy {
		t.Fatalf("unexpected profile: %+v", profile)
	}
	cookie := first.Result().Cookies()[0]
	code, err := f.generateCode("year")
	if err != nil {
		t.Fatal(err)
	}
	payload, _ := json.Marshal(map[string]any{"code": code})
	request := httptest.NewRequest("POST", "/api/redeem", bytes.NewReader(payload))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(cookie)
	redeemed := httptest.NewRecorder()
	f.redeem(redeemed, request)
	if redeemed.Code != 200 {
		t.Fatal(redeemed.Body.String())
	}
	reuseReq := httptest.NewRequest("POST", "/api/redeem", bytes.NewReader(payload))
	reuseReq.Header.Set("Content-Type", "application/json")
	reuseReq.AddCookie(cookie)
	second := httptest.NewRecorder()
	f.redeem(second, reuseReq)
	if second.Code != 400 {
		t.Fatalf("code reused: %d", second.Code)
	}
	memberReq := httptest.NewRequest("GET", "/api/membership", nil)
	memberReq.AddCookie(cookie)
	memberRes := httptest.NewRecorder()
	f.membership(memberRes, memberReq)
	if err = json.Unmarshal(memberRes.Body.Bytes(), &profile); err != nil || profile.Status != "member" {
		t.Fatalf("membership not applied: %s", memberRes.Body.String())
	}

	startReq := httptest.NewRequest("GET", "/api/daily?goal=5000", nil)
	startReq.AddCookie(cookie)
	startRes := httptest.NewRecorder()
	f.dailyQuiz(startRes, startReq)
	if startRes.Code != 200 {
		t.Fatal(startRes.Body.String())
	}
	var challenge map[string]any
	if err = json.Unmarshal(startRes.Body.Bytes(), &challenge); err != nil {
		t.Fatal(err)
	}
	questions := challenge["questions"].([]any)
	if len(questions) != 20 {
		t.Fatal("wrong question count")
	}
	if _, ok := questions[0].(map[string]any)["id"]; ok {
		t.Fatal("answer leaked in question")
	}
	answers := make([]int, 20)
	for i, q := range f.challenge(dailyDate(), 5000) {
		answers[i] = q.ID
	}
	body, _ := json.Marshal(map[string]any{"name": "觉哥", "goal": 5000, "answers": answers})
	submitReq := httptest.NewRequest("POST", "/api/daily/submit", bytes.NewReader(body))
	submitReq.Header.Set("Content-Type", "application/json")
	submitReq.AddCookie(cookie)
	submitted := httptest.NewRecorder()
	f.dailySubmit(submitted, submitReq)
	if submitted.Code != 200 {
		t.Fatal(submitted.Body.String())
	}
	dupReq := httptest.NewRequest("POST", "/api/daily/submit", bytes.NewReader(body))
	dupReq.Header.Set("Content-Type", "application/json")
	dupReq.AddCookie(cookie)
	duplicate := httptest.NewRecorder()
	f.dailySubmit(duplicate, dupReq)
	if duplicate.Code != 400 && duplicate.Code != 409 {
		t.Fatal("duplicate accepted")
	}
	board := httptest.NewRecorder()
	f.leaderboard(board, httptest.NewRequest("GET", "/api/daily/leaderboard?goal=5000", nil))
	var result struct {
		Entries []dailyEntry `json:"entries"`
	}
	if err = json.Unmarshal(board.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Entries) != 1 || result.Entries[0].Correct != 20 || result.Entries[0].User != "" {
		t.Fatalf("wrong board: %s", board.Body.String())
	}
	other := httptest.NewRecorder()
	f.leaderboard(other, httptest.NewRequest("GET", "/api/daily/leaderboard?goal=20000", nil))
	if err = json.Unmarshal(other.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Entries) != 0 {
		t.Fatal("goals mixed")
	}
}
