package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestStudyAssistantBoundaries(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		method, origin string
		code           int
	}{{"GET", "", 405}, {"POST", "https://other.test", 403}, {"POST", "", 401}} {
		r := httptest.NewRequest(tc.method, "/api/study/assistant", strings.NewReader(`{"mode":"explain","text":"hello"}`))
		r.Header.Set("Origin", tc.origin)
		w := httptest.NewRecorder()
		f.studyAssistant(w, r)
		if w.Code != tc.code {
			t.Fatalf("%d %s", w.Code, w.Body.String())
		}
	}
}
func TestStudyAssistantResponseAndPrivacy(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-only-secret" {
			t.Error("authorization missing")
		}
		var p map[string]any
		if json.NewDecoder(r.Body).Decode(&p) != nil {
			t.Error("invalid request")
		}
		if p["store"] != false || p["input"] != "hello" {
			t.Error("wrong privacy payload")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"output":[{"content":[{"type":"output_text","text":"你好。"}]}]}`))
	}))
	defer upstream.Close()
	text, err := requestStudyAssistant(httptest.NewRequest("POST", "/", nil), upstream.URL, "test-only-secret", "test-model", "解释用法", "hello", upstream.Client())
	if err != nil || text != "你好。" {
		t.Fatalf("%q %v", text, err)
	}
	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(401); w.Write([]byte("test-only-secret")) }))
	defer bad.Close()
	text, err = requestStudyAssistant(httptest.NewRequest("POST", "/", nil), bad.URL, "test-only-secret", "test-model", "", "hello", bad.Client())
	if err == nil || strings.Contains(text, "secret") {
		t.Error("upstream failure exposed provider data")
	}
}

// Configuration stays disabled so authorization tests never contact an AI provider.
func assistantAuthFixture(t *testing.T) *features {
	t.Helper()
	t.Setenv("ENGLISH_AI_API_KEY", "")
	t.Setenv("ENGLISH_AI_BASE_URL", "")
	t.Setenv("ENGLISH_AI_MODEL", "")
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"alice", "bob"} {
		f.auth.Users[name] = account{ID: "assistant-" + name, Name: name}
		f.auth.Sessions[tokenHash("assistant-session-"+name)] = loginSession{User: name, Until: time.Now().Add(time.Hour).Unix()}
	}
	f.auth.Sessions[tokenHash("assistant-expired")] = loginSession{User: "alice", Until: time.Now().Add(-time.Hour).Unix()}
	return f
}

func assistantAuthRequest(f *features, token, owner string, visitor bool) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodPost, "/api/study/assistant", strings.NewReader(`{"mode":"dialogue","text":"Hello."}`))
	if token != "" {
		name := "eq_session"
		if visitor {
			name = "eq_visitor"
		}
		r.AddCookie(&http.Cookie{Name: name, Value: token})
	}
	if owner != "" {
		r.Header.Set("X-Study-Owner", owner)
	}
	w := httptest.NewRecorder()
	f.studyAssistant(w, r)
	return w
}

func TestStudyAssistantSameAccountOwnerPassesAuthentication(t *testing.T) {
	f := assistantAuthFixture(t)
	for _, name := range []string{"alice", "bob"} {
		t.Run(name, func(t *testing.T) {
			w := assistantAuthRequest(f, "assistant-session-"+name, "assistant-"+name, false)
			if w.Code != http.StatusServiceUnavailable || !strings.Contains(w.Body.String(), "尚未配置") {
				t.Fatalf("matching authenticated owner should reach configuration check: %d %q", w.Code, w.Body.String())
			}
		})
	}
}

func TestStudyAssistantMismatchedOwnerRejectedBeforeConfiguration(t *testing.T) {
	f := assistantAuthFixture(t)
	for _, tc := range []struct{ token, owner string }{
		{"assistant-session-alice", "assistant-bob"},
		{"assistant-session-bob", "assistant-alice"},
		{"assistant-session-alice", "guest"},
	} {
		w := assistantAuthRequest(f, tc.token, tc.owner, false)
		if w.Code != http.StatusForbidden || !strings.Contains(w.Body.String(), "账号已切换") {
			t.Fatalf("foreign owner must be denied before provider access: %d %q", w.Code, w.Body.String())
		}
	}
}

func TestStudyAssistantOwnerHeaderCannotReplaceAuthenticator(t *testing.T) {
	f := assistantAuthFixture(t)
	for _, tc := range []struct {
		name, token string
		visitor     bool
	}{
		{"missing-session", "", false},
		{"forged-session", "assistant-forged", false},
		{"expired-session", "assistant-expired", false},
		{"visitor-cookie", "assistant-session-alice", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := assistantAuthRequest(f, tc.token, "assistant-alice", tc.visitor)
			if w.Code != http.StatusUnauthorized || !strings.Contains(w.Body.String(), "请先登录") {
				t.Fatalf("owner header must not authenticate without a valid account session: %d %q", w.Code, w.Body.String())
			}
		})
	}
}
