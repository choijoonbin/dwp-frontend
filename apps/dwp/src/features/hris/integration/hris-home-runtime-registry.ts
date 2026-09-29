import {
  createHrisHomeModuleProviderRegistry,
  HRIS_HOME_LEGACY_AGGREGATE_SOURCE,
  resolveHrisHomeWidgetProvider,
} from '../home';
import { people360Decision, people360SelfDataSource, selectPeople360Detail } from '../people';

import type {
  HrisHomeEntitlementRequirement,
  HrisHomeProviderContext,
  HrisHomeProviderResolution,
  HrisHomeProviderSource,
  HrisHomeSnapshotContribution,
  HrisHomeWidgetProvider,
} from '../home';
import type { People360DetailView, People360SelfDataSource } from '../people';

type HrmSelfEmploymentPayload = Readonly<{
  displayName: string;
  businessTitle: string | null;
  organizationName: string | null;
  managerDisplayName: string | null;
}>;

const requirement = (
  resourceType: string,
  resourceKey: string,
  permissionCodes: readonly string[]
): HrisHomeEntitlementRequirement =>
  Object.freeze({
    resourceType,
    resourceKey,
    permissionCodes: Object.freeze([...permissionCodes]),
    match: 'ANY' as const,
  });

const HRM_SELF_EMPLOYMENT_PROVIDER: HrisHomeWidgetProvider<
  People360DetailView,
  HrmSelfEmploymentPayload
> = Object.freeze({
  contractVersion: 1,
  widgetId: 'hrm-self-employment',
  sourceModule: 'HRM',
  dataAuthority: 'MODULE_API',
  audience: Object.freeze([
    'EMPLOYEE',
    'MANAGER',
    'OPERATOR',
    'SETTINGS_ADMIN',
    'AUDITOR',
  ] as const),
  requiredEntitlements: Object.freeze([
    requirement('APP', 'APP.HRIS', ['VIEW', 'USE', 'LAUNCH', 'MANAGE']),
    requirement('DATA', 'DATA.WORKFORCE', ['VIEW', 'MANAGE']),
  ]),
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
  payloadDescriptor: Object.freeze({
    type: 'OBJECT',
    nullable: false,
    fields: Object.freeze({
      displayName: Object.freeze({ type: 'STRING', nullable: false, nonBlank: true }),
      businessTitle: Object.freeze({ type: 'STRING', nullable: true, nonBlank: false }),
      organizationName: Object.freeze({ type: 'STRING', nullable: true, nonBlank: false }),
      managerDisplayName: Object.freeze({ type: 'STRING', nullable: true, nonBlank: false }),
    }),
  }),
  purpose: 'HRIS_HOME',
  policyRevision: 'people360-self-home-v1',
  primaryAction: Object.freeze({
    actionId: 'OPEN_SELF_EMPLOYMENT',
    labelKey: 'home.profile.open',
  }),
  deepLink: '/hr/me',
  project(profile): HrisHomeProviderResolution<HrmSelfEmploymentPayload> {
    if (profile.access.archetype !== 'SELF' || profile.access.scope !== 'SELF') {
      return {
        state: 'CONFIGURATION_REQUIRED',
        reasonCode: 'PEOPLE_360_SELF_SCOPE_MISMATCH',
        priority: 'LOW',
        payload: null,
      };
    }
    const displayName = disclosedText(profile, 'person.displayName', profile.person.displayName);
    if (!displayName) {
      return {
        state: 'UNAVAILABLE',
        reasonCode: 'PEOPLE_360_DISPLAY_NAME_NOT_DISCLOSED',
        priority: 'LOW',
        payload: null,
      };
    }
    const businessTitle = disclosedText(
      profile,
      'primaryAssignment.businessTitle',
      profile.primaryAssignment?.businessTitle
    );
    const organizationName = disclosedText(
      profile,
      'primaryAssignment.organizationName',
      profile.primaryAssignment?.organizationName
    );
    const managerDisplayName = disclosedText(
      profile,
      'primaryAssignment.managerDisplayName',
      profile.primaryAssignment?.managerDisplayName
    );
    const partial = profile.state === 'PARTIAL';
    const employmentPresent = Boolean(businessTitle || organizationName || managerDisplayName);
    return {
      state: partial ? 'PARTIAL' : employmentPresent ? 'AVAILABLE' : 'EMPTY',
      reasonCode: partial
        ? 'PEOPLE_360_SOURCE_PARTIAL'
        : employmentPresent
          ? null
          : 'EMPLOYMENT_CONTEXT_EMPTY',
      priority: 'LOW',
      payload: {
        displayName,
        businessTitle,
        organizationName,
        managerDisplayName,
      },
    };
  },
});

