import { describe, expect, it } from 'vitest';

import { lifecycleLabelKey } from './lifecycle-chip';

describe('lifecycle chip presentation', () => {
  it('does not expose an unknown server lifecycle code', () => {
    expect(lifecycleLabelKey('FUTURE_STATE')).toBe('common.lifecycle.UNKNOWN');
  });
});
