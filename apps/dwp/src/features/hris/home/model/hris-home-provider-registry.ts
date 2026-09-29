import {
  createHrisHomeModuleProviderRegistry,
  resolveHrisHomeWidgetProvider,
  type HrisHomeEntitlementRequirement,
  type HrisHomeModuleProviderRegistry,
  type HrisHomePayloadFieldDescriptor,
  type HrisHomePayloadObjectDescriptor,
  type HrisHomeProviderContext,
  type HrisHomeProviderResolution,
  type HrisHomeProviderSource,
  type HrisHomeSnapshotContribution,
  type HrisHomeWidgetProvider,
} from './hris-home-provider-contract';

import { getHrHome } from '@dwp-frontend/shared-utils';

import type { HrHomeDomain, HrHomeOverview } from '@dwp-frontend/shared-utils';

type HrmSelfPayload = Readonly<{
  displayName: string;
  businessTitle: string | null;
  organizationName: string | null;
  managerDisplayName: string | null;
}>;

type HrmTeamPayload = Readonly<{ directReportCount: number }>;

type TimSelfTimePayload = Readonly<{
  periodStart: string | null;
  periodEnd: string | null;
  status: string | null;
  recordedMinutes: number | null;
  scheduledMinutes: number | null;
  exceptionCount: number;
}>;

type TimSelfAbsencePayload = Readonly<{
  leavePlanCount: number;
  standardDayMinutes: number | null;
  displayBalance: Readonly<{
    grantedMinutes: number;
    usedMinutes: number;
    pendingMinutes: number;
    availableMinutes: number;
  }> | null;
}>;

type TimTeamTimePayload = Readonly<{ timePendingCount: number | null }>;
type TimTeamAbsencePayload = Readonly<{ absencePendingCount: number | null }>;

type PaySelfPayload = Readonly<{
  payDate: string | null;
  status: string | null;
  timeValidated: boolean | null;
  absenceValidated: boolean | null;
  sourceConfirmed: boolean | null;
}>;

type PerSelfPayload = Readonly<{
  activeGoalCount: number;
  requiredLearningCount: number;
  activeJourneyCount: number;
  nearestTargetDate: string | null;
  activeJourneyProgressPercent: number | null;
}>;

const requirement = (
  resourceKey: string,
  permissionCodes: readonly string[]
): HrisHomeEntitlementRequirement =>
  Object.freeze({
    resourceType: resourceKey.startsWith('APP.') ? 'APP' : 'DATA',
    resourceKey,
    permissionCodes: Object.freeze([...permissionCodes]),
    match: 'ANY' as const,
  });

const APP_HRIS_VIEW = requirement('APP.HRIS', ['VIEW', 'USE', 'LAUNCH', 'MANAGE']);
const moduleEntitlements = (
  ...requirements: readonly HrisHomeEntitlementRequirement[]
): readonly HrisHomeEntitlementRequirement[] => Object.freeze([APP_HRIS_VIEW, ...requirements]);

const HRM_SELF_VIEW = moduleEntitlements(requirement('DATA.WORKFORCE', ['VIEW', 'MANAGE']));
const HRM_TEAM_VIEW = moduleEntitlements(requirement('DATA.WORKFORCE', ['VIEW', 'MANAGE']));
const TIM_SELF_TIME_VIEW = moduleEntitlements(requirement('DATA.HR_TIME', ['VIEW', 'MANAGE']));
const TIM_SELF_ABSENCE_VIEW = moduleEntitlements(
  requirement('DATA.HR_ABSENCE', ['VIEW', 'MANAGE'])
);
const TIM_TEAM_TIME_APPROVE = moduleEntitlements(
  requirement('DATA.HR_TIME', ['APPROVE', 'MANAGE'])
);
const TIM_TEAM_ABSENCE_APPROVE = moduleEntitlements(
  requirement('DATA.HR_ABSENCE', ['APPROVE', 'MANAGE'])
);
const PAY_SELF_VIEW = moduleEntitlements(requirement('DATA.HR_PAY', ['VIEW', 'MANAGE']));
const PER_SELF_VIEW = moduleEntitlements(requirement('DATA.HR_TALENT', ['VIEW', 'MANAGE']));

