import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

const BASE = '/api/platform/v1/admin/workplace/governance';

export type WorkplaceGovernanceCampusState = 'ACTIVE' | 'MAINTENANCE' | 'CLOSED';
export type WorkplaceGovernanceSpatialState = 'ACTIVE' | 'MAINTENANCE' | 'CLOSED';
export type WorkplaceGovernanceZoneType =
  'GENERAL' | 'WORK_AREA' | 'COLLABORATION' | 'QUIET' | 'SERVICE' | 'RESTRICTED';
export type WorkplaceGovernanceRuleState = 'ACTIVE' | 'INACTIVE';
export type WorkplaceGovernanceAccessSubjectType = 'USER' | 'GROUP_REF';
export type WorkplaceGovernanceAccessPermission = 'VIEW' | 'BOOK' | 'MANAGE';
export type WorkplaceGovernanceAccessEffect = 'ALLOW' | 'DENY';
export type WorkplaceGovernancePolicyScopeType =
  'TENANT' | 'CAMPUS' | 'SITE' | 'FLOOR' | 'ZONE' | 'RESOURCE';
export type WorkplaceGovernanceRevisionState = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type WorkplaceGovernanceDelegateType = 'USER' | 'GROUP_REF';
export type WorkplaceGovernanceDelegatedScopeType = 'SITE' | 'GROUP_REF';
export type WorkplaceGovernanceDelegatedPermission =
  | 'CATALOG_VIEW'
  | 'CATALOG_MANAGE'
  | 'ACCESS_MANAGE'
  | 'POLICY_MANAGE'
  | 'FLOOR_PLAN_MANAGE'
  | 'DELEGATION_VIEW';
export type WorkplaceGovernanceDelegationState = 'ACTIVE' | 'REVOKED';
export type WorkplaceGovernanceJsonObject = Record<string, unknown>;
export type WorkplaceGovernancePolicyValue = string | number | boolean;
export type WorkplaceGovernancePolicyPatch = Record<string, WorkplaceGovernancePolicyValue>;

export type WorkplaceGovernanceCampus = {
  campusId: string;
  code: string;
  nameKo: string;
  nameEn: string;
  state: WorkplaceGovernanceCampusState;
  buildingCount: number;
  version: number;
};

export type WorkplaceGovernanceCampusInput = Omit<
  WorkplaceGovernanceCampus,
  'campusId' | 'buildingCount' | 'version'
> & { version: number | null };

export type WorkplaceGovernanceSiteCampusAssignment = {
  siteId: string;
  campusId: string;
  siteVersion: number;
};

export type WorkplaceGovernanceZone = {
  zoneId: string;
  floorId: string;
  code: string;
  nameKo: string;
  nameEn: string;
  type: WorkplaceGovernanceZoneType;
  boundary: WorkplaceGovernanceJsonObject;
  state: WorkplaceGovernanceSpatialState;
  sectionCount: number;
  resourceCount: number;
  version: number;
};

export type WorkplaceGovernanceZoneInput = Omit<
  WorkplaceGovernanceZone,
  'zoneId' | 'floorId' | 'sectionCount' | 'resourceCount' | 'version'
> & { version: number | null };

export type WorkplaceGovernanceSection = {
  sectionId: string;
  floorId: string;
  zoneId: string;
  code: string;
  nameKo: string;
  nameEn: string;
  boundary: WorkplaceGovernanceJsonObject;
  state: WorkplaceGovernanceSpatialState;
  resourceCount: number;
  version: number;
};

export type WorkplaceGovernanceSectionInput = Omit<
  WorkplaceGovernanceSection,
  'sectionId' | 'floorId' | 'zoneId' | 'resourceCount' | 'version'
> & { version: number | null };

export type WorkplaceGovernanceSiteAccessRule = {
  accessRuleId: string;
  siteId: string;
  subjectType: WorkplaceGovernanceAccessSubjectType;
  subjectUserId: number | null;
  subjectGroupRef: string | null;
  permission: WorkplaceGovernanceAccessPermission;
  effect: WorkplaceGovernanceAccessEffect;
  validFrom: string | null;
  validUntil: string | null;
  state: WorkplaceGovernanceRuleState;
  version: number;
};

