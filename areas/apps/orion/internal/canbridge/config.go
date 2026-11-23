package canbridge

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
	TxPrio              string            `toml:"tx_prio"`  // priority our own commands go out as
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
	ConfirmSettleMs *uint32 `toml:"confirm_settle_ms"`
}

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
		if src.TxPrio == "" {
			src.TxPrio = "HIGHEST"
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