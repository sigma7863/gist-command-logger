# gist-command-logger (Go)

Cross-platform CLI (Go) that records shell commands, filters/redacts them, and uploads to GitHub Gist.

## Why Go

- Single binary distribution for macOS/Linux/Windows
- No runtime dependency like Node/Bun for end users
- Stable process + filesystem behavior for CLI tooling

## Build

```bash
go build -o bin/gist-command-logger ./cmd/gist-command-logger
```

## Install (local)

```bash
cp bin/gist-command-logger /usr/local/bin/gist-command-logger
```

## Commands

```bash
gist-command-logger init --shell zsh --mode daily --visibility secret --timing immediate
gist-command-logger status
gist-command-logger auth
gist-command-logger auth --run
gist-command-logger run-upload
```

## Config & State

- macOS/Linux config: `~/.config/gist-command-logger/config.json`
- Windows config: `%APPDATA%\\gist-command-logger\\config.json`
- macOS/Linux state: `~/.local/state/gist-command-logger/`
- Windows state: `%LOCALAPPDATA%\\gist-command-logger\\state\\`

Environment variables:

- `GCL_CONFIG_PATH`: override config file path
- `GCL_HOME`: override home dir (useful in tests)
- `GCL_GH_BIN`: custom gh binary path (useful in tests)

## Notes

- Requires GitHub CLI (`gh`) and valid auth.
- Default behavior: collect all commands, then filter before upload.
- Default gist visibility: `secret`.
