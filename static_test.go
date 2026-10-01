package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStaticAssets(t *testing.T) {
	files, err := loadStaticAssets()
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 76 {
		t.Fatalf("expected 76 public assets, got %d", len(files))
	}
	if extra := files["/data/industry_words.json"]; len(extra.data) == 0 || extra.etag == "" {
		t.Fatal("specialist vocabulary was not included in public assets")
	}
	words := files["/data/words.json"]
	if len(words.data) < 4_000_000 || words.etag == "" {
		t.Fatal("large word list was not preloaded")
	}
	handler := serveStatic(files)
	// Browser reloads must revalidate the application after a deployment; large
	// vocabulary files also revalidate, retaining their conditional ETag.
	for _, name := range []string{"/", "/member-ui.js", "/style.css", "/data/words.json", "/data/examples.json", "/data/industries.json"} {
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, name, nil))
		if rr.Header().Get("Cache-Control") != "no-cache" || rr.Header().Get("ETag") == "" {
			t.Fatalf("app update can remain stale at %s", name)
		}
	}
	get := httptest.NewRecorder()
	handler.ServeHTTP(get, httptest.NewRequest(http.MethodGet, "/data/words.json", nil))
	if get.Code != http.StatusOK || get.Body.Len() != len(words.data) || get.Header().Get("ETag") != words.etag {
		t.Fatal("preloaded word list was not served intact")
	}
	conditional := httptest.NewRequest(http.MethodGet, "/data/words.json", nil)
	conditional.Header.Set("If-None-Match", words.etag)
	cached := httptest.NewRecorder()
	handler.ServeHTTP(cached, conditional)
	if cached.Code != http.StatusNotModified || cached.Body.Len() != 0 {
		t.Fatal("conditional request should reuse the precomputed ETag")
	}
	head := httptest.NewRecorder()
	handler.ServeHTTP(head, httptest.NewRequest(http.MethodHead, "/data/words.json", nil))
	if head.Code != http.StatusOK || head.Body.Len() != 0 {
		t.Fatal("HEAD should return headers without a body")
	}
	missing := httptest.NewRecorder()
	handler.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/not-an-asset", nil))
	if missing.Code != http.StatusNotFound {
		t.Fatal("unknown assets should return 404")
	}
}
