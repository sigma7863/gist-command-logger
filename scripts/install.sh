#!/usr/bin/env sh
set -eu

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Please install Node.js first." >&2
  exit 1
fi

npm install -g @gist-command-logger/cli
gist-command-logger init

echo "Installed. Restart your shell or run: exec $SHELL -l"
