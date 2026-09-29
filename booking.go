package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode/utf8"
)

type booking struct {
	ID        string `json:"id"`
	Visitor   string `json:"visitor,omitempty"`
	Name      string `json:"name"`
	Contact   string `json:"contact"`
	Preferred string `json:"preferred"`
	Zone      string `json:"zone"`
	Topic     string `json:"topic"`
	Created   int64  `json:"created"`
	Status    string `json:"status"`
	Confirmed string `json:"confirmed,omitempty"`
}

func (f *features) bookings() ([]booking, error) {
	names, err := os.ReadDir(f.bookingDir)
	if err != nil {
		return nil, err
	}
	items := make([]booking, 0, len(names))
	for _, name := range names {
		if name.IsDir() || strings.Contains(name.Name(), ".") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(f.bookingDir, name.Name()))
		if err != nil {
			return nil, err
		}
		var item booking
		if json.Unmarshal(b, &item) == nil {
			items = append(items, item)
		}
	}
	return items, nil
}
func (f *features) saveBooking(b booking) error {
	data, err := json.Marshal(b)
	if err != nil {
		return err
	}
	path := filepath.Join(f.bookingDir, b.ID)
	tmp := path + ".tmp"
	if err = os.WriteFile(tmp, data, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
func validBooking(b booking) bool {
	if utf8.RuneCountInString(b.Name) < 1 || utf8.RuneCountInString(b.Name) > 16 || utf8.RuneCountInString(b.Contact) < 2 || utf8.RuneCountInString(b.Contact) > 64 || utf8.RuneCountInString(b.Topic) < 4 || utf8.RuneCountInString(b.Topic) > 300 {
		return false
	}
	if b.Zone != "Asia/Shanghai" && b.Zone != "Asia/Ho_Chi_Minh" && b.Zone != "Other" {
		return false
	}
	if len(b.Preferred) != 16 {
		return false
	}
	_, err := time.Parse("2006-01-02T15:04", b.Preferred)
	return err == nil
}
func activeMember(m member, now int64) (bool, bool) {
	paid := m.Lifetime || m.Until > now
	return paid || m.LegacyTrialUntil > now, paid
}
func (f *features) bookingMine(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	f.mu.Lock()
	a := f.accountFromRequest(r)
	if a == nil {
		f.mu.Unlock()
		writeJSON(w, map[string]any{"items": []booking{}})
		return
	}
	id := a.ID
	items, err := f.bookings()
	f.mu.Unlock()
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	own := make([]booking, 0)
	for _, item := range items {
		if item.Visitor == id {
			item.Visitor = ""
			own = append(own, item)
		}
	}
	sort.Slice(own, func(i, j int) bool { return own[i].Created > own[j].Created })
	writeJSON(w, map[string]any{"items": own})
}
func (f *features) bookingCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" || r.Header.Get("Content-Type") != "application/json" || !sameOrigin(r) {
		http.Error(w, "JSON POST required", 405)
		return
	}
	f.mu.Lock()
	a := f.accountFromRequest(r)
	if a == nil {
		f.mu.Unlock()
		http.Error(w, "请先登录", 401)
		return
	}
	id, m := a.ID, f.data.Members[a.ID]
	f.mu.Unlock()
	if allowed, _ := activeMember(m, time.Now().Unix()); !allowed {
		http.Error(w, "请先申请并通过免费权益审核", 403)
		return
	}
	var item booking
	r.Body = http.MaxBytesReader(w, r.Body, 2048)
	if json.NewDecoder(r.Body).Decode(&item) != nil {
		http.Error(w, "invalid JSON", 400)
		return
	}
	item.Name = strings.TrimSpace(item.Name)
	item.Contact = strings.TrimSpace(item.Contact)
	item.Topic = strings.TrimSpace(item.Topic)
	if !validBooking(item) {
		http.Error(w, "请完整填写姓名、微信、时间和话题", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	existing, err := f.bookings()
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	pending := 0
	for _, v := range existing {
		if v.Visitor == id && v.Status == "pending" {
			pending++
		}
	}
	if pending >= 3 {
		http.Error(w, "已有3条待确认预约，请等站长处理", 429)
		return
	}
	item.ID, err = randomCode()
	if err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	item.Visitor = id
	item.Created = time.Now().Unix()
	item.Status = "pending"
	if err = f.saveBooking(item); err != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	item.Visitor = ""
	writeJSON(w, map[string]any{"ok": true, "booking": item})
}
func (f *features) listBookingsAdmin() error {
	items, err := f.bookings()
	if err != nil {
		return err
	}
	now := time.Now().Unix()
	sort.Slice(items, func(i, j int) bool {
		if items[i].Status != items[j].Status {
			return items[i].Status == "pending"
		}
		_, pi := activeMember(f.data.Members[items[i].Visitor], now)
		_, pj := activeMember(f.data.Members[items[j].Visitor], now)
		if pi != pj {
			return pi
		}
		return items[i].Created < items[j].Created
	})
	for _, item := range items {
		_, paid := activeMember(f.data.Members[item.Visitor], now)
		tier := "旧版体验"
		if paid {
			tier = "已审核"
		}
		fmt.Printf("%s  %s  %s  %s  %s  %s  %s  %s\n", tier, item.ID, item.Status, item.Preferred, item.Zone, item.Name, item.Contact, item.Topic)
	}
	return nil
}
func (f *features) confirmBooking(id, when string) error {
	if id == "" || strings.ContainsAny(id, "/\\.") || when == "" {
		return errors.New("booking id and confirmed time required")
	}
	path := filepath.Join(f.bookingDir, id)
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var item booking
	if err = json.Unmarshal(data, &item); err != nil {
		return err
	}
	if item.Status != "pending" {
		return errors.New("booking is not pending")
	}
	item.Status = "confirmed"
	item.Confirmed = when
	return f.saveBooking(item)
}
