// Package config reads and checks Orion config files.
//
// Every role's file is checked the same way: read the file as that role's
// config type, then run that role's rules on it. Reading is shared, in
// check. The rules belong to each role (for example canbridge.Config.Check
// for CAN), and Check picks them by role.
package config

import (
	"github.com/BurntSushi/toml"
	"github.com/waterloo-rocketry/universe/areas/apps/orion/internal/canbridge"
)

// check reads the TOML file at path as the config type the rules take, then
// runs the rules on it. A file that can't be read or isn't valid TOML is one
// error, and the rules don't run.
func check[T any](path string, rules func(cfg T) (errs []error, warnings []string)) ([]error, []string) {
	var cfg T // the role's config, filled in from the file below
	if _, err := toml.DecodeFile(path, &cfg); err != nil {
		return []error{err}, nil
	}
	return rules(cfg)
}

// canRules are the rules for a CAN source's file. RocketCAN names aren't
// checked yet, so every name is accepted.
func canRules(cfg canbridge.Config) (errs []error, warnings []string) {
	return cfg.Check(canbridge.AllNamesOK{})
}

// Check checks the file at path as the given role's file. ok is false when
// checking that role's file isn't built yet.
//
// To add a role: write its rules function like canRules above (it takes the
// role's config type), and add a case for it here.
func Check(role, path string) (errs []error, warnings []string, ok bool) {
	switch role {
	case "can":
		errs, warnings = check(path, canRules)
	default:
		return nil, nil, false
	}
	return errs, warnings, true
}
