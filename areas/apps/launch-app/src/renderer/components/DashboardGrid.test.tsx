import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardGrid } from './DashboardGrid';
import { createTelemetryState } from '../data/channel-store';
import { MOCK_SIGNALS } from '../data/mock/fixtures';
import { TelemetryContext } from '../data/telemetry-context';
import type { Telemetry } from '../data/useTelemetry';
import type { dashboardLayout } from '../Layout';

const telemetry: Telemetry = {
  stream: 'connected',
  state: createTelemetryState(MOCK_SIGNALS),
  nowMs: 0,
};

/** 4×4 grid: a progress bar at the top-left, another at column 2. */
const LAYOUT: dashboardLayout = {
  version: 1,
  numberOfCols: 4,
  numberOfRows: 4,
  items: [
    {
      id: 'bar',
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      widgetConfig: {
        kind: 'progress-bar',
        signalId: ['test.pressure'],
        config: {
          min: 0,
          max: 100,
        },
      },
    },
    {
      id: 'list',
      x: 2,
      y: 0,
      w: 1,
      h: 1,
      widgetConfig: {
        kind: 'progress-bar',
        signalId: ['test.temperature'],
        config: {
          min: -20,
          max: 20,
        },
      },
    },
  ],
};

function renderGrid(
  layout = LAYOUT,
  onLayoutChange?: (layout: dashboardLayout) => void,
) {
  render(
    <TelemetryContext.Provider value={telemetry}>
      <DashboardGrid layout={layout} onLayoutChange={onLayoutChange} />
    </TelemetryContext.Provider>,
  );
}

const handle = (axis: 'x' | 'y' | 'xy', id = 'bar') =>
  screen.getByTestId(`resize-${axis}-${id}`);
/** The cell (grid item) that holds a widget's resize handles. */
const cellOf = (id: string) => handle('xy', id).parentElement!;
const preview = () => screen.queryByTestId('resize-preview');

