package main

import "testing"

func TestVersion(t *testing.T) {
	if version == "" {
		t.Fatal("version is empty")
	}
}
