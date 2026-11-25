import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NumericWidget from './NumericWidget';
import { getMockFixture, MOCK_SIGNALS } from '../data/mock/fixtures';
import { TelemetryProvider } from '../data/TelemetryProvider';
import { TestEventSource } from '../test/event-source';

function setup(signalId = 'test.pressure') {
  render(
    <TelemetryProvider url="/test-api/events">
      <NumericWidget id={signalId} />
    </TelemetryProvider>,
  );
  return TestEventSource.instances[0];
}

/** A nominal frame with a new pressure value and a newer timestamp. */
function frameWithPressure(value: number, offsetMs: number) {
  const base = getMockFixture();
  const timestampMs = base.timestampMs + offsetMs;
  return {
    ...base,
    sequence: base.sequence + 1,
    timestampMs,
    readings: base.readings.map((reading) =>
      reading.signalId === 'test.pressure'
        ? { ...reading, timestampMs, value }
        : reading,
    ),
  };
}

describe('NumericWidget', () => {
  it('shows the latest value of the selected channel', () => {
    const events = setup();
    act(() => events.signals(MOCK_SIGNALS));
    act(() => events.frame(getMockFixture()));

    expect(screen.getByTestId('numeric-value').textContent).toContain('kPa');
  });

  it('updates when a newer reading arrives', () => {
    const events = setup();
    act(() => events.signals(MOCK_SIGNALS));
    act(() => events.frame(getMockFixture()));
    act(() => events.frame(frameWithPressure(123.5, 1000)));

    expect(screen.getByTestId('numeric-value').textContent).toContain('123.5');
  });

  it('shows a clear message when the value is not a number', () => {
    const events = setup();
    act(() => events.signals(MOCK_SIGNALS));
    const frame = getMockFixture();
    const bad = {
      ...frame,
      readings: frame.readings.map((reading) =>
        reading.signalId === 'test.pressure'
          ? { ...reading, value: 'abc' as unknown as number }
          : reading,
      ),
    };
    act(() => events.frame(bad));

    expect(screen.getByTestId('numeric-value').textContent).toBe(
      'Not a number',
    );
  });

  it('shows a no-data message before any reading', () => {
    const events = setup();
    act(() => events.signals(MOCK_SIGNALS));

    expect(screen.getByRole('alert').textContent).toContain('No data!');
    expect(screen.getByTestId('numeric-value').textContent).toBe('--');
  });

  it('flags stale data in the heading', () => {
    const events = setup();
    act(() => events.signals(MOCK_SIGNALS));
    act(() => events.frame(getMockFixture('stale')));

    expect(screen.getByRole('heading').textContent).toContain('stale');
  });

  it('shows a channel-not-found message when the channel is missing', () => {
    const events = setup('does.not.exist');
    act(() => events.signals(MOCK_SIGNALS));

    expect(screen.getByRole('alert').textContent).toContain(
      'Channel not found!',
    );
  });
});
