package redact

import "regexp"

var (
	flagPattern   = regexp.MustCompile(`(?i)(^|\s)(--?(?:token|password|passwd|pwd|secret|api[-_]?key)\b\s*(?:=|\s)\s*)([^\s]+)`)
	urlCredential = regexp.MustCompile(`(?i)((?:https?:\/\/)[^:\s]+:)([^@\s]+)(@)`)
	bearerPattern = regexp.MustCompile(`(?i)(authorization\s*:\s*bearer\s+)([^\s'"` + "`" + `]+)`)
	genericToken  = regexp.MustCompile(`\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{10,})\b`)
)

func Secrets(input string) string {
	out := flagPattern.ReplaceAllString(input, "$1$2[REDACTED]")
	out = urlCredential.ReplaceAllString(out, "$1[REDACTED]$3")
	out = bearerPattern.ReplaceAllString(out, "$1[REDACTED]")
	out = genericToken.ReplaceAllString(out, "[REDACTED]")
	return out
}
