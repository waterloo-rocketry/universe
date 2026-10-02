# Launch App

Minimal React + TypeScript + Electron foundation. The dashboard is a placeholder;
there is no backend telemetry or Omnibus integration. Local fake data sources are
available for component development and tests; see [mock data](docs/mock-data.md).

## Setup

Use **Node.js 24** (matching the repository's root `.nvmrc`) and npm.
This Electron app is a standalone npm project with its own lockfile.
Run all commands from `areas/apps/launch-app`:

```sh
npm install
npm run dev
```

To connect to the separate fake data server, run two terminals in this directory:

```sh
# Terminal 1: leave the mock server running
npm run mock:server

# Terminal 2: open the Electron dashboard
npm run dev
```

The development UI shows **connected to mock** after receiving a valid JSON
frame. If the server stops it shows **disconnected from mock** and reconnects
when the server comes back. The server binds to `127.0.0.1:6768` and runs
independently of Electron. Production builds do not connect to the mock.
See [mock server options and protocol](docs/mock-data.md#standalone-mock-server).

Development starts Vite, builds the Electron entry points, then opens Electron
with the actual Vite server URL supplied through `VITE_DEV_SERVER_URL`.
Renderer edits use React Fast Refresh. Restart `npm run dev` after changing main,
preload, or shared code used by the main process. Closing Electron also stops Vite;
Ctrl+C stops both. Use Ctrl+Shift+I (Cmd+Option+I on macOS) to open developer tools.

## Checks and build

```sh
npm run test         # Vitest + React Testing Library, single run
npm run typecheck    # main, renderer, and tooling TypeScript checks
npm run lint         # ESLint for TypeScript, React, and scripts
npm run format       # format source/configuration/docs with Prettier
npm run format:check # check formatting without changes
npm run build        # typecheck and build renderer + main + preload
npm run start        # open Electron using the built renderer
```

The build writes `dist/main/index.cjs`, `dist/main/preload.cjs`, and
`dist/renderer/`. Run `npm run build` before `npm run start`. Build output can
be used by a future packaging setup; this bootstrap does not create installers.
Production uses local renderer files, relative asset URLs, and a strict content
security policy. Packaged apps ignore the development server environment variable.
The development-only inline script/style and WebSocket allowances support Vite
and are removed from the production HTML.

## Architecture

```text
Electron Main Process
        ↓
Preload / IPC boundary
        ↓
React Renderer
```

- `src/main/index.ts`: window creation, loading, permissions, and app lifecycle.
  Windows/Linux quit on the last window closing; macOS supports reopening.
- `src/main/preload.ts`: sandboxed boundary, intentionally exposing no APIs yet.
  Future APIs should expose narrow methods through Electron's `contextBridge`.
- `src/renderer/`: React shell, components, styles, and renderer tests.
- `src/shared/`: platform-independent constants and future shared types.
  `APP_NAME` is imported by both main and renderer to verify this path.
- `scripts/`: Vite development orchestration and esbuild Electron compilation.

The renderer has no direct Node.js access. BrowserWindow explicitly enables
context isolation and sandboxing and disables Node integration. New windows,
page navigation, webviews, and permission requests are denied. See Electron's
[security guidance](https://www.electronjs.org/docs/latest/tutorial/security).
