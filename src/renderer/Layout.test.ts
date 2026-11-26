import { describe, expect, it } from 'vitest';
import {
  closestValidSize,
  fitsInGrid,
  growthLimits,
  moveItem,
  overlaps,
  resizeItem,
  type dashboardLayout,
} from './Layout';

/** Any widget will do: these tests are about positions, not content. */
const WIDGET = {
  kind: 'progress-bar' as const,
  signalId: 'test.pressure',
  min: 0,
  max: 100,
};

const area = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

/** 4×4 grid: a 1×1 widget at the top-left and a 1×1 widget at (2, 0). */
function makeLayout(): dashboardLayout {
  return {
    version: 1,
    numberOfCols: 4,
    numberOfRows: 4,
    items: [
      {
        id: 'a',
        ...area(0, 0, 1, 1),
        widgetConfig: WIDGET,
      },
      {
        id: 'b',
        ...area(2, 0, 1, 1),
        widgetConfig: WIDGET,
      },
    ],
  };
}

describe('overlaps', () => {
  it('detects areas that share cells', () => {
    expect(overlaps(area(0, 0, 2, 2), area(1, 1, 2, 2))).toBe(true);
    expect(overlaps(area(0, 0, 3, 3), area(1, 1, 1, 1))).toBe(true);
  });

  it('treats touching edges as not overlapping', () => {
    expect(overlaps(area(0, 0, 1, 1), area(1, 0, 1, 1))).toBe(false); // side by side
    expect(overlaps(area(0, 0, 1, 1), area(0, 1, 1, 1))).toBe(false); // stacked
  });

  it('works in both directions', () => {
    expect(overlaps(area(2, 2, 1, 1), area(0, 0, 1, 1))).toBe(false);
    expect(overlaps(area(1, 1, 2, 2), area(0, 0, 2, 2))).toBe(true);
  });
});

describe('fitsInGrid', () => {
  const layout = makeLayout();

  it('accepts areas inside the grid, including the far edges', () => {
    expect(fitsInGrid(area(0, 0, 4, 4), layout)).toBe(true);
    expect(fitsInGrid(area(3, 3, 1, 1), layout)).toBe(true);
  });

  it('rejects areas past an edge or smaller than one cell', () => {
    expect(fitsInGrid(area(3, 0, 2, 1), layout)).toBe(false);
    expect(fitsInGrid(area(0, 3, 1, 2), layout)).toBe(false);
    expect(fitsInGrid(area(-1, 0, 1, 1), layout)).toBe(false);
    expect(fitsInGrid(area(0, 0, 0, 1), layout)).toBe(false);
    expect(fitsInGrid(area(0, 0, 1, 0), layout)).toBe(false);
  });
});

describe('resizeItem', () => {
  it('returns a new layout with only that widget resized', () => {
    const layout = makeLayout();
    const next = resizeItem(layout, 'a', 2, 3);
    expect(next).not.toBe(layout);
    expect(next.items[0]).toMatchObject({ id: 'a', w: 2, h: 3 });
    expect(next.items[0].widgetConfig).toBe(layout.items[0].widgetConfig);
    expect(next.items[1]).toBe(layout.items[1]);
    // The original is untouched.
    expect(layout.items[0]).toMatchObject({ w: 1, h: 1 });
  });

  it.each([
    ['an unknown id', 'zzz', 2, 2],
    ['an unchanged size', 'a', 1, 1],
    ['a size below one cell', 'a', 0, 1],
    ['growing past the right edge', 'b', 3, 1],
    ['growing past the bottom edge', 'a', 1, 5],
    ['growing into another widget', 'a', 3, 1],
  ])('returns the same layout for %s', (_label, id, w, h) => {
    const layout = makeLayout();
    expect(resizeItem(layout, id, w, h)).toBe(layout);
  });
});

describe('closestValidSize', () => {
  it('returns the requested size when it fits', () => {
    expect(closestValidSize(makeLayout(), 'a', 2, 3)).toEqual({ w: 2, h: 3 });
  });

  it('stops just before a neighbouring widget', () => {
    // 'b' starts at column 2, so 'a' can be at most 2 wide.
    expect(closestValidSize(makeLayout(), 'a', 4, 1)).toEqual({ w: 2, h: 1 });
  });

  it('stops at the grid edges', () => {
    expect(closestValidSize(makeLayout(), 'a', 1, 9)).toEqual({ w: 1, h: 4 });
    expect(closestValidSize(makeLayout(), 'a', 0, 0)).toEqual({ w: 1, h: 1 });
  });

  it('still grows in the direction that is free', () => {
    // Too wide (would hit 'b'), but the extra height is fine.
    expect(closestValidSize(makeLayout(), 'a', 4, 3)).toEqual({ w: 2, h: 3 });
  });

  it('returns null for an unknown id', () => {
    expect(closestValidSize(makeLayout(), 'zzz', 1, 1)).toBeNull();
  });
});

