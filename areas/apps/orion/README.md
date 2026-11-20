# Orion

Ground server that replaces Omnibus. Just a skeleton for now.

```sh
go test ./...
go run ./cmd/canbridge --help
```

Needs the Go version in `go.mod` (https://go.dev/dl).

## Layout

- `cmd/orion`: the server. Empty for now.
- `cmd/canbridge`: runs one CAN bridge on its own and prints what it decodes, for bench testing before the server exists.
- `internal/canbridge`: the part of Orion that talks to CAN hardware.
