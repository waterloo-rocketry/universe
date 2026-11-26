# Orion

Ground server that replaces Omnibus. Just a skeleton for now.

```sh
go test ./...
go run ./cmd/canbridge --help
go run ./cmd/orion
```

Needs the Go version in `go.mod` (https://go.dev/dl).

## Layout

- `cmd/orion`: the server. Empty for now.
- `cmd/canbridge`: runs one CAN bridge on its own and prints what it decodes, for bench testing before the server exists.
- `cmd/orion`: the one Orion binary. What it runs comes from the TOML you start it with (`orion --config <file>`), so bench testing is just a bench config. Empty for now.
- `internal/canbridge`: the part of Orion that talks to CAN hardware.
