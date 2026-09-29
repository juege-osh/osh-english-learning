package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

type paymentPlan struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	AmountCents int64  `json:"amountCents"`
}

type paymentOrder struct {
	OrderNo         string `json:"orderNo"`
	PaymentNo       string `json:"paymentNo"`
	UserID          string `json:"userID"`
	Plan            string `json:"plan"`
	AmountCents     int64  `json:"amountCents"`
	Status          string `json:"status"`
	Provider        string `json:"provider"`
	PayURL          string `json:"payUrl,omitempty"`
	PlatformTradeNo string `json:"platformTradeNo,omitempty"`
	Created         int64  `json:"created"`
	Expires         int64  `json:"expires"`
}

func publicPaymentOrder(o paymentOrder) map[string]any {
	return map[string]any{"orderNo": o.OrderNo, "plan": o.Plan, "amountCents": o.AmountCents, "status": o.Status, "provider": o.Provider, "payUrl": o.PayURL, "created": o.Created, "expires": o.Expires}
}

func paymentPlans() []paymentPlan {
	if os.Getenv("ENGLISH_PAYMENT_TEST_PRICES") == "1" {
		return []paymentPlan{{"month", "月会员 · 测试价", 1}, {"year", "年会员 · 测试价", 2}, {"lifetime", "永久会员 · 测试价", 3}}
	}
	return []paymentPlan{{"month", "月会员", 300}, {"year", "年会员", 1880}, {"lifetime", "永久会员", 2880}}
}

func paymentPlanByCode(code string) (paymentPlan, bool) {
	for _, p := range paymentPlans() {
		if p.Code == code {
			return p, true
		}
	}
	return paymentPlan{}, false
}

func newPaymentNumber(prefix string) string {
	token, err := randomHex(12)
	if err != nil {
		return ""
	}
	return prefix + time.Now().UTC().Format("20060102") + token
}

func (f *features) paymentCatalog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	provider := f.paymentProvider
	if provider == "huifu" && (f.huifu == nil || f.huifu.validateConfiguration() != nil) {
		provider = "disabled"
	}
	if provider != "mock" && provider != "huifu" {
		provider = "disabled"
	}
	writeJSON(w, map[string]any{"provider": provider, "channel": "alipay", "testPrices": os.Getenv("ENGLISH_PAYMENT_TEST_PRICES") == "1", "plans": paymentPlans()})
}

