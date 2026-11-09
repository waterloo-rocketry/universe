package readers

import (
	"github.com/waterloo-rocketry/universe/areas/apps/data-studio/backend/fixtures"
	"testing"
)

func TestSample(t *testing.T) {
	result, err := ReadBytes(fixtures.Sample)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Series) != 1 || len(result.Series[0].Samples) != 3 || result.Series[0].Samples[1].Value != 103.2 {
		t.Fatalf("unexpected dataset: %+v", result)
	}
}
func TestRejectInvalidData(t *testing.T) {
	for _, input := range []string{`{}`, `{"name":1}`, string(fixtures.Sample) + `{}`, `{"unknown":true}`} {
		if _, err := ReadBytes([]byte(input)); err == nil {
			t.Errorf("accepted invalid input: %s", input)
		}
	}
}
