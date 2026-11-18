import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { getMockFixture, MOCK_SIGNALS } from './mock/fixtures';
import { useChannel } from './telemetry-context';
import { TelemetryProvider } from './TelemetryProvider';
import { TestEventSource } from '../test/event-source';

/** Puts the hook inside a Provider, like a real widget. */
const wrapper = ({ children }: { children: ReactNode }) => (
  <TelemetryProvider url="/test-api/events">{children}</TelemetryProvider>
);

describe('useChannel', () => {
  it('returns the latest reading and history for a channel', () => {
    const { result } = renderHook(() => useChannel('test.pressure'), {
      wrapper,
    });
    const events = TestEventSource.instances[0];
    act(() => events.signals(MOCK_SIGNALS));
    act(() => events.frame(getMockFixture()));

    const reading = getMockFixture().readings[0];
    expect(result.current?.latest).toEqual(reading);
    expect(result.current?.history).toEqual([reading]);
  });

  // returns null for a channel that doesn't exist
  it('returns null for an unknown channel', () => {
    const { result } = renderHook(() => useChannel('nope'), { wrapper });
    act(() => TestEventSource.instances[0].signals(MOCK_SIGNALS));
    expect(result.current).toBeNull();
  });

  // throws outside a TelemetryProvider
  it('throws outside a TelemetryProvider', () => {
    expect(() => renderHook(() => useChannel('test.pressure'))).toThrow(
      'useChannel must be used inside a TelemetryProvider',
    );
  });
});
