package main

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestWaitingRoomHeartbeatStillRefreshesBeforeExpiry(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	visitor := raceVisit(t, f)
	created := roomRequest(t, f.raceRoomCreate, visitor, "/api/race/room/create", map[string]any{"goal": 100, "password": "secret8"}, 200)
	code := created["roomId"].(string)
	user := visitor.Result().Cookies()[0].Value
	wait := f.races.Waiting[user]
	old := wait.LastSeen
	status := httptest.NewRequest("GET", "/api/race/status", nil)
	status.AddCookie(visitor.Result().Cookies()[0])
	f.raceStatus(httptest.NewRecorder(), status)
	if got := f.races.Waiting[user].LastSeen; got != old {
		t.Fatalf("poll rewrote a fresh heartbeat: %d -> %d", old, got)
	}
	wait.LastSeen = time.Now().Add(-16 * time.Second).Unix()
	f.races.Waiting[user] = wait
	f.raceStatus(httptest.NewRecorder(), status)
	if got := f.races.Waiting[user].LastSeen; got <= wait.LastSeen {
		t.Fatalf("stale heartbeat was not refreshed: %d", got)
	}
	if f.races.Waiting[user].RoomID != code {
		t.Fatal("refresh lost the waiting room")
	}
}
