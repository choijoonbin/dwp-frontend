import { axiosInstance } from '../axios-instance';
import {
  adminV2Array,
  adminV2Identifier,
  adminV2Instant,
  adminV2Number,
  adminV2Record,
  adminV2Text,
  adminV2Version,
} from './approval-admin-v2-contract-core';
import { APPROVAL_ADMIN_V2_ENDPOINTS } from './approval-admin-v2-endpoints';

import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';
import type { ApiResponse } from '../types';

type Schemas = GatewayComponents['schemas'];
type ReadOptions = Readonly<{ contextScopeKey?: string; signal?: AbortSignal }>;

export type ApprovalDelegationTruth = 'VERIFIED' | 'VIOLATED' | 'NOT_VERIFIED';
export type ApprovalDelegationReviewDisposition = 'ACKNOWLEDGED_FINDINGS' | 'REMEDIATION_REQUESTED';

export type ApprovalDelegationGovernanceDetail = Readonly<{
  delegationId: string;
  delegatorUserId: number;
  delegateUserId: number;
  delegateDisplayName: string;
  delegateEmail: string;
  delegatedRoleCodes: readonly string[];
  scopeType: string;
  workflowId: string | null;
  workflowKey: string | null;
  startsAt: string;
  endsAt: string;
  lifecycleState: string;
  reason: string;
  version: number;
  effectiveState: 'SCHEDULED' | 'IN_EFFECT' | 'EXPIRED' | 'REVOKED';
  truths: Readonly<{
    scopeBinding: ApprovalDelegationTruth;
    timeWindow: ApprovalDelegationTruth;
    noSubDelegation: ApprovalDelegationTruth;
    identitySeparation: ApprovalDelegationTruth;
    roleSnapshot: ApprovalDelegationTruth;
    roleSeparationOfDuties: ApprovalDelegationTruth;
  }>;
  findings: readonly string[];
}>;

export type ApprovalDelegationGovernanceReview = Readonly<{
  reviewId: string;
  delegationId: string;
  delegationVersion: number;
  disposition: ApprovalDelegationReviewDisposition;
  complianceState: 'BLOCKED' | 'EVIDENCE_REQUIRED';
  findings: readonly string[];
  reviewEvidenceSha256: string;
  reviewedBy: number;
  reviewedAt: string;
}>;

export const APPROVAL_DELEGATION_GOVERNANCE_CAPABILITIES = Object.freeze({
  create: false,
  edit: false,
  revoke: false,
  cancel: false,
  killSwitch: false,
  review: true,
  audit: true,
});

