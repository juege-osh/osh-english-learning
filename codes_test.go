package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestOwnerCreatesCodeAndMemberRedeemsExactDuration(t *testing.T) {
	for _, kind := range []string{"month", "year", "lifetime"} {
		t.Run(kind, func(t *testing.T) {
			dir := t.TempDir()
			f, err := newFeatures(dir)
			if err != nil {
				t.Fatal(err)
			}
			register := func(name string) []*http.Cookie {
				rr := httptest.NewRecorder()
				f.accountRegister(rr, httptest.NewRequest("POST", "/api/account/register", bytes.NewBufferString(`{"name":"`+name+`","password":"test-pass-123"}`)))
				if rr.Code != 200 {
					t.Fatal(rr.Body.String())
				}
				return rr.Result().Cookies()
			}
			owner, learner := register("owner_test"), register("learner_test")
			if err := f.promoteAdmin("owner_test"); err != nil {
				t.Fatal(err)
			}
			request := func(path, body string, cookies []*http.Cookie) *http.Request {
				r := httptest.NewRequest("POST", path, bytes.NewBufferString(body))
				r.Header.Set("Content-Type", "application/json")
				for _, c := range cookies {
					r.AddCookie(c)
				}
				return r
			}
			for _, cookies := range [][]*http.Cookie{nil, learner} {
				denied := httptest.NewRecorder()
				f.createMemberCode(denied, request("/api/codes/create", `{"kind":"month"}`, cookies))
				if denied.Code != 403 {
					t.Fatalf("non-owner created code: %d", denied.Code)
				}
			}
			foreign := request("/api/codes/create", `{"kind":"month"}`, owner)
			foreign.Header.Set("Origin", "https://other.example")
			denied := httptest.NewRecorder()
			f.createMemberCode(denied, foreign)
			if denied.Code != 403 {
				t.Fatal("cross-origin code generation allowed")
			}
			created := httptest.NewRecorder()
			f.createMemberCode(created, request("/api/codes/create", `{"kind":"`+kind+`"}`, owner))
			if created.Code != 200 {
				t.Fatal(created.Body.String())
			}
			var result struct {
				Code string `json:"code"`
			}
			if err := json.Unmarshal(created.Body.Bytes(), &result); err != nil || result.Code == "" {
				t.Fatal("missing code")
			}
			// An unused code and its account permissions must survive a restart.
			f, err = newFeatures(dir)
			if err != nil {
				t.Fatal(err)
			}
			payload, _ := json.Marshal(map[string]string{"code": result.Code})
			guest := httptest.NewRecorder()
			f.redeem(guest, request("/api/redeem", string(payload), nil))
			if guest.Code != 401 {
				t.Fatalf("guest redeemed: %d", guest.Code)
			}
			before := time.Now().Unix()
			redeemed := httptest.NewRecorder()
			f.redeem(redeemed, request("/api/redeem", string(payload), learner))
			if redeemed.Code != 200 {
				t.Fatal(redeemed.Body.String())
			}
			m := f.data.Members[f.auth.Users["learner_test"].ID]
			if kind == "lifetime" {
				if !m.Lifetime {
					t.Fatal("lifetime not applied")
				}
			} else {
				days := int64(30)
				if kind == "year" {
					days = 365
				}
				if m.Until < before+days*86400 || m.Until > time.Now().Unix()+days*86400 {
					t.Fatalf("wrong %s duration: %d", kind, m.Until-before)
				}
			}
			f, err = newFeatures(dir)
			if err != nil {
				t.Fatal(err)
			}
			reused := httptest.NewRecorder()
			f.redeem(reused, request("/api/redeem", string(payload), learner))
			if reused.Code != 400 {
				t.Fatal("code used twice")
			}
		})
	}
}
