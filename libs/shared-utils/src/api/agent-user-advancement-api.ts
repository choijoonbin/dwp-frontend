import { API_URL, DWAION_ATTACHMENT_UPLOAD_ORIGINS } from '../env';
import { axiosInstance, putExternalBinary } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';
import { assertAgentRevision, assertAgentUuid } from './agent-governed-api';
import {
  productSurfaceGovernedMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';
import {
  parseDwaionProposalHandoff,
  parseDwaionAttachmentEvidence,
  parseDwaionResearchDelivery,
  parseDwaionResearchCapabilities,
  parseDwaionResearchPlan,
  parseDwaionResearchRun,
  parseDwaionSecureAttachment,
} from './agent-user-advancement-parser';

import type {
  CreateDwaionAttachmentOptions,
  DwaionCommandAttempt,
  DwaionAttachmentEvidence,
  DwaionProposalHandoff,
  DwaionResearchCommand,
  DwaionResearchCommandOptions,
  DwaionResearchDelivery,
  DwaionResearchCapabilities,
  DwaionResearchDeliveryType,
  DwaionResearchDownloadKind,
  DwaionResearchPlan,
  DwaionResearchPlanDefinition,
  DwaionResearchRun,
  DwaionSecureAttachment,
} from './agent-user-advancement-contract';

export type * from './agent-user-advancement-contract';

const ATTACHMENT_BASE = '/api/agent/v1/attachments';
const RESEARCH_BASE = '/api/agent/v1/research';
const PROPOSAL_BASE = '/api/agent/v1/proposals';
const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;

export async function createDwaionSecureAttachment(
  file: File,
  options: CreateDwaionAttachmentOptions
): Promise<DwaionSecureAttachment> {
  validateAttachmentFile(file);
  const authority = options.authority ?? LEGACY_AUTHORITY;
  const sourceSha256 = await sha256(file);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    ATTACHMENT_BASE,
    {
      commandId: checkedUuid(options.createCommandId, 'Attachment create command'),
      expectedRevision: 0,
      conversationId: options.conversationId ?? null,
      fileName: file.name,
      mediaType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      sourceSha256,
      retentionHours: options.retentionHours ?? 24,
    },
    { ...productSurfaceGovernedMutationConfig(authority), signal: options.signal }
  );
  const reserved = parseDwaionSecureAttachment(response.data.data);
  if (!reserved.uploadTicket) return reserved;

  const observation = await uploadAttachment(reserved.uploadTicket.uploadUrl, file, options);
  const completion = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${ATTACHMENT_BASE}/${encodeId(reserved.attachmentId)}/complete`,
    {
      commandId: checkedUuid(options.completeCommandId, 'Attachment complete command'),
      expectedRevision: reserved.revision,
      uploadReference: reserved.uploadTicket.uploadReference,
      observedSizeBytes: observation.sizeBytes,
      observedSha256: observation.sha256,
    },
    { ...productSurfaceGovernedMutationConfig(authority), signal: options.signal }
  );
  return parseDwaionSecureAttachment(completion.data.data);
}

export async function getDwaionSecureAttachment(
  attachmentId: string,
  signal?: AbortSignal
): Promise<DwaionSecureAttachment> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ATTACHMENT_BASE}/${encodeId(attachmentId)}`,
    { signal }
  );
  return parseDwaionSecureAttachment(response.data.data);
}

export async function getDwaionAttachmentEvidence(
  attachmentId: string,
  expectedSourceSha256: string,
  signal?: AbortSignal
): Promise<DwaionAttachmentEvidence> {
  if (!/^[0-9a-f]{64}$/u.test(expectedSourceSha256))
    throw new TypeError('Attachment evidence digest is invalid.');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ATTACHMENT_BASE}/${encodeId(attachmentId)}/evidence`,
    { signal }
  );
  const evidence = parseDwaionAttachmentEvidence(response.data.data);
  if (evidence.attachmentId !== attachmentId || evidence.sourceSha256 !== expectedSourceSha256) {
    throw new HttpError('Secure attachment evidence binding is invalid.', 502, evidence);
  }
  return evidence;
}

export async function deleteDwaionSecureAttachment(
  attachmentId: string,
  expectedRevision: number,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionSecureAttachment> {
  assertAgentRevision(expectedRevision, 'Attachment revision', 1);
  const response = await axiosInstance.deleteWithBody<ApiResponse<unknown>, object>(
    `${ATTACHMENT_BASE}/${encodeId(attachmentId)}`,
    {
      commandId: checkedUuid(commandId, 'Attachment delete command'),
      expectedRevision,
      reason: 'User requested permanent deletion from the DWAI.ON secure attachment tray.',
    },
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionSecureAttachment(response.data.data);
}

export async function createDwaionResearchPlan(
  definition: DwaionResearchPlanDefinition,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionResearchPlan> {
  validateResearchDefinition(definition);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${RESEARCH_BASE}/plans`,
    {
      commandId: checkedUuid(commandId, 'Research plan create command'),
      expectedRevision: 0,
      definition,
    },
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionResearchPlan(response.data.data);
}

