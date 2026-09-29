package main

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"
)

type account struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Salt    string `json:"salt"`
	Hash    string `json:"hash"`
	Admin   bool   `json:"admin,omitempty"`
	Created int64  `json:"created"`
}
type loginSession struct {
	User  string `json:"user"`
	Until int64  `json:"until"`
}
type authStore struct {
	Users    map[string]account      `json:"users"`
	Sessions map[string]loginSession `json:"sessions"`
}

func (f *features) loadAuth() error {
	b, err := os.ReadFile(f.authPath)
	first := errors.Is(err, os.ErrNotExist)
	if err != nil && !first {
		return err
	}
	if !first {
		if err = json.Unmarshal(b, &f.auth); err != nil {
			return err
		}
	}
	if f.auth.Users == nil {
		f.auth.Users = map[string]account{}
	}
	if f.auth.Sessions == nil {
		f.auth.Sessions = map[string]loginSession{}
	}
	for _, a := range f.auth.Users {
		f.accountIDs[a.ID] = true
	}
	if first {
		// Preserve the trial window already granted before free applications replaced pricing.
		for id, m := range f.data.Members {
			if m.Created > 0 && !m.Lifetime && m.Until == 0 {
				m.LegacyTrialUntil = m.Created + 30*86400
				f.data.Members[id] = m
			}
		}
		if err = f.save(); err != nil {
			return err
		}
		return f.saveAuth()
	}
	if f.pruneSessions() {
		return f.saveAuth()
	}
	return nil
}

