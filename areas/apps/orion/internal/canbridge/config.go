package canbridge

import (
	"fmt"
	"strings"
)

type RocketCANNames interface {
	HasActuator(string) bool
	HasBoard(string) bool
	HasState(string) bool
}

// Config is what `orion can` reads: one CAN connection per file.
type Config struct {
	ConfigVersion int    `toml:"config_version"` // 1
	Orion         Orion  `toml:"orion"`
	Source        Source `toml:"source"`
}

// Orion is the [orion] table: where the Orion Server is, and the mode this
// source expects.
type Orion struct {
	Server          string `toml:"server"`            // for example "http://127.0.0.1:7400"
	Mode            string `toml:"mode"`              // "ops" or "test"; must match the server's
	BackfillWindowS *int   `toml:"backfill_window_s"` // DAQ only; Check refuses it here, since CAN has no acknowledged delivery
}

type Source struct {
	Type                string            `toml:"type"` // "can"; the shared config check makes sure it matches the role
	ID                  string            `toml:"id"`
	Connection          string            `toml:"connection"` // UMBILICAL, LIVE_TELEMETRY or USB_DEBUG
	Port                string            `toml:"port"`
	Format              string            `toml:"format"`
	Baud                *int              `toml:"baud"`
	Boards              []string          `toml:"boards"`
	TxBoard             string            `toml:"tx_board"` // board our own commands go out as
	DefaultStaleAfterMs *uint32           `toml:"default_stale_after_ms"`
	StaleAfterMs        map[string]uint32 `toml:"stale_after_ms"`
	LogDir              string            `toml:"log_dir"` // where the raw log (.canlog) goes; required, since every CAN source keeps one
	Actuators           []Actuator        `toml:"actuator"`
}

type Actuator struct {
	ID              string  `toml:"id"`
	RocketCAN       string  `toml:"rocketcan"`
	Command         bool    `toml:"command"`  // whether this connection can command it
	Critical        *bool   `toml:"critical"` // whether this needs the operator to arm first; required when command = true
	SafeState       string  `toml:"safe_state"`
	ConfirmSettleMs *uint32 `toml:"confirm_settle_ms"` // min ms after a write before a status frame can confirm command
}

// AllNamesOK is a placeholder RocketCANNames that accepts every name, for use
// until the real RocketCAN name tables exist.
type AllNamesOK struct{}

func (AllNamesOK) HasActuator(string) bool { return true }
func (AllNamesOK) HasBoard(string) bool    { return true }
func (AllNamesOK) HasState(string) bool    { return true }

func (c *Config) applyDefaults() {
	src := &c.Source
	if src.Baud == nil {
		baud := 115200
		src.Baud = &baud
	}
	if src.TxBoard == "" {
		src.TxBoard = "DAQ/GROUND"
	}
	if src.DefaultStaleAfterMs == nil {
		defaultStaleAfterMs := uint32(2000)
		src.DefaultStaleAfterMs = &defaultStaleAfterMs
	}
	for j := range src.Actuators {
		act := &src.Actuators[j]
		if act.ConfirmSettleMs == nil {
			confirmSettleMs := uint32(200)
			act.ConfirmSettleMs = &confirmSettleMs
		}
	}
}

func checkSerialOrMockWithoutFormat(cfg Config) error {
	port := cfg.Source.Port
	if strings.HasPrefix(port, "usb") || strings.HasPrefix(port, "/dev/") ||
		strings.HasPrefix(port, "COM") || strings.HasPrefix(port, "mock:") {
		if cfg.Source.Format == "" {
			return fmt.Errorf("format expected when port is serial or mock")
		}
	}
	return nil
}

// CAN sends live data only: no acks, no backfill and no resume after a
// reconnect, so the backfill window belongs to DAQ files only
func checkBackfillWindowNotSet(cfg Config) error {
	if cfg.Orion.BackfillWindowS != nil {
		return fmt.Errorf("backfill_window_s is DAQ only, since CAN has no acknowledged delivery (source: %q)", cfg.Source.ID)
	}
	return nil
}

// every CAN source keeps its own raw log: CAN doesn't re-send after an
// outage, so the raw log is the only copy of what it read while disconnected
func checkLogDirSet(cfg Config) error {
	if cfg.Source.LogDir == "" {
		return fmt.Errorf("log_dir expected, since every CAN source keeps a raw log (source: %q)", cfg.Source.ID)
	}
	return nil
}

func checkMockInOpsConfig(cfg Config) error {
	if cfg.Orion.Mode == "ops" && strings.HasPrefix(cfg.Source.Port, "mock:") {
		return fmt.Errorf("ops config cannot contain mock port (source: %q)", cfg.Source.ID)
	}
	return nil
}

// critical has no default: a commandable actuator must say whether opening it
// needs the operator to arm first
func checkCommandableActuatorFields(cfg Config) error {
	for _, act := range cfg.Source.Actuators {
		if act.Command && act.Critical == nil {
			return fmt.Errorf("actuator %q is commandable, so it must set critical", act.ID)
		}
	}
	return nil
}

func checkStateNotInRocketCAN(cfg Config, names RocketCANNames) error {
	src := cfg.Source
	for _, b := range src.Boards {
		if !names.HasBoard(b) {
			return fmt.Errorf("board %q in source %q is not in RocketCAN names", b, src.ID)
		}
	}
	for _, act := range src.Actuators {
		if !names.HasActuator(act.RocketCAN) {
			return fmt.Errorf("actuator RocketCAN %q in source %q is not in RocketCAN names", act.RocketCAN, src.ID)
		}
		// safe_state is optional, so check only when it's set
		if act.SafeState != "" && !names.HasState(act.SafeState) {
			return fmt.Errorf("safe state %q in source %q is not in RocketCAN names", act.SafeState, src.ID)
		}
	}
	return nil
}

// string return for warning instead of error return
func checkBareCOMnPortInOps(cfg Config) string {
	if cfg.Orion.Mode == "ops" && strings.HasPrefix(cfg.Source.Port, "COM") {
		return fmt.Sprintf("bare COMn port in source %q; use 'usb:...' instead", cfg.Source.ID)
	}
	return ""
}

func (c *Config) Check(names RocketCANNames) (errs []error, warnings []string) {
	c.applyDefaults()

	if err := checkSerialOrMockWithoutFormat(*c); err != nil {
		errs = append(errs, err)
	}
	if err := checkBackfillWindowNotSet(*c); err != nil {
		errs = append(errs, err)
	}
	if err := checkLogDirSet(*c); err != nil {
		errs = append(errs, err)
	}
	if err := checkMockInOpsConfig(*c); err != nil {
		errs = append(errs, err)
	}
	if err := checkCommandableActuatorFields(*c); err != nil {
		errs = append(errs, err)
	}
	if err := checkStateNotInRocketCAN(*c, names); err != nil {
		errs = append(errs, err)
	}
	if warn := checkBareCOMnPortInOps(*c); warn != "" {
		warnings = append(warnings, warn)
	}

	return errs, warnings
}
