import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CONFIG_MARKERS } from "./constants.js";

function upsertBlock(filePath, startMarker, endMarker, blockContent) {
  const normalized = `${startMarker}\n${blockContent.trimEnd()}\n${endMarker}`;
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";

  const start = existing.indexOf(startMarker);
  const end = existing.indexOf(endMarker);

  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start).trimEnd();
    const after = existing.slice(end + endMarker.length).trimStart();
    const merged = [before, normalized, after].filter(Boolean).join("\n\n");
    fs.writeFileSync(filePath, `${merged}\n`, "utf8");
    return;
  }

  const merged = [existing.trimEnd(), normalized].filter(Boolean).join("\n\n");
  fs.writeFileSync(filePath, `${merged}\n`, "utf8");
}

function zshBlock(binName) {
  return `typeset -g __gcl_last_cmd=""
typeset -g __gcl_started_at=""

autoload -Uz add-zsh-hook

__gcl_preexec() {
  __gcl_last_cmd="$1"
  __gcl_started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}

__gcl_precmd() {
  local ec=$?
  if [[ -z "$__gcl_last_cmd" ]]; then
    return
  fi

  GCL_HOOK_COMMAND="$__gcl_last_cmd" \\
  GCL_HOOK_STARTED_AT="$__gcl_started_at" \\
  ${binName} record-finish --shell zsh --exit-code "$ec" >/dev/null 2>&1

  __gcl_last_cmd=""
  __gcl_started_at=""
}

add-zsh-hook preexec __gcl_preexec
add-zsh-hook precmd __gcl_precmd`;
}

function bashBlock(binName) {
  return `__gcl_last_cmd=""
__gcl_started_at=""
__gcl_in_prompt="0"

__gcl_preexec() {
  if [[ "$__gcl_in_prompt" == "1" ]]; then
    return
  fi
  if [[ "$BASH_COMMAND" == "${binName} "* ]] || [[ "$BASH_COMMAND" == "${binName}" ]]; then
    return
  fi
  __gcl_last_cmd="$BASH_COMMAND"
  __gcl_started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}

__gcl_precmd() {
  local ec=$?
  __gcl_in_prompt="1"

  if [[ -n "$__gcl_last_cmd" ]]; then
    GCL_HOOK_COMMAND="$__gcl_last_cmd" \\
    GCL_HOOK_STARTED_AT="$__gcl_started_at" \\
    ${binName} record-finish --shell bash --exit-code "$ec" >/dev/null 2>&1
    __gcl_last_cmd=""
    __gcl_started_at=""
  fi

  __gcl_in_prompt="0"
}

trap '__gcl_preexec' DEBUG
PROMPT_COMMAND="__gcl_precmd\${PROMPT_COMMAND:+;\$PROMPT_COMMAND}"`;
}

export function installHooks(shell, binName = "gist-command-logger") {
  const home = os.homedir();

  if (shell === "zsh") {
    const file = path.join(home, ".zshrc");
    upsertBlock(file, CONFIG_MARKERS.zshStart, CONFIG_MARKERS.zshEnd, zshBlock(binName));
    return file;
  }

  if (shell === "bash") {
    const file = path.join(home, ".bashrc");
    upsertBlock(file, CONFIG_MARKERS.bashStart, CONFIG_MARKERS.bashEnd, bashBlock(binName));
    return file;
  }

  throw new Error(`unsupported shell for init: ${shell}`);
}

export function detectShell(inputShell = process.env.SHELL || "") {
  const src = inputShell.toLowerCase();
  if (src.includes("zsh")) {
    return "zsh";
  }
  if (src.includes("bash")) {
    return "bash";
  }
  return "zsh";
}
