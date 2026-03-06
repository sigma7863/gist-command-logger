# gist-command-logger

このリポジトリは **Go 実装** と **TypeScript/Bun 実装** を同居させています。  
目的は「Go版を主実装として運用しつつ、TS版を比較・参照できるようにする」ことです。

## 実装の分離

### Go（主実装）

- `cmd/gist-command-logger/` : Go CLIエントリポイント
- `internal/` : Go本体ロジック（config/filter/gist/hooks など）
- `go.mod` : Go依存管理
- `bin/` : Goビルド成果物（生成物）

Go版を使う場合:

```bash
go build -o bin/gist-command-logger ./cmd/gist-command-logger
./bin/gist-command-logger init --shell zsh
```

### TypeScript/Bun（サブ実装）

- `src/` : TS CLI実装
- `tests/` : TSテスト
- `package.json`, `tsconfig.json`, `bun.lock` : TS/Bun設定
- `dist/` : TSビルド成果物（生成物）

TS版を使う場合:

```bash
bun install
bun run build
node dist/cli.js init --shell zsh
```

## どちらを使うべきか

- 本番運用・配布前提: **Go版**
- 検証・比較: TS/Bun版

## 共通要件

- `gh` (GitHub CLI) が必要
- `gh auth login -h github.com` で認証

## 補助スクリプト

- `scripts/install.sh`
- `scripts/install.ps1`

これらは主に TS/Bun 導線用です。Go配布を主軸にする場合は、将来的にGo用導線へ置き換えてください。
