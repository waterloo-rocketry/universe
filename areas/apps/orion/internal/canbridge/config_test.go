package canbridge

import (
	"testing"
)

type fakeRocketCAN struct {
	boards map[string]bool
	actuators map[string]bool
	states map[string]bool
}

func (f fakeRocketCAN) HasBoard(name string) bool { return f.boards[name] }
func (f fakeRocketCAN) HasActuator(name string) bool { return f.actuators[name] }
func (f fakeRocketCAN) HasState(name string) bool { return f.states[name] }

func TestApplyDefaults(t *testing.T) {
	cfg := Config{}
	cfg.applyDefaults()
	for _, src := range cfg.Sources {
		if *src.Baud != 115200 {
			t.Errorf("default value for Baud not satisfied")
		}
		if src.TxBoard != "DAQ/GROUND" {
			t.Errorf("default value for TxBoard not satisfied")
		}
		if src.TxPrio != "HIGHEST" {
			t.Errorf("default value for TxPrio not satisfied")
		}
		if *src.DefaultStaleAfterMs != 1000 {
			t.Errorf("default value for DefaultStaleAfterMs not satisfied")
		}
		for _, act := range src.Actuators {
			if *act.ConfirmSettleMs != 200 {
				t.Errorf("default value for ConfirmSettleMs not satisfied")
			}
		}
	}
}

