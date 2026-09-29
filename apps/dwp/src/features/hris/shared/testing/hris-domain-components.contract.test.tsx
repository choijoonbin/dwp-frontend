import { describe, expect, it } from 'vitest';

import * as sharedPresentation from '../index';

describe('HRIS shared presentation public contract', () => {
  it('publishes only the five Control-owned presentation primitives', () => {
    expect(Object.keys(sharedPresentation).sort()).toEqual([
      'HrisDomainSection',
      'HrisProgressSignal',
      'HrisQueryBoundary',
      'HrisReferenceNotice',
      'HrisStatusChip',
    ]);
    expect(Object.values(sharedPresentation).every((value) => typeof value === 'function')).toBe(
      true
    );
  });
});
