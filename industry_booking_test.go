package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"
	"time"
)

func TestIndustryBoardsAreSeparate(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if len(f.industries) != 17 {
		t.Fatalf("industry count %d", len(f.industries))
	}
	visitor := httptest.NewRecorder()
	f.membership(visitor, httptest.NewRequest("GET", "/api/membership", nil))
	cookie := visitor.Result().Cookies()[0]
	sector := f.findIndustry("finance")
	start := httptest.NewRequest("GET", "/api/industries/challenge?sector=finance", nil)
	start.AddCookie(cookie)
	result := httptest.NewRecorder()
	f.industryQuiz(result, start)
	if result.Code != 200 {
		t.Fatal(result.Body.String())
	}
	var quiz struct {
		Questions []map[string]any `json:"questions"`
		AttemptID string           `json:"attemptId"`
	}
	if err := json.Unmarshal(result.Body.Bytes(), &quiz); err != nil {
		t.Fatal(err)
	}
	if len(quiz.Questions) != 20 {
		t.Fatal("wrong industry question count")
	}
	if _, ok := quiz.Questions[0]["id"]; ok {
		t.Fatal("answer leaked")
	}
	answers := make([]int, 20)
	for i, q := range f.industryChallenge(dailyDate(), sector) {
		answers[i] = q.ID
	}
	body, _ := json.Marshal(map[string]any{"sector": "finance", "edition": sector.edition(), "attemptId": quiz.AttemptID, "name": "财务同学", "answers": answers})
	submit := httptest.NewRequest("POST", "/api/industries/submit", bytes.NewReader(body))
	submit.Header.Set("Content-Type", "application/json")
	submit.AddCookie(cookie)
	submitted := httptest.NewRecorder()
	f.industrySubmit(submitted, submit)
	if submitted.Code != 200 {
		t.Fatal(submitted.Body.String())
	}
	var score struct {
		Correct int `json:"correct"`
	}
	if err := json.Unmarshal(submitted.Body.Bytes(), &score); err != nil || score.Correct != 20 {
		t.Fatalf("score: %s", submitted.Body.String())
	}
	board := httptest.NewRecorder()
	f.industryLeaderboard(board, httptest.NewRequest("GET", "/api/industries/leaderboard?sector=finance", nil))
	var rank struct {
		Entries []dailyEntry `json:"entries"`
	}
	if err := json.Unmarshal(board.Body.Bytes(), &rank); err != nil || len(rank.Entries) != 1 || rank.Entries[0].User != "" {
		t.Fatalf("board: %s", board.Body.String())
	}
	other := httptest.NewRecorder()
	f.industryLeaderboard(other, httptest.NewRequest("GET", "/api/industries/leaderboard?sector=programmer", nil))
	if err := json.Unmarshal(other.Body.Bytes(), &rank); err != nil || len(rank.Entries) != 0 {
		t.Fatalf("sector mixed: %s", other.Body.String())
	}
}

func TestIndustryQuizUsesIndustryMeaning(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	sector := f.findIndustry("programmer")
	core := map[int]bool{}
	for _, id := range sector.WordIDs[:sector.CoreCount] {
		core[id] = true
	}
	for _, q := range f.industryChallenge(dailyDate(), sector) {
		if !core[q.ID] {
			t.Fatalf("unreviewed word %d entered ranked challenge", q.ID)
		}
		for _, option := range q.Options {
			if !core[option.ID] {
				t.Fatalf("unreviewed option %d entered ranked challenge", option.ID)
			}
		}
	}
	for _, id := range sector.WordIDs[:sector.CoreCount] {
		word := f.words[id-1]
		if word.Word == "server" && sector.gloss(word) == "服务器" {
			return
		}
	}
	t.Fatal("server lacks the reviewed industry meaning")
}

