import { axiosInstance } from '../axios-instance';
import { adminV2Identifier, adminV2Record } from './approval-admin-v2-contract-core';
import { APPROVAL_ADMIN_V2_ENDPOINTS } from './approval-admin-v2-endpoints';
import { approvalMutationExecutionConfig } from './approval-governed-mutation';

import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';
import type { ApiResponse } from '../types';
import type { ApprovalMutationExecution } from './approval-governed-mutation';

type Schemas = GatewayComponents['schemas'];
type Method = 'POST' | 'PUT';

export const APPROVAL_ADMIN_V2_UNSUPPORTED_MUTATION_API_FUNCTIONS = [
  'cloneApprovalFormStudioDraft',
  'archiveApprovalFormStudioDraft',
  'saveApprovalAutomationCalendar',
  'saveApprovalAutomationChannel',
  'recordApprovalAutomationChannelObservation',
  'saveApprovalAutomationPolicyDraft',
  'saveApprovalRoutingResolver',
  'recordApprovalRoutingResolverObservation',
  'recordApprovalRoutingGroupUsage',
] as const;

function invalid(): never {
  throw new Error('Invalid Approval administration V2 canonical mutation contract.');
}

function expectedVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) invalid();
  return value;
}

function identifier(value: string, path: string): string {
  return adminV2Identifier(value, path);
}

function assertBodyVersion(body: object, expectedObjectVersion: number): void {
  const record = body as Record<string, unknown>;
  const candidates = [
    'expectedWorkspaceVersion',
    'expectedVersion',
    'expectedDelegationVersion',
    'expectedTemplateVersion',
    'expectedGroupVersion',
  ].flatMap((key) => (record[key] == null ? [] : [record[key]]));
  if (
    candidates.length !== 1 ||
    expectedVersion(candidates[0] as number) !== expectedObjectVersion
  ) {
    invalid();
  }
}

function assertBodyIdentifier(body: object, key: string, expected: string): void {
  const record = body as Record<string, unknown>;
  if (record[key] == null) return;
  if (adminV2Identifier(record[key], `body.${key}`) !== expected) invalid();
}

function securedExecution(
  execution: ApprovalMutationExecution,
  expectedObjectVersion: number
): Extract<ApprovalMutationExecution, { mode: 'SECURE' }> {
  const expected = expectedVersion(expectedObjectVersion);
  if (
    execution.mode !== 'SECURE' ||
    execution.objectVersion !== expected ||
    !execution.idempotencyKey?.trim()
  ) {
    invalid();
  }
  return execution;
}

async function approvalAdminV2CanonicalMutation<TBody extends object>(
  method: Method,
  path: string,
  body: TBody,
  expectedObjectVersion: number,
  execution: ApprovalMutationExecution
) {
  const expected = expectedVersion(expectedObjectVersion);
  assertBodyVersion(body, expected);
  const authority = securedExecution(execution, expected);
  const config = {
    ...approvalMutationExecutionConfig(authority, { objectVersionHeader: true }),
    csrfReplay: 'NEVER' as const,
  };
  const payload = structuredClone(body);
  const response =
    method === 'PUT'
      ? await axiosInstance.put<ApiResponse<unknown>, TBody>(path, payload, config)
      : await axiosInstance.post<ApiResponse<unknown>, TBody>(path, payload, config);
  return adminV2Record(response.data.data, 'approvalAdminV2Mutation');
}

export function archiveApprovalFormStudioDraft(
  formId: string,
  body: Schemas['approval_ArchiveDraftRequest'],
  expectedObjectVersion: number,
  execution: ApprovalMutationExecution
) {
  return approvalAdminV2CanonicalMutation(
    'POST',
    APPROVAL_ADMIN_V2_ENDPOINTS.formStudio.archive(identifier(formId, 'formId')),
    body,
    expectedObjectVersion,
    execution
  );
}

export function saveApprovalAutomationCalendar(
  calendarId: string,
  body: Schemas['approval_CalendarDraft'],
  expectedObjectVersion: number,
  execution: ApprovalMutationExecution
) {
  const targetId = identifier(calendarId, 'calendarId');
  assertBodyIdentifier(body, 'calendarId', targetId);
  return approvalAdminV2CanonicalMutation(
    'PUT',
    APPROVAL_ADMIN_V2_ENDPOINTS.policies.calendar(targetId),
    body,
    expectedObjectVersion,
    execution
  );
}

