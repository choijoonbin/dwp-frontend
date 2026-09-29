import { describe, expect, it } from 'vitest';

import { buildHcmHomeViewModel } from './hcm-home-view-model';

import type {
  HcmHomeProviderPayloadMap,
  HcmHomeProviderSnapshot,
  HcmHomeProviderState,
  HcmHomeProviderWidgetId,
} from './hcm-home-provider-adapter';

const payloads: { [K in HcmHomeProviderWidgetId]: HcmHomeProviderPayloadMap[K] } = {
  'hrm-self-employment': {
    displayName: 'Fixture Employee',
    businessTitle: 'Specialist',
    organizationName: 'People',
    managerDisplayName: 'Fixture Manager',
  },
  'hrm-team-shape': { directReportCount: 3 },
  'tim-self-time': {
    periodStart: '2026-09-14',
    periodEnd: '2026-09-20',
    status: 'OPEN',
    recordedMinutes: 1_800,
    scheduledMinutes: 2_400,
    exceptionCount: 0,
  },
  'tim-self-absence': {
    leavePlanCount: 2,
    standardDayMinutes: 480,
    displayBalance: {
      grantedMinutes: 960,
      usedMinutes: 0,
      pendingMinutes: 0,
      availableMinutes: 960,
    },
  },
  'tim-team-time-decisions': { timePendingCount: 2 },
  'tim-team-absence-decisions': { absencePendingCount: 1 },
  'pay-self-cycle': {
    payDate: '2026-09-25',
    status: 'OPEN',
    timeValidated: true,
    absenceValidated: true,
    sourceConfirmed: true,
  },
  'per-self-performance': {
    activeGoalCount: 2,
    requiredLearningCount: 1,
    activeJourneyCount: 1,
    nearestTargetDate: '2026-09-30',
    activeJourneyProgressPercent: 40,
  },
};

function provider<TWidgetId extends HcmHomeProviderWidgetId>(
  widgetId: TWidgetId,
  deepLink: string,
  state: HcmHomeProviderState = 'AVAILABLE',
  payload: HcmHomeProviderPayloadMap[TWidgetId] = payloads[widgetId]
): HcmHomeProviderSnapshot {
  const actionable = ['AVAILABLE', 'EMPTY', 'STALE', 'PARTIAL'].includes(state);
  const teamScoped = widgetId === 'hrm-team-shape' || widgetId.startsWith('tim-team-');
  return {
    contractVersion: 1,
    widgetId,
    sourceModule: widgetId.startsWith('hrm')
      ? 'HRM'
      : widgetId.startsWith('pay')
        ? 'PAY'
        : widgetId.startsWith('per')
          ? 'PER'
          : 'TIM',
    dataAuthority: 'LEGACY_AGGREGATE_COMPATIBILITY',
    audience: teamScoped ? ['MANAGER'] : ['EMPLOYEE'],
    requiredEntitlements: [],
    scope: teamScoped
      ? { kind: 'TEAM', key: 'current-reporting-line' }
      : { kind: 'SELF', key: 'current-person' },
    horizon: widgetId.startsWith('hrm') ? 'CHANGED' : widgetId.startsWith('tim') ? 'NOW' : 'NEXT',
    priority: 'LOW',
    freshness: {
      generatedAt: '2026-09-17T01:00:00Z',
      maxAgeSeconds: 300,
      state: 'FRESH',
    },
    sensitivity: {
      classification: 'CONFIDENTIAL',
      projection: 'VIEW',
      exposedFields: Object.keys(payload),
    },
    purpose: 'HRIS_HOME',
    policyRevision: 'test-policy-v1',
    state,
    reasonCode: actionable ? null : 'TEST_NON_ACTIONABLE',
    // Keep payload present for negative states so the consumer's state check is exercised.
    payload,
    primaryAction: actionable ? { actionId: `OPEN_${widgetId}`, labelKey: 'open' } : null,
    deepLink: actionable ? deepLink : null,
    traceId: 'trace-view-model',
  };
}

const selfProviders = () => [
  provider('hrm-self-employment', '/hr/me'),
  provider('tim-self-time', '/hr/time'),
  provider('tim-self-absence', '/hr/absence'),
  provider('pay-self-cycle', '/hr/pay'),
  provider('per-self-performance', '/hr/talent'),
];

const metadata = { asOf: '2026-09-17', generatedAt: '2026-09-17T01:00:00Z' };
const translate = (key: string) => key;

