package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"
)

func TestIndustryBoardsAreSeparate(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if len(f.industries) != 16 {
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
	body, _ := json.Marshal(map[string]any{"sector": "finance", "name": "财务同学", "answers": answers})
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
