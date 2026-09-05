package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fakeGitHub is a stand-in for the Contents API: enough of it to exercise the
// request shapes the tool depends on, including the optimistic-concurrency sha.
type fakeGitHub struct {
	t *testing.T

	content []byte
	sha     string
	missing bool
	// large forces the >1MB behaviour, where Contents omits the body and the
	// caller has to fall back to the blobs API.
	large bool

	gotAuth      string
	gotAPIVer    string
	gotPutSHA    string
	gotPutMsg    string
	putCalls     int
	rejectPutSHA bool
}

func (f *fakeGitHub) handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/repos/me/money-data/contents/money-tracker.enc", func(w http.ResponseWriter, r *http.Request) {
		f.gotAuth = r.Header.Get("Authorization")
		f.gotAPIVer = r.Header.Get("X-GitHub-Api-Version")

		switch r.Method {
		case http.MethodGet:
			if f.missing {
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`{"message":"Not Found"}`))
				return
			}
			body := map[string]any{"sha": f.sha}
			if f.large {
				body["content"] = ""
			} else {
				// GitHub wraps base64 at 60 columns; make sure we cope.
				body["content"] = wrap(base64.StdEncoding.EncodeToString(f.content), 60)
			}
			_ = json.NewEncoder(w).Encode(body)

		case http.MethodPut:
			f.putCalls++
			var payload map[string]string
			raw, _ := io.ReadAll(r.Body)
			if err := json.Unmarshal(raw, &payload); err != nil {
				f.t.Errorf("PUT body is not JSON: %v", err)
			}
			f.gotPutSHA = payload["sha"]
			f.gotPutMsg = payload["message"]
			if f.rejectPutSHA && payload["sha"] != f.sha {
				w.WriteHeader(http.StatusConflict)
				_, _ = w.Write([]byte(`{"message":"is at ` + f.sha + ` but expected something else"}`))
				return
			}
			decoded, err := base64.StdEncoding.DecodeString(payload["content"])
			if err != nil {
				f.t.Errorf("PUT content is not base64: %v", err)
			}
			f.content = decoded
			f.sha = "newsha1234567890"
			_ = json.NewEncoder(w).Encode(map[string]any{
				"content": map[string]string{"sha": f.sha},
			})
		}
	})

	mux.HandleFunc("/repos/me/money-data/git/blobs/", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"content": wrap(base64.StdEncoding.EncodeToString(f.content), 60),
		})
	})

	return mux
}

func wrap(s string, at int) string {
	var b strings.Builder
	for i := 0; i < len(s); i += at {
		end := min(i+at, len(s))
		b.WriteString(s[i:end])
		b.WriteString("\n")
	}
	return b.String()
}

func newTestClient(t *testing.T, f *fakeGitHub) (*ghClient, *httptest.Server) {
	t.Helper()
	server := httptest.NewServer(f.handler())
	t.Cleanup(server.Close)
	client, err := newGHClient("me/money-data", "ghp_testtoken", "")
	if err != nil {
		t.Fatalf("newGHClient: %v", err)
	}
	client.baseURL = server.URL
	client.http = server.Client()
	return client, server
}

func legacyFixture(t *testing.T) []byte {
	t.Helper()
	return mustDecode(t, legacyBlobB64)
}

func runMigrate(t *testing.T, client *ghClient, dir string, dryRun, force bool) (string, error) {
	t.Helper()
	var log bytes.Buffer
	err := migrate(migrateOptions{
		client:     client,
		password:   fixturePassword,
		candidates: knownIterations,
		backupDir:  dir,
		dryRun:     dryRun,
		force:      force,
		out:        &log,
	})
	return log.String(), err
}

func TestMigrateReencryptsAndUploads(t *testing.T) {
	f := &fakeGitHub{t: t, content: legacyFixture(t), sha: "oldsha0987654321", rejectPutSHA: true}
	client, _ := newTestClient(t, f)
	dir := t.TempDir()

	log, err := runMigrate(t, client, dir, false, false)
	if err != nil {
		t.Fatalf("migrate: %v\n%s", err, log)
	}

	if f.putCalls != 1 {
		t.Fatalf("expected exactly one upload, got %d", f.putCalls)
	}
	if f.gotPutSHA != "oldsha0987654321" {
		t.Errorf("upload sent sha %q, want the sha from the fetch", f.gotPutSHA)
	}
	if f.gotAuth != "Bearer ghp_testtoken" {
		t.Errorf("Authorization = %q", f.gotAuth)
	}
	if f.gotAPIVer != "2022-11-28" {
		t.Errorf("X-GitHub-Api-Version = %q", f.gotAPIVer)
	}
	if !strings.Contains(f.gotPutMsg, "600000") {
		t.Errorf("commit message %q should mention the new iteration count", f.gotPutMsg)
	}

	// The uploaded blob must open at the new count and only the new count.
	if _, err := decryptWith(f.content, fixturePassword, legacyIterations); err == nil {
		t.Error("uploaded blob still opens at the legacy iteration count")
	}
	got, iterations, err := decryptBlob(f.content, fixturePassword, knownIterations)
	if err != nil {
		t.Fatalf("uploaded blob does not decrypt: %v", err)
	}
	if iterations != currentIterations {
		t.Errorf("uploaded blob uses %d iterations, want %d", iterations, currentIterations)
	}
	if !bytes.Equal(got, mustDecode(t, fixturePlainB64)) {
		t.Error("uploaded blob does not contain the original database")
	}
}

