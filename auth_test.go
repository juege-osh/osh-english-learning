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

func TestLoginTemporarilyLimitsRepeatedWrongPasswords(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	register, _ := json.Marshal(map[string]string{"name": "login_user", "password": "correct-password-123"})
	created := httptest.NewRecorder()
	f.accountRegister(created, httptest.NewRequest("POST", "/api/account/register", bytes.NewReader(register)))
	if created.Code != 200 {
		t.Fatal(created.Body.String())
	}
	login := func(password string) int {
		body, _ := json.Marshal(map[string]string{"name": "login_user", "password": password})
		result := httptest.NewRecorder()
		f.accountLogin(result, httptest.NewRequest("POST", "/api/account/login", bytes.NewReader(body)))
		return result.Code
	}
	for range 5 {
		if status := login("wrong-password-123"); status != 401 {
			t.Fatalf("wrong password returned %d", status)
		}
	}
	if status := login("correct-password-123"); status != 429 {
		t.Fatalf("cooldown returned %d", status)
	}
	attempt := f.authTries["login_user"]
	attempt.Until = time.Now().Add(-time.Second).Unix()
	f.authTries["login_user"] = attempt
	if status := login("correct-password-123"); status != 200 {
		t.Fatalf("login after cooldown returned %d", status)
	}
}

func TestEmailRegistrationAndSingleOwner(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	register := func(name, email, password string) int {
		body, _ := json.Marshal(map[string]string{"name": name, "email": email, "password": password})
		result := httptest.NewRecorder()
		f.accountRegister(result, httptest.NewRequest("POST", "/api/account/register", bytes.NewReader(body)))
		return result.Code
	}
	if got := register("first_user", "first@example.com", "testpass8"); got != 200 {
		t.Fatalf("first registration: %d", got)
	}
	if got := register("second_user", "FIRST@example.com", "testpass8"); got != 409 {
		t.Fatalf("duplicate email: %d", got)
	}
	if got := register("second_user", "second@example.com", "testpass8"); got != 200 {
		t.Fatalf("second registration: %d", got)
	}
	if got := register("third_user", "invalid-email", "testpass8"); got != 400 {
		t.Fatalf("invalid email: %d", got)
	}
	if err := f.promoteAdmin("first_user"); err != nil {
		t.Fatal(err)
	}
	if err := f.promoteAdmin("second_user"); err != nil {
		t.Fatal(err)
	}
	if f.auth.Users["first_user"].Admin || !f.auth.Users["second_user"].Admin {
		t.Fatal("more than one owner or wrong owner")
	}
	if err := f.promoteAdmin("missing_user"); err == nil {
		t.Fatal("missing account became owner")
	}
	if !f.auth.Users["second_user"].Admin {
		t.Fatal("owner changed after failed promotion")
	}
}
