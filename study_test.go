package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func studyTestFeatures(t *testing.T) (*features, *http.Cookie, *http.Cookie) {
	t.Helper()
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"alice", "bob"} {
		f.auth.Users[name] = account{ID: name + "-study", Name: name}
		f.auth.Sessions[tokenHash("study-test-"+name)] = loginSession{User: name, Until: time.Now().Unix() + 3600}
	}
	return f, &http.Cookie{Name: "eq_session", Value: "study-test-alice"}, &http.Cookie{Name: "eq_session", Value: "study-test-bob"}
}

func studyTestRequest(f *features, method, url, body, origin string, cookie *http.Cookie) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, url, strings.NewReader(body))
	if cookie != nil {
		r.AddCookie(cookie)
		if a := f.accountFromRequest(r); a != nil {
			r.Header.Set("X-Study-Owner", a.ID)
		}
	}
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	w := httptest.NewRecorder()
	f.studyForAccount(w, r)
	return w
}

func studyTestBody(revision int64, doc string) string {
	return fmt.Sprintf(`{"revision":%d,"study":%s}`, revision, doc)
}

func studyTestDocument(value any) string {
	if note, ok := value.(string); ok {
		value = map[string]any{"item": studyTestItem("hello", "1", "你好"), "note": note}
	}
	return studyTestKeyDocument("word:1", value, false)
}
func studyTestItem(en, id, zh string) map[string]any {
	return map[string]any{"id": id, "en": en, "zh": zh}
}
func studyTestKeyDocument(key string, value any, deleted bool) string {
	b, _ := json.Marshal(map[string]any{"version": 1, "entries": map[string]any{key: map[string]any{"at": 1234567890, "value": value, "deleted": deleted}}})
	return string(b)
}
func studyTestSizedDocument(limit int) []byte {
	entries := map[string]any{}
	doc := map[string]any{"version": 1, "entries": entries}
	b, _ := json.Marshal(doc)
	n, i := len(b), 0
	for n < limit {
		key := fmt.Sprintf("word:%d", i)
		value := map[string]any{"item": studyTestItem("hello", fmt.Sprint(i), ""), "note": ""}
		record := map[string]any{"at": 0, "value": value, "deleted": false}
		keyBytes, _ := json.Marshal(key)
		recordBytes, _ := json.Marshal(record)
		base := len(keyBytes) + 1 + len(recordBytes)
		if i > 0 {
			base++
		}
		left := limit - n
		if left < base {
			previous := entries[fmt.Sprintf("word:%d", i-1)].(map[string]any)["value"].(map[string]any)
			note := previous["note"].(string)
			previous["note"] = note[:len(note)-(base-left)]
			b, _ = json.Marshal(doc)
			n = len(b)
			left = limit - n
		}
		fill := min(4000, left-base)
		value["item"].(map[string]any)["zh"] = strings.Repeat("x", min(2000, fill))
		value["note"] = strings.Repeat("x", max(0, fill-2000))
		entries[key] = record
		n += base + fill
		i++
	}
	b, _ = json.Marshal(doc)
	return b
}