func TestMemberBookingFlow(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	visitor := httptest.NewRecorder()
	f.membership(visitor, httptest.NewRequest("GET", "/api/membership", nil))
	cookie := visitor.Result().Cookies()[0]
	registerBody, _ := json.Marshal(map[string]string{"name": "booking_user", "password": "long-password-123"})
	registerRequest := httptest.NewRequest("POST", "/api/account/register", bytes.NewReader(registerBody))
	registerRequest.AddCookie(cookie)
	registered := httptest.NewRecorder()
	f.accountRegister(registered, registerRequest)
	if registered.Code != 200 {
		t.Fatal(registered.Body.String())
	}
	sessionCookie := registered.Result().Cookies()[0]
	f.data.Members[cookie.Value] = member{Created: time.Now().Unix(), Until: time.Now().Add(30 * 24 * time.Hour).Unix()}
	body, _ := json.Marshal(map[string]any{"name": "觉哥", "contact": "private-wechat", "preferred": "2026-10-10T19:00", "zone": "Asia/Shanghai", "topic": "聊网站的新功能建议"})
	guestRequest := httptest.NewRequest("POST", "/api/bookings", bytes.NewReader(body))
	guestRequest.Header.Set("Content-Type", "application/json")
	guestRequest.AddCookie(cookie)
	guestDenied := httptest.NewRecorder()
	f.bookingCreate(guestDenied, guestRequest)
	if guestDenied.Code != 401 {
		t.Fatalf("signed-out booking accepted: %d", guestDenied.Code)
	}
	request := httptest.NewRequest("POST", "/api/bookings", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(cookie)
	request.AddCookie(sessionCookie)
	created := httptest.NewRecorder()
	f.bookingCreate(created, request)
	if created.Code != 200 {
		t.Fatal(created.Body.String())
	}
	var made struct {
		Booking booking `json:"booking"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &made); err != nil || made.Booking.ID == "" {
		t.Fatalf("booking: %s", created.Body.String())
	}
	if err := f.confirmBooking(made.Booking.ID, "2026-10-10 19:00 北京时间"); err != nil {
		t.Fatal(err)
	}
	my := httptest.NewRequest("GET", "/api/bookings", nil)
	my.AddCookie(cookie)
	my.AddCookie(sessionCookie)
	listed := httptest.NewRecorder()
	f.bookingMine(listed, my)
	var mine struct {
		Items []booking `json:"items"`
	}
	if err := json.Unmarshal(listed.Body.Bytes(), &mine); err != nil || len(mine.Items) != 1 || mine.Items[0].Status != "confirmed" || mine.Items[0].Visitor != "" {
		t.Fatalf("my bookings: %s", listed.Body.String())
	}
	f.data.Members[cookie.Value] = member{Created: time.Now().Add(-31 * 24 * time.Hour).Unix()}
	request = httptest.NewRequest("POST", "/api/bookings", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(cookie)
	request.AddCookie(sessionCookie)
	denied := httptest.NewRecorder()
	f.bookingCreate(denied, request)
	if denied.Code != 403 {
		t.Fatalf("expired member accepted: %d", denied.Code)
	}
}

func TestBookingAdminReviewKeepsContactPrivate(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	regBody, _ := json.Marshal(map[string]string{"name": "booking_admin", "password": "long-password-123"})
	registered := httptest.NewRecorder()
	f.accountRegister(registered, httptest.NewRequest("POST", "/api/account/register", bytes.NewReader(regBody)))
	if registered.Code != 200 {
		t.Fatal(registered.Body.String())
	}
	cookies := registered.Result().Cookies()
	item := booking{ID: "TESTBOOKING", Visitor: "another-user", Name: "学习者", Contact: "private-wechat-id", Preferred: "2026-10-10T19:00", Zone: "Asia/Shanghai", Topic: "反馈学习体验", Created: time.Now().Unix(), Status: "pending"}
	if err := f.saveBooking(item); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest("GET", "/api/bookings/admin", nil)
	for _, c := range cookies {
		request.AddCookie(c)
	}
	denied := httptest.NewRecorder()
	f.bookingAdminList(denied, request)
	if denied.Code != 403 || bytes.Contains(denied.Body.Bytes(), []byte(item.Contact)) {
		t.Fatalf("private contact exposed: %d", denied.Code)
	}
	if err := f.promoteAdmin("booking_admin"); err != nil {
		t.Fatal(err)
	}
	request = httptest.NewRequest("GET", "/api/bookings/admin", nil)
	for _, c := range cookies {
		request.AddCookie(c)
	}
	listed := httptest.NewRecorder()
	f.bookingAdminList(listed, request)
	if listed.Code != 200 || !bytes.Contains(listed.Body.Bytes(), []byte(item.Contact)) {
		t.Fatalf("admin cannot see booking: %s", listed.Body.String())
	}
	reviewBody, _ := json.Marshal(map[string]string{"id": item.ID, "decision": "confirm", "when": "2026-10-10T20:00", "zone": "Asia/Shanghai"})
	request = httptest.NewRequest("POST", "/api/bookings/review", bytes.NewReader(reviewBody))
	request.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		request.AddCookie(c)
	}
	confirmed := httptest.NewRecorder()
	f.bookingReview(confirmed, request)
	if confirmed.Code != 200 {
		t.Fatal(confirmed.Body.String())
	}
	items, err := f.bookings()
	if err != nil || len(items) != 1 || items[0].Status != "confirmed" || items[0].Confirmed != "2026-10-10 20:00 · 北京时间" {
		t.Fatalf("booking not confirmed: %+v %v", items, err)
	}
}

// Expanding a route must not grade an earlier quiz against a different pool.
func TestIndustryEditionSeparatesQuestionPools(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	sector := f.findIndustry("programmer")
	if sector.CoreCount != 683 || len(sector.WordIDs) != 683 || len(sector.Glosses) != 683 {
		t.Fatal("programmer editorial pool is incomplete")
	}
	edition := sector.edition()
	board := industryBoard(dailyDate(), sector)
	allowed := map[int]bool{}
	for _, id := range sector.WordIDs {
		allowed[id] = true
	}
	beyondStart := false
	for day := 1; day <= 30; day++ {
		questions := f.industryChallenge(time.Date(2026, 10, day, 0, 0, 0, 0, time.UTC).Format("2006-01-02"), sector)
		seen := map[int]bool{}
		for _, q := range questions {
			if !allowed[q.ID] || seen[q.ID] || len(q.Options) != 4 {
				t.Fatal("invalid industry question")
			}
			seen[q.ID] = true
			meanings := map[string]bool{}
			found := false
			for _, option := range q.Options {
				if !allowed[option.ID] || meanings[option.Zh] || option.Zh != sector.Glosses[option.ID] {
					t.Fatal("distractor did not use a distinct reviewed industry meaning")
				}
				meanings[option.Zh] = true
				found = found || option.ID == q.ID
			}
			if !found {
				t.Fatal("missing correct option")
			}
			for _, id := range sector.WordIDs[100:] {
				beyondStart = beyondStart || id == q.ID
			}
		}
	}
	if !beyondStart {
		t.Fatal("new words were never used by the board")
	}
	visitor := httptest.NewRecorder()
	f.membership(visitor, httptest.NewRequest("GET", "/api/membership", nil))
	cookie := visitor.Result().Cookies()[0]
	start := httptest.NewRequest("GET", "/api/industries/challenge?sector=programmer", nil)
	start.AddCookie(cookie)
	started := httptest.NewRecorder()
	f.industryQuiz(started, start)
	if started.Code != 200 {
		t.Fatal(started.Body.String())
	}
	sector.CoreCount = 100
	if edition == sector.edition() || board == industryBoard(dailyDate(), sector) {
		t.Fatal("changed question pool reused the previous edition")
	}
	body, _ := json.Marshal(map[string]any{"sector": "programmer", "edition": edition, "answers": make([]int, 20)})
	submit := httptest.NewRequest("POST", "/api/industries/submit", bytes.NewReader(body))
	submit.Header.Set("Content-Type", "application/json")
	submit.AddCookie(cookie)
	result := httptest.NewRecorder()
	f.industrySubmit(result, submit)
	if result.Code != 409 || len(f.data.Daily[board]) != 0 || f.data.Starts[board+":"+cookie.Value] == 0 {
		t.Fatalf("stale quiz consumed an entry: %d %s", result.Code, result.Body.String())
	}
	sector.CoreCount = 683
	sector.Glosses[sector.WordIDs[0]] = "新的词义"
	if edition == sector.edition() {
		t.Fatal("meaning edit did not change the edition")
	}
}

func TestEditorialIndustryChallengePools(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for id, count := range map[string]int{"ai_creator": 831, "healthcare": 753, "biology": 967, "foreign_trade": 774, "finance": 846, "marketing": 767, "law": 850, "chemistry": 932, "travel": 709} {
		t.Run(id, func(t *testing.T) {
			sector := f.findIndustry(id)
			if sector == nil || sector.CoreCount != count || len(sector.WordIDs) != count || len(sector.Glosses) != count {
				t.Fatal("editorial pool has missing meanings or trial padding")
			}
			allowed := map[int]bool{}
			for _, wordID := range sector.WordIDs {
				allowed[wordID] = true
			}
			beyondStart := false
			for day := 1; day <= 30; day++ {
				questions := f.industryChallenge(time.Date(2026, 10, day, 0, 0, 0, 0, time.UTC).Format("2006-01-02"), sector)
				if len(questions) != 20 {
					t.Fatal("wrong challenge length")
				}
				seen := map[int]bool{}
				for _, q := range questions {
					if !allowed[q.ID] || seen[q.ID] || len(q.Options) != 4 {
						t.Fatal("invalid question")
					}
					seen[q.ID] = true
					meanings := map[string]bool{}
					found := false
					for _, option := range q.Options {
						if !allowed[option.ID] || meanings[option.Zh] || option.Zh != sector.Glosses[option.ID] {
							t.Fatal("invalid editorial distractor")
						}
						meanings[option.Zh] = true
						found = found || option.ID == q.ID
					}
					if !found {
						t.Fatal("missing correct option")
					}
					for _, wordID := range sector.WordIDs[100:] {
						beyondStart = beyondStart || wordID == q.ID
					}
				}
			}
			if !beyondStart {
				t.Fatal("new meanings did not reach the leaderboard")
			}
			edition := sector.edition()
			sector.Glosses[sector.WordIDs[100]] = "修改后的行业含义"
			if edition == sector.edition() {
				t.Fatal("edited meaning reused the old leaderboard")
			}
		})
	}
}

func TestSupplementalIndustryWordsStayOutsideMainRoute(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if len(f.words) != 20000 || len(f.extraWords) != 1407 {
		t.Fatal("main or supplemental vocabulary size changed unexpectedly")
	}
	sector := f.findIndustry("biology")
	found := map[string]bool{}
	for _, id := range sector.WordIDs {
		word := f.industryWord(id)
		if word.ID != id || word.Word == "" || sector.gloss(word) == "" {
			t.Fatal("missing specialist word or sense")
		}
		if id > 20000 {
			found[word.Word] = true
		}
	}
	for _, headword := range []string{"meiosis", "cytoplasm", "ribosome", "plasmid", "xylem", "dna", "rna"} {
		if !found[headword] {
			t.Fatalf("essential specialist term missing: %s", headword)
		}
	}
	appeared := false
	for day := 1; day <= 30; day++ {
		date := time.Date(2026, 10, day, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
		for _, q := range f.industryChallenge(date, sector) {
			appeared = appeared || q.ID > 20000
			if q.Word != sector.display(f.industryWord(q.ID)) {
				t.Fatal("specialist question does not resolve to its vocabulary")
			}
		}
		for _, goal := range []int{5000, 10000, 20000} {
			for _, q := range f.challenge(date, goal) {
				if q.ID < 1 || q.ID > goal {
					t.Fatal("specialist vocabulary leaked into main daily competition")
				}
				for _, option := range q.Options {
					if option.ID > goal {
						t.Fatal("specialist distractor leaked into main competition")
					}
				}
			}
		}
	}
	if !appeared || f.industryWord(0).ID != 0 || f.industryWord(30001).ID != 0 {
		t.Fatal("supplemental lookup or ranked coverage failed")
	}
	for _, industry := range f.industries {
		if industry.Category == "exam" {
			for _, id := range industry.WordIDs {
				if id > 20000 {
					t.Fatal("supplemental vocabulary changed an exam reference pool")
				}
			}
		}
	}
}

func TestIndustryAcronymsPreserveCanonicalProgressIDs(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	// Display-free routes include any source dictionary version in their edition.
	for _, sector := range f.industries {
		if len(sector.DisplayWords) != 0 {
			continue
		}
		pool := sector.WordIDs
		if sector.Category == "industry" {
			pool = pool[:sector.CoreCount]
		}
		body, _ := json.Marshal(struct {
			IDs           []int
			Glosses       map[int]string
			SourceVersion string `json:",omitempty"`
		}{pool, sector.Glosses, sector.SourceVersion})
		h := sha256.Sum256(body)
		if sector.edition() != fmt.Sprintf("%x", h[:6]) {
			t.Fatalf("unaffected board changed: %s", sector.ID)
		}
	}
	seen := map[string]bool{}
	for _, route := range []string{"foreign_trade", "finance", "biology"} {
		sector := f.findIndustry(route)
		for day := 1; day <= 31; day++ {
			date := time.Date(2026, 10, day, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
			for _, q := range f.industryChallenge(date, sector) {
				canonical := f.industryWord(q.ID)
				if q.Word != sector.display(canonical) {
					t.Fatal("acronym lost in ranked question")
				}
				if label := sector.DisplayWords[q.ID]; label != "" {
					seen[label] = true
					if canonical.Word == label {
						t.Fatal("display formatting changed canonical headword")
					}
				}
			}
		}
		edition := sector.edition()
		sector.DisplayWords[sector.WordIDs[0]] = "Updated"
		if sector.edition() == edition {
			t.Fatal("display edit reused old question edition")
		}
	}
	if len(seen) == 0 {
		t.Fatal("no ranked acronym questions")
	}
	for route, label := range map[string]string{"finance": "IPO", "foreign_trade": "FOB", "biology": "DNA"} {
		sector := f.findIndustry(route)
		found := false
		for id, display := range sector.DisplayWords {
			if display == label {
				found = sector.display(f.industryWord(id)) == label
			}
		}
		if !found {
			t.Fatalf("missing display label: %s", label)
		}
	}
}
