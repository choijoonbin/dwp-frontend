import { describe, expect, it, vi } from 'vitest';

import {
  canLoadHcmHomeSourceSafely,
  composeHcmHomeProvidersSafely,
  hcmHomeProviderHasDegradation,
  hcmHomeProviderPayload,
  hcmHomeProviderRoute,
  hcmHomeProviderStateSummary,
  loadHcmHomeSourceSafely,
  resolveHcmHomeSourceContributionSafely,
  resolveHcmHomeProviderAudiences,
  type HcmHomeModuleProviderRegistry,
  type HcmHomeProviderContext,
  type HcmHomeProviderSource,
  type HcmHomeSnapshotContribution,
  type HcmHomeProviderSnapshot,
  type HcmHomeProviderState,
} from './hcm-home-provider-adapter';

const PROVIDER_CONTEXT: HcmHomeProviderContext = {
  audiences: ['EMPLOYEE'],
  scope: { kind: 'SELF', key: 'current-person' },
  surfaceEntitled: true,
  entitlements: [],
  legacyCompatibilityAuthorities: [],
  dataAuthorities: ['MODULE_API'],
  tenantCacheKey: 'tenant',
  subjectCacheKey: 'subject',
  authorityCacheKey: 'authority',
  contextScopeKey: 'scope:hris/self',
  decisionRevision: 'decision-home-1',
  accessMode: 'NORMAL',
  purpose: 'HRIS_HOME',
  asOf: '2026-09-17',
  now: '2026-09-17T01:00:00Z',
  traceId: 'trace-adapter',
};

function providerSnapshot(
  state: HcmHomeProviderState,
  overrides: Partial<HcmHomeProviderSnapshot> = {}
): HcmHomeProviderSnapshot {
  const actionable = ['AVAILABLE', 'EMPTY', 'STALE', 'PARTIAL'].includes(state);
  return {
    contractVersion: 1,
    widgetId: 'tim-self-time',
    sourceModule: 'TIM',
    dataAuthority: 'LEGACY_AGGREGATE_COMPATIBILITY',
    audience: ['EMPLOYEE'],
    requiredEntitlements: [
      {
        resourceType: 'DATA',
        resourceKey: 'DATA.HR_TIME',
        permissionCodes: ['VIEW'],
        match: 'ANY',
      },
    ],
    scope: { kind: 'SELF', key: 'current-person' },
    horizon: 'NOW',
    priority: 'MEDIUM',
    freshness: {
      generatedAt: '2026-09-17T01:00:00Z',
      maxAgeSeconds: 120,
      state: state === 'STALE' ? 'STALE' : 'FRESH',
    },
    sensitivity: {
      classification: 'CONFIDENTIAL',
      projection: 'VIEW',
      exposedFields: ['status'],
    },
    purpose: 'HRIS_HOME',
    policyRevision: 'test-policy-v1',
    state,
    reasonCode: null,
    payload: actionable ? { status: 'OPEN' } : null,
    primaryAction: actionable ? { actionId: 'OPEN_SELF_TIME', labelKey: 'home.tools.time' } : null,
    deepLink: actionable ? '/hr/time' : null,
    traceId: 'trace-adapter',
    ...overrides,
  };
}

