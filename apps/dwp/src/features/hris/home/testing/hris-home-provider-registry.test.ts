import { describe, expect, it } from 'vitest';

import {
  HRIS_HOME_LEGACY_AGGREGATE_ADAPTER,
  HRIS_HOME_LEGACY_AGGREGATE_SOURCE,
  HRIS_HOME_MODULE_PROVIDER_REGISTRY,
} from '../model/hris-home-provider-registry';
import {
  createHrisHomeModuleProviderRegistry,
  evaluateHrisHomeProviderEntitlement,
  resolveHrisHomeWidgetProvider,
  type HrisHomeProviderContext,
  type HrisHomeProviderSource,
  type HrisHomeSnapshotContribution,
  type HrisHomeWidgetProvider,
  type HrisHomeWidgetSnapshot,
} from '../model/hris-home-provider-contract';

import type {
  AppEntitlementPermission,
  HrHomeDomain,
  HrHomeDomainState,
  HrHomeOverview,
} from '@dwp-frontend/shared-utils';

const allow = (
  resourceKey: string,
  permissionCode: string,
  resourceType = resourceKey.startsWith('APP.') ? 'APP' : 'DATA'
): AppEntitlementPermission => ({
  resourceType,
  resourceKey,
  permissionCode,
  effect: 'ALLOW',
});

const SELF_GRANTS = Object.freeze([
  allow('APP.HRIS', 'VIEW'),
  allow('DATA.WORKFORCE', 'VIEW'),
  allow('DATA.HR_TIME', 'VIEW'),
  allow('DATA.HR_ABSENCE', 'VIEW'),
  allow('DATA.HR_PAY', 'VIEW'),
  allow('DATA.HR_TALENT', 'VIEW'),
]);

const MANAGER_GRANTS = Object.freeze([
  allow('APP.HRIS', 'VIEW'),
  allow('DATA.WORKFORCE', 'VIEW'),
  allow('DATA.HR_TIME', 'APPROVE'),
  allow('DATA.HR_ABSENCE', 'APPROVE'),
]);

function overview(
  domainOverrides: Partial<Record<HrHomeDomain, HrHomeDomainState>> = {}
): HrHomeOverview {
  const available = {
    availability: 'AVAILABLE' as const,
    dataOrigin: 'SOURCE' as const,
    reasonCode: null,
  };
  return {
    asOf: '2026-09-17',
    generatedAt: '2026-09-17T01:00:00.000Z',
    timeZone: 'Asia/Seoul',
    standardDayMinutes: 480,
    employee: {
      personId: 'person-self',
      displayName: 'Fixture Employee',
      businessTitle: 'Platform Specialist',
      organizationName: 'People Experience',
      managerDisplayName: 'Fixture Manager',
      directReportCount: 2,
    },
    time: {
      timeCardId: 'time-card-1',
      periodStart: '2026-09-14',
      periodEnd: '2026-09-20',
      status: 'OPEN',
      scheduledMinutes: 2400,
      recordedMinutes: 1800,
      exceptionCount: 1,
      dataOrigin: 'SOURCE',
      version: 3,
    },
    leaveBalances: [
      {
        planId: 'plan-b',
        planKey: 'VACATION-B',
        planName: 'Plan B',
        grantedMinutes: 4800,
        usedMinutes: 480,
        pendingMinutes: 0,
        availableMinutes: 4320,
        asOf: '2026-09-17',
        dataOrigin: 'SOURCE',
      },
      {
        planId: 'plan-a',
        planKey: 'CUSTOM-A',
        planName: 'Plan A',
        grantedMinutes: 960,
        usedMinutes: 0,
        pendingMinutes: 0,
        availableMinutes: 960,
        asOf: '2026-09-17',
        dataOrigin: 'SOURCE',
      },
    ],
    pay: {
      payCycleId: 'pay-cycle-1',
      name: 'Do not project this name',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      payDate: '2026-09-25',
      status: 'OPEN',
      timeValidated: true,
      absenceValidated: true,
      sourceConfirmed: false,
      dataOrigin: 'SOURCE',
    },
    enrollmentWindows: [
      {
        windowId: 'benefit-window-1',
        name: 'Out of Wave1 scope',
        windowType: 'BENEFITS',
        opensAt: '2026-09-01T00:00:00Z',
        closesAt: '2026-09-30T00:00:00Z',
        lifecycleState: 'OPEN',
      },
    ],
    journeys: [
      {
        journeyId: 'journey-1',
        name: 'Do not project this journey name',
        journeyType: 'PERFORMANCE',
        progressPercent: 40,
        targetDate: '2026-10-01',
        status: 'ACTIVE',
      },
    ],
    activeBenefitCount: 3,
    openBenefitWindowCount: 1,
    activeGoalCount: 2,
    requiredLearningCount: 1,
    teamPendingCount: 5,
    teamTimePendingCount: 3,
    teamAbsencePendingCount: 2,
    domainStates: {
      TIME: available,
      ABSENCE: available,
      BENEFITS: available,
      PAY: available,
      TALENT: available,
      TEAM: available,
      ...domainOverrides,
    },
    referenceDataPresent: false,
  };
}

