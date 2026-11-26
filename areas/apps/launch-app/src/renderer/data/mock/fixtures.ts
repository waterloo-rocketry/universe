import nominal from './fixtures/nominal.json';
import type {
  DataFrame,
  SignalDefinition,
  SignalReading,
} from '../../../shared/data-source';

export const MOCK_SIGNALS: readonly SignalDefinition[] = [
  { id: 'test.pressure', label: 'Test pressure', kind: 'number', unit: 'kPa' },
  {
    id: 'test.temperature',
    label: 'Test temperature',
    kind: 'number',
    unit: '°C',
  },
  { id: 'test.enabled', label: 'Test enabled', kind: 'boolean', unit: '' },
  { id: 'test.status', label: 'Test status', kind: 'string', unit: '' },
];

export const MOCK_SCENARIOS = [
  'nominal',
  'stale',
  'missing',
  'invalid',
  'disconnected',
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

// JSON imports widen literal types. Check the checked-in fixture at this boundary
// rather than asserting that arbitrary JSON has the component-facing shape.
function parseFixture(input: typeof nominal): DataFrame {
  if (
    input.schemaVersion !== 1 ||
    input.connection !== 'connected' ||
    !Number.isSafeInteger(input.timestampMs) ||
    input.sequence !== 0 ||
    input.readings.length !== MOCK_SIGNALS.length
  )
    throw new Error('Invalid nominal mock fixture');

  const readings: SignalReading[] = input.readings.map((reading, index) => {
    const signal = MOCK_SIGNALS[index];
    if (
      reading.signalId !== signal.id ||
      typeof reading.value !== signal.kind ||
      reading.quality !== 'good' ||
      reading.timestampMs !== input.timestampMs ||
      (typeof reading.value === 'number' && !Number.isFinite(reading.value))
    )
      throw new Error(`Invalid fixture reading: ${reading.signalId}`);
    return {
      signalId: reading.signalId,
      timestampMs: reading.timestampMs,
      quality: 'good',
      value: reading.value,
    };
  });

  return { ...input, schemaVersion: 1, connection: 'connected', readings };
}

const baseline = parseFixture(nominal);
export const MOCK_START_TIME_MS = baseline.timestampMs;

/** Fresh objects on every call so tests and consumers cannot mutate the fixture. */
export function getMockFixture(scenario: MockScenario = 'nominal'): DataFrame {
  const frame = structuredClone(baseline);
  if (scenario === 'disconnected') {
    frame.connection = 'disconnected';
    frame.readings = [];
  } else if (scenario === 'stale') {
    frame.readings.forEach((reading) => {
      reading.timestampMs -= 30_000;
    });
  } else if (scenario === 'missing' || scenario === 'invalid') {
    frame.readings[0] = {
      signalId: MOCK_SIGNALS[0].id,
      timestampMs: frame.timestampMs,
      quality: scenario,
      value: null,
    };
  }
  return frame;
}
