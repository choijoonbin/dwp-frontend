import { people360Decision } from '../model/people-360-view-model';

import type { People360DetailView } from '../model/people-360-view-model';

export type People360HomeScope = Readonly<{
  kind: 'ORG_UNIT' | 'LEGAL_ENTITY';
  key: string;
}>;

export type People360HomeEntitlementRequirement = Readonly<{
  resourceType: string;
  resourceKey: string;
  permissionCodes: readonly string[];
  match: 'ANY' | 'ALL';
}>;

export type People360HomePayload = Readonly<{
  asOf: string;
  projectionRevision: string;
  personId: string;
  displayName?: string;
  workerStatus?: string;
  businessTitle?: string;
  organizationName?: string;
}>;

/**
 * Local structural counterpart of the integrated HRIS home snapshot contract. Keeping this type
 * local prevents a sibling-feature dependency while preserving direct structural assignability.
 */
export type People360HomeWidgetSnapshot<TPayload = unknown> = Readonly<{
  widgetId: string;
  sourceModule: 'HRM';
  dataAuthority: 'MODULE_API';
  audience: readonly ('OPERATOR' | 'AUDITOR')[];
  requiredEntitlements: readonly People360HomeEntitlementRequirement[];
  scope: People360HomeScope;
  horizon: 'CHANGED';
  priority: 'MEDIUM';
  freshness: Readonly<{
    generatedAt: string | null;
    maxAgeSeconds: number;
    state: 'UNKNOWN';
  }>;
  sensitivity: Readonly<{
    classification: 'CONFIDENTIAL';
    projection: 'VIEW';
    exposedFields: readonly string[];
  }>;
  state: 'AVAILABLE' | 'PARTIAL';
  reasonCode: 'PEOPLE_360_SOURCE_PARTIAL' | null;
  payload: TPayload | null;
  primaryAction: Readonly<{
    actionId: string;
    labelKey: string;
  }> | null;
  deepLink: string | null;
  traceId: string | null;
}>;

export type People360HomeContribution = People360HomeWidgetSnapshot<People360HomePayload>;

const AUDIENCE = Object.freeze(['OPERATOR', 'AUDITOR'] as const);
const REQUIRED_ENTITLEMENTS = Object.freeze([
  Object.freeze({
    resourceType: 'APP',
    resourceKey: 'APP.HRIS',
    permissionCodes: Object.freeze(['VIEW', 'USE', 'LAUNCH', 'MANAGE'] as const),
    match: 'ANY' as const,
  }),
  Object.freeze({
    resourceType: 'DATA',
    resourceKey: 'DATA.WORKFORCE',
    permissionCodes: Object.freeze(['VIEW', 'MANAGE'] as const),
    match: 'ANY' as const,
  }),
] satisfies readonly People360HomeEntitlementRequirement[]);
const PRIMARY_ACTION = Object.freeze({
  actionId: 'OPEN_PEOPLE_360',
  labelKey: 'hris.people.openCurrentSnapshot',
});

function disclosed(profile: People360DetailView, field: Parameters<typeof people360Decision>[1]) {
  return people360Decision(profile, field) === 'VIEW';
}

function canonicalScope(scope: People360HomeScope): People360HomeScope {
  if (
    (scope.kind !== 'ORG_UNIT' && scope.kind !== 'LEGAL_ENTITY') ||
    !scope.key ||
    scope.key.trim() !== scope.key
  ) {
    throw new Error('PEOPLE_360_HOME_SCOPE_INVALID');
  }
  return Object.freeze({ kind: scope.kind, key: scope.key });
}

/**
 * Adapts an already-authorized operations projection; it never calculates access or unmasks a
 * field. SELF and TEAM projections fail closed because their entitlement and destination contracts
 * are different. The integrated home owns unavailable/loading/error provider states.
 */
export function createPeople360HomeContribution(
  profile: People360DetailView,
  scope: People360HomeScope,
  traceId: string | null
): People360HomeContribution {
  if (
    (profile.access.archetype !== 'HR_OPERATOR' && profile.access.archetype !== 'AUDITOR') ||
    profile.access.scope !== 'WORKFORCE_POLICY'
  ) {
    throw new Error('PEOPLE_360_OPERATIONS_CONTRIBUTION_SCOPE_MISMATCH');
  }
  const params = new URLSearchParams({
    person: profile.person.personId,
    asOf: profile.asOf,
  });
  const payload: People360HomePayload = Object.freeze({
    asOf: profile.asOf,
    projectionRevision: profile.projectionRevision,
    personId: profile.person.personId,
    ...(disclosed(profile, 'person.displayName') && profile.person.displayName
      ? { displayName: profile.person.displayName }
      : {}),
    ...(disclosed(profile, 'employment.workerStatus') && profile.employment?.workerStatus
      ? { workerStatus: profile.employment.workerStatus }
      : {}),
    ...(disclosed(profile, 'primaryAssignment.businessTitle') &&
    profile.primaryAssignment?.businessTitle
      ? { businessTitle: profile.primaryAssignment.businessTitle }
      : {}),
    ...(disclosed(profile, 'primaryAssignment.organizationName') &&
    profile.primaryAssignment?.organizationName
      ? { organizationName: profile.primaryAssignment.organizationName }
      : {}),
  });
  const partial = profile.state === 'PARTIAL';
  return Object.freeze({
    widgetId: 'hris.people.current-snapshot',
    sourceModule: 'HRM',
    dataAuthority: 'MODULE_API',
    audience: AUDIENCE,
    requiredEntitlements: REQUIRED_ENTITLEMENTS,
    scope: canonicalScope(scope),
    horizon: 'CHANGED',
    priority: 'MEDIUM',
    freshness: Object.freeze({
      generatedAt: null,
      maxAgeSeconds: 300,
      state: 'UNKNOWN',
    }),
    sensitivity: Object.freeze({
      classification: 'CONFIDENTIAL',
      projection: 'VIEW',
      exposedFields: Object.freeze(Object.keys(payload)),
    }),
    state: partial ? 'PARTIAL' : 'AVAILABLE',
    reasonCode: partial ? 'PEOPLE_360_SOURCE_PARTIAL' : null,
    payload,
    primaryAction: PRIMARY_ACTION,
    deepLink: `/hr/operations/people?${params.toString()}`,
    traceId,
  });
}
