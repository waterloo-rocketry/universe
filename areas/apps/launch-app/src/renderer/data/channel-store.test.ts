import { describe, expect, it } from 'vitest';
import {
  applyFrame,
  createTelemetryState,
  disconnectAll,
  getChannelStatus,
  getLatestReading,
  updateSignals,
} from './channel-store';
import { getMockFixture, MOCK_SIGNALS } from './mock/fixtures';
import { createMockDataSource } from './mock/source';

const PRESSURE = 'test.pressure';

describe('channel store', () => {
  it('starts every catalogue signal with no data', () => {
    const state = createTelemetryState(MOCK_SIGNALS);
    expect(Object.keys(state.channels)).toEqual(MOCK_SIGNALS.map((s) => s.id));
    for (const channel of Object.values(state.channels))
      expect(getChannelStatus(channel, 0)).toBe('no-data');
  });

  it('rejects a non-positive history size', () => {
    expect(() => createTelemetryState(MOCK_SIGNALS, 0)).toThrow(RangeError);
  });

  it('keeps a bounded, oldest-first history per channel', () => {
    const source = createMockDataSource();
    let state = createTelemetryState(MOCK_SIGNALS, 3);
    for (let sequence = 0; sequence < 5; sequence++)
      state = applyFrame(state, source.frameAt(sequence));

    const history = state.channels[PRESSURE].history;
    expect(history.map((r) => r.timestampMs)).toEqual(
      [2, 3, 4].map((sequence) => source.frameAt(sequence).timestampMs),
    );
    expect(getLatestReading(state.channels[PRESSURE])).toEqual(
      source.frameAt(4).readings[0],
    );
  });

  it('ignores repeated, out-of-order, and unknown readings', () => {
    const source = createMockDataSource();
    let state = createTelemetryState(MOCK_SIGNALS);
    state = applyFrame(state, source.frameAt(2));
    state = applyFrame(state, source.frameAt(2));
    state = applyFrame(state, source.frameAt(1));
    const unknown = getMockFixture();
    unknown.readings = [{ ...unknown.readings[0], signalId: 'not.a.signal' }];
    state = applyFrame(state, unknown);

    expect(state.channels[PRESSURE].history).toHaveLength(1);
    expect(state.channels).not.toHaveProperty('not.a.signal');
  });

  it('does not mutate the previous state', () => {
    const before = createTelemetryState(MOCK_SIGNALS);
    const after = applyFrame(before, getMockFixture());
    expect(before.channels[PRESSURE].history).toHaveLength(0);
    expect(after.channels[PRESSURE].history).toHaveLength(1);
  });

  it('keeps history for surviving channels when the catalogue changes', () => {
    const state = applyFrame(
      createTelemetryState(MOCK_SIGNALS),
      getMockFixture(),
    );
    const renamed = { ...MOCK_SIGNALS[0], label: 'Renamed' };
    const added = {
      id: 'test.new',
      label: 'New',
      kind: 'number',
      unit: '',
    } as const;
    const next = updateSignals(state, [renamed, added]);

    expect(Object.keys(next.channels)).toEqual([PRESSURE, 'test.new']);
    expect(next.channels[PRESSURE].signal.label).toBe('Renamed');
    expect(next.channels[PRESSURE].history).toHaveLength(1);
    expect(next.channels['test.new'].history).toHaveLength(0);
  });

  it('marks every channel disconnected when the stream drops', () => {
    const frame = getMockFixture();
    const state = disconnectAll(
      applyFrame(createTelemetryState(MOCK_SIGNALS), frame),
    );
    expect(getChannelStatus(state.channels[PRESSURE], frame.timestampMs)).toBe(
      'disconnected',
    );
    // The next connected frame from the source restores it.
    const later = getMockFixture();
    later.readings = [];
    expect(
      getChannelStatus(
        applyFrame(state, later).channels[PRESSURE],
        frame.timestampMs,
      ),
    ).toBe('active');
  });
});

describe('channel status', () => {
  const frame = getMockFixture();
  const now = frame.timestampMs;
  const statusAfter = (...frames: ReturnType<typeof getMockFixture>[]) => {
    const state = frames.reduce(applyFrame, createTelemetryState(MOCK_SIGNALS));
    return getChannelStatus(state.channels[PRESSURE], now);
  };

  it('is active for a fresh good reading', () => {
    expect(statusAfter(frame)).toBe('active');
  });

  it('is stale once the latest reading is older than the threshold', () => {
    expect(statusAfter(getMockFixture('stale'))).toBe('stale');
  });

  it.each(['missing', 'invalid'] as const)(
    'reports %s readings',
    (scenario) => {
      expect(statusAfter(getMockFixture(scenario))).toBe(scenario);
    },
  );

  it('is disconnected when its source disconnects, keeping its history', () => {
    const disconnected = getMockFixture('disconnected');
    const state = applyFrame(
      applyFrame(createTelemetryState(MOCK_SIGNALS), frame),
      disconnected,
    );
    expect(getChannelStatus(state.channels[PRESSURE], now)).toBe(
      'disconnected',
    );
    expect(state.channels[PRESSURE].history).toHaveLength(1);
  });

  it('reconnects when the source sends a connected frame again', () => {
    const later = getMockFixture();
    later.readings = [];
    expect(statusAfter(frame, getMockFixture('disconnected'), later)).toBe(
      'active',
    );
  });
});
