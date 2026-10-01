package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	maxStudyBytes   = 6 << 20
	maxStudyEntries = 30000
	maxStudyDepth   = 64
	maxStudyInteger = 9007199254740991
	maxStudyBody    = maxStudyBytes + (64 << 10)
)

type cloudStudy struct {
	Owner    string          `json:"owner"`
	Revision int64           `json:"revision"`
	Updated  int64           `json:"updated"`
	Study    json.RawMessage `json:"study"`
}

func (f *features) studyPath(id string) string {
	return filepath.Join(f.progressDir, "study-"+id+".json")
}

// This store is separate from ranked progress and shares its account/session rules.
func (f *features) studyForAccount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		w.Header().Set("Allow", "GET, POST")
		studyError(w, "", "不支持此请求方式", http.StatusMethodNotAllowed)
		return
	}
	if !sameOrigin(r) {
		studyError(w, "", "请求来源不受支持", http.StatusForbidden)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	a := f.accountFromRequest(r)
	if a == nil {
		studyError(w, "", "请先登录", http.StatusUnauthorized)
		return
	}
	expectedOwner := r.Header.Get("X-Study-Owner")
	if (r.Method == http.MethodPost && expectedOwner == "") || (expectedOwner != "" && expectedOwner != a.ID) {
		studyError(w, a.ID, "登录状态已变化，请刷新后重试", http.StatusForbidden)
		return
	}
	current := cloudStudy{Owner: a.ID, Study: json.RawMessage(`{"version":1,"entries":{}}`)}
	path := f.studyPath(a.ID)
	file, err := os.Open(path)
	if err == nil {
		current = cloudStudy{}
		b, readErr := io.ReadAll(io.LimitReader(file, maxStudyBody+1))
		closeErr := file.Close()
		if readErr != nil || closeErr != nil || len(b) > maxStudyBody || json.Unmarshal(b, &current) != nil || current.Owner != a.ID || current.Revision <= 0 || current.Revision > maxStudyInteger || !validStudyDocument(current.Study) {
			studyError(w, a.ID, "学习资料暂时无法读取", http.StatusInternalServerError)
			return
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		studyError(w, a.ID, "学习资料暂时无法读取", http.StatusInternalServerError)
		return
	}
	if r.Method == http.MethodGet {
		writeStudyJSON(w, current)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxStudyBody)
	var input struct {
		Revision *int64          `json:"revision"`
		Updated  json.RawMessage `json:"updated,omitempty"`
		Study    json.RawMessage `json:"study"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	decodeErr := decoder.Decode(&input)
	var extra any
	if decodeErr != nil || decoder.Decode(&extra) != io.EOF || input.Revision == nil || *input.Revision < 0 || *input.Revision > maxStudyInteger || !validStudyDocument(input.Study) {
		studyError(w, a.ID, "学习资料格式有误或内容过多", http.StatusBadRequest)
		return
	}
	if *input.Revision != current.Revision {
		studyError(w, a.ID, "学习资料已在其他设备更新，请刷新后重试", http.StatusConflict)
		return
	}
	if current.Revision == maxStudyInteger {
		studyError(w, a.ID, "学习资料版本已达到上限", http.StatusConflict)
		return
	}
	// Compact the incoming document so formatting whitespace never accumulates on disk.
	var compact bytes.Buffer
	if json.Compact(&compact, input.Study) != nil {
		studyError(w, a.ID, "学习资料格式有误", http.StatusBadRequest)
		return
	}
	current = cloudStudy{Owner: a.ID, Revision: current.Revision + 1, Updated: time.Now().Unix(), Study: compact.Bytes()}
	var saved bytes.Buffer
	encoder := json.NewEncoder(&saved)
	encoder.SetEscapeHTML(false)
	err = encoder.Encode(current)
	if err != nil || saved.Len() > maxStudyBody || atomicJSON(path, saved.Bytes()) != nil {
		studyError(w, a.ID, "学习资料保存失败", http.StatusInternalServerError)
		return
	}
	writeStudyJSON(w, current)
}

func studyError(w http.ResponseWriter, owner, message string, status int) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"owner": owner, "error": message})
}

func writeStudyJSON(w http.ResponseWriter, v cloudStudy) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	encoder := json.NewEncoder(w)
	encoder.SetEscapeHTML(false)
	encoder.Encode(v)
}

func studySafeProperty(key string) bool {
	return key != "__proto__" && key != "constructor" && key != "prototype"
}

func validStudyKey(key string) bool {
	if len(key) > 256 || !utf8.ValidString(key) {
		return false
	}
	allowed := false
	for _, prefix := range []string{"book:", "word:", "sentence:", "day:", "error:", "setting:"} {
		if strings.HasPrefix(key, prefix) && len(key) > len(prefix) {
			allowed = true
			break
		}
	}
	if !allowed || (strings.HasPrefix(key, "setting:") && !studySettingName(strings.TrimPrefix(key, "setting:"))) {
		return false
	}
	for _, c := range key {
		if c < 32 || c == 127 {
			return false
		}
	}
	for _, segment := range strings.FieldsFunc(key, func(c rune) bool { return c == ':' || c == '.' || c == '/' || c == '\\' }) {
		if !studySafeProperty(segment) {
			return false
		}
	}
	return true
}

func studyNumber(value any) (float64, bool) {
	n, ok := value.(json.Number)
	if !ok {
		return 0, false
	}
	f, err := strconv.ParseFloat(string(n), 64)
	return f, err == nil && !math.IsNaN(f) && !math.IsInf(f, 0)
}

func studyInteger(value any) bool {
	n, ok := studyNumber(value)
	return ok && n >= 0 && n <= maxStudyInteger && math.Trunc(n) == n
}

func validStudyDocument(raw json.RawMessage) bool {
	if len(raw) == 0 || len(raw) > maxStudyBody {
		return false
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var doc map[string]any
	if decoder.Decode(&doc) != nil || doc == nil || len(doc) != 2 {
		return false
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return false
	}
	version, versionOK := studyNumber(doc["version"])
	entries, entriesOK := doc["entries"].(map[string]any)
	if !versionOK || version != 1 || !entriesOK || entries == nil || len(entries) > maxStudyEntries {
		return false
	}
	nodes := 0
	for key, value := range entries {
		if !validStudyKey(key) {
			return false
		}
		record, ok := studyFields(value, "at", "value", "deleted")
		if !ok || !studyInteger(record["at"]) {
			return false
		}
		deleted, ok := record["deleted"].(bool)
		if !ok {
			return false
		}
		v, present := record["value"]
		if present && !studyJSONValue(v, 0, &nodes) {
			return false
		}
		if !deleted && (!present || !studyBusinessValue(key, v)) {
			return false
		}
	}
	return studyJSONSize(doc) <= maxStudyBytes
}

func studyFields(value any, names ...string) (map[string]any, bool) {
	object, ok := value.(map[string]any)
	if !ok || object == nil {
		return nil, false
	}
	for key := range object {
		found := false
		for _, name := range names {
			if key == name {
				found = true
				break
			}
		}
		if !found {
			return nil, false
		}
	}
	return object, true
}

func studyText(value any, max int, required bool) bool {
	s, ok := value.(string)
	if !ok {
		return false
	}
	n := 0
	for _, c := range s {
		n++
		if c > 0xffff {
			n++
		}
	}
	if n > max {
		return false
	}
	if required {
		s = strings.TrimFunc(s, func(c rune) bool {
			return c == ' ' || (c >= '\t' && c <= '\r') || c == 0xa0 || c == 0x1680 || (c >= 0x2000 && c <= 0x200a) || c == 0x2028 || c == 0x2029 || c == 0x202f || c == 0x205f || c == 0x3000 || c == 0xfeff
		})
		if s == "" {
			return false
		}
	}
	return true
}

func studyNonnegative(value any) bool { n, ok := studyNumber(value); return ok && n >= 0 }
func studyStringOption(value any, options ...string) bool {
	s, ok := value.(string)
	if !ok {
		return false
	}
	for _, option := range options {
		if s == option {
			return true
		}
	}
	return false
}
func studyKind(value any) bool { return studyStringOption(value, "word", "sentence") }
func studyItem(value any, kind string) bool {
	item, ok := studyFields(value, "id", "en", "zh")
	if !ok || len(item) != 3 || !studyText(item["id"], 240, true) {
		return false
	}
	id, _ := item["id"].(string)
	maxEn := 200
	if kind == "sentence" {
		maxEn = 2000
	}
	return validStudyKey(kind+":"+id) && studyText(item["en"], maxEn, true) && studyText(item["zh"], 2000, false)
}
func studySettingName(name string) bool {
	return studyStringOption(name, "theme", "accent", "speechRate", "rate", "loops", "repeat", "sort", "translation", "shuffle", "view", "batchSize", "practiceMode", "practiceDelay")
}
func studySetting(name string, value any) bool {
	switch name {
	case "theme":
		return studyStringOption(value, "light", "dark", "system")
	case "accent":
		return studyStringOption(value, "en-US", "en-GB", "en-AU")
	case "sort":
		return studyStringOption(value, "original", "az", "za", "recent")
	case "view":
		return studyStringOption(value, "list", "grid")
	case "practiceMode":
		return studyStringOption(value, "slow", "fast", "delay")
	case "translation", "shuffle":
		_, ok := value.(bool)
		return ok
	case "speechRate", "rate":
		n, ok := studyNumber(value)
		return ok && n >= .5 && n <= 1.5
	case "loops", "repeat":
		n, ok := studyNumber(value)
		return ok && (n == 1 || n == 3)
	case "batchSize":
		n, ok := studyNumber(value)
		return ok && math.Trunc(n) == n && n >= 5 && n <= 100
	case "practiceDelay":
		n, ok := studyNumber(value)
		return ok && math.Trunc(n) == n && n >= 1 && n <= 30
	}
	return false
}
func studyBusinessValue(key string, value any) bool {
	kind, name, _ := strings.Cut(key, ":")
	switch kind {
	case "setting":
		return studySetting(name, value)
	case "book":
		book, ok := studyFields(value, "name", "kind", "category", "description", "items")
		if !ok || !studyText(book["name"], 80, true) || !studyKind(book["kind"]) {
			return false
		}
		if category, present := book["category"]; present && !studyText(category, 60, false) {
			return false
		}
		if description, present := book["description"]; present && !studyText(description, 500, false) {
			return false
		}
		items, ok := book["items"].([]any)
		if !ok || len(items) < 1 || len(items) > 2000 {
			return false
		}
		for _, item := range items {
			if !studyItem(item, book["kind"].(string)) {
				return false
			}
		}
		return true
	case "word", "sentence":
		r, ok := studyFields(value, "item", "favorite", "recognition", "note", "first", "last", "seen", "wrong")
		if !ok || !studyItem(r["item"], kind) {
			return false
		}
		if favorite, present := r["favorite"]; present {
			if _, ok := favorite.(bool); !ok {
				return false
			}
		}
		if recognition, present := r["recognition"]; present && !studyStringOption(recognition, "known", "fuzzy", "unknown") {
			return false
		}
		if note, present := r["note"]; present && !studyText(note, 2000, false) {
			return false
		}
		for _, field := range []string{"first", "last", "seen", "wrong"} {
			if n, present := r[field]; present && !studyNonnegative(n) {
				return false
			}
		}
		return true
	case "day":
		r, ok := studyFields(value, "kind", "item", "at", "correct")
		if !ok || len(r) != 4 || !studyKind(r["kind"]) || !studyItem(r["item"], r["kind"].(string)) || !studyNonnegative(r["at"]) {
			return false
		}
		if r["correct"] == nil {
			return true
		}
		_, ok = r["correct"].(bool)
		return ok
	case "error":
		r, ok := studyFields(value, "kind", "item", "typed", "at", "count", "resolved")
		if !ok || len(r) != 6 || !studyKind(r["kind"]) || !studyItem(r["item"], r["kind"].(string)) || !studyText(r["typed"], 2000, false) || !studyNonnegative(r["at"]) || !studyNonnegative(r["count"]) {
			return false
		}
		_, ok = r["resolved"].(bool)
		return ok
	}
	return false
}

func studyJSONValue(value any, depth int, nodes *int) bool {
	*nodes++
	if *nodes > 1000000 || depth > maxStudyDepth {
		return false
	}
	switch v := value.(type) {
	case nil, bool, string:
		return true
	case json.Number:
		_, ok := studyNumber(v)
		return ok
	case []any:
		for _, child := range v {
			if !studyJSONValue(child, depth+1, nodes) {
				return false
			}
		}
		return true
	case map[string]any:
		for key, child := range v {
			if !studySafeProperty(key) || !studyJSONValue(child, depth+1, nodes) {
				return false
			}
		}
		return true
	default:
		return false
	}
}

// Count the UTF-8 JSON size using browser JSON.stringify rules, including its
// unescaped Unicode and fixed notation for numbers in [1e-6, 1e21).
func studyJSONStringSize(s string) int {
	n := 2
	for _, c := range s {
		switch c {
		case '"', '\\', '\b', '\f', '\n', '\r', '\t':
			n += 2
		default:
			if c < 32 {
				n += 6
			} else {
				n += utf8.RuneLen(c)
			}
		}
	}
	return n
}

func studyJSONSize(value any) int {
	switch v := value.(type) {
	case nil:
		return 4
	case bool:
		if v {
			return 4
		}
		return 5
	case string:
		return studyJSONStringSize(v)
	case json.Number:
		n, _ := studyNumber(v)
		if n == 0 {
			return 1
		}
		abs := math.Abs(n)
		if abs >= 1e-6 && abs < 1e21 {
			return len(strconv.FormatFloat(n, 'f', -1, 64))
		}
		s := strconv.FormatFloat(n, 'e', -1, 64)
		// Go pads small exponents with zero; JavaScript does not.
		s = strings.Replace(s, "e-0", "e-", 1)
		s = strings.Replace(s, "e+0", "e+", 1)
		return len(s)
	case []any:
		n := 2
		for i, child := range v {
			if i > 0 {
				n++
			}
			n += studyJSONSize(child)
			if n > maxStudyBytes {
				return n
			}
		}
		return n
	case map[string]any:
		n, i := 2, 0
		for key, child := range v {
			if i > 0 {
				n++
			}
			i++
			n += studyJSONStringSize(key) + 1 + studyJSONSize(child)
			if n > maxStudyBytes {
				return n
			}
		}
		return n
	default:
		return maxStudyBytes + 1
	}
}
