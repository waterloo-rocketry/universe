import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';
import {
  applyFrame,
  createTelemetryState,
  type ChannelState,
} from '../data/channel-store';
import {
  getMockFixture,
  MOCK_SIGNALS,
  type MockScenario,
} from '../data/mock/fixtures';

// "Now" is the fixture's own time, so nominal readings count as fresh.
// The fake reading always has the same timestamp
const NOW = getMockFixture().timestampMs;

/** Builds channels the same way the app does, from fake frames. */
function channelsAfter(...scenarios: MockScenario[]) {
  let state = createTelemetryState(MOCK_SIGNALS);
  for (const scenario of scenarios) {
    state = applyFrame(state, getMockFixture(scenario));
  }
  return state.channels;
}

/** Draws one bar and returns its outer box and its fill (null if no fill). */
function renderBar(channel: ChannelState, min = 0, max = 100) {
  const { container } = render(
    <ProgressBar channel={channel} min={min} max={max} nowMs={NOW} />,
  );
  return {
    bar: container.querySelector('.progress-bar'),
    fill: container.querySelector('.progress-bar__fill'),
  };
}

describe('ProgressBar', () => {
  it('fills to where the value sits between min and max', () => {
    const { bar, fill } = renderBar(channelsAfter('nominal')['test.pressure']);

    expect(screen.getByText('Test pressure')).toBeInTheDocument();
    expect(screen.getByText('42 kPa')).toBeInTheDocument();
    expect(bar).toHaveClass('progress-bar--active');
    expect(fill).toHaveClass('progress-bar__fill--in');
    expect(fill).toHaveStyle({ width: '42%' });
  });

  it('fills completely and warns when the value is above range', () => {
    const { fill } = renderBar(
      channelsAfter('nominal')['test.pressure'],
      0,
      10,
    );

    expect(screen.getByText('42 kPa ▲ above range')).toBeInTheDocument();
    expect(fill).toHaveClass('progress-bar__fill--above');
    expect(fill).toHaveStyle({ width: '100%' });
  });

  it('empties and warns when the value is below range', () => {
    const { fill } = renderBar(
      channelsAfter('nominal')['test.pressure'],
      50,
      100,
    );

    expect(screen.getByText('42 kPa ▼ below range')).toBeInTheDocument();
    expect(fill).toHaveClass('progress-bar__fill--below');
    expect(fill).toHaveStyle({ width: '0%' });
  });

  it('marks an old reading as stale', () => {
    const { bar } = renderBar(channelsAfter('stale')['test.pressure']);

    expect(screen.getByText('42 kPa · stale')).toBeInTheDocument();
    expect(bar).toHaveClass('progress-bar--stale');
  });

  it('shows when a reading was last updated once it is over 3 s old', () => {
    renderBar(channelsAfter('stale')['test.pressure']);

    expect(screen.getByText('updated 30 s ago')).toBeInTheDocument();
  });

  it('starts the last updated tag at 3 s', () => {
    render(
      <ProgressBar
        channel={channelsAfter('nominal')['test.pressure']}
        min={0}
        max={100}
        nowMs={NOW + 3_000}
      />,
    );

    expect(screen.getByText('updated 3 s ago')).toBeInTheDocument();
  });

  it('hides the last updated tag for a fresh reading', () => {
    renderBar(channelsAfter('nominal')['test.pressure']);

    expect(screen.queryByText(/updated/)).not.toBeInTheDocument();
  });

  it('keeps the last value but marks it when disconnected', () => {
    const { bar } = renderBar(
      channelsAfter('nominal', 'disconnected')['test.pressure'],
    );

    expect(screen.getByText('42 kPa · disconnected')).toBeInTheDocument();
    expect(bar).toHaveClass('progress-bar--disconnected');
  });

  it.each(['missing', 'invalid'] as const)(
    'shows %s readings without a fill',
    (scenario) => {
      const { bar, fill } = renderBar(channelsAfter(scenario)['test.pressure']);

      expect(screen.getByText(scenario)).toBeInTheDocument();
      expect(bar).toHaveClass(`progress-bar--${scenario}`);
      expect(fill).not.toBeInTheDocument();
    },
  );

  it('shows no data before any reading arrives', () => {
    const { fill } = renderBar(channelsAfter()['test.pressure']);

    expect(screen.getByText('no data')).toBeInTheDocument();
    expect(fill).not.toBeInTheDocument();
  });

  it('refuses channels that are not numbers', () => {
    const { bar } = renderBar(channelsAfter('nominal')['test.enabled']);

    expect(screen.getByText('not a numeric channel')).toBeInTheDocument();
    expect(bar).toHaveClass('progress-bar--error');
  });

  it('reports a min that is not below the max', () => {
    const { bar } = renderBar(channelsAfter('nominal')['test.pressure'], 5, 5);

    expect(screen.getByText('invalid range')).toBeInTheDocument();
    expect(bar).toHaveClass('progress-bar--error');
  });
});
