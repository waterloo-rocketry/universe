package canbridge

import (
	"testing"
)

type fakeRocketCAN struct {
	boards    map[string]bool
	actuators map[string]bool
	states    map[string]bool
}

func (f fakeRocketCAN) HasBoard(name string) bool    { return f.boards[name] }
func (f fakeRocketCAN) HasActuator(name string) bool { return f.actuators[name] }
func (f fakeRocketCAN) HasState(name string) bool    { return f.states[name] }

func TestApplyDefaults(t *testing.T) {
	// A source and actuator with none of the defaulted keys set, so
	// applyDefaults has something to fill in.
	cfg := Config{Sources: []Source{{
		ID:        "can-injector",
		Actuators: []Actuator{{ID: "ox-injector-valve"}},
	}}}
	cfg.applyDefaults()

	src := cfg.Sources[0]
	if src.Baud == nil || *src.Baud != 115200 {
		t.Errorf("Baud = %v, want 115200", src.Baud)
	}
	if src.TxBoard != "DAQ/GROUND" {
		t.Errorf("TxBoard = %q, want %q", src.TxBoard, "DAQ/GROUND")
	}
	if src.DefaultStaleAfterMs == nil || *src.DefaultStaleAfterMs != 1000 {
		t.Errorf("DefaultStaleAfterMs = %v, want 1000", src.DefaultStaleAfterMs)
	}
	act := src.Actuators[0]
	if act.ConfirmSettleMs == nil || *act.ConfirmSettleMs != 200 {
		t.Errorf("ConfirmSettleMs = %v, want 200", act.ConfirmSettleMs)
	}
}

func TestApplyDefaultsKeepsSetValues(t *testing.T) {
	// Values already present must not be overwritten by the defaults.
	baud := 9600
	stale := uint32(5000)
	settle := uint32(500)
	cfg := Config{Sources: []Source{{
		ID:                  "can-injector",
		Baud:                &baud,
		TxBoard:             "INJECTOR/ROCKET",
		DefaultStaleAfterMs: &stale,
		Actuators:           []Actuator{{ID: "ox-injector-valve", ConfirmSettleMs: &settle}},
	}}}
	cfg.applyDefaults()

	src := cfg.Sources[0]
	if *src.Baud != 9600 {
		t.Errorf("Baud = %d, want 9600 (should not be overwritten)", *src.Baud)
	}
	if src.TxBoard != "INJECTOR/ROCKET" {
		t.Errorf("TxBoard = %q, want it left unchanged", src.TxBoard)
	}
	if *src.DefaultStaleAfterMs != 5000 {
		t.Errorf("DefaultStaleAfterMs = %d, want it left unchanged", *src.DefaultStaleAfterMs)
	}
	if *src.Actuators[0].ConfirmSettleMs != 500 {
		t.Errorf("ConfirmSettleMs = %d, want it left unchanged", *src.Actuators[0].ConfirmSettleMs)
	}
}