export type WorkplaceGovernanceSiteAccessRuleInput = Omit<
  WorkplaceGovernanceSiteAccessRule,
  'accessRuleId' | 'siteId' | 'version'
> & { version: number | null };

export type WorkplaceGovernanceSiteAccessDecision = {
  siteId: string;
  userId: number;
  requestedPermission: WorkplaceGovernanceAccessPermission;
  allowed: boolean;
  decision: string;
  matchedRuleIds: string[];
  evaluatedAt: string;
};

export type WorkplaceGovernancePolicyOverride = {
  policyOverrideId: string;
  scopeType: WorkplaceGovernancePolicyScopeType;
  scopeId: string | null;
  policyPatch: WorkplaceGovernancePolicyPatch;
  state: WorkplaceGovernanceRuleState;
  version: number;
};

export type WorkplaceGovernancePolicyOverrideInput = Omit<
  WorkplaceGovernancePolicyOverride,
  'policyOverrideId' | 'version'
> & { version: number | null };

export type WorkplaceGovernancePolicyFieldSource = {
  scopeType: WorkplaceGovernancePolicyScopeType;
  scopeId: string | null;
  policyOverrideId: string | null;
  version: number;
};

export type WorkplaceGovernanceEffectivePolicy = {
  targetScopeType: WorkplaceGovernancePolicyScopeType;
  targetScopeId: string | null;
  effectivePolicy: WorkplaceGovernancePolicyPatch;
  fieldSources: Record<string, WorkplaceGovernancePolicyFieldSource>;
  appliedOverrideIds: string[];
  generatedAt: string;
};

export type WorkplaceGovernanceFloorPlanPlacement = {
  placementId: string;
  resourceId: string;
  resourceVersion: number;
  zoneId: string;
  sectionId: string | null;
  positionX: number;
  positionY: number;
  widthPercent: number;
  heightPercent: number;
  rotationDegrees: number;
  metadata: WorkplaceGovernanceJsonObject;
  version: number;
};

export type WorkplaceGovernanceFloorPlanPlacementInput = Omit<
  WorkplaceGovernanceFloorPlanPlacement,
  'placementId' | 'version'
>;

export type WorkplaceGovernanceFloorPlanRevision = {
  revisionId: string;
  floorId: string;
  revisionNumber: number;
  basedOnRevisionId: string | null;
  restoreSourceRevisionId: string | null;
  state: WorkplaceGovernanceRevisionState;
  planWidth: number;
  planHeight: number;
  backgroundAssetPath: string | null;
  backgroundAssetKey: string | null;
  backgroundContentType: string | null;
  backgroundSizeBytes: number | null;
  backgroundSha256: string | null;
  changeSummary: string;
  contentHash: string;
  placementCount: number;
  submittedAt: string | null;
  submittedBy: number | null;
  publishedAt: string | null;
  publishedBy: number | null;
  version: number;
};

export type WorkplaceGovernanceFloorPlanSnapshotInput = {
  planWidth: number;
  planHeight: number;
  backgroundAssetPath: string | null;
  backgroundAssetKey: string | null;
  backgroundContentType: string | null;
  backgroundSizeBytes: number | null;
  backgroundSha256: string | null;
  changeSummary: string;
  placements: WorkplaceGovernanceFloorPlanPlacementInput[];
  version: number;
};

export type WorkplaceGovernanceFloorPlanProjection = {
  floorId: string;
  publishedRevisionId: string;
  revisionNumber: number;
  planWidth: number;
  planHeight: number;
  backgroundAssetPath: string | null;
  placements: WorkplaceGovernanceFloorPlanPlacement[];
  publishedAt: string;
};

