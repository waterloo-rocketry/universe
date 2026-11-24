package parsley

import "testing"

func TestVersion(t *testing.T) {
	if Version == "" {
		t.Fatal("Version is empty")
	}
}
