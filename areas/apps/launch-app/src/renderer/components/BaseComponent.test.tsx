import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BaseComponent, { type BaseComponentProp } from './BaseComponent';
import { applyFrame, createTelemetryState } from '../data/channel-store';
import { TelemetryContext } from '../data/telemetry-context';
import type { Telemetry } from '../data/useTelemetry';
import {
  getMockFixture,
  MOCK_SIGNALS,
  type MockScenario,
} from '../data/mock/fixtures';

const NOW = getMockFixture().timestampMs;
const updateConfig = vi.fn();
const requestOverlay = vi.fn();

function telemetry(scenarios: MockScenario[] = [], nowMs = NOW): Telemetry {
  let state = createTelemetryState(MOCK_SIGNALS);
  for (const scenario of scenarios)
    state = applyFrame(state, getMockFixture(scenario));
  return { state, nowMs, stream: 'connected' };
}

function renderBase(value: Telemetry, props: Partial<BaseComponentProp> = {}) {
  const config: BaseComponentProp = {
    id: 'w1',
    componentType: 'progress-bar',
    channels: ['test.pressure'],
    updateConfig,
    requestOverlay,
    ...props,
  };
  return render(
    <TelemetryContext.Provider value={value}>
      <BaseComponent {...config} />
    </TelemetryContext.Provider>,
  );
}

describe('BaseComponent', () => {
  it('renders the registered widget from its channels and config', () => {
    const { container } = renderBase(telemetry(['nominal']), {
      config: { min: 30, max: 50 },
      width: 200,
      height: 80,
    });
    expect(screen.getByText('42 kPa')).toBeInTheDocument();
    expect(container.querySelector('.progress-bar__fill')).toHaveStyle({
      width: '60%',
    });
    expect(screen.getByRole('heading')).toHaveTextContent('Test pressure');
    expect(container.querySelector('section')).toHaveClass(
      'widget--progress-bar',
      'widget--active',
    );
    expect(container.querySelector('section')).toHaveAttribute(
      'data-widget-id',
      'w1',
    );
  });

  it('uses an explicit title and keeps the widget mounted through status changes', () => {
    const config: BaseComponentProp = {
      id: 'w1',
      componentType: 'progress-bar',
      channels: ['test.pressure'],
      title: 'Pressure',
      updateConfig,
      requestOverlay,
    };
    const { rerender } = render(
      <TelemetryContext.Provider value={telemetry(['nominal'])}>
        <BaseComponent {...config} />
      </TelemetryContext.Provider>,
    );
    const bar = screen.getByText('42 kPa').closest('.progress-bar');
    rerender(
      <TelemetryContext.Provider value={telemetry(['stale'])}>
        <BaseComponent {...config} />
      </TelemetryContext.Provider>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Pressure (stale)');
    expect(screen.getByText('42 kPa · stale').closest('.progress-bar')).toBe(
      bar,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows disconnected status without covering the widget', () => {
    const { container } = renderBase(telemetry(['nominal', 'disconnected']));
    expect(screen.getByRole('heading')).toHaveTextContent('(disconnected)');
    expect(container.querySelector('section')).toHaveClass(
      'widget--disconnected',
    );
    expect(container.querySelector('.widget__content')).toHaveAttribute(
      'aria-hidden',
      'false',
    );
  });

  it.each([
    [[], 'no-data', 'No data!'],
    [['missing'], 'missing', 'Missing data!'],
    [['invalid'], 'invalid', 'Invalid channel data!'],
  ] as [MockScenario[], string, string][])(
    'covers the widget for %s with %s status',
    (scenarios, status, message) => {
      const { container } = renderBase(telemetry(scenarios));
      expect(container.querySelector('section')).toHaveClass(
        `widget--${status}`,
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        `Test pressure - ${message}`,
      );
      expect(container.querySelector('.progress-bar')).toBeInTheDocument();
      expect(container.querySelector('.widget__content')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    },
  );

  it('preserves channel order and reports a missing channel by ID', () => {
    const { container } = renderBase(telemetry(['nominal']), {
      channels: ['test.pressure', 'unknown', 'test.temperature'],
    });
    expect(screen.getByRole('heading')).toHaveTextContent(
      'Test pressure | unknown | Test temperature',
    );
    expect(container.querySelector('section')).toHaveClass(
      'widget--missing-channel',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'unknown - Channel not found!',
    );
    expect(container.querySelector('.progress-bar')).toBeInTheDocument();
  });

  it('uses the most severe channel status and includes every error', () => {
    const { container } = renderBase(telemetry(['invalid']), {
      channels: ['test.pressure', 'unknown'],
    });
    expect(container.querySelector('section')).toHaveClass(
      'widget--missing-channel',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Test pressure - Invalid channel data!',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'unknown - Channel not found!',
    );
  });

  it('renders a fallback for an unregistered widget type', () => {
    const { container } = renderBase(telemetry(['nominal']), {
      componentType: 'undefined',
    });
    expect(screen.getByText('No Content')).toBeInTheDocument();
    expect(container.querySelector('section')).toHaveClass(
      'widget--undefined',
      'widget--active',
    );
  });

  it('treats an empty channel list as an active, uncovered widget', () => {
    const { container } = renderBase(telemetry(), {
      componentType: 'undefined',
      channels: [],
      title: 'Static information',
    });
    expect(screen.getByRole('heading')).toHaveTextContent('Static information');
    expect(container.querySelector('section')).toHaveClass('widget--active');
    expect(screen.getByText('No Content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(container.querySelector('.widget__content')).toHaveAttribute(
      'aria-hidden',
      'false',
    );
  });
});