export type WorkplaceGovernanceFloorPlanRevisionSnapshot = {
  revision: WorkplaceGovernanceFloorPlanRevision;
  placements: WorkplaceGovernanceFloorPlanPlacement[];
};

export type WorkplaceGovernanceDelegatedAdminScope = {
  delegationId: string;
  delegateType: WorkplaceGovernanceDelegateType;
  delegateUserId: number | null;
  delegateGroupRef: string | null;
  scopeType: WorkplaceGovernanceDelegatedScopeType;
  siteId: string | null;
  managedGroupRef: string | null;
  permissions: WorkplaceGovernanceDelegatedPermission[];
  validFrom: string | null;
  validUntil: string | null;
  state: WorkplaceGovernanceDelegationState;
  version: number;
};

export type WorkplaceGovernanceDelegatedAdminScopeInput = Omit<
  WorkplaceGovernanceDelegatedAdminScope,
  'delegationId' | 'version'
> & { version: number | null };

export type WorkplaceGovernanceEffectiveDelegatedScope = {
  delegationId: string;
  scopeType: WorkplaceGovernanceDelegatedScopeType;
  scopeId: string;
  permissions: WorkplaceGovernanceDelegatedPermission[];
  validUntil: string | null;
};

function id(value: string) {
  return encodeURIComponent(value);
}

export async function getWorkplaceGovernanceCampuses() {
  const response = await axiosInstance.get<ApiResponse<WorkplaceGovernanceCampus[]>>(
    `${BASE}/campuses`
  );
  return response.data.data;
}

export async function saveWorkplaceGovernanceCampus(
  campusId: string | null,
  input: WorkplaceGovernanceCampusInput
) {
  const url = campusId ? `${BASE}/campuses/${id(campusId)}` : `${BASE}/campuses`;
  const response = campusId
    ? await axiosInstance.put<
        ApiResponse<WorkplaceGovernanceCampus>,
        WorkplaceGovernanceCampusInput
      >(url, input)
    : await axiosInstance.post<
        ApiResponse<WorkplaceGovernanceCampus>,
        WorkplaceGovernanceCampusInput
      >(url, input);
  return response.data.data;
}

export async function assignWorkplaceGovernanceSiteCampus(
  siteId: string,
  campusId: string,
  siteVersion: number
) {
  const response = await axiosInstance.put<
    ApiResponse<WorkplaceGovernanceSiteCampusAssignment>,
    { campusId: string; siteVersion: number }
  >(`${BASE}/sites/${id(siteId)}/campus`, { campusId, siteVersion });
  return response.data.data;
}

export async function getWorkplaceGovernanceZones(floorId: string) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceGovernanceZone[]>>(
    `${BASE}/floors/${id(floorId)}/zones`
  );
  return response.data.data;
}

export async function saveWorkplaceGovernanceZone(
  floorId: string,
  zoneId: string | null,
  input: WorkplaceGovernanceZoneInput
) {
  const base = `${BASE}/floors/${id(floorId)}/zones`;
  const url = zoneId ? `${base}/${id(zoneId)}` : base;
  const response = zoneId
    ? await axiosInstance.put<ApiResponse<WorkplaceGovernanceZone>, WorkplaceGovernanceZoneInput>(
        url,
        input
      )
    : await axiosInstance.post<ApiResponse<WorkplaceGovernanceZone>, WorkplaceGovernanceZoneInput>(
        url,
        input
      );
  return response.data.data;
}

export async function getWorkplaceGovernanceSections(zoneId: string) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceGovernanceSection[]>>(
    `${BASE}/zones/${id(zoneId)}/sections`
  );
  return response.data.data;
}

export async function saveWorkplaceGovernanceSection(
  zoneId: string,
  sectionId: string | null,
  input: WorkplaceGovernanceSectionInput
) {
  const base = `${BASE}/zones/${id(zoneId)}/sections`;
  const url = sectionId ? `${base}/${id(sectionId)}` : base;
  const response = sectionId
    ? await axiosInstance.put<
        ApiResponse<WorkplaceGovernanceSection>,
        WorkplaceGovernanceSectionInput
      >(url, input)
    : await axiosInstance.post<
        ApiResponse<WorkplaceGovernanceSection>,
        WorkplaceGovernanceSectionInput
      >(url, input);
  return response.data.data;
}

