package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

const (
	AppID        = "gist-command-logger"
	ConfigEnvVar = "GCL_CONFIG_PATH"
)

type GistMode string

type GistVisibility string

type UploadTiming string

const (
	GistModeDaily    GistMode = "daily"
	GistModeSingle   GistMode = "single"
	GistModePerEvent GistMode = "per-event"

	GistVisibilitySecret GistVisibility = "secret"
	GistVisibilityPublic GistVisibility = "public"

	UploadTimingImmediate UploadTiming = "immediate"
	UploadTimingManual    UploadTiming = "manual"
	UploadTimingOnExit    UploadTiming = "on-shell-exit"
)

type Config struct {
	Gist struct {
		Visibility GistVisibility `json:"visibility"`
		Mode       GistMode       `json:"mode"`
	} `json:"gist"`
	Upload struct {
		Timing UploadTiming `json:"timing"`
	} `json:"upload"`
	Filter struct {
		Allow []string `json:"allow"`
		Deny  []string `json:"deny"`
	} `json:"filter"`
	Redaction struct {
		Enabled bool `json:"enabled"`
	} `json:"redaction"`
}

type State struct {
	LastUploadedLine int               `json:"lastUploadedLine"`
	SingleGistID     string            `json:"singleGistId"`
	DailyGists       map[string]string `json:"dailyGists"`
}

type Paths struct {
	ConfigPath string
	ConfigDir  string
	StateDir   string
	LogPath    string
	StatePath  string
}

func DefaultConfig() Config {
	var cfg Config
	cfg.Gist.Visibility = GistVisibilitySecret
	cfg.Gist.Mode = GistModeDaily
	cfg.Upload.Timing = UploadTimingImmediate
	cfg.Filter.Allow = []string{".*"}
	cfg.Filter.Deny = []string{"^\\s*$", "^gist-command-logger\\b", "^gcl\\b"}
	cfg.Redaction.Enabled = true
	return cfg
}

func DefaultState() State {
	return State{LastUploadedLine: 0, SingleGistID: "", DailyGists: map[string]string{}}
}

func homeDir() string {
	if v := os.Getenv("GCL_HOME"); v != "" {
		return v
	}
	h, err := os.UserHomeDir()
	if err != nil {
		return "."
	}
	return h
}

func resolveConfigPath() string {
	if v := os.Getenv(ConfigEnvVar); v != "" {
		return v
	}
	if os.PathSeparator == '\\' {
		base := os.Getenv("APPDATA")
		if base == "" {
			base = filepath.Join(homeDir(), "AppData", "Roaming")
		}
		return filepath.Join(base, AppID, "config.json")
	}
	base := os.Getenv("XDG_CONFIG_HOME")
	if base == "" {
		base = filepath.Join(homeDir(), ".config")
	}
	return filepath.Join(base, AppID, "config.json")
}

func resolveStateDir() string {
	if os.PathSeparator == '\\' {
		base := os.Getenv("LOCALAPPDATA")
		if base == "" {
			base = filepath.Join(homeDir(), "AppData", "Local")
		}
		return filepath.Join(base, AppID, "state")
	}
	base := os.Getenv("XDG_STATE_HOME")
	if base == "" {
		base = filepath.Join(homeDir(), ".local", "state")
	}
	return filepath.Join(base, AppID)
}

func PathsForRuntime() Paths {
	configPath := resolveConfigPath()
	stateDir := resolveStateDir()
	return Paths{
		ConfigPath: configPath,
		ConfigDir:  filepath.Dir(configPath),
		StateDir:   stateDir,
		LogPath:    filepath.Join(stateDir, "command-log.jsonl"),
		StatePath:  filepath.Join(stateDir, "state.json"),
	}
}

func EnsurePaths(p Paths) error {
	if err := os.MkdirAll(p.ConfigDir, 0o755); err != nil {
		return err
	}
	if err := os.MkdirAll(p.StateDir, 0o755); err != nil {
		return err
	}
	return nil
}

func LoadConfig() (Paths, Config, error) {
	paths := PathsForRuntime()
	if err := EnsurePaths(paths); err != nil {
		return Paths{}, Config{}, err
	}
	if _, err := os.Stat(paths.ConfigPath); errors.Is(err, os.ErrNotExist) {
		cfg := DefaultConfig()
		if err := SaveConfig(paths.ConfigPath, cfg); err != nil {
			return Paths{}, Config{}, err
		}
	}
	b, err := os.ReadFile(paths.ConfigPath)
	if err != nil {
		return Paths{}, Config{}, err
	}
	cfg := DefaultConfig()
	if err := json.Unmarshal(b, &cfg); err != nil {
		return Paths{}, Config{}, err
	}
	if len(cfg.Filter.Allow) == 0 {
		cfg.Filter.Allow = []string{".*"}
	}
	if cfg.Filter.Deny == nil {
		cfg.Filter.Deny = []string{}
	}
	return paths, cfg, nil
}

func SaveConfig(path string, cfg Config) error {
	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(b, '\n'), 0o644)
}

func LoadState(statePath string) (State, error) {
	if _, err := os.Stat(statePath); errors.Is(err, os.ErrNotExist) {
		return DefaultState(), nil
	}
	b, err := os.ReadFile(statePath)
	if err != nil {
		return State{}, err
	}
	st := DefaultState()
	if err := json.Unmarshal(b, &st); err != nil {
		return State{}, err
	}
	if st.DailyGists == nil {
		st.DailyGists = map[string]string{}
	}
	return st, nil
}

func SaveState(path string, st State) error {
	b, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(b, '\n'), 0o644)
}
