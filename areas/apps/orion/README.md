# Orion

Orion is the ground support software that replaces Omnibus. One Orion Server,
on the EGSE PC, owns the system view. Sources (CAN, DAQ, RLCS, and a fake
source for testing) each run as their own process and publish to it, and apps
and Loggers read from it. They all talk through one shared contract in
[`areas/apis/orion`](../../apis/orion).

**Status: project setup only.** The one `orion` binary, its command line and
the package layout are in place, and `orion can <file> --verify-config` checks
a CAN source's file. No role runs yet: each says which tracker issue builds
it.

Orion lives in the universe monorepo as one Go module,
`github.com/waterloo-rocketry/universe/areas/apps/orion`. It isn't a separate
repository. What it's built with: [`docs/stack.md`](docs/stack.md).

## Prerequisites

- **Go 1.27.4.** The `toolchain` line in `go.mod` pins it. If you already have
  any Go from 1.21 on, it downloads 1.27.4 by itself the first time you run a
  `go` command in this directory. Otherwise install it from https://go.dev/dl.
- **git.**
- Only if you change a CI workflow: **uv** (see the
  [root README](../../../README.md)).

No hardware is needed for anything here.

| Tool or dependency | Version | Pinned in |
| --- | --- | --- |
| Go | 1.27.4 (1.27.0 minimum) | `go.mod` |
| `github.com/BurntSushi/toml` | v1.6.0 | `go.mod`, `go.sum` |
| `buf`, `protoc-gen-go`, `protoc-gen-connect-go` (the contract's tools) | v1.74.0, v1.36.12, v1.21.1 | `tool`s in `areas/apis/orion/go.mod` |

## Setup

```sh
git clone https://github.com/waterloo-rocketry/universe.git
cd universe/areas/apps/orion
go version        # should print go1.27.4 (it may download it first)
go mod download   # optional: go build and go test fetch modules anyway
```

Run every command below from `areas/apps/orion`. The config paths are
relative to it.

## Command line

```text
orion <role> <file.toml>                   run the role with that file
orion <role> <file.toml> --verify-config   check the file and exit (short form: -t)
orion version                              print the version
```

```sh
go run ./cmd/orion version
# orion 0.0.0
go run ./cmd/orion can configs/bench.toml --verify-config
# configs/bench.toml: ok (orion can)
go run ./cmd/orion fake configs/fake-source.toml
# orion fake: not built yet (tracker #60)
```

| Role | What it is |
| --- | --- |
| `server` | The Orion Server |
| `fake` | Random numbers on one channel, no hardware |
| `can` | One CAN connection: umbilical, LTT ground station or USB debug board. `--verify-config` works |
| `daq` | The LabJack DAQ |
| `rlcs` | The RLCS clientside box, read-only |
| `logger` | Records a subscription to files |
| `replay` | Replays a recording or a `.canlog` |
| `omnibus` | Mirrors Omnibus into Orion during migration |

**Exit codes:** `0` for success, `1` for a runtime failure (or something that
isn't built yet), `2` for a config error, a failed check or bad arguments.

## Check

These are the commands CI runs ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)),
so if they pass here, CI's checks pass too:

```sh
test -z "$(gofmt -l .)"   # formatting: gofmt -l lists unformatted files; go fmt ./... fixes them
go vet ./...              # static checks
go build ./...            # build
go test -race ./...       # tests, with the race detector
```

CI also reports total coverage. To see it locally:

```sh
go test -race -count=1 -coverpkg=./... -coverprofile=coverage.out ./...
go tool cover -func=coverage.out | tail -1   # total:  (statements)  NN.N%
```

Keep `-count=1`: without it, Go reuses cached test results and writes an
empty `coverage.out`, so the total shows 0.0%. Each `ok … coverage:` line is
how much of the whole module that package's tests reach, not the package's
own coverage; the `total:` line is the combined figure. The target is 85%
overall, and 100% on command encoding and routing.

The `cmd/orion` tests run the command line itself, including
`orion can configs/bench.toml --verify-config` on the committed file, so a
broken example fails CI.

## Configuration

Each process will run from its own TOML file, and the subcommand says which
role reads it. A source's file has `config_version = 1`, an `[orion]` table
(where the Orion Server is, and the `mode` it expects: `"test"` for
development, `"ops"` for a real test or launch) and one `[source]` table.
Keys the CAN check doesn't use are ignored.