func TestCheckSerialOrMockWithoutFormat(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{
			name: "mock with format passes",
			cfg: Config{Sources: []Source{{
				Type:   "can",
				Port:   "mock:cold-flow",
				Format: "usb",
			}}},
			wantErr: false,
		},
		{
			name: "mock without format fails",
			cfg: Config{Sources: []Source{{
				Type:   "can",
				Port:   "mock:cold-flow",
				Format: "",
			}}},
			wantErr: true,
		},
		{
			name: "usb serial without format fails",
			cfg: Config{Sources: []Source{{
				Type:   "can",
				Port:   "usb:1234:5678:INJECTOR",
				Format: "",
			}}},
			wantErr: true,
		},
		{
			name: "COM4 without format fails",
			cfg: Config{Sources: []Source{{
				Type:   "can",
				Port:   "COM4",
				Format: "",
			}}},
			wantErr: true,
		},
		{
			name: "file replay without format passes (format is ignored)",
			cfg: Config{Sources: []Source{{
				Type:   "can",
				Port:   "file:flight.canlog",
				Format: "",
			}}},
			wantErr: false,
		},
		{
			name: "non-can source with serial port and no format passes (rule is can-only)",
			cfg: Config{Sources: []Source{{
				Type:   "daq",
				Port:   "usb:1234:5678:INJECTOR",
				Format: "",
			}}},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkSerialOrMockWithoutFormat(tt.cfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckNotCommandedOnLiveTelemetry(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{
			name: "LTT source with command false passes",
			cfg: Config{Sources: []Source{{
				Type:       "can",
				Connection: "LIVE_TELEMETRY",
				Actuators:  []Actuator{{ID: "ox-injector-valve", Command: false}},
			}}},
			wantErr: false,
		},
		{
			name: "LTT source with command true fails",
			cfg: Config{Sources: []Source{{
				Type:       "can",
				Connection: "LIVE_TELEMETRY",
				Actuators:  []Actuator{{ID: "ox-injector-valve", Command: true}},
			}}},
			wantErr: true,
		},
		{
			name: "non-LTT source with command true passes",
			cfg: Config{Sources: []Source{{
				Type:       "can",
				Connection: "UMBILICAL",
				Actuators:  []Actuator{{ID: "ox-injector-valve", Command: true}},
			}}},
			wantErr: false,
		},
		{
			name: "non-can LTT source with command true passes (rule is can-only)",
			cfg: Config{Sources: []Source{{
				Type:       "daq",
				Connection: "LIVE_TELEMETRY",
				Actuators:  []Actuator{{ID: "ox-injector-valve", Command: true}},
			}}},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkNotCommandedOnLiveTelemetry(tt.cfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckUSBDebugInOpsConfig(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{
			name: "ops mode without USB debug source passes",
			cfg: Config{
				Server:  Server{Mode: "ops"},
				Sources: []Source{{Type: "can", Connection: "LIVE_TELEMETRY"}},
			},
			wantErr: false,
		},
		{
			name: "ops mode with USB debug source fails",
			cfg: Config{
				Server:  Server{Mode: "ops"},
				Sources: []Source{{Type: "can", Connection: "USB_DEBUG"}},
			},
			wantErr: true,
		},
		{
			name: "test mode with USB debug source passes",
			cfg: Config{
				Server:  Server{Mode: "test"},
				Sources: []Source{{Type: "can", Connection: "USB_DEBUG"}},
			},
			wantErr: false,
		},
		{
			name: "non-can USB debug source in ops passes (rule is can-only)",
			cfg: Config{
				Server:  Server{Mode: "ops"},
				Sources: []Source{{Type: "daq", Connection: "USB_DEBUG"}},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkUSBDebugInOpsConfig(tt.cfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckMockInOpsConfig(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{
			name: "ops mode without mock port passes",
			cfg: Config{
				Server:  Server{Mode: "ops"},
				Sources: []Source{{Type: "can", Port: "usb:1234:5678:INJECTOR"}},
			},
			wantErr: false,
		},
		{
			name: "ops mode with mock port fails",
			cfg: Config{
				Server:  Server{Mode: "ops"},
				Sources: []Source{{Type: "can", Port: "mock:cold-flow"}},
			},
			wantErr: true,
		},
		{
			name: "test mode with mock port passes",
			cfg: Config{
				Server:  Server{Mode: "test"},
				Sources: []Source{{Type: "can", Port: "mock:cold-flow"}},
			},
			wantErr: false,
		},
		{
			name: "ops mode with second mock port fails",
			cfg: Config{
				Server: Server{Mode: "ops"},
				Sources: []Source{
					{Type: "can", Port: "COM4"},
					{Type: "can", Port: "mock:cold-flow"},
				},
			},
			wantErr: true,
		},
		{
			name: "non-can mock port in ops passes (rule is can-only)",
			cfg: Config{
				Server:  Server{Mode: "ops"},
				Sources: []Source{{Type: "daq", Port: "mock:cold-flow"}},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkMockInOpsConfig(tt.cfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckCommandableActuatorWithoutOperator(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{
			name: "ops mode, commandable actuator, operators present passes",
			cfg: Config{
				Server: Server{Mode: "ops", CommandOperators: []string{"mc-laptop-2-*"}},
				Sources: []Source{{
					Type:      "can",
					Actuators: []Actuator{{ID: "ox-injector-valve", Command: true}},
				}},
			},
			wantErr: false,
		},
		{
			name: "ops mode, commandable actuator, no operators fails",
			cfg: Config{
				Server: Server{Mode: "ops"},
				Sources: []Source{{
					Type:      "can",
					Actuators: []Actuator{{ID: "ox-injector-valve", Command: true}},
				}},
			},
			wantErr: true,
		},
		{
			name: "ops mode, no commandable actuator, no operators passes",
			cfg: Config{
				Server: Server{Mode: "ops"},
				Sources: []Source{{
					Type:      "can",
					Actuators: []Actuator{{ID: "ox-injector-valve", Command: false}},
				}},
			},
			wantErr: false,
		},
		{
			name: "test mode, commandable actuator, no operators passes",
			cfg: Config{
				Server: Server{Mode: "test"},
				Sources: []Source{{
					Type:      "can",
					Actuators: []Actuator{{ID: "ox-injector-valve", Command: true}},
				}},
			},
			wantErr: false,
		},
		{
			name: "non-can commandable actuator, no operators passes (rule is can-only)",
			cfg: Config{
				Server: Server{Mode: "ops"},
				Sources: []Source{{
					Type:      "daq",
					Actuators: []Actuator{{ID: "ox-injector-valve", Command: true}},
				}},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkCommandableActuatorWithoutOperator(tt.cfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckNotMainSendsCommands(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{
			name: "no parent, commandable actuator passes",
			cfg: Config{
				Sources: []Source{{
					Type:      "can",
					Actuators: []Actuator{{ID: "ox-injector-valve", Command: true}},
				}},
			},
			wantErr: false,
		},
		{
			name: "child (has parent), commandable actuator fails",
			cfg: Config{
				Parent: &Parent{Address: "pad-orion:9000"},
				Sources: []Source{{
					Type:      "can",
					Actuators: []Actuator{{ID: "ox-injector-valve", Command: true}},
				}},
			},
			wantErr: true,
		},
		{
			name: "child (has parent), no commandable actuator passes",
			cfg: Config{
				Parent: &Parent{Address: "pad-orion:9000"},
				Sources: []Source{{
					Type:      "can",
					Actuators: []Actuator{{ID: "ox-injector-valve", Command: false}},
				}},
			},
			wantErr: false,
		},
		{
			name: "non-can child source with commandable actuator passes (rule is can-only)",
			cfg: Config{
				Parent: &Parent{Address: "pad-orion:9000"},
				Sources: []Source{{
					Type:      "daq",
					Actuators: []Actuator{{ID: "ox-injector-valve", Command: true}},
				}},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkNotMainSendsCommands(tt.cfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckStateNotInRocketCAN(t *testing.T) {
	// a fake that knows one real board, one real actuator, and one real state.
	known := fakeRocketCAN{
		boards:    map[string]bool{"INJECTOR/ROCKET": true},
		actuators: map[string]bool{"OX_INJECTOR_VALVE": true},
		states:    map[string]bool{"OFF": true},
	}

	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{
			name: "all names known passes",
			cfg: Config{Sources: []Source{{
				Type:   "can",
				Boards: []string{"INJECTOR/ROCKET"},
				Actuators: []Actuator{{
					RocketCAN: "OX_INJECTOR_VALVE",
					SafeState: "OFF",
				}},
			}}},
			wantErr: false,
		},
		{
			name: "unknown board fails",
			cfg: Config{Sources: []Source{{
				Type:   "can",
				Boards: []string{"INJECTOR/TYPO"},
			}}},
			wantErr: true,
		},
		{
			name: "omitted safe_state passes",
			cfg: Config{Sources: []Source{{
				Type:   "can",
				Boards: []string{"INJECTOR/ROCKET"},
				Actuators: []Actuator{{
					RocketCAN: "OX_INJECTOR_VALVE",
				}},
			}}},
			wantErr: false,
		},
		{
			name: "unknown actuator rocketcan fails",
			cfg: Config{Sources: []Source{{
				Type:   "can",
				Boards: []string{"INJECTOR/ROCKET"},
				Actuators: []Actuator{{
					RocketCAN: "OX_INJECTOR_TYPO",
					SafeState: "OFF",
				}},
			}}},
			wantErr: true,
		},
		{
			name: "unknown safe_state fails",
			cfg: Config{Sources: []Source{{
				Type:   "can",
				Boards: []string{"INJECTOR/ROCKET"},
				Actuators: []Actuator{{
					RocketCAN: "OX_INJECTOR_VALVE",
					SafeState: "TYPO",
				}},
			}}},
			wantErr: true,
		},
		{
			name: "non-can source with unknown board passes (rule is can-only)",
			cfg: Config{Sources: []Source{{
				Type:   "daq",
				Boards: []string{"INJECTOR/TYPO"},
			}}},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkStateNotInRocketCAN(tt.cfg, known)
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckBareCOMnPortInOps(t *testing.T) {
	// this rule returns a warning string: "" means no warning.
	tests := []struct {
		name     string
		cfg      Config
		wantWarn bool
	}{
		{
			name: "ops mode with bare COM port warns",
			cfg: Config{
				Server:  Server{Mode: "ops"},
				Sources: []Source{{Type: "can", Port: "COM4"}},
			},
			wantWarn: true,
		},
		{
			name: "ops mode with usb port does not warn",
			cfg: Config{
				Server:  Server{Mode: "ops"},
				Sources: []Source{{Type: "can", Port: "usb:1234:5678:INJECTOR"}},
			},
			wantWarn: false,
		},
		{
			name: "test mode with bare COM port does not warn",
			cfg: Config{
				Server:  Server{Mode: "test"},
				Sources: []Source{{Type: "can", Port: "COM4"}},
			},
			wantWarn: false,
		},
		{
			name: "non-can source with bare COM port does not warn (rule is can-only)",
			cfg: Config{
				Server:  Server{Mode: "ops"},
				Sources: []Source{{Type: "daq", Port: "COM4"}},
			},
			wantWarn: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			warn := checkBareCOMnPortInOps(tt.cfg)
			if (warn != "") != tt.wantWarn {
				t.Errorf("got warning %q, wantWarn %v", warn, tt.wantWarn)
			}
		})
	}
}

func TestCheck(t *testing.T) {
	known := fakeRocketCAN{
		boards:    map[string]bool{"INJECTOR/ROCKET": true},
		actuators: map[string]bool{"OX_INJECTOR_VALVE": true},
		states:    map[string]bool{"OFF": true},
	}

	t.Run("clean ops config has no errors or warnings", func(t *testing.T) {
		cfg := Config{
			Server: Server{Mode: "ops", CommandOperators: []string{"mc-laptop-2-*"}},
			Sources: []Source{{
				Type:       "can",
				ID:         "can-injector",
				Connection: "UMBILICAL",
				Port:       "usb:1234:5678:INJECTOR",
				Format:     "usb",
				Boards:     []string{"INJECTOR/ROCKET"},
				Actuators: []Actuator{{
					ID:        "ox-injector-valve",
					RocketCAN: "OX_INJECTOR_VALVE",
					Command:   true,
					SafeState: "OFF",
				}},
			}},
		}
		errs, warnings := cfg.Check(known)
		if len(errs) != 0 {
			t.Errorf("got %d errors, want 0: %v", len(errs), errs)
		}
		if len(warnings) != 0 {
			t.Errorf("got %d warnings, want 0: %v", len(warnings), warnings)
		}
	})

	t.Run("applies defaults before checking", func(t *testing.T) {
		// a config with no defaulted keys set. Check must fill them in, and
		// the clean config above still passes, so defaults don't trip a rule
		cfg := Config{
			Server: Server{Mode: "test"},
			Sources: []Source{{
				Type:   "can",
				ID:     "can-injector",
				Port:   "usb:1234:5678:INJECTOR",
				Format: "usb",
			}},
		}
		cfg.Check(known)
		if cfg.Sources[0].Baud == nil || *cfg.Sources[0].Baud != 115200 {
			t.Errorf("Check did not apply the baud default")
		}
	})

	t.Run("collects several errors and a warning at once", func(t *testing.T) {
		// this ops config accumulates three distinct error rules and a warning:
		//   - USB_DEBUG source in ops            (checkUSBDebugInOpsConfig)
		//   - commandable actuator, no operators (checkCommandableActuatorWithoutOperator)
		//   - unknown board name                 (checkStateNotInRocketCAN)
		//   - bare COMn port in ops              (warning)
		cfg := Config{
			Server: Server{Mode: "ops"}, // no CommandOperators
			Sources: []Source{{
				Type:       "can",
				ID:         "can-debug",
				Connection: "USB_DEBUG",
				Port:       "COM4",
				Format:     "usb",
				Boards:     []string{"INJECTOR/TYPO"},
				Actuators: []Actuator{{
					ID:        "ox-injector-valve",
					RocketCAN: "OX_INJECTOR_VALVE",
					Command:   true,
					SafeState: "OFF",
				}},
			}},
		}
		errs, warnings := cfg.Check(known)
		if len(errs) != 3 {
			t.Errorf("got %d errors, want 3: %v", len(errs), errs)
		}
		if len(warnings) != 1 {
			t.Errorf("got %d warnings, want 1: %v", len(warnings), warnings)
		}
	})

	t.Run("non-can source skips all can rules", func(t *testing.T) {
		// since rules are scoped to type = "can", daq sources will never produce errors or warnings
		cfg := Config{
			Server: Server{Mode: "ops"}, // no CommandOperators
			Sources: []Source{{
				Type:       "daq",
				ID:         "daq-main",
				Connection: "USB_DEBUG",
				Port:       "COM4",
				Boards:     []string{"INJECTOR/TYPO"},
				Actuators: []Actuator{{
					ID:        "ox-injector-valve",
					RocketCAN: "OX_INJECTOR_TYPO",
					Command:   true,
					SafeState: "TYPO",
				}},
			}},
		}
		errs, warnings := cfg.Check(known)
		if len(errs) != 0 {
			t.Errorf("got %d errors, want 0: %v", len(errs), errs)
		}
		if len(warnings) != 0 {
			t.Errorf("got %d warnings, want 0: %v", len(warnings), warnings)
		}
	})
}