export function saveApprovalAutomationChannel(
  channelId: string,
  body: Schemas['approval_ChannelDraft'],
  expectedObjectVersion: number,
  execution: ApprovalMutationExecution
) {
  const targetId = identifier(channelId, 'channelId');
  assertBodyIdentifier(body, 'channelId', targetId);
  return approvalAdminV2CanonicalMutation(
    'PUT',
    APPROVAL_ADMIN_V2_ENDPOINTS.policies.channel(targetId),
    body,
    expectedObjectVersion,
    execution
  );
}

export function recordApprovalAutomationChannelObservation(
  channelId: string,
  body: Schemas['approval_ChannelObservation'],
  expectedObjectVersion: number,
  execution: ApprovalMutationExecution
) {
  return approvalAdminV2CanonicalMutation(
    'POST',
    APPROVAL_ADMIN_V2_ENDPOINTS.policies.channelObservations(identifier(channelId, 'channelId')),
    body,
    expectedObjectVersion,
    execution
  );
}

export function saveApprovalAutomationPolicyDraft(
  policyId: string,
  body: Schemas['approval_PolicyDraft'],
  expectedObjectVersion: number,
  execution: ApprovalMutationExecution
) {
  const targetId = identifier(policyId, 'policyId');
  assertBodyIdentifier(body, 'policyId', targetId);
  return approvalAdminV2CanonicalMutation(
    'PUT',
    APPROVAL_ADMIN_V2_ENDPOINTS.policies.ruleDraft(targetId),
    body,
    expectedObjectVersion,
    execution
  );
}

export function reviewApprovalAutomationDelegation(
  delegationId: string,
  body: Schemas['approval_DelegationReviewCommand'],
  expectedObjectVersion: number,
  execution: ApprovalMutationExecution
) {
  return approvalAdminV2CanonicalMutation(
    'POST',
    APPROVAL_ADMIN_V2_ENDPOINTS.policies.delegationReviews(
      identifier(delegationId, 'delegationId')
    ),
    body,
    expectedObjectVersion,
    execution
  );
}

export function saveApprovalRoutingResolver(
  resolverId: string,
  body: Schemas['approval_ResolverDraft'],
  expectedObjectVersion: number,
  execution: ApprovalMutationExecution
) {
  const targetId = identifier(resolverId, 'resolverId');
  assertBodyIdentifier(body, 'resolverId', targetId);
  return approvalAdminV2CanonicalMutation(
    'PUT',
    APPROVAL_ADMIN_V2_ENDPOINTS.routing.resolver(targetId),
    body,
    expectedObjectVersion,
    execution
  );
}

export function recordApprovalRoutingResolverObservation(
  resolverId: string,
  body: Schemas['approval_SourceObservation'],
  expectedObjectVersion: number,
  execution: ApprovalMutationExecution
) {
  return approvalAdminV2CanonicalMutation(
    'POST',
    APPROVAL_ADMIN_V2_ENDPOINTS.routing.resolverObservations(identifier(resolverId, 'resolverId')),
    body,
    expectedObjectVersion,
    execution
  );
}

export function recordApprovalRoutingGroupUsage(
  groupId: string,
  body: Schemas['approval_Usage'],
  expectedObjectVersion: number,
  execution: ApprovalMutationExecution
) {
  const targetId = identifier(groupId, 'groupId');
  assertBodyIdentifier(body, 'groupId', targetId);
  return approvalAdminV2CanonicalMutation(
    'POST',
    APPROVAL_ADMIN_V2_ENDPOINTS.routing.groupUsages(targetId),
    body,
    expectedObjectVersion,
    execution
  );
}

export function cloneApprovalTemplateDraft(
  templateId: string,
  body: Schemas['approval_CloneDraftRequest'],
  expectedObjectVersion: number,
  execution: ApprovalMutationExecution
) {
  return approvalAdminV2CanonicalMutation(
    'POST',
    APPROVAL_ADMIN_V2_ENDPOINTS.templates.cloneDraft(identifier(templateId, 'templateId')),
    body,
    expectedObjectVersion,
    execution
  );
}
