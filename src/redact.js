const FLAG_PATTERN = /(^|\s)(--?(?:token|password|passwd|pwd|secret|api[-_]?key)\b\s*(?:=|\s)\s*)([^\s]+)/gi;
const URL_CREDENTIAL_PATTERN = /((?:https?:\/\/)[^:\s]+:)([^@\s]+)(@)/gi;
const BEARER_PATTERN = /(authorization\s*:\s*bearer\s+)([^\s'"`]+)/gi;
const GENERIC_TOKEN_PATTERN = /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{10,})\b/g;

export function redactSecrets(input) {
  return `${input || ""}`
    .replace(FLAG_PATTERN, "$1$2[REDACTED]")
    .replace(URL_CREDENTIAL_PATTERN, "$1[REDACTED]$3")
    .replace(BEARER_PATTERN, "$1[REDACTED]")
    .replace(GENERIC_TOKEN_PATTERN, "[REDACTED]");
}