`[source]` is one hardware connection, like one Omnibus source process: one
CAN link (one USB debug board, umbilical or LTT ground station) or one
LabJack. Everything on that connection is listed inside it, for example every
DAQ sensor as a `[[source.channel]]`. Two CAN links are two files and two
processes.

`[source]` starts with `type`, the role the file is for (`type = "can"`), so a
file says what it is when you read it. `--verify-config` checks it against the
subcommand first: `orion can` given a file with `type = "daq"` stops with
`source.type is "daq", but this is orion can; …`.

`--verify-config` works the same way for every role. `internal/config` reads
the file as the role's config type and runs the role's rules on it; reading
and the `type` check are shared, and the rules belong to the role. For `can`,
the type is `canbridge.Config` and the rules are its `Check` method.

To make `--verify-config` work for a new role:

1. In the role's package, write the struct for its keys and a method that
   checks it, like `canbridge.Config` and `Config.Check`.
2. In `internal/config/config.go`, write a rules function for it like
   `canRules` (it takes the role's struct and calls that method), and add a
   `case` for the role in `Check`, using `checkSource` for a source's file
   (one with a `[source]` table and a `type`). That's all: reading the file and reporting
   problems are already shared.

| File | Role | What it is |
| --- | --- | --- |
| [`configs/bench.toml`](configs/bench.toml) | `can` | One USB debug board on the desk, in test mode |

## The contract

The contract's `.proto` files and the pinned code-generation tools are in
[`areas/apis/orion`](../../apis/orion). So far it holds only an example file;
each part of the contract is added with the code that implements it. The
generated Go code isn't committed: `go tool buf generate` writes it there
(why, when and how: "Generating the Go code" in
[that README](../../apis/orion/README.md#generating-the-go-code)).

Orion doesn't import it yet. The first code that does adds a `replace`
directive to `go.mod`, lists `areas/apis/orion/**` in Orion's CI `paths:`,
and runs `go tool buf generate` before building, in CI and in the setup steps
above.

To check a change to the contract:

```sh
cd ../../apis/orion
go tool buf lint
go tool buf generate   # writes gen/go
go build ./...
```

## Layout

Most packages hold only their package documentation for now, saying what
goes in them.

| Path | What it holds |
| --- | --- |
| `cmd/orion` | The one binary and its command line |
| `configs/` | One TOML per process |
| `internal/canbridge` | The CAN source: its config and checks, and the shared types |
| `internal/config` | The shared config check: reads a file as its role's config type and runs that role's rules |
| `internal/server` | The Orion Server |
| `internal/fakesource` | The fake source |
| `internal/component` | The shared source runtime: drivers, batches, health, catalog, commands, lifecycle |
| `internal/delivery` | The sender to the Orion Server: acks, backfill, reconnect |
| `internal/clock`, `internal/backoff`, `internal/queue`, `internal/console`, `internal/mockfault` | Shared runtime pieces |
| `docs/` | Design notes |

The DAQ source goes in `internal/daqsource`, next to `canbridge`, as
do RLCS and replay.

**Tests and fixtures:** unit tests go next to the file they test
(`config.go` → `config_test.go`). Fixtures only one package uses go in that
package's `testdata/`, which Go leaves out of builds. Fixtures shared across
languages go in `areas/apis/orion/fixtures/`. End-to-end tests that run the
real binary go in `tests/<area>/`.

## Common problems

- **`go: go.mod requires go >= 1.27.0 (running go 1.26.0; GOTOOLCHAIN=local)`**:
  your Go is too old and isn't allowed to download a newer one. Run
  `go env -u GOTOOLCHAIN` (or unset the `GOTOOLCHAIN` environment variable),
  or install Go 1.27.4.
- **The Go 1.27.4 download fails** (offline, or a proxy blocks it): install
  1.27.4 from https://go.dev/dl, or check `go env GOPROXY`.
- **`error: open configs/bench.toml: no such file or directory`**:
  run it from `areas/apps/orion`, or pass the full path to the config.
- **`orion: unknown role "--check-config"`, exit code 2**: the role comes
  first, and the check flag is `--verify-config` (`-t`):
  `orion can configs/bench.toml -t`.
- **`orion fake: not built yet (tracker #60)`, exit code 1**: that role isn't
  in the binary yet. The issue named builds it.
- **CI fails "Check formatting"**: run `go fmt ./...` and commit the result.
- **You changed a `.github/workflows/ci.yml`**: run `uv run tools/build_ci`
  from the repo root and commit the copy it makes.