export async function getDwaionResearchCapabilities(
  signal?: AbortSignal
): Promise<DwaionResearchCapabilities> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${RESEARCH_BASE}/capabilities`, {
    signal,
  });
  return parseDwaionResearchCapabilities(response.data.data);
}

export async function getDwaionResearchPlan(
  planId: string,
  signal?: AbortSignal
): Promise<DwaionResearchPlan> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${RESEARCH_BASE}/plans/${encodeId(planId)}`,
    { signal }
  );
  return parseDwaionResearchPlan(response.data.data);
}

export async function updateDwaionResearchPlan(
  planId: string,
  expectedRevision: number,
  definition: DwaionResearchPlanDefinition,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionResearchPlan> {
  validateResearchDefinition(definition);
  const response = await axiosInstance.put<ApiResponse<unknown>, object>(
    `${RESEARCH_BASE}/plans/${encodeId(planId)}`,
    {
      commandId: checkedUuid(commandId, 'Research plan update command'),
      expectedRevision,
      definition,
    },
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionResearchPlan(response.data.data);
}

export async function startDwaionResearchRun(
  planId: string,
  expectedPlanRevision: number,
  attempt: DwaionCommandAttempt,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionResearchRun> {
  assertAgentRevision(expectedPlanRevision, 'Research plan revision', 1);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${RESEARCH_BASE}/plans/${encodeId(planId)}/runs`,
    {
      commandId: checkedUuid(attempt.commandId, 'Research run command'),
      expectedPlanRevision,
      idempotencyKey: checkedUuid(attempt.idempotencyKey, 'Research run idempotency key'),
    },
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionResearchRun(response.data.data);
}

export async function getDwaionResearchRun(
  runId: string,
  signal?: AbortSignal
): Promise<DwaionResearchRun> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${RESEARCH_BASE}/runs/${encodeId(runId)}`,
    { signal }
  );
  return parseDwaionResearchRun(response.data.data);
}

export async function downloadDwaionResearchRun(
  runId: string,
  kind: DwaionResearchDownloadKind
): Promise<Blob> {
  assertAgentUuid(runId, 'Research run identifier');
  const accept =
    kind === 'audit'
      ? 'application/x-ndjson'
      : kind === 'pdf'
        ? 'application/pdf'
        : 'application/json';
  const response = await axiosInstance.get<Blob>(
    `${RESEARCH_BASE}/runs/${encodeId(runId)}/downloads/${kind}`,
    { responseType: 'blob', headers: { Accept: accept } }
  );
  if (!(response.data instanceof Blob) || response.data.size < 1) {
    throw new HttpError('Research download response is empty or invalid.', 502);
  }
  return response.data;
}

export async function executeDwaionResearchRun(
  runId: string,
  expectedVersion: number,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionResearchRun> {
  assertAgentRevision(expectedVersion, 'Research run version', 1);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${RESEARCH_BASE}/runs/${encodeId(runId)}/execute`,
    {
      commandId: checkedUuid(commandId, 'Research execution command'),
      expectedVersion,
    },
    productSurfaceGovernedMutationConfig(authority)
  );
  const run = parseDwaionResearchRun(response.data.data);
  if (run.runId !== runId)
    throw new HttpError('Research execution response binding is invalid.', 502);
  return run;
}

export async function commandDwaionResearchRun(
  runId: string,
  expectedVersion: number,
  action: DwaionResearchCommand,
  options: DwaionResearchCommandOptions,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionResearchRun> {
  if (options.reason.trim().length < 5) throw new TypeError('Research command reason is required.');
  if (['EXCLUDE_SOURCE_AND_CONTINUE', 'REPROBE_SOURCE'].includes(action) && !options.sourceKey)
    throw new TypeError('Research source key is required for this command.');
  if (action === 'EXTEND' && !options.extensionMinutes)
    throw new TypeError('Research extension duration is required.');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${RESEARCH_BASE}/runs/${encodeId(runId)}/commands`,
    {
      commandId: checkedUuid(options.commandId, 'Research command'),
      expectedVersion,
      action,
      reason: options.reason.trim(),
      sourceKey: options.sourceKey ?? null,
      extensionMinutes: options.extensionMinutes ?? null,
    },
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionResearchRun(response.data.data);
}

export async function createDwaionResearchDelivery(
  runId: string,
  expectedVersion: number,
  deliveryType: DwaionResearchDeliveryType,
  attempt: DwaionCommandAttempt,
  parameters: Record<string, unknown> = {},
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionResearchDelivery> {
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${RESEARCH_BASE}/runs/${encodeId(runId)}/${DELIVERY_PATHS[deliveryType]}`,
    {
      commandId: checkedUuid(attempt.commandId, 'Research delivery command'),
      expectedVersion,
      idempotencyKey: checkedUuid(attempt.idempotencyKey, 'Research delivery idempotency key'),
      parameters,
    },
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionResearchDelivery(response.data.data);
}

export async function getDwaionResearchDelivery(
  runId: string,
  deliveryId: string,
  signal?: AbortSignal
): Promise<DwaionResearchDelivery> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${RESEARCH_BASE}/runs/${encodeId(runId)}/deliveries/${encodeId(deliveryId)}`,
    { signal }
  );
  return parseDwaionResearchDelivery(response.data.data);
}

export async function getDwaionResearchDeliveries(
  runId: string,
  signal?: AbortSignal
): Promise<DwaionResearchDelivery[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${RESEARCH_BASE}/runs/${encodeId(runId)}/deliveries`,
    { signal }
  );
  if (!Array.isArray(response.data.data))
    throw new HttpError('Deep research delivery list response is invalid.', 502, response.data);
  return response.data.data.map(parseDwaionResearchDelivery);
}

export async function createDwaionProposalHandoff(
  proposalId: string,
  expectedVersion: number,
  reviewedInputs: Record<string, unknown>,
  attempt: DwaionCommandAttempt,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionProposalHandoff> {
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${PROPOSAL_BASE}/${encodeId(proposalId)}/handoff`,
    {
      commandId: checkedUuid(attempt.commandId, 'Proposal handoff command'),
      expectedVersion,
      idempotencyKey: checkedUuid(attempt.idempotencyKey, 'Proposal handoff idempotency key'),
      reviewedInputs,
    },
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionProposalHandoff(response.data.data);
}

export async function getDwaionProposalHandoff(
  proposalId: string,
  signal?: AbortSignal
): Promise<DwaionProposalHandoff> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${PROPOSAL_BASE}/${encodeId(proposalId)}/handoff`,
    { signal }
  );
  return parseDwaionProposalHandoff(response.data.data);
}

export async function getDwaionProposalHandoffById(
  handoffId: string,
  signal?: AbortSignal
): Promise<DwaionProposalHandoff> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/agent/v1/proposal-handoffs/${encodeId(handoffId)}`,
    { signal }
  );
  return parseDwaionProposalHandoff(response.data.data);
}

async function uploadAttachment(
  uploadUrl: string,
  file: File,
  options: CreateDwaionAttachmentOptions
): Promise<{ sizeBytes: number; sha256: string }> {
  const target = secureAttachmentUploadUrl(uploadUrl);
  options.onUploadProgress?.(0, file.size);
  const response = await putExternalBinary(target, file, pageOrigin(), options.signal);
  if (!response.ok) throw new HttpError('Secure attachment upload failed.', response.status);
  const observedSize = response.headers.get('X-DWP-Observed-Size');
  const observedSha256 = response.headers.get('X-DWP-Observed-SHA256');
  const sizeBytes = observedSize === null ? file.size : Number(observedSize);
  const digest = observedSha256 ?? (await sha256(file));
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || !/^[0-9a-f]{64}$/u.test(digest))
    throw new HttpError('Secure attachment upload evidence is invalid.', 502);
  options.onUploadProgress?.(file.size, file.size);
  return { sizeBytes, sha256: digest };
}