function context(overrides: Partial<HrisHomeProviderContext> = {}): HrisHomeProviderContext {
  return {
    audiences: ['EMPLOYEE'],
    scope: { kind: 'SELF', key: 'current-person' },
    surfaceEntitled: true,
    entitlements: SELF_GRANTS,
    legacyCompatibilityAuthorities: [],
    dataAuthorities: ['LEGACY_AGGREGATE_COMPATIBILITY'],
    tenantCacheKey: 'tenant-fixture',
    subjectCacheKey: 'subject-fixture',
    authorityCacheKey: 'authority-fixture',
    contextScopeKey: 'scope:hris/self',
    decisionRevision: 'decision-home-1',
    accessMode: 'NORMAL',
    purpose: 'HRIS_HOME',
    asOf: '2026-09-17',
    now: '2026-09-17T01:01:00.000Z',
    traceId: 'trace-home-1',
    ...overrides,
  };
}

function resolveLegacy(
  value: HrHomeOverview,
  providerContext: HrisHomeProviderContext
): readonly HrisHomeWidgetSnapshot[] {
  return HRIS_HOME_LEGACY_AGGREGATE_ADAPTER.resolve(value, providerContext).snapshots;
}

function snapshot(
  snapshots: readonly HrisHomeWidgetSnapshot[],
  widgetId: string
): HrisHomeWidgetSnapshot {
  const value = snapshots.find((candidate) => candidate.widgetId === widgetId);
  if (!value) throw new Error(`Missing provider snapshot: ${widgetId}`);
  return value;
}

function moduleSource(template: HrisHomeWidgetSnapshot, sourceId: string): HrisHomeProviderSource {
  const legacyContract = HRIS_HOME_LEGACY_AGGREGATE_SOURCE.widgetContracts.find(
    (contract) => contract.widgetId === template.widgetId
  );
  if (!legacyContract) throw new Error(`Missing home payload descriptor: ${template.widgetId}`);
  const widgetContract = {
    ...legacyContract,
    dataAuthority: 'MODULE_API' as const,
  };
  return {
    sourceId,
    dataAuthority: 'MODULE_API',
    widgetIds: [template.widgetId],
    widgetContracts: [widgetContract],
    queryKey: () => [sourceId],
    load: async () => null,
    resolve: (data) => data as HrisHomeSnapshotContribution,
    unavailable: (providerContext, reasonCode) => ({
      sourceId,
      dataAuthority: 'MODULE_API',
      snapshots: [
        {
          ...template,
          dataAuthority: 'MODULE_API',
          scope: providerContext.scope,
          purpose: providerContext.purpose,
          state: 'UNAVAILABLE',
          reasonCode,
          payload: null,
          primaryAction: null,
          deepLink: null,
          traceId: providerContext.traceId,
        },
      ],
      metadata: null,
    }),
  };
}

function modulePaySource(template: HrisHomeWidgetSnapshot): HrisHomeProviderSource {
  return moduleSource(template, 'pay-owner-api');
}

function modulePaySnapshot(
  template: HrisHomeWidgetSnapshot,
  providerContext: HrisHomeProviderContext,
  overrides: Partial<HrisHomeWidgetSnapshot> = {}
): HrisHomeWidgetSnapshot {
  return {
    ...template,
    dataAuthority: 'MODULE_API',
    scope: providerContext.scope,
    traceId: providerContext.traceId,
    ...overrides,
  };
}

