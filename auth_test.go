package main

import (
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
