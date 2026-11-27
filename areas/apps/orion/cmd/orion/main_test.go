package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// runOrion runs orion with args and returns the exit code and output.
func runOrion(args ...string) (code int, stdout, stderr string) {
	var out, errOut bytes.Buffer
	code = run(args, &out, &errOut)
	return code, out.String(), errOut.String()
}

func TestVersion(t *testing.T) {
	for _, arg := range []string{"version", "--version"} {
		code, stdout, _ := runOrion(arg)
		if code != exitOK || stdout != "orion "+version+"\n" {
			t.Errorf("%s: code %d, stdout %q", arg, code, stdout)
		}
	}
}

// Help that was asked for is output, not an error: stdout and exit 0.
func TestHelp(t *testing.T) {
	for _, flag := range []string{"-h", "--help"} {
		code, stdout, stderr := runOrion(flag)
		if code != exitOK || stdout != usage || stderr != "" {
			t.Errorf("%s: code %d, stdout %q, stderr %q", flag, code, stdout, stderr)
		}
	}
}

func TestBadArguments(t *testing.T) {
	tests := []struct {
		args []string
		want string
	}{
		{nil, "usage:"},
		{[]string{"can"}, "usage:"},
		{[]string{"--check-config", "configs/bench.toml"}, `unknown role "--check-config"`},
		{[]string{"can", "configs/bench.toml", "--console"}, `unknown argument "--console"`},
	}
	for _, tt := range tests {
		code, _, stderr := runOrion(tt.args...)
		if code != exitConfig || !strings.Contains(stderr, tt.want) {
			t.Errorf("%q: code %d, stderr %q", tt.args, code, stderr)
		}
	}
}

func TestRolesNotBuiltYet(t *testing.T) {
	for role, issue := range roles {
		code, _, stderr := runOrion(role, "x.toml")
		if code != exitRuntime || !strings.Contains(stderr, "orion "+role+": not built yet (tracker "+issue+")") {
			t.Errorf("orion %s: code %d, stderr %q", role, code, stderr)
		}
	}
	code, _, stderr := runOrion("server", "x.toml", "-t")
	if code != exitRuntime || !strings.Contains(stderr, "orion server: checking its file isn't built yet (tracker #65)") {
		t.Errorf("orion server -t: code %d, stderr %q", code, stderr)
	}
}

// The committed bench config must pass its check, with both flag spellings.
func TestBenchConfigVerifies(t *testing.T) {
	path := filepath.Join("..", "..", "configs", "bench.toml")
	for _, flag := range []string{"-t", "--verify-config"} {
		code, stdout, stderr := runOrion("can", path, flag)
		if code != exitOK || !strings.Contains(stdout, "ok (orion can)") {
			t.Errorf("%s: code %d, stdout %q, stderr %q", flag, code, stdout, stderr)
		}
	}
}

func TestCANCheckFails(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bad.toml")
	if err := os.WriteFile(path, []byte("[server\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if code, _, _ := runOrion("can", path, "-t"); code != exitConfig {
		t.Errorf("code %d, want %d", code, exitConfig)
	}
}
