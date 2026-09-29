import { describe, expect, it, vi } from 'vitest';

import { createHrisHomeModuleProviderRegistry } from '../../home';
import { people360Snapshot } from '../../people/testing/people-360.test-support';
import {
  createHrmPeople360SelfHomeSource,
  HRIS_HOME_RUNTIME_PROVIDER_REGISTRY,
} from '../hris-home-runtime-registry';

import type { HrisHomeProviderContext } from '../../home';
import type { People360SelfDataSource } from '../../people';

function context(overrides: Partial<HrisHomeProviderContext> = {}): HrisHomeProviderContext {
  return {
    audiences: ['EMPLOYEE'],
    scope: { kind: 'SELF', key: 'current-person' },
    surfaceEntitled: true,
    entitlements: [
      {
        resourceType: 'APP',
        resourceKey: 'APP.HRIS',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'DATA',
        resourceKey: 'DATA.WORKFORCE',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ],
    legacyCompatibilityAuthorities: [],
    dataAuthorities: ['MODULE_API'],
    tenantCacheKey: 'tenant-1',
    subjectCacheKey: 'subject-1',
    authorityCacheKey: 'APP:APP.HRIS:VIEW:ALLOW|DATA:DATA.WORKFORCE:VIEW:ALLOW',
    contextScopeKey: 'scope:hris:self:1',
    decisionRevision: 'decision-7',
    accessMode: 'NORMAL',
    purpose: 'HRIS_HOME',
    asOf: '2026-09-29',
    now: '2026-09-29T09:00:00.000Z',
    traceId: 'trace-home-1',
    ...overrides,
  };
}

describe('HRM People 360 home runtime provider', () => {
  it('registers the owner source ahead of compatibility without replacing other modules', () => {
    expect(HRIS_HOME_RUNTIME_PROVIDER_REGISTRY.sources.map((source) => source.sourceId)).toEqual([
      'hrm-people360-self',
      'legacy-home-aggregate',
    ]);
    expect(HRIS_HOME_RUNTIME_PROVIDER_REGISTRY.sources[0]?.dataAuthority).toBe('MODULE_API');
  });

  it('loads the SELF owner projection with the exact as-of and selected scope', async () => {
    const self = vi.fn<People360SelfDataSource['self']>(async () =>
      people360Snapshot({
        asOf: '2026-09-29',
        archetype: 'SELF',
        scope: 'SELF',
      })
    );
    const source = createHrmPeople360SelfHomeSource({ self });
    const signal = new AbortController().signal;

    await source.load(context(), signal);

    expect(self).toHaveBeenCalledWith('2026-09-29', 'people360', 'scope:hris:self:1', signal);
  });

  it('partitions cache identity by tenant, subject, authority, access mode, scope and revision', () => {
    const source = createHrmPeople360SelfHomeSource();
    const base = source.queryKey(context());
    const variants = [
      context({ tenantCacheKey: 'tenant-2' }),
      context({ subjectCacheKey: 'subject-2' }),
      context({ authorityCacheKey: 'authority-2' }),
      context({ accessMode: 'DELEGATED' }),
      context({ contextScopeKey: 'scope:hris:self:2' }),
      context({ decisionRevision: 'decision-8' }),
      context({ asOf: '2026-09-30' }),
    ];

    for (const variant of variants) expect(source.queryKey(variant)).not.toEqual(base);
  });

  it('does not authorize module I/O with a missing discriminator or explicit DENY', () => {
    const registry = createHrisHomeModuleProviderRegistry([createHrmPeople360SelfHomeSource()]);
    expect(registry.canLoadSource('hrm-people360-self', context())).toBe(true);

    for (const missing of [
      context({ tenantCacheKey: null }),
      context({ subjectCacheKey: null }),
      context({ authorityCacheKey: '' }),
      context({ contextScopeKey: null }),
      context({ decisionRevision: '' }),
      context({ accessMode: '' }),
    ]) {
      expect(registry.canLoadSource('hrm-people360-self', missing)).toBe(false);
    }

    expect(
      registry.canLoadSource(
        'hrm-people360-self',
        context({
          entitlements: [
            {
              resourceType: 'APP',
              resourceKey: 'APP.HRIS',
              permissionCode: 'VIEW',
              effect: 'ALLOW',
            },
            {
              resourceType: 'DATA',
              resourceKey: 'DATA.WORKFORCE',
              permissionCode: 'VIEW',
              effect: 'DENY',
            },
          ],
        })
      )
    ).toBe(false);
  });

  it('projects only VIEW fields and preserves owner PARTIAL state', () => {
    const source = createHrmPeople360SelfHomeSource();
    const contribution = source.resolve(
      people360Snapshot({
        asOf: '2026-09-29',
        state: 'PARTIAL',
        archetype: 'SELF',
        scope: 'SELF',
        decisions: {
          'primaryAssignment.businessTitle': 'MASK',
          'primaryAssignment.managerDisplayName': 'OMIT',
        },
      }),
      context()
    );
    const snapshot = contribution.snapshots[0];

    expect(snapshot).toMatchObject({
      widgetId: 'hrm-self-employment',
      dataAuthority: 'MODULE_API',
      state: 'PARTIAL',
      reasonCode: 'PEOPLE_360_SOURCE_PARTIAL',
      payload: {
        displayName: 'Synthetic Worker Alpha',
        businessTitle: null,
        organizationName: 'Synthetic People Operations',
        managerDisplayName: null,
      },
    });
    expect(JSON.stringify(snapshot.payload)).not.toContain('••••');
  });

  it('fails closed when the required display name is masked or owner scope is not SELF', () => {
    const source = createHrmPeople360SelfHomeSource();
    const masked = source.resolve(
      people360Snapshot({
        asOf: '2026-09-29',
        archetype: 'SELF',
        scope: 'SELF',
        decisions: { 'person.displayName': 'MASK' },
      }),
      context()
    );
    expect(masked.snapshots[0]).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'PEOPLE_360_DISPLAY_NAME_NOT_DISCLOSED',
      payload: null,
      primaryAction: null,
      deepLink: null,
    });

    expect(() =>
      source.resolve(
        people360Snapshot({
          asOf: '2026-09-29',
          archetype: 'HR_OPERATOR',
          scope: 'WORKFORCE_POLICY',
        }),
        context()
      )
    ).toThrow('PEOPLE_360_SELF_SCOPE_MISMATCH');
  });
});