func TestStudyAccountAuthorizationIsolationAndRevision(t *testing.T) {
	f, alice, bob := studyTestFeatures(t)
	for _, method := range []string{"GET", "POST"} {
		if w := studyTestRequest(f, method, "/api/study", "", "", nil); w.Code != http.StatusUnauthorized {
			t.Fatalf("guest %s: %d", method, w.Code)
		}
		if w := studyTestRequest(f, method, "/api/study", "", "https://evil.example", alice); w.Code != http.StatusForbidden {
			t.Fatalf("cross-origin %s: %d", method, w.Code)
		}
	}
	if w := studyTestRequest(f, "DELETE", "/api/study", "", "", alice); w.Code != http.StatusMethodNotAllowed || w.Header().Get("Allow") != "GET, POST" {
		t.Fatalf("method: %d", w.Code)
	}
	empty := studyTestRequest(f, "GET", "/api/study", "", "http://example.com", alice)
	var initial cloudStudy
	if empty.Code != http.StatusOK || json.Unmarshal(empty.Body.Bytes(), &initial) != nil || initial.Owner != "alice-study" || initial.Revision != 0 || !validStudyDocument(initial.Study) {
		t.Fatalf("initial: %d %s", empty.Code, empty.Body.String())
	}
	if empty.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("account data must not be cached")
	}
	progress := []byte(`{"existing":"ranked progress"}`)
	if err := os.WriteFile(f.progressPath("alice-study"), progress, 0600); err != nil {
		t.Fatal(err)
	}
	doc := studyTestDocument(map[string]any{"item": studyTestItem("hello", "1", "你好"), "recognition": "known"})
	body := studyTestBody(0, doc)
	first := studyTestRequest(f, "POST", "/api/study", body, "http://example.com", alice)
	var saved cloudStudy
	if first.Code != http.StatusOK || json.Unmarshal(first.Body.Bytes(), &saved) != nil || saved.Owner != "alice-study" || saved.Revision != 1 || saved.Updated <= 0 || !bytes.Equal(saved.Study, []byte(doc)) {
		t.Fatalf("save: %d %s", first.Code, first.Body.String())
	}
	if w := studyTestRequest(f, "POST", "/api/study", body, "", alice); w.Code != http.StatusConflict {
		t.Fatalf("stale write: %d %s", w.Code, w.Body.String())
	}
	// A client-supplied account query cannot select someone else's data.
	other := studyTestRequest(f, "GET", "/api/study?account=alice-study", "", "", bob)
	var bobDoc cloudStudy
	if json.Unmarshal(other.Body.Bytes(), &bobDoc) != nil || bobDoc.Owner != "bob-study" || bobDoc.Revision != 0 || string(bobDoc.Study) != `{"version":1,"entries":{}}` {
		t.Fatalf("isolation: %s", other.Body.String())
	}
	if w := studyTestRequest(f, "POST", "/api/study", studyTestBody(0, studyTestDocument("bob only")), "", bob); w.Code != http.StatusOK {
		t.Fatalf("bob save: %d", w.Code)
	}
	if info, err := os.Stat(f.studyPath("alice-study")); err != nil || info.Mode().Perm() != 0600 {
		t.Fatalf("private file: %v %v", info, err)
	}
	if _, err := os.Stat(f.studyPath("alice-study") + ".tmp"); !os.IsNotExist(err) {
		t.Fatal("atomic write left a temporary file")
	}
	actual, err := os.ReadFile(f.progressPath("alice-study"))
	if err != nil || !bytes.Equal(actual, progress) {
		t.Fatal("study write changed ranked progress")
	}
	// Confirm the record survives a new server instance using the same files.
	if err := f.saveAuth(); err != nil {
		t.Fatal(err)
	}
	reloaded, err := newFeatures(filepath.Dir(f.progressDir))
	if err != nil {
		t.Fatal(err)
	}
	read := studyTestRequest(reloaded, "GET", "/api/study", "", "", alice)
	var persisted cloudStudy
	if read.Code != http.StatusOK || json.Unmarshal(read.Body.Bytes(), &persisted) != nil || persisted.Owner != "alice-study" || persisted.Revision != 1 || !bytes.Equal(persisted.Study, []byte(doc)) {
		t.Fatalf("reload: %d %s", read.Code, read.Body.String())
	}
	f.auth.Sessions[tokenHash(alice.Value)] = loginSession{User: "alice", Until: time.Now().Unix() - 1}
	if w := studyTestRequest(f, "GET", "/api/study", "", "", alice); w.Code != http.StatusUnauthorized {
		t.Fatalf("expired session: %d", w.Code)
	}
}

