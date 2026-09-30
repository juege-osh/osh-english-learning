package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCommunitySettingsOwnerAndMemberPrivacy(t *testing.T) {
	dir := t.TempDir()
	f, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"owner", "free", "paid"} {
		f.auth.Users[name] = account{ID: name, Name: name, Admin: name == "owner"}
		f.auth.Sessions[tokenHash(name)] = loginSession{User: name, Until: time.Now().Add(time.Hour).Unix()}
		f.data.Members[name] = member{Created: time.Now().Unix()}
		f.accountIDs[name] = true
	}
	paid := f.data.Members["paid"]
	paid.Until = time.Now().Add(time.Hour).Unix()
	f.data.Members["paid"] = paid
	if err := f.saveAuth(); err != nil {
		t.Fatal(err)
	}
	request := func(method, path, body, user string) *http.Request {
		r := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		r.Header.Set("Content-Type", "application/json")
		if user != "" {
			r.AddCookie(&http.Cookie{Name: "eq_session", Value: user})
		}
		return r
	}
	payload := `{"followLinks":{"bilibili":"https://space.bilibili.com/123"},"groupContact":"test-group-contact","groupInstructions":"请备注网站账号名"}`
	denied := httptest.NewRecorder()
	f.communityUpdate(denied, request("POST", "/api/community/settings", payload, "free"))
	if denied.Code != 403 {
		t.Fatal("ordinary user changed settings")
	}
	bad := httptest.NewRecorder()
	f.communityUpdate(bad, request("POST", "/api/community/settings", `{"followLinks":{"douyin":"javascript:alert(1)"}}`, "owner"))
	if bad.Code != 400 {
		t.Fatal("unsafe URL accepted")
	}
	saved := httptest.NewRecorder()
	f.communityUpdate(saved, request("POST", "/api/community/settings", payload, "owner"))
	if saved.Code != 200 {
		t.Fatal(saved.Body.String())
	}
	f, err = newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, user := range []string{"", "free", "paid", "owner"} {
		rr := httptest.NewRecorder()
		f.communityInfo(rr, request("GET", "/api/community", "", user))
		var data struct {
			Settings communitySettings `json:"settings"`
			Access   bool              `json:"groupAccess"`
		}
		if err := json.Unmarshal(rr.Body.Bytes(), &data); err != nil {
			t.Fatal(err)
		}
		if data.Settings.FollowLinks["bilibili"] == "" {
			t.Fatal("public homepage missing")
		}
		allowed := user == "paid" || user == "owner"
		if data.Access != allowed || (data.Settings.GroupContact != "") != allowed || (data.Settings.GroupInstructions != "") != allowed {
			t.Fatalf("group info leaked or hidden for %q", user)
		}
	}
	paid.Until = time.Now().Add(-time.Hour).Unix()
	f.data.Members["paid"] = paid
	expired := httptest.NewRecorder()
	f.communityInfo(expired, request("GET", "/api/community", "", "paid"))
	if bytes.Contains(expired.Body.Bytes(), []byte("test-group-contact")) {
		t.Fatal("expired membership retained group access")
	}
}
