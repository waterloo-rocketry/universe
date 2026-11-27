// Command orion is Orion's one binary. The role is the subcommand:
//
//	orion <role> <file.toml>                   run the role with that file
//	orion <role> <file.toml> --verify-config   check the file and exit (short form: -t)
//	orion --version                            print the version (short form: -v)
//	orion --help                               print the usage (short form: -h)
//
// So far only `orion can <file> --verify-config` does anything; every other
// role says which tracker issue builds it.
package main

import (
	"fmt"
	"io"
	"os"

	"github.com/waterloo-rocketry/universe/areas/apps/orion/internal/config"
)

// version is the Orion version.
const version = "0.0.0"

// Exit codes.
const (
	exitOK      = 0 // a clean shutdown, or a check that passed
	exitRuntime = 1 // a runtime failure, or something that isn't built yet
	exitConfig  = 2 // a config error, a check that failed, or bad arguments
)

// roles maps each role to the tracker issue that builds it.
var roles = map[string]string{
	"server":  "#65",
	"fake":    "#60",
	"can":     "#130",
	"daq":     "#157",
	"rlcs":    "#69",
	"logger":  "#71",
	"replay":  "#72",
	"omnibus": "#61",
}

// usage is the help text: what `orion --help` prints, and what follows every
// bad-arguments error.
const usage = `usage:
  orion <role> <file.toml> [--verify-config | -t]
  orion --version | -v
  orion --help | -h
roles: can, daq, fake, logger, omnibus, replay, rlcs, server
`

// badArgs reports a command line orion can't make sense of: the problem, if
// there's one to name, then the usage, all on stderr. It returns the exit
// code for bad arguments.
func badArgs(stderr io.Writer, problem string) int {
	if problem != "" {
		fmt.Fprintln(stderr, "orion:", problem)
	}
	fmt.Fprint(stderr, usage)
	return exitConfig
}

// verifyFile checks the file at path as role's file and reports the result:
// warnings and errors on stderr, "ok" on stdout, and the exit code.
func verifyFile(role, path string, stdout, stderr io.Writer) int {
	errs, warnings, ok := config.Check(role, path)
	if !ok {
		fmt.Fprintf(stderr, "orion %s: checking its file isn't built yet (tracker %s)\n", role, roles[role])
		return exitRuntime
	}
	for _, w := range warnings {
		fmt.Fprintln(stderr, "warning:", w)
	}
	for _, e := range errs {
		fmt.Fprintln(stderr, "error:", e)
	}
	if len(errs) > 0 {
		return exitConfig
	}
	fmt.Fprintf(stdout, "%s: ok (orion %s)\n", path, role)
	return exitOK
}

// run is main without the process exit, so tests can call it. It returns
// the exit code.
func run(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		return badArgs(stderr, "")
	}

	// The commands that aren't roles.
	switch {
	case args[0] == "-h" || args[0] == "--help":
		// Help that was asked for is the command's output, so unlike the
		// usage after bad arguments it goes to stdout and exits 0.
		fmt.Fprint(stdout, usage)
		return exitOK
	case (args[0] == "-v" || args[0] == "--version") && len(args) == 1:
		fmt.Fprintln(stdout, "orion", version)
		return exitOK
	}

	// Everything else is `orion <role> <file.toml> [flags]`.
	if len(args) < 2 {
		return badArgs(stderr, "")
	}
	role, path, flags := args[0], args[1], args[2:]
	issue, ok := roles[role]
	if !ok {
		return badArgs(stderr, fmt.Sprintf("unknown role %q", role))
	}
	verify := false
	for _, flag := range flags {
		switch flag {
		case "-t", "--verify-config":
			verify = true
		default:
			return badArgs(stderr, fmt.Sprintf("unknown argument %q", flag))
		}
	}
	if verify {
		return verifyFile(role, path, stdout, stderr)
	}

	// Running a role for real: no role is built yet.
	fmt.Fprintf(stderr, "orion %s: not built yet (tracker %s)\n", role, issue)
	return exitRuntime
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}
