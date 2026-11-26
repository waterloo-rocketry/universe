# Orion stack

What Orion is built with. Change this file when a decision changes.

| Area | Choice |
| --- | --- |
| Language | Go. Apps like Orion pin an exact toolchain in `go.mod`; libraries set only a minimum version |
| Binary | One `orion` binary. The role is the subcommand: `orion <role> <file.toml>` |
| Processes | One Orion Server on the EGSE PC. Every source, Logger and app is its own process, with one source (one hardware connection) per process |
| Communication | ConnectRPC over TCP (loopback on the EGSE PC), with Protobuf messages. The contract is in [`areas/apis/orion`](../../../apis/orion), and every connection checks versions first |
| Configuration | One TOML file per process, with `config_version`, strict keys and an `[orion]` table. `--verify-config` checks a file without starting anything |
| Deployment | A systemd target with one unit per process, a small control script and Ansible. No Docker |
| Diagnostic logs | `log/slog` JSON on stderr (journald collects it on the EGSE PC), later also shipped to the server |
| Checks | `gofmt`, `go vet`, `go build`, `go test -race`. Coverage target: 85% overall, 100% on command encoding and routing |
| Code generation | `buf`, with `protoc-gen-go` and `protoc-gen-connect-go`, pinned as Go tools in `areas/apis/orion/go.mod` |

## Toolchain and dependencies

- **Go:** the `toolchain` line in [`go.mod`](../go.mod) pins the exact version.
  With `GOTOOLCHAIN=auto` (Go's default), any Go 1.21 or newer downloads it on
  first use.
- **Go modules:** listed in `go.mod`, with checksums in `go.sum`.
- **Protobuf tools:** `buf`, `protoc-gen-go` and `protoc-gen-connect-go` are
  `tool` entries in `areas/apis/orion/go.mod`, so `go tool buf` runs the pinned
  version with nothing else to install. The generated Go code isn't
  committed: `go tool buf generate` writes it, in CI and on your machine.
