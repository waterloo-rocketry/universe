# Component test data

Launch App has local JSON-compatible fixtures and a deterministic streaming mock.
Static fixtures and in-process sources need no server. A separate mock server is
also available; the development shell connects to it and displays connection
status. Neither mode requires hardware, Omnibus, Electron IPC, or a data store.
Production builds do not connect to the mock. The eventual backend contract
remains undecided.

## What Omnibus does

The sibling checkout at `../omnibus/omnibus` and the monorepo's Omnibus/client
implementations were inspected as references:

- `src/omnibus/omnibus.py`: `Message(channel, timestamp, payload)`. `Sender.send`
  adds a host Unix timestamp in **seconds**. ZMQ carries three multipart frames:
  channel bytes, MessagePack timestamp, and MessagePack payload. The server is a
  publish/subscribe proxy, rather than a component data store.
- `src/websocket_server/server.py`: Socket.IO uses the channel as the event name
  and sends two arguments, `(timestamp, payload)`; it relays the decoded objects.
  The TypeScript client also uses a MessagePack Socket.IO parser, so this is not
  simply a raw JSON WebSocket endpoint.
- `src/sources/parsley/main.py`: CAN is decoded before publication using
  `model_dump(mode='json')`. Payloads retain board/type/metadata identifiers plus
  decoded `data`, `parsley`, and `message_format_version: 2`. Typical analog data
  contains `{ time, value }`. Device time is separate from the host envelope time;
  the existing frontend mock models a wrapping 16-bit millisecond device counter.
- `src/sources/ni/main.py`: DAQ format v3 contains `timestamp`, `data` (sensor name
  to numeric sample array), `relative_timestamps`, `sample_rate`, and
  `message_format_version: 3`. Calibration is applied before sending. Despite the
  field name, the inspected producer's `relative_timestamps` are derived from a
  host epoch baseline, in seconds, with one time for each sample in each array.
  The older fake source's v2 branch instead uses nanosecond timestamps.
- `src/sources/fakeni/main.py` and `payload_fake/main.py`: existing fake sources
  generate sensor batches and structured orientation/position data respectively.
  They depend on Omnibus and use random data or real-time loops.
- The monorepo's `omnibus-daqms/tests/mock-backend` emits decoded DAQ/Parsley data
  through Socket.IO. Its current mock is transport-specific and unseeded.
  DAQms's `OmnibusProvider` averages each DAQ batch into a latest point, whereas
  the underlying source provides individual samples. Launch App mocks preserve
  their own sample times instead of choosing aggregation behavior for components.

The useful precedent is decoded readings with source identity and sample time.
Launch App's provisional contract deliberately uses explicit units, stable signal
IDs, camelCase JSON fields, and **epoch milliseconds**. It does not copy CAN
metadata or Omnibus's transport envelope into component props. A future backend
adapter can map its own messages to this contract (or revise it when agreed).

## JSON shape

Signal definitions (`MOCK_SIGNALS`) carry `id`, `label`, `kind`, and `unit`.
Sample frames reference those IDs instead of embedding units and labels repeatedly:

```json
{
  "schemaVersion": 1,
  "sourceId": "mock-sensors",
  "sequence": 0,
  "timestampMs": 1790899200000,
  "connection": "connected",
  "readings": [
    {
      "signalId": "test.pressure",
      "timestampMs": 1790899200000,
      "quality": "good",
      "value": 42
    }
  ]
}
```

`timestampMs` on a reading is measurement time; on a frame it is frame time.
`quality: "missing"` or `"invalid"` uses `value: null`, never NaN/Infinity or a
fabricated zero. Staleness is inferred from reading age, separately from quality.
Disconnection emits an empty frame with `connection: "disconnected"`; consumers
decide whether to retain the last known value. Numeric, boolean, and string
signals exercise different component types. All example signals and values are
synthetic; they are not real sensor configuration or operating limits.

## Static fixtures

```ts
import { getMockFixture } from '../data/mock/fixtures';

const frame = getMockFixture('nominal');
// Pass frame.readings to a future component under test.
```

The checked-in `src/renderer/data/mock/fixtures/nominal.json` is validated when
loaded. `getMockFixture` returns independent objects and supports:

