// Command orion is the ground server that replaces Omnibus. Just a skeleton
// for now.
package main

import "fmt"
import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"
	"github.com/waterloo-rocketry/universe/areas/apps/orion/internal/canbridge"
)

// version is the Orion version.
const version = "0.0.0"

func main() {
	fmt.Println("orion", version)
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: orion <version|check-config>")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "--version":
		fmt.Println("orion", version)
	case "--check-config":
		if len(os.Args) != 3 {
			fmt.Fprintln(os.Stderr, "usage: orion check-config <file>")
			os.Exit(1)
		}
		path := os.Args[2]
		var cfg canbridge.Config
		if _, err := toml.DecodeFile(path, &cfg); err != nil {
			fmt.Fprintf(os.Stderr, "check-config: %s: %v\n", path, err)
			os.Exit(1)
		}

		errs, warnings := cfg.Check(canbridge.AllNamesOK{})

		for _, w := range warnings {
			fmt.Fprintln(os.Stderr, "warning:", w)
		}
		for _, e := range errs {
			fmt.Fprintln(os.Stderr, "error:", e)
		}
		if len(errs) > 0 {
			os.Exit(1)
		}
		fmt.Println("check-config: OK")
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n", os.Args[1])
		os.Exit(1)
	}
}
