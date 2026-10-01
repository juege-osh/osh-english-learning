package main

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"time"
)

const maxProgressBytes = 8 << 20

type cloudProgress struct {
	Owner    string          `json:"owner"`
	Revision int64           `json:"revision"`
	Updated  int64           `json:"updated"`
	Progress json.RawMessage `json:"progress"`
}

func (f *features) progressPath(id string) string {
	return filepath.Join(f.progressDir, id+".json")
}

func (f *features) progressForAccount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !sameOrigin(r) {
		http.Error(w, "request denied", http.StatusForbidden)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	a := f.accountFromRequest(r)
	if a == nil {
		http.Error(w, "请先登录", http.StatusUnauthorized)
		return
	}
	if owner := r.Header.Get("X-Study-Owner"); owner != "" && owner != a.ID {
		http.Error(w, "账号已切换，请刷新页面", http.StatusForbidden)
		return
	}
	path := f.progressPath(a.ID)
	current := cloudProgress{Owner: a.ID}
	if b, err := os.ReadFile(path); err == nil {
		if err = json.Unmarshal(b, &current); err != nil {
			http.Error(w, "进度暂时无法读取", http.StatusInternalServerError)
			return
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		http.Error(w, "进度暂时无法读取", http.StatusInternalServerError)
		return
	}
	current.Owner = a.ID
	if r.Method == http.MethodGet {
		writeJSON(w, current)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxProgressBytes)
	var input cloudProgress
	if json.NewDecoder(r.Body).Decode(&input) != nil || input.Revision != current.Revision || !validProgressDocument(input.Progress) {
		if input.Revision != current.Revision {
			http.Error(w, "进度已在其他设备更新", http.StatusConflict)
		} else {
			http.Error(w, "进度格式有误或文件过大", http.StatusBadRequest)
		}
		return
	}
	current = cloudProgress{Owner: a.ID, Revision: current.Revision + 1, Updated: time.Now().Unix(), Progress: input.Progress}
	b, err := json.Marshal(current)
	if err != nil || atomicJSON(path, b) != nil {
		http.Error(w, "进度保存失败", http.StatusInternalServerError)
		return
	}
	writeJSON(w, current)
}

func validProgressDocument(raw json.RawMessage) bool {
	if len(raw) == 0 || len(raw) > maxProgressBytes {
		return false
	}
	var p struct {
		Version int                        `json:"version"`
		XP      int                        `json:"xp"`
		Levels  map[string]json.RawMessage `json:"levels"`
		Bosses  map[string]json.RawMessage `json:"bosses"`
		Words   map[string]json.RawMessage `json:"words"`
		Days    map[string]json.RawMessage `json:"days"`
		Basics  json.RawMessage            `json:"basics"`
		Goal    json.RawMessage            `json:"goal"`
		MainRun json.RawMessage            `json:"mainRun"`
	}
	if json.Unmarshal(raw, &p) != nil || p.Version != 1 || p.XP < 0 || p.XP > 450000 || p.Levels == nil || p.Bosses == nil || p.Words == nil || p.Days == nil {
		return false
	}
	return len(p.Levels) <= 2000 && len(p.Bosses) <= 200 && len(p.Words) <= 20120 && len(p.Days) <= 10000 && validBasicProgress(p.Basics) && validProgressGoal(p.Goal) && validMainRun(p.MainRun)
}

var phonicsProgressID = regexp.MustCompile(`^p(0[1-9]|[1-3][0-9]|4[0-4])$`)
var grammarProgressID = regexp.MustCompile(`^[a-z][a-z0-9-]{0,39}$`)

// The short courses are independent of the vocabulary/ranked route.
func validBasicProgress(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return true // Existing accounts and backups predate these courses.
	}
	var courses map[string]map[string]struct {
		StudiedAt int64 `json:"studiedAt"`
		Slots     []int `json:"slots"`
		Wrong     int64 `json:"wrong"`
		At        int64 `json:"at"`
	}
	if json.Unmarshal(raw, &courses) != nil || courses == nil || len(courses) > 2 {
		return false
	}
	for kind, records := range courses {
		if (kind != "phonics" && kind != "grammar") || records == nil || len(records) > 128 {
			return false
		}
		for id, entry := range records {
			if (kind == "phonics" && !phonicsProgressID.MatchString(id)) || (kind == "grammar" && (!grammarProgressID.MatchString(id) || id == "constructor" || id == "prototype")) {
				return false
			}
			if entry.Slots == nil || len(entry.Slots) > 2 || entry.StudiedAt < 0 || entry.At < 0 || entry.Wrong < 0 || entry.StudiedAt > 9007199254740991 || entry.At > 9007199254740991 || entry.Wrong > 9007199254740991 {
				return false
			}
			seen := map[int]bool{}
			for _, slot := range entry.Slots {
				if (slot != 0 && slot != 1) || seen[slot] {
					return false
				}
				seen[slot] = true
			}
		}
	}
	return true
}

func validProgressGoal(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return true
	}
	goal, ok := mainRunNumber(raw)
	return ok && validGoal(int(goal))
}

var mainRunID = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,100}$`)

// Mirror Core.validateRun. Missing legacy runs remain valid; explicit null,
// unknown fields, fractional timestamps and unsafe JavaScript integers do not.
func validMainRun(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return true
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil || len(fields) != 12 {
		return false
	}
	var id string
	if json.Unmarshal(fields["id"], &id) != nil || !mainRunID.MatchString(id) {
		return false
	}
	nums := map[string]int64{}
	for _, key := range []string{"resetAt", "startedAt", "elapsedMs", "restUsed", "correct", "wrong", "mainXp", "updatedAt"} {
		data, exists := fields[key]
		value, ok := mainRunNumber(data)
		if !exists || !ok {
			return false
		}
		nums[key] = value
	}
	if nums["mainXp"] > 230000 || nums["restUsed"] > 40 {
		return false
	}
	if string(fields["paused"]) != "true" && string(fields["paused"]) != "false" {
		return false
	}
	paused := string(fields["paused"]) == "true"
	nullable := map[string]*int64{}
	for _, key := range []string{"runningSince", "finishedAt"} {
		data, exists := fields[key]
		if !exists {
			return false
		}
		if string(data) == "null" {
			nullable[key] = nil
			continue
		}
		value, ok := mainRunNumber(data)
		if !ok {
			return false
		}
		nullable[key] = &value
	}
	if nums["resetAt"] > nums["startedAt"] || nums["startedAt"] > nums["updatedAt"] {
		return false
	}
	running, finished := nullable["runningSince"], nullable["finishedAt"]
	for _, value := range []*int64{running, finished} {
		if value != nil && (*value < nums["startedAt"] || *value > nums["updatedAt"]) {
			return false
		}
	}
	if finished != nil && (paused || running != nil) {
		return false
	}
	return paused || finished != nil || running != nil
}

func mainRunNumber(raw json.RawMessage) (int64, bool) {
	if len(raw) == 0 || string(raw) == "null" {
		return 0, false
	}
	var n float64
	if json.Unmarshal(raw, &n) != nil || n < 0 || n > 9007199254740991 || math.Trunc(n) != n {
		return 0, false
	}
	return int64(n), true
}
