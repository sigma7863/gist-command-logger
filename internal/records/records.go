package records

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
)

type Record struct {
	StartedAt  string `json:"startedAt"`
	FinishedAt string `json:"finishedAt"`
	Shell      string `json:"shell"`
	Cwd        string `json:"cwd"`
	Command    string `json:"command"`
	ExitCode   int    `json:"exitCode"`
}

func Append(logPath string, rec Record) error {
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	b, err := json.Marshal(rec)
	if err != nil {
		return err
	}
	_, err = f.Write(append(b, '\n'))
	return err
}

func ReadAll(logPath string) ([]Record, error) {
	f, err := os.Open(logPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []Record{}, nil
		}
		return nil, err
	}
	defer f.Close()
	out := []Record{}
	s := bufio.NewScanner(f)
	for s.Scan() {
		line := s.Bytes()
		if len(line) == 0 {
			continue
		}
		var rec Record
		if err := json.Unmarshal(line, &rec); err == nil {
			out = append(out, rec)
		}
	}
	if err := s.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func Format(rec Record) string {
	ts := rec.FinishedAt
	if ts == "" {
		ts = rec.StartedAt
	}
	if ts == "" {
		ts = "-"
	}
	shell := rec.Shell
	if shell == "" {
		shell = "unknown"
	}
	cwd := rec.Cwd
	if cwd == "" {
		cwd = "-"
	}
	return fmt.Sprintf("[%s] [%s] [exit:%d] [%s] %s", ts, shell, rec.ExitCode, cwd, rec.Command)
}