/** Presses on a handle at (0, 0) and moves the pointer to (x, y). */
function dragTo(target: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(target, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(target, { clientX: x, clientY: y });
}

describe('DashboardGrid', () => {
  beforeEach(() => {
    // jsdom has no layout engine: pretend the grid is 400×400px,
    // so each of the 4 columns and rows is 100px.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 400, 400),
    );
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('places each widget in its cells', () => {
    renderGrid();
    expect(cellOf('bar')).toHaveStyle({
      gridColumn: '1 / span 1',
      gridRow: '1 / span 1',
    });
    expect(cellOf('list')).toHaveStyle({
      gridColumn: '3 / span 1',
      gridRow: '1 / span 1',
    });
    expect(preview()).not.toBeInTheDocument();
  });

  it('shows a message for a channel that does not exist', () => {
    renderGrid({
      ...LAYOUT,
      items: [
        {
          ...LAYOUT.items[0],
          widgetConfig: {
            kind: 'progress-bar',
            signalId: ['nope'],
            config: {
              min: 0,
              max: 1,
            },
          },
        },
      ],
    });
    expect(screen.getByText('nope - Channel not found!')).toBeInTheDocument();
  });

  it('shows a preview while dragging and applies it on release', () => {
    const onLayoutChange = vi.fn();
    renderGrid(LAYOUT, onLayoutChange);

    dragTo(handle('xy'), 140, 160);
    // The preview shows the snapped size; the layout itself waits for release.
    expect(preview()).toHaveStyle({
      gridColumn: '1 / span 2',
      gridRow: '1 / span 3',
    });
    expect(cellOf('bar')).toHaveStyle({ gridColumn: '1 / span 1' });
    expect(cellOf('bar')).toHaveClass('dashboard-cell--resizing');

    fireEvent.pointerUp(handle('xy'));
    expect(preview()).not.toBeInTheDocument();
    expect(cellOf('bar')).toHaveStyle({
      gridColumn: '1 / span 2',
      gridRow: '1 / span 3',
    });
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    expect(onLayoutChange.mock.calls[0][0].items[0]).toMatchObject({
      w: 2,
      h: 3,
    });
  });

  it('moves to the next cell only past half a cell', () => {
    renderGrid();
    dragTo(handle('y'), 0, 40);
    expect(preview()).toHaveStyle({ gridRow: '1 / span 1' });
    fireEvent.pointerMove(handle('y'), { clientX: 0, clientY: 60 });
    expect(preview()).toHaveStyle({ gridRow: '1 / span 2' });
  });

  it('resizes width only from the right edge', () => {
    renderGrid();
    dragTo(handle('x'), 100, 300);
    expect(preview()).toHaveStyle({
      gridColumn: '1 / span 2',
      gridRow: '1 / span 1',
    });
  });

  it('resizes height only from the bottom edge', () => {
    renderGrid();
    dragTo(handle('y'), 300, 100);
    expect(preview()).toHaveStyle({
      gridColumn: '1 / span 1',
      gridRow: '1 / span 2',
    });
  });

  it('stops at a neighbouring widget instead of overlapping it', () => {
    renderGrid();
    // Four columns wide would cover the other widget at column 3.
    dragTo(handle('xy'), 300, 0);
    expect(preview()).toHaveStyle({ gridColumn: '1 / span 2' });
    // The widget's own edge also stops there: 2 columns × 100px.
    expect(cellOf('bar')).toHaveStyle({ width: '200px' });
  });

  it('never shrinks the dragged widget below one cell', () => {
    renderGrid();
    dragTo(handle('xy'), -500, -500);
    expect(preview()).toHaveStyle({ gridColumn: '1 / span 1' });
    expect(cellOf('bar')).toHaveStyle({ width: '100px', height: '100px' });
  });

  it('starts over when given a different layout, but not the same one again', () => {
    const grid = (layout: dashboardLayout) => (
      <TelemetryContext.Provider value={telemetry}>
        <DashboardGrid layout={layout} />
      </TelemetryContext.Provider>
    );
    const { rerender } = render(grid(LAYOUT));
    dragTo(handle('xy'), 100, 0);
    fireEvent.pointerUp(handle('xy'));
    expect(cellOf('bar')).toHaveStyle({ gridColumn: '1 / span 2' });

    // Same layout object (e.g. a normal redraw): the resize is kept.
    rerender(grid(LAYOUT));
    expect(cellOf('bar')).toHaveStyle({ gridColumn: '1 / span 2' });

    // A different layout: the grid uses it, and the resize is dropped.
    rerender(grid({ ...LAYOUT, numberOfCols: 6 }));
    expect(cellOf('bar').parentElement).toHaveStyle({
      gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    });
    expect(cellOf('bar')).toHaveStyle({ gridColumn: '1 / span 1' });
  });

  it('keeps every column and row the same size whatever is inside', () => {
    renderGrid();
    const grid = cellOf('bar').parentElement!;
    expect(grid).toHaveStyle({
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gridTemplateRows: 'repeat(4, minmax(0, 1fr))',
    });
  });

  it('discards the resize when the pointer is cancelled', () => {
    const onLayoutChange = vi.fn();
    renderGrid(LAYOUT, onLayoutChange);
    dragTo(handle('xy'), 200, 200);
    fireEvent.pointerCancel(handle('xy'));
    expect(preview()).not.toBeInTheDocument();
    expect(cellOf('bar')).toHaveStyle({ gridColumn: '1 / span 1' });
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it('does not report a change when released at the same size', () => {
    const onLayoutChange = vi.fn();
    renderGrid(LAYOUT, onLayoutChange);
    dragTo(handle('xy'), 20, 20);
    fireEvent.pointerUp(handle('xy'));
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it('ignores pointer moves when no drag is in progress', () => {
    const onLayoutChange = vi.fn();
    renderGrid(LAYOUT, onLayoutChange);
    fireEvent.pointerMove(handle('xy'), { clientX: 300, clientY: 300 });
    fireEvent.pointerUp(handle('xy'));
    expect(preview()).not.toBeInTheDocument();
    expect(cellOf('bar')).toHaveStyle({ gridColumn: '1 / span 1' });
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  describe('moving', () => {
    const widget = (id: string) => screen.getByTestId(`widget-${id}`);
    const movePreview = () => screen.queryByTestId('move-preview');

    /** Presses on a widget at (0, 0) and moves the pointer to (x, y). */
    function moveTo(id: string, x: number, y: number) {
      fireEvent.pointerDown(widget(id), {
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        button: 0,
      });
      fireEvent.pointerMove(widget(id), { clientX: x, clientY: y });
    }

    it('treats a press that barely moves as a click, not a move', () => {
      const onLayoutChange = vi.fn();
      renderGrid(LAYOUT, onLayoutChange);
      moveTo('bar', 2, 1);
      expect(movePreview()).not.toBeInTheDocument();
      expect(widget('bar')).not.toHaveClass('dashboard-cell--moving');
      fireEvent.pointerUp(widget('bar'));
      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('follows the pointer, snaps to cells, and moves on release', () => {
      const onLayoutChange = vi.fn();
      renderGrid(LAYOUT, onLayoutChange);
      moveTo('bar', 70, 130); // 0.7 columns → 1, 1.3 rows → 1
      expect(widget('bar')).toHaveClass('dashboard-cell--moving');
      expect(widget('bar')).toHaveStyle({
        transform: 'translate(70px, 130px)',
      });
      expect(movePreview()).toHaveStyle({
        gridColumn: '2 / span 1',
        gridRow: '2 / span 1',
      });

      fireEvent.pointerUp(widget('bar'));
      expect(movePreview()).not.toBeInTheDocument();
      expect(widget('bar')).toHaveStyle({
        gridColumn: '2 / span 1',
        gridRow: '2 / span 1',
      });
      expect(onLayoutChange).toHaveBeenCalledTimes(1);
      expect(onLayoutChange.mock.calls[0][0].items[0]).toMatchObject({
        x: 1,
        y: 1,
      });
    });

    it('keeps the drop spot inside the grid', () => {
      renderGrid();
      moveTo('bar', -300, 900);
      expect(movePreview()).toHaveStyle({
        gridColumn: '1 / span 1',
        gridRow: '4 / span 1',
      });
    });

    it('pushes a widget in the way to the right and shows where it goes', () => {
      renderGrid();
      moveTo('bar', 200, 0); // onto the other widget at column 3
      expect(screen.getByTestId('push-preview-list')).toHaveStyle({
        gridColumn: '4 / span 1',
      });
      fireEvent.pointerUp(widget('bar'));
      expect(widget('bar')).toHaveStyle({ gridColumn: '3 / span 1' });
      expect(widget('list')).toHaveStyle({ gridColumn: '4 / span 1' });
    });

    it('puts the widget back when the widget in the way has nowhere to go', () => {
      const missing = LAYOUT.items[0].widgetConfig;
      const full: dashboardLayout = {
        version: 1,
        numberOfCols: 2,
        numberOfRows: 2,
        items: (
          [
            ['a', 0, 0],
            ['b', 1, 0],
            ['c', 0, 1],
            ['d', 1, 1],
          ] as const
        ).map(([id, x, y]) => ({
          id,
          x,
          y,
          w: 1,
          h: 1,
          widgetConfig: missing,
        })),
      };
      const onLayoutChange = vi.fn();
      renderGrid(full, onLayoutChange);
      // 2 columns in 400px: each cell is 200px. Drop 'a' onto 'd'.
      moveTo('a', 200, 200);
      expect(movePreview()).toHaveClass('dashboard-preview--invalid');

      fireEvent.pointerUp(widget('a'));
      expect(widget('a')).toHaveStyle({
        gridColumn: '1 / span 1',
        gridRow: '1 / span 1',
      });
      expect(widget('a')).not.toHaveStyle({
        transform: 'translate(200px, 200px)',
      });
      expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('cancels the move when the pointer is cancelled', () => {
      renderGrid();
      moveTo('bar', 100, 100);
      fireEvent.pointerCancel(widget('bar'));
      expect(movePreview()).not.toBeInTheDocument();
      expect(widget('bar')).toHaveStyle({ gridColumn: '1 / span 1' });
    });

    it('does not start a move from a resize handle', () => {
      renderGrid();
      dragTo(handle('xy'), 100, 0);
      expect(movePreview()).not.toBeInTheDocument();
      expect(preview()).toBeInTheDocument();
    });

    it('ignores presses with other mouse buttons', () => {
      renderGrid();
      fireEvent.pointerDown(widget('bar'), { button: 2, pointerId: 1 });
      fireEvent.pointerMove(widget('bar'), { clientX: 100, clientY: 0 });
      expect(movePreview()).not.toBeInTheDocument();
    });
  });
});
