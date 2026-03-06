$ErrorActionPreference = "Stop"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm is required. Install Node.js first."
}

npm install -g @gist-command-logger/cli

if (Get-Command bash -ErrorAction SilentlyContinue) {
  gist-command-logger init --shell bash
} else {
  Write-Host "bash not found. Run gist-command-logger init --shell <your shell> manually."
}

Write-Host "Installed. Restart your shell session."
