/*
create GridItem to store the type of widget at the specified index
Create a list to save them so they can be saved/exported
*/

// when there is more widget they should be added into widgetconfig type
export type widgetConfig = {
  kind: 'progress-bar';
  signalId: string;
  min: number;
  max: number;
};

export interface gridItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  widgetConfig: widgetConfig;
}

export interface dashboardLayout {
  version: number;
  numberOfCols: number;
  numberOfRows: number;
  items: gridItem[];
}

export const DEFAULT_LAYOUT: dashboardLayout = {
  version: 1,
  numberOfCols: 40,
  numberOfRows: 20,
  items: [
    {
      id: 'temperature-progress-bar',
      x: 0,
      y: 0,
      w: 16,
      h: 10,
      widgetConfig: {
        kind: 'progress-bar',
        signalId: 'test.temperature',
        min: -20,
        max: 20,
      },
    },
  ],
};

/** A rectangle of grid cells: top-left corner (x, y) and size (w, h). */
type CellArea = Pick<gridItem, 'x' | 'y' | 'w' | 'h'>;

/** True when two areas share at least one cell. Touching edges do not count. */
export function overlaps(a: CellArea, b: CellArea): boolean {
  const separate =
    a.x + a.w <= b.x || // a is left of b
    b.x + b.w <= a.x || // a is right of b
    a.y + a.h <= b.y || // a is above b
    b.y + b.h <= a.y; // a is below b
  return !separate;
}

/** True when the area is at least 1×1 and lies entirely inside the grid. */
export function fitsInGrid(area: CellArea, layout: dashboardLayout): boolean {
  return (
    area.w >= 1 &&
    area.h >= 1 &&
    area.x >= 0 &&
    area.y >= 0 &&
    area.x + area.w <= layout.numberOfCols &&
    area.y + area.h <= layout.numberOfRows
  );
}

/**
 * The allowed size closest to the requested w × h for one widget, searching
 * only between its current size and the request. A widget dragged into a
 * neighbour or past the edge stops at the last size that fits, and each
 * direction is checked on its own, so it can still grow sideways when growing
 * down is blocked. Returns null for an unknown id.
 */
export function closestValidSize(
  layout: dashboardLayout,
  id: string,
  w: number,
  h: number,
): { w: number; h: number } | null {
  const target = layout.items.find((item) => item.id === id);
  if (!target) return null;
  const allowed = (cw: number, ch: number) => sizeFits(layout, target, cw, ch);

  let best = { w: target.w, h: target.h };
  let bestDistance = Math.abs(w - target.w) + Math.abs(h - target.h);
  for (let cw = Math.min(w, target.w); cw <= Math.max(w, target.w); cw++) {
    for (let ch = Math.min(h, target.h); ch <= Math.max(h, target.h); ch++) {
      const distance = Math.abs(w - cw) + Math.abs(h - ch);
      if (distance < bestDistance && allowed(cw, ch)) {
        best = { w: cw, h: ch };
        bestDistance = distance;
      }
    }
  }
  return best;
}

/** True when the widget, resized to w × h, stays in the grid and overlaps nothing. */
function sizeFits(
  layout: dashboardLayout,
  target: gridItem,
  w: number,
  h: number,
): boolean {
  const area = { ...target, w, h };
  return (
    fitsInGrid(area, layout) &&
    !layout.items.some(
      (other) => other.id !== target.id && overlaps(area, other),
    )
  );
}

/**
 * How far a widget of size w × h (which must fit) can grow in each direction
 * alone: the widest it can be at height h, and the tallest at width w.
 * Returns null for an unknown id.
 */
export function growthLimits(
  layout: dashboardLayout,
  id: string,
  w: number,
  h: number,
): { maxW: number; maxH: number } | null {
  const target = layout.items.find((item) => item.id === id);
  if (!target) return null;
  let maxW = w;
  while (sizeFits(layout, target, maxW + 1, h)) maxW++;
  let maxH = h;
  while (sizeFits(layout, target, w, maxH + 1)) maxH++;
  return { maxW, maxH };
}

/**
 * Returns a new layout with one widget resized to w × h cells.
 * Returns the same layout object when the id is unknown, the size is
 * unchanged, or the new size would leave the grid or overlap another widget.
 */
export function resizeItem(
  layout: dashboardLayout,
  id: string,
  w: number,
  h: number,
): dashboardLayout {
  const target = layout.items.find((item) => item.id === id);
  if (!target) return layout;
  if (target.w === w && target.h === h) return layout;

  const resized = { ...target, w, h };
  if (!fitsInGrid(resized, layout)) return layout;

  const collides = layout.items.some(
    (other) => other.id !== id && overlaps(resized, other),
  );
  if (collides) return layout;

  return {
    ...layout,
    items: layout.items.map((item) => (item.id === id ? resized : item)),
  };
}

/**
 * Moves one widget so its top-left corner is at (x, y).
 *
 * Widgets it would land on are pushed just out of its way, trying right, then
 * down, then up, then left; each pushed widget must fit in the grid and not
 * overlap anything else. Returns:
 * - the same layout when the widget is already there,
 * - a new layout when the move works,
 * - null when it can't be done (unknown id, outside the grid, or a widget in
 *   the way has nowhere to go), so the caller can put the widget back.
 */
export function moveItem(
  layout: dashboardLayout,
  id: string,
  x: number,
  y: number,
): dashboardLayout | null {
  const target = layout.items.find((item) => item.id === id);
  if (!target) return null;
  if (target.x === x && target.y === y) return layout;

  const moved = { ...target, x, y };
  if (!fitsInGrid(moved, layout)) return null;

  let placed = layout.items.map((item) => (item.id === id ? moved : item));
  for (const other of layout.items) {
    if (other.id === id || !overlaps(moved, other)) continue;
    const candidates = [
      { ...other, x: moved.x + moved.w }, // right of the moved widget
      { ...other, y: moved.y + moved.h }, // below it
      { ...other, y: moved.y - other.h }, // above it
      { ...other, x: moved.x - other.w }, // left of it
    ];
    const spot = candidates.find(
      (candidate) =>
        fitsInGrid(candidate, layout) &&
        !placed.some(
          (item) => item.id !== other.id && overlaps(candidate, item),
        ),
    );
    if (!spot) return null;
    placed = placed.map((item) => (item.id === other.id ? spot : item));
  }
  return { ...layout, items: placed };
}
