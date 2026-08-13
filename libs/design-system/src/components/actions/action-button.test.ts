import { describe, expect, it } from 'vitest';

import { resolveActionButtonAriaLabel } from './action-button';

describe('resolveActionButtonAriaLabel', () => {
  it('preserves an explicit accessible name', () => {
    expect(resolveActionButtonAriaLabel('Approve renewal', false, undefined, 'Approve')).toBe(
      'Approve renewal'
    );
  });

  it('uses the visible label when an action becomes icon-only at a narrow viewport', () => {
    expect(resolveActionButtonAriaLabel(undefined, false, undefined, 'Approve')).toBe('Approve');
  });

  it('announces the loading state when a loading label is provided', () => {
    expect(resolveActionButtonAriaLabel(undefined, true, 'Approving renewal', 'Approve')).toBe(
      'Approving renewal'
    );
  });
});
