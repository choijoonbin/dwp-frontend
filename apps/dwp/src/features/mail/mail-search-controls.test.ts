import { describe, expect, it } from 'vitest';

import { criteriaToParams, hasAdvancedCriteria } from './mail-search-controls';

describe('mail search filter persistence', () => {
  it('round-trips folder and needs-reply criteria for saved views', () => {
    const criteria = { folderId: 'folder-1', needsReply: true } as const;

    expect(hasAdvancedCriteria(criteria)).toBe(true);
    expect(criteriaToParams(criteria)).toEqual({
      folderId: 'folder-1',
      needsReply: 'true',
    });
  });

  it('clears false optional criteria instead of persisting a misleading value', () => {
    expect(criteriaToParams({ folderId: undefined, needsReply: false })).toEqual({
      folderId: null,
      needsReply: null,
    });
  });
});
