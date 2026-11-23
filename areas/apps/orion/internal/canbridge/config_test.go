package canbridge

import "fmt"

func validate() error {
	cfg := Config{}
	cfg.applyDefaults()
	for _, src := range cfg.Sources {
		if (*src.Baud != 115200) {
			return fmt.Errorf("default value for Baud not satisfied")
		}
		if (src.TxBoard != "DAQ/GROUND") {
			return fmt.Errorf("default value for TxBoard not satisfied")
		}
		if (src.TxPrio != "HIGHEST") {
			return fmt.Errorf("default value for TxPrio not satisfied")
		}
		if (*src.DefaultStaleAfterMs != 1000) {
			return fmt.Errorf("default value for DefaultStaleAfterMs not satisfied")
		}
		for _, act := range src.Actuators {
			if (*act.ConfirmSettleMs != 200) {
				return fmt.Errorf("default value for ConfirmSettleMs not satisfied")
			}
		}
	}
	return nil
}