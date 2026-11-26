# Orion API

The one shared contract between Orion processes: the Orion Server, its sources
(CAN, DAQ, RLCS, the fake source), Loggers, and the apps that read from it
(the Launch App's backend, DAQms, Data Studio). Messages are Protobuf, served
with ConnectRPC over TCP.

**Status: example only.** The one file here, `proto/orion/example/v1`, is a
demo that shows how a contract file is laid out, linted and generated, with a
unary call and a bidirectional stream. It isn't part of the contract, and it's
removed once the real contract lands. Each part of the contract is added to
`proto/orion/v1` together with the code that implements it.

## Layout

```text
proto/orion/v1/          the contract (package orion.v1): the source of truth for every message
proto/orion/example/v1/  a demo file, not part of the contract (removed once the contract lands)
  example.proto            ExampleService: Send (unary) and Stream (bidirectional stream)
gen/go/                  generated Go code, one package per .proto package; not committed
  orion/example/v1/        the example's messages (package examplev1)
    examplev1connect/      its ConnectRPC client and handler
buf.yaml               lint (STANDARD) and breaking-change (FILE) rules
buf.gen.yaml           what gets generated, and where
go.mod                 the Go module for the generated code; pins the tools
```

Shared test fixtures (valid and invalid messages that every client checks
against) go in `fixtures/` once they exist. Fixtures that only one package
uses stay in that package's `testdata/`.

## Commands

Run from this directory. The tools are pinned as `tool` entries in `go.mod`,
so `go tool` runs the exact versions with nothing else to install (you only
need the Go in `go.mod`).

```sh
go tool buf lint       # style and naming rules
go tool buf build      # the .proto files compile
go tool buf generate   # write gen/go (see "Generating the Go code" below)
go build ./...         # the generated code compiles
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all four.

## Generating the Go code

**Why.** Go can't import `.proto` files. A Go program that talks the Orion
API imports Go types for the messages, and ConnectRPC client and handler code
for the services, and `buf generate` makes both from the `.proto` files. That
code isn't committed: it only mirrors the `.proto` files, and a committed copy
could fall out of step with them. So every machine and every CI run makes its
own.

**When.** Run it:

- after cloning, before building or testing anything that imports
  `…/areas/apis/orion/gen/go/…`, including `go build ./...` here;
- after changing a `.proto` file, or pulling someone else's change to one. Code
  generated from the old file still builds, but doesn't match the contract;
- before `go mod tidy` here. Without `gen/go`, nothing imports protobuf or
  ConnectRPC, so tidy marks them `// indirect` in `go.mod`;
- in CI, before building. This module's CI does it, and a project that imports
  the code has to add the same step.

Until some code imports the contract, only this module's CI needs it.

**How.** From this directory:

```sh
go tool buf generate
```

- buf reads `buf.yaml` (the `.proto` files are under `proto/`) and
  `buf.gen.yaml` (which plugins to run, and where their output goes).
- It runs the two plugins pinned in `go.mod` through `go tool`:
  `protoc-gen-go` writes the message types, and `protoc-gen-connect-go` writes
  the ConnectRPC client and handler.
- It deletes `gen/go` first (`clean: true` in `buf.gen.yaml`), so code from a
  deleted `.proto` file doesn't linger.
- Each `.proto` package lands in `gen/go/<its path>/`, which git ignores.
- There's nothing to install besides Go. The first run downloads buf and the
  plugins, which can take a minute; after that it takes about a second.

**If you forget.** Code that imports the generated packages fails to build
with:

```text
no required module provides package github.com/waterloo-rocketry/universe/areas/apis/orion/gen/go/…; to add it:
	go get github.com/waterloo-rocketry/universe/areas/apis/orion/gen/go/…
```

Don't run the `go get` it suggests. Run `go tool buf generate` in
`areas/apis/orion` instead.

## Using it from Go

Each `.proto` package becomes a Go package under `gen/go`, plus a `…connect`
package for its services. For the example:

```go
import (
	examplev1 "github.com/waterloo-rocketry/universe/areas/apis/orion/gen/go/orion/example/v1"
	"github.com/waterloo-rocketry/universe/areas/apis/orion/gen/go/orion/example/v1/examplev1connect"
)
```

The contract's packages will be `…/gen/go/orion/v1` (`orionv1`) and
`…/gen/go/orion/v1/orionv1connect`.

Inside universe, a Go project points at this directory with a `replace`
directive in its `go.mod`, and lists `areas/apis/orion/**` in its CI `paths:`
so a contract change re-runs its checks:

```text
require github.com/waterloo-rocketry/universe/areas/apis/orion v0.0.0
replace github.com/waterloo-rocketry/universe/areas/apis/orion => ../../apis/orion
```

Because `gen/go` isn't committed, that project must run `go tool buf generate`
here before it builds, both in its README's setup steps and in its CI (see
"Generating the Go code" above). Go code outside universe can't import this
module, since `go get` doesn't run code generation.