func TestStudyRejectsInvalidDocumentsAndPreservesSavedData(t *testing.T) {
	f, alice, _ := studyTestFeatures(t)
	valid := studyTestDocument("retained")
	if w := studyTestRequest(f, "POST", "/api/study", studyTestBody(0, valid), "", alice); w.Code != http.StatusOK {
		t.Fatal(w.Body.String())
	}
	invalid := []string{
		`null`, `[]`, `{}`, `{"version":2,"entries":{}}`, `{"version":1,"entries":[]}`,
		`{"version":1,"entries":{},"extra":1}`,
		`{"version":1,"entries":{"wrong:1":{"at":1,"value":null,"deleted":false}}}`,
		`{"version":1,"entries":{"word:":{"at":1,"value":null,"deleted":false}}}`,
		`{"version":1,"entries":{"word:__proto__":{"at":1,"value":null,"deleted":false}}}`,
		`{"version":1,"entries":{"book:x.constructor":{"at":1,"value":null,"deleted":false}}}`,
		`{"version":1,"entries":{"word:prototype":{"at":1,"value":null,"deleted":false}}}`,
		`{"version":1,"entries":{"word:1":{"at":-1,"value":null,"deleted":false}}}`,
		`{"version":1,"entries":{"word:1":{"at":1.5,"value":null,"deleted":false}}}`,
		`{"version":1,"entries":{"word:1":{"at":9007199254740992,"value":null,"deleted":false}}}`,
		`{"version":1,"entries":{"word:1":{"at":1,"value":null,"deleted":0}}}`,
		`{"version":1,"entries":{"word:1":{"at":1,"deleted":false}}}`,
		`{"version":1,"entries":{"word:1":{"at":1,"value":null,"deleted":false,"extra":1}}}`,
		studyTestDocument(map[string]any{"nested": map[string]any{"constructor": "bad"}}),
		studyTestDocument(map[string]any{"__proto__": "bad"}),
		`{"version":1,"entries":{"word:1":{"at":1,"value":1e999,"deleted":false}}}`,
	}
	for _, doc := range invalid {
		if validStudyDocument([]byte(doc)) {
			t.Errorf("accepted invalid document: %.200s", doc)
		}
		w := studyTestRequest(f, "POST", "/api/study", studyTestBody(1, doc), "", alice)
		if w.Code != http.StatusBadRequest {
			t.Errorf("invalid save: %d %.200s", w.Code, w.Body.String())
		}
	}
	for _, body := range []string{
		`{"study":{"version":1,"entries":{}}}`,
		`{"revision":1,"study":{"version":1,"entries":{}},"unknown":1}`,
		`{"revision":1,"study":{"version":1,"entries":{}}} {}`,
		`{"revision":-1,"study":{"version":1,"entries":{}}}`,
		`{"revision":1.5,"study":{"version":1,"entries":{}}}`,
		`{`, strings.Repeat(" ", maxStudyBody+1),
	} {
		if w := studyTestRequest(f, "POST", "/api/study", body, "", alice); w.Code != http.StatusBadRequest {
			t.Errorf("invalid envelope: %d %.200s", w.Code, w.Body.String())
		}
	}
	read := studyTestRequest(f, "GET", "/api/study", "", "", alice)
	var saved cloudStudy
	if json.Unmarshal(read.Body.Bytes(), &saved) != nil || saved.Revision != 1 || !bytes.Equal(saved.Study, []byte(valid)) {
		t.Fatal("invalid writes changed saved data")
	}
}

