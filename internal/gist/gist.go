package gist

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/sigma7863/gist-command-logger/internal/config"
	"github.com/sigma7863/gist-command-logger/internal/gh"
)

type gistFile struct {
	Content string `json:"content"`
}

type gistResponse struct {
	ID    string              `json:"id"`
	Files map[string]gistFile `json:"files"`
}

type apiBody struct {
	Description string              `json:"description,omitempty"`
	Public      bool                `json:"public,omitempty"`
	Files       map[string]gistFile `json:"files"`
}

func UploadLines(cfg config.Config, st *config.State, lines []string) (int, []string, error) {
	if len(lines) == 0 {
		return 0, []string{}, nil
	}
	switch cfg.Gist.Mode {
	case config.GistModePerEvent:
		ids := make([]string, 0, len(lines))
		for _, line := range lines {
			ts := strings.NewReplacer(":", "-", ".", "-").Replace(time.Now().UTC().Format(time.RFC3339Nano))
			fname := fmt.Sprintf("command-%s.log", ts)
			id, err := createGist(fname, line, fmt.Sprintf("Command event %s", ts), cfg.Gist.Visibility)
			if err != nil {
				return 0, nil, err
			}
			ids = append(ids, id)
		}
		return len(lines), ids, nil
	case config.GistModeSingle:
		id, err := uploadSingle(cfg, st, strings.Join(lines, "\n"))
		if err != nil {
			return 0, nil, err
		}
		return len(lines), []string{id}, nil
	default:
		id, err := uploadDaily(cfg, st, strings.Join(lines, "\n"))
		if err != nil {
			return 0, nil, err
		}
		return len(lines), []string{id}, nil
	}
}

func uploadSingle(cfg config.Config, st *config.State, content string) (string, error) {
	file := "commands.log"
	if st.SingleGistID == "" {
		id, err := createGist(file, content, "Command log (single mode)", cfg.Gist.Visibility)
		if err != nil {
			return "", err
		}
		st.SingleGistID = id
		return id, nil
	}
	if err := appendToFile(st.SingleGistID, file, content); err != nil {
		return "", err
	}
	return st.SingleGistID, nil
}

func uploadDaily(cfg config.Config, st *config.State, content string) (string, error) {
	day := time.Now().UTC().Format("2006-01-02")
	file := fmt.Sprintf("commands-%s.log", day)
	if st.DailyGists == nil {
		st.DailyGists = map[string]string{}
	}
	if st.DailyGists[day] == "" {
		id, err := createGist(file, content, fmt.Sprintf("Command log (%s)", day), cfg.Gist.Visibility)
		if err != nil {
			return "", err
		}
		st.DailyGists[day] = id
		return id, nil
	}
	if err := appendToFile(st.DailyGists[day], file, content); err != nil {
		return "", err
	}
	return st.DailyGists[day], nil
}

func appendToFile(gistID, filename, content string) error {
	g, err := getGist(gistID)
	if err != nil {
		return err
	}
	current := ""
	if gf, ok := g.Files[filename]; ok {
		current = gf.Content
	}
	merged := content
	if current != "" {
		merged = current + "\n" + content
	}
	return patchGist(gistID, filename, merged)
}

func getGist(gistID string) (gistResponse, error) {
	out, err := gh.API("/gists/" + gistID)
	if err != nil {
		return gistResponse{}, err
	}
	var g gistResponse
	if err := json.Unmarshal([]byte(out), &g); err != nil {
		return gistResponse{}, err
	}
	return g, nil
}

func createGist(filename, content, description string, visibility config.GistVisibility) (string, error) {
	body := apiBody{
		Description: description,
		Public:      visibility == config.GistVisibilityPublic,
		Files:       map[string]gistFile{filename: {Content: content}},
	}
	res, err := callJSONAPI("/gists", "POST", body)
	if err != nil {
		return "", err
	}
	if res.ID == "" {
		return "", fmt.Errorf("failed to create gist")
	}
	return res.ID, nil
}

func patchGist(gistID, filename, content string) error {
	body := apiBody{Files: map[string]gistFile{filename: {Content: content}}}
	res, err := callJSONAPI("/gists/"+gistID, "PATCH", body)
	if err != nil {
		return err
	}
	if res.ID == "" {
		return fmt.Errorf("failed to update gist")
	}
	return nil
}

func callJSONAPI(endpoint, method string, body apiBody) (gistResponse, error) {
	b, err := json.Marshal(body)
	if err != nil {
		return gistResponse{}, err
	}
	tmp := filepath.Join(os.TempDir(), fmt.Sprintf("gcl-%d-%d.json", os.Getpid(), time.Now().UnixNano()))
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return gistResponse{}, err
	}
	defer os.Remove(tmp)

	out, err := gh.API(endpoint, "-X", method, "--input", tmp)
	if err != nil {
		return gistResponse{}, err
	}
	var res gistResponse
	if err := json.Unmarshal([]byte(out), &res); err != nil {
		return gistResponse{}, err
	}
	return res, nil
}
