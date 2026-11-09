# Desktop scaffold decision

For setup issue #93, the requested implementation is Electron + React/TypeScript
with a Go backend. This is a desktop prototype choice; it does not claim that the
broader requirements/architecture review in #75 is complete.

```text
React renderer -> restricted contextBridge -> Electron ipcMain
    -> child stdin (JSON line) -> Go protocol -> readers -> typed dataset
    <- child stdout (JSON line) <- correlated result/error
```

The renderer runs sandboxed with context isolation and no Node integration. The
preload exposes only `loadSample()`, rather than generic IPC or filesystem access.
The main process validates the requesting frame, denies extra windows/navigation
and permissions, spawns one Go backend, routes replies by numeric request ID,
times out requests, rejects pending calls on failure, and closes Go on app quit.
No HTTP service, listener port, socket discovery, or backend installation is needed.
Vite's loopback development server is only used during development.

The protocol is newline-delimited JSON over private parent/child pipes:

```json
{ "id": 1, "method": "dataset.sample" }
```

Each response has the same id and either `result` (a Dataset) or `error` (string).
stdout contains protocol messages only; diagnostics use stderr. Go rejects unknown
methods and recovers from malformed request lines; input lines are capped at 1 MiB.
The current result is intentionally tiny; streaming/chunked transfer and response
size limits for large real logs must be designed before adding real imports.

Go owns parsing/validation and the domain types. `shared/api.ts` mirrors the wire
shape for TypeScript, and the integration smoke test asserts actual sample output.
When changing it, update both sides and extend cross-language tests. Generated
contracts can be introduced when the scientific schema stabilizes. This scaffold
preserves source/channel identity, units, explicit time basis, provenance, and
warnings; it does not yet implement the full #75 dataset model or clock semantics.

`pnpm package` builds Go for the host and electron-builder includes it outside
ASAR under `resources/backend`. Default native targets produce one distributable
per OS/architecture. Electron cannot produce a truly standalone executable with
no internal runtime resources. Backend code is bundled, never separately shipped
or installed. Production signing, notarization and release automation are deferred.

References: [setup issue](https://github.com/waterloo-rocketry/2026-2027-software-issues/issues/93),
[architecture story](https://github.com/waterloo-rocketry/2026-2027-software-issues/issues/75),
[Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model),
[electron-builder resources/configuration](https://www.electron.build/configuration/).