func TestStudyEntrySizeDepthAndJSONLimits(t *testing.T) {
	entries := make(map[string]any, maxStudyEntries+1)
	for i := 0; i < maxStudyEntries; i++ {
		entries[fmt.Sprintf("word:%d", i)] = map[string]any{"at": 0, "value": map[string]any{"item": studyTestItem("hello", fmt.Sprint(i), "你好")}, "deleted": false}
	}
	marshal := func() []byte {
		b, _ := json.Marshal(map[string]any{"version": 1, "entries": entries})
		return b
	}
	if !validStudyDocument(marshal()) {
		t.Fatal("30000 valid entries rejected")
	}
	entries["word:extra"] = map[string]any{"at": 0, "value": nil, "deleted": true}
	if validStudyDocument(marshal()) {
		t.Fatal("30001 entries accepted")
	}
	exact := studyTestSizedDocument(maxStudyBytes)
	if len(exact) != maxStudyBytes || !validStudyDocument(exact) {
		t.Fatal("exact 6MB document rejected")
	}
	if validStudyDocument(studyTestSizedDocument(maxStudyBytes + 1)) {
		t.Fatal("oversize document accepted")
	}
	if !studyText(strings.Repeat("😀", 100), 200, true) || studyText(strings.Repeat("😀", 101), 200, true) {
		t.Fatal("UTF-16 field length differs from browser")
	}
	var deep any = "x"
	for i := 0; i < maxStudyDepth; i++ {
		deep = []any{deep}
	}
	if !validStudyDocument([]byte(studyTestKeyDocument("book:deleted", deep, true))) {
		t.Fatal("depth 64 rejected")
	}
	if validStudyDocument([]byte(studyTestKeyDocument("book:deleted", []any{deep}, true))) {
		t.Fatal("depth 65 accepted")
	}
	for _, key := range []string{"day:2026-10-02", "error:1", "setting:theme", "sentence:5", "book:my-book", "word:中文"} {
		if !validStudyKey(key) {
			t.Errorf("valid key rejected: %s", key)
		}
	}
	for _, key := range []string{"word:" + strings.Repeat("你", 100), "word:x\n", "word:x.prototype", "word:constructor", "media:clip", "setting:apiKey"} {
		if validStudyKey(key) {
			t.Errorf("unsafe key accepted: %s", key)
		}
	}
	// Match browser JSON.stringify sizes rather than Go's HTML escaping or exponent padding.
	for _, tc := range []struct {
		raw  string
		size int
	}{
		{`1e-7`, 4}, {`1e-6`, 8}, {`1e20`, 21}, {`1e21`, 5}, {`-0`, 1},
		{`"<>&"`, 5}, {`"你好"`, 8}, {`"\n"`, 4}, {`"\u0001"`, 8}, {`"\u2028"`, 5},
	} {
		decoder := json.NewDecoder(strings.NewReader(tc.raw))
		decoder.UseNumber()
		var value any
		if decoder.Decode(&value) != nil || studyJSONSize(value) != tc.size {
			t.Errorf("size mismatch for %s: %d != %d", tc.raw, studyJSONSize(value), tc.size)
		}
	}
}

func TestStudyConcurrentWritesAndCorruptFile(t *testing.T) {
	f, alice, _ := studyTestFeatures(t)
	body := studyTestBody(0, studyTestDocument("concurrent"))
	codes := make(chan int, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			codes <- studyTestRequest(f, "POST", "/api/study", body, "", alice).Code
		}()
	}
	wg.Wait()
	close(codes)
	counts := map[int]int{}
	for code := range codes {
		counts[code]++
	}
	if counts[http.StatusOK] != 1 || counts[http.StatusConflict] != 1 {
		t.Fatalf("concurrent writes: %v", counts)
	}
	if err := os.WriteFile(f.studyPath("alice-study"), []byte(`{"revision":1,"study":{}}`), 0600); err != nil {
		t.Fatal(err)
	}
	if w := studyTestRequest(f, "GET", "/api/study", "", "", alice); w.Code != http.StatusInternalServerError {
		t.Fatalf("corrupt read: %d", w.Code)
	}
	if w := studyTestRequest(f, "POST", "/api/study", body, "", alice); w.Code != http.StatusInternalServerError {
		t.Fatalf("corrupt write must preserve original: %d", w.Code)
	}
	if err := os.WriteFile(f.studyPath("alice-study"), []byte(`{"revision":1}`), 0600); err != nil {
		t.Fatal(err)
	}
	if w := studyTestRequest(f, "GET", "/api/study", "", "", alice); w.Code != http.StatusInternalServerError {
		t.Fatal("missing document must not appear as empty progress")
	}
}

