import { describe, expect, it } from 'vitest';

import { HRIS_HOME_LEGACY_AGGREGATE_SOURCE } from '../model/hris-home-provider-registry';
import {
  composeHrisHomeProviderContributions,
  createHrisHomeModuleProviderRegistry,
  resolveHrisHomeFreshness,
  type HrisHomeProviderContext,
  type HrisHomeProviderSource,
  type HrisHomeSnapshotContribution,
  type HrisHomeWidgetContract,
  type HrisHomeWidgetSnapshot,
} from '../model/hris-home-provider-contract';

import type { AppEntitlementPermission } from '@dwp-frontend/shared-utils';

const allow = (resourceKey: string): AppEntitlementPermission => ({
  resourceType: resourceKey.startsWith('APP.') ? 'APP' : 'DATA',
  resourceKey,
  permissionCode: 'VIEW',
  effect: 'ALLOW',
});

function context(overrides: Partial<HrisHomeProviderContext> = {}): HrisHomeProviderContext {
  return {
    audiences: ['EMPLOYEE'],
    scope: { kind: 'SELF', key: 'current-person' },
    surfaceEntitled: true,
    entitlements: [allow('APP.HRIS'), allow('DATA.HR_ABSENCE'), allow('DATA.HR_PAY')],
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
    now: '2026-09-17T01:01:00.000Z',
    traceId: 'trace-hardening',
    ...overrides,
  };
}

function moduleContract(widgetId: string): HrisHomeWidgetContract {
  const legacy = HRIS_HOME_LEGACY_AGGREGATE_SOURCE.widgetContracts.find(
    (contract) => contract.widgetId === widgetId
  );
  if (!legacy) throw new Error(`Missing widget contract: ${widgetId}`);
  return { ...legacy, dataAuthority: 'MODULE_API' };
}

function moduleSource(widgetId: string, sourceId: string): HrisHomeProviderSource {
  const contract = moduleContract(widgetId);
  return {
    sourceId,
    dataAuthority: 'MODULE_API',
    widgetIds: [widgetId],
    widgetContracts: [contract],
    queryKey: () => [sourceId],
    load: async () => null,
    resolve: (data) => data as HrisHomeSnapshotContribution,
    unavailable: () => {
      throw new Error('Source-owned fallback must not be used');
    },
  };
}

function moduleSnapshot(
  contract: HrisHomeWidgetContract,
  providerContext: HrisHomeProviderContext,
  payload: unknown,
  generatedAt = '2026-09-17T01:00:00.000Z'
): HrisHomeWidgetSnapshot {
  return {
    contractVersion: 1,
    widgetId: contract.widgetId,
    sourceModule: contract.sourceModule,
    dataAuthority: 'MODULE_API',
    audience: contract.audience,
    requiredEntitlements: contract.requiredEntitlements,
    scope: providerContext.scope,
    horizon: contract.horizon,
    priority: 'LOW',
    freshness: resolveHrisHomeFreshness(
      generatedAt,
      contract.freshnessSeconds,
      providerContext.now
    ),
    sensitivity: contract.sensitivity,
    purpose: contract.purpose,
    policyRevision: contract.policyRevision,
    state: 'AVAILABLE',
    reasonCode: null,
    payload,
    primaryAction: contract.primaryAction,
    deepLink: contract.deepLink,
    traceId: providerContext.traceId,
  };
}

function contribution(
  source: HrisHomeProviderSource,
  value: HrisHomeWidgetSnapshot,
  metadata: HrisHomeSnapshotContribution['metadata'] = null
): HrisHomeSnapshotContribution {
  return {
    sourceId: source.sourceId,
    dataAuthority: source.dataAuthority,
    snapshots: [value],
    metadata,
  };
}

function findSnapshot(
  snapshots: readonly HrisHomeWidgetSnapshot[],
  widgetId: string
): HrisHomeWidgetSnapshot {
  const value = snapshots.find((candidate) => candidate.widgetId === widgetId);
  if (!value) throw new Error(`Missing snapshot: ${widgetId}`);
  return value;
}

