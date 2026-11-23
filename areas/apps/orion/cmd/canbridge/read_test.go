package main

import (
	"bytes"
	"testing"
)

func TestLineFramerFixture(t *testing.T) {
	framer := NewLineFramer()

	chunks := [][]byte{
		[]byte("$101:AB"),
		[]byte("C\njunk\n$202"),
		[]byte(":0102\n"),
		bytes.Repeat([]byte{'X'}, maxLine+1),
		[]byte("\n$303:FF\n"),
	}

	var got [][]byte
	for _, chunk := range chunks {
		got = append(got, framer.Feed(chunk)...)
	}

	want := [][]byte{
		[]byte("$101:ABC"),
		[]byte("junk"),
		[]byte("$202:0102"),
		[]byte("$303:FF"),
	}
	if len(got) != len(want) {
		t.Fatalf("got %d lines, want %d: %q", len(got), len(want), got)
	}
	for i := range want {
		if !bytes.Equal(got[i], want[i]) {
			t.Errorf("line %d = %q, want %q", i, got[i], want[i])
		}
	}
	if got := framer.ErrorCount(); got != 1 {
		t.Fatalf("framing error count = %d, want 1", got)
	}
}

func TestLineFramerAcrossChunks(t *testing.T) {
	framer := NewLineFramer()

	if lines := framer.Feed([]byte("$1")); len(lines) != 0 {
		t.Fatalf("unexpected complete lines: %q", lines)
	}
	if lines := framer.Feed([]byte("23:4\n$456:78")); len(lines) != 1 || string(lines[0]) != "$123:4" {
		t.Fatalf("lines = %q, want [$123:4]", lines)
	}
	if lines := framer.Feed([]byte("\n")); len(lines) != 1 || string(lines[0]) != "$456:78" {
		t.Fatalf("lines = %q, want [$456:78]", lines)
	}
}

func FuzzLineFramerNoPanic(f *testing.F) {
	f.Add([]byte("$123:AB\n"))
	f.Add([]byte{})
	f.Add(bytes.Repeat([]byte{'X'}, 1024))
	f.Add([]byte("$123:AB\njunk\n\n"))

	f.Fuzz(func(t *testing.T, chunk []byte) {
		framer := NewLineFramer()
		_ = framer.Feed(chunk)
		_ = framer.ErrorCount()
		framer.Reset()
		_ = framer.Feed(chunk)
	})
}
