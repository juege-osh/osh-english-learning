package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode/utf8"
)

type chatChannelInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

var chatChannels = []chatChannelInfo{{"lobby", "学习打卡"}, {"programmer", "程序员英语"}, {"exams", "考试备考"}, {"travel", "旅行英语"}, {"ideas", "网站建议"}}

type chatMessage struct {
	ID      string   `json:"id"`
	Channel string   `json:"channel"`
	User    string   `json:"user"`
	Name    string   `json:"name"`
	Text    string   `json:"text"`
	At      int64    `json:"at"`
	Hidden  bool     `json:"hidden"`
	Reports []string `json:"reports"`
}
type chatPublicMessage struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Text string `json:"text"`
	At   int64  `json:"at"`
	Own  bool   `json:"own"`
}
type chatStore struct {
	Messages map[string][]chatMessage `json:"messages"`
	Blocks   map[string][]string      `json:"blocks"`
	Last     map[string]int64         `json:"last"`
}

func chatChannel(id string) bool {
	for _, c := range chatChannels {
		if c.ID == id {
			return true
		}
	}
	return false
}
func (f *features) loadChat() error {
	b, e := os.ReadFile(f.chatPath)
	if e == nil {
		if e = json.Unmarshal(b, &f.chat); e != nil {
			return e
		}
	} else if !errors.Is(e, os.ErrNotExist) {
		return e
	}
	if f.chat.Messages == nil {
		f.chat.Messages = map[string][]chatMessage{}
	}
	if f.chat.Blocks == nil {
		f.chat.Blocks = map[string][]string{}
	}
	if f.chat.Last == nil {
		f.chat.Last = map[string]int64{}
	}
	return nil
}
func (f *features) saveChat() error {
	b, e := json.Marshal(f.chat)
	if e != nil {
		return e
	}
	return atomicJSON(f.chatPath, b)
}
func (f *features) chatList(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	channel := r.URL.Query().Get("channel")
	if !chatChannel(channel) {
		channel = "lobby"
	}
	f.mu.Lock()
	a := f.accountFromRequest(r)
	block := map[string]bool{}
	if a != nil {
		for _, id := range f.chat.Blocks[a.ID] {
			block[id] = true
		}
	}
	items := []chatPublicMessage{}
	for _, m := range f.chat.Messages[channel] {
		if !m.Hidden && !block[m.User] {
			items = append(items, chatPublicMessage{ID: m.ID, Name: m.Name, Text: m.Text, At: m.At, Own: a != nil && a.ID == m.User})
		}
	}
	f.mu.Unlock()
	if len(items) > 80 {
		items = items[len(items)-80:]
	}
	writeJSON(w, map[string]any{"channels": chatChannels, "channel": channel, "registered": a != nil, "admin": a != nil && a.Admin, "items": items})
}
func (f *features) chatPost(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" || !sameOrigin(r) {
		http.Error(w, "request denied", 403)
		return
	}
	var input struct {
		Channel string `json:"channel"`
		Text    string `json:"text"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 2048)
	if json.NewDecoder(r.Body).Decode(&input) != nil || !chatChannel(input.Channel) {
		http.Error(w, "请求格式有误", 400)
		return
	}
	input.Text = strings.TrimSpace(input.Text)
	if utf8.RuneCountInString(input.Text) < 2 || utf8.RuneCountInString(input.Text) > 400 || strings.Contains(input.Text, "http://") || strings.Contains(input.Text, "https://") {
		http.Error(w, "消息需2–400字，频道内暂不支持链接", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	a := f.accountFromRequest(r)
	if a == nil {
		http.Error(w, "请先注册并登录", 401)
		return
	}
	now := time.Now().Unix()
	if now-f.chat.Last[a.ID] < 10 {
		http.Error(w, "发得有点快，10秒后再试", 429)
		return
	}
	id, e := randomHex(12)
	if e != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	m := chatMessage{ID: id, Channel: input.Channel, User: a.ID, Name: a.Name, Text: input.Text, At: now, Reports: []string{}}
	f.chat.Messages[input.Channel] = append(f.chat.Messages[input.Channel], m)
	if len(f.chat.Messages[input.Channel]) > 1000 {
		f.chat.Messages[input.Channel] = f.chat.Messages[input.Channel][len(f.chat.Messages[input.Channel])-1000:]
	}
	f.chat.Last[a.ID] = now
	if e = f.saveChat(); e != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}
func (f *features) chatReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" || !sameOrigin(r) {
		http.Error(w, "request denied", 403)
		return
	}
	var input struct {
		ID      string `json:"id"`
		Channel string `json:"channel"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	if json.NewDecoder(r.Body).Decode(&input) != nil || !chatChannel(input.Channel) {
		http.Error(w, "请求格式有误", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	a := f.accountFromRequest(r)
	if a == nil {
		http.Error(w, "请先登录", 401)
		return
	}
	for i, m := range f.chat.Messages[input.Channel] {
		if m.ID == input.ID {
			if m.User == a.ID {
				http.Error(w, "不能举报自己的消息", 400)
				return
			}
			for _, id := range m.Reports {
				if id == a.ID {
					writeJSON(w, map[string]any{"ok": true})
					return
				}
			}
			m.Reports = append(m.Reports, a.ID)
			if len(m.Reports) >= 3 {
				m.Hidden = true
			}
			f.chat.Messages[input.Channel][i] = m
			if e := f.saveChat(); e != nil {
				http.Error(w, "storage unavailable", 500)
				return
			}
			writeJSON(w, map[string]any{"ok": true})
			return
		}
	}
	http.NotFound(w, r)
}
func (f *features) chatBlock(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" || !sameOrigin(r) {
		http.Error(w, "request denied", 403)
		return
	}
	var input struct {
		ID      string `json:"id"`
		Channel string `json:"channel"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	if json.NewDecoder(r.Body).Decode(&input) != nil || !chatChannel(input.Channel) {
		http.Error(w, "请求格式有误", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	a := f.accountFromRequest(r)
	if a == nil {
		http.Error(w, "请先登录", 401)
		return
	}
	for _, m := range f.chat.Messages[input.Channel] {
		if m.ID == input.ID && m.User != a.ID {
			for _, id := range f.chat.Blocks[a.ID] {
				if id == m.User {
					writeJSON(w, map[string]any{"ok": true})
					return
				}
			}
			f.chat.Blocks[a.ID] = append(f.chat.Blocks[a.ID], m.User)
			if e := f.saveChat(); e != nil {
				http.Error(w, "storage unavailable", 500)
				return
			}
			writeJSON(w, map[string]any{"ok": true})
			return
		}
	}
	http.NotFound(w, r)
}
func (f *features) chatModerate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" || !sameOrigin(r) {
		http.Error(w, "request denied", 403)
		return
	}
	var input struct {
		ID      string `json:"id"`
		Channel string `json:"channel"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	if json.NewDecoder(r.Body).Decode(&input) != nil || !chatChannel(input.Channel) {
		http.Error(w, "请求格式有误", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.requireAdmin(r) {
		http.Error(w, "forbidden", 403)
		return
	}
	for i, m := range f.chat.Messages[input.Channel] {
		if m.ID == input.ID {
			m.Hidden = true
			f.chat.Messages[input.Channel][i] = m
			if e := f.saveChat(); e != nil {
				http.Error(w, "storage unavailable", 500)
				return
			}
			writeJSON(w, map[string]any{"ok": true})
			return
		}
	}
	http.NotFound(w, r)
}