describe('HRIS home legacy aggregate provider registry', () => {
  it('publishes strict module-specific contracts while naming the compatibility source', () => {
    const providers = HRIS_HOME_LEGACY_AGGREGATE_ADAPTER.providers;
    expect(providers.map((provider) => provider.widgetId)).toEqual([
      'hrm-self-employment',
      'hrm-team-shape',
      'tim-self-time',
      'tim-self-absence',
      'tim-team-time-decisions',
      'tim-team-absence-decisions',
      'pay-self-cycle',
      'per-self-performance',
    ]);
    expect(new Set(providers.map((provider) => provider.widgetId)).size).toBe(providers.length);
    expect(providers.every((provider) => provider.entitlementMode === 'STRICT')).toBe(true);
    expect(
      providers.every(
        (provider) =>
          provider.contractVersion === 1 &&
          provider.purpose === 'HRIS_HOME' &&
          provider.policyRevision.length > 0
      )
    ).toBe(true);
    expect(
      providers.every((provider) => provider.dataAuthority === 'LEGACY_AGGREGATE_COMPATIBILITY')
    ).toBe(true);
    expect(
      providers.every((provider) =>
        provider.requiredEntitlements.some(
          (requirement) =>
            requirement.resourceType === 'APP' && requirement.resourceKey === 'APP.HRIS'
        )
      )
    ).toBe(true);
    expect(
      providers.every((provider) =>
        provider.requiredEntitlements.some((requirement) => requirement.resourceType === 'DATA')
      )
    ).toBe(true);
    expect(providers.some((provider) => provider.deepLink.includes('benefit'))).toBe(false);
    expect(Object.isFrozen(HRIS_HOME_LEGACY_AGGREGATE_ADAPTER)).toBe(true);
    expect(HRIS_HOME_MODULE_PROVIDER_REGISTRY.sources).toHaveLength(1);
    expect(Object.isFrozen(providers)).toBe(true);
  });

  it('resolves the minimum employee SELF grants without widening to manager scope', () => {
    const snapshots = resolveLegacy(overview(), context());

    for (const widgetId of [
      'hrm-self-employment',
      'tim-self-time',
      'tim-self-absence',
      'pay-self-cycle',
      'per-self-performance',
    ]) {
      const value = snapshot(snapshots, widgetId);
      expect(['AVAILABLE', 'EMPTY']).toContain(value.state);
      expect(value.traceId).toBe('trace-home-1');
      expect(value.deepLink).toMatch(/^\/hr\//u);
      expect(value.dataAuthority).toBe('LEGACY_AGGREGATE_COMPATIBILITY');
    }
    expect(snapshot(snapshots, 'hrm-team-shape')).toMatchObject({
      state: 'FORBIDDEN',
      reasonCode: 'AUDIENCE_DENIED',
      payload: null,
      deepLink: null,
    });
  });

  it('gives explicit DENY precedence and never returns payload or an action', () => {
    const snapshots = resolveLegacy(
      overview(),
      context({
        entitlements: [
          ...SELF_GRANTS,
          {
            resourceType: 'DATA',
            resourceKey: 'DATA.HR_PAY',
            permissionCode: 'VIEW',
            effect: 'DENY',
          },
        ],
      })
    );

    expect(snapshot(snapshots, 'pay-self-cycle')).toMatchObject({
      state: 'FORBIDDEN',
      reasonCode: 'ENTITLEMENT_DENIED',
      payload: null,
      primaryAction: null,
      deepLink: null,
    });
  });

  it('fails closed for a missing module row and preserves a separately granted TIM projection', () => {
    const snapshots = resolveLegacy(
      overview(),
      context({
        entitlements: SELF_GRANTS.filter(
          (permission) =>
            permission.resourceKey !== 'DATA.HR_ABSENCE' && permission.resourceKey !== 'DATA.HR_PAY'
        ),
      })
    );

    expect(snapshot(snapshots, 'tim-self-time').state).toBe('AVAILABLE');
    expect(snapshot(snapshots, 'tim-self-absence')).toMatchObject({
      state: 'CONFIGURATION_REQUIRED',
      reasonCode: 'ENTITLEMENT_CONFIGURATION_REQUIRED',
      payload: null,
      deepLink: null,
    });
    expect(snapshot(snapshots, 'pay-self-cycle')).toMatchObject({
      state: 'CONFIGURATION_REQUIRED',
      payload: null,
      primaryAction: null,
      deepLink: null,
    });
  });

  it('fails closed when the aggregate compatibility source authority is absent', () => {
    const snapshots = resolveLegacy(overview(), context({ dataAuthorities: [] }));
    expect(snapshot(snapshots, 'tim-self-time')).toMatchObject({
      state: 'CONFIGURATION_REQUIRED',
      reasonCode: 'SOURCE_AUTHORITY_CONFIGURATION_REQUIRED',
      payload: null,
      deepLink: null,
    });
  });

  it('enforces audience and scope before projecting manager data', () => {
    const employeeAudience = resolveLegacy(
      overview(),
      context({
        scope: { kind: 'TEAM', key: 'current-reporting-line' },
        entitlements: MANAGER_GRANTS,
      })
    );
    expect(snapshot(employeeAudience, 'tim-team-time-decisions')).toMatchObject({
      state: 'FORBIDDEN',
      reasonCode: 'AUDIENCE_DENIED',
      payload: null,
    });

    const selfScope = resolveLegacy(
      overview(),
      context({ audiences: ['MANAGER'], entitlements: MANAGER_GRANTS })
    );
    expect(snapshot(selfScope, 'tim-team-time-decisions')).toMatchObject({
      state: 'FORBIDDEN',
      reasonCode: 'SCOPE_DENIED',
      payload: null,
    });
  });

  it('does not turn synthetic legacy team zeroes into authoritative empty states', () => {
    const partialOverview = overview();
    partialOverview.teamTimePendingCount = null;
    const managerSnapshots = resolveLegacy(
      partialOverview,
      context({
        audiences: ['MANAGER'],
        scope: { kind: 'TEAM', key: 'current-reporting-line' },
        entitlements: MANAGER_GRANTS,
      })
    );
    expect(snapshot(managerSnapshots, 'hrm-team-shape')).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'HRM_TEAM_OWNER_API_REQUIRED',
      payload: null,
      primaryAction: null,
      deepLink: null,
    });
    expect(snapshot(managerSnapshots, 'tim-team-time-decisions')).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'TIM_TEAM_TIME_OWNER_API_REQUIRED',
      payload: null,
      primaryAction: null,
      deepLink: null,
    });
    expect(snapshot(managerSnapshots, 'tim-team-absence-decisions')).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'TIM_TEAM_ABSENCE_OWNER_API_REQUIRED',
      payload: null,
      primaryAction: null,
      deepLink: null,
    });

    const missingDomainState = overview();
    delete missingDomainState.domainStates.PAY;
    const missingStateSnapshots = resolveLegacy(missingDomainState, context());
    expect(snapshot(missingStateSnapshots, 'pay-self-cycle')).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'SOURCE_UNAVAILABLE',
      payload: null,
      primaryAction: null,
      deepLink: null,
    });

    const unavailableSnapshots = resolveLegacy(
      overview({
        TIME: {
          availability: 'UNAVAILABLE',
          dataOrigin: 'NONE',
          reasonCode: 'TIME_SOURCE_DOWN',
        },
      }),
      context()
    );
    expect(snapshot(unavailableSnapshots, 'tim-self-time')).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'TIME_SOURCE_DOWN',
      payload: null,
      primaryAction: null,
      deepLink: null,
    });
    expect(snapshot(unavailableSnapshots, 'tim-self-absence').state).toBe('AVAILABLE');
  });

  it('isolates a malformed legacy domain projection to its own widget', () => {
    const malformed = { ...overview(), leaveBalances: null };
    const contribution = HRIS_HOME_LEGACY_AGGREGATE_SOURCE.resolve(malformed, context());

    expect(snapshot(contribution.snapshots, 'tim-self-absence')).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'TIM_SELF_ABSENCE_PROJECTION_FAILED',
      payload: null,
      deepLink: null,
    });
    expect(snapshot(contribution.snapshots, 'tim-self-time').state).toBe('AVAILABLE');
    expect(snapshot(contribution.snapshots, 'pay-self-cycle').state).toBe('AVAILABLE');
  });

  it('isolates hostile object, non-finite and invalid-date values by widget', () => {
    const malformedEmployee = overview() as unknown as Record<string, unknown>;
    (malformedEmployee.employee as Record<string, unknown>).displayName = {};
    const employeeContribution = HRIS_HOME_LEGACY_AGGREGATE_SOURCE.resolve(
      malformedEmployee,
      context()
    );
    expect(snapshot(employeeContribution.snapshots, 'hrm-self-employment')).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'HRM_SELF_EMPLOYMENT_PROJECTION_FAILED',
      payload: null,
    });
    expect(snapshot(employeeContribution.snapshots, 'tim-self-time').state).toBe('AVAILABLE');

    const malformedTime = overview() as unknown as Record<string, unknown>;
    (malformedTime.time as Record<string, unknown>).exceptionCount = Number.NaN;
    const timeContribution = HRIS_HOME_LEGACY_AGGREGATE_SOURCE.resolve(malformedTime, context());
    expect(snapshot(timeContribution.snapshots, 'tim-self-time')).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'TIM_SELF_TIME_PROJECTION_FAILED',
      payload: null,
    });
    expect(snapshot(timeContribution.snapshots, 'tim-self-absence').state).toBe('AVAILABLE');

    const malformedPay = overview() as unknown as Record<string, unknown>;
    (malformedPay.pay as Record<string, unknown>).payDate = 'September someday';
    const payContribution = HRIS_HOME_LEGACY_AGGREGATE_SOURCE.resolve(malformedPay, context());
    expect(snapshot(payContribution.snapshots, 'pay-self-cycle')).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'PAY_SELF_CYCLE_PROJECTION_FAILED',
      payload: null,
    });
    expect(snapshot(payContribution.snapshots, 'per-self-performance').state).toBe('AVAILABLE');

    const malformedJourney = overview() as unknown as Record<string, unknown>;
    ((malformedJourney.journeys as unknown[])[0] as Record<string, unknown>).targetDate =
      '2026-13-99';
    const journeyContribution = HRIS_HOME_LEGACY_AGGREGATE_SOURCE.resolve(
      malformedJourney,
      context()
    );
    expect(snapshot(journeyContribution.snapshots, 'per-self-performance')).toMatchObject({
      state: 'UNAVAILABLE',
      reasonCode: 'PER_SELF_PERFORMANCE_PROJECTION_FAILED',
      payload: null,
    });
    expect(snapshot(journeyContribution.snapshots, 'pay-self-cycle').state).toBe('AVAILABLE');
  });

  it('lets an independent MODULE_API contribution replace only its legacy widget', () => {
    const providerContext = context({
      dataAuthorities: ['LEGACY_AGGREGATE_COMPATIBILITY', 'MODULE_API'],
    });
    const legacy = HRIS_HOME_LEGACY_AGGREGATE_ADAPTER.resolve(overview(), providerContext);
    const legacyPay = snapshot(legacy.snapshots, 'pay-self-cycle');
    const modulePay = {
      ...legacyPay,
      dataAuthority: 'MODULE_API' as const,
      reasonCode: 'PAY_OWNER_API',
      payload: {
        payDate: '2026-09-30',
        status: 'READY',
        timeValidated: true,
        absenceValidated: true,
        sourceConfirmed: true,
      },
    };
    const registry = createHrisHomeModuleProviderRegistry([
      HRIS_HOME_LEGACY_AGGREGATE_SOURCE,
      modulePaySource(legacyPay),
    ]);
    const composition = registry.compose(
      [
        legacy,
        {
          sourceId: 'pay-owner-api',
          dataAuthority: 'MODULE_API',
          snapshots: [modulePay],
          metadata: null,
        },
      ],
      providerContext
    );

    expect(snapshot(composition.snapshots, 'pay-self-cycle')).toMatchObject({
      dataAuthority: 'MODULE_API',
      reasonCode: 'PAY_OWNER_API',
    });
    expect(snapshot(composition.snapshots, 'tim-self-time').dataAuthority).toBe(
      'LEGACY_AGGREGATE_COMPATIBILITY'
    );
  });

  it('binds source cache identity to scope, as-of, subject, authority and purpose', () => {
    const selfKey = HRIS_HOME_LEGACY_AGGREGATE_SOURCE.queryKey(context());
    const teamKey = HRIS_HOME_LEGACY_AGGREGATE_SOURCE.queryKey(
      context({
        scope: { kind: 'TEAM', key: 'team-alpha' },
        subjectCacheKey: 'manager-2',
        authorityCacheKey: 'authority-2',
        asOf: '2026-09-18',
      })
    );

    expect(selfKey).toContain('HRIS_HOME');
    expect(selfKey).toContain('2026-09-17');
    expect(teamKey).toContain('TEAM');
    expect(teamKey).toContain('team-alpha');
    expect(teamKey).toContain('manager-2');
    expect(teamKey).toContain('authority-2');
    expect(teamKey).toContain('2026-09-18');
    expect(teamKey).not.toEqual(selfKey);
  });

  it('fails closed when a contributed snapshot omits safety policy metadata', () => {
    const providerContext = context({ dataAuthorities: ['MODULE_API'] });
    const legacy = HRIS_HOME_LEGACY_AGGREGATE_ADAPTER.resolve(overview(), context());
    const legacyPay = snapshot(legacy.snapshots, 'pay-self-cycle');
    const unsafePay = {
      ...legacyPay,
      dataAuthority: 'MODULE_API' as const,
      policyRevision: '',
      payload: { unsafe: 'DO_NOT_RENDER' },
      deepLink: '/hr/pay',
      primaryAction: { actionId: 'UNSAFE', labelKey: 'unsafe' },
    };
    const registry = createHrisHomeModuleProviderRegistry([modulePaySource(legacyPay)]);
    const composition = registry.compose(
      [
        {
          sourceId: 'pay-owner-api',
          dataAuthority: 'MODULE_API',
          snapshots: [unsafePay],
          metadata: null,
        },
      ],
      providerContext
    );

    expect(snapshot(composition.snapshots, 'pay-self-cycle')).toMatchObject({
      state: 'CONFIGURATION_REQUIRED',
      reasonCode: 'PROVIDER_SAFETY_METADATA_REQUIRED',
      payload: null,
      primaryAction: null,
      deepLink: null,
    });
  });

  it('treats registered widget contracts as immutable and rejects same-widget metadata forgery', () => {
    const providerContext = context({ dataAuthorities: ['MODULE_API'] });
    const legacy = HRIS_HOME_LEGACY_AGGREGATE_ADAPTER.resolve(overview(), context());
    const legacyPay = snapshot(legacy.snapshots, 'pay-self-cycle');
    const source = modulePaySource(legacyPay);
    const registry = createHrisHomeModuleProviderRegistry([source]);
    const registeredContract = registry.sources[0]!.widgetContracts[0]!;
    expect(registeredContract).not.toBe(source.widgetContracts[0]);
    expect(Object.isFrozen(registeredContract)).toBe(true);
    expect(Object.isFrozen(registeredContract.audience)).toBe(true);
    expect(Object.isFrozen(registeredContract.requiredEntitlements)).toBe(true);
    expect(Object.isFrozen(registeredContract.sensitivity.exposedFields)).toBe(true);
    expect(Object.isFrozen(registeredContract.payloadDescriptor)).toBe(true);
    expect(Object.isFrozen(registeredContract.payloadDescriptor.fields)).toBe(true);

    const base = modulePaySnapshot(legacyPay, providerContext);
    const forgeries: readonly Partial<HrisHomeWidgetSnapshot>[] = [
      { audience: ['AUDITOR'] },
      { requiredEntitlements: [] },
      { primaryAction: { actionId: 'FORGED_ACTION', labelKey: 'forged.action' } },
      { deepLink: '/hr/forged' },
      {
        sensitivity: {
          ...base.sensitivity,
          classification: 'INTERNAL',
          exposedFields: ['status', 'bankAccount'],
        },
      },
      { policyRevision: 'forged-policy-v999' },
      {
        freshness: {
          ...base.freshness,
          maxAgeSeconds: base.freshness.maxAgeSeconds + 1,
        },
      },
    ];

    for (const forgery of forgeries) {
      const composition = registry.compose(
        [
          {
            sourceId: source.sourceId,
            dataAuthority: source.dataAuthority,
            snapshots: [{ ...base, ...forgery }],
            metadata: null,
          },
        ],
        providerContext
      );
      expect(snapshot(composition.snapshots, 'pay-self-cycle')).toMatchObject({
        state: 'CONFIGURATION_REQUIRED',
        reasonCode: 'SOURCE_WIDGET_CONTRACT_MISMATCH',
        payload: null,
        primaryAction: null,
        deepLink: null,
      });
    }
  });

  it('re-evaluates the registered entitlement contract against the current context', () => {
    const authorizedContext = context({ dataAuthorities: ['MODULE_API'] });
    const missingPayGrant = context({
      dataAuthorities: ['MODULE_API'],
      entitlements: [allow('APP.HRIS', 'VIEW')],
    });
    const legacy = HRIS_HOME_LEGACY_AGGREGATE_ADAPTER.resolve(overview(), context());
    const legacyPay = snapshot(legacy.snapshots, 'pay-self-cycle');
    const source = modulePaySource(legacyPay);
    const registry = createHrisHomeModuleProviderRegistry([source]);
    const contribution = {
      sourceId: source.sourceId,
      dataAuthority: source.dataAuthority,
      snapshots: [modulePaySnapshot(legacyPay, authorizedContext)],
      metadata: null,
    };

    expect(
      snapshot(registry.compose([contribution], missingPayGrant).snapshots, 'pay-self-cycle')
    ).toMatchObject({
      state: 'CONFIGURATION_REQUIRED',
      reasonCode: 'ENTITLEMENT_CONFIGURATION_REQUIRED',
      payload: null,
      primaryAction: null,
      deepLink: null,
    });

    const deniedPayGrant = context({
      dataAuthorities: ['MODULE_API'],
      entitlements: [
        allow('APP.HRIS', 'VIEW'),
        {
          resourceType: 'DATA',
          resourceKey: 'DATA.HR_PAY',
          permissionCode: 'VIEW',
          effect: 'DENY',
        },
      ],
    });
    expect(
      snapshot(registry.compose([contribution], deniedPayGrant).snapshots, 'pay-self-cycle')
    ).toMatchObject({
      state: 'FORBIDDEN',
      reasonCode: 'ENTITLEMENT_DENIED',
      payload: null,
      primaryAction: null,
      deepLink: null,
    });
  });

  it('builds missing-source fallback centrally without trusting a source callback', () => {
    const providerContext = context({ dataAuthorities: ['MODULE_API'] });
    const legacy = HRIS_HOME_LEGACY_AGGREGATE_ADAPTER.resolve(overview(), context());
    const legacyPay = snapshot(legacy.snapshots, 'pay-self-cycle');
    let unavailableCallbackCalls = 0;
    const source: HrisHomeProviderSource = {
      ...modulePaySource(legacyPay),
      unavailable: () => {
        unavailableCallbackCalls += 1;
        throw new Error('Untrusted source fallback must not run during composition');
      },
    };
    const composition = createHrisHomeModuleProviderRegistry([source]).compose([], providerContext);

    expect(unavailableCallbackCalls).toBe(0);
    expect(snapshot(composition.snapshots, 'pay-self-cycle')).toMatchObject({
      dataAuthority: 'MODULE_API',
      state: 'UNAVAILABLE',
      reasonCode: 'SOURCE_CONTRIBUTION_MISSING',
      payload: null,
      primaryAction: null,
      deepLink: null,
      traceId: providerContext.traceId,
    });
  });

  it('rejects permissive or context-mismatched as-of and generated-at values', () => {
    const providerContext = context({ dataAuthorities: ['MODULE_API'] });
    const legacy = HRIS_HOME_LEGACY_AGGREGATE_ADAPTER.resolve(overview(), context());
    const legacyPay = snapshot(legacy.snapshots, 'pay-self-cycle');
    const source = modulePaySource(legacyPay);
    const registry = createHrisHomeModuleProviderRegistry([source]);
    const base = modulePaySnapshot(legacyPay, providerContext);

    for (const metadata of [
      {
        asOf: '2026-09-18',
        generatedAt: '2026-09-17T01:00:00.000Z',
        referenceDataPresent: true,
      },
      {
        asOf: '2026-09-17',
        generatedAt: '2026-09-17 01:00:00',
        referenceDataPresent: true,
      },
      {
        asOf: '2026-02-30',
        generatedAt: '2026-02-30T01:00:00.000Z',
        referenceDataPresent: true,
      },
    ]) {
      const composition = registry.compose(
        [
          {
            sourceId: source.sourceId,
            dataAuthority: source.dataAuthority,
            snapshots: [base],
            metadata,
          },
        ],
        providerContext
      );
      expect(snapshot(composition.snapshots, 'pay-self-cycle')).toMatchObject({
        state: 'UNAVAILABLE',
        reasonCode: 'SOURCE_CONTRIBUTION_TEMPORAL_INVALID',
        payload: null,
        deepLink: null,
      });
    }

    const invalidFreshness = registry.compose(
      [
        {
          sourceId: source.sourceId,
          dataAuthority: source.dataAuthority,
          snapshots: [
            {
              ...base,
              freshness: { ...base.freshness, generatedAt: '09/17/2026 01:00' },
            },
          ],
          metadata: null,
        },
      ],
      providerContext
    );
    expect(snapshot(invalidFreshness.snapshots, 'pay-self-cycle')).toMatchObject({
      state: 'CONFIGURATION_REQUIRED',
      reasonCode: 'SOURCE_WIDGET_CONTRACT_MISMATCH',
      payload: null,
      deepLink: null,
    });
  });

  it('rejects cross-widget source injection without replacing an authorized legacy widget', () => {
    const providerContext = context({
      dataAuthorities: ['LEGACY_AGGREGATE_COMPATIBILITY', 'MODULE_API'],
    });
    const legacy = HRIS_HOME_LEGACY_AGGREGATE_ADAPTER.resolve(overview(), providerContext);
    const legacyPay = snapshot(legacy.snapshots, 'pay-self-cycle');
    const injectedTime = {
      ...snapshot(legacy.snapshots, 'tim-self-time'),
      dataAuthority: 'MODULE_API' as const,
      payload: { status: 'MALICIOUS_OVERRIDE' },
      deepLink: '/hr/malicious',
    };
    const registry = createHrisHomeModuleProviderRegistry([
      HRIS_HOME_LEGACY_AGGREGATE_SOURCE,
      modulePaySource(legacyPay),
    ]);

    const composition = registry.compose(
      [
        legacy,
        {
          sourceId: 'pay-owner-api',
          dataAuthority: 'MODULE_API',
          snapshots: [injectedTime],
          metadata: null,
        },
        {
          sourceId: 'unregistered-source',
          dataAuthority: 'MODULE_API',
          snapshots: [injectedTime],
          metadata: null,
        },
      ],
      providerContext
    );

    expect(snapshot(composition.snapshots, 'tim-self-time')).toMatchObject({
      dataAuthority: 'LEGACY_AGGREGATE_COMPATIBILITY',
      deepLink: '/hr/time',
    });
    expect(JSON.stringify(snapshot(composition.snapshots, 'tim-self-time').payload)).not.toContain(
      'MALICIOUS_OVERRIDE'
    );
    expect(snapshot(composition.snapshots, 'pay-self-cycle')).toMatchObject({
      dataAuthority: 'MODULE_API',
      state: 'UNAVAILABLE',
      reasonCode: 'SOURCE_CONTRIBUTION_PROVENANCE_INVALID',
      payload: null,
      deepLink: null,
    });
  });

  it('promotes available data to STALE without dropping traceability', () => {
    const snapshots = resolveLegacy(
      overview(),
      context({ now: '2026-09-17T03:00:00.000Z', traceId: 'trace-stale' })
    );
    expect(snapshot(snapshots, 'tim-self-time')).toMatchObject({
      state: 'STALE',
      freshness: { state: 'STALE' },
      traceId: 'trace-stale',
    });
  });

  it('projects only the declared fields for every actionable provider', () => {
    const selfSnapshots = resolveLegacy(overview(), context());
    const managerSnapshots = resolveLegacy(
      overview(),
      context({
        audiences: ['MANAGER'],
        scope: { kind: 'TEAM', key: 'current-reporting-line' },
        entitlements: MANAGER_GRANTS,
      })
    );
    const actionable = [...selfSnapshots, ...managerSnapshots].filter(
      (value) => value.payload !== null
    );
    for (const value of actionable) {
      expect(Object.keys(value.payload as Record<string, unknown>).sort()).toEqual(
        [...value.sensitivity.exposedFields].sort()
      );
    }

    const pay = snapshot(selfSnapshots, 'pay-self-cycle');
    const performance = snapshot(selfSnapshots, 'per-self-performance');
    expect(pay.sensitivity.projection).toBe('MASK');
    expect(Object.keys(pay.payload as Record<string, unknown>).sort()).toEqual(
      [...pay.sensitivity.exposedFields].sort()
    );
    expect(JSON.stringify(pay.payload)).not.toContain('Do not project this name');
    expect(performance.sensitivity.projection).toBe('OMIT');
    expect(Object.keys(performance.payload as Record<string, unknown>).sort()).toEqual(
      [...performance.sensitivity.exposedFields].sort()
    );
    expect(JSON.stringify(performance.payload)).not.toContain('journey name');
  });

  it('isolates legacy entitlement fallback behind an explicit provider authority', () => {
    const strictProvider = HRIS_HOME_LEGACY_AGGREGATE_ADAPTER.providers[0]!;
    const compatibilityProvider: HrisHomeWidgetProvider<HrHomeOverview> = {
      ...strictProvider,
      entitlementMode: 'LEGACY_SURFACE_COMPATIBILITY',
      legacyCompatibilityAuthority: 'LEGACY_HCM_SURFACE',
    };
    const missingRows = context({ entitlements: [] });
    expect(evaluateHrisHomeProviderEntitlement(strictProvider, missingRows)).toBe('MISSING');
    expect(evaluateHrisHomeProviderEntitlement(compatibilityProvider, missingRows)).toBe('MISSING');
    expect(
      evaluateHrisHomeProviderEntitlement(
        compatibilityProvider,
        context({
          entitlements: [],
          legacyCompatibilityAuthorities: ['LEGACY_HCM_SURFACE'],
        })
      )
    ).toBe('ALLOWED');

    const deniedWithFallback = resolveHrisHomeWidgetProvider(
      compatibilityProvider,
      {
        data: overview(),
        generatedAt: '2026-09-17T01:00:00.000Z',
      },
      context({
        entitlements: [
          allow('APP.HRIS', 'VIEW'),
          {
            resourceType: 'DATA',
            resourceKey: 'DATA.WORKFORCE',
            permissionCode: 'VIEW',
            effect: 'DENY',
          },
        ],
        legacyCompatibilityAuthorities: ['LEGACY_HCM_SURFACE'],
      })
    );
    expect(deniedWithFallback).toMatchObject({
      state: 'FORBIDDEN',
      reasonCode: 'ENTITLEMENT_DENIED',
      payload: null,
      deepLink: null,
    });
  });
});
