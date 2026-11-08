import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getMockFixture, MOCK_SIGNALS } from '../data/mock/fixtures';
import { TelemetryProvider } from '../data/TelemetryProvider';
import { TestEventSource } from '../test/event-source';
import { ChannelReadout } from './ChannelReadout';

/** Draws the widget inside a Provider and returns the fake stream to control. */
function setup(signalId = 'test.pressure') {
  render(
    <TelemetryProvider url="/test-api/events">
      <ChannelReadout signalId={signalId} />
    </TelemetryProvider>,
  );
  return TestEventSource.instances[0];
}

describe('ChannelReadout', () => {
  // Test 1
  it('shows unavailable before the channel list arrives', () => {
    setup();
    expect(screen.getByText(/unavailable/)).toBeInTheDocument();
  });

  // Test 2
  it('updates when new samples arrive', () => {
    const events = setup();
    act(() => events.signals(MOCK_SIGNALS));
    act(() => events.frame(getMockFixture()));
    expect(screen.getByText(/kPa/)).toBeInTheDocument();
  });

  // Test 3
  it('shows the status instead of a value for missing readings', () => {
    const events = setup();
    act(() => events.signals(MOCK_SIGNALS));
    act(() => events.frame(getMockFixture('missing')));
    expect(screen.getByText('missing')).toBeInTheDocument();
  });

  // Test 4
  it('marks a kept value as stale', () => {
    const events = setup();
    act(() => events.signals(MOCK_SIGNALS));
    act(() => events.frame(getMockFixture('stale')));
    expect(screen.getByText(/\(stale\)/)).toBeInTheDocument();
  });

  // Test 5
  it('shows values without a unit', () => {
    const events = setup('test.status');
    act(() => events.signals(MOCK_SIGNALS));
    act(() => events.frame(getMockFixture()));
    expect(screen.getByText(/Test status:/)).toBeInTheDocument();
  });
});
