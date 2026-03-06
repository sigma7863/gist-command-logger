# Implementation Map

## Go (Primary)

- Entry: `cmd/gist-command-logger/main.go`
- App: `internal/app/`
- Modules: `internal/config`, `internal/filter`, `internal/redact`, `internal/gist`, `internal/hooks`, `internal/records`, `internal/gh`
- Build: `go build -o bin/gist-command-logger ./cmd/gist-command-logger`

## TypeScript/Bun (Secondary)

- Entry: `src/cli.ts`
- App: `src/*.ts`
- Tests: `tests/*.ts`
- Build: `bun run build`

## Rule of thumb

- Ship/operate with Go
- Compare/prototype with TS/Bun
