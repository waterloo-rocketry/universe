import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { applyFrame, createTelemetryState } from './channel-store';
import { getMockFixture, MOCK_SIGNALS } from './mock/fixtures';
import { TelemetryContext } from './telemetry-context';
import type { Telemetry } from './useTelemetry';
import { useWidgetDataHandler } from './WidgetDataHandler';

const NOW = getMockFixture().timestampMs;

function wrapperFor(telemetry: Telemetry) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TelemetryContext.Provider value={telemetry}>
        {children}
      </TelemetryContext.Provider>
    );
  };
}

function telemetryWithFrame(scenario: 'nominal' | 'invalid'): Telemetry {
  return {
    state: applyFrame(
      createTelemetryState(MOCK_SIGNALS),
      getMockFixture(scenario),
    ),
    nowMs: NOW,
    stream: 'connected',
  };
}

describe('useWidgetDataHandler', () => {
  it('returns ordered channels and labels with the most severe status and every error', () => {
    const { result } = renderHook(
      () =>
        useWidgetDataHandler(['test.temperature', 'test.pressure', 'unknown']),
      { wrapper: wrapperFor(telemetryWithFrame('invalid')) },
    );

    expect(
      result.current.channels.map(
        (channel) => channel?.channel.signal.id ?? null,
      ),
    ).toEqual(['test.temperature', 'test.pressure', null]);
    expect(result.current.channelLabels).toEqual([
      'Test temperature',
      'Test pressure',
      'unknown',
    ]);
    expect(result.current.componentStatus).toBe('missing-channel');
    expect(result.current.overlayMessage).toBe(
      'Test pressure - Invalid channel data!\nunknown - Channel not found!',
    );
  });

  it('uses the widget error override for channel errors', () => {
    const { result } = renderHook(
      () => useWidgetDataHandler(['test.pressure'], 'Unavailable'),
      { wrapper: wrapperFor(telemetryWithFrame('invalid')) },
    );

    expect(result.current.componentStatus).toBe('invalid');
    expect(result.current.overlayMessage).toBe('Unavailable');
  });

  it('returns an active status without an overlay for no channels', () => {
    const { result } = renderHook(() => useWidgetDataHandler([]), {
      wrapper: wrapperFor(telemetryWithFrame('nominal')),
    });

    expect(result.current.channels).toEqual([]);
    expect(result.current.channelLabels).toEqual([]);
    expect(result.current.componentStatus).toBe('active');
    expect(result.current.overlayMessage).toBeNull();
  });
});
