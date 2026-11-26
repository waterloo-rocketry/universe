package main

// Tests for the demo example-* commands (example.go).

import (
	"context"
	"net"
	"strings"
	"testing"
)

// startExampleServer runs the example server on a free port until the test
// ends, and returns its address.
func startExampleServer(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, stop := context.WithCancel(context.Background())
	served := make(chan error, 1)
	go func() { served <- serveExample(ctx, listener) }()
	t.Cleanup(func() {
		stop()
		if err := <-served; err != nil {
			t.Errorf("example server: %v", err)
		}
	})
	return listener.Addr().String()
}

func TestAnswer(t *testing.T) {
	if got := answer("ping"); got != "pong" {
		t.Errorf(`answer("ping") = %q, want "pong"`, got)
	}
	if got := answer("hello"); !strings.HasPrefix(got, `server got "hello" at `) {
		t.Errorf(`answer("hello") = %q`, got)
	}
}

// Both clients, against a server running separately.
func TestExampleClients(t *testing.T) {
	addr := startExampleServer(t)
	tests := []struct {
		args []string
		want []string // each line of stdout, or its start for the server's timed replies
	}{
		{[]string{"example-client", "--addr", addr, "ping"}, []string{"pong"}},
		{[]string{"example-client", "--addr", addr, "hello orion"}, []string{`server got "hello orion" at `}},
		{[]string{"example-stream-client", "--addr", addr, "ping", "one", "two"}, []string{"pong", `server got "one" at `, `server got "two" at `}},
	}
	for _, tt := range tests {
		code, stdout, stderr := runOrion(tt.args...)
		lines := strings.Split(strings.TrimSuffix(stdout, "\n"), "\n")
		if code != exitOK || len(lines) != len(tt.want) {
			t.Errorf("%q: code %d, stdout %q, stderr %q", tt.args, code, stdout, stderr)
			continue
		}
		for i, want := range tt.want {
			if !strings.HasPrefix(lines[i], want) {
				t.Errorf("%q: line %d is %q, want it to start with %q", tt.args, i, lines[i], want)
			}
		}
	}
}

func TestExampleNoServer(t *testing.T) {
	for _, cmd := range []string{"example-client", "example-stream-client"} {
		code, _, stderr := runOrion(cmd, "--addr", "127.0.0.1:1", "ping")
		if code != exitRuntime || !strings.Contains(stderr, "orion "+cmd+":") {
			t.Errorf("%s: code %d, stderr %q", cmd, code, stderr)
		}
	}
}

func TestExampleBadArguments(t *testing.T) {
	for _, args := range [][]string{
		{"example-client"},
		{"example-client", "a", "b"},
		{"example-stream-client"},
		{"example-server", "a"},
		{"example-echo", "a"},
	} {
		if code, _, stderr := runOrion(args...); code != exitConfig || !strings.Contains(stderr, "usage:") {
			t.Errorf("%q: code %d, stderr %q", args, code, stderr)
		}
	}
}
