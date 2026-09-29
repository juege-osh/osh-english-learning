package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

var followPlatforms = map[string]string{"douyin": "抖音", "kuaishou": "快手", "channels": "视频号", "xiaohongshu": "小红书", "bilibili": "B站"}

type proofApplication struct {
	ID       string `json:"id"`
	User     string `json:"user"`
	Name     string `json:"name"`
	Platform string `json:"platform"`
	Image    string `json:"-"`
	Created  int64  `json:"created"`
	Reviewed int64  `json:"reviewed,omitempty"`
	Status   string `json:"status"`
	Note     string `json:"note,omitempty"`
}
type proofStore struct {
	Applications map[string]proofApplication `json:"applications"`
}

func (f *features) loadProofs() error {
	b, e := os.ReadFile(f.proofPath)
	if e == nil {
		if e = json.Unmarshal(b, &f.proofs); e != nil {
			return e
		}
	} else if !errors.Is(e, os.ErrNotExist) {
		return e
	}
	if f.proofs.Applications == nil {
		f.proofs.Applications = map[string]proofApplication{}
	}
	return nil
}
func (f *features) saveProofs() error {
	b, e := json.Marshal(f.proofs)
	if e != nil {
		return e
	}
	return atomicJSON(f.proofPath, b)
}
func (f *features) proofMine(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	f.mu.Lock()
	a := f.accountFromRequest(r)
	items := []proofApplication{}
	if a != nil {
		for _, v := range f.proofs.Applications {
			if v.User == a.ID {
				items = append(items, v)
			}
		}
	}
	f.mu.Unlock()
	sort.Slice(items, func(i, j int) bool { return items[i].Created > items[j].Created })
	writeJSON(w, map[string]any{"items": items})
}
func (f *features) proofApply(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" || !sameOrigin(r) {
		http.Error(w, "request denied", 403)
		return
	}
	f.mu.Lock()
	a := f.accountFromRequest(r)
	if a == nil {
		f.mu.Unlock()
		http.Error(w, "请先注册并登录", 401)
		return
	}
	m := f.data.Members[a.ID]
	if active, _ := activeMember(m, time.Now().Unix()); active {
		f.mu.Unlock()
		http.Error(w, "权益仍在有效期内", 409)
		return
	}
	for _, p := range f.proofs.Applications {
		if p.User == a.ID && p.Status == "pending" {
			f.mu.Unlock()
			http.Error(w, "已有待审核申请", 409)
			return
		}
	}
	f.mu.Unlock()
	r.Body = http.MaxBytesReader(w, r.Body, 4<<20)
	if e := r.ParseMultipartForm(4 << 20); e != nil {
		http.Error(w, "截图不能超过3MB", 400)
		return
	}
	platform := r.FormValue("platform")
	if _, ok := followPlatforms[platform]; !ok {
		http.Error(w, "请选择关注平台", 400)
		return
	}
	file, _, e := r.FormFile("screenshot")
	if e != nil {
		http.Error(w, "请上传关注截图", 400)
		return
	}
	defer file.Close()
	b, e := io.ReadAll(io.LimitReader(file, (3<<20)+1))
	if e != nil || len(b) == 0 || len(b) > 3<<20 {
		http.Error(w, "截图不能超过3MB", 400)
		return
	}
	typ := http.DetectContentType(b)
	ext := ""
	if typ == "image/png" {
		ext = ".png"
	} else if typ == "image/jpeg" {
		ext = ".jpg"
	} else {
		http.Error(w, "仅支持PNG或JPEG截图", 400)
		return
	}
	cfg, _, e := image.DecodeConfig(bytes.NewReader(b))
	if e != nil || cfg.Width < 100 || cfg.Height < 100 || cfg.Width > 10000 || cfg.Height > 10000 {
		http.Error(w, "截图文件无效", 400)
		return
	}
	id, e := randomHex(16)
	if e != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	imagePath := filepath.Join(f.proofDir, id+ext)
	if e = os.WriteFile(imagePath, b, 0600); e != nil {
		http.Error(w, "storage unavailable", 500)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.accountFromRequest(r) == nil {
		os.Remove(imagePath)
		http.Error(w, "请重新登录", 401)
		return
	}
	for _, p := range f.proofs.Applications {
		if p.User == a.ID && p.Status == "pending" {
			os.Remove(imagePath)
			http.Error(w, "已有待审核申请", 409)
			return
		}
	}
	item := proofApplication{ID: id, User: a.ID, Name: a.Name, Platform: platform, Image: id + ext, Created: time.Now().Unix(), Status: "pending"}
	f.proofs.Applications[id] = item
	if e = f.saveProofs(); e != nil {
		delete(f.proofs.Applications, id)
		os.Remove(imagePath)
		http.Error(w, "storage unavailable", 500)
		return
	}
	writeJSON(w, map[string]any{"ok": true, "application": item})
}
func (f *features) requireAdmin(r *http.Request) bool {
	a := f.accountFromRequest(r)
	return a != nil && a.Admin
}
func (f *features) proofAdminList(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.requireAdmin(r) {
		http.Error(w, "forbidden", 403)
		return
	}
	items := []proofApplication{}
	for _, v := range f.proofs.Applications {
		items = append(items, v)
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Status != items[j].Status {
			return items[i].Status == "pending"
		}
		return items[i].Created > items[j].Created
	})
	writeJSON(w, map[string]any{"items": items})
}
func (f *features) proofImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	f.mu.Lock()
	if !f.requireAdmin(r) {
		f.mu.Unlock()
		http.Error(w, "forbidden", 403)
		return
	}
	p, ok := f.proofs.Applications[r.URL.Query().Get("id")]
	f.mu.Unlock()
	if !ok {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeFile(w, r, filepath.Join(f.proofDir, p.Image))
}
func (f *features) proofReview(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" || !sameOrigin(r) {
		http.Error(w, "request denied", 403)
		return
	}
	var input struct {
		ID       string `json:"id"`
		Decision string `json:"decision"`
		Note     string `json:"note"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 2048)
	if json.NewDecoder(r.Body).Decode(&input) != nil || len(input.Note) > 100 {
		http.Error(w, "请求格式有误", 400)
		return
	}
	if input.Decision != "approve" && input.Decision != "reject" {
		http.Error(w, "审核结果无效", 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.requireAdmin(r) {
		http.Error(w, "forbidden", 403)
		return
	}
	p, ok := f.proofs.Applications[input.ID]
	if !ok || p.Status != "pending" {
		http.Error(w, "申请不存在或已处理", 409)
		return
	}
	old := p
	p.Reviewed = time.Now().Unix()
	p.Note = strings.TrimSpace(input.Note)
	if input.Decision == "approve" {
		p.Status = "approved"
	} else {
		p.Status = "rejected"
	}
	f.proofs.Applications[p.ID] = p
	if e := f.saveProofs(); e != nil {
		f.proofs.Applications[p.ID] = old
		http.Error(w, "storage unavailable", 500)
		return
	}
	if p.Status == "approved" {
		m := f.data.Members[p.User]
		oldMember := m
		base := time.Now().Unix()
		if m.Until > base {
			base = m.Until
		}
		m.Until = base + 30*86400
		f.data.Members[p.User] = m
		if e := f.save(); e != nil {
			f.data.Members[p.User] = oldMember
			f.proofs.Applications[p.ID] = old
			_ = f.saveProofs()
			http.Error(w, "storage unavailable", 500)
			return
		}
	}
	writeJSON(w, map[string]any{"ok": true, "status": p.Status})
}
