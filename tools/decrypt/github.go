package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

const defaultRemotePath = "money-tracker.enc"

// Same shape the app validates (src/lib/githubSync.ts): keeping a malformed
// value from re-pointing an API request — and the token with it — somewhere else.
var repoPattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)

func validRepo(repo string) bool {
	if !repoPattern.MatchString(repo) {
		return false
	}
	for _, segment := range strings.Split(repo, "/") {
		if strings.Trim(segment, ".") == "" {
			return false
		}
	}
	return true
}

type ghClient struct {
	repo    string
	token   string
	path    string
	baseURL string
	http    *http.Client
}

func newGHClient(repo, token, path string) (*ghClient, error) {
	if !validRepo(repo) {
		return nil, fmt.Errorf("invalid repository %q, expected \"owner/repo\"", repo)
	}
	if path == "" {
		path = defaultRemotePath
	}
	return &ghClient{
		repo:    repo,
		token:   token,
		path:    path,
		baseURL: "https://api.github.com",
		http:    &http.Client{Timeout: 60 * time.Second},
	}, nil
}

func (c *ghClient) do(method, url string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.http.Do(req)
}

// apiError keeps GitHub's message but never echoes the request, so the token
// can't end up in a log or a bug report.
func apiError(action string, res *http.Response) error {
	var payload struct {
		Message string `json:"message"`
	}
	body, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
	_ = json.Unmarshal(body, &payload)
	if payload.Message == "" {
		payload.Message = strings.TrimSpace(string(body))
	}
	return fmt.Errorf("%s: GitHub returned %s: %s", action, res.Status, payload.Message)
}

// getFile returns the decoded file and its blob SHA. A missing file is not an
// error: it reports ok=false so the caller can say so plainly.
func (c *ghClient) getFile() (data []byte, sha string, ok bool, err error) {
	url := fmt.Sprintf("%s/repos/%s/contents/%s", c.baseURL, c.repo, c.path)
	res, err := c.do(http.MethodGet, url, nil)
	if err != nil {
		return nil, "", false, fmt.Errorf("fetching %s: %w", c.path, err)
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusNotFound {
		return nil, "", false, nil
	}
	if res.StatusCode != http.StatusOK {
		return nil, "", false, apiError("fetching "+c.path, res)
	}

	var file struct {
		SHA     string `json:"sha"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(res.Body).Decode(&file); err != nil {
		return nil, "", false, fmt.Errorf("decoding contents response: %w", err)
	}

	// Over ~1MB the Contents API omits the body and you have to go via blobs.
	content := file.Content
	if strings.TrimSpace(content) == "" {
		content, err = c.getBlob(file.SHA)
		if err != nil {
			return nil, "", false, err
		}
	}

	decoded, err := decodeGitHubBase64(content)
	if err != nil {
		return nil, "", false, err
	}
	return decoded, file.SHA, true, nil
}

func (c *ghClient) getBlob(sha string) (string, error) {
	url := fmt.Sprintf("%s/repos/%s/git/blobs/%s", c.baseURL, c.repo, sha)
	res, err := c.do(http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("fetching blob: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return "", apiError("fetching blob", res)
	}
	var blob struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(res.Body).Decode(&blob); err != nil {
		return "", fmt.Errorf("decoding blob response: %w", err)
	}
	return blob.Content, nil
}

// GitHub wraps base64 at 60 columns.
func decodeGitHubBase64(s string) ([]byte, error) {
	cleaned := strings.NewReplacer("\n", "", "\r", "", " ", "").Replace(s)
	decoded, err := base64.StdEncoding.DecodeString(cleaned)
	if err != nil {
		return nil, fmt.Errorf("decoding file content: %w", err)
	}
	return decoded, nil
}

// putFile updates the file. sha must be the blob SHA currently on the remote —
// GitHub rejects an update without it, which is what stops this from clobbering
// a change made since the fetch.
func (c *ghClient) putFile(data []byte, sha, message string) (string, error) {
	payload := map[string]string{
		"message": message,
		"content": base64.StdEncoding.EncodeToString(data),
	}
	if sha != "" {
		payload["sha"] = sha
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/repos/%s/contents/%s", c.baseURL, c.repo, c.path)
	res, err := c.do(http.MethodPut, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("uploading %s: %w", c.path, err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated {
		return "", apiError("uploading "+c.path, res)
	}

	var result struct {
		Content struct {
			SHA string `json:"sha"`
		} `json:"content"`
	}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decoding upload response: %w", err)
	}
	return result.Content.SHA, nil
}
