package main

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestMockPaymentSettlesOnceAndSurvivesRestart(t *testing.T) {
	t.Setenv("ENGLISH_PAYMENT_PROVIDER", "mock")
	t.Setenv("ENGLISH_PAYMENT_TEST_PRICES", "1")
	dir := t.TempDir()
	f, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	registerBody, _ := json.Marshal(map[string]string{"name": "buyer_1", "email": "buyer@example.com", "password": "testpass8"})
	registration := httptest.NewRecorder()
	f.accountRegister(registration, httptest.NewRequest(http.MethodPost, "/api/account/register", bytes.NewReader(registerBody)))
	if registration.Code != 200 {
		t.Fatal(registration.Body.String())
	}
	withCookies := func(method, path string, body []byte) *http.Request {
		r := httptest.NewRequest(method, path, bytes.NewReader(body))
		for _, c := range registration.Result().Cookies() {
			r.AddCookie(c)
		}
		return r
	}
	created := httptest.NewRecorder()
	f.createPayment(created, withCookies(http.MethodPost, "/api/payment/create", []byte(`{"plan":"month"}`)))
	if created.Code != 200 {
		t.Fatal(created.Body.String())
	}
	var result struct {
		Order struct {
			OrderNo     string `json:"orderNo"`
			AmountCents int64  `json:"amountCents"`
			Status      string `json:"status"`
		} `json:"order"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Order.AmountCents != 1 || result.Order.Status != "pending" {
		t.Fatal(created.Body.String())
	}
	order := f.data.Payments[result.Order.OrderNo]
	if order.UserID == "" || order.PaymentNo == "" {
		t.Fatal("order missing persistent account/payment identity")
	}
	if err := f.settlePayment(order.PaymentNo, "WRONG", 2); err == nil {
		t.Fatal("accepted mismatched amount")
	}
	path := "/api/payment/mock-success?order=" + order.OrderNo
	paid := httptest.NewRecorder()
	f.mockPaymentSuccess(paid, withCookies(http.MethodPost, path, nil))
	if paid.Code != 200 {
		t.Fatal(paid.Body.String())
	}
	until := f.data.Members[order.UserID].Until
	if until == 0 {
		t.Fatal("membership not granted")
	}
	repeated := httptest.NewRecorder()
	f.mockPaymentSuccess(repeated, withCookies(http.MethodPost, path, nil))
	if repeated.Code != 200 || f.data.Members[order.UserID].Until != until {
		t.Fatal("duplicate payment granted extra time")
	}
	f, err = newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	if f.data.Payments[order.OrderNo].Status != "success" || f.data.Members[order.UserID].Until != until {
		t.Fatal("settled payment did not persist")
	}
}

func TestSignedHuifuNotificationAndIdempotency(t *testing.T) {
	dir := t.TempDir()
	f, err := newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	f.paymentProvider = "huifu"
	f.huifu = &huifuPayClient{baseURL: "https://example.test", sysID: "sys", productID: "product", huifuID: "merchant", privateKey: key, publicKey: &key.PublicKey, notifyURL: "https://example.test/notify"}
	order := paymentOrder{OrderNo: "E20260929test", PaymentNo: "P20260929test", UserID: "visitor-test", Plan: "month", AmountCents: 1, Status: "pending", Provider: "huifu", Created: time.Now().Unix()}
	f.data.Payments[order.OrderNo] = order
	f.data.Members[order.UserID] = member{Created: time.Now().Unix()}
	if err := f.save(); err != nil {
		t.Fatal(err)
	}
	data := map[string]any{"huifu_id": "merchant", "org_req_seq_id": order.PaymentNo, "hf_seq_id": "HF-TEST-1", "trans_stat": "S", "order_stat": "1", "trans_amt": "0.01", "pay_type": "A_NATIVE"}
	raw, err := canonicalJSON(data)
	if err != nil {
		t.Fatal(err)
	}
	signature, err := signHuifuRaw(string(raw), key)
	if err != nil {
		t.Fatal(err)
	}
	notify := func(sig string) *httptest.ResponseRecorder {
		form := url.Values{"resp_data": {string(raw)}, "sign": {sig}}
		r := httptest.NewRequest(http.MethodPost, "/api/payment/notify/huifu", strings.NewReader(form.Encode()))
		r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		w := httptest.NewRecorder()
		f.paymentNotify(w, r)
		return w
	}
	if got := notify("forged"); got.Code != 400 {
		t.Fatalf("forged signature accepted: %d", got.Code)
	}
	if f.data.Members[order.UserID].Until != 0 {
		t.Fatal("forged callback granted membership")
	}
	if got := notify(signature); got.Code != 200 || got.Body.String() != "RECV_ORD_ID_"+order.PaymentNo {
		t.Fatalf("valid callback rejected: %d %s", got.Code, got.Body.String())
	}
	until := f.data.Members[order.UserID].Until
	if until == 0 {
		t.Fatal("valid callback did not grant membership")
	}
	if got := notify(signature); got.Code != 200 || f.data.Members[order.UserID].Until != until {
		t.Fatal("duplicate callback changed entitlement")
	}
	f, err = newFeatures(dir)
	if err != nil {
		t.Fatal(err)
	}
	if f.data.Members[order.UserID].Until != until || f.data.Payments[order.OrderNo].Status != "success" {
		t.Fatal("callback settlement not persisted")
	}
}

func TestHuifuPlansStayDisabledWithoutConfiguration(t *testing.T) {
	t.Setenv("ENGLISH_PAYMENT_PROVIDER", "huifu")
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	f.huifu = nil
	w := httptest.NewRecorder()
	f.paymentCatalog(w, httptest.NewRequest(http.MethodGet, "/api/payment/plans", nil))
	if w.Code != 200 || !bytes.Contains(w.Body.Bytes(), []byte(`"provider":"disabled"`)) {
		t.Fatalf("incomplete provider shown as ready: %s", w.Body.String())
	}
}
