import { describe, expect, it } from 'vitest';

import { policyRevisionEvidenceRows } from './audit-policy-revision-evidence';

describe('audit policy revision evidence', () => {
  it('keeps every canonical before and after value for review', () => {
    expect(
      policyRevisionEvidenceRows({
        diff: {
          standardRetentionDays: { before: 365, after: 730 },
          requireExportReason: { before: false, after: true },
        },
      })
    ).toEqual([
      { field: 'standardRetentionDays', before: 365, after: 730 },
      { field: 'requireExportReason', before: false, after: true },
    ]);
  });
});
