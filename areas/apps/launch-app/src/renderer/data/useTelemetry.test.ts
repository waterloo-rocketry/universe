import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChannelStatus } from './channel-store';
import { getMockFixture, MOCK_SIGNALS } from './mock/fixtures';
import { useTelemetry, type TelemetryOptions } from './useTelemetry';
import { TestEventSource } from '../test/event-source';

const PRESSURE = 'test.pressure';
const URL = '/test-api/events';

function setup(options: Partial<TelemetryOptions> = {}) {
  const hook = renderHook(() => useTelemetry({ url: URL, ...options }));
  return { ...hook, events: TestEventSource.instances[0] };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useTelemetry', () => {
  it('builds channels from the catalogue and records frames', () => {
    const { result, events } = setup();
    expect(events.url).toBe(URL);
    expect(result.current).toMatchObject({ stream: 'connecting', state: null });

    act(() => events.signals(MOCK_SIGNALS));
    act(() => events.frame(getMockFixture()));

    expect(result.current.stream).toBe('connected');
    expect(result.current.state?.channels[PRESSURE].history).toEqual([
      getMockFixture().readings[0],
    ]);
  });

  it('ignores frames that arrive before the catalogue', () => {
    const { result, events } = setup();
    act(() => events.frame(getMockFixture()));
    expect(result.current.stream).toBe('connected');
    expect(result.current.state).toBeNull();
  });

  it('applies the configured history size', () => {
    const { result, events } = setup({ historySize: 1 });
    act(() => events.signals(MOCK_SIGNALS));
    const later = getMockFixture();
    later.readings = later.readings.map((r) => ({
      ...r,
      timestampMs: r.timestampMs + 100,
    }));
    act(() => events.frame(getMockFixture()));
    act(() => events.frame(later));
    expect(result.current.state?.channels[PRESSURE].history).toEqual([
      later.readings[0],
    ]);
  });

  it('keeps history but shows channels disconnected when the stream drops', () => {
    const { result, events } = setup();
    act(() => events.signals(MOCK_SIGNALS));
    act(() => events.frame(getMockFixture()));
    act(() => events.onerror?.());

    expect(result.current.stream).toBe('disconnected');
    const channel = result.current.state!.channels[PRESSURE];
    expect(channel.history).toHaveLength(1);
    expect(getChannelStatus(channel, result.current.nowMs)).toBe(
      'disconnected',
    );

    // Reconnect: the server resends the catalogue, which must not wipe history.
    act(() => events.signals(MOCK_SIGNALS));
    expect(result.current.state?.channels[PRESSURE].history).toHaveLength(1);
  });

  it.each([
    ['signals', { not: 'a list' }],
    ['frame', { ...getMockFixture(), schemaVersion: 99 }],
  ] as const)('reports invalid %s data', (event, data) => {
    const { result, events } = setup();
    act(() =>
      event === 'signals' ? events.signals(data) : events.frame(data),
    );
    expect(result.current.stream).toBe('invalid');
  });

  it('reports unparseable JSON as invalid', () => {
    const { result, events } = setup();
    act(() => {
      events.dispatchEvent(new MessageEvent('frame', { data: '{' }));
    });
    expect(result.current.stream).toBe('invalid');
  });

  it('advances its clock without frames so channels can go stale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { result } = setup({ clockIntervalMs: 500 });
    act(() => vi.advanceTimersByTime(1_500));
    expect(result.current.nowMs).toBe(1_500);
  });

  it('closes the stream on unmount', () => {
    const { unmount, events } = setup();
    unmount();
    expect(events.close).toHaveBeenCalledOnce();
  });
});
