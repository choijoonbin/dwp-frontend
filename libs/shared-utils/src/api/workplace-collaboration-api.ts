import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';
import type {
  WorkplaceGovernanceDelegatedAdminScope,
  WorkplaceGovernanceDelegatedAdminScopeInput,
  WorkplaceGovernanceSiteAccessDecision,
  WorkplaceGovernanceSiteAccessRule,
  WorkplaceGovernanceSiteAccessRuleInput,
  WorkplaceGovernancePolicyOverride,
  WorkplaceGovernancePolicyOverrideInput,
  WorkplaceGovernancePolicyScopeType,
} from './workplace-governance-api';
import type { WorkplacePolicy } from './workplace-api';

const MEMBER = '/api/platform/v1/workplace/experience/collaboration';
const ADMIN = '/api/platform/v1/admin/workplace/experience/collaboration';
const id = encodeURIComponent;

export type WorkplaceSharingVisibility = 'PRIVATE' | 'SITE' | 'FLOOR' | 'RESOURCE';
export type WorkplaceWorkMode = 'OFFICE' | 'REMOTE' | 'OFF';
export type WorkplaceWorkPlanInput = {
  planDate: string;
  mode: WorkplaceWorkMode;
  siteId: string | null;
  floorId: string | null;
  resourceId: string | null;
  groupRef: string | null;
  visibility: WorkplaceSharingVisibility;
  version: number | null;
};
export type WorkplaceWorkPlan = WorkplaceWorkPlanInput & { planId: string; version: number };
export type WorkplaceSharedWorkPlan = Omit<WorkplaceWorkPlan, 'groupRef' | 'version'> & {
  userId: number;
  displayName?: string | null;
  source: 'WORK_PLAN';
};
export type WorkplaceSharingPreference = {
  optIn: boolean;
  visibility: WorkplaceSharingVisibility;
  version: number;
};
export type WorkplaceSharingPolicy = {
  sharingEnabled: boolean;
  maximumVisibility: WorkplaceSharingVisibility;
  version: number;
};
export type WorkplaceConnectorKind =
  | 'CALENDAR'
  | 'ACTUAL_PRESENCE'
  | 'ACCESS_CONTROL'
  | 'SIGNAGE'
  | 'VISITOR'
  | 'VEHICLE'
  | 'FACILITY_WORK_ORDER';
export type WorkplaceConnectorStatus = {
  kind: WorkplaceConnectorKind;
  provider: string | null;
  status: 'NOT_CONFIGURED' | 'DISABLED' | 'CONFIGURED_UNVERIFIED';
  configurationReference: string | null;
  lastVerifiedAt: string | null;
  version: number;
};
export type WorkplaceCollaborationOverview = {
  shareableGroups: { groupRef: string; displayName: string | null }[];
  ownPlans: WorkplaceWorkPlan[];
  sharedPlans: WorkplaceSharedWorkPlan[];
  preference: WorkplaceSharingPreference;
  policy: WorkplaceSharingPolicy;
  actualPresence: WorkplaceConnectorStatus;
  generatedAt: string;
};
export type WorkplaceGovernanceExperienceOverview = {
  policy: WorkplaceSharingPolicy;
  connectors: WorkplaceConnectorStatus[];
  privacy: {
    bookingRetentionDays: number;
    legalHoldCount: number;
    anonymizedBookingCount: number;
    expiredEligibleBookingCount: number;
    facilityRequestEligibleRetentionCount: number;
    facilityClosureEligibleRetentionCount: number;
    facilityRequestsPurgedCount: number;
    facilityClosuresPurgedCount: number;
  };
  generatedAt: string;
};
export type WorkplaceGovernanceChangeInput<T> = { proposed: T; reason: string; confirmed: boolean };
export type WorkplaceGovernanceChangeReview<T> = {
  targetType: string;
  targetId: string | null;
  current: T | null;
  proposed: T;
  currentActorAccess: WorkplaceGovernanceSiteAccessDecision | null;
  proposedActorAccess?: WorkplaceGovernanceSiteAccessDecision | null;
  knownImpact: string[];
  warnings: string[];
  evaluatedAt: string;
};
export type WorkplaceResourcePhoto = {
  resourceId: string;
  url: string;
  altText: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  version: number;
};

