import { describe, expect, it } from 'vitest';

import {
  advancedCriteriaEqual,
  criteriaToParams,
  hasAdvancedCriteria,
  mailSearchDateRangeInvalid,
} from './mail-search-controls';

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

  it('keeps advanced edits local until they differ from applied criteria', () => {
    expect(advancedCriteriaEqual({ from: 'a@example.com' }, { from: 'a@example.com' })).toBe(true);
    expect(advancedCriteriaEqual({ from: 'b@example.com' }, { from: 'a@example.com' })).toBe(false);
  });

  it('rejects an end date before the start date', () => {
    expect(mailSearchDateRangeInvalid({ dateFrom: '2026-10-28', dateTo: '2026-10-27' })).toBe(true);
    expect(mailSearchDateRangeInvalid({ dateFrom: '2026-10-27', dateTo: '2026-10-28' })).toBe(
      false
    );
  });
});
