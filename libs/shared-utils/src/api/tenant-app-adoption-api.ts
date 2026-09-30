import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

const BASE = '/api/auth/admin/tenant-app-adoption';

export type TenantAppInstallation = {
  installationId: string;
  productKey: string;
  appResourceKey: string;
  installationKind: 'INTERNAL_AUTH_CONTROLLED' | 'EXTERNAL_SERVICE';
  lifecycleState: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ENABLED';
  externalExecutorState: 'NOT_REQUIRED' | 'UNAVAILABLE';
  seatCapacity?: number | null;
  reservedSeats: number;
  activeSeats: number;
  justification: string;
  requestedBy: number;
  submittedAt?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  decisionReason?: string | null;
  activatedBy?: number | null;
  activatedAt?: string | null;
  activationReceiptId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  allowedActions: Array<'SUBMIT' | 'APPROVE' | 'REJECT' | 'ACTIVATE' | 'REQUEST_ASSIGNMENT'>;
};

export type TenantAppAssignment = {
  assignmentId: string;
  installationId: string;
  productKey: string;
  userId: number;
  userDisplayName: string;
  lifecycleState: 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'DENIED' | 'REVOKED';
  seatQuantity: number;
  sourceType: string;
  externalSettlementState: 'NOT_REQUIRED' | 'UNAVAILABLE';
  validFrom?: string | null;
  validTo?: string | null;
  justification: string;
  requestedBy: number;
  approvedBy?: number | null;
  approvedAt?: string | null;
  decisionReason?: string | null;
  activatedBy?: number | null;
  activatedAt?: string | null;
  activationReceiptId?: string | null;
  revokedBy?: number | null;
  revokedAt?: string | null;
  revocationReason?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  allowedActions: Array<'APPROVE' | 'REJECT' | 'ACTIVATE' | 'REVOKE'>;
};

export type TenantAppAdoptionProjection = {
  observedAt: string;
  coverageState: 'COMPLETE_INTERNAL_OWNERS';
  includedOwners: string[];
  exclusions: string[];
  requestableAppResourceKeys: string[];
  installations: TenantAppInstallation[];
};

export type TenantCapabilityOverridePolicy = {
  contractKey: string;
  productKey: string;
  appResourceKey: string;
  surfaceKey: string;
  resolvedCapabilityCode: string;
  action: string;
  riskTier: string;
  contractOwner: string;
  activeBundleId: string;
  activeRevision: number;
  ruleKey: string;
  ruleVersion: number;
  overrideMode: 'OWNER_LOCKED' | 'ALLOW_DISABLE';
  maxDurationDays?: number | null;
  ruleOwner: string;
  reasonCode: string;
  planEligibilityState: 'UNAVAILABLE';
  allowedActions: Array<'REQUEST_DISABLE' | 'REQUEST_INHERIT'>;
};

export type TenantCapabilityOverrideChange = {
  overrideChangeId: string;
  contractKey: string;
  productKey: string;
  appResourceKey: string;
  policyRuleKey: string;
  policyRuleVersion: number;
  baseBundleId: string;
  baseActiveRevision: number;
  desiredState: 'DISABLED' | 'INHERIT';
  lifecycleState:
    'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'REVOKED' | 'SUPERSEDED';
  validTo?: string | null;
  justification: string;
  requestedBy: number;
  submittedAt?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  decisionReason?: string | null;
  activatedBy?: number | null;
  activatedAt?: string | null;
  activationReceiptId?: string | null;
  revokedBy?: number | null;
  revokedAt?: string | null;
  revocationReason?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  allowedActions: Array<'SUBMIT' | 'APPROVE' | 'REJECT' | 'ACTIVATE' | 'REVOKE'>;
};

export type TenantEffectiveCapability = {
  policy: TenantCapabilityOverridePolicy;
  baselineState: 'ENABLED';
  effectiveState: 'ENABLED' | 'DISABLED';
  effectiveSource: 'GLOBAL_AUTHORIZATION_BUNDLE' | 'TENANT_OVERRIDE';
  overrideState: 'OWNER_LOCKED' | 'TENANT_DISABLED' | 'EXPIRED' | 'INHERITED';
  activeOverride?: TenantCapabilityOverrideChange | null;
  lineage: Array<{
    level: 'BASELINE' | 'TENANT';
    ownerKey: string;
    state: string;
    reason: string;
    receiptId?: string | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  }>;
  evaluatedAt: string;
};

export type TenantCapabilityOverrideProjection = {
  observedAt: string;
  coverageState: 'COMPLETE_INTERNAL_OWNERS';
  includedOwners: string[];
  exclusions: string[];
  capabilities: TenantEffectiveCapability[];
  changes: TenantCapabilityOverrideChange[];
};

export async function getTenantAppAdoptionProjection(): Promise<TenantAppAdoptionProjection> {
  const response = await axiosInstance.get<ApiResponse<TenantAppAdoptionProjection>>(BASE);
  return response.data.data;
}

export async function getTenantCapabilityOverrideProjection(): Promise<TenantCapabilityOverrideProjection> {
  const response = await axiosInstance.get<ApiResponse<TenantCapabilityOverrideProjection>>(
    `${BASE}/capability-overrides`
  );
  return response.data.data;
}

export async function createTenantCapabilityOverride(payload: {
  contractKey: string;
  desiredState: 'DISABLED' | 'INHERIT';
  validTo?: string | null;
  justification: string;
}): Promise<TenantCapabilityOverrideChange> {
  const response = await axiosInstance.post<
    ApiResponse<TenantCapabilityOverrideChange>,
    typeof payload
  >(`${BASE}/capability-overrides`, payload);
  return response.data.data;
}

