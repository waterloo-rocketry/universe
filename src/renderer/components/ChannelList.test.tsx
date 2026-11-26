import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChannelList } from './ChannelList';
import { TelemetryMonitor } from './TelemetryMonitor';
import { applyFrame, createTelemetryState } from '../data/channel-store';
import { getMockFixture, MOCK_SIGNALS } from '../data/mock/fixtures';
import type { DataFrame } from '../../shared/data-source';
import type { dashboardLayout } from '../Layout';
import { TestEventSource } from '../test/event-source';

/**
 * An empty grid, so these tests don't depend on DEFAULT_LAYOUT (demo data
 * that changes). The channel list sits beside the grid, not in it.
 * Defined once: the grid resets on a new object.
 */
const MONITOR_LAYOUT: dashboardLayout = {
  version: 1,
  numberOfCols: 1,
  numberOfRows: 1,
  items: [],
};

function renderList(frame?: DataFrame, nowMs = getMockFixture().timestampMs) {
  let state = createTelemetryState(MOCK_SIGNALS);
  if (frame) state = applyFrame(state, frame);
  render(
    <ChannelList channels={Object.values(state.channels)} nowMs={nowMs} />,
  );
}

const row = (label: string) =>
  screen.getByRole('row', { name: new RegExp(label) });

describe('channel list', () => {
  it('lists every channel with no data before readings arrive', () => {
    renderList();
    for (const signal of MOCK_SIGNALS)
      expect(row(signal.label)).toHaveTextContent('no data');
  });

  it('shows status, latest value with unit, and reading age', () => {
    renderList(getMockFixture(), getMockFixture().timestampMs + 1_500);
    const pressure = row('Test pressure');
    expect(pressure).toHaveTextContent('active');
    expect(pressure).toHaveTextContent('42 kPa');
    expect(pressure).toHaveTextContent('1.5 s ago');
    expect(row('Test enabled')).toHaveTextContent('true');
    expect(row('Test status')).toHaveTextContent('idle');
  });

  it.each(['stale', 'missing', 'invalid'] as const)(
    'shows %s channels',
    (scenario) => {
      renderList(getMockFixture(scenario));
      expect(
        within(row('Test pressure')).getByText(scenario),
      ).toBeInTheDocument();
    },
  );

  it('hides values that are missing or invalid', () => {
    renderList(getMockFixture('missing'));
    expect(row('Test pressure')).toHaveTextContent('—');
  });

  it('shows a message when there are no channels to list', () => {
    render(<ChannelList channels={[]} nowMs={0} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('only shows hide buttons when hiding is supported', () => {
    renderList();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('telemetry monitor', () => {
  it('waits for the catalogue, then lists live channels', () => {
    render(<TelemetryMonitor url="/test-api/events" layout={MONITOR_LAYOUT} />);
    expect(screen.getByText('Waiting for channels')).toBeInTheDocument();

    const events = TestEventSource.instances[0];
    expect(events.url).toBe('/test-api/events');
    act(() => events.signals(MOCK_SIGNALS));
    act(() => events.frame({ ...getMockFixture(), timestampMs: Date.now() }));
    expect(row('Test pressure')).toHaveTextContent('42 kPa');

    act(() => events.onerror?.());
    expect(row('Test pressure')).toHaveTextContent('disconnected');
  });

  describe('filters', () => {
    function startMonitor() {
      render(
        <TelemetryMonitor url="/test-api/events" layout={MONITOR_LAYOUT} />,
      );
      const events = TestEventSource.instances[0];
      act(() => events.signals(MOCK_SIGNALS));
      // Missing pressure is the only problem channel.
      act(() =>
        events.frame({
          ...getMockFixture('missing'),
          readings: getMockFixture('missing').readings.map((reading) => ({
            ...reading,
            timestampMs: Date.now(),
          })),
        }),
      );
    }
    const visible = () =>
      screen.getAllByRole('rowheader').map((header) => header.textContent);

    it('searches channels by name', () => {
      startMonitor();
      fireEvent.change(
        screen.getByRole('searchbox', { name: 'Search channels' }),
        {
          target: { value: 'temp' },
        },
      );
      expect(visible()).toEqual(['Test temperature']);
    });

    it('says when nothing matches', () => {
      startMonitor();
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'zzz' },
      });
      expect(
        screen.getByText('No channels match the filters'),
      ).toBeInTheDocument();
    });

    it('shows only problem channels', () => {
      startMonitor();
      fireEvent.click(
        screen.getByRole('checkbox', { name: 'Show only problems' }),
      );
      expect(visible()).toEqual(['Test pressure']);
    });

    it('hides channels and brings them back', () => {
      startMonitor();
      fireEvent.click(
        screen.getByRole('button', { name: 'Hide Test pressure' }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Hide Test status' }));
      expect(visible()).toEqual(['Test temperature', 'Test enabled']);

      fireEvent.click(screen.getByRole('button', { name: 'Show 2 hidden' }));
      expect(visible()).toHaveLength(MOCK_SIGNALS.length);
      expect(
        screen.queryByRole('button', { name: /hidden/ }),
      ).not.toBeInTheDocument();
    });
  });
});
