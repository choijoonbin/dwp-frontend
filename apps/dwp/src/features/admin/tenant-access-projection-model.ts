import type { TenantAccessGrant } from '@dwp-frontend/shared-utils';

const OWNER_LABELS: Record<string, string> = {
  AUTH_USER_DIRECTORY: 'access.projection.owners.AUTH_USER_DIRECTORY',
  DIRECT_ROLE_ASSIGNMENTS: 'access.projection.owners.DIRECT_ROLE_ASSIGNMENTS',
  GROUP_ROLE_ASSIGNMENTS: 'access.projection.owners.GROUP_ROLE_ASSIGNMENTS',
  PRIVILEGED_ACCESS_GRANTS: 'access.projection.owners.PRIVILEGED_ACCESS_GRANTS',
  APP_ADMIN_PRESET_ASSIGNMENTS: 'access.projection.owners.APP_ADMIN_PRESET_ASSIGNMENTS',
  AUTH_TENANT_APP_WORKFORCE_ASSIGNMENTS:
    'access.projection.owners.AUTH_TENANT_APP_WORKFORCE_ASSIGNMENTS',
  AUTH_PRODUCT_AUTHORIZATION_CATALOG: 'access.projection.owners.AUTH_PRODUCT_AUTHORIZATION_CATALOG',
  AUTH_TENANT_CAPABILITY_OVERRIDE: 'access.projection.owners.AUTH_TENANT_CAPABILITY_OVERRIDE',
};

const LIFECYCLE_LABELS: Record<string, string> = {
  ACTIVE: 'access.projection.lifecycle.ACTIVE',
  PENDING_APPROVAL: 'access.projection.lifecycle.PENDING_APPROVAL',
  APPROVED: 'access.projection.lifecycle.APPROVED',
  PERMISSION_SATISFIED: 'access.projection.lifecycle.PERMISSION_SATISFIED',
  TENANT_DISABLED: 'access.projection.lifecycle.TENANT_DISABLED',
  BLOCKED_BY_INSTALLATION_DRAFT: 'access.projection.lifecycle.BLOCKED_BY_INSTALLATION',
  BLOCKED_BY_INSTALLATION_IN_REVIEW: 'access.projection.lifecycle.BLOCKED_BY_INSTALLATION',
  BLOCKED_BY_INSTALLATION_APPROVED: 'access.projection.lifecycle.BLOCKED_BY_INSTALLATION',
  BLOCKED_BY_INSTALLATION_REJECTED: 'access.projection.lifecycle.BLOCKED_BY_INSTALLATION',
  BLOCKED_BY_INSTALLATION_SUSPENDED: 'access.projection.lifecycle.BLOCKED_BY_INSTALLATION',
};

const SCOPE_LABELS: Record<string, string> = {
  TENANT: 'access.projection.scopes.TENANT',
  ORG_UNIT: 'access.projection.scopes.ORG_UNIT',
  RESOURCE: 'access.projection.scopes.RESOURCE',
  RESOURCE_SET: 'access.projection.scopes.RESOURCE_SET',
  APP: 'access.projection.scopes.APP',
};

const LINEAGE_LABELS: Record<string, string> = {
  NOT_APPLICABLE: 'access.projection.lineageStates.NOT_APPLICABLE',
  ACTIVATED: 'access.projection.lineageStates.ACTIVATED',
  ACTIVATED_INDEPENDENTLY: 'access.projection.lineageStates.ACTIVATED_INDEPENDENTLY',
  REVIEW_PENDING: 'access.projection.lineageStates.REVIEW_PENDING',
  ACTIVATION_PENDING: 'access.projection.lineageStates.ACTIVATION_PENDING',
  COMPLETE: 'access.projection.lineageStates.COMPLETE',
  CLOSED: 'access.projection.lineageStates.CLOSED',
  RUNTIME_EVALUATION_REQUIRED: 'access.projection.lineageStates.RUNTIME_EVALUATION_REQUIRED',
  TENANT_SUPPRESSED: 'access.projection.lineageStates.TENANT_SUPPRESSED',
};

