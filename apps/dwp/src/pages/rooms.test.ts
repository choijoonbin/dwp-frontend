import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./rooms.tsx', import.meta.url), 'utf8');

const roomsViews = [
  'rooms-admin-operations',
  'rooms-admin-policies',
  'workplace-admin-locations',
  'workplace-admin-governance',
  'workplace-admin-facilities',
  'workplace-exception-console',
  'workplace-admin-overview',
  'workplace-admin-policy',
  'workplace-unified-reservations',
  'workplace-service-orders',
  'workplace-navigation-pages',
  'workplace-navigation-pages',
  'workplace-space-planning',
  'workplace-service-provider-admin',
  'workplace-assistant-user',
  'workplace-assistant-admin',
  'workplace-safety-user',
  'workplace-safety-admin',
  'workplace-service-fulfillment',
  'workplace-service-catalog-admin',
  'workplace-visit-admin',
  'workplace-visit-management',
  'workplace-visit-management',
  'workplace-visit-management',
  'workplace-visit-management',
  'workplace-explore',
  'workplace-member-workspace',
  'workplace-planner',
] as const;

describe('Rooms page loading boundary', () => {
  it('keeps every feature view behind a lazy import', () => {
    roomsViews.forEach((view) => {
      expect(source).toContain(`import('../features/rooms/${view}')`);
      expect(source).not.toMatch(
        new RegExp(`import\\s+\\{[^}]+\\}\\s+from\\s+['"]\\.\\./features/rooms/${view}['"]`)
      );
    });

    expect(source.match(/const (?:Room|Rooms|Workplace)\w+ = lazy\(/g)).toHaveLength(
      roomsViews.length
    );
  });

  it('keeps access and date context mounted above the shared route fallback', () => {
    const accessGuardStart = source.indexOf('<ProductAreaNavigationItemAccessGuard');
    const dateProviderStart = source.indexOf('<DwpDatePickerProvider>');
    const suspenseStart = source.indexOf('<Suspense fallback={<RouteFallback />}>');
    const suspenseEnd = source.indexOf('</Suspense>');
    const dateProviderEnd = source.indexOf('</DwpDatePickerProvider>');
    const accessGuardEnd = source.indexOf('</ProductAreaNavigationItemAccessGuard>');

    expect(accessGuardStart).toBeGreaterThan(-1);
    expect(accessGuardStart).toBeLessThan(dateProviderStart);
    expect(dateProviderStart).toBeLessThan(suspenseStart);
    expect(suspenseStart).toBeLessThan(suspenseEnd);
    expect(suspenseEnd).toBeLessThan(dateProviderEnd);
    expect(dateProviderEnd).toBeLessThan(accessGuardEnd);
  });
});
