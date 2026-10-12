import type {
  ManagedTenantEffectiveSetting,
  NotificationAttentionRuleCollection,
  NotificationDeliveryEndpoint,
  PersonalPrivacyConsentLedger,
  PersonalPrivacyRequestPage,
  PersonalSettingActivity,
  ProviderArtifactManifestPage,
  ProviderArtifactRolloutPlanPage,
  ProviderResourceCommitmentChangePage,
  ProviderResourceCommitmentPage,
  ProviderTenantLifecycleRequestPage,
  TenantAccessProjection,
  TenantAppAdoptionProjection,
  TenantAppAssignmentPage,
  TenantProviderDataGovernanceProjection,
  TenantUserPreferenceState,
  WorkspaceActivityExecutionSummary,
  WorkspaceProductivityConnection,
} from '@dwp-frontend/shared-utils';

import type { MenuRouteFixtureResolution } from './menu-route-fixture-contract';
import { widgetRegistryEffectiveCatalog, widgetRegistryReadiness } from './widget-registry';

const OBSERVED_AT = '2026-08-11T00:20:00Z';

const emptyExecutionSummary = {
  total: 0,
  running: 0,
  needsInput: 0,
  policyBlocked: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
  unknown: 0,
  generatedAt: OBSERVED_AT,
  coverage: { supportedObjectTypes: [], excludedProvenance: [], includesUsage: false },
  attentionItems: [],
} satisfies WorkspaceActivityExecutionSummary;

const activitySettingKeys = new Set([
  'profile',
  'security',
  'appearance',
  'accessibility',
  'language',
  'home',
  'notifications',
  'managed',
]);

export const MENU_ROUTE_ADMIN_VIEW_PERMISSION_PAIRS = [
  ['ADMIN.TENANT_BRANDING', 'VIEW'],
  ['ADMIN.MANAGED_PREFERENCES', 'VIEW'],
  ['ADMIN.LOCALIZATION', 'VIEW'],
  ['ADMIN.ACCESS_REVIEWS', 'VIEW'],
  ['ADMIN.ACCESS_GOVERNANCE', 'VIEW'],
  ['ADMIN.REFERENCE_DATA', 'VIEW'],
  ['ADMIN.PLATFORM_REGISTRY', 'VIEW'],
  ['ADMIN.NAVIGATION', 'VIEW'],
  ['ADMIN.IDENTITY_DIRECTORY', 'VIEW'],
  ['ADMIN.APP_GOVERNANCE', 'VIEW'],
] as const;

const activitySettingKey = (body: unknown): PersonalSettingActivity['settingKey'] | null => {
  const settingKey =
    body && typeof body === 'object' && 'settingKey' in body
      ? (body as { settingKey?: unknown }).settingKey
      : null;
  return typeof settingKey === 'string' && activitySettingKeys.has(settingKey)
    ? (settingKey as PersonalSettingActivity['settingKey'])
    : null;
};