func (f *features) pruneSessions() bool {
	changed := false
	now := time.Now().Unix()
	for token, session := range f.auth.Sessions {
		if session.Until <= now {
			delete(f.auth.Sessions, token)
			changed = true
		}
	}
	return changed
}
func (f *features) saveAuth() error {
	b, e := json.Marshal(f.auth)
	if e != nil {
		return e
	}
	return atomicJSON(f.authPath, b)
}
func atomicJSON(path string, b []byte) error {
	tmp := path + ".tmp"
	if e := os.WriteFile(tmp, b, 0600); e != nil {
		return e
	}
	return os.Rename(tmp, path)
}
func randomHex(n int) (string, error) {
	b := make([]byte, n)
	_, e := rand.Read(b)
	if e != nil {
		return "", e
	}
	return hex.EncodeToString(b), nil
}
func validUser(s string) bool {
	if len(s) < 3 || len(s) > 24 {
		return false
	}
	for _, c := range s {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_') {
			return false
		}
	}
	return true
}
func passHash(password, salt string) (string, error) {
	b, e := hex.DecodeString(salt)
	if e != nil {
		return "", e
	}
	key, e := pbkdf2.Key(sha256.New, password, b, 310000, 32)
	if e != nil {
		return "", e
	}
	return hex.EncodeToString(key), nil
}
func tokenHash(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }
func (f *features) accountFromRequest(r *http.Request) *account {
	c, e := r.Cookie("eq_session")
	if e != nil {
		return nil
	}
	session, ok := f.auth.Sessions[tokenHash(c.Value)]
	if !ok || session.Until <= time.Now().Unix() {
		return nil
	}
	a, ok := f.auth.Users[session.User]
	if !ok {
		return nil
	}
	return &a
}
func setSessionCookie(w http.ResponseWriter, r *http.Request, token string, maxAge int) {
	secure := r.TLS != nil || r.Host == "english.osh.lol" || r.Header.Get("X-Forwarded-Proto") == "https"
	http.SetCookie(w, &http.Cookie{Name: "eq_session", Value: token, Path: "/", MaxAge: maxAge, Secure: secure, HttpOnly: true, SameSite: http.SameSiteLaxMode})
}
func setVisitorCookie(w http.ResponseWriter, r *http.Request, id string, maxAge int) {
	secure := r.TLS != nil || r.Host == "english.osh.lol" || r.Header.Get("X-Forwarded-Proto") == "https"
	http.SetCookie(w, &http.Cookie{Name: "eq_visitor", Value: id, Path: "/", MaxAge: maxAge, Secure: secure, HttpOnly: true, SameSite: http.SameSiteLaxMode})
}
func sameOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	return origin == "" || origin == "http://"+r.Host || origin == "https://"+r.Host
}
func (f *features) accountState(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	f.mu.Lock()
	a := f.accountFromRequest(r)
	f.mu.Unlock()
	if a == nil {
		writeJSON(w, map[string]any{"registered": false})
		return
	}
	writeJSON(w, map[string]any{"registered": true, "name": a.Name, "admin": a.Admin})
}
func (f *features) accountRegister(w http.ResponseWriter, r *http.Request) {
	f.accountLoginOrRegister(w, r, true)
}
func (f *features) accountLogin(w http.ResponseWriter, r *http.Request) {
	f.accountLoginOrRegister(w, r, false)
}
func (f *features) accountLoginOrRegister(w http.ResponseWriter, r *http.Request, register bool) {
	if r.Method != "POST" || !sameOrigin(r) {
		http.Error(w, "request denied", 403)
		return
	}
	var input struct {
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 2048)
	if json.NewDecoder(r.Body).Decode(&input) != nil {
		http.Error(w, "请求格式有误", 400)
		return
	}
	input.Name = strings.ToLower(strings.TrimSpace(input.Name))
	if !validUser(input.Name) || len(input.Password) < 10 || len(input.Password) > 128 {
		http.Error(w, "账号需3–24位英文、数字或下划线；密码至少10位", 400)
		return
	}
	var visitorID string
	if register {
		id, _, e := f.visitor(w, r)
		if e != nil {
			http.Error(w, "storage unavailable", 500)
			return
		}
		visitorID = id
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	a, exists := f.auth.Users[input.Name]
	rollbackRegistration := func() {
		if register {
			delete(f.auth.Users, input.Name)
			delete(f.accountIDs, visitorID)
		}
	}
	if register {
		if exists {
			http.Error(w, "账号名已被使用", 409)
			return
		}
		for _, other := range f.auth.Users {
			if other.ID == visitorID {
				http.Error(w, "当前访客身份已注册", 409)
				return
			}
		}
		salt, e := randomHex(16)
		if e != nil {
			http.Error(w, "storage unavailable", 500)
			return
		}
		hash, e := passHash(input.Password, salt)
		if e != nil {
			http.Error(w, "storage unavailable", 500)
			return
		}
		a = account{ID: visitorID, Name: input.Name, Salt: salt, Hash: hash, Created: time.Now().Unix()}
		f.auth.Users[input.Name] = a
		f.accountIDs[visitorID] = true
	} else {
		hash, e := passHash(input.Password, a.Salt)
		if !exists || e != nil || subtle.ConstantTimeCompare([]byte(hash), []byte(a.Hash)) != 1 {
			http.Error(w, "账号或密码不正确", 401)
			return
		}
	}
	token, e := randomHex(32)
	if e != nil {
		rollbackRegistration()
		http.Error(w, "storage unavailable", 500)
		return
	}
	f.pruneSessions()
	sessionKey := tokenHash(token)
	f.auth.Sessions[sessionKey] = loginSession{User: input.Name, Until: time.Now().Add(30 * 24 * time.Hour).Unix()}
	if e = f.saveAuth(); e != nil {
		delete(f.auth.Sessions, sessionKey)
		rollbackRegistration()
		http.Error(w, "storage unavailable", 500)
		return
	}
	setSessionCookie(w, r, token, 30*86400)
	writeJSON(w, map[string]any{"ok": true, "name": a.Name, "admin": a.Admin})
}
func (f *features) accountLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" || !sameOrigin(r) {
		http.Error(w, "request denied", 403)
		return
	}
	f.mu.Lock()
	if c, e := r.Cookie("eq_session"); e == nil {
		delete(f.auth.Sessions, tokenHash(c.Value))
		if e := f.saveAuth(); e != nil {
			f.mu.Unlock()
			http.Error(w, "storage unavailable", 500)
			return
		}
	}
	f.mu.Unlock()
	setSessionCookie(w, r, "", -1)
	setVisitorCookie(w, r, "", -1)
	writeJSON(w, map[string]any{"ok": true})
}
func (f *features) promoteAdmin(name string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	name = strings.ToLower(strings.TrimSpace(name))
	a, ok := f.auth.Users[name]
	if !ok {
		return errors.New("account not found; register on site first")
	}
	a.Admin = true
	f.auth.Users[name] = a
	return f.saveAuth()
}
