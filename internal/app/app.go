package app

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/sigma7863/gist-command-logger/internal/config"
	"github.com/sigma7863/gist-command-logger/internal/filter"
	"github.com/sigma7863/gist-command-logger/internal/gh"
	"github.com/sigma7863/gist-command-logger/internal/gist"
	"github.com/sigma7863/gist-command-logger/internal/hooks"
	"github.com/sigma7863/gist-command-logger/internal/records"
	"github.com/sigma7863/gist-command-logger/internal/redact"
)

func Run(args []string) int {
	if len(args) == 0 {
		help()
		return 0
	}
	switch args[0] {
	case "init":
		return cmdInit(args[1:])
	case "status":
		return cmdStatus()
	case "auth":
		return cmdAuth(args[1:])
	case "run-upload":
		return cmdRunUpload()
	case "record-finish":
		return cmdRecordFinish(args[1:])
	case "help", "--help", "-h":
		help()
		return 0
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", args[0])
		help()
		return 1
	}
}

func cmdInit(args []string) int {
	shell := getArg(args, "--shell", "auto")
	mode := getArg(args, "--mode", "")
	visibility := getArg(args, "--visibility", "")
	timing := getArg(args, "--timing", "")
	binName := getArg(args, "--bin", "gist-command-logger")
	if shell == "auto" {
		shell = hooks.Detect(os.Getenv("SHELL"))
	}

	paths, cfg, err := config.LoadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if mode != "" {
		cfg.Gist.Mode = config.GistMode(mode)
	}
	if visibility != "" {
		cfg.Gist.Visibility = config.GistVisibility(visibility)
	}
	if timing != "" {
		cfg.Upload.Timing = config.UploadTiming(timing)
	}
	if err := config.SaveConfig(paths.ConfigPath, cfg); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	target, err := hooks.Install(shell, binName)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Printf("Initialized %s hook in %s\n", shell, target)
	fmt.Printf("Config: %s\n", paths.ConfigPath)
	fmt.Println("Reload your shell: exec $SHELL -l")
	return 0
}

func cmdStatus() int {
	paths, cfg, err := config.LoadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	st, err := config.LoadState(paths.StatePath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	recs, _ := records.ReadAll(paths.LogPath)
	authed, authMsg := gh.AuthStatus()

	fmt.Printf("Config path: %s\n", paths.ConfigPath)
	fmt.Printf("State path: %s\n", paths.StatePath)
	fmt.Printf("Log path: %s\n", paths.LogPath)
	fmt.Printf("Records: %d\n", len(recs))
	fmt.Printf("Gist mode: %s\n", cfg.Gist.Mode)
	fmt.Printf("Visibility: %s\n", cfg.Gist.Visibility)
	fmt.Printf("Upload timing: %s\n", cfg.Upload.Timing)
	fmt.Printf("lastUploadedLine: %d\n", st.LastUploadedLine)
	if authed {
		fmt.Println("gh auth: ok")
	} else {
		fmt.Println("gh auth: not logged in")
		if authMsg != "" {
			fmt.Println(authMsg)
		}
	}
	return 0
}

func cmdAuth(args []string) int {
	if hasFlag(args, "--run") {
		_, errOut, code := gh.Run("auth", "login", "-h", "github.com")
		if code != 0 {
			fmt.Fprintln(os.Stderr, errOut)
			return code
		}
		return 0
	}
	fmt.Println("Run the following command to authenticate GitHub CLI:")
	fmt.Println("  gh auth login -h github.com")
	fmt.Println("Then verify with:")
	fmt.Println("  gist-command-logger status")
	return 0
}

func cmdRecordFinish(args []string) int {
	shell := getArg(args, "--shell", "unknown")
	exitCodeStr := getArg(args, "--exit-code", "0")
	exitCode, _ := strconv.Atoi(exitCodeStr)
	cmd := os.Getenv("GCL_HOOK_COMMAND")
	started := os.Getenv("GCL_HOOK_STARTED_AT")
	if started == "" {
		started = time.Now().UTC().Format(time.RFC3339)
	}
	if cmd == "" {
		return 0
	}

	paths, cfg, err := config.LoadConfig()
	if err != nil {
		return 0
	}
	rec := records.Record{
		StartedAt:  started,
		FinishedAt: time.Now().UTC().Format(time.RFC3339),
		Shell:      shell,
		Cwd:        mustGetwd(),
		Command:    cmd,
		ExitCode:   exitCode,
	}
	_ = records.Append(paths.LogPath, rec)

	if cfg.Upload.Timing == config.UploadTimingImmediate {
		_ = runUpload(true)
	}
	return 0
}

func cmdRunUpload() int {
	if err := runUpload(false); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	return 0
}

func runUpload(quiet bool) error {
	paths, cfg, err := config.LoadConfig()
	if err != nil {
		return err
	}
	st, err := config.LoadState(paths.StatePath)
	if err != nil {
		return err
	}
	recs, err := records.ReadAll(paths.LogPath)
	if err != nil {
		return err
	}
	if st.LastUploadedLine < 0 {
		st.LastUploadedLine = 0
	}
	if st.LastUploadedLine > len(recs) {
		st.LastUploadedLine = len(recs)
	}
	pending := recs[st.LastUploadedLine:]
	if len(pending) == 0 {
		if !quiet {
			fmt.Println("No pending command records.")
		}
		return nil
	}

	flt := filter.New(cfg.Filter.Allow, cfg.Filter.Deny)
	lines := []string{}
	for _, r := range pending {
		if !flt.Matches(r.Command) {
			continue
		}
		if cfg.Redaction.Enabled {
			r.Command = redact.Secrets(r.Command)
		}
		lines = append(lines, records.Format(r))
	}
	if len(lines) > 0 {
		count, ids, err := gist.UploadLines(cfg, &st, lines)
		if err != nil {
			return err
		}
		if !quiet {
			fmt.Printf("Uploaded %d entries to Gist.\n", count)
			if len(ids) > 0 {
				fmt.Printf("Gists: %v\n", ids)
			}
		}
	} else if !quiet {
		fmt.Println("No records matched filter rules.")
	}

	st.LastUploadedLine = len(recs)
	return config.SaveState(paths.StatePath, st)
}

func help() {
	bin := filepath.Base(os.Args[0])
	fmt.Printf(`%s commands:
  init [--shell zsh|bash|auto] [--mode daily|single|per-event] [--visibility secret|public] [--timing immediate|manual|on-shell-exit]
  status
  auth [--run]
  run-upload
  record-finish --shell <zsh|bash> --exit-code <n>  (internal)
`, bin)
}

func getArg(args []string, key, fallback string) string {
	for i := 0; i < len(args)-1; i++ {
		if args[i] == key {
			return args[i+1]
		}
	}
	return fallback
}

func hasFlag(args []string, flag string) bool {
	for _, a := range args {
		if a == flag {
			return true
		}
	}
	return false
}

func mustGetwd() string {
	wd, err := os.Getwd()
	if err != nil {
		return "-"
	}
	return wd
}
