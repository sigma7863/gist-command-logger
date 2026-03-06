package filter

import "testing"

func TestDenyOverridesAllow(t *testing.T) {
	f := New([]string{".*"}, []string{"^git status$"})
	if !f.Matches("brew install gh") {
		t.Fatal("expected allowed command")
	}
	if f.Matches("git status") {
		t.Fatal("expected denied command")
	}
}

func TestAllowRestricts(t *testing.T) {
	f := New([]string{"^brew install", "^npm i"}, nil)
	if !f.Matches("brew install jq") {
		t.Fatal("expected brew install to match")
	}
	if f.Matches("pip install requests") {
		t.Fatal("expected pip install not to match")
	}
}
