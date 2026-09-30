package main

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

type communitySettings struct {
	FollowLinks       map[string]string `json:"followLinks"`
	GroupContact      string            `json:"groupContact"`
	GroupInstructions string            `json:"groupInstructions"`
}

func (f *features) communityInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	info := f.data.Community
	a := f.accountFromRequest(r)
	allowed := false
	if a != nil {
		active, _ := activeMember(f.data.Members[a.ID], time.Now().Unix())
		allowed = a.Admin || active
	}
	if !allowed {
		info.GroupContact = ""
		info.GroupInstructions = ""
	}
	if info.FollowLinks == nil {
		info.FollowLinks = map[string]string{}
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, map[string]any{"settings": info, "groupAccess": allowed})
}

func (f *features) communityUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !sameOrigin(r) || r.Header.Get("Content-Type") != "application/json" {
		http.Error(w, "request denied", 403)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.requireAdmin(r) {
		http.Error(w, "只有站长能修改社区信息", 403)
		return
	}
	var input communitySettings
	r.Body = http.MaxBytesReader(w, r.Body, 8192)
	if json.NewDecoder(r.Body).Decode(&input) != nil {
		http.Error(w, "填写内容有误", 400)
		return
	}
	input.GroupContact = strings.TrimSpace(input.GroupContact)
	input.GroupInstructions = strings.TrimSpace(input.GroupInstructions)
	if utf8.RuneCountInString(input.GroupContact) > 64 || utf8.RuneCountInString(input.GroupInstructions) > 1000 || len(input.FollowLinks) > len(followPlatforms) {
		http.Error(w, "入群联系信息最多64字，说明最多1000字", 400)
		return
	}
	cleaned := map[string]string{}
	for platform, raw := range input.FollowLinks {
		if _, ok := followPlatforms[platform]; !ok {
			http.Error(w, "不支持的平台", 400)
			return
		}
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		u, err := url.Parse(raw)
		if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || len(raw) > 1000 {
			http.Error(w, "主页链接需使用完整的 HTTPS 地址", 400)
			return
		}
		cleaned[platform] = u.String()
	}
	input.FollowLinks = cleaned
	previous := f.data.Community
	f.data.Community = input
	if err := f.save(); err != nil {
		f.data.Community = previous
		http.Error(w, "保存失败，请重试", 500)
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}
