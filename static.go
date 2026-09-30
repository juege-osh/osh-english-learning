package main

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"time"
)

type staticAsset struct {
	data        []byte
	contentType string
	etag        string
}

// The two vocabulary files are several megabytes each. Read and hash embedded
// assets once, rather than allocating a new copy for every concurrent visitor.
func loadStaticAssets() (map[string]staticAsset, error) {
	files := make(map[string]staticAsset)
	err := fs.WalkDir(assets, ".", func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		data, err := assets.ReadFile(name)
		if err != nil {
			return err
		}
		digest := sha256.Sum256(data)
		files["/"+name] = staticAsset{
			data:        data,
			contentType: mime.TypeByExtension(path.Ext(name)),
			etag:        fmt.Sprintf("\"%x\"", digest),
		}
		return nil
	})
	return files, err
}

func serveStatic(files map[string]staticAsset) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		name := r.URL.Path
		if name == "/" {
			name = "/index.html"
		}
		file, ok := files[name]
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", file.contentType)
		w.Header().Set("ETag", file.etag)
		w.Header().Set("Cache-Control", "public, max-age=300")
		if name == "/index.html" || path.Ext(name) == ".js" || path.Ext(name) == ".css" {
			w.Header().Set("Cache-Control", "no-cache")
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		http.ServeContent(w, r, name, time.Time{}, bytes.NewReader(file.data))
	}
}