export async function getWorkplaceGovernanceAccessRules(siteId: string) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceGovernanceSiteAccessRule[]>>(
    `${BASE}/sites/${id(siteId)}/access-rules`
  );
  return response.data.data;
}

export async function saveWorkplaceGovernanceAccessRule(
  siteId: string,
  accessRuleId: string | null,
  input: WorkplaceGovernanceSiteAccessRuleInput
) {
  const base = `${BASE}/sites/${id(siteId)}/access-rules`;
  const url = accessRuleId ? `${base}/${id(accessRuleId)}` : base;
  const response = accessRuleId
    ? await axiosInstance.put<
        ApiResponse<WorkplaceGovernanceSiteAccessRule>,
        WorkplaceGovernanceSiteAccessRuleInput
      >(url, input)
    : await axiosInstance.post<
        ApiResponse<WorkplaceGovernanceSiteAccessRule>,
        WorkplaceGovernanceSiteAccessRuleInput
      >(url, input);
  return response.data.data;
}

export async function previewWorkplaceGovernanceSiteAccess(
  siteId: string,
  permission: WorkplaceGovernanceAccessPermission
) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceGovernanceSiteAccessDecision>>(
    `${BASE}/sites/${id(siteId)}/access-preview?permission=${permission}`
  );
  return response.data.data;
}

export async function getWorkplaceGovernancePolicyOverrides(
  scopeType?: WorkplaceGovernancePolicyScopeType,
  scopeId?: string | null
) {
  const query = new URLSearchParams();
  if (scopeType) query.set('scopeType', scopeType);
  if (scopeId) query.set('scopeId', scopeId);
  const suffix = query.size ? `?${query.toString()}` : '';
  const response = await axiosInstance.get<ApiResponse<WorkplaceGovernancePolicyOverride[]>>(
    `${BASE}/policy-overrides${suffix}`
  );
  return response.data.data;
}

export async function saveWorkplaceGovernancePolicyOverride(
  overrideId: string | null,
  input: WorkplaceGovernancePolicyOverrideInput
) {
  const url = overrideId
    ? `${BASE}/policy-overrides/${id(overrideId)}`
    : `${BASE}/policy-overrides?${new URLSearchParams({
        scopeType: input.scopeType,
        ...(input.scopeId ? { scopeId: input.scopeId } : {}),
      }).toString()}`;
  const response = overrideId
    ? await axiosInstance.put<
        ApiResponse<WorkplaceGovernancePolicyOverride>,
        WorkplaceGovernancePolicyOverrideInput
      >(url, input)
    : await axiosInstance.post<
        ApiResponse<WorkplaceGovernancePolicyOverride>,
        WorkplaceGovernancePolicyOverrideInput
      >(url, input);
  return response.data.data;
}

export async function previewWorkplaceGovernancePolicy(
  scopeType: WorkplaceGovernancePolicyScopeType,
  scopeId: string | null
) {
  const query = new URLSearchParams({ scopeType });
  if (scopeId) query.set('scopeId', scopeId);
  const response = await axiosInstance.get<ApiResponse<WorkplaceGovernanceEffectivePolicy>>(
    `${BASE}/policy-preview?${query.toString()}`
  );
  return response.data.data;
}

export async function getWorkplaceGovernanceFloorPlanRevisions(floorId: string) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceGovernanceFloorPlanRevision[]>>(
    `${BASE}/floors/${id(floorId)}/floor-plan-revisions`
  );
  return response.data.data;
}

export async function createWorkplaceGovernanceFloorPlanRevision(
  floorId: string,
  input: { basedOnRevisionId: string | null; changeSummary: string }
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceGovernanceFloorPlanRevision>,
    typeof input
  >(`${BASE}/floors/${id(floorId)}/floor-plan-revisions`, input);
  return response.data.data;
}

