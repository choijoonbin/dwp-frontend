import { describe, expect, it } from 'vitest';

import { findAdminNavigationItem } from './admin-navigation';

describe('admin navigation route resolution', () => {
  it('does not duplicate product-owned operations in the control center', () => {
    expect(findAdminNavigationItem('spaces', 'overview')).toBeUndefined();
    expect(findAdminNavigationItem('services', 'service-catalog')).toBeUndefined();
    expect(findAdminNavigationItem('notifications', 'overview')).toBeUndefined();
  });

  it('keeps existing routes with matching view identifiers stable', () => {
    expect(findAdminNavigationItem('identity', 'access')?.view).toBe('access');
    expect(findAdminNavigationItem('governance', 'audit')?.view).toBe('audit');
  });

  it('rejects unknown route combinations', () => {
    expect(findAdminNavigationItem('platform', 'unknown')).toBeUndefined();
  });
});
