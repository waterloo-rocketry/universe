# Orion

Ground server that replaces Omnibus. Just a skeleton for now.

```sh
go test ./...
go run ./cmd/orion version
go run ./cmd/orion can configs/bench.toml --verify-config   # check a file (short form: -t)
```

Needs the Go version in `go.mod` (https://go.dev/dl).

## Layout

- `cmd/orion`: the one Orion binary. The role is the subcommand (`orion <role> <file.toml>`); `--verify-config` (`-t`) checks a file. Only the CAN check exists so far.
- `internal/canbridge`: the part of Orion that talks to CAN hardware.
- `docs/`: design notes. [`docs/stack.md`](docs/stack.md) says what Orion is built with.
