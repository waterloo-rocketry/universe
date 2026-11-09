// Package readers owns decoding and validation; Electron must not parse logs.
package readers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/waterloo-rocketry/universe/areas/apps/data-studio/backend/internal/dataset"
	"io"
	"math"
)

func ReadSynthetic(input io.Reader) (dataset.Dataset, error) {
	var result dataset.Dataset
	decoder := json.NewDecoder(input)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&result); err != nil {
		return result, fmt.Errorf("decode synthetic dataset: %w", err)
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return result, fmt.Errorf("expected exactly one dataset")
	}
	if result.Name == "" || result.Provenance == "" || len(result.Series) == 0 {
		return result, fmt.Errorf("missing dataset metadata or series")
	}
	for _, series := range result.Series {
		if series.SourceID == "" || series.ChannelID == "" || series.Unit == "" || series.TimeBasis == "" || len(series.Samples) == 0 {
			return result, fmt.Errorf("missing series metadata or samples")
		}
		for i, sample := range series.Samples {
			if math.IsNaN(sample.Time) || math.IsInf(sample.Time, 0) || math.IsNaN(sample.Value) || math.IsInf(sample.Value, 0) {
				return result, fmt.Errorf("non-finite sample")
			}
			if i > 0 && sample.Time < series.Samples[i-1].Time {
				return result, fmt.Errorf("sample times must be nondecreasing")
			}
		}
	}
	if result.Warnings == nil {
		result.Warnings = []string{}
	}
	return result, nil
}
func ReadBytes(input []byte) (dataset.Dataset, error) { return ReadSynthetic(bytes.NewReader(input)) }