const EXCLUSION_LABELS: Record<string, string> = {
  EXTERNAL_IDP_GROUPS_NOT_SYNCHRONIZED_TO_AUTH:
    'access.projection.exclusionLabels.EXTERNAL_IDP_GROUPS_NOT_SYNCHRONIZED_TO_AUTH',
  EXTERNAL_SAAS_LICENSES_AND_SEATS:
    'access.projection.exclusionLabels.EXTERNAL_SAAS_LICENSES_AND_SEATS',
  ROUTE_PREDICATES_EVALUATED_ONLY_AT_REQUEST_TIME:
    'access.projection.exclusionLabels.ROUTE_PREDICATES_EVALUATED_ONLY_AT_REQUEST_TIME',
  SCOPED_CAPABILITIES_REQUIRE_RUNTIME_ROUTE_EVALUATION:
    'access.projection.exclusionLabels.SCOPED_CAPABILITIES_REQUIRE_RUNTIME_ROUTE_EVALUATION',
};

const FRESHNESS_LABELS: Record<string, string> = {
  FRESH: 'access.projection.freshness.FRESH',
  STALE: 'access.projection.freshness.STALE',
  NO_DATA: 'access.projection.freshness.NO_DATA',
};

const ENTITLEMENT_TYPE_LABELS: Record<string, string> = {
  ROLE: 'access.projection.entitlementTypes.ROLE',
  APP_PRESET: 'access.projection.entitlementTypes.APP_PRESET',
  APP_WORKFORCE: 'access.projection.entitlementTypes.APP_WORKFORCE',
  CAPABILITY: 'access.projection.entitlementTypes.CAPABILITY',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  DIRECT: 'access.projection.sourceTypes.DIRECT',
  GROUP: 'access.projection.sourceTypes.GROUP',
  PRIVILEGED: 'access.projection.sourceTypes.PRIVILEGED',
  APP_PRESET: 'access.projection.sourceTypes.APP_PRESET',
  APP_PRESET_GROUP: 'access.projection.sourceTypes.APP_PRESET_GROUP',
  TENANT_APP_ASSIGNMENT: 'access.projection.sourceTypes.TENANT_APP_ASSIGNMENT',
  PRODUCT_AUTHORIZATION: 'access.projection.sourceTypes.PRODUCT_AUTHORIZATION',
  TENANT_CAPABILITY_SUPPRESSION: 'access.projection.sourceTypes.TENANT_CAPABILITY_SUPPRESSION',
};

export function projectionOwnerLabelKey(ownerKey: string): string {
  return OWNER_LABELS[ownerKey] ?? 'access.projection.owners.UNKNOWN';
}

export function projectionLifecycleLabelKey(lifecycleState: string): string {
  return LIFECYCLE_LABELS[lifecycleState] ?? 'access.projection.lifecycle.UNKNOWN';
}

export function projectionScopeLabelKey(scopeType: string): string {
  return SCOPE_LABELS[scopeType] ?? 'access.projection.scopes.UNKNOWN';
}

export function projectionLineageLabelKey(lineageState: string): string {
  return LINEAGE_LABELS[lineageState] ?? 'access.projection.lineageStates.UNKNOWN';
}

export function projectionExclusionLabelKey(exclusion: string): string {
  return EXCLUSION_LABELS[exclusion] ?? 'access.projection.exclusionLabels.UNKNOWN';
}

export function projectionFreshnessLabelKey(freshness: string): string {
  return FRESHNESS_LABELS[freshness] ?? 'access.projection.freshness.UNKNOWN';
}

export function projectionEntitlementTypeLabelKey(entitlementType: string): string {
  return ENTITLEMENT_TYPE_LABELS[entitlementType] ?? 'access.projection.entitlementTypes.UNKNOWN';
}

export function projectionSourceTypeLabelKey(sourceType: string): string {
  return SOURCE_TYPE_LABELS[sourceType] ?? 'access.projection.sourceTypes.UNKNOWN';
}

export function projectionActorEvidenceLabelKey(actorId: number | null | undefined): string {
  return actorId == null
    ? 'access.projection.actorEvidence.NOT_RECORDED'
    : 'access.projection.actorEvidence.RECORDED';
}

export function projectionSourcePresentation(
  grant: TenantAccessGrant
): { kind: 'literal'; value: string } | { kind: 'localized'; key: string } {
  if (
    (grant.sourceType === 'GROUP' || grant.sourceType === 'APP_PRESET_GROUP') &&
    grant.sourceName?.trim()
  ) {
    return { kind: 'literal', value: grant.sourceName.trim() };
  }
  const knownDetail = SOURCE_TYPE_LABELS[grant.sourceType];
  return {
    kind: 'localized',
    key: knownDetail
      ? `access.projection.sourceDetails.${grant.sourceType}`
      : 'access.projection.sourceDetails.UNKNOWN',
  };
}