export function secureAttachmentUploadUrl(value: string): URL {
  const origin = pageOrigin();
  const apiBase = API_URL || origin;
  let target: URL;
  try {
    target = new URL(value, apiBase);
  } catch {
    throw new HttpError('Attachment upload target is invalid.', 502);
  }
  const allowed = new Set([origin, apiOrigin(), ...DWAION_ATTACHMENT_UPLOAD_ORIGINS]);
  const trustedLoopbackApi = target.origin === apiOrigin() && isLoopbackHttp(target);
  if (
    !allowed.has(target.origin) ||
    (target.protocol !== 'https:' && target.origin !== origin && !trustedLoopbackApi)
  )
    throw new HttpError('Attachment upload target is not trusted.', 502);
  if (target.username || target.password || target.hash)
    throw new HttpError('Attachment upload target contains unsafe URL data.', 502);
  return target;
}

async function sha256(file: Blob): Promise<string> {
  const bytes = Uint8Array.from(new Uint8Array(await file.arrayBuffer()));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validateAttachmentFile(file: File): void {
  if (!file.name.trim() || /[/\\\0]/u.test(file.name) || file.size <= 0)
    throw new TypeError('Attachment file is invalid.');
  if (file.size > 100 * 1024 * 1024) throw new TypeError('Attachment exceeds the 100 MB limit.');
}

function validateResearchDefinition(value: DwaionResearchPlanDefinition): void {
  if (value.goal.trim().length < 10 || value.goal.length > 4_000)
    throw new TypeError('Research goal must contain between 10 and 4,000 characters.');
  if (value.question.trim().length < 10 || value.question.length > 4_000)
    throw new TypeError('Research question must contain between 10 and 4,000 characters.');
  if (
    !value.successCriteria.length ||
    !value.deliverableTypes.length ||
    !value.sourcePolicies.length
  )
    throw new TypeError('Research criteria and source policies are required.');
  if (
    new Set(value.deliverableTypes).size !== value.deliverableTypes.length ||
    value.deliverableTypes.some(
      (item) => !['REPORT', 'EXECUTIVE_SUMMARY', 'COMPARISON', 'SOURCE_MAP'].includes(item)
    )
  )
    throw new TypeError('Research deliverable types are invalid.');
  if (typeof value.requireAllAllowedSources !== 'boolean')
    throw new TypeError('Research source completion policy is required.');
  if (!value.sourcePolicies.some((source) => source.allowed))
    throw new TypeError('At least one research source must be allowed.');
  const { maximumMinutes, maximumSources, maximumTokens } = value.budget;
  if (
    !Number.isInteger(maximumMinutes) ||
    maximumMinutes < 1 ||
    maximumMinutes > 240 ||
    !Number.isInteger(maximumSources) ||
    maximumSources < 1 ||
    maximumSources > 500 ||
    !Number.isInteger(maximumTokens) ||
    maximumTokens < 128 ||
    maximumTokens > 2_000_000
  )
    throw new TypeError('Research budget is invalid.');
}

function encodeId(id: string): string {
  assertAgentUuid(id, 'DWAI.ON resource identifier');
  return encodeURIComponent(id);
}

export function newDwaionCommandAttempt(): DwaionCommandAttempt {
  return {
    commandId: globalThis.crypto.randomUUID(),
    idempotencyKey: globalThis.crypto.randomUUID(),
  };
}

function checkedUuid(value: string, label: string): string {
  assertAgentUuid(value, label);
  return value;
}

function pageOrigin(): string {
  return globalThis.location?.origin || apiOrigin();
}
function apiOrigin(): string {
  try {
    return new URL(API_URL || 'http://localhost').origin;
  } catch {
    return 'http://localhost';
  }
}

function isLoopbackHttp(value: URL): boolean {
  return value.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(value.hostname);
}

const DELIVERY_PATHS: Record<DwaionResearchDeliveryType, string> = {
  ARTIFACT: 'artifact',
  PROPOSAL: 'proposal',
  EXPORT: 'exports',
  HANDOFF: 'handoffs',
  SHARE: 'shares',
  ROUTINE: 'routines',
};