describe('HRIS home provider P1 hardening', () => {
  it('enables a source query only when at least one registered contract is centrally allowed', () => {
    const source = moduleSource('pay-self-cycle', 'pay-owner-api');
    const registry = createHrisHomeModuleProviderRegistry([source]);

    expect(registry.canLoadSource(source.sourceId, context())).toBe(true);
    expect(
      registry.canLoadSource(source.sourceId, context({ entitlements: [allow('APP.HRIS')] }))
    ).toBe(false);
    expect(registry.canLoadSource(source.sourceId, context({ surfaceEntitled: false }))).toBe(
      false
    );
  });

  it('normalizes exact recursive payload shapes and deep-freezes accepted MODULE_API data', () => {
    const providerContext = context();
    const source = moduleSource('tim-self-absence', 'tim-owner-api');
    const registry = createHrisHomeModuleProviderRegistry([source]);
    const contract = source.widgetContracts[0]!;
    const payload = {
      leavePlanCount: 1,
      standardDayMinutes: 480,
      displayBalance: {
        grantedMinutes: 4800,
        usedMinutes: 480,
        pendingMinutes: 0,
        availableMinutes: 4320,
      },
    };
    const base = moduleSnapshot(contract, providerContext, payload);
    const accepted = registry.compose([contribution(source, base)], providerContext);
    const normalized = findSnapshot(accepted.snapshots, contract.widgetId).payload as Record<
      string,
      unknown
    >;
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.displayBalance)).toBe(true);

    const hostilePayloads: unknown[] = [
      { ...payload, serverOnlyEmployeeId: 'must-not-cross-boundary' },
      { ...payload, displayBalance: { ...payload.displayBalance, planName: 'secret-plan-name' } },
      { ...payload, displayBalance: { ...payload.displayBalance, usedMinutes: Number.NaN } },
      { ...payload, standardDayMinutes: '480' },
      { ...payload, displayBalance: [] },
    ];
    for (const hostilePayload of hostilePayloads) {
      const composition = registry.compose(
        [contribution(source, { ...base, payload: hostilePayload })],
        providerContext
      );
      expect(findSnapshot(composition.snapshots, contract.widgetId)).toMatchObject({
        state: 'CONFIGURATION_REQUIRED',
        reasonCode: 'SOURCE_WIDGET_PAYLOAD_INVALID',
        payload: null,
        deepLink: null,
      });
    }

    const paySource = moduleSource('pay-self-cycle', 'pay-owner-api');
    const payContract = paySource.widgetContracts[0]!;
    const payRegistry = createHrisHomeModuleProviderRegistry([paySource]);
    const invalidDate = moduleSnapshot(payContract, providerContext, {
      payDate: '2026-02-30',
      status: 'OPEN',
      timeValidated: true,
      absenceValidated: true,
      sourceConfirmed: true,
    });
    expect(
      findSnapshot(
        payRegistry.compose([contribution(paySource, invalidDate)], providerContext).snapshots,
        payContract.widgetId
      )
    ).toMatchObject({
      state: 'CONFIGURATION_REQUIRED',
      reasonCode: 'SOURCE_WIDGET_PAYLOAD_INVALID',
      payload: null,
    });
  });

  it('treats future clocks as unknown and rejects future or inconsistent source metadata', () => {
    expect(
      resolveHrisHomeFreshness('2026-09-17T01:02:00.000Z', 120, '2026-09-17T01:01:00.000Z')
    ).toMatchObject({ state: 'UNKNOWN' });

    const providerContext = context();
    const source = moduleSource('pay-self-cycle', 'pay-owner-api');
    const contract = source.widgetContracts[0]!;
    const registry = createHrisHomeModuleProviderRegistry([source]);
    const payload = {
      payDate: '2026-09-25',
      status: 'OPEN',
      timeValidated: true,
      absenceValidated: true,
      sourceConfirmed: true,
    };
    const base = moduleSnapshot(contract, providerContext, payload);
    const future = moduleSnapshot(contract, providerContext, payload, '2026-09-17T01:02:00.000Z');
    const futureComposition = registry.compose(
      [
        contribution(source, future, {
          asOf: providerContext.asOf,
          generatedAt: '2026-09-17T01:02:00.000Z',
          referenceDataPresent: false,
        }),
      ],
      providerContext
    );
    expect(findSnapshot(futureComposition.snapshots, contract.widgetId)).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'SOURCE_CONTRIBUTION_TEMPORAL_INVALID',
      payload: null,
    });

    const mismatch = registry.compose(
      [
        contribution(source, base, {
          asOf: providerContext.asOf,
          generatedAt: '2026-09-17T00:59:00.000Z',
          referenceDataPresent: false,
        }),
      ],
      providerContext
    );
    expect(findSnapshot(mismatch.snapshots, contract.widgetId)).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'SOURCE_CONTRIBUTION_METADATA_MISMATCH',
      payload: null,
    });
  });

  it('composes metadata conservatively using real instant ordering', () => {
    const conservative = composeHrisHomeProviderContributions([
      {
        sourceId: 'source-a',
        dataAuthority: 'MODULE_API',
        snapshots: [],
        metadata: {
          asOf: '2026-09-17',
          generatedAt: '2026-09-17T02:00:00+02:00',
          referenceDataPresent: false,
        },
      },
      {
        sourceId: 'source-b',
        dataAuthority: 'MODULE_API',
        snapshots: [],
        metadata: {
          asOf: '2026-09-17',
          generatedAt: '2026-09-17T01:30:00Z',
          referenceDataPresent: true,
        },
      },
    ]);
    expect(conservative.metadata).toEqual({
      asOf: '2026-09-17',
      generatedAt: '2026-09-17T02:00:00+02:00',
      referenceDataPresent: true,
    });

    const incomplete = composeHrisHomeProviderContributions([
      {
        sourceId: 'source-a',
        dataAuthority: 'MODULE_API',
        snapshots: [],
        metadata: conservative.metadata,
      },
      {
        sourceId: 'source-b',
        dataAuthority: 'MODULE_API',
        snapshots: [],
        metadata: null,
      },
    ]);
    expect(incomplete.metadata).toBeNull();
  });
});
