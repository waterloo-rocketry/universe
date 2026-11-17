import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BaseComponent from './BaseComponent';
import { applyFrame, createTelemetryState } from '../data/channel-store';
import {
  getMockFixture,
  MOCK_SIGNALS,
  type MockScenario,
} from '../data/mock/fixtures';

const NOW = getMockFixture().timestampMs;

function channelsAfter(...scenarios: MockScenario[]) {
  let state = createTelemetryState(MOCK_SIGNALS);
  for (const scenario of scenarios) {
    state = applyFrame(state, getMockFixture(scenario));
  }
  return state.channels;
}

function renderBase(
  channel: ReturnType<typeof channelsAfter>[string] | undefined,
  props: { title?: string; errorMessage?: string } = {},
) {
  return render(
    <BaseComponent
      id="w1"
      componentType="numeric"
      channel={channel}
      currentTime={NOW}
      {...props}
    >
      <p>child content</p>
    </BaseComponent>,
  );
}

function contentOf(text: string) {
  return screen.getByText(text).parentElement;
}

describe('BaseComponent', () => {
  it('shows children and the channel label when active', () => {
    const { container } = renderBase(channelsAfter('nominal')['test.pressure']);

    expect(screen.getByText('child content')).toBeInTheDocument();
    expect(screen.getByRole('heading')).toHaveTextContent('Test pressure');
    const section = container.querySelector('section');
    expect(section).toHaveClass('widget--numeric', 'widget--active');
    expect(section).toHaveAttribute('data-widget-id', 'w1');
  });

  it('prefers an explicit title over the signal label', () => {
    renderBase(channelsAfter('nominal')['test.pressure'], { title: 'Custom' });

    expect(screen.getByRole('heading')).toHaveTextContent('Custom');
  });

  it.each(['stale', 'disconnected'] as const)(
    'keeps children visible and flags the heading when %s',
    (scenario) => {
      const channels =
        scenario === 'disconnected'
          ? channelsAfter('nominal', 'disconnected')
          : channelsAfter('stale');
      const { container } = renderBase(channels['test.pressure']);

      expect(screen.getByText('child content')).toBeInTheDocument();
      expect(screen.getByRole('heading')).toHaveTextContent(`(${scenario})`);
      expect(container.querySelector('section')).toHaveClass(
        `widget--${scenario}`,
      );
    },
  );

  it('keeps children mounted but covered by a message before any reading', () => {
    renderBase(channelsAfter()['test.pressure']);

    expect(screen.getByRole('alert')).toHaveTextContent('No data!');
    expect(screen.getByText('child content')).toBeInTheDocument();
    expect(contentOf('child content')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps children mounted but covered when the channel is undefined', () => {
    const { container } = renderBase(undefined);

    expect(screen.getByRole('alert')).toHaveTextContent('Channel not found!');
    expect(contentOf('child content')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('section')).toHaveClass(
      'widget--missing-channel',
    );
  });

  it('shows an alert for invalid readings, with a custom message if given', () => {
    const channel = channelsAfter('invalid')['test.pressure'];
    const { unmount } = renderBase(channel);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid channel data!',
    );
    expect(contentOf('child content')).toHaveAttribute('aria-hidden', 'true');
    unmount();

    renderBase(channel, { errorMessage: 'Sensor fault' });
    expect(screen.getByRole('alert')).toHaveTextContent('Sensor fault');
  });

  it('does not cover children or show an alert when active, stale, or disconnected', () => {
    renderBase(channelsAfter('nominal')['test.pressure']);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(contentOf('child content')).toHaveAttribute('aria-hidden', 'false');
  });

  it('does not remount children when the status changes', () => {
    const channel = channelsAfter('nominal')['test.pressure'];
    const { rerender } = renderBase(channel);
    const before = screen.getByText('child content');

    // Same channel, much later: now stale. Then no channel at all: missing-channel.
    for (const [ch, time] of [
      [channel, NOW + 60_000],
      [undefined, NOW + 60_000],
      [channel, NOW],
    ] as const) {
      rerender(
        <BaseComponent
          id="w1"
          componentType="numeric"
          channel={ch}
          currentTime={time}
        >
          <p>child content</p>
        </BaseComponent>,
      );
      // Same DOM node means React kept it mounted instead of recreating it.
      expect(screen.getByText('child content')).toBe(before);
    }
  });
});
