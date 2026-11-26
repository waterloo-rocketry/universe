import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMockFixture, MOCK_SCENARIOS, MOCK_SIGNALS } from './fixtures';
import { createMockDataSource } from './source';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('mock fixtures', () => {
  it.each(MOCK_SCENARIOS)(
    '%s is JSON serializable and references known signals',
    (scenario) => {
      const frame = getMockFixture(scenario);
      expect(JSON.parse(JSON.stringify(frame))).toEqual(frame);
      for (const reading of frame.readings) {
        const signal = MOCK_SIGNALS.find(({ id }) => id === reading.signalId);
        expect(signal).toBeDefined();
        expect(Number.isSafeInteger(reading.timestampMs)).toBe(true);
        if (reading.quality === 'good')
          expect(typeof reading.value).toBe(signal?.kind);
        else expect(reading.value).toBeNull();
      }
    },
  );

  it('returns independent fixture objects', () => {
    getMockFixture().readings.splice(0);
    expect(getMockFixture().readings).toHaveLength(4);
  });

  it('represents absent/bad readings explicitly without JSON-unsafe numbers', () => {
    expect(getMockFixture('missing').readings[0]).toMatchObject({
      quality: 'missing',
      value: null,
    });
    expect(getMockFixture('invalid').readings[0]).toMatchObject({
      quality: 'invalid',
      value: null,
    });
    expect(getMockFixture('disconnected')).toMatchObject({
      connection: 'disconnected',
      readings: [],
    });
  });
});

describe('mock data source', () => {
  it('reproduces samples independently of call order and wall clock', () => {
    const a = createMockDataSource({ seed: 123 });
    const b = createMockDataSource({ seed: 123 });
    a.frameAt(99);
    expect(a.frameAt(4)).toEqual(b.frameAt(4));
    expect(a.frameAt(4)).not.toEqual(
      createMockDataSource({ seed: 124 }).frameAt(4),
    );
  });

  it('uses explicit millisecond timestamps and configurable cadence', () => {
    const source = createMockDataSource({
      startTimeMs: 1_000_000,
      intervalMs: 250,
    });
    const frame = source.frameAt(3);
    expect(frame.timestampMs).toBe(1_000_750);
    expect(frame.sequence).toBe(3);
    expect(
      frame.readings.every(
        (reading) => reading.timestampMs === frame.timestampMs,
      ),
    ).toBe(true);
    expect(frame.readings.map(({ value }) => typeof value)).toEqual([
      'number',
      'number',
      'boolean',
      'string',
    ]);
  });

  it('keeps stale values and measurement timestamps frozen while frames advance', () => {
    const source = createMockDataSource({ scenario: 'stale' });
    const first = source.frameAt(0);
    const later = source.frameAt(50);
    expect(later.readings).toEqual(first.readings);
    expect(later.timestampMs).toBeGreaterThan(first.timestampMs);
    expect(first.timestampMs - first.readings[0].timestampMs).toBe(30_000);
  });

  it('does not leak mutable data between reads', () => {
    const source = createMockDataSource();
    source.frameAt(0).readings.splice(0);
    const signals = source.signals;
    signals[0].label = 'changed';
    expect(source.frameAt(0).readings).toHaveLength(4);
    expect(source.signals[0].label).toBe('Test pressure');
  });

  it('subscribes on demand and releases all timers, including repeated cleanup', () => {
    vi.useFakeTimers();
    const source = createMockDataSource({ intervalMs: 100 });
    expect(vi.getTimerCount()).toBe(0);
    const a = vi.fn();
    const b = vi.fn();
    const stopA = source.subscribe(a);
    const stopB = source.subscribe(b);
    vi.advanceTimersByTime(300);
    expect(a.mock.calls.map(([frame]) => frame.sequence)).toEqual([0, 1, 2]);
    expect(a.mock.calls).toEqual(b.mock.calls);
    stopA();
    stopA();
    vi.advanceTimersByTime(100);
    expect(a).toHaveBeenCalledTimes(3);
    expect(b).toHaveBeenCalledTimes(4);
    stopB();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { intervalMs: 0 },
    { intervalMs: -1 },
    { intervalMs: Infinity },
    { intervalMs: 2 ** 31 },
    { startTimeMs: NaN },
    { startTimeMs: -1 },
    { seed: -1 },
    { seed: 0.5 },
    { seed: 2 ** 32 },
  ])('rejects invalid options %j', (options) => {
    expect(() => createMockDataSource(options)).toThrow(RangeError);
  });

  it.each([-1, 0.5, NaN, Number.MAX_SAFE_INTEGER])(
    'rejects invalid sequence %s',
    (sequence) => {
      expect(() => createMockDataSource().frameAt(sequence)).toThrow(
        RangeError,
      );
    },
  );
});