export async function getWorkplaceGovernanceFloorPlanRevisionSnapshot(revisionId: string) {
  const response = await axiosInstance.get<
    ApiResponse<WorkplaceGovernanceFloorPlanRevisionSnapshot>
  >(`${BASE}/floor-plan-revisions/${id(revisionId)}/snapshot`);
  return response.data.data;
}

export async function updateWorkplaceGovernanceFloorPlanRevision(
  revisionId: string,
  input: WorkplaceGovernanceFloorPlanSnapshotInput
) {
  const response = await axiosInstance.put<
    ApiResponse<WorkplaceGovernanceFloorPlanRevision>,
    WorkplaceGovernanceFloorPlanSnapshotInput
  >(`${BASE}/floor-plan-revisions/${id(revisionId)}`, input);
  return response.data.data;
}

export async function uploadWorkplaceGovernanceFloorPlanBackground(
  revisionId: string,
  version: number,
  changeSummary: string,
  file: File
) {
  const form = new FormData();
  form.set('file', file);
  const query = new URLSearchParams({ version: String(version), changeSummary });
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceGovernanceFloorPlanRevision>,
    FormData
  >(`${BASE}/floor-plan-revisions/${id(revisionId)}/background?${query.toString()}`, form);
  return response.data.data;
}

async function transitionFloorPlanRevision(
  revisionId: string,
  transition: 'review' | 'publish' | 'restore',
  version: number,
  reason: string
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceGovernanceFloorPlanRevision>,
    { version: number; reason: string }
  >(`${BASE}/floor-plan-revisions/${id(revisionId)}/${transition}`, { version, reason });
  return response.data.data;
}

export function submitWorkplaceGovernanceFloorPlanReview(
  revisionId: string,
  version: number,
  reason: string
) {
  return transitionFloorPlanRevision(revisionId, 'review', version, reason);
}

export function publishWorkplaceGovernanceFloorPlan(
  revisionId: string,
  version: number,
  reason: string
) {
  return transitionFloorPlanRevision(revisionId, 'publish', version, reason);
}

export function restoreWorkplaceGovernanceFloorPlanRevision(
  revisionId: string,
  version: number,
  reason: string
) {
  return transitionFloorPlanRevision(revisionId, 'restore', version, reason);
}

export async function getWorkplaceGovernanceFloorPlanProjection(floorId: string) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceGovernanceFloorPlanProjection>>(
    `${BASE}/floors/${id(floorId)}/projection`
  );
  return response.data.data;
}

export async function getWorkplaceGovernanceDelegatedScopes() {
  const response = await axiosInstance.get<ApiResponse<WorkplaceGovernanceDelegatedAdminScope[]>>(
    `${BASE}/delegated-admin-scopes`
  );
  return response.data.data;
}

export async function saveWorkplaceGovernanceDelegatedScope(
  delegationId: string | null,
  input: WorkplaceGovernanceDelegatedAdminScopeInput
) {
  const url = delegationId
    ? `${BASE}/delegated-admin-scopes/${id(delegationId)}`
    : `${BASE}/delegated-admin-scopes`;
  const response = delegationId
    ? await axiosInstance.put<
        ApiResponse<WorkplaceGovernanceDelegatedAdminScope>,
        WorkplaceGovernanceDelegatedAdminScopeInput
      >(url, input)
    : await axiosInstance.post<
        ApiResponse<WorkplaceGovernanceDelegatedAdminScope>,
        WorkplaceGovernanceDelegatedAdminScopeInput
      >(url, input);
  return response.data.data;
}

export async function getWorkplaceGovernanceEffectiveDelegatedScopes() {
  const response = await axiosInstance.get<
    ApiResponse<WorkplaceGovernanceEffectiveDelegatedScope[]>
  >(`${BASE}/delegated-admin-scopes/effective`);
  return response.data.data;
}
