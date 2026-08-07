import { it, expect, describe } from 'vitest';

import { safeReturnUrl } from './auth-redirect';

describe('safeReturnUrl', () => {
  it('accepts local application paths', () => {
    expect(safeReturnUrl('/projects?view=active')).toBe('/projects?view=active');
  });

  it('rejects external and recursive login paths', () => {
    expect(safeReturnUrl('//example.com')).toBeNull();
    expect(safeReturnUrl('https://example.com')).toBeNull();
    expect(safeReturnUrl('/sign-in?returnUrl=/')).toBeNull();
  });
});
