import { it, expect, describe } from 'vitest';

import { normalizeRoutePath } from '../normalize-route-path';

describe('normalizeRoutePath', () => {
  it('returns null for empty inputs', () => {
    expect(normalizeRoutePath(undefined)).toBeNull();
    expect(normalizeRoutePath(null)).toBeNull();
    expect(normalizeRoutePath('   ')).toBeNull();
  });

  it('trims whitespace and collapses slashes', () => {
    expect(normalizeRoutePath('  /admin//users/  ')).toBe('/admin/users');
  });

  it('keeps root slash intact', () => {
    expect(normalizeRoutePath('/')).toBe('/');
  });

  it('maps app/admin paths to canonical admin routes', () => {
    expect(normalizeRoutePath('/app/admin/users')).toBe('/admin/users');
    expect(normalizeRoutePath('/app/admin/audit-logs')).toBe('/admin/audit');
    expect(normalizeRoutePath('/app/admin/code-usage')).toBe('/admin/code-usages');
  });

  it('maps admin aliases to canonical admin routes', () => {
    expect(normalizeRoutePath('/admin/audit-logs')).toBe('/admin/audit');
    expect(normalizeRoutePath('/admin/code-usage')).toBe('/admin/code-usages');
  });

  it('maps app/admin aiworkspace to host ai-workspace', () => {
    expect(normalizeRoutePath('/app/admin/aiworkspace')).toBe('/ai-workspace');
  });
});
