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
	progress := json.RawMessage(`{"version":1,"xp":100,"goal":10000,"levels":{"1":100},"bosses":{},"missions":{},"words":{"1":{"first":1,"last":1,"failed":0,"wrong":0,"seen":1,"days":["2026-09-30"],"production":false,"due":86400001}},"days":{"2026-09-30":1},"dailyGoal":20,"industries":{"biology":{"seen":[20001],"answers":{"20001":{"correct":false,"at":100}}}},"basics":{"phonics":{"p01":{"studiedAt":1,"slots":[0,1],"wrong":1,"at":100}},"grammar":{"be":{"studiedAt":1,"slots":[0],"wrong":0,"at":100}}}}`)
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

func TestProgressOwnerBindingAndIsolation(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	join := func(name string) ([]*http.Cookie, string) {
		body, _ := json.Marshal(map[string]string{"name": name, "password": "temporary-test-password"})
		w := httptest.NewRecorder()
		f.accountRegister(w, httptest.NewRequest("POST", "/api/account/register", bytes.NewReader(body)))
		if w.Code != 200 {
			t.Fatalf("register: %d", w.Code)
		}
		r := httptest.NewRequest("GET", "/api/account", nil)
		for _, c := range w.Result().Cookies() {
			r.AddCookie(c)
		}
		a := f.accountFromRequest(r)
		if a == nil {
			t.Fatal("missing account")
		}
		return w.Result().Cookies(), a.ID
	}
	a, aid := join("owner_test_a")
	b, bid := join("owner_test_b")
	request := func(method, owner string, cookies []*http.Cookie, body []byte) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "/api/progress", bytes.NewReader(body))
		r.Header.Set("X-Study-Owner", owner)
		for _, c := range cookies {
			r.AddCookie(c)
		}
		w := httptest.NewRecorder()
		f.progressForAccount(w, r)
		return w
	}
	doc := json.RawMessage(`{"version":1,"xp":100,"levels":{"1":100},"bosses":{},"words":{},"days":{}}`)
	body, _ := json.Marshal(cloudProgress{Revision: 0, Progress: doc})
	for _, method := range []string{"GET", "POST"} {
		if w := request(method, aid, b, body); w.Code != 403 {
			t.Fatalf("cross owner %s: %d", method, w.Code)
		}
	}
	w := request("POST", aid, a, body)
	if w.Code != 200 {
		t.Fatalf("save: %d", w.Code)
	}
	var saved cloudProgress
	if json.Unmarshal(w.Body.Bytes(), &saved) != nil || saved.Owner != aid || saved.Revision != 1 {
		t.Fatalf("owner save: %s", w.Body.String())
	}
	if w = request("POST", aid, a, body); w.Code != 409 {
		t.Fatalf("conflict: %d", w.Code)
	}
	for _, owner := range []string{"", aid} {
		w = request("GET", owner, a, nil)
		if json.Unmarshal(w.Body.Bytes(), &saved) != nil || w.Code != 200 || saved.Owner != aid || saved.Revision != 1 {
			t.Fatalf("compat owner get: %s", w.Body.String())
		}
	}
	w = request("GET", bid, b, nil)
	if json.Unmarshal(w.Body.Bytes(), &saved) != nil || saved.Owner != bid || saved.Revision != 0 {
		t.Fatalf("isolated: %s", w.Body.String())
	}
}
