package main

import (
	"encoding/json"
	"net/http"
	"time"
)

func mainGoals() []int {
	goals := make([]int, 20)
	for i := range goals {
		goals[i] = (i + 1) * 1000
	}
	return goals
}

// Only completed free pauses and the current free pause are excluded.
// Paid pauses remain on the server clock, including after a process restart.
func boardElapsed(a boardAttempt, now int64) int64 {
	elapsed := now - a.Started - a.RestMs
	if a.PauseAt != 0 && a.FreePause {
		elapsed -= max(int64(0), now-a.PauseAt)
	}
	return max(int64(0), elapsed)
}
func attemptTimer(id string, goal int, a boardAttempt, now int64) map[string]any {
	limit := goal / 1000 * 2
	return map[string]any{"attemptId": id, "goal": goal, "elapsedMs": boardElapsed(a, now), "paused": a.PauseAt != 0, "freePause": a.PauseAt != 0 && a.FreePause, "restUsed": a.RestUsed, "restLimit": limit, "restRemaining": max(0, limit-a.RestUsed), "serverNow": now, "revision": a.Revision}
}

func (f *features) dailyAttempt(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		http.Error(w, "request denied", http.StatusForbidden)
		return
	}
	if r.Method != http.MethodPost || r.Header.Get("Content-Type") != "application/json" {
		http.Error(w, "JSON POST required", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		AttemptID string `json:"attemptId"`
		Goal      int    `json:"goal"`
		Edition   string `json:"edition"`
		Action    string `json:"action"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 2048)
	if json.NewDecoder(r.Body).Decode(&body) != nil || !validGoal(body.Goal) || body.AttemptID == "" {
		http.Error(w, "invalid attempt", http.StatusBadRequest)
		return
	}
	if body.Action != "status" && body.Action != "pause" && body.Action != "resume" && body.Action != "abandon" {
		http.Error(w, "invalid action", http.StatusBadRequest)
		return
	}
	if body.Edition != f.mainEdition(body.Goal) {
		http.Error(w, "词表已更新，请重新开始永久榜挑战", http.StatusConflict)
		return
	}
	id, _, err := f.visitor(w, r)
	if err != nil {
		http.Error(w, "storage unavailable", http.StatusInternalServerError)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	old, exists := f.data.Attempts[body.AttemptID]
	if !exists || old.User != id || old.Board != f.mainBoard(body.Goal) {
		http.Error(w, "本轮挑战不存在或账号已切换，请重新开始", http.StatusBadRequest)
		return
	}
	a := old
	now := time.Now().UnixMilli()
	changed := false
	switch body.Action {
	case "pause":
		if a.PauseAt == 0 {
			a.PauseAt = now
			a.FreePause = a.RestUsed < body.Goal/1000*2
			if a.FreePause {
				a.RestUsed++
			}
			a.Revision++
			changed = true
		}
	case "resume":
		if a.PauseAt != 0 {
			if a.FreePause {
				a.RestMs += max(int64(0), now-a.PauseAt)
			}
			a.PauseAt = 0
			a.FreePause = false
			a.Revision++
			changed = true
		}
	case "abandon":
		delete(f.data.Attempts, body.AttemptID)
		changed = true
	}
	if changed {
		if body.Action != "abandon" {
			f.data.Attempts[body.AttemptID] = a
		}
		if err = f.save(); err != nil {
			f.data.Attempts[body.AttemptID] = old
			http.Error(w, "storage unavailable", http.StatusInternalServerError)
			return
		}
	}
	response := attemptTimer(body.AttemptID, body.Goal, a, now)
	if body.Action == "abandon" {
		response["abandoned"] = true
	}
	writeJSON(w, response)
}
