package canbridge

import (
	"strings"
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

func ptr[T any](v T) *T { return &v }

func TestApplyDefaults(t *testing.T) {
	// A source and actuator with none of the defaulted keys set, so
	// applyDefaults has something to fill in.
	cfg := Config{Source: Source{
		ID:        "can-injector",
		Actuators: []Actuator{{ID: "ox-injector-valve"}},
	}}
	cfg.applyDefaults()

	if cfg.Orion.BackfillWindowS == nil || *cfg.Orion.BackfillWindowS != 30 {
		t.Errorf("BackfillWindowS = %v, want 30", cfg.Orion.BackfillWindowS)
	}
	src := cfg.Source
	if src.Baud == nil || *src.Baud != 115200 {
		t.Errorf("Baud = %v, want 115200", src.Baud)
	}
	if src.TxBoard != "DAQ/GROUND" {
		t.Errorf("TxBoard = %q, want %q", src.TxBoard, "DAQ/GROUND")
	}
	if src.DefaultStaleAfterMs == nil || *src.DefaultStaleAfterMs != 2000 {
		t.Errorf("DefaultStaleAfterMs = %v, want 2000", src.DefaultStaleAfterMs)
	}
	if act := src.Actuators[0]; act.ConfirmSettleMs == nil || *act.ConfirmSettleMs != 200 {
		t.Errorf("ConfirmSettleMs = %v, want 200", act.ConfirmSettleMs)
	}
}

func TestApplyDefaultsKeepsSetValues(t *testing.T) {
	// Values already present must not be overwritten by the defaults.
	cfg := Config{
		Orion: Orion{BackfillWindowS: ptr(10)},
		Source: Source{
			ID:                  "can-injector",
			Baud:                ptr(9600),
			TxBoard:             "INJECTOR/ROCKET",
			DefaultStaleAfterMs: ptr(uint32(5000)),
			Actuators:           []Actuator{{ID: "ox-injector-valve", ConfirmSettleMs: ptr(uint32(500))}},
		},
	}
	cfg.applyDefaults()

	if *cfg.Orion.BackfillWindowS != 10 {
		t.Errorf("BackfillWindowS = %d, want it left unchanged", *cfg.Orion.BackfillWindowS)
	}
	src := cfg.Source
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
		src     Source
		wantErr bool
	}{
		{"mock with format passes", Source{Port: "mock:cold-flow", Format: "usb"}, false},
		{"mock without format fails", Source{Port: "mock:cold-flow"}, true},
		{"usb serial without format fails", Source{Port: "usb:1234:5678:INJECTOR"}, true},
		{"COM4 without format fails", Source{Port: "COM4"}, true},
		{"file replay without format passes (format is ignored)", Source{Port: "file:flight.canlog"}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkSerialOrMockWithoutFormat(Config{Source: tt.src})
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckBackfillWindowPositive(t *testing.T) {
	tests := []struct {
		name    string
		orion   Orion
		wantErr bool
	}{
		{"a positive backfill window passes", Orion{BackfillWindowS: ptr(30)}, false},
		{"a zero backfill window fails", Orion{BackfillWindowS: ptr(0)}, true},
		{"a negative backfill window fails", Orion{BackfillWindowS: ptr(-1)}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkBackfillWindowPositive(Config{Orion: tt.orion, Source: Source{ID: "can-injector"}})
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckLogDirSet(t *testing.T) {
	tests := []struct {
		name    string
		src     Source
		wantErr bool
	}{
		{"log_dir set passes", Source{ID: "can-injector", LogDir: "/var/log/orion/canlog"}, false},
		{"log_dir missing fails", Source{ID: "can-injector"}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkLogDirSet(Config{Source: tt.src})
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckMockInOpsConfig(t *testing.T) {
	tests := []struct {
		name    string
		mode    string
		port    string
		wantErr bool
	}{
		{"ops mode with real port passes", "ops", "usb:1234:5678:INJECTOR", false},
		{"ops mode with mock port fails", "ops", "mock:cold-flow", true},
		{"test mode with mock port passes", "test", "mock:cold-flow", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkMockInOpsConfig(Config{Orion: Orion{Mode: tt.mode}, Source: Source{Port: tt.port}})
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckCommandableActuatorFields(t *testing.T) {
	tests := []struct {
		name    string
		act     Actuator
		wantErr bool
	}{
		{"status-only actuator needs no critical", Actuator{ID: "ox-injector-valve"}, false},
		{"commandable with critical passes", Actuator{ID: "v", Command: true, Critical: ptr(false)}, false},
		{"commandable without critical fails", Actuator{ID: "v", Command: true}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkCommandableActuatorFields(Config{Source: Source{Actuators: []Actuator{tt.act}}})
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
		src     Source
		wantErr bool
	}{
		{
			name: "all names known passes",
			src: Source{
				Boards:    []string{"INJECTOR/ROCKET"},
				Actuators: []Actuator{{RocketCAN: "OX_INJECTOR_VALVE", SafeState: "OFF"}},
			},
		},
		{
			name:    "unknown board fails",
			src:     Source{Boards: []string{"INJECTOR/TYPO"}},
			wantErr: true,
		},
		{
			name: "omitted safe_state passes",
			src: Source{
				Boards:    []string{"INJECTOR/ROCKET"},
				Actuators: []Actuator{{RocketCAN: "OX_INJECTOR_VALVE"}},
			},
		},
		{
			name: "unknown actuator rocketcan fails",
			src: Source{
				Boards:    []string{"INJECTOR/ROCKET"},
				Actuators: []Actuator{{RocketCAN: "OX_INJECTOR_TYPO", SafeState: "OFF"}},
			},
			wantErr: true,
		},
		{
			name: "unknown safe_state fails",
			src: Source{
				Boards:    []string{"INJECTOR/ROCKET"},
				Actuators: []Actuator{{RocketCAN: "OX_INJECTOR_VALVE", SafeState: "TYPO"}},
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkStateNotInRocketCAN(Config{Source: tt.src}, known)
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
		mode     string
		port     string
		wantWarn bool
	}{
		{"ops mode with bare COM port warns", "ops", "COM4", true},
		{"ops mode with usb port does not warn", "ops", "usb:1234:5678:INJECTOR", false},
		{"test mode with bare COM port does not warn", "test", "COM4", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			warn := checkBareCOMnPortInOps(Config{Orion: Orion{Mode: tt.mode}, Source: Source{Port: tt.port}})
			if (warn != "") != tt.wantWarn {
				t.Errorf("got warning %q, wantWarn %v", warn, tt.wantWarn)
			}
		})
	}
}

func TestCheck(t *testing.T) {
	known := fakeRocketCAN{
		boards:    map[string]bool{"INJECTOR/ROCKET": true},
		actuators: map[string]bool{"OX_INJECTOR_VALVE": true, "OX_VENT_VALVE": true},
		states:    map[string]bool{"OFF": true},
	}

	t.Run("clean ops config has no errors or warnings", func(t *testing.T) {
		cfg := Config{
			ConfigVersion: 1,
			Orion:         Orion{Server: "http://127.0.0.1:7400", Mode: "ops"},
			Source: Source{
				ID:         "can-injector",
				Connection: "UMBILICAL",
				Port:       "usb:1234:5678:INJECTOR",
				Format:     "usb",
				Boards:     []string{"INJECTOR/ROCKET"},
				LogDir:     "/var/log/orion/canlog",
				Actuators: []Actuator{{
					ID:        "ox-injector-valve",
					RocketCAN: "OX_INJECTOR_VALVE",
				}, {
					ID:              "fill-vent-valve",
					RocketCAN:       "OX_VENT_VALVE",
					Command:         true,
					Critical:        ptr(true),
					SafeState:       "OFF",
					ConfirmSettleMs: ptr(uint32(200)),
				}},
			},
		}
		errs, warnings := cfg.Check(known)
		if len(errs) != 0 {
			t.Errorf("got %d errors, want 0: %v", len(errs), errs)
		}
		if len(warnings) != 0 {
			t.Errorf("got %d warnings, want 0: %v", len(warnings), warnings)
		}
	})

	t.Run("commandable USB_DEBUG source with a backfill window in ops passes", func(t *testing.T) {
		cfg := Config{
			ConfigVersion: 1,
			Orion:         Orion{Server: "http://127.0.0.1:7400", Mode: "ops", BackfillWindowS: ptr(30)},
			Source: Source{
				ID:         "can-ltt-1",
				Connection: "USB_DEBUG",
				Port:       "usb:1209:0001:LTT1",
				Format:     "usb",
				LogDir:     "~/OrionLogs/canlog",
				Actuators: []Actuator{{
					ID:        "fill-vent-valve",
					RocketCAN: "OX_VENT_VALVE",
					Command:   true,
					Critical:  ptr(true),
				}},
			},
		}
		if errs, _ := cfg.Check(known); len(errs) != 0 {
			t.Errorf("got %d errors, want 0: %v", len(errs), errs)
		}
	})

	t.Run("applies defaults before checking", func(t *testing.T) {
		cfg := Config{
			Orion: Orion{Mode: "test"},
			Source: Source{
				ID:     "can-injector",
				Port:   "usb:1234:5678:INJECTOR",
				Format: "usb",
			},
		}
		errs, _ := cfg.Check(known)
		if cfg.Source.Baud == nil || *cfg.Source.Baud != 115200 {
			t.Errorf("Check did not apply the baud default")
		}
		if cfg.Orion.BackfillWindowS == nil || *cfg.Orion.BackfillWindowS != 30 {
			t.Errorf("Check did not apply the backfill_window_s default")
		}
		for _, err := range errs {
			if strings.Contains(err.Error(), "backfill_window_s") {
				t.Errorf("the default backfill window was refused: %v", err)
			}
		}
	})

	t.Run("collects several errors and a warning at once", func(t *testing.T) {
		// this ops config accumulates four distinct error rules and a warning:
		//   - zero backfill window                        (checkBackfillWindowPositive)
		//   - no log_dir                                  (checkLogDirSet)
		//   - commandable actuator without critical       (checkCommandableActuatorFields)
		//   - unknown board name                          (checkStateNotInRocketCAN)
		//   - bare COMn port in ops                       (warning)
		cfg := Config{
			Orion: Orion{Mode: "ops", BackfillWindowS: ptr(0)},
			Source: Source{
				ID:         "can-debug",
				Connection: "USB_DEBUG",
				Port:       "COM4",
				Format:     "usb",
				Boards:     []string{"INJECTOR/TYPO"},
				Actuators: []Actuator{{
					ID:        "fill-vent-valve",
					RocketCAN: "OX_VENT_VALVE",
					Command:   true,
					SafeState: "OFF",
				}},
			},
		}
		errs, warnings := cfg.Check(known)
		if len(errs) != 4 {
			t.Errorf("got %d errors, want 4: %v", len(errs), errs)
		}
		if len(warnings) != 1 {
			t.Errorf("got %d warnings, want 1: %v", len(warnings), warnings)
		}
	})
}
