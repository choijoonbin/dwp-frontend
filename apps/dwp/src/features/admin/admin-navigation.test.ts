import { describe, expect, it } from 'vitest';

import { findAdminNavigationItem } from './admin-navigation';

describe('admin navigation route resolution', () => {
  it('resolves a concise route segment to its namespaced Space view', () => {
    expect(findAdminNavigationItem('spaces', 'overview')?.view).toBe('space-overview');
    expect(findAdminNavigationItem('spaces', 'content-reviews')?.view).toBe(
      'space-content-reviews'
    );
  });

  it('keeps existing routes with matching view identifiers stable', () => {
    expect(findAdminNavigationItem('identity', 'access')?.view).toBe('access');
    expect(findAdminNavigationItem('governance', 'audit')?.view).toBe('audit');
  });

  it('rejects unknown route combinations', () => {
    expect(findAdminNavigationItem('spaces', 'unknown')).toBeUndefined();
  });
});