// The backup is the whole safety net: it has to exist, and it has to be the
// original bytes, before anything is uploaded.
func TestMigrateWritesBackupOfTheOriginal(t *testing.T) {
	original := legacyFixture(t)
	f := &fakeGitHub{t: t, content: original, sha: "oldsha0987654321"}
	client, _ := newTestClient(t, f)
	dir := t.TempDir()

	if _, err := runMigrate(t, client, dir, false, false); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	matches, err := filepath.Glob(filepath.Join(dir, "*.enc.backup"))
	if err != nil || len(matches) != 1 {
		t.Fatalf("expected exactly one backup file, got %v (err %v)", matches, err)
	}
	saved, err := os.ReadFile(matches[0])
	if err != nil {
		t.Fatalf("reading backup: %v", err)
	}
	if !bytes.Equal(saved, original) {
		t.Error("backup does not match the original remote bytes")
	}
}

func TestMigrateDryRunUploadsNothing(t *testing.T) {
	original := legacyFixture(t)
	f := &fakeGitHub{t: t, content: original, sha: "oldsha0987654321"}
	client, _ := newTestClient(t, f)
	dir := t.TempDir()

	log, err := runMigrate(t, client, dir, true, false)
	if err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if f.putCalls != 0 {
		t.Errorf("dry run performed %d uploads", f.putCalls)
	}
	if !bytes.Equal(f.content, original) {
		t.Error("dry run modified the remote")
	}
	if !strings.Contains(log, "Dry run") {
		t.Errorf("dry run should say so, got:\n%s", log)
	}
	// Even a dry run leaves you with a local copy.
	if matches, _ := filepath.Glob(filepath.Join(dir, "*.enc.backup")); len(matches) != 1 {
		t.Error("dry run should still write a backup")
	}
}

func TestMigrateSkipsWhenAlreadyCurrent(t *testing.T) {
	current := mustDecode(t, currentBlobB64)
	f := &fakeGitHub{t: t, content: current, sha: "sha"}
	client, _ := newTestClient(t, f)

	log, err := runMigrate(t, client, t.TempDir(), false, false)
	if err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if f.putCalls != 0 {
		t.Errorf("expected no upload for an already-migrated file, got %d", f.putCalls)
	}
	if !strings.Contains(log, "nothing to do") {
		t.Errorf("expected a 'nothing to do' message, got:\n%s", log)
	}
}

func TestMigrateForceReencryptsAlreadyCurrent(t *testing.T) {
	f := &fakeGitHub{t: t, content: mustDecode(t, currentBlobB64), sha: "sha"}
	client, _ := newTestClient(t, f)

	if _, err := runMigrate(t, client, t.TempDir(), false, true); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if f.putCalls != 1 {
		t.Errorf("-f should re-encrypt anyway, got %d uploads", f.putCalls)
	}
}

func TestMigrateWrongPasswordUploadsNothing(t *testing.T) {
	original := legacyFixture(t)
	f := &fakeGitHub{t: t, content: original, sha: "sha"}
	client, _ := newTestClient(t, f)
	dir := t.TempDir()

	err := migrate(migrateOptions{
		client: client, password: "wrong", candidates: knownIterations,
		backupDir: dir, out: io.Discard,
	})
	if err == nil {
		t.Fatal("expected an error for the wrong password")
	}
	if f.putCalls != 0 {
		t.Error("uploaded despite failing to decrypt")
	}
	if !bytes.Equal(f.content, original) {
		t.Error("remote was modified despite the failure")
	}
}

func TestMigrateMissingRemoteFile(t *testing.T) {
	f := &fakeGitHub{t: t, missing: true}
	client, _ := newTestClient(t, f)

	_, err := runMigrate(t, client, t.TempDir(), false, false)
	if err == nil || !strings.Contains(err.Error(), "nothing to migrate") {
		t.Fatalf("expected a clear 'nothing to migrate' error, got %v", err)
	}
}

// Files over ~1MB come back with an empty body and have to be fetched by blob.
func TestMigrateHandlesLargeFileViaBlobsAPI(t *testing.T) {
	f := &fakeGitHub{t: t, content: legacyFixture(t), sha: "bigsha", large: true}
	client, _ := newTestClient(t, f)

	if _, err := runMigrate(t, client, t.TempDir(), true, false); err != nil {
		t.Fatalf("migrate: %v", err)
	}
}

func TestValidRepo(t *testing.T) {
	valid := []string{"me/money-data", "some-org/repo.name", "a_b/c-d.e"}
	invalid := []string{"", "no-slash", "me/money/extra", "me/..", "../etc", "me/repo?x=1", "me /repo"}
	for _, r := range valid {
		if !validRepo(r) {
			t.Errorf("validRepo(%q) = false, want true", r)
		}
	}
	for _, r := range invalid {
		if validRepo(r) {
			t.Errorf("validRepo(%q) = true, want false", r)
		}
	}
}

func TestNewGHClientRejectsBadRepo(t *testing.T) {
	if _, err := newGHClient("me/../other", "token", ""); err == nil {
		t.Fatal("expected an error for a traversal-shaped repo")
	}
}

func TestReadTokenPrefersFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "token")
	if err := os.WriteFile(path, []byte("  ghp_fromfile\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GITHUB_TOKEN", "ghp_fromenv")

	got, err := readToken(path)
	if err != nil {
		t.Fatalf("readToken: %v", err)
	}
	if got != "ghp_fromfile" {
		t.Errorf("readToken = %q, want the trimmed file contents", got)
	}

	if got, err = readToken(""); err != nil || got != "ghp_fromenv" {
		t.Errorf("readToken(env) = %q, %v", got, err)
	}

	t.Setenv("GITHUB_TOKEN", "")
	if _, err := readToken(""); err == nil {
		t.Error("expected an error when no token is available")
	}
}
