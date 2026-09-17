import { axiosInstance } from '../axios-instance';
import {
  adminV2Identifier,
  adminV2Record,
  adminV2Version,
} from './approval-admin-v2-contract-core';
import { APPROVAL_ADMIN_V2_ENDPOINTS } from './approval-admin-v2-endpoints';
import { approvalMutationExecutionConfig } from './approval-governed-mutation';

import type { ApiResponse } from '../types';
import type { ApprovalMutationExecution } from './approval-governed-mutation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CODE = /^[A-Z][A-Z0-9_]{1,99}$/u;
const REFERENCE = /^[A-Z][A-Z0-9_.:-]{1,159}$/u;
const IDEMPOTENCY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u;

export type ApprovalAdminV2GovernedOptions = Readonly<{
  idempotencyKey: string;
  beforeDispatch?: () => void;
}>;

export type ApprovalAdminV2DraftMetadata = Readonly<{
  formKey: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  ownerGroupRef: string;
  categoryKey: string;
  defaultWorkflowKey: string;
}>;

export type ApprovalAdminV2RoutingMemberDraft = Readonly<{
  memberId: string;
  kind: 'SUBJECT' | 'GROUP' | 'RESOLVER';
  userId: number | null;
  personPublicId: string | null;
  nestedGroupId: string | null;
  resolverId: string | null;
  priority: number;
  required: boolean;
}>;

export type ApprovalAdminV2RoutingGroupDraft = Readonly<{
  groupId: string;
  groupKey: string;
  displayName: string;
  description: string;
  lifecycle: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  effectiveFrom: string | null;
  effectiveTo: string | null;
  members: readonly ApprovalAdminV2RoutingMemberDraft[];
  expectedVersion: number;
}>;

function invalid(): never {
  throw new Error('Invalid Approval administration V2 governed command contract.');
}

function uuid(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID.test(normalized)) invalid();
  return normalized;
}

function code(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!CODE.test(normalized)) invalid();
  return normalized;
}

function reference(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!REFERENCE.test(normalized)) invalid();
  return normalized;
}

function text(value: string, max: number, allowEmpty = false): string {
  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > max) invalid();
  return normalized;
}

function version(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) invalid();
  return value;
}

function jsonObject(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    invalid();
  }
  if (!serialized || serialized.length > 1_000_000) invalid();
  const parsed: unknown = JSON.parse(serialized);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) invalid();
  return Object.freeze(parsed as Record<string, unknown>);
}

function metadata(value: ApprovalAdminV2DraftMetadata): ApprovalAdminV2DraftMetadata {
  return Object.freeze({
    formKey: code(value.formKey),
    nameKo: text(value.nameKo, 200),
    nameEn: text(value.nameEn, 200),
    descriptionKo: text(value.descriptionKo, 1000, true),
    descriptionEn: text(value.descriptionEn, 1000, true),
    ownerGroupRef: reference(value.ownerGroupRef),
    categoryKey: code(value.categoryKey),
    defaultWorkflowKey: code(value.defaultWorkflowKey),
  });
}

function settings(
  execution: ApprovalMutationExecution,
  expectedVersion: number,
  options: ApprovalAdminV2GovernedOptions
) {
  const expected = version(expectedVersion);
  if (!IDEMPOTENCY.test(options.idempotencyKey)) invalid();
  const secured =
    execution.mode === 'SECURE'
      ? { ...execution, objectVersion: expected, idempotencyKey: options.idempotencyKey }
      : execution;
  const config = approvalMutationExecutionConfig(secured, {
    objectVersionHeader: execution.mode === 'SECURE',
  });
  return {
    ...config,
    beforeDispatch: options.beforeDispatch,
    headers: {
      ...config.headers,
      'Idempotency-Key': options.idempotencyKey,
      'X-DWP-Expected-Object-Version': String(expected),
    },
  };
}

function workspaceReceipt(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    targetId: adminV2Identifier(record.formId, `${path}.formId`),
    version: adminV2Version(record.workspaceVersion, `${path}.workspaceVersion`),
  } as const;
}

