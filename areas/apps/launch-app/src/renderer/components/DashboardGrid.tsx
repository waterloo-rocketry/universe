import { useRef, useState, type PointerEvent } from 'react';
import {
  closestValidSize,
  growthLimits,
  moveItem,
  resizeItem,
  type dashboardLayout,
  type gridItem,
  type widgetConfig,
} from '../Layout';
import BaseComponent from './BaseComponent';

interface dashboardGridProps {
  layout: dashboardLayout;
  /** Called with the new layout when the user finishes moving or resizing. */
  onLayoutChange?: (layout: dashboardLayout) => void;
}

/** Which edge is being dragged: right edge, bottom edge, or the corner. */
type ResizeAxis = 'x' | 'y' | 'xy';

const HANDLES: { axis: ResizeAxis; label: string }[] = [
  { axis: 'x', label: 'Drag to resize width' },
  { axis: 'y', label: 'Drag to resize height' },
  { axis: 'xy', label: 'Drag to resize' },
];

/** The pointer must travel this far before a press on a widget becomes a move. */
const MOVE_THRESHOLD_PX = 4;

/** Pressing these never starts a move, so they keep working as normal. */
const NO_DRAG_SELECTOR =
  'button, input, select, textarea, a, label, .dashboard-cell__resize';

/** Measured when a drag starts, plus how far the pointer has moved since. */
interface DragBase {
  id: string;
  startX: number;
  startY: number;
  /** Gap between cells, and the step from one column/row to the next. */
  colGap: number;
  rowGap: number;
  colStep: number;
  rowStep: number;
  dx: number;
  dy: number;
}

interface ResizeDrag extends DragBase {
  kind: 'resize';
  axis: ResizeAxis;
  startW: number;
  startH: number;
  /** The widget's pixel size when the drag started. */
  startWidthPx: number;
  startHeightPx: number;
}

interface MoveDrag extends DragBase {
  kind: 'move';
  startCol: number;
  startRow: number;
  /** False until the pointer passes the threshold, so a plain click stays a click. */
  active: boolean;
}

type Drag = ResizeDrag | MoveDrag;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Draws one widget. Widgets read their data from the surrounding
 * TelemetryProvider, so the grid only decides where they go.
 */
function renderWidget(id: string, config: widgetConfig) {
  switch (config.kind) {
    case 'progress-bar': {
      const { signalId, min, max } = config;
      return (
        <BaseComponent
          id={id}
          componentType="progress-bar"
          channels={[signalId]}
          config={{ min, max }}
          updateConfig={() => {}}
          setOverlay={() => {}}
        />
      );
    }
  }
}

/** CSS grid placement for an item: "start / span size", 1-based lines. */
const placement = (item: Pick<gridItem, 'x' | 'y' | 'w' | 'h'>) => ({
  gridColumn: `${item.x + 1} / span ${item.w}`,
  gridRow: `${item.y + 1} / span ${item.h}`,
});

/** True when the press landed on an element's scrollbar rather than its content. */
function onScrollbar(event: PointerEvent<HTMLElement>) {
  const target = event.target as HTMLElement;
  const { offsetX, offsetY } = event.nativeEvent;
  return (
    (target.clientWidth > 0 && offsetX > target.clientWidth) ||
    (target.clientHeight > 0 && offsetY > target.clientHeight)
  );
}

