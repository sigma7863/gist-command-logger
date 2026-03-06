package hooks

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	startMarker = "# >>> gist-command-logger >>>"
	endMarker   = "# <<< gist-command-logger <<<"
)

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

func Detect(shellEnv string) string {
	s := strings.ToLower(shellEnv)
	if strings.Contains(s, "bash") {
		return "bash"
	}
	return "zsh"
}

func Install(shell, binName string) (string, error) {
	home := homeDir()
	var rcPath string
	var block string

	switch shell {
	case "zsh":
		rcPath = filepath.Join(home, ".zshrc")
		block = zshBlock(binName)
	case "bash":
		rcPath = filepath.Join(home, ".bashrc")
		block = bashBlock(binName)
	default:
		return "", fmt.Errorf("unsupported shell: %s", shell)
	}

	return rcPath, upsertBlock(rcPath, block)
}

func upsertBlock(rcPath string, block string) error {
	norm := startMarker + "\n" + strings.TrimRight(block, "\n") + "\n" + endMarker
	existing, _ := os.ReadFile(rcPath)
	text := string(existing)

	si := strings.Index(text, startMarker)
	ei := strings.Index(text, endMarker)
	if si >= 0 && ei > si {
		e := ei + len(endMarker)
		before := strings.TrimRight(text[:si], "\n")
		after := strings.TrimLeft(text[e:], "\n")
		parts := []string{}
		if before != "" {
			parts = append(parts, before)
		}
		parts = append(parts, norm)
		if after != "" {
			parts = append(parts, after)
		}
		return os.WriteFile(rcPath, []byte(strings.Join(parts, "\n\n")+"\n"), 0o644)
	}

	base := strings.TrimRight(text, "\n")
	if base == "" {
		return os.WriteFile(rcPath, []byte(norm+"\n"), 0o644)
	}
	return os.WriteFile(rcPath, []byte(base+"\n\n"+norm+"\n"), 0o644)
}

func zshBlock(binName string) string {
	return fmt.Sprintf(`typeset -g __gcl_last_cmd=""
typeset -g __gcl_started_at=""

autoload -Uz add-zsh-hook

__gcl_preexec() {
  __gcl_last_cmd="$1"
  __gcl_started_at="$(date -u +"%%Y-%%m-%%dT%%H:%%M:%%SZ")"
}

__gcl_precmd() {
  local ec=$?
  if [[ -z "$__gcl_last_cmd" ]]; then
    return
  fi

  GCL_HOOK_COMMAND="$__gcl_last_cmd" \
  GCL_HOOK_STARTED_AT="$__gcl_started_at" \
  %s record-finish --shell zsh --exit-code "$ec" >/dev/null 2>&1

  __gcl_last_cmd=""
  __gcl_started_at=""
}

add-zsh-hook preexec __gcl_preexec
add-zsh-hook precmd __gcl_precmd`, binName)
}

func bashBlock(binName string) string {
	return fmt.Sprintf(`__gcl_last_cmd=""
__gcl_started_at=""
__gcl_in_prompt="0"

__gcl_preexec() {
  if [[ "$__gcl_in_prompt" == "1" ]]; then
    return
  fi
  if [[ "$BASH_COMMAND" == "%s "* ]] || [[ "$BASH_COMMAND" == "%s" ]]; then
    return
  fi
  __gcl_last_cmd="$BASH_COMMAND"
  __gcl_started_at="$(date -u +"%%Y-%%m-%%dT%%H:%%M:%%SZ")"
}

__gcl_precmd() {
  local ec=$?
  __gcl_in_prompt="1"

  if [[ -n "$__gcl_last_cmd" ]]; then
    GCL_HOOK_COMMAND="$__gcl_last_cmd" \
    GCL_HOOK_STARTED_AT="$__gcl_started_at" \
    %s record-finish --shell bash --exit-code "$ec" >/dev/null 2>&1
    __gcl_last_cmd=""
    __gcl_started_at=""
  fi

  __gcl_in_prompt="0"
}

trap '__gcl_preexec' DEBUG
PROMPT_COMMAND="__gcl_precmd\${PROMPT_COMMAND:+;\$PROMPT_COMMAND}"`, binName, binName, binName)
}
