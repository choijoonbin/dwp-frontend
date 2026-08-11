import { describe, expect, it } from 'vitest';

import { mergeFilterSearchParams } from './filter-bar';

describe('mergeFilterSearchParams', () => {
  it('preserves unrelated context while replacing owned filters', () => {
    const current = new URLSearchParams('tenant=skax&q=old&status=waiting');
    const next = mergeFilterSearchParams(current, {
      q: 'access',
      status: null,
      owner: ['me', 'team'],
    });

    expect(next.get('tenant')).toBe('skax');
    expect(next.get('q')).toBe('access');
    expect(next.has('status')).toBe(false);
    expect(next.getAll('owner')).toEqual(['me', 'team']);
  });

  it('does not serialize empty values into shareable URLs', () => {
    const next = mergeFilterSearchParams(new URLSearchParams('q=old'), {
      q: '',
      status: undefined,
    });

    expect(next.toString()).toBe('');
  });
});
