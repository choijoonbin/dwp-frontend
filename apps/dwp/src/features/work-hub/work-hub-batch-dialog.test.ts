import { describe, expect, it } from 'vitest';

import { isConfirmedBatchResult } from './work-hub-batch-dialog';
import { hubItem, workspace } from './work-hub.test-support';

describe('isConfirmedBatchResult', () => {
  const requested = hubItem({
    legacyItem: workspace({ workItemId: 'work-1', version: 2 }),
  });

  it('requires a newer receipt for every requested item in the requested state', () => {
    expect(
      isConfirmedBatchResult(
        'COMPLETED',
        [requested],
        [workspace({ workItemId: 'work-1', version: 3, status: 'completed' })]
      )
    ).toBe(true);
    expect(
      isConfirmedBatchResult(
        'COMPLETED',
        [requested],
        [workspace({ workItemId: 'work-1', version: 2, status: 'completed' })]
      )
    ).toBe(false);
    expect(isConfirmedBatchResult('COMPLETED', [requested], [])).toBe(false);
  });
});
