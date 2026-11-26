import { describe, expect, it } from 'vitest';
import { applyFrame, createTelemetryState } from './channel-store';
import {
  EMPTY_FILTER,
  filterChannels,
  type ChannelFilter,
} from './channel-filter';
import { getMockFixture, MOCK_SIGNALS } from './mock/fixtures';

const frame = getMockFixture('missing');
const channels = Object.values(
  applyFrame(createTelemetryState(MOCK_SIGNALS), frame).channels,
);
const ids = (filter: Partial<ChannelFilter>) =>
  filterChannels(
    channels,
    { ...EMPTY_FILTER, ...filter },
    frame.timestampMs,
  ).map((channel) => channel.signal.id);

describe('channel filter', () => {
  it('keeps every channel with an empty filter', () => {
    expect(ids({})).toEqual(MOCK_SIGNALS.map((signal) => signal.id));
  });

  it('matches the label or ID, ignoring case and surrounding spaces', () => {
    expect(ids({ query: '  PRESSURE ' })).toEqual(['test.pressure']);
    expect(ids({ query: 'test.temp' })).toEqual(['test.temperature']);
    expect(ids({ query: 'nothing matches' })).toEqual([]);
  });

  it('shows only channels that need attention', () => {
    expect(ids({ problemsOnly: true })).toEqual(['test.pressure']);
  });

  it('treats channels without data as problems', () => {
    const empty = Object.values(createTelemetryState(MOCK_SIGNALS).channels);
    expect(
      filterChannels(empty, { ...EMPTY_FILTER, problemsOnly: true }, 0),
    ).toHaveLength(MOCK_SIGNALS.length);
  });

  it('removes hidden channels', () => {
    expect(ids({ hidden: new Set(['test.pressure', 'test.status']) })).toEqual([
      'test.temperature',
      'test.enabled',
    ]);
  });

  it('combines filters', () => {
    expect(
      ids({ query: 'test', problemsOnly: true, hidden: new Set() }),
    ).toEqual(['test.pressure']);
    expect(
      ids({ problemsOnly: true, hidden: new Set(['test.pressure']) }),
    ).toEqual([]);
  });
});
