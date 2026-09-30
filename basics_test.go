package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestShortCourseAssetsAreCompleteAndPlayable(t *testing.T) {
	files, err := loadStaticAssets()
	if err != nil {
		t.Fatal(err)
	}
	handler := serveStatic(files)
	for _, kind := range []string{"phonics", "grammar"} {
		var entries []map[string]any
		if json.Unmarshal(files["/data/"+kind+".json"].data, &entries) != nil {
			t.Fatal("missing course", kind)
		}
		want := 44
		if kind == "grammar" {
			want = 36
		}
		if len(entries) != want {
			t.Fatalf("%s count %d", kind, len(entries))
		}
		for _, entry := range entries {
			if kind == "phonics" {
				path := entry["audio"].(string)
				asset, ok := files[path]
				if !ok || !strings.HasPrefix(string(asset.data), "OggS") || !strings.Contains(asset.contentType, "ogg") {
					t.Fatal("unplayable audio", path)
				}
				rr := httptest.NewRecorder()
				r := httptest.NewRequest(http.MethodGet, path, nil)
				r.Header.Set("Range", "bytes=0-15")
				handler.ServeHTTP(rr, r)
				if rr.Code != http.StatusPartialContent || rr.Body.Len() != 16 {
					t.Fatal("audio seeking failed", path)
				}
			}
		}
	}
	credit := files["/provenance/phonics-audio.md"]
	if !strings.Contains(string(credit.data), "逐文件署名") || !strings.Contains(string(credit.data), "CC BY-SA") {
		t.Fatal("missing attribution")
	}
}

func TestShortCourseProgressRejectsInvalidChecks(t *testing.T) {
	good := `{"phonics":{"p01":{"studiedAt":1,"slots":[0,1],"wrong":2,"at":3}},"grammar":{"be":{"studiedAt":1,"slots":[1],"wrong":0,"at":3}}}`
	if !validBasicProgress(json.RawMessage(good)) {
		t.Fatal("valid course progress rejected")
	}
	for _, raw := range []string{`null`, `[]`, `{"other":{}}`, `{"phonics":null}`, strings.Replace(good, `[0,1]`, `[1,1]`, 1), strings.Replace(good, `p01`, `p45`, 1), strings.Replace(good, `"wrong":2`, `"wrong":-1`, 1), strings.Replace(good, `"slots":[1]`, `"slots":[2]`, 1)} {
		if validBasicProgress(json.RawMessage(raw)) {
			t.Fatalf("accepted invalid progress %s", raw)
		}
	}
	if !validBasicProgress(nil) {
		t.Fatal("old accounts must remain valid")
	}
}

func TestTravelRouteUsesItsOwnVocabularyAndBoard(t *testing.T) {
	f, err := newFeatures(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	route := f.findIndustry("travel")
	if route == nil || len(route.WordIDs) != 709 || route.CoreCount != 709 || len(route.Glosses) != 709 {
		t.Fatal("travel editorial route missing")
	}
	if f.industryWord(route.WordIDs[0]).Word != "travel" {
		t.Fatal("travel starter order changed")
	}
	for _, id := range route.WordIDs {
		if f.industryWord(id).Word == "" || route.Glosses[id] == "" {
			t.Fatal("missing travel term", id)
		}
	}
	if industryBoard("2026-09-30", route) == industryBoard("2026-09-30", f.findIndustry("programmer")) {
		t.Fatal("rankings must be separate")
	}
	questions := f.industryChallenge("2026-09-30", route)
	if len(questions) != 20 {
		t.Fatal("travel challenge size")
	}
	for _, q := range questions {
		if route.Glosses[q.ID] == "" {
			t.Fatal("unreviewed travel question", fmt.Sprint(q.ID))
		}
	}
}
