import { readFileSync } from 'node:fs';
import { isValidElement, Suspense, type ReactElement } from 'react';
import { matchRoutes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { hcmRouteEntries } from './hcm-route-entry';

describe('HCM async route entry', () => {
  it('owns the exact product and compatibility prefixes before loading the feature module', () => {
    expect(hcmRouteEntries.map((route) => route.path)).toEqual(['hr/*', 'people/*', 'workforce/*']);
    expect(matchRoutes(hcmRouteEntries, '/hr/explore')?.at(-1)?.route.path).toBe('hr/*');
    expect(matchRoutes(hcmRouteEntries, '/people/profile')?.at(-1)?.route.path).toBe('people/*');
    expect(matchRoutes(hcmRouteEntries, '/workforce/team')?.at(-1)?.route.path).toBe('workforce/*');
  });

  it('keeps every entry behind a suspense-backed lazy feature boundary', () => {
    for (const route of hcmRouteEntries) {
      expect(isValidElement(route.element)).toBe(true);
      const boundary = route.element as ReactElement<{ children: ReactElement }>;
      expect(boundary.type).toBe(Suspense);
      expect(boundary.props.children.type).toHaveProperty('$$typeof', Symbol.for('react.lazy'));
    }
  });

  it('prevents the platform route section from statically importing the heavy HCM route tree', () => {
    const sections = readFileSync(new URL('./sections.tsx', import.meta.url), 'utf8');
    const entry = readFileSync(new URL('./hcm-route-entry.tsx', import.meta.url), 'utf8');
    expect(sections).toContain("from './hcm-route-entry'");
    expect(sections).not.toContain("from './hcm-routes'");
    expect(entry).toContain("import('./hcm-routes')");
  });
});
