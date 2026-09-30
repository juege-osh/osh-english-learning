package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

func permanentVisitor(t *testing.T, f *features) *http.Cookie {
	t.Helper()
	res := httptest.NewRecorder()
	f.membership(res, httptest.NewRequest("GET", "/api/membership", nil))
	if res.Code != 200 || len(res.Result().Cookies()) == 0 {
		t.Fatal("visitor setup failed")
	}
	return res.Result().Cookies()[0]
}
func permanentRequest(t *testing.T, handler http.HandlerFunc, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	method := "GET"
	var data []byte
	if body != nil {
		method = "POST"
		data, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(data))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		req.AddCookie(cookie)
	}
	res := httptest.NewRecorder()
	handler(res, req)
	return res
}
func permanentDecode(t *testing.T, res *httptest.ResponseRecorder) map[string]json.RawMessage {
	t.Helper()
	if res.Code != 200 {
		t.Fatalf("request failed %d: %s", res.Code, res.Body.String())
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	return body
}
func permanentAnswers(questions []quizQuestion, correct int) []int {
	answers := make([]int, len(questions))
	for i := 0; i < correct; i++ {
		answers[i] = questions[i].ID
	}
	return answers
}
func TestPermanentChallengeAcrossDatesAndVersions(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(f.challenge("2026-09-30", 5000), f.challenge("2027-01-01", 5000)) {
		t.Fatal("main challenge changed at midnight")
	}
	route := f.findIndustry("travel")
	if industryBoard("2026-09-30", route) != industryBoard("2027-01-01", route) || !reflect.DeepEqual(f.industryChallenge("2026-09-30", route), f.industryChallenge("2027-01-01", route)) {
		t.Fatal("specialist board reset by date")
	}
	if f.mainBoard(5000) == f.mainBoard(10000) || f.mainBoard(10000) == f.mainBoard(20000) {
		t.Fatal("goal boards mixed")
	}
	edition := f.mainEdition(5000)
	f.words[0].Zh = "edited meaning"
	if edition == f.mainEdition(5000) {
		t.Fatal("main content edit reused ranking")
	}
	old := route.edition()
	route.Glosses[route.WordIDs[0]] = "edited travel meaning"
	if old == route.edition() {
		t.Fatal("industry edit reused ranking")
	}
	exam := f.findIndustry("cet4")
	if exam == nil {
		for i := range f.industries {
			if f.industries[i].Category == "exam" {
				exam = &f.industries[i]
				break
			}
		}
	}
	if exam == nil || exam.SourceVersion == "" {
		t.Fatal("exam meaning content missing from version")
	}
	old = exam.edition()
	exam.SourceVersion = "edited exam source"
	if old == exam.edition() {
		t.Fatal("exam meaning edit reused ranking")
	}
}
func TestPermanentMainRetriesKeepBestAndPersist(t *testing.T) {
	dir := t.TempDir()
	f, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	cookie := permanentVisitor(t, f)
	board := f.mainBoard(5000)
	submit := func(correct int, elapsed int64, name string) (dailyEntry, bool) {
		t.Helper()
		start := permanentDecode(t, permanentRequest(t, f.dailyQuiz, "/api/daily?goal=5000", nil, cookie))
		var locked bool
		json.Unmarshal(start["submitted"], &locked)
		if locked {
			t.Fatal("retry locked")
		}
		var token string
		json.Unmarshal(start["attemptId"], &token)
		attempt := f.data.Attempts[token]
		attempt.Started = time.Now().UnixMilli() - elapsed
		f.data.Attempts[token] = attempt
		body := map[string]any{"goal": 5000, "edition": f.mainEdition(5000), "attemptId": token, "name": name, "answers": permanentAnswers(f.challenge("", 5000), correct)}
		result := permanentDecode(t, permanentRequest(t, f.dailySubmit, "/api/daily/submit", body, cookie))
		var best dailyEntry
		var improved bool
		json.Unmarshal(result["best"], &best)
		json.Unmarshal(result["improved"], &improved)
		if best.User != "" || best.SubmittedAt == 0 {
			t.Fatal("best lacks time or leaks identity")
		}
		return best, improved
	}
	first, improved := submit(20, 5000, "first")
	if !improved {
		t.Fatal("first score not recorded")
	}
	retained, improved := submit(19, 1000, "worse")
	if improved || !reflect.DeepEqual(first, retained) {
		t.Fatal("lower score replaced best")
	}
	retained, improved = submit(20, 9000, "slower")
	if improved || !reflect.DeepEqual(first, retained) {
		t.Fatal("slower equal score replaced best")
	}
	faster, improved := submit(20, 2000, "faster")
	if !improved || faster.TimeMs >= first.TimeMs || len(f.data.Daily[board]) != 1 {
		t.Fatal("faster equal score not retained exactly once")
	}
	restarted, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	result := permanentDecode(t, permanentRequest(t, restarted.leaderboard, "/api/daily/leaderboard?goal=5000", nil, nil))
	var entries []dailyEntry
	json.Unmarshal(result["entries"], &entries)
	if len(entries) != 1 || entries[0].Rank != 1 || entries[0].Correct != faster.Correct || entries[0].TimeMs != faster.TimeMs || entries[0].SubmittedAt != faster.SubmittedAt || string(result["period"]) != "\"all-time\"" {
		t.Fatal("permanent score missing after restart")
	}
	result = permanentDecode(t, permanentRequest(t, restarted.leaderboard, "/api/daily/leaderboard?goal=20000", nil, nil))
	json.Unmarshal(result["entries"], &entries)
	if len(entries) != 0 {
		t.Fatal("goals mixed")
	}
	stale := permanentRequest(t, f.dailySubmit, "/api/daily/submit", map[string]any{"goal": 5000, "edition": "obsolete", "answers": make([]int, 20)}, cookie)
	if stale.Code != 409 {
		t.Fatal("stale main edition accepted")
	}
}
func TestPermanentIndustryRetriesKeepBestAndPersist(t *testing.T) {
	dir := t.TempDir()
	f, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	cookie := permanentVisitor(t, f)
	route := f.findIndustry("travel")
	board := industryBoard("", route)
	for _, correct := range []int{12, 20, 18} {
		start := permanentDecode(t, permanentRequest(t, f.industryQuiz, "/api/industries/challenge?sector=travel", nil, cookie))
		var locked bool
		json.Unmarshal(start["submitted"], &locked)
		if locked {
			t.Fatal("industry retry locked")
		}
		body := map[string]any{"sector": "travel", "edition": route.edition(), "attemptId": json.RawMessage(start["attemptId"]), "name": "traveler", "answers": permanentAnswers(f.industryChallenge("", route), correct)}
		permanentDecode(t, permanentRequest(t, f.industrySubmit, "/api/industries/submit", body, cookie))
	}
	if len(f.data.Daily[board]) != 1 || f.data.Daily[board][0].Correct != 20 || f.data.Daily[board][0].SubmittedAt == 0 {
		t.Fatal("industry best score wrong")
	}
	restarted, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	response := permanentDecode(t, permanentRequest(t, restarted.industryLeaderboard, "/api/industries/leaderboard?sector=travel", nil, nil))
	var entries []dailyEntry
	json.Unmarshal(response["entries"], &entries)
	if len(entries) != 1 || entries[0].Correct != 20 || entries[0].SubmittedAt == 0 || entries[0].User != "" {
		t.Fatal("industry score lost after restart")
	}
	response = permanentDecode(t, permanentRequest(t, restarted.industryLeaderboard, "/api/industries/leaderboard?sector=finance", nil, nil))
	json.Unmarshal(response["entries"], &entries)
	if len(entries) != 0 {
		t.Fatal("industry routes mixed")
	}
}
func TestPermanentBoardsMigrateDatedScores(t *testing.T) {
	dir := t.TempDir()
	f, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	route := f.findIndustry("travel")
	f.data.BoardMigration = 0
	f.data.Daily["2026-08-01:5000"] = []dailyEntry{{User: "old", Name: "old main", Correct: 18, TimeMs: 3000}}
	f.data.Daily["2026-08-02:5000"] = []dailyEntry{{User: "old", Name: "better main", Correct: 19, TimeMs: 4000}}
	oldKey := "industry:2026-08-01:travel:" + route.edition()
	f.data.Daily[oldKey] = []dailyEntry{{User: "specialist", Name: "travel old", Correct: 20, TimeMs: 5000}}
	exam := f.findIndustry("cet4")
	if exam == nil {
		for i := range f.industries {
			if f.industries[i].Category == "exam" {
				exam = &f.industries[i]
				break
			}
		}
	}
	legacyExam := *exam
	legacyExam.SourceVersion = ""
	f.data.Daily["industry:2026-08-01:"+exam.ID+":"+legacyExam.edition()] = []dailyEntry{{User: "exam", Name: "old exam", Correct: 20, TimeMs: 4000}}
	if err = f.save(); err != nil {
		t.Fatal(err)
	}
	migrated, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	mainLegacy := migrated.data.Daily[legacyMainBoard(5000)]
	if len(mainLegacy) != 2 || mainLegacy[1].Correct != 19 || mainLegacy[1].LegacyDate != "2026-08-02" || mainLegacy[1].SubmittedAt != 0 || len(migrated.data.Daily[migrated.mainBoard(5000)]) != 0 {
		t.Fatal("legacy main lost or unfairly mixed")
	}
	specialist := migrated.data.Daily[legacyIndustryBoard("travel")]
	if len(specialist) != 1 || specialist[0].LegacyDate != "2026-08-01" || specialist[0].SubmittedAt != 0 {
		t.Fatal("dated specialist archive wrong")
	}
	if len(migrated.data.Daily[legacyIndustryBoard(exam.ID)]) != 1 {
		t.Fatal("old exam source without meaning version not archived")
	}
	if _, exists := migrated.data.Daily[oldKey]; !exists {
		t.Fatal("original dated record was lost")
	}
	if migrated.migratePermanentBoards() {
		t.Fatal("migration not idempotent")
	}
	again, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(again.data.Daily[legacyIndustryBoard("travel")]) != 1 || len(again.data.Daily[industryBoard("", again.findIndustry("travel"))]) != 0 {
		t.Fatal("migration duplicated at restart")
	}
}
func TestPermanentBoardOrdersAccuracyThenTimeAndHidesIdentity(t *testing.T) {
	scores := []dailyEntry{{User: "low", Name: "low", Correct: 19, TimeMs: 1000, SubmittedAt: 100}, {User: "slow", Name: "slow", Correct: 20, TimeMs: 9000, SubmittedAt: 200}, {User: "fast", Name: "fast", Correct: 20, TimeMs: 2000, SubmittedAt: 300}, {User: "older", Name: "older", Correct: 20, TimeMs: 2000, SubmittedAt: 250}, {User: "historic", Name: "historic", Correct: 20, TimeMs: 2000, LegacyDate: "2026-08-01"}}
	result := publicBoard(scores)
	want := []string{"older", "fast", "historic", "slow", "low"}
	for i, entry := range result {
		if entry.Name != want[i] || entry.User != "" {
			t.Fatal("ordering or privacy wrong")
		}
	}
	if scores[0].User != "low" {
		t.Fatal("public board mutated persisted identifiers")
	}
	unchanged, best, improved := retainBest(scores, dailyEntry{User: "fast", Name: "new nickname", Correct: 20, TimeMs: 2000, SubmittedAt: 900})
	if improved || best.Name != "fast" || len(unchanged) != len(scores) {
		t.Fatal("exact score tie changed original best time/name")
	}
}

func TestPermanentBoardTop1000AndFuzzySearchKeepRealRanks(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	scores := make([]dailyEntry, 1005)
	for i := range scores {
		scores[i] = dailyEntry{User: fmt.Sprintf("private-%d", i), Name: fmt.Sprintf("旅人%04d", i), Username: fmt.Sprintf("user%04d", i), Correct: 20, TimeMs: int64(1000 + i), SubmittedAt: 100}
	}
	f.data.Daily[f.mainBoard(5000)] = scores
	f.data.Daily[industryBoard("", f.findIndustry("travel"))] = scores
	for _, test := range []struct {
		handler http.HandlerFunc
		path    string
	}{{f.leaderboard, "/api/daily/leaderboard?goal=5000"}, {f.industryLeaderboard, "/api/industries/leaderboard?sector=travel"}} {
		body := permanentDecode(t, permanentRequest(t, test.handler, test.path, nil, nil))
		var entries []dailyEntry
		json.Unmarshal(body["entries"], &entries)
		if len(entries) != 1000 || entries[0].Rank != 1 || entries[999].Rank != 1000 || string(body["total"]) != "1005" || string(body["matched"]) != "1005" || string(body["limit"]) != "1000" {
			t.Fatal("top 1000 metadata wrong")
		}
		body = permanentDecode(t, permanentRequest(t, test.handler, test.path+"&q=USER10", nil, nil))
		json.Unmarshal(body["entries"], &entries)
		if len(entries) != 5 || entries[0].Rank != 1001 || entries[4].Rank != 1005 || string(body["matched"]) != "5" {
			t.Fatal("username fuzzy search lost global rank")
		}
		for _, entry := range entries {
			if entry.User != "" || entry.Username == "" {
				t.Fatal("search leaked private ID or lost public username")
			}
		}
	}
	if len(f.data.Daily[f.mainBoard(5000)]) != 1005 {
		t.Fatal("display limit deleted saved best scores")
	}
	nickname := filterBoard(scores, "旅人1004")
	if nickname.Matched != 1 || nickname.Entries[0].Rank != 1005 {
		t.Fatal("nickname substring search failed")
	}
}

func TestPermanentAttemptsIsolateWindowsAndSurviveRestart(t *testing.T) {
	for _, sector := range []string{"", "travel"} {
		t.Run("sector_"+sector, func(t *testing.T) {
			dir := t.TempDir()
			f, err := newFeatures(dir)
			if err != nil {
				t.Fatal(err)
			}
			cookie := permanentVisitor(t, f)
			handler, startURL, submitURL := http.HandlerFunc(f.dailyQuiz), "/api/daily?goal=5000", "/api/daily/submit"
			board := f.mainBoard(5000)
			answers := permanentAnswers(f.challenge("", 5000), 20)
			body := map[string]any{"goal": 5000, "edition": f.mainEdition(5000), "name": "windows", "answers": answers}
			if sector != "" {
				route := f.findIndustry(sector)
				handler = f.industryQuiz
				startURL = "/api/industries/challenge?sector=" + sector
				submitURL = "/api/industries/submit"
				board = industryBoard("", route)
				body = map[string]any{"sector": sector, "edition": route.edition(), "name": "windows", "answers": permanentAnswers(f.industryChallenge("", route), 20)}
			}
			first := permanentDecode(t, permanentRequest(t, handler, startURL, nil, cookie))
			var firstToken string
			json.Unmarshal(first["attemptId"], &firstToken)
			attempt := f.data.Attempts[firstToken]
			attempt.Started = time.Now().UnixMilli() - 40000
			f.data.Attempts[firstToken] = attempt
			second := permanentDecode(t, permanentRequest(t, handler, startURL, nil, cookie))
			var secondToken string
			json.Unmarshal(second["attemptId"], &secondToken)
			if firstToken == secondToken || f.data.Attempts[firstToken].Started != attempt.Started || f.data.Attempts[secondToken].Board != board {
				t.Fatal("second window changed first timer")
			}
			restarted, err := newFeatures(dir)
			if err != nil {
				t.Fatal(err)
			}
			submitHandler := http.HandlerFunc(restarted.dailySubmit)
			if sector != "" {
				submitHandler = restarted.industrySubmit
			}
			body["attemptId"] = firstToken
			result := permanentDecode(t, permanentRequest(t, submitHandler, submitURL, body, cookie))
			var elapsed int64
			json.Unmarshal(result["timeMs"], &elapsed)
			if elapsed < 40000 {
				t.Fatal("first window got second window's short timer")
			}
			duplicate := permanentRequest(t, submitHandler, submitURL, body, cookie)
			if duplicate.Code != 400 {
				t.Fatal("attempt replay accepted")
			}
			body["attemptId"] = secondToken
			result = permanentDecode(t, permanentRequest(t, submitHandler, submitURL, body, cookie))
			var improved bool
			json.Unmarshal(result["improved"], &improved)
			if !improved {
				t.Fatal("independent faster second round not accepted")
			}
		})
	}
}

func TestPermanentOpeningStorageFailureRollsBackAttemptsAndTimer(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	cookie := permanentVisitor(t, f)
	permanentDecode(t, permanentRequest(t, f.dailyQuiz, "/api/daily?goal=5000", nil, cookie))
	before := map[string]boardAttempt{}
	for key, item := range f.data.Attempts {
		before[key] = item
	}
	startKey := f.mainBoard(5000) + ":" + cookie.Value
	oldStart := f.data.Starts[startKey]
	goodPath := f.path
	f.path = filepath.Join(t.TempDir(), "missing-directory", "state.json")
	failed := permanentRequest(t, f.dailyQuiz, "/api/daily?goal=5000", nil, cookie)
	if failed.Code != 500 || !reflect.DeepEqual(before, f.data.Attempts) || f.data.Starts[startKey] != oldStart {
		t.Fatal("failed opening mutated in-memory timer/attempts")
	}
	f.path = goodPath
	permanentDecode(t, permanentRequest(t, f.dailyQuiz, "/api/daily?goal=5000", nil, cookie))
}
