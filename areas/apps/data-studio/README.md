# Data Studio

Offline desktop log exploration for Waterloo Rocketry, in `areas/apps/data-studio`
in the Universe monorepo. This scaffold implements [setup issue #93](https://github.com/waterloo-rocketry/2026-2027-software-issues/issues/93).
The selected desktop stack is React + TypeScript + Vite + Electron, with Go owning
readers and datasets. Electron's TypeScript main process is only a window/lifecycle
and IPC adapter. See [the architecture record](docs/architecture.md).

## Fresh checkout

Install Git, Node 24.13.0 (the version in `.node-version`), pnpm 12.18.0, and
Go 1.27.3 (including `gofmt`). Put these tools on PATH. Other Node versions allowed
by `package.json` may work; CI uses the pinned version. Install pnpm following its
[installation guide](https://pnpm.io/installation), then select version 12.18.0.

```sh
git clone https://github.com/waterloo-rocketry/universe.git
cd universe/areas/apps/data-studio
pnpm install --frozen-lockfile
pnpm setup:desktop
pnpm dev
```

This area owns its pnpm package and lockfile; Universe has no root JS workspace.
Do not use npm or add a package-lock.json. Dependencies have exact direct versions
in `package.json` and resolved versions/integrities in `pnpm-lock.yaml`. The Go
backend uses only the standard library, so there is no go.sum.

The desktop window opens automatically. Click **Load sample dataset**. Expected:
“Synthetic pressure run”, source `synthetic-omnibus`, channel `pressure`, 3 samples
in kPa at times 0, 0.5, 1 seconds with values 101.3, 103.2, 102.4, and no warnings.
This goes through the real TypeScript-to-Go IPC path. No Omnibus/Orion service,
hardware, network connection, or external log is required after installation.
Ctrl+C stops development. Renderer changes reload through Vite; restart `pnpm dev`
after changing Electron, Go, or the embedded fixture.

## Commands

Run these inside `areas/apps/data-studio`:

| Command              | Purpose                                                             |
| -------------------- | ------------------------------------------------------------------- |
| `pnpm setup:desktop` | Download the pinned Electron runtime for local development          |
| `pnpm dev`           | Compile Go/Electron and start Vite + desktop                        |
| `pnpm typecheck`     | Strict TypeScript checks and `go vet`                               |
| `pnpm format:check`  | Prettier and read-only `gofmt` checks                               |
| `pnpm format`        | Apply formatting                                                    |
| `pnpm test`          | Go reader/protocol tests plus real Go/TypeScript IPC smoke test     |
| `pnpm check`         | All baseline checks; same command in CI                             |
| `pnpm build`         | Typecheck and compile all app components into dist/ and build/      |
| `pnpm package`       | Build one distributable for the current OS/architecture in release/ |

Packaging includes the compiled Go executable as an Electron resource; users do
not install Go or Node. The default target is a portable `.exe` on Windows, an
AppImage on Linux, or a `.dmg` on macOS. Build on the target OS and architecture;
cross-compiling is not configured. **One distributable is not a literal single
runtime executable:** Electron has multiple runtime files and processes, and Go
is a bundled child executable. macOS installs an application bundle from the DMG.
If one executable with no extracted/internal files is mandatory, the Electron
choice needs to be revisited. Release signing, notarization, publishing, and
production packaging validation are deferred; these are local prototype targets.

## Layout and fixtures

- `src/`: renderer UI; `shared/api.ts`: typed IPC/dataset wire contract.
- `electron/`: window, restricted preload bridge, Go process adapter.
- `backend/cmd/data-studio/`: Go entry point.
- `backend/internal/dataset/`: typed sample, series, metadata model.
- `backend/internal/readers/`: decoding/validation; future format readers go here.
- `backend/internal/protocol/`: newline-delimited JSON requests/responses.
- `backend/fixtures/sample.json`: synthetic dataset embedded in the Go binary.
- `tests/` and Go `*_test.go`: IPC smoke, reader and protocol tests.
- `docs/`: architecture decision record.

To add a synthetic fixture, copy `backend/fixtures/sample.json`, preserve its
metadata and units, add a Go reader test, and assert the expected values. Local
private/large test logs belong in ignored `local-logs/`; the scaffold has no file
import UI yet. Real Omnibus/logger/Orion decoding, plotting, selection, export,
and finalized scientific metadata are follow-up work under #75/#76.

## CI and troubleshooting

The area workflow runs frozen installation, `pnpm check`, and `pnpm build` on
Linux, Windows, and macOS. After editing it, run `uv run tools/build_ci` from the
repository root; commit the generated root workflow copy too.

- Missing `go` or `gofmt`: install the pinned Go version and restart the terminal.
- Missing Electron executable: ensure the workspace `allowBuilds` policy is
  present, then run `pnpm exec install-electron`; do not disable all script protections.
- Port 5173 busy: stop the other process; development deliberately uses a fixed port.
- Opening Vite directly in a browser has no desktop API; use the Electron window.
- Backend errors appear in the UI and terminal. stdout is reserved for IPC;
  all Go diagnostic logging must use stderr.
- Linux desktop launch needs a graphical session and Electron system libraries;
  headless CI runs the Go/IPC tests without launching Chromium.
- Unsigned prototype packages can trigger OS trust prompts. Release signing and
  notarization need a separate configured release process.