export async function installApprovalTemplateDraft(
  input: ApprovalAdminV2DraftMetadata & {
    templateVersionId: string;
    expectedTemplateVersion: number;
  },
  execution: ApprovalMutationExecution,
  options: ApprovalAdminV2GovernedOptions
) {
  const body = {
    ...metadata(input),
    expectedTemplateVersion: version(input.expectedTemplateVersion),
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    APPROVAL_ADMIN_V2_ENDPOINTS.templates.installDraft(uuid(input.templateVersionId)),
    body,
    settings(execution, input.expectedTemplateVersion, options)
  );
  const installation = adminV2Record(response.data.data, 'templateInstallation');
  const receipt = workspaceReceipt(installation.draft, 'templateInstallation.draft');
  adminV2Identifier(installation.sourceTemplateId, 'templateInstallation.sourceTemplateId');
  const sourceVersionId = adminV2Identifier(
    installation.sourceTemplateVersionId,
    'templateInstallation.sourceTemplateVersionId'
  );
  if (sourceVersionId !== uuid(input.templateVersionId)) invalid();
  return receipt;
}

export async function saveApprovalFormStudioDraft(
  input: {
    formId: string;
    expectedWorkspaceVersion: number;
    schema: Readonly<Record<string, unknown>>;
  },
  execution: ApprovalMutationExecution,
  options: ApprovalAdminV2GovernedOptions
) {
  const formId = uuid(input.formId);
  const body = {
    expectedWorkspaceVersion: version(input.expectedWorkspaceVersion),
    schema: jsonObject(input.schema),
  };
  const response = await axiosInstance.put<ApiResponse<unknown>, typeof body>(
    APPROVAL_ADMIN_V2_ENDPOINTS.formStudio.updateDraft(formId),
    body,
    settings(execution, input.expectedWorkspaceVersion, options)
  );
  const receipt = workspaceReceipt(response.data.data, 'formWorkspace');
  if (receipt.targetId !== formId || receipt.version < input.expectedWorkspaceVersion) invalid();
  return receipt;
}

export async function cloneApprovalFormStudioDraft(
  input: ApprovalAdminV2DraftMetadata & {
    sourceFormId: string;
    expectedSourceWorkspaceVersion: number;
  },
  execution: ApprovalMutationExecution,
  options: ApprovalAdminV2GovernedOptions
) {
  const body = {
    ...metadata(input),
    expectedSourceWorkspaceVersion: version(input.expectedSourceWorkspaceVersion),
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    APPROVAL_ADMIN_V2_ENDPOINTS.formStudio.cloneDraft(uuid(input.sourceFormId)),
    body,
    settings(execution, input.expectedSourceWorkspaceVersion, options)
  );
  return workspaceReceipt(response.data.data, 'formWorkspace');
}

export async function saveApprovalRoutingGroup(
  input: ApprovalAdminV2RoutingGroupDraft,
  execution: ApprovalMutationExecution,
  options: ApprovalAdminV2GovernedOptions
) {
  const groupId = uuid(input.groupId);
  const body = Object.freeze({
    ...input,
    groupId,
    groupKey: code(input.groupKey),
    displayName: text(input.displayName, 200),
    description: text(input.description, 1000, true),
    expectedVersion: version(input.expectedVersion),
    members: input.members.map((member) => ({
      ...member,
      memberId: uuid(member.memberId),
      personPublicId: member.personPublicId ? uuid(member.personPublicId) : null,
      nestedGroupId: member.nestedGroupId ? uuid(member.nestedGroupId) : null,
      resolverId: member.resolverId ? uuid(member.resolverId) : null,
    })),
  });
  const response = await axiosInstance.put<ApiResponse<unknown>, typeof body>(
    APPROVAL_ADMIN_V2_ENDPOINTS.routing.group(groupId),
    body,
    settings(execution, input.expectedVersion, options)
  );
  const record = adminV2Record(response.data.data, 'routingGroup');
  const targetId = adminV2Identifier(record.groupId, 'routingGroup.groupId');
  const responseVersion = adminV2Version(record.version, 'routingGroup.version');
  if (targetId !== groupId || responseVersion < input.expectedVersion) invalid();
  return { targetId, version: responseVersion } as const;
}
