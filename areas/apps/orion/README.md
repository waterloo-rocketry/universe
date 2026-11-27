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
| `connectrpc.com/connect`, `google.golang.org/protobuf` | v1.21.1, v1.36.12 | `go.mod`, `go.sum` |
| `buf`, `protoc-gen-go`, `protoc-gen-connect-go` (the contract's tools) | v1.74.0, v1.36.12, v1.21.1 | `tool`s in `areas/apis/orion/go.mod` |

## Setup

```sh
git clone https://github.com/waterloo-rocketry/universe.git
cd universe/areas/apps/orion
go version        # should print go1.27.4 (it may download it first)
(cd ../../apis/orion && go tool buf generate)   # generate the Orion API code Orion imports
```

The generated code isn't committed, so run that generate step again whenever
a `.proto` file in `areas/apis/orion` changes (see
[The contract](#the-contract)). Run every other command below from
`areas/apps/orion`. The config paths are relative to it.

## Command line

```text
orion <role> <file.toml>                   run the role with that file
orion <role> <file.toml> --verify-config   check the file and exit (short form: -t)
orion --version                            print the version (short form: -v)
orion --help                               print the usage (short form: -h)
```

```sh
go run ./cmd/orion --version
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

## Example: a server and a client

**Demo only.** The `connectrpc-example` binary shows how Orion code uses the
generated API: a server that implements a service, a client that makes a
unary call, and a client that keeps a bidirectional stream open, each as its
own process. It uses the example service in `areas/apis/orion`, not the real
contract. It isn't part of `orion`, and its folder,
[`cmd/connectrpc-example`](cmd/connectrpc-example/main.go), is deleted once
the real Orion API lands.

```text
connectrpc-example server [--addr <address>]                      serve the example service until Ctrl-C
connectrpc-example client [--addr <address>] <message>            send one message, print the answer
connectrpc-example stream-client [--addr <address>] <message>...  send each message on one stream, print each answer
```

Run the server in one terminal and the clients in another. The server listens
on `127.0.0.1:8080`; pass `--addr <host:port>` to the server and the clients to
use another address.

```sh
# terminal 1: the server
go run ./cmd/connectrpc-example server
# serving the example service on http://127.0.0.1:8080 (Ctrl-C to stop)

# terminal 2: the clients
go run ./cmd/connectrpc-example client ping
# pong
go run ./cmd/connectrpc-example client "hello orion"
# server got "hello orion" at 11:18:52
go run ./cmd/connectrpc-example stream-client ping one two
# pong
# server got "one" at 11:18:52
# server got "two" at 11:18:52
```

Stop the server with Ctrl-C. Without a running server, a client fails with
`connection refused` and exits 1.

**The server's logic** decides every answer, the same way for both clients
(`answer` in `main.go`): `ping` gets `pong`, and anything else gets the
server's own reply, saying what it got and when.

| Command | Call | Kind | What happens |
| --- | --- | --- | --- |
| `server` | | | Serves `ExampleService` until Ctrl-C |
| `client` | `Send` | unary | One request, one response: the client sends a message and prints the server's answer |
| `stream-client` | `Stream` | bidirectional stream | The client opens one stream and keeps it open. It sends each message and waits for the server's answer on the same stream before sending the next, then closes its side. The server answers each message as it arrives, and stops when the client closes |

How it works:

- **The server** (`exampleServer`) implements the generated
  `ExampleServiceHandler` interface, one method per call.
  `examplev1connect.NewExampleServiceHandler` turns it into a URL path prefix
  (`/orion.example.v1.ExampleService/`) and an `http.Handler`, mounted on a plain
  `net/http` server.
- **The unary client** uses the generated `ExampleServiceClient` on top of Go's
  ordinary HTTP/1.1 client. A unary call is one HTTP POST to
  `/orion.example.v1.ExampleService/Send` with the request encoded as
  Protobuf, answered by one response.
- **The stream client** needs HTTP/2, because both sides send on the same
  request at once. Without TLS, that's HTTP/2 over plain TCP ("h2c"), which
  Go's `net/http` supports through `http.Protocols`. Only the stream client
  uses it; the server enables it next to HTTP/1.1, so it serves both clients.
  The real Orion sources will use bidirectional streams like this to publish
  data and receive acknowledgements.

## Check

These are the commands CI runs ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)),
so if they pass here, CI's checks pass too:

```sh
(cd ../../apis/orion && go tool buf generate)   # the Orion API code Orion imports
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

Orion's module imports it: the demo
[`cmd/connectrpc-example`](cmd/connectrpc-example/main.go) uses the
example's generated packages. That's why `go.mod` has a `replace`
directive pointing at `../../apis/orion`, Orion's CI `paths:` include
`areas/apis/orion/**`, and both the setup steps above and CI run
`go tool buf generate` before building.

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
| `cmd/connectrpc-example` | Demo only, not part of Orion: a server, a unary client and a stream client for the example API code |
| `configs/` | One TOML per process |
| `internal/canbridge` | The CAN source: its config and checks, and the shared types |
| `internal/config` | The shared config check: reads a file as its role's config type and runs that role's rules |
| `internal/server` | The Orion Server |
| `internal/fakesource` | The fake source |
| `internal/component` | The shared source runtime: drivers, batches, health, catalog, commands, lifecycle |
| `internal/delivery` | The sender to the Orion Server: reconnecting for every source; acks, backfill and resume for DAQ and CAN |
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
- **`no required module provides package github.com/waterloo-rocketry/universe/areas/apis/orion/gen/go/…`**:
  the generated API code is missing. Run `go tool buf generate` in
  `areas/apis/orion`, not the `go get` the message suggests.
- **Your editor shows errors in `cmd/connectrpc-example`** (for example
  `could not import …/gen/go/…`, `undefined: examplev1connect`, or
  `not enough arguments in call to …`) **while `go build` works, or before
  you've generated**: the editor's Go language server can't see the
  generated code. Run `go tool buf generate` in `areas/apis/orion`, then
  restart the language server (in VS Code: "Go: Restart Language Server").
  If your editor opens the whole repo, open `areas/apps/orion` on its own
  instead, since the repo holds several Go modules.
- **CI fails "Check formatting"**: run `go fmt ./...` and commit the result.
- **You changed a `.github/workflows/ci.yml`**: run `uv run tools/build_ci`
  from the repo root and commit the copy it makes.