const SELF_AUDIENCE = Object.freeze([
  'EMPLOYEE',
  'MANAGER',
  'OPERATOR',
  'SETTINGS_ADMIN',
  'AUDITOR',
] as const);
const MANAGER_AUDIENCE = Object.freeze(['MANAGER'] as const);
const LEGACY_AGGREGATE = 'LEGACY_AGGREGATE_COMPATIBILITY' as const;
const LEGACY_HOME_SAFETY = Object.freeze({
  contractVersion: 1 as const,
  purpose: 'HRIS_HOME' as const,
  policyRevision: 'legacy-home-projection-v1',
});

const payloadString = (nullable: boolean, nonBlank = false): HrisHomePayloadFieldDescriptor =>
  Object.freeze({ type: 'STRING', nullable, nonBlank });
const payloadDate = (nullable: boolean): HrisHomePayloadFieldDescriptor =>
  Object.freeze({ type: 'DATE_KEY', nullable });
const payloadBoolean = (nullable: boolean): HrisHomePayloadFieldDescriptor =>
  Object.freeze({ type: 'BOOLEAN', nullable });
const payloadNumber = ({
  nullable,
  integer = false,
  minimum = null,
  maximum = null,
}: {
  nullable: boolean;
  integer?: boolean;
  minimum?: number | null;
  maximum?: number | null;
}): HrisHomePayloadFieldDescriptor =>
  Object.freeze({ type: 'NUMBER', nullable, integer, minimum, maximum });
const payloadObject = (
  fields: Readonly<Record<string, HrisHomePayloadFieldDescriptor>>,
  nullable = false
): HrisHomePayloadObjectDescriptor =>
  Object.freeze({ type: 'OBJECT', nullable, fields: Object.freeze({ ...fields }) });

const PAYLOAD_DESCRIPTORS = Object.freeze({
  hrmSelfEmployment: payloadObject({
    displayName: payloadString(false, true),
    businessTitle: payloadString(true),
    organizationName: payloadString(true),
    managerDisplayName: payloadString(true),
  }),
  hrmTeamShape: payloadObject({
    directReportCount: payloadNumber({ nullable: false, integer: true, minimum: 0 }),
  }),
  timSelfTime: payloadObject({
    periodStart: payloadDate(true),
    periodEnd: payloadDate(true),
    status: payloadString(true, true),
    recordedMinutes: payloadNumber({ nullable: true, minimum: 0 }),
    scheduledMinutes: payloadNumber({ nullable: true, minimum: 0 }),
    exceptionCount: payloadNumber({ nullable: false, integer: true, minimum: 0 }),
  }),
  timSelfAbsence: payloadObject({
    leavePlanCount: payloadNumber({ nullable: false, integer: true, minimum: 0 }),
    standardDayMinutes: payloadNumber({ nullable: true, minimum: Number.MIN_VALUE }),
    displayBalance: payloadObject(
      {
        grantedMinutes: payloadNumber({ nullable: false, minimum: 0 }),
        usedMinutes: payloadNumber({ nullable: false, minimum: 0 }),
        pendingMinutes: payloadNumber({ nullable: false, minimum: 0 }),
        availableMinutes: payloadNumber({ nullable: false, minimum: 0 }),
      },
      true
    ),
  }),
  timTeamTime: payloadObject({
    timePendingCount: payloadNumber({ nullable: true, integer: true, minimum: 0 }),
  }),
  timTeamAbsence: payloadObject({
    absencePendingCount: payloadNumber({ nullable: true, integer: true, minimum: 0 }),
  }),
  paySelfCycle: payloadObject({
    payDate: payloadDate(true),
    status: payloadString(true, true),
    timeValidated: payloadBoolean(true),
    absenceValidated: payloadBoolean(true),
    sourceConfirmed: payloadBoolean(true),
  }),
  perSelfPerformance: payloadObject({
    activeGoalCount: payloadNumber({ nullable: false, integer: true, minimum: 0 }),
    requiredLearningCount: payloadNumber({ nullable: false, integer: true, minimum: 0 }),
    activeJourneyCount: payloadNumber({ nullable: false, integer: true, minimum: 0 }),
    nearestTargetDate: payloadDate(true),
    activeJourneyProgressPercent: payloadNumber({ nullable: true, minimum: 0, maximum: 100 }),
  }),
});

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid ${field}`);
  return value;
}

function nonBlankString(value: unknown, field: string): string {
  const resolved = stringValue(value, field);
  if (!resolved.trim()) throw new Error(`Invalid ${field}`);
  return resolved;
}

function nullableString(value: unknown, field: string): string | null {
  return value === null || value === undefined ? null : stringValue(value, field);
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function nonNegativeNumber(value: unknown, field: string): number {
  const resolved = finiteNumber(value, field);
  if (resolved < 0) throw new Error(`Invalid ${field}`);
  return resolved;
}

function nonNegativeInteger(value: unknown, field: string): number {
  const resolved = nonNegativeNumber(value, field);
  if (!Number.isInteger(resolved)) throw new Error(`Invalid ${field}`);
  return resolved;
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${field}`);
  return value;
}