describe('HCM HRIS home provider compatibility adapter', () => {
  it('derives all five governed audiences without inventing roles', () => {
    expect(
      resolveHcmHomeProviderAudiences({
        roles: ['AUDITOR'],
        canAccessPersonal: true,
        isManager: true,
        canOperate: true,
        canManageSettings: true,
      })
    ).toEqual(['EMPLOYEE', 'MANAGER', 'OPERATOR', 'SETTINGS_ADMIN', 'AUDITOR']);
    expect(
      resolveHcmHomeProviderAudiences({
        roles: [],
        canAccessPersonal: false,
        isManager: false,
        canOperate: false,
        canManageSettings: false,
      })
    ).toEqual([]);
  });

  it('never falls back to a deep link for missing, forbidden, or unconfigured providers', () => {
    expect(hcmHomeProviderRoute([], 'tim-self-time')).toBe('');
    expect(hcmHomeProviderRoute([providerSnapshot('FORBIDDEN')], 'tim-self-time')).toBe('');
    expect(
      hcmHomeProviderRoute([providerSnapshot('CONFIGURATION_REQUIRED')], 'tim-self-time')
    ).toBe('');
    for (const state of ['FORBIDDEN', 'CONFIGURATION_REQUIRED', 'UNAVAILABLE'] as const) {
      expect(
        hcmHomeProviderRoute(
          [
            providerSnapshot(state, {
              primaryAction: { actionId: 'MALICIOUS_ACTION', labelKey: 'malicious' },
              deepLink: '/hr/malicious',
            }),
          ],
          'tim-self-time'
        )
      ).toBe('');
    }
    expect(hcmHomeProviderRoute([providerSnapshot('AVAILABLE')], 'tim-self-time')).toBe('/hr/time');
  });

  it('never returns a payload for forbidden or unconfigured providers even if one is attached', () => {
    const leakedPayload = { status: 'DO_NOT_RENDER' };

    expect(
      hcmHomeProviderPayload(
        [providerSnapshot('FORBIDDEN', { payload: leakedPayload })],
        'tim-self-time'
      )
    ).toBeNull();
    expect(
      hcmHomeProviderPayload(
        [providerSnapshot('CONFIGURATION_REQUIRED', { payload: leakedPayload })],
        'tim-self-time'
      )
    ).toBeNull();
    expect(hcmHomeProviderPayload([providerSnapshot('AVAILABLE')], 'tim-self-time')).toEqual({
      status: 'OPEN',
    });
  });

  it('reports actionable degradation without exposing forbidden provider metadata', () => {
    const snapshots = [
      providerSnapshot('FORBIDDEN'),
      providerSnapshot('PARTIAL', {
        widgetId: 'tim-self-absence',
        deepLink: '/hr/absence',
      }),
    ];
    const summary = hcmHomeProviderStateSummary(snapshots);
    expect(summary).not.toContain('tim-self-time');
    expect(summary).toContain('tim-self-absence:PARTIAL:FRESH:VIEW:LEGACY_AGGREGATE_COMPATIBILITY');
    expect(hcmHomeProviderHasDegradation(snapshots)).toBe(true);
  });

  it('blocks unauthorized loads and isolates throwing resolve, unavailable, and compose callbacks', async () => {
    const fallback: HcmHomeSnapshotContribution = {
      sourceId: 'hostile-source',
      dataAuthority: 'MODULE_API',
      snapshots: [
        providerSnapshot('UNAVAILABLE', {
          dataAuthority: 'MODULE_API',
          reasonCode: 'CENTRAL_FALLBACK',
        }),
      ],
      metadata: null,
    };
    const load = vi.fn(async () => ({ secret: 'source-result' }));
    const resolve = vi.fn(() => {
      throw new Error('hostile resolve');
    });
    const unavailable = vi.fn(() => {
      throw new Error('hostile unavailable');
    });
    const source = {
      sourceId: 'hostile-source',
      dataAuthority: 'MODULE_API',
      widgetIds: ['tim-self-time'],
      widgetContracts: [],
      queryKey: () => ['hostile-source'],
      load,
      resolve,
      unavailable,
    } as unknown as HcmHomeProviderSource;
    const unavailableContribution = vi.fn(() => fallback);
    const allowedRegistry = {
      schemaVersion: 1,
      sources: [source],
      canLoadSource: () => true,
      unavailableContribution,
      compose: vi.fn(() => {
        throw new Error('hostile compose');
      }),
    } as HcmHomeModuleProviderRegistry;

    await expect(
      loadHcmHomeSourceSafely(allowedRegistry, source, PROVIDER_CONTEXT)
    ).resolves.toEqual({ secret: 'source-result' });
    const contribution = resolveHcmHomeSourceContributionSafely(
      allowedRegistry,
      source,
      PROVIDER_CONTEXT,
      { hasData: true, data: {}, reasonCode: 'HOSTILE_SOURCE_PROJECTION_FAILED' }
    );
    expect(contribution).toBe(fallback);
    expect(unavailable).not.toHaveBeenCalled();
    expect(unavailableContribution).toHaveBeenCalledWith(
      source.sourceId,
      PROVIDER_CONTEXT,
      'HOSTILE_SOURCE_PROJECTION_FAILED'
    );

    const safeComposition = composeHcmHomeProvidersSafely(
      allowedRegistry,
      contribution ? [contribution] : [],
      PROVIDER_CONTEXT
    );
    expect(safeComposition.snapshots).toEqual(fallback.snapshots);
    expect(safeComposition.metadata).toBeNull();

    const deniedRegistry = {
      ...allowedRegistry,
      canLoadSource: () => false,
    };
    load.mockClear();
    expect(canLoadHcmHomeSourceSafely(deniedRegistry, source.sourceId, PROVIDER_CONTEXT)).toBe(
      false
    );
    await expect(loadHcmHomeSourceSafely(deniedRegistry, source, PROVIDER_CONTEXT)).rejects.toThrow(
      'HRIS_HOME_SOURCE_NOT_AUTHORIZED'
    );
    expect(load).not.toHaveBeenCalled();
  });

  it('marks future-dated freshness as degraded for the visible home status', () => {
    expect(
      hcmHomeProviderHasDegradation([
        providerSnapshot('AVAILABLE', {
          freshness: {
            generatedAt: '2026-09-17T01:02:00Z',
            maxAgeSeconds: 120,
            state: 'UNKNOWN',
          },
        }),
      ])
    ).toBe(true);
  });
});