func TestStudyBusinessSchemas(t *testing.T) {
	item := studyTestItem("hello", "1", "你好")
	valid := []struct {
		key   string
		value any
	}{
		{"book:1", map[string]any{"name": "My book", "kind": "word", "items": []any{item}}},
		{"book:2", map[string]any{"name": "Sentences", "kind": "sentence", "category": "Daily", "description": "Practice", "items": []any{studyTestItem("Come in.", "2", "进来。")}}},
		{"word:1", map[string]any{"item": item, "favorite": true, "recognition": "known", "note": "Remember this", "first": 0, "last": 1, "seen": 2, "wrong": 0}},
		{"sentence:1", map[string]any{"item": studyTestItem(strings.Repeat("x", 2000), "1", "")}},
		{"day:2026-10-02:word:1", map[string]any{"kind": "word", "item": item, "at": 1, "correct": nil}},
		{"day:2026-10-02:word:2", map[string]any{"kind": "word", "item": item, "at": 1, "correct": false}},
		{"error:word:1", map[string]any{"kind": "word", "item": item, "typed": "helo", "at": 1, "count": 2, "resolved": false}},
	}
	for name, value := range map[string]any{"theme": "system", "accent": "en-AU", "speechRate": .5, "rate": 1.5, "loops": 1, "repeat": 3, "sort": "recent", "translation": true, "shuffle": false, "view": "grid", "batchSize": 100, "practiceMode": "delay", "practiceDelay": 30} {
		valid = append(valid, struct {
			key   string
			value any
		}{"setting:" + name, value})
	}
	for _, tc := range valid {
		if !validStudyDocument([]byte(studyTestKeyDocument(tc.key, tc.value, false))) {
			t.Errorf("valid schema rejected: %s %#v", tc.key, tc.value)
		}
	}
	invalid := []struct {
		key   string
		value any
	}{
		{"book:1", map[string]any{}},
		{"book:1", map[string]any{"name": " ", "kind": "word", "items": []any{item}}},
		{"book:1", map[string]any{"name": "Book", "kind": "wrong", "items": []any{item}}},
		{"book:1", map[string]any{"name": "Book", "kind": "word", "items": []any{}}},
		{"book:1", map[string]any{"name": "Book", "kind": "word", "items": []any{map[string]any{"en": "hello", "zh": "你好"}}}},
		{"book:1", map[string]any{"name": "Book", "kind": "word", "items": []any{studyTestItem(strings.Repeat("x", 201), "1", "")}}},
		{"book:1", map[string]any{"name": "Book", "kind": "word", "category": strings.Repeat("x", 61), "items": []any{item}}},
		{"book:1", map[string]any{"name": "Book", "kind": "word", "description": strings.Repeat("x", 501), "items": []any{item}}},
		{"word:1", map[string]any{}},
		{"word:1", map[string]any{"item": item, "recognition": "maybe"}},
		{"word:1", map[string]any{"item": item, "favorite": 1}},
		{"word:1", map[string]any{"item": item, "seen": -1}},
		{"word:1", map[string]any{"item": item, "last": "1"}},
		{"word:1", map[string]any{"item": item, "note": nil}},
		{"word:1", map[string]any{"item": item, "note": strings.Repeat("x", 2001)}},
		{"word:1", map[string]any{"item": studyTestItem("hello", "constructor", "")}},
		{"word:1", map[string]any{"item": studyTestItem("hello", strings.Repeat("你", 100), "")}},
		{"word:1", map[string]any{"item": map[string]any{"id": "1", "en": "hello", "zh": "你好", "wordId": "1"}}},
		{"day:1", map[string]any{"kind": "word", "item": item, "at": 1}},
		{"day:1", map[string]any{"kind": "word", "item": item, "at": 1, "correct": "true"}},
		{"error:word:1", map[string]any{"kind": "word", "item": item, "typed": "helo", "at": 1, "count": -1, "resolved": false}},
		{"error:word:1", map[string]any{"kind": "word", "item": item, "typed": "helo", "at": 1, "count": 1, "resolved": "false"}},
		{"setting:apiKey", "not allowed"}, {"media:clip", map[string]any{}},
	}
	for name, value := range map[string]any{"theme": "sepia", "accent": "zh-CN", "speechRate": .49, "rate": 2, "loops": 2, "repeat": "3", "sort": "random", "translation": 1, "shuffle": "false", "view": "cards", "batchSize": 4, "practiceMode": "automatic", "practiceDelay": 31} {
		invalid = append(invalid, struct {
			key   string
			value any
		}{"setting:" + name, value})
	}
	for _, tc := range invalid {
		if validStudyDocument([]byte(studyTestKeyDocument(tc.key, tc.value, false))) {
			t.Errorf("invalid schema accepted: %s %#v", tc.key, tc.value)
		}
	}
	if !validStudyDocument([]byte(`{"version":1,"entries":{"book:gone":{"at":1,"deleted":true}}}`)) {
		t.Fatal("tombstone without value rejected")
	}
	f, alice, _ := studyTestFeatures(t)
	bad := studyTestKeyDocument("book:1", map[string]any{}, false)
	if w := studyTestRequest(f, "POST", "/api/study", studyTestBody(0, bad), "", alice); w.Code != http.StatusBadRequest {
		t.Fatalf("malformed book save: %d", w.Code)
	}
}

