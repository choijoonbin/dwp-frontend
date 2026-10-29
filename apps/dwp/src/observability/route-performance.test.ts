import { describe, expect, it } from 'vitest';

import { classifyRouteGroup } from './route-performance';

describe('route performance classification', () => {
  it.each([
    ['/workplace/home', 'workplace'],
    ['/workplace/find', 'workplace-discovery'],
    ['/workplace/planner', 'workplace-planner'],
    ['/workplace/reservations', 'workplace-reservations'],
    ['/workplace/navigation', 'workplace-navigation'],
    ['/workplace/admin/overview', 'workplace-management'],
  ])('keeps %s in a privacy-safe Workplace performance group', (pathname, expected) => {
    expect(classifyRouteGroup(pathname)).toBe(expected);
  });

  it('keeps non-Workplace route classification delegated to the product shell', () => {
    expect(classifyRouteGroup('/mail/inbox')).toBe('mail');
    expect(classifyRouteGroup('/sign-in')).toBe('authentication');
  });
});
