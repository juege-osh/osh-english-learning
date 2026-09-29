package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAccountProgressPersistsAndRejectsStaleWrite(t *testing.T) {
	dir := t.TempDir()
	f, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	request := func(method string, body []byte, cookies []*http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "/api/progress", bytes.NewReader(body))
		for _, c := range cookies {
			r.AddCookie(c)
		}
		w := httptest.NewRecorder()
		f.progressForAccount(w, r)
		return w
	}
	if got := request("GET", nil, nil).Code; got != http.StatusUnauthorized {
		t.Fatalf("guest read: %d", got)
	}
	register, _ := json.Marshal(map[string]string{"name": "sync_user", "password": "long-password-123"})
	joined := httptest.NewRecorder()
	f.accountRegister(joined, httptest.NewRequest("POST", "/api/account/register", bytes.NewReader(register)))
	if joined.Code != 200 {
		t.Fatal(joined.Body.String())
	}
	cookies := joined.Result().Cookies()
	progress := json.RawMessage(`{"version":1,"xp":100,"goal":10000,"levels":{"1":100},"bosses":{},"missions":{},"words":{"1":{"first":1,"last":1,"failed":0,"wrong":0,"seen":1,"days":["2026-09-30"],"production":false,"due":86400001}},"days":{"2026-09-30":1},"dailyGoal":20}`)
	write, _ := json.Marshal(cloudProgress{Revision: 0, Progress: progress})
	if got := request("POST", write, cookies).Code; got != 200 {
		t.Fatalf("save: %d", got)
	}
	if got := request("POST", write, cookies).Code; got != http.StatusConflict {
		t.Fatalf("stale save: %d", got)
	}
	reloaded, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	f = reloaded
	saved := request("GET", nil, cookies)
	if saved.Code != 200 {
		t.Fatal(saved.Body.String())
	}
	var doc cloudProgress
	if err := json.Unmarshal(saved.Body.Bytes(), &doc); err != nil || doc.Revision != 1 || !bytes.Equal(doc.Progress, progress) {
		t.Fatalf("persistence: %s", saved.Body.String())
	}
}
