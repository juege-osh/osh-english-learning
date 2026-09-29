package main

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http/httptest"
	"testing"
	"time"
)

func TestProofApprovalRequiresReviewerAndGrantsThirtyDays(t *testing.T) {
	dir := t.TempDir()
	f, e := newFeatures(dir)
	if e != nil {
		t.Fatal(e)
	}
	payload, _ := json.Marshal(map[string]string{"name": "student_1", "password": "long-password-123"})
	rr := httptest.NewRecorder()
	f.accountRegister(rr, httptest.NewRequest("POST", "/api/account/register", bytes.NewReader(payload)))
	if rr.Code != 200 {
		t.Fatal(rr.Body.String())
	}
	cookies := rr.Result().Cookies()
	if len(cookies) < 2 {
		t.Fatal("missing guest/session cookies")
	}
	req := httptest.NewRequest("GET", "/api/membership", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	profile := httptest.NewRecorder()
	f.membership(profile, req)
	if !bytes.Contains(profile.Body.Bytes(), []byte(`"status":"free"`)) {
		t.Fatal(profile.Body.String())
	}
	var img bytes.Buffer
	canvas := image.NewRGBA(image.Rect(0, 0, 120, 120))
	canvas.Set(1, 1, color.RGBA{R: 255, A: 255})
	if e := png.Encode(&img, canvas); e != nil {
		t.Fatal(e)
	}
	var form bytes.Buffer
	writer := multipart.NewWriter(&form)
	_ = writer.WriteField("platform", "douyin")
	part, e := writer.CreateFormFile("screenshot", "follow.png")
	if e != nil {
		t.Fatal(e)
	}
	_, _ = part.Write(img.Bytes())
	_ = writer.Close()
	applyReq := httptest.NewRequest("POST", "/api/applications/apply", &form)
	applyReq.Header.Set("Content-Type", writer.FormDataContentType())
	for _, c := range cookies {
		applyReq.AddCookie(c)
	}
	applied := httptest.NewRecorder()
	f.proofApply(applied, applyReq)
	if applied.Code != 200 {
		t.Fatal(applied.Body.String())
	}
	var result struct {
		Application proofApplication `json:"application"`
	}
	if e := json.Unmarshal(applied.Body.Bytes(), &result); e != nil {
		t.Fatal(e)
	}
	// Simulate an application saved by the older version, which omitted Image.
	old := f.proofs.Applications[result.Application.ID]
	old.Image = ""
	f.proofs.Applications[old.ID] = old
	if e := f.saveProofs(); e != nil {
		t.Fatal(e)
	}
	f, e = newFeatures(dir)
	if e != nil {
		t.Fatal(e)
	}
	if got := f.proofs.Applications[old.ID].Image; got != old.ID+".png" {
		t.Fatalf("old screenshot not recovered: %q", got)
	}
	f, e = newFeatures(dir)
	if e != nil || f.proofs.Applications[old.ID].Image != old.ID+".png" {
		t.Fatalf("screenshot association not persisted after restart: %v", e)
	}
	reviewBody, _ := json.Marshal(map[string]string{"id": result.Application.ID, "decision": "approve"})
	reviewReq := httptest.NewRequest("POST", "/api/applications/review", bytes.NewReader(reviewBody))
	for _, c := range cookies {
		reviewReq.AddCookie(c)
	}
	denied := httptest.NewRecorder()
	f.proofReview(denied, reviewReq)
	if denied.Code != 403 {
		t.Fatalf("non-admin review accepted: %d", denied.Code)
	}
	if e = f.promoteAdmin("student_1"); e != nil {
		t.Fatal(e)
	}
	imageReq := httptest.NewRequest("GET", "/api/applications/image?id="+old.ID, nil)
	for _, c := range cookies {
		imageReq.AddCookie(c)
	}
	imageResult := httptest.NewRecorder()
	f.proofImage(imageResult, imageReq)
	if imageResult.Code != 200 || !bytes.Equal(imageResult.Body.Bytes(), img.Bytes()) {
		t.Fatalf("admin cannot see screenshot after restart: %d", imageResult.Code)
	}
	reviewReq = httptest.NewRequest("POST", "/api/applications/review", bytes.NewReader(reviewBody))
	for _, c := range cookies {
		reviewReq.AddCookie(c)
	}
	accepted := httptest.NewRecorder()
	f.proofReview(accepted, reviewReq)
	if accepted.Code != 200 {
		t.Fatal(accepted.Body.String())
	}
	req = httptest.NewRequest("GET", "/api/membership", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	profile = httptest.NewRecorder()
	f.membership(profile, req)
	var membership struct {
		Status string `json:"status"`
		Until  int64  `json:"until"`
	}
	if e = json.Unmarshal(profile.Body.Bytes(), &membership); e != nil || membership.Status != "member" || membership.Until < time.Now().Add(29*24*time.Hour).Unix() {
		t.Fatalf("not granted: %s", profile.Body.String())
	}
	reloaded, e := newFeatures(dir)
	if e != nil {
		t.Fatal(e)
	}
	if reloaded.data.Members[result.Application.User].Until != membership.Until {
		t.Fatal("membership not persisted")
	}
}
