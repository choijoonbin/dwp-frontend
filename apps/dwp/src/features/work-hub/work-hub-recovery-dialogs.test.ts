import { describe, expect, it } from 'vitest';

import { currentWorkForBatchReview } from './work-hub-recovery-dialogs';
import { hubItem, snapshot } from './work-hub.test-support';

describe('currentWorkForBatchReview', () => {
  it('returns the unique item only while its source is freshly ready', () => {
    const reviewed = hubItem({ key: 'reviewed', sourceId: 'personal', version: 2 });
    const current = { ...reviewed, version: 3 };
    expect(currentWorkForBatchReview(snapshot([current]), reviewed)).toBe(current);

    const unavailable = {
      ...snapshot([current]),
      completeness: 'UNAVAILABLE' as const,
      sources: [{ ...snapshot([current]).sources[0], state: 'UNAVAILABLE' as const }],
    };
    expect(currentWorkForBatchReview(unavailable, reviewed)).toBeNull();
  });

  it('fails closed for a missing or duplicate obligation identity', () => {
    const reviewed = hubItem({ key: 'reviewed' });
    expect(currentWorkForBatchReview(snapshot([]), reviewed)).toBeNull();
    expect(
      currentWorkForBatchReview(
        snapshot([
          reviewed,
          { ...reviewed, title: 'Duplicate response row', version: reviewed.version + 1 },
        ]),
        reviewed
      )
    ).toBeNull();
  });
});
