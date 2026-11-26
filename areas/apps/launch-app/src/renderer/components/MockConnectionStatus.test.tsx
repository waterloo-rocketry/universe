import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MockConnectionStatus } from './MockConnectionStatus';
import { TestEventSource } from '../test/event-source';
import { getMockFixture } from '../data/mock/fixtures';

describe('mock server connection', () => {
  it('connects only after receiving a valid frame and recovers after a drop', () => {
    render(<MockConnectionStatus />);
    const stream = TestEventSource.instances[0];
    expect(stream.url).toBe('/mock-api/events');
    expect(screen.getByRole('status')).toHaveTextContent('connecting to mock');
    act(() => stream.frame(getMockFixture()));
    expect(screen.getByRole('status')).toHaveTextContent('connected to mock');
    act(() => stream.onerror?.());
    expect(screen.getByRole('status')).toHaveTextContent(
      'disconnected from mock',
    );
    act(() => stream.frame(getMockFixture()));
    expect(screen.getByRole('status')).toHaveTextContent('connected to mock');
  });

  it.each([
    {},
    { ...getMockFixture(), schemaVersion: 99 },
    { ...getMockFixture(), sourceId: 'another-service' },
    {
      ...getMockFixture(),
      readings: [
        { signalId: 'bad', timestampMs: 0, quality: 'good', value: null },
      ],
    },
  ])('rejects malformed or unrelated frames %j', (frame) => {
    render(<MockConnectionStatus />);
    act(() => TestEventSource.instances[0].frame(frame));
    expect(screen.getByRole('status')).toHaveTextContent('invalid mock data');
  });

  it('handles invalid JSON without claiming a connection', () => {
    render(<MockConnectionStatus />);
    act(() =>
      TestEventSource.instances[0].dispatchEvent(
        new MessageEvent('frame', { data: '{' }),
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent('invalid mock data');
  });

  it('closes the stream on unmount', () => {
    const { unmount } = render(<MockConnectionStatus />);
    const stream = TestEventSource.instances[0];
    unmount();
    expect(stream.close).toHaveBeenCalledOnce();
  });

  it('distinguishes a working server connection from simulated sensor disconnection', () => {
    render(<MockConnectionStatus />);
    act(() =>
      TestEventSource.instances[0].frame(getMockFixture('disconnected')),
    );
    expect(screen.getByRole('status')).toHaveTextContent('connected to mock');
  });
});
