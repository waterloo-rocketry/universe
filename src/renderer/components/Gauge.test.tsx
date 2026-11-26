import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  applyFrame,
  createTelemetryState,
  getLatestReading,
  getChannelStatus,
  type ChannelState,
} from '../data/channel-store';
import {
  getMockFixture,
  MOCK_SIGNALS,
  type MockScenario,
} from '../data/mock/fixtures';
import BaseComponent from './BaseComponent';
import { ChannelData } from '../data/telemetry-context';
import { TelemetryProvider } from '../data/TelemetryProvider';

// "Now" is the fixture's own time, so nominal readings count as fresh.
const NOW = getMockFixture().timestampMs;

// Needle rotation (deg) is angle - STARTING_DEGREES, with angle in [0, 240]
const REST = -210; // at (or below) min
const FULL = 30; // at (or above) max

/** Builds channels the same way the app does, from fake frames. */
function channelsAfter(...scenarios: MockScenario[]) {
  let state = createTelemetryState(MOCK_SIGNALS);
  for (const scenario of scenarios) {
    state = applyFrame(state, getMockFixture(scenario));
  }
  return state.channels;
}

function toChannelData(channel: ChannelState): ChannelData {
  return {
    channel,
    latest: getLatestReading(channel),
    history: channel.history,
    status: getChannelStatus(channel, NOW),
    nowMs: NOW,
  };
}

/** Draws one gauge and returns the parts the tests care about. */
function renderGauge(channel: ChannelState, min = 0, max = 100) {
  const { container } = render(
    <TelemetryProvider url={''}>
      <BaseComponent
        id="gauge-test"
        componentType="gauge"
        channels={[]}
        overrideChannels={[toChannelData(channel)]}
        config={{ min, max }}
        updateConfig={() => {}}
        setOverlay={() => {}}
      />
    </TelemetryProvider>,
  );
  return {
    container,
    gauge: container.querySelector('.gauge'),
    face: container.querySelector('.gauge_face'),
    hand: container.querySelector<HTMLElement>('.gauge_circle_hand'),
    status: container.querySelector('.gauge_status_text'),
  };
}

/** Pulls the number out of "rotate(-109.2deg)". */
function needleDegrees(hand: HTMLElement | null) {
  const match = hand?.style.transform.match(/rotate\((-?[\d.]+)deg\)/);
  if (!match) throw new Error('needle has no rotation');
  return Number(match[1]);
}

describe('Gauge', () => {
  it('points the needle to where the value sits between min and max', () => {
    const { hand, face } = renderGauge(
      channelsAfter('nominal')['test.pressure'],
    );

    expect(screen.getByText('42 kPa')).toBeInTheDocument();
    // 42% of the 240 degree sweep, minus the 210 degree starting offset
    expect(needleDegrees(hand)).toBeCloseTo(240 * 0.42 - 210);
    expect(face).toHaveAttribute('fill', 'white');
  });

  it('accounts for a min that is not zero', () => {
    // 42 sits 40% of the way from 30 to 55
    const { hand } = renderGauge(
      channelsAfter('nominal')['test.pressure'],
      30,
      55,
    );

    expect(needleDegrees(hand)).toBeCloseTo(240 * 0.48 - 210);
  });

  it('pins the needle at max and tints the face when above range', () => {
    const { hand, face } = renderGauge(
      channelsAfter('nominal')['test.pressure'],
      0,
      10,
    );

    expect(screen.getByText('42 kPa')).toBeInTheDocument();
    expect(needleDegrees(hand)).toBe(FULL);
    expect(face).toHaveAttribute('fill', '#ffa9a9');
  });

  it('rests the needle at min and tints the face when below range', () => {
    const { hand, face } = renderGauge(
      channelsAfter('nominal')['test.pressure'],
      50,
      100,
    );

    expect(screen.getByText('42 kPa')).toBeInTheDocument();
    expect(needleDegrees(hand)).toBe(REST);
    expect(face).toHaveAttribute('fill', '#ffa9a9');
  });

  it('draws ticks and labels across the range', () => {
    const { container } = renderGauge(
      channelsAfter('nominal')['test.pressure'],
      0,
      10,
    );

    expect(container.querySelectorAll('.gauge_tick')).toHaveLength(11);
    expect(container.querySelectorAll('.gauge_tick_major')).toHaveLength(6);

    const labels = [...container.querySelectorAll('.gauge_label')].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(['0', '2', '4', '6', '8', '10']);
  });

  it('keeps the last value but shows the status when stale', () => {
    const { status, hand } = renderGauge(
      channelsAfter('stale')['test.pressure'],
    );

    expect(screen.getByText('42 kPa')).toBeInTheDocument();
    expect(status).toHaveTextContent('stale');
    expect(needleDegrees(hand)).toBeCloseTo(240 * 0.42 - 210);
  });

  it('keeps the last value but shows the status when disconnected', () => {
    const { status } = renderGauge(
      channelsAfter('nominal', 'disconnected')['test.pressure'],
    );

    expect(screen.getByText('42 kPa')).toBeInTheDocument();
    expect(status).toHaveTextContent('disconnected');
  });

  it.each(['missing', 'invalid'] as const)(
    'shows N/A and rests the needle at min for %s readings',
    (scenario) => {
      const { hand, status } = renderGauge(
        channelsAfter(scenario)['test.pressure'],
      );

      expect(screen.getByText('N/A')).toBeInTheDocument();
      expect(status).toHaveTextContent(scenario);
      expect(needleDegrees(hand)).toBe(REST);
    },
  );

  it('shows N/A before any reading arrives', () => {
    const { hand, status } = renderGauge(channelsAfter()['test.pressure']);

    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(status).toHaveTextContent('no-data');
    expect(needleDegrees(hand)).toBe(REST);
  });

  it('shows N/A for a NaN reading', () => {
    const channel = channelsAfter('nominal')['test.pressure'];
    const reading = {
      signalId: channel.signal.id,
      timestampMs: NOW,
      quality: 'good' as const,
      value: NaN,
    };
    const { hand } = renderGauge({ ...channel, history: [reading] });

    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(needleDegrees(hand)).toBe(REST);
  });

  it('rounds the displayed value to 3 decimal places', () => {
    const channel = channelsAfter('nominal')['test.pressure'];
    const reading = {
      signalId: channel.signal.id,
      timestampMs: NOW,
      quality: 'good' as const,
      value: 42.123456,
    };
    renderGauge({ ...channel, history: [reading] });

    expect(screen.getByText('42.123 kPa')).toBeInTheDocument();
  });

  it('refuses channels that are not numbers', () => {
    const { gauge } = renderGauge(channelsAfter('nominal')['test.enabled']);

    expect(screen.getByText('Not a numeric channel!')).toBeInTheDocument();
    expect(gauge).not.toBeInTheDocument();
  });

  it('reports a NaN range as invalid', () => {
    const { gauge } = renderGauge(
      channelsAfter('nominal')['test.pressure'],
      NaN,
      100,
    );

    expect(screen.getByText('Invalid range!')).toBeInTheDocument();
    expect(gauge).not.toBeInTheDocument();
  });

  it('reports a min that is not below the max', () => {
    renderGauge(channelsAfter('nominal')['test.pressure'], 5, 5);

    expect(screen.getByText('Invalid range!')).toBeInTheDocument();
  });
});