func (f *features) createPayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !sameOrigin(r) {
		http.Error(w, "request denied", 403)
		return
	}
	var input struct {
		Plan string `json:"plan"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	if json.NewDecoder(r.Body).Decode(&input) != nil {
		http.Error(w, "请求格式有误", 400)
		return
	}
	plan, ok := paymentPlanByCode(input.Plan)
	if !ok {
		http.Error(w, "套餐不存在", 400)
		return
	}
	if f.paymentProvider != "mock" && f.paymentProvider != "huifu" {
		http.Error(w, "支付尚未开通", 503)
		return
	}
	if f.paymentProvider == "huifu" {
		if f.huifu == nil || f.huifu.validateConfiguration() != nil {
			http.Error(w, "支付宝通道未配置完整", 503)
			return
		}
	}
	f.mu.Lock()
	a := f.accountFromRequest(r)
	if a == nil {
		f.mu.Unlock()
		http.Error(w, "请先登录", 401)
		return
	}
	orderNo, paymentNo := newPaymentNumber("E"), newPaymentNumber("P")
	if orderNo == "" || paymentNo == "" {
		f.mu.Unlock()
		http.Error(w, "创建订单失败", 500)
		return
	}
	now := time.Now()
	order := paymentOrder{OrderNo: orderNo, PaymentNo: paymentNo, UserID: a.ID, Plan: plan.Code, AmountCents: plan.AmountCents, Status: "pending", Provider: f.paymentProvider, Created: now.Unix(), Expires: now.Add(30 * time.Minute).Unix()}
	f.data.Payments[orderNo] = order
	if err := f.save(); err != nil {
		delete(f.data.Payments, orderNo)
		f.mu.Unlock()
		http.Error(w, "保存订单失败", 500)
		return
	}
	f.mu.Unlock()
	if f.paymentProvider == "mock" {
		writeJSON(w, map[string]any{"order": publicPaymentOrder(order)})
		return
	}
	result, err := f.huifu.CreatePayment(paymentNo, "英语远征"+plan.Name, plan.AmountCents, "alipay", time.Unix(order.Expires, 0))
	if err != nil {
		http.Error(w, "支付宝下单失败，请稍后查订单状态", 502)
		return
	}
	f.mu.Lock()
	current := f.data.Payments[orderNo]
	current.PayURL = result.JumpURL
	current.PlatformTradeNo = result.PlatformTradeNo
	f.data.Payments[orderNo] = current
	if err = f.save(); err != nil {
		f.mu.Unlock()
		http.Error(w, "保存支付链接失败", 500)
		return
	}
	f.mu.Unlock()
	writeJSON(w, map[string]any{"order": publicPaymentOrder(current)})
}

func (f *features) paymentStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	f.mu.Lock()
	a := f.accountFromRequest(r)
	order, exists := f.data.Payments[r.URL.Query().Get("order")]
	f.mu.Unlock()
	if a == nil || !exists || order.UserID != a.ID {
		http.Error(w, "订单不存在", 404)
		return
	}
	if order.Status == "pending" && order.Provider == "huifu" && f.huifu != nil {
		if result, err := f.huifu.QueryPayment(order.PaymentNo, order.AmountCents); err == nil {
			if result.TransactionStatus == "S" && result.AmountCents == order.AmountCents {
				_ = f.settlePayment(order.PaymentNo, result.PlatformTradeNo, result.AmountCents)
			}
			if result.TransactionStatus == "F" {
				_ = f.failPayment(order.PaymentNo)
			}
		}
		f.mu.Lock()
		order = f.data.Payments[order.OrderNo]
		f.mu.Unlock()
	}
	writeJSON(w, map[string]any{"order": publicPaymentOrder(order)})
}

func (f *features) orderByPaymentNo(paymentNo string) (paymentOrder, bool) {
	for _, o := range f.data.Payments {
		if o.PaymentNo == paymentNo {
			return o, true
		}
	}
	return paymentOrder{}, false
}

func (f *features) settlePayment(paymentNo, tradeNo string, amount int64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	order, ok := f.orderByPaymentNo(paymentNo)
	if !ok || order.Provider != f.paymentProvider || amount != order.AmountCents || amount < 1 || tradeNo == "" {
		return errors.New("payment mismatch")
	}
	if order.Status == "success" {
		if order.PlatformTradeNo != tradeNo {
			return errors.New("transaction mismatch")
		}
		return nil
	}
	if order.Status != "pending" {
		return errors.New("payment ended")
	}
	for _, other := range f.data.Payments {
		if other.OrderNo != order.OrderNo && other.Status == "success" && other.PlatformTradeNo == tradeNo {
			return errors.New("transaction already used")
		}
	}
	previousMember := f.data.Members[order.UserID]
	m := previousMember
	base := time.Now().Unix()
	if m.Until > base {
		base = m.Until
	}
	switch order.Plan {
	case "month":
		m.Until = base + 30*86400
	case "year":
		m.Until = base + 365*86400
	case "lifetime":
		m.Lifetime = true
	default:
		return errors.New("invalid plan")
	}
	previousOrder := order
	order.Status = "success"
	order.PlatformTradeNo = tradeNo
	f.data.Members[order.UserID] = m
	f.data.Payments[order.OrderNo] = order
	if err := f.save(); err != nil {
		f.data.Members[order.UserID] = previousMember
		f.data.Payments[order.OrderNo] = previousOrder
		return err
	}
	return nil
}

func (f *features) failPayment(paymentNo string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	order, ok := f.orderByPaymentNo(paymentNo)
	if !ok {
		return errors.New("unknown payment")
	}
	if order.Status != "pending" {
		return nil
	}
	order.Status = "failed"
	f.data.Payments[order.OrderNo] = order
	return f.save()
}

func (f *features) paymentNotify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	r.Body = http.MaxBytesReader(w, r.Body, 256*1024)
	if err := r.ParseForm(); err != nil {
		http.Error(w, "FAIL", 400)
		return
	}
	raw, sign := r.Form.Get("resp_data"), r.Form.Get("sign")
	if raw == "" && sign == "" {
		fmt.Fprint(w, "success")
		return
	}
	if f.paymentProvider != "huifu" || f.huifu == nil {
		http.Error(w, "FAIL", 400)
		return
	}
	result, err := f.huifu.VerifyNotification(raw, sign)
	if err != nil {
		http.Error(w, "FAIL", 400)
		return
	}
	if result.TransactionStatus == "S" {
		if result.AmountCents < 1 || f.settlePayment(result.PaymentNo, result.PlatformTradeNo, result.AmountCents) != nil {
			http.Error(w, "FAIL", 400)
			return
		}
	} else if result.TransactionStatus == "F" {
		if f.failPayment(result.PaymentNo) != nil {
			http.Error(w, "FAIL", 400)
			return
		}
	} else {
		http.Error(w, "FAIL", 400)
		return
	}
	fmt.Fprint(w, "RECV_ORD_ID_"+result.PaymentNo)
}

func (f *features) mockPaymentSuccess(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !sameOrigin(r) || f.paymentProvider != "mock" {
		http.Error(w, "not found", 404)
		return
	}
	f.mu.Lock()
	a := f.accountFromRequest(r)
	order, ok := f.data.Payments[r.URL.Query().Get("order")]
	f.mu.Unlock()
	if a == nil || !ok || order.UserID != a.ID {
		http.Error(w, "订单不存在", 404)
		return
	}
	if err := f.settlePayment(order.PaymentNo, "MOCK-"+order.PaymentNo, order.AmountCents); err != nil {
		http.Error(w, "模拟结算失败", 409)
		return
	}
	f.mu.Lock()
	order = f.data.Payments[order.OrderNo]
	f.mu.Unlock()
	writeJSON(w, map[string]any{"order": publicPaymentOrder(order)})
}

func paymentConfigured(f *features) bool {
	return f.paymentProvider == "mock" || f.paymentProvider == "huifu" && f.huifu != nil && f.huifu.validateConfiguration() == nil
}

func paymentSummary(f *features) string {
	if !paymentConfigured(f) {
		return "disabled"
	}
	return strings.ToLower(f.paymentProvider)
}
