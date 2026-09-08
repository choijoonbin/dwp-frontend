import { describe, expect, it } from 'vitest';

import { approvalWorkReturnTarget } from './approval-return-target';

describe('approval Work return target', () => {
  it('accepts only canonical internal Work destinations', () => {
    expect(approvalWorkReturnTarget('/work/queue?view=mine#task-42')).toBe(
      '/work/queue?view=mine#task-42'
    );
    expect(approvalWorkReturnTarget('/work')).toBe('/work');

    expect(approvalWorkReturnTarget('https://evil.test/work')).toBeNull();
    expect(approvalWorkReturnTarget('//evil.test/work')).toBeNull();
    expect(approvalWorkReturnTarget('/approvals/inbox')).toBeNull();
    expect(approvalWorkReturnTarget('/work/../admin')).toBeNull();
    expect(approvalWorkReturnTarget('/work\\queue')).toBeNull();
    expect(approvalWorkReturnTarget('/work/%5cadmin')).toBeNull();
    expect(approvalWorkReturnTarget('/work/%2e%2e/admin')).toBeNull();
    expect(approvalWorkReturnTarget('/work/queue\u0000')).toBeNull();
    expect(approvalWorkReturnTarget('/work/queue?filter=%0A')).toBeNull();
    expect(approvalWorkReturnTarget(`/work/${'a'.repeat(2_048)}`)).toBeNull();
  });
});
