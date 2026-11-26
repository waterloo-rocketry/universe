package config

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// writeFile writes text to a file in a temporary directory and returns its
// path.
func writeFile(t *testing.T, text string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "orion.toml")
	if err := os.WriteFile(path, []byte(text), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

// nameConfig is a small config type for testing check: it needs a name.
type nameConfig struct {
	Name string `toml:"name"`
}

func nameRules(cfg nameConfig) (errs []error, warnings []string) {
	if cfg.Name == "" {
		return []error{errors.New("name: missing")}, nil
	}
	return nil, nil
}

func TestCheck(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		wantErrs int
	}{
		{"read, then the rules pass", writeFile(t, `name = "x"`), 0},
		{"read, then the rules fail", writeFile(t, ""), 1},
		{"a file that isn't TOML is one error", writeFile(t, "[name\n"), 1},
		{"a missing file is one error", filepath.Join(t.TempDir(), "missing.toml"), 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if errs, _ := check(tt.path, nameRules); len(errs) != tt.wantErrs {
				t.Errorf("got %d errors, want %d: %v", len(errs), tt.wantErrs, errs)
			}
		})
	}
}

func TestCheckCAN(t *testing.T) {
	bench := filepath.Join("..", "..", "configs", "bench.toml")
	if errs, warnings, ok := Check("can", bench); !ok || len(errs) != 0 || len(warnings) != 0 {
		t.Errorf("committed bench config: ok %v, errs %v, warnings %v", ok, errs, warnings)
	}
	// a serial port with no format is one error, so the file reached the CAN rules
	path := writeFile(t, "[[source]]\ntype = \"can\"\nid = \"can-bench\"\nport = \"COM4\"\n")
	if errs, _, _ := Check("can", path); len(errs) != 1 {
		t.Errorf("got %d errors, want 1: %v", len(errs), errs)
	}
}

func TestCheckUnknownRole(t *testing.T) {
	if _, _, ok := Check("daq", "x.toml"); ok {
		t.Error("daq: checked, but checking DAQ files isn't built yet")
	}
}