function disclosedText(
  profile: People360DetailView,
  field: Parameters<typeof people360Decision>[1],
  value: string | undefined
): string | null {
  return people360Decision(profile, field) === 'VIEW' && value?.trim() ? value : null;
}

function selfPersonId(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('PEOPLE_360_SELF_RESPONSE_INVALID');
  }
  const person = (value as Record<string, unknown>).person;
  if (!person || typeof person !== 'object' || Array.isArray(person)) {
    throw new Error('PEOPLE_360_SELF_RESPONSE_INVALID');
  }
  const personId = (person as Record<string, unknown>).personId;
  if (typeof personId !== 'string' || !personId.trim()) {
    throw new Error('PEOPLE_360_SELF_RESPONSE_INVALID');
  }
  return personId;
}

function assertSelfModuleContext(context: HrisHomeProviderContext): string {
  const contextScopeKey = context.contextScopeKey?.trim();
  if (
    context.scope.kind !== 'SELF' ||
    !context.scope.key.trim() ||
    !context.tenantCacheKey?.trim() ||
    !context.subjectCacheKey?.trim() ||
    !context.authorityCacheKey.trim() ||
    !context.decisionRevision.trim() ||
    !context.accessMode.trim() ||
    !contextScopeKey
  ) {
    throw new Error('HRIS_HOME_MODULE_CONTEXT_REQUIRED');
  }
  return contextScopeKey;
}

function resolveHrmSelfContribution(
  profile: People360DetailView | null,
  context: HrisHomeProviderContext,
  unavailableReason?: string
): HrisHomeSnapshotContribution {
  return Object.freeze({
    sourceId: 'hrm-people360-self',
    dataAuthority: 'MODULE_API',
    snapshots: Object.freeze([
      resolveHrisHomeWidgetProvider(
        HRM_SELF_EMPLOYMENT_PROVIDER,
        {
          data: profile,
          generatedAt: null,
          unavailableReason,
        },
        context
      ),
    ]),
    metadata: profile
      ? Object.freeze({
          asOf: profile.asOf,
          generatedAt: null,
          referenceDataPresent: false,
        })
      : null,
  });
}

export function createHrmPeople360SelfHomeSource(
  dataSource: People360SelfDataSource = people360SelfDataSource
): HrisHomeProviderSource {
  return Object.freeze({
    sourceId: 'hrm-people360-self',
    dataAuthority: 'MODULE_API',
    widgetIds: Object.freeze([HRM_SELF_EMPLOYMENT_PROVIDER.widgetId]),
    widgetContracts: Object.freeze([HRM_SELF_EMPLOYMENT_PROVIDER]),
    queryKey: (context) =>
      Object.freeze([
        'hris-home-source',
        'hrm-people360-self',
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
    load: async (context, signal) =>
      dataSource.self(context.asOf, 'people360', assertSelfModuleContext(context), signal),
    resolve: (data, context) => {
      const profile = selectPeople360Detail(data, selfPersonId(data), context.asOf);
      if (profile.access.archetype !== 'SELF' || profile.access.scope !== 'SELF') {
        throw new Error('PEOPLE_360_SELF_SCOPE_MISMATCH');
      }
      return resolveHrmSelfContribution(profile, context);
    },
    unavailable: (context, reasonCode) =>
      resolveHrmSelfContribution(null, context, reasonCode.trim() || 'SOURCE_UNAVAILABLE'),
  });
}

export const HRIS_PEOPLE360_SELF_HOME_SOURCE = createHrmPeople360SelfHomeSource();

export const HRIS_HOME_RUNTIME_PROVIDER_REGISTRY = createHrisHomeModuleProviderRegistry([
  HRIS_PEOPLE360_SELF_HOME_SOURCE,
  HRIS_HOME_LEGACY_AGGREGATE_SOURCE,
]);
