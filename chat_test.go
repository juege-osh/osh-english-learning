package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func registerChatUser(t *testing.T, f *features, name string) []*http.Cookie {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"name": name, "password": "long-password-123"})
	res := httptest.NewRecorder()
	f.accountRegister(res, httptest.NewRequest("POST", "/api/account/register", bytes.NewReader(body)))
	if res.Code != 200 {
		t.Fatal(res.Body.String())
	}
	return res.Result().Cookies()
}
func chatRequest(method, url string, body []byte, cookies []*http.Cookie) *http.Request {
	r := httptest.NewRequest(method, url, bytes.NewReader(body))
	for _, c := range cookies {
		r.AddCookie(c)
	}
	return r
}
func TestChatPrivacyAndModeration(t *testing.T) {
	f, e := newFeatures(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	poster := registerChatUser(t, f, "writer_1")
	others := [][]*http.Cookie{registerChatUser(t, f, "reader_1"), registerChatUser(t, f, "reader_2"), registerChatUser(t, f, "reader_3")}
	body, _ := json.Marshal(map[string]string{"channel": "lobby", "text": "今天记住了 vocabulary 这个词"})
	sent := httptest.NewRecorder()
	f.chatPost(sent, chatRequest("POST", "/api/chat/post", body, poster))
	if sent.Code != 200 {
		t.Fatal(sent.Body.String())
	}
	listed := httptest.NewRecorder()
	f.chatList(listed, chatRequest("GET", "/api/chat?channel=lobby", nil, nil))
	var view struct {
		Items []chatPublicMessage `json:"items"`
	}
	if e = json.Unmarshal(listed.Body.Bytes(), &view); e != nil || len(view.Items) != 1 {
		t.Fatal(listed.Body.String())
	}
	if bytes.Contains(listed.Body.Bytes(), []byte("user")) || bytes.Contains(listed.Body.Bytes(), []byte("reports")) {
		t.Fatal("private fields leaked")
	}
	id := view.Items[0].ID
	report, _ := json.Marshal(map[string]string{"channel": "lobby", "id": id})
	for _, cookies := range others {
		res := httptest.NewRecorder()
		f.chatReport(res, chatRequest("POST", "/api/chat/report", report, cookies))
		if res.Code != 200 {
			t.Fatal(res.Body.String())
		}
	}
	listed = httptest.NewRecorder()
	f.chatList(listed, chatRequest("GET", "/api/chat?channel=lobby", nil, nil))
	if e = json.Unmarshal(listed.Body.Bytes(), &view); e != nil || len(view.Items) != 0 {
		t.Fatal("reported message still visible")
	}
}
