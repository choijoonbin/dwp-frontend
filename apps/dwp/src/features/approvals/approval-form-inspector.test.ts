import { describe, expect, it } from 'vitest';

import { approvalFormReferenceQueryEnabled } from './approval-form-inspector';

describe('approval form inspector reference query', () => {
  it('starts only when the exact management scope and workflow reference are ready', () => {
    expect(approvalFormReferenceQueryEnabled(true, 'workflow-1')).toBe(true);
    expect(approvalFormReferenceQueryEnabled(false, 'workflow-1')).toBe(false);
    expect(approvalFormReferenceQueryEnabled(true, undefined)).toBe(false);
    expect(approvalFormReferenceQueryEnabled(true, '')).toBe(false);
  });
});
