import { describe, expect, it } from 'vitest';

import {
  folderTargetId,
  hasLaunchpadDragMovement,
  isLaunchpadOriginTarget,
  shouldRetainCrossGroupPreview,
} from './app-launchpad-dnd';

describe('launchpad origin drop policy', () => {
  it('recognizes both sortable and nested folder targets for the dragged item', () => {
    expect(isLaunchpadOriginTarget('work', 'work')).toBe(true);
    expect(isLaunchpadOriginTarget('work', folderTargetId('work'))).toBe(true);
  });

  it('keeps a different item as a valid drop target', () => {
    expect(isLaunchpadOriginTarget('work', 'mail')).toBe(false);
    expect(isLaunchpadOriginTarget('work', folderTargetId('mail'))).toBe(false);
  });
});

describe('launchpad pointer movement threshold', () => {
  it('treats a stationary long-press and small hand jitter as a no-op', () => {
    expect(hasLaunchpadDragMovement({ x: 0, y: 0 })).toBe(false);
    expect(hasLaunchpadDragMovement({ x: 2, y: 2 })).toBe(false);
    expect(hasLaunchpadDragMovement({ x: 9, y: 0 })).toBe(false);
  });

  it('allows the first long-press gesture to commit after real movement', () => {
    expect(hasLaunchpadDragMovement({ x: 10, y: 0 })).toBe(true);
    expect(hasLaunchpadDragMovement({ x: 6, y: 8 })).toBe(true);
  });
});

describe('launchpad cross-group preview stability', () => {
  const stationaryPreview = {
    sourceGroupId: 'work',
    previewTargetGroupId: 'connect',
    nextTargetGroupId: 'connect',
    previewDelta: { x: 128, y: 4 },
    nextDelta: { x: 128, y: 4 },
  } as const;

  it('keeps the visible destination when layout reflow changes the collision at the same pointer', () => {
    expect(shouldRetainCrossGroupPreview(stationaryPreview)).toBe(true);
  });

  it('accepts a new collision after the pointer actually moves', () => {
    expect(
      shouldRetainCrossGroupPreview({
        ...stationaryPreview,
        nextDelta: { x: 132, y: 4 },
      })
    ).toBe(false);
  });

  it('does not retain a preview after entering another group', () => {
    expect(
      shouldRetainCrossGroupPreview({
        ...stationaryPreview,
        nextTargetGroupId: 'services',
      })
    ).toBe(false);
  });

  it('does not interfere with reordering inside the source group', () => {
    expect(
      shouldRetainCrossGroupPreview({
        ...stationaryPreview,
        previewTargetGroupId: 'work',
        nextTargetGroupId: 'work',
      })
    ).toBe(false);
  });
});