describe('HCM home view model provider consumption', () => {
  it('uses only projected leave fields and suppresses the out-of-scope benefits flow', () => {
    const view = buildHcmHomeViewModel({
      aggregateMetadata: metadata,
      homeMode: 'personal',
      providerSnapshots: selfProviders(),
      identity: {},
      employeeServicesDisclosed: false,
      t: translate,
    });

    expect(view.availableLeaveDays).toBe(2);
    expect(view.primaryLeaveBalance).toEqual(payloads['tim-self-absence'].displayBalance);
    expect(view.tools.map((tool) => tool.route)).toContain('/hr/absence?request=open');
    expect(view.tools.some((tool) => tool.route.includes('benefit'))).toBe(false);
    expect(view.attentionSignals.some((signal) => signal.id === 'benefit-window')).toBe(false);
  });

  it('removes the absence action when its provider is not configured without hiding time', () => {
    const snapshots = selfProviders().map((snapshot) =>
      snapshot.widgetId === 'tim-self-absence'
        ? provider('tim-self-absence', '/hr/absence', 'CONFIGURATION_REQUIRED')
        : snapshot
    );
    const view = buildHcmHomeViewModel({
      aggregateMetadata: metadata,
      homeMode: 'personal',
      providerSnapshots: snapshots,
      identity: {},
      employeeServicesDisclosed: false,
      t: translate,
    });

    expect(view.tools.some((tool) => tool.id === 'leave')).toBe(false);
    expect(view.tools.find((tool) => tool.id === 'time')?.route).toBe('/hr/time');
    expect(view.domainAvailable('ABSENCE')).toBe(false);
    expect(view.domainAvailable('TIME')).toBe(true);
    expect(view.primaryLeaveBalance).toBeNull();
  });

  it('keeps partial and stale provider results visibly degraded even when payload exists', () => {
    const snapshots = selfProviders().map((snapshot) => {
      if (snapshot.widgetId === 'pay-self-cycle') {
        return provider('pay-self-cycle', '/hr/pay', 'PARTIAL');
      }
      if (snapshot.widgetId === 'tim-self-time') {
        return {
          ...snapshot,
          freshness: { ...snapshot.freshness, state: 'STALE' as const },
        };
      }
      return snapshot;
    });
    const view = buildHcmHomeViewModel({
      aggregateMetadata: metadata,
      homeMode: 'personal',
      providerSnapshots: snapshots,
      identity: {},
      employeeServicesDisclosed: false,
      t: translate,
    });

    expect(view.hasPayCycle).toBe(true);
    expect(view.currentTime).not.toBeNull();
    expect(view.attentionUnavailable).toBe(true);
  });

  it('does not project malicious payloads from forbidden or unconfigured snapshots', () => {
    const snapshots = [
      provider('hrm-self-employment', '/hr/me', 'FORBIDDEN', {
        ...payloads['hrm-self-employment'],
        displayName: 'DO_NOT_RENDER_HRM',
        managerDisplayName: 'DO_NOT_RENDER_MANAGER',
      }),
      provider('tim-self-time', '/hr/time', 'CONFIGURATION_REQUIRED', {
        ...payloads['tim-self-time'],
        recordedMinutes: 999_999,
      }),
      provider('tim-self-absence', '/hr/absence', 'FORBIDDEN', {
        ...payloads['tim-self-absence'],
        displayBalance: {
          grantedMinutes: 999_999,
          usedMinutes: 999_999,
          pendingMinutes: 999_999,
          availableMinutes: 999_999,
        },
      }),
      provider('pay-self-cycle', '/hr/pay', 'CONFIGURATION_REQUIRED'),
      provider('per-self-performance', '/hr/talent', 'FORBIDDEN', {
        ...payloads['per-self-performance'],
        activeJourneyProgressPercent: 99,
      }),
    ];
    const view = buildHcmHomeViewModel({
      aggregateMetadata: metadata,
      homeMode: 'personal',
      providerSnapshots: snapshots,
      identity: { displayName: 'Safe auth identity' },
      employeeServicesDisclosed: false,
      t: translate,
    });

    expect(view.selfDisplayName).toBe('Safe auth identity');
    expect(view.managerDisplayName).toBeNull();
    expect(view.currentTime).toBeNull();
    expect(view.primaryLeaveBalance).toBeNull();
    expect(view.hasPayCycle).toBe(false);
    expect(view.activeJourneyProgressPercent).toBeNull();
    expect(JSON.stringify(view)).not.toContain('DO_NOT_RENDER');
  });

  it('does not project team shape or routes from a forbidden team provider', () => {
    const view = buildHcmHomeViewModel({
      aggregateMetadata: metadata,
      homeMode: 'team',
      providerSnapshots: [
        provider('hrm-team-shape', '/hr/team', 'FORBIDDEN', { directReportCount: 999 }),
        provider('tim-team-time-decisions', '/hr/team/time'),
        provider('tim-team-absence-decisions', '/hr/team/absence'),
      ],
      identity: {},
      employeeServicesDisclosed: false,
      t: translate,
    });

    expect(view.directReportCount).toBeNull();
    expect(view.tools.some((tool) => tool.id === 'team')).toBe(false);
  });
});
