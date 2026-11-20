package canbridge

import "testing"

// A placeholder so CI has something to run until the real code lands.
func TestSendStates(t *testing.T) {
	for _, s := range []SendState{Written, Failed, Expired, Unknown} {
		if s == "" {
			t.Fatal("empty send state")
		}
	}
}
