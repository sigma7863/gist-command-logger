package filter

import "regexp"

type Filter struct {
	allow []*regexp.Regexp
	deny  []*regexp.Regexp
}

func New(allowPatterns []string, denyPatterns []string) *Filter {
	f := &Filter{allow: compile(allowPatterns), deny: compile(denyPatterns)}
	return f
}

func compile(patterns []string) []*regexp.Regexp {
	out := make([]*regexp.Regexp, 0, len(patterns))
	for _, p := range patterns {
		r, err := regexp.Compile("(?i)" + p)
		if err == nil {
			out = append(out, r)
		}
	}
	return out
}

func (f *Filter) Matches(command string) bool {
	if command == "" {
		return false
	}
	allowed := len(f.allow) == 0
	for _, r := range f.allow {
		if r.MatchString(command) {
			allowed = true
			break
		}
	}
	if !allowed {
		return false
	}
	for _, r := range f.deny {
		if r.MatchString(command) {
			return false
		}
	}
	return true
}
