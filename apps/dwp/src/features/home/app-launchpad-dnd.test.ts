import { describe, expect, it } from 'vitest';

import { folderTargetId, isLaunchpadOriginTarget } from './app-launchpad-dnd';

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
