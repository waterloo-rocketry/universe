package daqsource

import (
	"fmt"
	"math"
)

type Unit string

// issue #92 should own this full set of units
const (
	PSI    Unit = "psi"
	Lbf    Unit = "lbf"
	Kg     Unit = "kg"
	N      Unit = "N"
	DegC   Unit = "°C"
	Volt   Unit = "V"
	MiVolt Unit = "mV"
	Amp    Unit = "A"
	MPS    Unit = "m/s"
)

type Calibration interface {
	Apply(voltageReading float64) (value float64, ok bool)
	Unit() Unit
	Text() string
}

// NOTE: this is a placeholder until issue #92 is complete, which holds the real struct
type CalibrationConfig struct {
	Linear     *linearCal
	Thermistor *thermistorCal
}

type linearCal struct {
	slope  float64
	offset float64
	unit   Unit
}

func NewLinear(slope float64, offset float64, unit Unit) Calibration {
	return linearCal{slope, offset, unit}
}

func (c linearCal) Apply(v float64) (float64, bool) {
	return c.slope*v + c.offset, true
}
func (c linearCal) Unit() Unit {
	return c.unit
}
func (c linearCal) Text() string {
	return fmt.Sprintf("%v*x + %v (%s)", c.slope, c.offset, c.unit)
}

type thermistorCal struct {
	supplyV   float64
	seriesOhm float64
	betaK     float64
	rInfOhm   float64
}

func NewThermistor(supplyV, seriesOhm, betaK, rInfOhm float64) Calibration {
	return thermistorCal{supplyV, seriesOhm, betaK, rInfOhm}
}

func (c thermistorCal) Apply(v float64) (float64, bool) {
	if v == 0 {
		return math.NaN(), false  // Omnibus yields ZeroDivisionError
	}
	r := (c.supplyV - v) / (v / c.seriesOhm)
	if r <= 0 {
		return math.NaN(), false  // Omnibus returns 0
	}
	t := c.betaK/math.Log2(r/c.rInfOhm) - 273.15
	if math.IsNaN(t) || math.IsInf(t, 0) {
		return math.NaN(), false
	}
	return t, true
}
func (c thermistorCal) Unit() Unit {
	return DegC
}
func (c thermistorCal) Text() string {
	return fmt.Sprintf("Thermistor(V=%v, R=%v, β=%v, r_inf=%v) (%s)", c.supplyV, c.seriesOhm, c.betaK, c.rInfOhm, c.Unit())
}

func FromConfig(c CalibrationConfig) Calibration {
	switch {
	case c.Linear != nil:
		return NewLinear(c.Linear.slope, c.Linear.offset, c.Linear.unit)
	case c.Thermistor != nil:
		return NewThermistor(c.Thermistor.supplyV, c.Thermistor.seriesOhm, c.Thermistor.betaK, c.Thermistor.rInfOhm)
	default:
		// issue #92 guarantees that exactly one is set, so this should not be a problem
		panic("calibration config has no set variant")
	}
}
