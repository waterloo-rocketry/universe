// Package config reads and checks Orion config files.
//
// Every role's file is checked the same way: read the file as that role's
// config type, then run that role's rules on it. Reading is shared, in
// check. The rules belong to each role (for example canbridge.Config.Check
// for CAN), and Check picks them by role.
package config

import (
	"fmt"

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

// checkSource is check for a source's file. Its [source] table names the role
// the file is for (type = "can" for `orion can`), so a file given to the wrong
// role is caught first, and its other problems aren't reported against the
// wrong rules.
func checkSource[T any](path, role string, rules func(cfg T) (errs []error, warnings []string)) ([]error, []string) {
	var file struct {
		Source struct {
			Type string `toml:"type"`
		} `toml:"source"`
	}
	if _, err := toml.DecodeFile(path, &file); err != nil {
		return []error{err}, nil
	}
	switch file.Source.Type {
	case role:
		return check(path, rules)
	case "":
		return []error{fmt.Errorf("source.type: missing; set type = %q", role)}, nil
	default:
		return []error{fmt.Errorf("source.type is %q, but this is orion %s; run orion %s, or set type = %q", file.Source.Type, role, file.Source.Type, role)}, nil
	}
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
// role's config type), and add a case for it here. Use checkSource for a
// source's file (it has a [source] table with a type), and check otherwise.
func Check(role, path string) (errs []error, warnings []string, ok bool) {
	switch role {
	case "can":
		errs, warnings = checkSource(path, role, canRules)
	default:
		return nil, nil, false
	}
	return errs, warnings, true
}