export async function getWorkplaceCollaborationOverview(
  from: string,
  to: string,
  groupRef?: string
) {
  const query = new URLSearchParams({ from, to });
  if (groupRef) query.set('groupRef', groupRef);
  const response = await axiosInstance.get<ApiResponse<WorkplaceCollaborationOverview>>(
    `${MEMBER}/overview?${query}`
  );
  return response.data.data;
}
export async function saveWorkplaceWorkPlan(input: WorkplaceWorkPlanInput) {
  const response = await axiosInstance.post<ApiResponse<WorkplaceWorkPlan>, WorkplaceWorkPlanInput>(
    `${MEMBER}/work-plans`,
    input
  );
  return response.data.data;
}
export async function deleteWorkplaceWorkPlan(planId: string, version: number) {
  const response = await axiosInstance.delete<ApiResponse<{ removed: boolean }>>(
    `${MEMBER}/work-plans/${id(planId)}?version=${version}`
  );
  return response.data.data;
}
export async function saveWorkplaceSharingPreference(input: WorkplaceSharingPreference) {
  const response = await axiosInstance.put<
    ApiResponse<WorkplaceSharingPreference>,
    WorkplaceSharingPreference
  >(`${MEMBER}/sharing-preference`, input);
  return response.data.data;
}
export async function revokeWorkplaceSharingPreference(version: number) {
  const response = await axiosInstance.delete<ApiResponse<WorkplaceSharingPreference>>(
    `${MEMBER}/sharing-preference?version=${version}`
  );
  return response.data.data;
}
export async function getWorkplaceGovernanceExperienceOverview() {
  const response = await axiosInstance.get<ApiResponse<WorkplaceGovernanceExperienceOverview>>(
    `${ADMIN}/overview`
  );
  return response.data.data;
}
export async function saveWorkplaceSharingPolicy(
  input: WorkplaceSharingPolicy & { reason: string; confirmed: boolean }
) {
  const response = await axiosInstance.put<ApiResponse<WorkplaceSharingPolicy>, typeof input>(
    `${ADMIN}/policy`,
    input
  );
  return response.data.data;
}
export async function saveWorkplaceConnector(
  kind: WorkplaceConnectorKind,
  input: {
    provider: string;
    enabled: boolean;
    configurationReference: string | null;
    version: number;
    reason: string;
    confirmed: boolean;
  }
) {
  const response = await axiosInstance.put<ApiResponse<WorkplaceConnectorStatus>, typeof input>(
    `${ADMIN}/connectors/${kind}`,
    input
  );
  return response.data.data;
}
function rulePath(siteId: string, ruleId: string | null, action: 'review' | 'changes') {
  return `${ADMIN}/sites/${id(siteId)}/access-rules${ruleId ? `/${id(ruleId)}` : ''}/${action}`;
}
export async function reviewWorkplaceAccessRule(
  siteId: string,
  ruleId: string | null,
  input: WorkplaceGovernanceChangeInput<WorkplaceGovernanceSiteAccessRuleInput>
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceGovernanceChangeReview<WorkplaceGovernanceSiteAccessRuleInput>>,
    typeof input
  >(rulePath(siteId, ruleId, 'review'), input);
  return response.data.data;
}
export async function applyWorkplaceAccessRuleChange(
  siteId: string,
  ruleId: string | null,
  input: WorkplaceGovernanceChangeInput<WorkplaceGovernanceSiteAccessRuleInput>
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceGovernanceSiteAccessRule>,
    typeof input
  >(rulePath(siteId, ruleId, 'changes'), input);
  return response.data.data;
}
export async function reviewWorkplaceDelegation(
  delegationId: string | null,
  input: WorkplaceGovernanceChangeInput<WorkplaceGovernanceDelegatedAdminScopeInput>
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceGovernanceChangeReview<WorkplaceGovernanceDelegatedAdminScopeInput>>,
    typeof input
  >(`${ADMIN}/delegations${delegationId ? `/${id(delegationId)}` : ''}/review`, input);
  return response.data.data;
}
export async function applyWorkplaceDelegationChange(
  delegationId: string | null,
  input: WorkplaceGovernanceChangeInput<WorkplaceGovernanceDelegatedAdminScopeInput>
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceGovernanceDelegatedAdminScope>,
    typeof input
  >(`${ADMIN}/delegations${delegationId ? `/${id(delegationId)}` : ''}/changes`, input);
  return response.data.data;
}
export async function getWorkplaceResourcePhoto(
  resourceId: string,
  admin = false,
  expectedSha256?: string
) {
  const response = await axiosInstance.get<Blob>(
    `${admin ? ADMIN : MEMBER}/resources/${id(resourceId)}/photo`,
    { responseType: 'blob' }
  );
  if (expectedSha256) {
    const etag = response.headers?.get('ETag')?.replace(/^W\//, '').replaceAll('"', '');
    const actual =
      etag ??
      Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', await response.data.arrayBuffer())),
        (byte) => byte.toString(16).padStart(2, '0')
      ).join('');
    if (actual !== expectedSha256)
      throw new HttpError('Resource photo changed after metadata was read', 409);
  }
  return response.data;
}
export async function reviewWorkplaceBookingPolicy(
  input: WorkplaceGovernanceChangeInput<WorkplacePolicy>
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceGovernanceChangeReview<WorkplacePolicy>>,
    typeof input
  >(`${ADMIN}/booking-policy/review`, input);
  return response.data.data;
}
export async function applyWorkplaceBookingPolicyChange(
  input: WorkplaceGovernanceChangeInput<WorkplacePolicy>
) {
  const response = await axiosInstance.post<ApiResponse<WorkplacePolicy>, typeof input>(
    `${ADMIN}/booking-policy/changes`,
    input
  );
  return response.data.data;
}
function policyOverrideChangePath(
  overrideId: string | null,
  scopeType: WorkplaceGovernancePolicyScopeType,
  scopeId: string | null,
  action: 'review' | 'changes'
) {
  const query = new URLSearchParams({ scopeType });
  if (scopeId) query.set('scopeId', scopeId);
  return `${ADMIN}/policy-overrides${overrideId ? `/${id(overrideId)}` : ''}/${action}?${query}`;
}
export async function reviewWorkplacePolicyOverride(
  overrideId: string | null,
  scopeType: WorkplaceGovernancePolicyScopeType,
  scopeId: string | null,
  input: WorkplaceGovernanceChangeInput<WorkplaceGovernancePolicyOverrideInput>
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceGovernanceChangeReview<WorkplaceGovernancePolicyOverrideInput>>,
    typeof input
  >(policyOverrideChangePath(overrideId, scopeType, scopeId, 'review'), input);
  return response.data.data;
}
export async function applyWorkplacePolicyOverrideChange(
  overrideId: string | null,
  scopeType: WorkplaceGovernancePolicyScopeType,
  scopeId: string | null,
  input: WorkplaceGovernanceChangeInput<WorkplaceGovernancePolicyOverrideInput>
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceGovernancePolicyOverride>,
    typeof input
  >(policyOverrideChangePath(overrideId, scopeType, scopeId, 'changes'), input);
  return response.data.data;
}
export async function getWorkplaceResourcePhotoMetadata(resourceId: string, admin = false) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceResourcePhoto>>(
    `${admin ? ADMIN : MEMBER}/resources/${id(resourceId)}/photo/metadata`
  );
  return response.data.data;
}
export async function uploadWorkplaceResourcePhoto(
  resourceId: string,
  file: File,
  version: number,
  reason: string,
  altText: string
) {
  const form = new FormData();
  form.set('file', file);
  form.set('version', String(version));
  form.set('reason', reason);
  form.set('altText', altText);
  const response = await axiosInstance.post<ApiResponse<WorkplaceResourcePhoto>, FormData>(
    `${ADMIN}/resources/${id(resourceId)}/photo`,
    form
  );
  return response.data.data;
}
export async function deleteWorkplaceResourcePhoto(
  resourceId: string,
  version: number,
  reason: string
) {
  const query = new URLSearchParams({ version: String(version), reason });
  const response = await axiosInstance.delete<ApiResponse<{ removed: boolean }>>(
    `${ADMIN}/resources/${id(resourceId)}/photo?${query}`
  );
  return response.data.data;
}