function dateKey(value: unknown, field: string): string {
  const resolved = stringValue(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(resolved)) throw new Error(`Invalid ${field}`);
  const parsed = new Date(`${resolved}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== resolved) {
    throw new Error(`Invalid ${field}`);
  }
  return resolved;
}

function nullableDateKey(value: unknown, field: string): string | null {
  return value === null || value === undefined ? null : dateKey(value, field);
}

function domainState(overview: HrHomeOverview, domain: HrHomeDomain) {
  const states = record(overview.domainStates, 'domainStates');
  const raw = states[domain];
  if (raw === null || raw === undefined) return null;
  const state = record(raw, `domainStates.${domain}`);
  if (state.availability !== 'AVAILABLE' && state.availability !== 'UNAVAILABLE') {
    throw new Error(`Invalid domainStates.${domain}.availability`);
  }
  const reasonCode = nullableString(state.reasonCode, `domainStates.${domain}.reasonCode`);
  return { availability: state.availability, reasonCode };
}

function unavailable<T>(reasonCode: string | null | undefined): HrisHomeProviderResolution<T> {
  return {
    state: 'UNAVAILABLE',
    reasonCode: reasonCode || 'SOURCE_UNAVAILABLE',
    priority: 'LOW',
    payload: null,
  };
}

// Transitional adapter only: every projection below comes from the existing
// People /v1/hr/home aggregate. Module APIs must register MODULE_API providers
// instead of extending this compatibility registry.
const providers: readonly HrisHomeWidgetProvider<HrHomeOverview>[] = Object.freeze([
  Object.freeze({
    ...LEGACY_HOME_SAFETY,
    widgetId: 'hrm-self-employment',
    sourceModule: 'HRM',
    dataAuthority: LEGACY_AGGREGATE,
    audience: SELF_AUDIENCE,
    requiredEntitlements: HRM_SELF_VIEW,
    entitlementMode: 'STRICT',
    supportedScopes: Object.freeze(['SELF'] as const),
    horizon: 'CHANGED',
    freshnessSeconds: 300,
    sensitivity: Object.freeze({
      classification: 'CONFIDENTIAL',
      projection: 'VIEW',
      exposedFields: Object.freeze([
        'displayName',
        'businessTitle',
        'organizationName',
        'managerDisplayName',
      ]),
    }),
    payloadDescriptor: PAYLOAD_DESCRIPTORS.hrmSelfEmployment,
    primaryAction: Object.freeze({
      actionId: 'OPEN_SELF_EMPLOYMENT',
      labelKey: 'home.profile.open',
    }),
    deepLink: '/hr/me',
    project(overview: HrHomeOverview): HrisHomeProviderResolution<HrmSelfPayload> {
      const employee = record(overview.employee, 'employee');
      const displayName = nonBlankString(employee.displayName, 'employee.displayName');
      const businessTitle = nullableString(employee.businessTitle, 'employee.businessTitle');
      const organizationName = nullableString(
        employee.organizationName,
        'employee.organizationName'
      );
      const managerDisplayName = nullableString(
        employee.managerDisplayName,
        'employee.managerDisplayName'
      );
      const hasEmployment = Boolean(businessTitle || organizationName);
      return {
        state: hasEmployment ? 'AVAILABLE' : 'EMPTY',
        reasonCode: hasEmployment ? null : 'EMPLOYMENT_CONTEXT_EMPTY',
        priority: 'LOW',
        payload: {
          displayName,
          businessTitle,
          organizationName,
          managerDisplayName,
        },
      };
    },
  }),
  Object.freeze({
    ...LEGACY_HOME_SAFETY,
    widgetId: 'hrm-team-shape',
    sourceModule: 'HRM',
    dataAuthority: LEGACY_AGGREGATE,
    audience: MANAGER_AUDIENCE,
    requiredEntitlements: HRM_TEAM_VIEW,
    entitlementMode: 'STRICT',
    supportedScopes: Object.freeze(['TEAM'] as const),
    horizon: 'CHANGED',
    freshnessSeconds: 300,
    sensitivity: Object.freeze({
      classification: 'CONFIDENTIAL',
      projection: 'OMIT',
      exposedFields: Object.freeze(['directReportCount']),
    }),
    payloadDescriptor: PAYLOAD_DESCRIPTORS.hrmTeamShape,
    primaryAction: Object.freeze({
      actionId: 'OPEN_CURRENT_TEAM',
      labelKey: 'home.team.open',
    }),
    deepLink: '/hr/team',
    project(_overview: HrHomeOverview): HrisHomeProviderResolution<HrmTeamPayload> {
      // The legacy aggregate currently synthesizes TEAM zeroes instead of
      // reading the HRM owner API. Never present those placeholders as an
      // authoritative empty team.
      return unavailable('HRM_TEAM_OWNER_API_REQUIRED');
    },
  }),
  Object.freeze({
    ...LEGACY_HOME_SAFETY,
    widgetId: 'tim-self-time',
    sourceModule: 'TIM',
    dataAuthority: LEGACY_AGGREGATE,
    audience: SELF_AUDIENCE,
    requiredEntitlements: TIM_SELF_TIME_VIEW,
    entitlementMode: 'STRICT',
    supportedScopes: Object.freeze(['SELF'] as const),
    horizon: 'NOW',
    freshnessSeconds: 120,
    sensitivity: Object.freeze({
      classification: 'CONFIDENTIAL',
      projection: 'VIEW',
      exposedFields: Object.freeze([
        'periodStart',
        'periodEnd',
        'status',
        'recordedMinutes',
        'scheduledMinutes',
        'exceptionCount',
      ]),
    }),
    payloadDescriptor: PAYLOAD_DESCRIPTORS.timSelfTime,
    primaryAction: Object.freeze({
      actionId: 'OPEN_SELF_TIME',
      labelKey: 'home.tools.time',
    }),
    deepLink: '/hr/time',
    project(overview: HrHomeOverview): HrisHomeProviderResolution<TimSelfTimePayload> {
      const state = domainState(overview, 'TIME');
      if (state?.availability !== 'AVAILABLE') {
        return unavailable(state?.reasonCode);
      }
      const rawTime = overview.time;
      const time = rawTime === null || rawTime === undefined ? null : record(rawTime, 'time');
      const payload = {
        periodStart: time ? dateKey(time.periodStart, 'time.periodStart') : null,
        periodEnd: time ? dateKey(time.periodEnd, 'time.periodEnd') : null,
        status: time ? nonBlankString(time.status, 'time.status') : null,
        recordedMinutes: time
          ? nonNegativeNumber(time.recordedMinutes, 'time.recordedMinutes')
          : null,
        scheduledMinutes: time
          ? nonNegativeNumber(time.scheduledMinutes, 'time.scheduledMinutes')
          : null,
        exceptionCount: time ? nonNegativeInteger(time.exceptionCount, 'time.exceptionCount') : 0,
      };
      return {
        state: time ? 'AVAILABLE' : 'EMPTY',
        reasonCode: time ? null : 'TIME_CARD_EMPTY',
        priority: payload.exceptionCount > 0 ? 'CRITICAL' : time ? 'MEDIUM' : 'LOW',
        payload,
      };
    },
  }),
  Object.freeze({
    ...LEGACY_HOME_SAFETY,
    widgetId: 'tim-self-absence',
    sourceModule: 'TIM',
    dataAuthority: LEGACY_AGGREGATE,
    audience: SELF_AUDIENCE,
    requiredEntitlements: TIM_SELF_ABSENCE_VIEW,
    entitlementMode: 'STRICT',
    supportedScopes: Object.freeze(['SELF'] as const),
    horizon: 'NOW',
    freshnessSeconds: 120,
    sensitivity: Object.freeze({
      classification: 'CONFIDENTIAL',
      projection: 'VIEW',
      exposedFields: Object.freeze(['leavePlanCount', 'standardDayMinutes', 'displayBalance']),
    }),
    payloadDescriptor: PAYLOAD_DESCRIPTORS.timSelfAbsence,
    primaryAction: Object.freeze({
      actionId: 'OPEN_SELF_ABSENCE',
      labelKey: 'home.tools.requestLeave',
    }),
    deepLink: '/hr/absence',
    project(overview: HrHomeOverview): HrisHomeProviderResolution<TimSelfAbsencePayload> {
      const state = domainState(overview, 'ABSENCE');
      if (state?.availability !== 'AVAILABLE') {
        return unavailable(state?.reasonCode);
      }
      if (!Array.isArray(overview.leaveBalances)) throw new Error('Invalid leaveBalances');
      const leaveBalances = overview.leaveBalances.map((candidate, index) => {
        const balance = record(candidate, `leaveBalances.${index}`);
        return {
          planId: nonBlankString(balance.planId, `leaveBalances.${index}.planId`),
          grantedMinutes: nonNegativeNumber(
            balance.grantedMinutes,
            `leaveBalances.${index}.grantedMinutes`
          ),
          usedMinutes: nonNegativeNumber(balance.usedMinutes, `leaveBalances.${index}.usedMinutes`),
          pendingMinutes: nonNegativeNumber(
            balance.pendingMinutes,
            `leaveBalances.${index}.pendingMinutes`
          ),
          availableMinutes: nonNegativeNumber(
            balance.availableMinutes,
            `leaveBalances.${index}.availableMinutes`
          ),
        };
      });
      const standardDayMinutes =
        overview.standardDayMinutes === null || overview.standardDayMinutes === undefined
          ? null
          : nonNegativeNumber(overview.standardDayMinutes, 'standardDayMinutes');
      if (standardDayMinutes === 0) throw new Error('Invalid standardDayMinutes');
      const leavePlanCount = leaveBalances.length;
      // The aggregate has no owner-provided primary/display marker. This
      // compatibility adapter uses a neutral stable key and never plan-name semantics.
      const displayBalance = [...leaveBalances].sort((left, right) =>
        left.planId.localeCompare(right.planId)
      )[0];
      return {
        state: leavePlanCount > 0 ? 'AVAILABLE' : 'EMPTY',
        reasonCode: leavePlanCount > 0 ? null : 'LEAVE_PLAN_EMPTY',
        priority: 'LOW',
        payload: {
          leavePlanCount,
          standardDayMinutes,
          displayBalance: displayBalance
            ? {
                grantedMinutes: displayBalance.grantedMinutes,
                usedMinutes: displayBalance.usedMinutes,
                pendingMinutes: displayBalance.pendingMinutes,
                availableMinutes: displayBalance.availableMinutes,
              }
            : null,
        },
      };
    },
  }),
  Object.freeze({
    ...LEGACY_HOME_SAFETY,
    widgetId: 'tim-team-time-decisions',
    sourceModule: 'TIM',
    dataAuthority: LEGACY_AGGREGATE,
    audience: MANAGER_AUDIENCE,
    requiredEntitlements: TIM_TEAM_TIME_APPROVE,
    entitlementMode: 'STRICT',
    supportedScopes: Object.freeze(['TEAM'] as const),
    horizon: 'NOW',
    freshnessSeconds: 120,
    sensitivity: Object.freeze({
      classification: 'CONFIDENTIAL',
      projection: 'OMIT',
      exposedFields: Object.freeze(['timePendingCount']),
    }),
    payloadDescriptor: PAYLOAD_DESCRIPTORS.timTeamTime,
    primaryAction: Object.freeze({
      actionId: 'OPEN_TEAM_TIME_DECISIONS',
      labelKey: 'home.tools.teamTime',
    }),
    deepLink: '/hr/team/time',
    project(_overview: HrHomeOverview): HrisHomeProviderResolution<TimTeamTimePayload> {
      return unavailable('TIM_TEAM_TIME_OWNER_API_REQUIRED');
    },
  }),
  Object.freeze({
    ...LEGACY_HOME_SAFETY,
    widgetId: 'tim-team-absence-decisions',
    sourceModule: 'TIM',
    dataAuthority: LEGACY_AGGREGATE,
    audience: MANAGER_AUDIENCE,
    requiredEntitlements: TIM_TEAM_ABSENCE_APPROVE,
    entitlementMode: 'STRICT',
    supportedScopes: Object.freeze(['TEAM'] as const),
    horizon: 'NOW',
    freshnessSeconds: 120,
    sensitivity: Object.freeze({
      classification: 'CONFIDENTIAL',
      projection: 'OMIT',
      exposedFields: Object.freeze(['absencePendingCount']),
    }),
    payloadDescriptor: PAYLOAD_DESCRIPTORS.timTeamAbsence,
    primaryAction: Object.freeze({
      actionId: 'OPEN_TEAM_ABSENCE_DECISIONS',
      labelKey: 'home.tools.teamAbsence',
    }),
    deepLink: '/hr/team/absence',
    project(_overview: HrHomeOverview): HrisHomeProviderResolution<TimTeamAbsencePayload> {
      return unavailable('TIM_TEAM_ABSENCE_OWNER_API_REQUIRED');
    },
  }),
  Object.freeze({
    ...LEGACY_HOME_SAFETY,
    widgetId: 'pay-self-cycle',
    sourceModule: 'PAY',
    dataAuthority: LEGACY_AGGREGATE,
    audience: SELF_AUDIENCE,
    requiredEntitlements: PAY_SELF_VIEW,
    entitlementMode: 'STRICT',
    supportedScopes: Object.freeze(['SELF'] as const),
    horizon: 'NEXT',
    freshnessSeconds: 900,
    sensitivity: Object.freeze({
      classification: 'RESTRICTED',
      projection: 'MASK',
      exposedFields: Object.freeze([
        'payDate',
        'status',
        'timeValidated',
        'absenceValidated',
        'sourceConfirmed',
      ]),
    }),
    payloadDescriptor: PAYLOAD_DESCRIPTORS.paySelfCycle,
    primaryAction: Object.freeze({
      actionId: 'OPEN_SELF_PAY',
      labelKey: 'home.tools.pay',
    }),
    deepLink: '/hr/pay',
    project(overview: HrHomeOverview): HrisHomeProviderResolution<PaySelfPayload> {
      const state = domainState(overview, 'PAY');
      if (state?.availability !== 'AVAILABLE') {
        return unavailable(state?.reasonCode);
      }
      const rawPay = overview.pay;
      const pay = rawPay === null || rawPay === undefined ? null : record(rawPay, 'pay');
      const payDate = pay ? dateKey(pay.payDate, 'pay.payDate') : null;
      const status = pay ? nonBlankString(pay.status, 'pay.status') : null;
      const timeValidated = pay ? booleanValue(pay.timeValidated, 'pay.timeValidated') : null;
      const absenceValidated = pay
        ? booleanValue(pay.absenceValidated, 'pay.absenceValidated')
        : null;
      const sourceConfirmed = pay ? booleanValue(pay.sourceConfirmed, 'pay.sourceConfirmed') : null;
      return {
        state: pay ? 'AVAILABLE' : 'EMPTY',
        reasonCode: pay ? null : 'PAY_CYCLE_EMPTY',
        priority: pay && !sourceConfirmed ? 'HIGH' : pay ? 'MEDIUM' : 'LOW',
        payload: {
          payDate,
          status,
          timeValidated,
          absenceValidated,
          sourceConfirmed,
        },
      };
    },
  }),
  Object.freeze({
    ...LEGACY_HOME_SAFETY,
    widgetId: 'per-self-performance',
    sourceModule: 'PER',
    dataAuthority: LEGACY_AGGREGATE,
    audience: SELF_AUDIENCE,
    requiredEntitlements: PER_SELF_VIEW,
    entitlementMode: 'STRICT',
    supportedScopes: Object.freeze(['SELF'] as const),
    horizon: 'NEXT',
    freshnessSeconds: 900,
    sensitivity: Object.freeze({
      classification: 'RESTRICTED',
      projection: 'OMIT',
      exposedFields: Object.freeze([
        'activeGoalCount',
        'requiredLearningCount',
        'activeJourneyCount',
        'nearestTargetDate',
        'activeJourneyProgressPercent',
      ]),
    }),
    payloadDescriptor: PAYLOAD_DESCRIPTORS.perSelfPerformance,
    primaryAction: Object.freeze({
      actionId: 'OPEN_SELF_PERFORMANCE',
      labelKey: 'home.rhythm.journey.label',
    }),
    deepLink: '/hr/talent',
    project(overview: HrHomeOverview): HrisHomeProviderResolution<PerSelfPayload> {
      const state = domainState(overview, 'TALENT');
      if (state?.availability !== 'AVAILABLE') {
        return unavailable(state?.reasonCode);
      }
      if (!Array.isArray(overview.journeys)) throw new Error('Invalid journeys');
      const journeys = overview.journeys.map((candidate, index) => {
        const journey = record(candidate, `journeys.${index}`);
        const status = nonBlankString(journey.status, `journeys.${index}.status`);
        if (!['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'].includes(status)) {
          throw new Error(`Invalid journeys.${index}.status`);
        }
        const progressPercent = finiteNumber(
          journey.progressPercent,
          `journeys.${index}.progressPercent`
        );
        if (progressPercent < 0 || progressPercent > 100) {
          throw new Error(`Invalid journeys.${index}.progressPercent`);
        }
        return {
          journeyId: nonBlankString(journey.journeyId, `journeys.${index}.journeyId`),
          status,
          progressPercent,
          targetDate: nullableDateKey(journey.targetDate, `journeys.${index}.targetDate`),
        };
      });
      const activeGoalCount = nonNegativeInteger(overview.activeGoalCount, 'activeGoalCount');
      const requiredLearningCount = nonNegativeInteger(
        overview.requiredLearningCount,
        'requiredLearningCount'
      );
      const activeJourneys = journeys.filter(
        (journey) => !['COMPLETED', 'CANCELLED'].includes(journey.status)
      );
      const displayJourney = [...activeJourneys].sort(
        (left, right) =>
          (left.targetDate ?? '9999').localeCompare(right.targetDate ?? '9999') ||
          left.journeyId.localeCompare(right.journeyId)
      )[0];
      const nearestTargetDate = displayJourney?.targetDate ?? null;
      const hasData = activeGoalCount > 0 || requiredLearningCount > 0 || activeJourneys.length > 0;
      return {
        state: hasData ? 'AVAILABLE' : 'EMPTY',
        reasonCode: hasData ? null : 'PERFORMANCE_FLOW_EMPTY',
        priority: requiredLearningCount > 0 ? 'HIGH' : hasData ? 'MEDIUM' : 'LOW',
        payload: {
          activeGoalCount,
          requiredLearningCount,
          activeJourneyCount: activeJourneys.length,
          nearestTargetDate,
          activeJourneyProgressPercent: displayJourney?.progressPercent ?? null,
        },
      };
    },
  }),
]);

const registeredDeepLinks = new Set([
  '/hr/me',
  '/hr/team',
  '/hr/time',
  '/hr/absence',
  '/hr/team/time',
  '/hr/team/absence',
  '/hr/pay',
  '/hr/talent',
]);

function assertRegistry(): void {
  const widgetIds = new Set<string>();
  for (const provider of providers) {
    if (widgetIds.has(provider.widgetId)) {
      throw new Error(`Duplicate HRIS home widget provider: ${provider.widgetId}`);
    }
    widgetIds.add(provider.widgetId);
    if (!registeredDeepLinks.has(provider.deepLink)) {
      throw new Error(`Unregistered HRIS home deep link: ${provider.deepLink}`);
    }
    if (provider.requiredEntitlements.length === 0 || provider.audience.length === 0) {
      throw new Error(`Incomplete HRIS home authority contract: ${provider.widgetId}`);
    }
    const hasAppAuthority = provider.requiredEntitlements.some(
      (requirement) => requirement.resourceType === 'APP'
    );
    const hasModuleAuthority = provider.requiredEntitlements.some(
      (requirement) => requirement.resourceType !== 'APP'
    );
    if (!hasAppAuthority || !hasModuleAuthority) {
      throw new Error(`Missing module-specific HRIS home authority: ${provider.widgetId}`);
    }
    if (
      provider.entitlementMode === 'LEGACY_SURFACE_COMPATIBILITY' &&
      !provider.legacyCompatibilityAuthority
    ) {
      throw new Error(`Missing legacy compatibility authority: ${provider.widgetId}`);
    }
    if (provider.dataAuthority !== LEGACY_AGGREGATE) {
      throw new Error(`Non-legacy provider in aggregate adapter: ${provider.widgetId}`);
    }
  }
}

assertRegistry();

function legacyContribution(
  overview: HrHomeOverview | null,
  context: HrisHomeProviderContext,
  unavailableReason?: string
): HrisHomeSnapshotContribution {
  return Object.freeze({
    sourceId: 'legacy-home-aggregate',
    dataAuthority: LEGACY_AGGREGATE,
    snapshots: Object.freeze(
      providers.map((provider) => {
        try {
          return resolveHrisHomeWidgetProvider(
            provider,
            {
              data: overview,
              generatedAt: overview?.generatedAt ?? null,
              unavailableReason,
            },
            context
          );
        } catch {
          const reasonPrefix = provider.widgetId
            .replace(/[^A-Z0-9]+/giu, '_')
            .toLocaleUpperCase('en-US');
          return resolveHrisHomeWidgetProvider(
            provider,
            {
              data: null,
              generatedAt: overview?.generatedAt ?? null,
              unavailableReason: `${reasonPrefix}_PROJECTION_FAILED`,
            },
            context
          );
        }
      })
    ),
    metadata: overview
      ? Object.freeze({
          asOf: overview.asOf,
          generatedAt: overview.generatedAt,
          referenceDataPresent: overview.referenceDataPresent === true,
        })
      : null,
  });
}

function isHrHomeOverview(value: unknown): value is HrHomeOverview {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  try {
    dateKey(candidate.asOf, 'asOf');
    if (
      candidate.generatedAt !== null &&
      (typeof candidate.generatedAt !== 'string' ||
        !Number.isFinite(Date.parse(candidate.generatedAt)))
    ) {
      return false;
    }
    nonBlankString(candidate.timeZone, 'timeZone');
    record(candidate.employee, 'employee');
    record(candidate.domainStates, 'domainStates');
    return typeof candidate.referenceDataPresent === 'boolean';
  } catch {
    return false;
  }
}

export const HRIS_HOME_LEGACY_AGGREGATE_ADAPTER = Object.freeze({
  providers,
  resolve: (
    overview: HrHomeOverview | null,
    context: HrisHomeProviderContext,
    unavailableReason?: string
  ) => legacyContribution(overview, context, unavailableReason),
});

export const HRIS_HOME_LEGACY_AGGREGATE_SOURCE: HrisHomeProviderSource = Object.freeze({
  sourceId: 'legacy-home-aggregate',
  dataAuthority: LEGACY_AGGREGATE,
  widgetIds: Object.freeze(providers.map((provider) => provider.widgetId)),
  widgetContracts: providers,
  queryKey: (context) =>
    Object.freeze([
      'hris-home-source',
      'legacy-home-aggregate',
      context.tenantCacheKey,
      context.subjectCacheKey,
      context.authorityCacheKey,
      context.accessMode,
      context.contextScopeKey,
      context.decisionRevision,
      context.scope.kind,
      context.scope.key,
      context.asOf,
      context.purpose,
    ]),
  load: async (_context, signal) => getHrHome({ signal }),
  resolve: (data, context) =>
    isHrHomeOverview(data)
      ? legacyContribution(data, context)
      : legacyContribution(null, context, 'LEGACY_AGGREGATE_INVALID_RESPONSE'),
  unavailable: (context, reasonCode) => legacyContribution(null, context, reasonCode),
});

export const HRIS_HOME_MODULE_PROVIDER_REGISTRY: HrisHomeModuleProviderRegistry =
  createHrisHomeModuleProviderRegistry([HRIS_HOME_LEGACY_AGGREGATE_SOURCE]);
