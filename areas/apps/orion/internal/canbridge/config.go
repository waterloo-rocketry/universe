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

type Config struct {
	Server  Server   `toml:"server"`
	Parent  *Parent  `toml:"parent"` // if present, Orion instance is a child and never sends commands directly
	Sources []Source `toml:"source"`
}

type Parent struct {
	Address string `toml:"address"`
	RetryMs uint32 `toml:"retry_ms"`
}

type Server struct {
	Mode             string   `toml:"mode"`
	CommandOperators []string `toml:"command_operators"`
}

type Source struct {
	Type                string            `toml:"type"`
	ID                  string            `toml:"id"`
	Connection          string            `toml:"connection"`
	Port                string            `toml:"port"`
	Format              string            `toml:"format"`
	Baud                *int              `toml:"baud"`
	Boards              []string          `toml:"boards"`
	TxBoard             string            `toml:"tx_board"` // board our own commands go out as
	DefaultStaleAfterMs *uint32           `toml:"default_stale_after_ms"`
	StaleAfterMs        map[string]uint32 `toml:"stale_after_ms"`
	Actuators           []Actuator        `toml:"actuator"`
}

type Actuator struct {
	ID              string  `toml:"id"`
	RocketCAN       string  `toml:"rocketcan"`
	Critical        bool    `toml:"critical"` // whether this needs the operator to arm first
	Command         bool    `toml:"command"`  // whether this connection can command it
	SafeState       string  `toml:"safe_state"`
	ConfirmSettleMs *uint32 `toml:"confirm_settle_ms"` // min ms after a write before a status frame can confirm command
}

// allNamesOK is a placeholder for RocketCANNames that accepts every name
// the real names tables will be available once issue #117 is complete
type AllNamesOK struct{}

func (AllNamesOK) HasActuator(string) bool { return true }
func (AllNamesOK) HasBoard(string) bool    { return true }
func (AllNamesOK) HasState(string) bool    { return true }

func (c *Config) applyDefaults() {
	for i := range c.Sources {
		src := &c.Sources[i]
		if src.Baud == nil {
			baud := 115200
			src.Baud = &baud
		}
		if src.TxBoard == "" {
			src.TxBoard = "DAQ/GROUND"
		}
		if src.DefaultStaleAfterMs == nil {
			defaultStaleAfterMs := uint32(1000)
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
			// safe_state is optional, so check only when it's set
			if act.SafeState != "" && !names.HasState(act.SafeState) {
				return fmt.Errorf("safe state %q in source %q is not in RocketCAN names", act.SafeState, src.ID)
			}
		}
	}
	return nil
}

// string return for warning instead of error return
func checkBareCOMnPortInOps(cfg Config) string {
	if cfg.Server.Mode == "ops" {
		for _, src := range cfg.Sources {
			if strings.HasPrefix(src.Port, "COM") {
				return fmt.Sprintf("bare COMn port in source %q; use 'usb:...' instead", src.ID)
			}
		}
	}
	return ""
}

func (c *Config) Check(names RocketCANNames) (errs []error, warnings []string) {
	c.applyDefaults()

	if err := checkSerialOrMockWithoutFormat(*c); err != nil {
		errs = append(errs, err)
	}
	if err := checkNotCommandedOnLiveTelemetry(*c); err != nil {
		errs = append(errs, err)
	}
	if err := checkUSBDebugInOpsConfig(*c); err != nil {
		errs = append(errs, err)
	}
	if err := checkMockInOpsConfig(*c); err != nil {
		errs = append(errs, err)
	}
	if err := checkCommandableActuatorWithoutOperator(*c); err != nil {
		errs = append(errs, err)
	}
	if err := checkNotMainSendsCommands(*c); err != nil {
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
