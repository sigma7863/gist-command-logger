package gh

import (
	"fmt"
	"os"
	"os/exec"
)

func bin() string {
	if v := os.Getenv("GCL_GH_BIN"); v != "" {
		return v
	}
	return "gh"
}

func Run(args ...string) (string, string, int) {
	cmd := exec.Command(bin(), args...)
	cmd.Env = os.Environ()
	stdout, err := cmd.Output()
	if err == nil {
		return string(stdout), "", 0
	}
	if ee, ok := err.(*exec.ExitError); ok {
		return string(stdout), string(ee.Stderr), ee.ExitCode()
	}
	return "", err.Error(), 1
}

func AuthStatus() (bool, string) {
	out, errOut, code := Run("auth", "status", "-h", "github.com")
	if code == 0 {
		return true, out
	}
	if errOut != "" {
		return false, errOut
	}
	return false, out
}

func API(args ...string) (string, error) {
	all := append([]string{"api"}, args...)
	out, errOut, code := Run(all...)
	if code != 0 {
		return "", fmt.Errorf("gh api failed: %s", firstNonEmpty(errOut, out))
	}
	return out, nil
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
