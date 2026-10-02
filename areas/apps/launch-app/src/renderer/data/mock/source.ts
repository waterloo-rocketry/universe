import type { DataFrame, DataSource } from '../../../shared/data-source';
import {
  getMockFixture,
  MOCK_SIGNALS,
  MOCK_START_TIME_MS,
  type MockScenario,
} from './fixtures';

export interface MockSourceOptions {
  seed?: number;
  scenario?: MockScenario;
  startTimeMs?: number;
  intervalMs?: number;
}

export interface MockDataSource extends DataSource {
  /** Deterministic, timer-free access for snapshots and chart tests. */
  frameAt(sequence: number): DataFrame;
}

// Noise depends only on seed, sequence, and signal, never Math.random or the clock.
function noise(seed: number, sequence: number, signal: number): number {
  let hash =
    (seed ^
      Math.imul(sequence + 1, 0x9e3779b1) ^
      Math.imul(signal + 1, 0x85ebca6b)) >>>
    0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  return hash / 0xffffffff - 0.5;
}

/** No timers or network connections are created until a consumer subscribes. */
export function createMockDataSource(
  options: MockSourceOptions = {},
): MockDataSource {
  const {
    seed = 1,
    scenario = 'nominal',
    startTimeMs = MOCK_START_TIME_MS,
    intervalMs = 100,
  } = options;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }
  if (!Number.isSafeInteger(startTimeMs) || startTimeMs < 0) {
    throw new RangeError(
      'startTimeMs must be a nonnegative integer in milliseconds',
    );
  }
  if (
    !Number.isSafeInteger(intervalMs) ||
    intervalMs < 1 ||
    intervalMs > 0x7fffffff
  ) {
    throw new RangeError('intervalMs must be a positive timer-safe integer');
  }

  function frameAt(sequence: number): DataFrame {
    const timestampMs = startTimeMs + sequence * intervalMs;
    if (
      !Number.isSafeInteger(sequence) ||
      sequence < 0 ||
      !Number.isSafeInteger(timestampMs)
    ) {
      throw new RangeError(
        'sequence must yield a nonnegative, safe integer timestamp',
      );
    }
    const frame = getMockFixture(scenario);
    frame.sequence = sequence;
    frame.timestampMs = timestampMs;
    frame.readings = frame.readings.map((reading, index) => {
      const sampleSequence = scenario === 'stale' ? 0 : sequence;
      const sampleTimeMs =
        scenario === 'stale' ? startTimeMs - 30_000 : timestampMs;
      if (reading.quality !== 'good')
        return { ...reading, timestampMs: sampleTimeMs };
      let value = reading.value;
      if (typeof value === 'number') {
        const amplitude = index === 0 ? 5 : 1;
        value =
          Math.round(
            (value +
              amplitude *
                Math.sin((sampleSequence * intervalMs) / 1000 + index) +
              noise(seed, sampleSequence, index) * 0.2) *
              1000,
          ) / 1000;
      } else if (typeof value === 'boolean') {
        value = Math.floor((sampleSequence * intervalMs) / 5000) % 2 === 0;
      } else {
        value =
          Math.floor((sampleSequence * intervalMs) / 5000) % 2 === 0
            ? 'idle'
            : 'active';
      }
      return { ...reading, timestampMs: sampleTimeMs, value };
    });
    return frame;
  }

  return {
    get signals() {
      return structuredClone(MOCK_SIGNALS);
    },
    frameAt,
    subscribe(listener) {
      // Each subscription gets an independent deterministic timeline from zero.
      // The first frame arrives on the first tick, leaving time to keep cleanup.
      let sequence = 0;
      const timer = setInterval(
        () => listener(frameAt(sequence++)),
        intervalMs,
      );
      return () => clearInterval(timer);
    },
  };
}
