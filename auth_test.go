package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"
)

func TestExpiredAccountSessionsArePrunedOnRestart(t *testing.T) {
	dir := t.TempDir()
	f, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	f.auth.Sessions["expired"] = loginSession{User: "someone", Until: time.Now().Add(-time.Hour).Unix()}
	f.auth.Sessions["valid"] = loginSession{User: "someone", Until: time.Now().Add(time.Hour).Unix()}
	if err := f.saveAuth(); err != nil {
		t.Fatal(err)
	}
	f, err = newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, exists := f.auth.Sessions["expired"]; exists {
		t.Fatal("expired session survived restart")
	}
	if _, exists := f.auth.Sessions["valid"]; !exists {
		t.Fatal("valid session was removed")
	}
}

func TestLogoutDropsAccountAndVisitorIdentity(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(map[string]string{"name": "logout_user", "password": "long-password-123"})
	registered := httptest.NewRecorder()
	f.accountRegister(registered, httptest.NewRequest("POST", "/api/account/register", bytes.NewReader(body)))
	if registered.Code != 200 {
		t.Fatal(registered.Body.String())
	}
	var session, visitor string
	for _, cookie := range registered.Result().Cookies() {
		if cookie.Name == "eq_session" {
			session = cookie.Value
		}
		if cookie.Name == "eq_visitor" {
			visitor = cookie.Value
		}
	}
	if session == "" || visitor == "" {
		t.Fatal("registration did not set both cookies")
	}
	logout := httptest.NewRequest("POST", "/api/account/logout", nil)
	for _, cookie := range registered.Result().Cookies() {
		logout.AddCookie(cookie)
	}
	result := httptest.NewRecorder()
	f.accountLogout(result, logout)
	if result.Code != 200 {
		t.Fatal(result.Body.String())
	}
	cleared := map[string]bool{}
	for _, cookie := range result.Result().Cookies() {
		if cookie.MaxAge < 0 {
			cleared[cookie.Name] = true
		}
	}
	if !cleared["eq_session"] || !cleared["eq_visitor"] {
		t.Fatalf("logout did not clear both identities: %+v", cleared)
	}
	if _, exists := f.auth.Sessions[tokenHash(session)]; exists {
		t.Fatal("server session survived logout")
	}
	newVisit := httptest.NewRecorder()
	staleGuest := httptest.NewRequest("GET", "/api/membership", nil)
	for _, cookie := range registered.Result().Cookies() {
		if cookie.Name == "eq_visitor" {
			staleGuest.AddCookie(cookie)
		}
	}
	newID, _, err := f.visitor(newVisit, staleGuest)
	if err != nil || newID == visitor {
		t.Fatal("a stale visitor cookie reused the logged-out account")
	}
}
