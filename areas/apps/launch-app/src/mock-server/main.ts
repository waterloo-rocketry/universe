import { parseArgs } from 'node:util';
import {
  MOCK_SCENARIOS,
  type MockScenario,
} from '../renderer/data/mock/fixtures';
import { createMockServer } from './server';

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '6768' },
    scenario: { type: 'string', default: 'nominal' },
    seed: { type: 'string', default: '42' },
    'interval-ms': { type: 'string', default: '100' },
    'start-time-ms': { type: 'string' },
  },
});

const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new RangeError('port must be an integer between 1 and 65535');
}
if (!MOCK_SCENARIOS.includes(values.scenario as MockScenario)) {
  throw new Error(`scenario must be one of: ${MOCK_SCENARIOS.join(', ')}`);
}

const mock = createMockServer({
  scenario: values.scenario as MockScenario,
  seed: Number(values.seed),
  intervalMs: Number(values['interval-ms']),
  ...(values['start-time-ms'] !== undefined
    ? { startTimeMs: Number(values['start-time-ms']) }
    : {}),
});

mock.server.on('error', (error) => {
  console.error('Mock server failed:', error.message);
  process.exitCode = 1;
});
mock.server.listen(port, '127.0.0.1', () => {
  console.log(
    `Launch App mock server: http://127.0.0.1:${port} (${values.scenario})`,
  );
  console.log('JSON stream: /events | Health: /health | Stop: Ctrl+C');
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await mock.close();
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