describe('growthLimits', () => {
  it('finds how far a widget can grow in each direction alone', () => {
    // 'a' at (0,0): 'b' at column 2 blocks width; nothing blocks height.
    expect(growthLimits(makeLayout(), 'a', 1, 1)).toEqual({ maxW: 2, maxH: 4 });
  });

  it('limits width by the rows the widget covers', () => {
    // 'b' stops at the right edge; taller doesn't change that.
    expect(growthLimits(makeLayout(), 'b', 1, 3)).toEqual({ maxW: 2, maxH: 4 });
  });

  it('returns null for an unknown id', () => {
    expect(growthLimits(makeLayout(), 'zzz', 1, 1)).toBeNull();
  });
});

describe('moveItem', () => {
  /** A grid of 1×1 widgets, named by their ids, at the given cells. */
  function grid(cols: number, rows: number, cells: [string, number, number][]) {
    return {
      version: 1,
      numberOfCols: cols,
      numberOfRows: rows,
      items: cells.map(([id, x, y]) => ({
        id,
        ...area(x, y, 1, 1),
        widgetConfig: WIDGET,
      })),
    };
  }
  const where = (layout: dashboardLayout | null, id: string) => {
    const item = layout?.items.find((candidate) => candidate.id === id);
    return item && [item.x, item.y];
  };

  it('moves a widget into empty cells', () => {
    const layout = makeLayout();
    const next = moveItem(layout, 'a', 1, 1);
    expect(where(next, 'a')).toEqual([1, 1]);
    expect(next?.items[1]).toBe(layout.items[1]);
    expect(where(layout, 'a')).toEqual([0, 0]); // original untouched
  });

  it('returns the same layout when the widget does not move', () => {
    const layout = makeLayout();
    expect(moveItem(layout, 'a', 0, 0)).toBe(layout);
  });

  it('returns null outside the grid or for an unknown id', () => {
    expect(moveItem(makeLayout(), 'a', 4, 0)).toBeNull();
    expect(moveItem(makeLayout(), 'a', 0, -1)).toBeNull();
    expect(moveItem(makeLayout(), 'zzz', 1, 1)).toBeNull();
  });

  it('pushes a widget in the way to the right first', () => {
    const next = moveItem(makeLayout(), 'a', 2, 0);
    expect(where(next, 'a')).toEqual([2, 0]);
    expect(where(next, 'b')).toEqual([3, 0]);
  });

  it('pushes down when the right is blocked', () => {
    const layout = grid(4, 4, [
      ['a', 0, 0],
      ['b', 3, 0],
    ]);
    expect(where(moveItem(layout, 'a', 3, 0), 'b')).toEqual([3, 1]);
  });

  it('pushes up, then left, when right and down are blocked', () => {
    const up = grid(2, 2, [
      ['a', 0, 0],
      ['b', 1, 1],
    ]);
    expect(where(moveItem(up, 'a', 1, 1), 'b')).toEqual([1, 0]);

    const left = grid(2, 1, [
      ['a', 0, 0],
      ['b', 1, 0],
    ]);
    expect(where(moveItem(left, 'a', 1, 0), 'b')).toEqual([0, 0]);
  });

  it('pushes a wide widget clear of a partial overlap', () => {
    const layout: dashboardLayout = {
      ...makeLayout(),
      items: [
        { ...makeLayout().items[0], ...area(0, 0, 2, 1) },
        { ...makeLayout().items[1], ...area(2, 1, 1, 1) },
      ],
    };
    // 'a' (2 wide) dropped at (1, 1) covers 'b' at (2, 1): 'b' goes right.
    expect(where(moveItem(layout, 'a', 1, 1), 'b')).toEqual([3, 1]);
  });

  it('returns null when a widget in the way has nowhere to go', () => {
    const full = grid(2, 2, [
      ['a', 0, 0],
      ['b', 1, 0],
      ['c', 0, 1],
      ['d', 1, 1],
    ]);
    expect(moveItem(full, 'a', 1, 1)).toBeNull();
  });
});