export async function submitTenantCapabilityOverride(
  change: TenantCapabilityOverrideChange
): Promise<TenantCapabilityOverrideChange> {
  const body = { version: change.version };
  const response = await axiosInstance.post<
    ApiResponse<TenantCapabilityOverrideChange>,
    typeof body
  >(`${BASE}/capability-overrides/${change.overrideChangeId}/submit`, body);
  return response.data.data;
}

export async function decideTenantCapabilityOverride(
  change: TenantCapabilityOverrideChange,
  decision: 'APPROVE' | 'REJECT',
  reason: string
): Promise<TenantCapabilityOverrideChange> {
  const body = { version: change.version, decision, reason };
  const response = await axiosInstance.post<
    ApiResponse<TenantCapabilityOverrideChange>,
    typeof body
  >(`${BASE}/capability-overrides/${change.overrideChangeId}/decision`, body);
  return response.data.data;
}

async function commandTenantCapabilityOverride(
  change: TenantCapabilityOverrideChange,
  command: 'activate' | 'revoke',
  reason: string
): Promise<TenantCapabilityOverrideChange> {
  const body = { version: change.version, reason };
  const response = await axiosInstance.post<
    ApiResponse<TenantCapabilityOverrideChange>,
    typeof body
  >(`${BASE}/capability-overrides/${change.overrideChangeId}/${command}`, body);
  return response.data.data;
}

export async function activateTenantCapabilityOverride(
  change: TenantCapabilityOverrideChange,
  reason: string
): Promise<TenantCapabilityOverrideChange> {
  return commandTenantCapabilityOverride(change, 'activate', reason);
}

export async function revokeTenantCapabilityOverride(
  change: TenantCapabilityOverrideChange,
  reason: string
): Promise<TenantCapabilityOverrideChange> {
  return commandTenantCapabilityOverride(change, 'revoke', reason);
}

export async function listTenantAppAssignments(
  installationId?: string
): Promise<TenantAppAssignment[]> {
  const query = installationId ? `?${new URLSearchParams({ installationId }).toString()}` : '';
  const response = await axiosInstance.get<ApiResponse<TenantAppAssignment[]>>(
    `${BASE}/assignments${query}`
  );
  return response.data.data;
}

export async function createTenantAppInstallation(payload: {
  productKey: string;
  appResourceKey: string;
  installationKind: TenantAppInstallation['installationKind'];
  seatCapacity?: number | null;
  justification: string;
}): Promise<TenantAppInstallation> {
  const response = await axiosInstance.post<ApiResponse<TenantAppInstallation>, typeof payload>(
    `${BASE}/installations`,
    payload
  );
  return response.data.data;
}

async function commandInstallation(
  installation: TenantAppInstallation,
  command: 'submit' | 'activate',
  reason?: string
): Promise<TenantAppInstallation> {
  const body = reason
    ? { version: installation.version, reason }
    : { version: installation.version };
  const response = await axiosInstance.post<ApiResponse<TenantAppInstallation>, typeof body>(
    `${BASE}/installations/${installation.installationId}/${command}`,
    body
  );
  return response.data.data;
}

export async function submitTenantAppInstallation(
  installation: TenantAppInstallation
): Promise<TenantAppInstallation> {
  return commandInstallation(installation, 'submit');
}

export async function decideTenantAppInstallation(
  installation: TenantAppInstallation,
  decision: 'APPROVE' | 'REJECT',
  reason: string
): Promise<TenantAppInstallation> {
  const body = { version: installation.version, decision, reason };
  const response = await axiosInstance.post<ApiResponse<TenantAppInstallation>, typeof body>(
    `${BASE}/installations/${installation.installationId}/decision`,
    body
  );
  return response.data.data;
}

export async function activateTenantAppInstallation(
  installation: TenantAppInstallation,
  reason: string
): Promise<TenantAppInstallation> {
  return commandInstallation(installation, 'activate', reason);
}

export async function createTenantAppAssignment(payload: {
  installationId: string;
  userId: number;
  validTo?: string | null;
  justification: string;
}): Promise<TenantAppAssignment> {
  const response = await axiosInstance.post<ApiResponse<TenantAppAssignment>, typeof payload>(
    `${BASE}/assignments`,
    payload
  );
  return response.data.data;
}

export async function decideTenantAppAssignment(
  assignment: TenantAppAssignment,
  decision: 'APPROVE' | 'REJECT',
  reason: string
): Promise<TenantAppAssignment> {
  const body = { version: assignment.version, decision, reason };
  const response = await axiosInstance.post<ApiResponse<TenantAppAssignment>, typeof body>(
    `${BASE}/assignments/${assignment.assignmentId}/decision`,
    body
  );
  return response.data.data;
}

async function commandAssignment(
  assignment: TenantAppAssignment,
  command: 'activate' | 'revoke',
  reason: string
): Promise<TenantAppAssignment> {
  const body = { version: assignment.version, reason };
  const response = await axiosInstance.post<ApiResponse<TenantAppAssignment>, typeof body>(
    `${BASE}/assignments/${assignment.assignmentId}/${command}`,
    body
  );
  return response.data.data;
}

export async function activateTenantAppAssignment(
  assignment: TenantAppAssignment,
  reason: string
): Promise<TenantAppAssignment> {
  return commandAssignment(assignment, 'activate', reason);
}

export async function revokeTenantAppAssignment(
  assignment: TenantAppAssignment,
  reason: string
): Promise<TenantAppAssignment> {
  return commandAssignment(assignment, 'revoke', reason);
}