function requestOptions(input: ReadOptions) {
  return {
    ...(input.contextScopeKey ? { contextScopeKey: input.contextScopeKey } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
    timeoutMs: 12_000,
  };
}

function enumValue<T extends string>(value: unknown, path: string, values: readonly T[]): T {
  const parsed = adminV2Text(value, path, { max: 80 });
  if (!values.includes(parsed as T)) throw new Error(`Invalid ${path}.`);
  return parsed as T;
}

function nullableIdentifier(value: unknown, path: string): string | null {
  return value == null ? null : adminV2Identifier(value, path);
}

function optionalText(value: unknown, path: string, max: number): string | null {
  return value == null ? null : adminV2Text(value, path, { max });
}

function truth(value: unknown, path: string): ApprovalDelegationTruth {
  return enumValue(value, path, ['VERIFIED', 'VIOLATED', 'NOT_VERIFIED'] as const);
}

function parseDetail(value: unknown): ApprovalDelegationGovernanceDetail {
  const record = adminV2Record(value, 'delegation');
  return {
    delegationId: adminV2Identifier(record.delegationId, 'delegation.delegationId'),
    delegatorUserId: adminV2Number(record.delegatorUserId, 'delegation.delegatorUserId', {
      min: 1,
      integer: true,
    }),
    delegateUserId: adminV2Number(record.delegateUserId, 'delegation.delegateUserId', {
      min: 1,
      integer: true,
    }),
    delegateDisplayName: adminV2Text(record.delegateDisplayName, 'delegation.delegateDisplayName', {
      max: 200,
    }),
    delegateEmail: adminV2Text(record.delegateEmail, 'delegation.delegateEmail', { max: 320 }),
    delegatedRoleCodes: adminV2Array(
      record.delegatedRoleCodes,
      'delegation.delegatedRoleCodes',
      (item, path) => adminV2Text(item, path, { max: 120 }),
      100
    ),
    scopeType: adminV2Text(record.scopeType, 'delegation.scopeType', { max: 40 }),
    workflowId: nullableIdentifier(record.workflowId, 'delegation.workflowId'),
    workflowKey: optionalText(record.workflowKey, 'delegation.workflowKey', 100),
    startsAt: adminV2Instant(record.startsAt, 'delegation.startsAt'),
    endsAt: adminV2Instant(record.endsAt, 'delegation.endsAt'),
    lifecycleState: adminV2Text(record.lifecycleState, 'delegation.lifecycleState', { max: 40 }),
    reason: adminV2Text(record.reason, 'delegation.reason', { max: 1000 }),
    version: adminV2Version(record.version, 'delegation.version'),
    effectiveState: enumValue(record.effectiveState, 'delegation.effectiveState', [
      'SCHEDULED',
      'IN_EFFECT',
      'EXPIRED',
      'REVOKED',
    ] as const),
    truths: {
      scopeBinding: truth(record.scopeBindingTruth, 'delegation.scopeBindingTruth'),
      timeWindow: truth(record.timeWindowTruth, 'delegation.timeWindowTruth'),
      noSubDelegation: truth(record.noSubDelegationTruth, 'delegation.noSubDelegationTruth'),
      identitySeparation: truth(
        record.identitySeparationTruth,
        'delegation.identitySeparationTruth'
      ),
      roleSnapshot: truth(record.roleSnapshotTruth, 'delegation.roleSnapshotTruth'),
      roleSeparationOfDuties: truth(
        record.roleSeparationOfDutiesTruth,
        'delegation.roleSeparationOfDutiesTruth'
      ),
    },
    findings: adminV2Array(
      record.findings,
      'delegation.findings',
      (item, path) => adminV2Text(item, path, { max: 1000 }),
      100
    ),
  };
}

function parseReview(value: unknown, path: string): ApprovalDelegationGovernanceReview {
  const record = adminV2Record(value, path);
  return {
    reviewId: adminV2Identifier(record.reviewId, `${path}.reviewId`),
    delegationId: adminV2Identifier(record.delegationId, `${path}.delegationId`),
    delegationVersion: adminV2Version(record.delegationVersion, `${path}.delegationVersion`),
    disposition: enumValue(record.disposition, `${path}.disposition`, [
      'ACKNOWLEDGED_FINDINGS',
      'REMEDIATION_REQUESTED',
    ] as const),
    complianceState: enumValue(record.complianceState, `${path}.complianceState`, [
      'BLOCKED',
      'EVIDENCE_REQUIRED',
    ] as const),
    findings: adminV2Array(
      record.findings,
      `${path}.findings`,
      (item, itemPath) => adminV2Text(item, itemPath, { max: 1000 }),
      100
    ),
    reviewEvidenceSha256: adminV2Text(record.reviewEvidenceSha256, `${path}.reviewEvidenceSha256`, {
      max: 64,
    }),
    reviewedBy: adminV2Number(record.reviewedBy, `${path}.reviewedBy`, {
      min: 1,
      integer: true,
    }),
    reviewedAt: adminV2Instant(record.reviewedAt, `${path}.reviewedAt`),
  };
}

export async function getApprovalDelegationGovernanceEvidence(
  delegationId: string,
  input: ReadOptions
) {
  const [detailResponse, reviewsResponse] = await Promise.all([
    axiosInstance.get<ApiResponse<unknown>>(
      APPROVAL_ADMIN_V2_ENDPOINTS.policies.delegation(delegationId),
      requestOptions(input)
    ),
    axiosInstance.get<ApiResponse<unknown>>(
      APPROVAL_ADMIN_V2_ENDPOINTS.policies.delegationReviews(delegationId),
      requestOptions(input)
    ),
  ]);
  const detail = parseDetail(detailResponse.data.data);
  if (detail.delegationId !== delegationId) throw new Error('Stale delegation evidence.');
  const reviews = adminV2Array(reviewsResponse.data.data, 'delegationReviews', parseReview, 500);
  if (reviews.some((review) => review.delegationId !== detail.delegationId)) {
    throw new Error('Stale delegation review evidence.');
  }
  return { detail, reviews } as const;
}

export function approvalDelegationReviewCommand(
  detail: ApprovalDelegationGovernanceDetail,
  disposition: ApprovalDelegationReviewDisposition,
  reviewEvidenceSha256: string,
  reviewId: string
): Schemas['approval_DelegationReviewCommand'] {
  const digest = reviewEvidenceSha256.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(digest))
    throw new Error('Invalid delegation review evidence digest.');
  return {
    reviewId: adminV2Identifier(reviewId, 'delegationReview.reviewId'),
    disposition,
    reviewEvidenceSha256: digest,
    expectedDelegationVersion: detail.version,
  };
}
