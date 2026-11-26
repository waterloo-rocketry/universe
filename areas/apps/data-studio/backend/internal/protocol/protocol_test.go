package protocol

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestProtocolRecoveryAndCorrelation(t *testing.T) {
	var output bytes.Buffer
	err := Serve(strings.NewReader("bad\n"+`{"id":7,"method":"missing"}`+"\n"+`{"id":8,"method":"dataset.sample"}`+"\n"), &output)
	if err != nil {
		t.Fatal(err)
	}
	decoder := json.NewDecoder(&output)
	for i, id := range []int64{0, 7, 8} {
		var response Response
		if err := decoder.Decode(&response); err != nil {
			t.Fatal(err)
		}
		if response.ID != id {
			t.Fatalf("wrong correlation id: %d", response.ID)
		}
		if i < 2 && response.Error == "" {
			t.Fatal("expected error")
		}
		if i == 2 && (response.Result == nil || response.Result.Name != "Synthetic pressure run") {
			t.Fatal("expected sample after invalid requests")
		}
	}
}
