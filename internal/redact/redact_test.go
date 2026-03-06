package redact

import (
	"strings"
	"testing"
)

func TestRedactsFlagsAndBearer(t *testing.T) {
	in := "curl -H 'Authorization: Bearer sk-abc123456789012345678' --token=abc123 --password hunter2"
	out := Secrets(in)
	if strings.Contains(out, "hunter2") || strings.Contains(out, "abc123") {
		t.Fatal("secret values should be redacted")
	}
	if !strings.Contains(out, "[REDACTED]") {
		t.Fatal("expected redaction marker")
	}
}

func TestRedactsURLCredential(t *testing.T) {
	out := Secrets("git clone https://user:supersecret@example.com/repo.git")
	if strings.Contains(out, "supersecret") {
		t.Fatal("url credentials should be redacted")
	}
}
