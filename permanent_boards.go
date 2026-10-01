package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
)

// The public endpoints keep their original URL names. Stored board keys carry
// the content edition rather than a calendar date, so they survive midnight.
func (f *features) mainEdition(goal int) string {
	body, _ := json.Marshal(f.words[:goal])
	h := sha256.Sum256(body)
	return fmt.Sprintf("%x", h[:6])
}
func (f *features) mainBoard(goal int) string {
	return fmt.Sprintf("permanent:v1:main:%d:%s", goal, f.mainEdition(goal))
}
func legacyMainBoard(goal int) string          { return fmt.Sprintf("legacy:main:%d", goal) }
func legacyIndustryBoard(sector string) string { return "legacy:industry:" + sector }
func scoreBetter(a, b dailyEntry) bool {
	return a.Correct > b.Correct || (a.Correct == b.Correct && a.TimeMs < b.TimeMs)
}
func bestEntry(entries []dailyEntry, user string) (dailyEntry, bool) {
	for _, entry := range entries {
		if entry.User == user {
			return entry, true
		}
	}
	return dailyEntry{}, false
}
func retainBest(entries []dailyEntry, item dailyEntry) ([]dailyEntry, dailyEntry, bool) {
	out := append([]dailyEntry{}, entries...)
	for i, entry := range out {
		if entry.User != item.User {
			continue
		}
		if scoreBetter(item, entry) {
			out[i] = item
			return out, item, true
		}
		return out, entry, false
	}
	return append(out, item), item, true
}
func publicEntry(entry dailyEntry, exists bool) any {
	if !exists {
		return nil
	}
	entry.User = ""
	return entry
}

const leaderboardLimit = 1000

type boardView struct {
	Entries               []dailyEntry
	Total, Matched, Limit int
}

func leaderboardQuery(query string) string {
	runes := []rune(strings.TrimSpace(query))
	if len(runes) > 80 {
		runes = runes[:80]
	}
	return string(runes)
}
func filterBoard(entries []dailyEntry, query string) boardView {
	out := append([]dailyEntry{}, entries...)
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Correct != out[j].Correct {
			return out[i].Correct > out[j].Correct
		}
		if out[i].TimeMs != out[j].TimeMs {
			return out[i].TimeMs < out[j].TimeMs
		}
		if out[i].SubmittedAt != out[j].SubmittedAt {
			if out[i].SubmittedAt == 0 {
				return false
			}
			if out[j].SubmittedAt == 0 {
				return true
			}
			return out[i].SubmittedAt < out[j].SubmittedAt
		}
		if out[i].LegacyDate != out[j].LegacyDate {
			return out[i].LegacyDate < out[j].LegacyDate
		}
		return out[i].Name < out[j].Name
	})
	view := boardView{Entries: []dailyEntry{}, Total: len(out), Limit: leaderboardLimit}
	query = strings.ToLower(query)
	for i, entry := range out {
		entry.Rank = i + 1
		if query != "" && !strings.Contains(strings.ToLower(entry.Name), query) && !strings.Contains(strings.ToLower(entry.Username), query) {
			continue
		}
		view.Matched++
		if len(view.Entries) < leaderboardLimit {
			entry.User = ""
			view.Entries = append(view.Entries, entry)
		}
	}
	return view
}
func publicBoard(entries []dailyEntry) []dailyEntry { return filterBoard(entries, "").Entries }

// Caller holds f.mu. Registered usernames are public; IDs, emails and account
// credentials never enter the leaderboard response.
func (f *features) accountUsername(user string) string {
	for _, account := range f.auth.Users {
		if account.ID == user {
			return account.Name
		}
	}
	return ""
}

type boardAttempt struct {
	User      string `json:"user"`
	Board     string `json:"board"`
	Started   int64  `json:"started"`
	PauseAt   int64  `json:"pauseAt,omitempty"`
	RestMs    int64  `json:"restMs,omitempty"`
	RestUsed  int    `json:"restUsed,omitempty"`
	FreePause bool   `json:"freePause,omitempty"`
	Revision  int64  `json:"revision,omitempty"`
}

func (f *features) beginBoardAttempt(board, user string) (string, error) {
	token, err := randomCode()
	if err != nil {
		return "", err
	}
	before := make(map[string]boardAttempt, len(f.data.Attempts))
	for key, attempt := range f.data.Attempts {
		before[key] = attempt
	}
	key := board + ":" + user
	oldStart, hadStart := f.data.Starts[key]
	now := time.Now().UnixMilli()
	// Bound abandoned attempts without affecting normal multi-window challenges.
	active := []string{}
	for id, attempt := range f.data.Attempts {
		if attempt.Started < now-30*24*3600*1000 {
			delete(f.data.Attempts, id)
			continue
		}
		if attempt.User == user && attempt.Board == board {
			active = append(active, id)
		}
	}
	sort.Slice(active, func(i, j int) bool { return f.data.Attempts[active[i]].Started < f.data.Attempts[active[j]].Started })
	for len(active) >= 32 {
		delete(f.data.Attempts, active[0])
		active = active[1:]
	}
	f.data.Attempts[token] = boardAttempt{User: user, Board: board, Started: now}
	// Retained only for old state readers; actual submissions use the attempt ID.
	f.data.Starts[key] = now
	if err = f.save(); err != nil {
		f.data.Attempts = before
		if hadStart {
			f.data.Starts[key] = oldStart
		} else {
			delete(f.data.Starts, key)
		}
		return "", err
	}
	return token, nil
}

func validBoardDate(date string) bool {
	_, err := time.Parse("2006-01-02", date)
	return err == nil
}

// Dated challenges used different question sets. Preserve every original
// dated record and expose them as a historical archive, separate from the new
// fixed-question boards. Never invent an exact time for a date-only record.
func (f *features) migratePermanentBoards() bool {
	if f.data.BoardMigration >= 1 {
		return false
	}
	keys := make([]string, 0, len(f.data.Daily))
	for key := range f.data.Daily {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		parts := strings.Split(key, ":")
		target, date := "", ""
		if len(parts) == 2 && validBoardDate(parts[0]) {
			switch parts[1] {
			case "5000":
				target = legacyMainBoard(5000)
			case "10000":
				target = legacyMainBoard(10000)
			case "20000":
				target = legacyMainBoard(20000)
			}
			date = parts[0]
		} else if (len(parts) == 3 || len(parts) == 4) && parts[0] == "industry" && validBoardDate(parts[1]) {
			target, date = legacyIndustryBoard(parts[2]), parts[1]
		}
		if target == "" {
			continue
		}
		for _, entry := range f.data.Daily[key] {
			if entry.SubmittedAt == 0 && entry.LegacyDate == "" {
				entry.LegacyDate = date
			}
			if entry.Username == "" {
				entry.Username = f.accountUsername(entry.User)
			}
			f.data.Daily[target] = append(f.data.Daily[target], entry)
		}
	}
	f.data.BoardMigration = 1
	return true
}
