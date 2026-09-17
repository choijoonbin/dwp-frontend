import { describe, expect, it } from 'vitest';

import { mailInboxFirstAutoSelection } from './mail-inbox-selection';

describe('mail inbox desktop selection', () => {
  it('preserves an explicit deep link even when its thread is outside the current page', () => {
    expect(
      mailInboxFirstAutoSelection({
        desktopSplitView: true,
        fetching: false,
        selectedId: 'deep-linked-thread',
        threadIds: ['first-page-thread'],
      })
    ).toBeNull();
  });

  it('selects the first row only when desktop has no explicit selection', () => {
    expect(
      mailInboxFirstAutoSelection({
        desktopSplitView: true,
        fetching: false,
        selectedId: null,
        threadIds: ['first-page-thread'],
      })
    ).toBe('first-page-thread');
  });
});