func TestStudySavesLargeBrowserJSONWithoutHTMLEscaping(t *testing.T) {
	f, alice, _ := studyTestFeatures(t)
	doc := strings.ReplaceAll(string(studyTestSizedDocument(maxStudyBytes-64)), "x", "<")
	// These payload characters are ordinary text, not media bytes. They must not
	// expand sixfold in the server's stored envelope.
	if !validStudyDocument([]byte(doc)) {
		t.Fatal("browser-sized text rejected")
	}
	w := studyTestRequest(f, "POST", "/api/study", studyTestBody(0, doc), "", alice)
	if w.Code != http.StatusOK {
		t.Fatalf("large save: %d %.200s", w.Code, w.Body.String())
	}
	b, err := os.ReadFile(f.studyPath("alice-study"))
	if err != nil || len(b) > maxStudyBody || bytes.Contains(b, []byte(`\u003c`)) {
		t.Fatalf("stored text expanded: %v %d", err, len(b))
	}
	if w := studyTestRequest(f, "GET", "/api/study", "", "", alice); w.Code != http.StatusOK {
		t.Fatalf("large reload: %d", w.Code)
	}
}

func TestStudyOwnerBindingRejectsCrossTabCookieChanges(t *testing.T) {
	f, alice, bob := studyTestFeatures(t)
	request := func(method, owner, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "/api/study", strings.NewReader(body))
		if cookie != nil {
			r.AddCookie(cookie)
		}
		if owner != "" {
			r.Header.Set("X-Study-Owner", owner)
		}
		w := httptest.NewRecorder()
		f.studyForAccount(w, r)
		return w
	}
	bootstrap := request("GET", "", "", alice)
	var initial cloudStudy
	if bootstrap.Code != http.StatusOK || json.Unmarshal(bootstrap.Body.Bytes(), &initial) != nil || initial.Owner != "alice-study" {
		t.Fatalf("bootstrap owner: %d %s", bootstrap.Code, bootstrap.Body.String())
	}
	body := studyTestBody(0, studyTestDocument("private Alice note"))
	for _, tc := range []struct {
		method, owner string
		cookie        *http.Cookie
		wantOwner     string
	}{
		{"POST", "", alice, "alice-study"},
		{"POST", "bob-study", alice, "alice-study"},
		{"POST", "alice-study", bob, "bob-study"},
		{"GET", "alice-study", bob, "bob-study"},
	} {
		w := request(tc.method, tc.owner, body, tc.cookie)
		var problem map[string]string
		if w.Code != http.StatusForbidden || json.Unmarshal(w.Body.Bytes(), &problem) != nil || problem["owner"] != tc.wantOwner || problem["error"] == "" {
			t.Fatalf("owner guard: %d %s", w.Code, w.Body.String())
		}
	}
	// Bob's new cookie must never authorize Alice's still-open tab to save her data.
	bobRead := request("GET", "", "", bob)
	var bobDoc cloudStudy
	if json.Unmarshal(bobRead.Body.Bytes(), &bobDoc) != nil || bobDoc.Revision != 0 || bobDoc.Owner != "bob-study" || string(bobDoc.Study) != `{"version":1,"entries":{}}` {
		t.Fatal("cross-tab write contaminated Bob's store")
	}
	if w := request("POST", "alice-study", body, alice); w.Code != http.StatusOK {
		t.Fatalf("bound save: %d %s", w.Code, w.Body.String())
	}
	stale := request("POST", "alice-study", body, alice)
	var conflict map[string]string
	if stale.Code != http.StatusConflict || json.Unmarshal(stale.Body.Bytes(), &conflict) != nil || conflict["owner"] != "alice-study" {
		t.Fatalf("conflict owner missing: %d %s", stale.Code, stale.Body.String())
	}
}