export const resolveMenuRouteControlFixture = (
  method: string,
  path: string,
  body?: unknown
): MenuRouteFixtureResolution | null => {
  if (method === 'POST' && path === '/api/platform/v1/personal-settings/activity/view') {
    const settingKey = activitySettingKey(body);
    if (!settingKey) return null;
    return {
      data: {
        activityId: '91000000-0000-4000-8000-000000000001',
        settingKey,
        activityType: 'VIEW',
        changedFields: [],
        occurredAt: OBSERVED_AT,
      } satisfies PersonalSettingActivity,
    };
  }
  if (method !== 'GET') return null;

  switch (path) {
    case '/api/auth/admin/tenant-settings/access-projection':
      return {
        data: {
          snapshotId: 'a'.repeat(64),
          observedAt: OBSERVED_AT,
          coverage: {
            state: 'COMPLETE_INTERNAL_OWNERS',
            includedOwners: [],
            exclusions: [],
            freshestSourceUpdatedAt: null,
            owners: [],
          },
          principals: [],
          page: 0,
          size: 100,
          totalElements: 0,
          totalPages: 0,
        } satisfies TenantAccessProjection,
      };
    case '/api/auth/admin/tenant-app-adoption':
      return {
        data: {
          observedAt: OBSERVED_AT,
          coverageState: 'COMPLETE_INTERNAL_OWNERS',
          includedOwners: [],
          exclusions: [],
          requestableAppResourceKeys: [],
          installations: [],
          installationsLimit: 100,
          installationsHasMore: false,
        } satisfies TenantAppAdoptionProjection,
      };
    case '/api/auth/admin/tenant-app-adoption/assignments':
      return {
        data: {
          items: [],
          limit: 100,
          hasMore: false,
        } satisfies TenantAppAssignmentPage,
      };
    case '/api/provider/v1/tenant/settings/data-governance-observation':
      return {
        data: {
          ownerService: 'provider-control-plane',
          observationState: 'LIVE_OWNER_READ',
          observedAt: OBSERVED_AT,
          sourceLastChangedAt: null,
          coverageState: 'GLOBAL_POLICIES_AND_CURRENT_TENANT_LIFECYCLE_EVALUATIONS',
          exclusions: [],
          policies: [],
          tenantLifecycleHoldObservations: [],
        } satisfies TenantProviderDataGovernanceProjection,
      };
    case '/api/provider/v1/admin/settings':
      return { data: [] };
    case '/api/provider/v1/admin/resource-governance/commitments':
      return {
        data: { items: [], limit: 100, hasMore: false } satisfies ProviderResourceCommitmentPage,
      };
    case '/api/provider/v1/admin/resource-governance/commitment-changes':
      return {
        data: {
          items: [],
          limit: 100,
          hasMore: false,
        } satisfies ProviderResourceCommitmentChangePage,
      };
    case '/api/provider/v1/admin/resource-governance/lifecycle-requests':
      return {
        data: {
          items: [],
          limit: 100,
          hasMore: false,
        } satisfies ProviderTenantLifecycleRequestPage,
      };
    case '/api/provider/v1/admin/artifact-governance/manifests':
      return {
        data: { items: [], limit: 100, hasMore: false } satisfies ProviderArtifactManifestPage,
      };
    case '/api/provider/v1/admin/artifact-governance/rollout-plans':
      return {
        data: { items: [], limit: 100, hasMore: false } satisfies ProviderArtifactRolloutPlanPage,
      };
    case '/api/platform/v1/workspace/productivity/connections':
      return { data: [] satisfies WorkspaceProductivityConnection[] };
    case '/api/platform/v1/personal-settings/privacy/consents':
      return {
        data: {
          currentProductAnalytics: null,
          history: [],
          historyHasMore: false,
          historyLimit: 50,
          coveredPurposes: ['PRODUCT_ANALYTICS'],
          coverageState: 'PRODUCT_LOCAL',
          coverageBoundary: 'CROSS_PRODUCT_CONSENT_SOURCES_NOT_CONNECTED',
        } satisfies PersonalPrivacyConsentLedger,
      };
    case '/api/platform/v1/personal-settings/privacy/requests':
      return {
        data: { items: [], hasMore: false, limit: 50 } satisfies PersonalPrivacyRequestPage,
      };
    case '/api/platform/v1/widget-catalog/readiness':
      return { data: widgetRegistryReadiness('SHADOW') };
    case '/api/platform/v1/widget-catalog/effective':
      return { data: widgetRegistryEffectiveCatalog('SHADOW', 'AVAILABLE') };
    case '/api/platform/v1/workspace/activity/executions/summary':
    case '/api/agent/v1/activity/executions/summary':
      return { data: emptyExecutionSummary };
    case '/api/notifications/v1/me/delivery-endpoints':
      return { data: [] satisfies NotificationDeliveryEndpoint[] };
    case '/api/notifications/v1/me/attention-rules':
      return {
        data: { items: [], maxActiveRules: 25 } satisfies NotificationAttentionRuleCollection,
      };
    case '/api/auth/tenant-settings/managed-effective/me':
      return { data: [] satisfies ManagedTenantEffectiveSetting[] };
    case '/api/auth/tenant-settings/effective-settings/me/preferred-locale':
      return {
        data: {
          userId: 1,
          preferredLocale: null,
          tenantDefaultLocale: 'ko-KR',
          version: 0,
          updatedAt: OBSERVED_AT,
        } satisfies TenantUserPreferenceState,
      };
    default:
      return null;
  }
};