export function DashboardGrid({
  layout: initialLayout,
  onLayoutChange,
}: dashboardGridProps) {
  const [layout, setLayout] = useState(initialLayout);
  // State, not a ref: the dragged widget and the preview redraw on every move.
  const [drag, setDrag] = useState<Drag | null>(null);

  // When the parent passes a different layout (a loaded file, or an edit to
  // DEFAULT_LAYOUT during development), start over from it. Changes made since
  // are dropped. React's recommended way to reset state when a prop changes:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [seenLayout, setSeenLayout] = useState(initialLayout);
  if (initialLayout !== seenLayout) {
    setSeenLayout(initialLayout);
    setLayout(initialLayout);
    setDrag(null);
  }
  const gridRef = useRef<HTMLDivElement>(null);
  const { numberOfCols, numberOfRows, items } = layout;

  /** Cell and gap sizes in pixels. Cells are 1fr, so measure them right now. */
  const measure = () => {
    const grid = gridRef.current!;
    const rect = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);
    const colGap = parseFloat(style.columnGap) || 0;
    const rowGap = parseFloat(style.rowGap) || 0;
    return {
      colGap,
      rowGap,
      colStep: (rect.width + colGap) / numberOfCols,
      rowStep: (rect.height + rowGap) / numberOfRows,
    };
  };

  /** The snapped size a resized widget takes if the pointer is released now. */
  const resizeTarget = (current: ResizeDrag) => {
    // Math.round: past half a cell, the size moves to the next cell.
    const w =
      current.axis === 'y'
        ? current.startW
        : current.startW + Math.round(current.dx / current.colStep);
    const h =
      current.axis === 'x'
        ? current.startH
        : current.startH + Math.round(current.dy / current.rowStep);
    return closestValidSize(layout, current.id, w, h);
  };

  /**
   * Where a moved widget lands if the pointer is released now: the snapped
   * cell (kept inside the grid) and the resulting layout, or null if it can't.
   */
  const movePlan = (current: MoveDrag) => {
    const item = items.find((candidate) => candidate.id === current.id);
    if (!item) return null;
    const x = clamp(
      current.startCol + Math.round(current.dx / current.colStep),
      0,
      numberOfCols - item.w,
    );
    const y = clamp(
      current.startRow + Math.round(current.dy / current.rowStep),
      0,
      numberOfRows - item.h,
    );
    return { item: { ...item, x, y }, next: moveItem(layout, item.id, x, y) };
  };

  const startResize = (
    event: PointerEvent<HTMLDivElement>,
    item: gridItem,
    axis: ResizeAxis,
  ) => {
    const cell = event.currentTarget.parentElement;
    if (!gridRef.current || !cell) return;
    event.preventDefault(); // don't select text while dragging
    event.currentTarget.setPointerCapture(event.pointerId);
    const cellRect = cell.getBoundingClientRect();
    setDrag({
      kind: 'resize',
      id: item.id,
      axis,
      startX: event.clientX,
      startY: event.clientY,
      startW: item.w,
      startH: item.h,
      startWidthPx: cellRect.width,
      startHeightPx: cellRect.height,
      ...measure(),
      dx: 0,
      dy: 0,
    });
  };

  const startMove = (event: PointerEvent<HTMLDivElement>, item: gridItem) => {
    if (drag || event.button !== 0 || !gridRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest(NO_DRAG_SELECTOR) || onScrollbar(event)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      kind: 'move',
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      startCol: item.x,
      startRow: item.y,
      ...measure(),
      dx: 0,
      dy: 0,
      active: false,
    });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.colStep <= 0 || drag.rowStep <= 0) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.kind === 'resize') {
      setDrag({
        ...drag,
        dx: drag.axis === 'y' ? 0 : dx,
        dy: drag.axis === 'x' ? 0 : dy,
      });
    } else {
      const active = drag.active || Math.hypot(dx, dy) >= MOVE_THRESHOLD_PX;
      if (active) window.getSelection()?.removeAllRanges();
      setDrag({ ...drag, dx, dy, active });
    }
  };

  const commit = (next: dashboardLayout | null) => {
    if (!next || next === layout) return;
    setLayout(next);
    onLayoutChange?.(next);
  };

  const onPointerUp = () => {
    if (!drag) return;
    setDrag(null);
    if (drag.kind === 'resize') {
      const size = resizeTarget(drag);
      if (size) commit(resizeItem(layout, drag.id, size.w, size.h));
    } else if (drag.active) {
      // null (the move can't be done) leaves the layout alone: it goes back.
      commit(movePlan(drag)?.next ?? null);
    }
  };

  const dragged = drag ? items.find((item) => item.id === drag.id) : undefined;
  const resizeSize = drag?.kind === 'resize' ? resizeTarget(drag) : null;
  const plan = drag?.kind === 'move' && drag.active ? movePlan(drag) : null;

  /**
   * Pixel size of a widget being resized. Its edge follows the pointer, but
   * never below one cell and never into a neighbour or past the grid: it stops
   * at the furthest size that fits next to the previewed size.
   */
  const liveSize = () => {
    if (drag?.kind !== 'resize' || !resizeSize) return {};
    const limits = growthLimits(layout, drag.id, resizeSize.w, resizeSize.h);
    if (!limits) return {};
    const px = (cells: number, step: number, gap: number) => cells * step - gap;
    return {
      width: clamp(
        drag.startWidthPx + drag.dx,
        px(1, drag.colStep, drag.colGap),
        px(limits.maxW, drag.colStep, drag.colGap),
      ),
      height: clamp(
        drag.startHeightPx + drag.dy,
        px(1, drag.rowStep, drag.rowGap),
        px(limits.maxH, drag.rowStep, drag.rowGap),
      ),
    };
  };

  /** Inline style for one widget: its cells, plus any drag in progress. */
  const cellStyle = (item: gridItem) => {
    if (drag?.id !== item.id) return placement(item);
    if (drag.kind === 'resize') return { ...placement(item), ...liveSize() };
    if (!drag.active) return placement(item);
    // A moved widget follows the pointer; transform doesn't disturb the grid.
    return {
      ...placement(item),
      transform: `translate(${drag.dx}px, ${drag.dy}px)`,
    };
  };

  const cellClass = (item: gridItem) => {
    let className = 'dashboard-cell';
    if (drag?.id === item.id && drag.kind === 'resize') {
      className += ' dashboard-cell--resizing';
    }
    if (drag?.id === item.id && drag.kind === 'move' && drag.active) {
      className += ' dashboard-cell--moving';
    }
    return className;
  };

  /** Widgets that a planned move would push somewhere else. */
  const pushed = plan?.next
    ? plan.next.items.filter((next) => {
        const before = items.find((item) => item.id === next.id);
        return (
          next.id !== plan.item.id &&
          before !== undefined &&
          (before.x !== next.x || before.y !== next.y)
        );
      })
    : [];

  return (
    <div
      ref={gridRef}
      className={`dashboard-grid${plan ? ' dashboard-grid--dragging' : ''}`}
      style={{
        // minmax(0, 1fr), not plain 1fr: every column and row keeps exactly the
        // same size no matter what is inside (plain 1fr grows to fit content).
        gridTemplateColumns: `repeat(${numberOfCols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${numberOfRows}, minmax(0, 1fr))`,
      }}
    >
      {/* One faint outline per grid cell, drawn first so widgets cover it. */}
      {Array.from({ length: numberOfCols * numberOfRows }, (_, i) => (
        <div
          key={`slot-${i}`}
          className="dashboard-slot"
          aria-hidden="true"
          style={placement({
            x: i % numberOfCols,
            y: Math.floor(i / numberOfCols),
            w: 1,
            h: 1,
          })}
        />
      ))}
      {items.map((item) => (
        <div
          key={item.id}
          className={cellClass(item)}
          data-testid={`widget-${item.id}`}
          style={cellStyle(item)}
          onPointerDown={(event) => startMove(event, item)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          <div className="dashboard-cell__content">
            {renderWidget(item.id, item.widgetConfig)}
          </div>
          {HANDLES.map(({ axis, label }) => (
            <div
              key={axis}
              className={`dashboard-cell__resize dashboard-cell__resize--${axis}`}
              data-testid={`resize-${axis}-${item.id}`}
              title={label}
              onPointerDown={(event) => startResize(event, item, axis)}
            />
          ))}
        </div>
      ))}
      {dragged && resizeSize && (
        <div
          className="dashboard-preview"
          data-testid="resize-preview"
          aria-hidden="true"
          style={placement({ ...dragged, ...resizeSize })}
        />
      )}
      {plan && (
        <div
          className={`dashboard-preview${plan.next ? '' : ' dashboard-preview--invalid'}`}
          data-testid="move-preview"
          aria-hidden="true"
          style={placement(plan.item)}
        />
      )}
      {pushed.map((item) => (
        <div
          key={item.id}
          className="dashboard-preview dashboard-preview--pushed"
          data-testid={`push-preview-${item.id}`}
          aria-hidden="true"
          style={placement(item)}
        />
      ))}
    </div>
  );
}