| Scenario       | Behavior                                                 |
| -------------- | -------------------------------------------------------- |
| `nominal`      | Four valid numeric, boolean, and string readings         |
| `stale`        | All measurement times start 30 seconds behind frame time |
| `missing`      | Pressure is explicitly missing; other signals stay good  |
| `invalid`      | Pressure is explicitly invalid; other signals stay good  |
| `disconnected` | Source is disconnected and emits no readings             |

## Generated data and subscriptions

```ts
import { createMockDataSource } from '../data/mock/source';

const source = createMockDataSource({
  seed: 42,
  scenario: 'nominal',
  startTimeMs: Date.now(), // Omit for a fixed, reproducible test epoch.
  intervalMs: 100,
});

const frame = source.frameAt(10); // Pure, deterministic access; starts no timer.
const unsubscribe = source.subscribe((nextFrame) => {
  console.log(nextFrame); // Replace with the component's update callback.
});
// Call on component cleanup/unmount:
unsubscribe();
```

The same seed, options, and sequence produce the same frames regardless of call
order or wall clock. Numeric readings follow smooth curves with seeded noise;
boolean/string values switch every five simulated seconds. Stale scenarios freeze
both values and measurement timestamps while frame time advances. Scenarios stay
fixed for the source's lifetime; select another source to exercise another case.

Each subscription starts at sequence zero, emits its first frame after one
interval, and owns its own timer. Unsubscribe is idempotent. Use Vitest fake timers
to advance subscriptions in tests. Subscribe inside a React effect and return
the cleanup function; source creation alone starts no work. No React provider or
history/state store has been added. The development connection indicator uses a
separate HTTP stream instead of this in-process subscription API.

`src/shared/data-source.ts` defines the small `DataSource` boundary. Future
components can receive that interface rather than importing Omnibus or depending
on the mock implementation. Tests cover JSON serialization, type/quality behavior,
determinism, timestamps, staleness, mutation isolation, validation, and cleanup.

## Standalone mock server

Run `npm run mock:server` and `npm run dev` in separate terminals from the app
directory. The development UI connects automatically; either command may start
first. Closing Electron leaves the mock server running. Ctrl+C stops the server.

The server uses Node's built-in HTTP server and reuses the deterministic generator
above. All connected clients observe one shared timeline, starting at the server's
startup epoch by default. It listens only on loopback at `127.0.0.1:6768`.

```sh
npm run mock:server -- --scenario stale --seed 123 --interval-ms 250
npm run mock:server -- --port 6769 --start-time-ms 1790899200000
```

Options: `--port` (6768), `--scenario` (nominal), `--seed` (42), `--interval-ms`
(100), and `--start-time-ms` (current epoch milliseconds). Restart the server to
change its scenario. A fixed start time makes generated timestamps reproducible.

For a custom port, set `MOCK_SERVER_URL` **before starting development**:

```powershell
$env:MOCK_SERVER_URL = 'http://127.0.0.1:6769'
npm run dev
```

Vite proxies `/mock-api/events` to the mock server's `/events`. The renderer uses
same-origin requests, so no CORS permissions or production CSP exceptions are
needed. The proxy exists only in development. The mock is a test transport, not
an implementation of the future backend.

- `GET /health`: JSON `{ "service": "launch-app-mock", "status": "ok" }`.
- `GET /events`: a continuous `text/event-stream` response. A `signals` event
  supplies the signal catalogue; `frame` events contain `DataFrame` JSON.
  Slow clients are disconnected instead of building an unbounded sample queue.

Example stream fragment:

```text
event: frame
data: {"schemaVersion":1,"sourceId":"mock-sensors","sequence":0,"timestampMs":1790899200000,"connection":"connected","readings":[]}

```

The UI validates received frames before showing **connected to mock**. This status
means the mock server connection works; a `disconnected` sensor scenario still
counts as a working server connection. Malformed frames show **invalid mock data**.
Stopping the server shows **disconnected from mock**. Browser
[EventSource](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
automatically retries; restart the server to reconnect without restarting Electron.
There is no event replay/history buffer. The stream closes when the component
unmounts, and the server releases active streams and its timer on shutdown.
