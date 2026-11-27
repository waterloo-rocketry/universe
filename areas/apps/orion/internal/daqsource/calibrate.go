package daqsource

import (
	"fmt"
	"math"
)

type Unit string

const (
	PSI Unit = "psi"
	Lbf Unit = "lbf"
	Kg Unit = "kg"
	N Unit = "N"
	DegC Unit = "°C"
	Volt Unit = "V"
	MiVolt Unit = "mV"
	Amp Unit = "A"
	MPS Unit = "m/s"
)

type Calibration interface {
	Apply(voltageReading float64) (value float64, ok bool)
	Unit() Unit
	Text() string
}

type linearCal struct {
	slope float64
	offset float64
	unit Unit
}

type thermistorCal struct {
	supplyV float64
	seriesOhm float64
	betaK float64
	rInfOhm float64
}

func (c linearCal) Apply(v float64) (float64, bool) {
	return c.slope*v + c.offset, true
}

func (c linearCal) Unit() Unit { 
	return c.unit
}

func (c linearCal) Text() string {
	return fmt.Sprintf("%f*x + %f (%s)", c.slope, c.offset, c.unit)
}

func (c thermistorCal) Apply(v float64) (float64, bool) {
	if v == 0 {
		return math.NaN(), false
	}
	r := (c.supplyV - v) / (v / c.seriesOhm)
	return c.betaK / math.Log2(r / c.rInfOhm) - 273.15, true
}

func (c thermistorCal) Unit() Unit {
	return DegC
}

func (c thermistorCal) Text() string {
	return fmt.Sprintf("asdf")
}

func NewLinear(slope float64, offset float64, unit Unit) Calibration {
	return linearCal{slope, offset, unit}
}

func NewThermistor(supplyV, seriesOhm, betaK, rInfOhm float64) Calibration {
	return thermistorCal{supplyV, seriesOhm, betaK, rInfOhm}
}
