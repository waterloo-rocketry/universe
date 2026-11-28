package daqsource

import (
	"encoding/json"
	"math"
	"os"
	"strconv"
	"testing"
)

type Envelope struct {
	Curve string `json:"curve"`
	Data json.RawMessage `json:"data"`
}

type Linear struct {
	Slope  float64 `json:"slope"`
	Offset float64 `json:"offset"`
	Unit   string `json:"unit"`
	Voltage float64 `json:"v"`
	Ok bool `json:"ok"`
	Value string `json:"value"`
}

type Thermistor struct {
	Params []float64 `json:"params"`
	Voltage float64 `json:"v"`
	Ok bool `json:"ok"`
	Value string `json:"value"`
}

func TestCompareOmnibus(t *testing.T) {
	raw, err := os.ReadFile("compare/omnibus.json")
	if err != nil { t.Fatal(err) }

	var rows []Envelope
	if err := json.Unmarshal(raw, &rows); err != nil { t.Fatal(err) }

	for _, env := range rows {
		switch env.Curve {
		case "linear":
			var cfg Linear
			json.Unmarshal(env.Data, &cfg)

			got_val, ok := NewLinear(cfg.Slope, cfg.Offset, Unit(cfg.Unit)).Apply(cfg.Voltage)
			want_val, _ := strconv.ParseFloat(cfg.Value, 64)
			if !ok || math.Abs(got_val - want_val) > 1e-9+1e-9*math.Abs(want_val) {
				t.Errorf("linear v=%v: omnibus=%v orion=(%v,%v)", cfg.Voltage, cfg.Value, got_val, ok)
			}
		case "thermistor": 
			var cfg Thermistor
			json.Unmarshal(env.Data, &cfg)
			
			got_val, ok := NewThermistor(cfg.Params[0], cfg.Params[1], cfg.Params[2], cfg.Params[3]).Apply(cfg.Voltage)
			want_val, _ := strconv.ParseFloat(cfg.Value, 64)
			if !ok || math.Abs(got_val - want_val) > 1e-9+1e-9*math.Abs(want_val) {
				t.Errorf("thermistor v=%v, omnibus=%v, orion=(%v, %v)", cfg.Voltage, cfg.Value, got_val, ok)
			}
		}
	}
}
