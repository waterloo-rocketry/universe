package canbridge

import (
	"fmt"
	"strings"
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

func checkSerialOrMockWithoutFormat(cfg Config) error {
	for _, src := range cfg.Sources {
		port := src.Port
		if strings.HasPrefix(port, "usb") || strings.HasPrefix(port, "/dev/") || 
			 strings.HasPrefix(port, "COM") || strings.HasPrefix(port, "mock:") {
			if src.Format == "" {
				return fmt.Errorf("format expected when port is serial or mock")
			}
		}
	}
	return nil
}

func checkNotCommandedOnLiveTelemetry(cfg Config) error {
	for _, src := range cfg.Sources {
		if src.Connection == "LIVE_TELEMETRY" {
			for _, act := range src.Actuators {
				if act.Command {
					return fmt.Errorf("LTT radio for source %q is receive-only and should not be able to send commands (actuator: %q)", src.ID, act.ID)
				}
			}
		}
	}
	return nil
}

func checkUSBDebugInOpsConfig(cfg Config) error {
	if cfg.Server.Mode == "ops" {
		for _, src := range cfg.Sources {
			if src.Connection == "USB_DEBUG" {
				return fmt.Errorf("ops config cannot contain USB_DEBUG source (source: %q)", src.ID)
			}
		}
	}
	return nil
}

func checkMockInOpsConfig(cfg Config) error {
	if cfg.Server.Mode == "ops" {
		for _, src := range cfg.Sources {
			if strings.HasPrefix(src.Port, "mock:") {
				return fmt.Errorf("ops config cannot contain mock port (source: %q)", src.ID)
			}
		}
	}
	return nil
}

func checkCommandableActuatorWithoutOperator(cfg Config) error {
	if cfg.Server.Mode == "ops" && len(cfg.Server.CommandOperators) == 0 {
		for _, src := range cfg.Sources {
			for _, act := range src.Actuators {
				if act.Command {
					return fmt.Errorf("actuator %q from source %q cannot be commandable in ops config when no command operators are available", act.ID, src.ID)
				}
			}
		}
	}
	return nil
}

func checkNotMainSendsCommands(cfg Config) error {
	if cfg.Parent != nil {
		for _, src := range cfg.Sources {
			for _, act := range src.Actuators {
				if act.Command {
					return fmt.Errorf("actuator %q from source %q cannot be commandable from a child Orion", act.ID, src.ID)
				}
			}
		}
	}
	return nil
}

func checkStateNotInRocketCAN(cfg Config, names RocketCANNames) error {
	for _, src := range cfg.Sources {
		for _, b := range src.Boards {
			if !names.HasBoard(b) {
				return fmt.Errorf("board %q in source %q is not in RocketCAN names", b, src.ID)
			}
		}
		for _, act := range src.Actuators {
			if !names.HasActuator(act.RocketCAN) {
				return fmt.Errorf("actuator RocketCAN %q in source %q is not in RocketCAN names", act.RocketCAN, src.ID)
			}
			if !names.HasState(act.SafeState) {
				return fmt.Errorf("safe state %q in source %q is not in RocketCAN names", act.SafeState, src.ID)
			}
		}
	}
	return nil
}

func checkBareCOMnPortInOps(cfg Config) error {
	if cfg.Server.Mode == "ops" {
		for _, src := range cfg.Sources {
			if strings.HasPrefix(src.Port, "COM") {
				return fmt.Errorf("bare COMn port in source %q; use 'usb:...' instead", src.ID)
			}
		}
	}
	return nil
}
