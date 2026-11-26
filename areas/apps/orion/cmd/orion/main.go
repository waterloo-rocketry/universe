// Command orion is Orion's one binary. The role is the subcommand:
//
//	orion <role> <file.toml>                   run the role with that file
//	orion <role> <file.toml> --verify-config   check the file and exit (short form: -t)
//	orion version                              print the version
//
// Demo only, removed once the real Orion API lands (see example.go):
//
//	orion example-server [--addr <address>]                      serve the example service until Ctrl-C
//	orion example-client [--addr <address>] <message>            send one message, print the answer
//	orion example-stream-client [--addr <address>] <message>...  send each message on one stream, print each answer
//
// Of the roles, only `orion can <file> --verify-config` works so far; every
// other role says which tracker issue builds it.
package main

import (
	"fmt"
	"io"
	"os"
	"strings"

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

const usage = `usage:
  orion <role> <file.toml> [--verify-config | -t]
  orion version
  orion example-server [--addr <address>]
  orion example-client [--addr <address>] <message>
  orion example-stream-client [--addr <address>] <message>...
roles: can, daq, fake, logger, omnibus, replay, rlcs, server
`

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
	if len(args) == 1 && args[0] == "version" {
		fmt.Fprintln(stdout, "orion", version)
		return exitOK
	}
	if len(args) > 0 && strings.HasPrefix(args[0], "example-") {
		return runExample(args[0], args[1:], stdout, stderr)
	}
	if len(args) < 2 {
		fmt.Fprint(stderr, usage)
		return exitConfig
	}
	role, path := args[0], args[1]
	issue, ok := roles[role]
	if !ok {
		fmt.Fprintf(stderr, "orion: unknown role %q\n%s", role, usage)
		return exitConfig
	}
	verify := false
	for _, a := range args[2:] {
		switch a {
		case "-t", "--verify-config":
			verify = true
		default:
			fmt.Fprintf(stderr, "orion: unknown argument %q\n%s", a, usage)
			return exitConfig
		}
	}
	if verify {
		return verifyFile(role, path, stdout, stderr)
	}
	fmt.Fprintf(stderr, "orion %s: not built yet (tracker %s)\n", role, issue)
	return exitRuntime
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}
