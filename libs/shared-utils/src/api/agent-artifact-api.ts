import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';
import {
  assertAgentUuid,
  expectAgentData,
  isAgentDate,
  isAgentRecord,
  newAgentCommand,
} from './agent-governed-api';
import {
  productSurfaceGovernedMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';

type AgentSchemas = AgentComponents['schemas'];

export type DwaionGovernedArtifact = AgentSchemas['GovernedArtifact'];
export type DwaionArtifactType = AgentSchemas['ArtifactType'];
export type DwaionArtifactDraftContent = AgentSchemas['ArtifactDraftContent'];
export type DwaionArtifactSourceReference = AgentSchemas['ArtifactSourceReference'];
export type DwaionArtifactVersionReceipt = AgentSchemas['ArtifactVersionReceipt'];
export type DwaionArtifactVersionSummary = AgentSchemas['ArtifactVersionSummary'];
export type DwaionArtifactVersionDetail = AgentSchemas['ArtifactVersionDetail'];
export type DwaionArtifactPreflightReceipt = AgentSchemas['ArtifactPreflightReceipt'];
export type DwaionArtifactPublicationReceipt = AgentSchemas['ArtifactPublicationReceipt'];
export type DwaionArtifactExportReceipt = AgentSchemas['ArtifactExportReceipt'];
export type DwaionArtifactExportFormat = AgentSchemas['ExportFormat'];

export type DwaionArtifactConversationSource = AgentSchemas['ArtifactConversationSource'];

export type CreateDwaionArtifactInput = {
  artifactType: DwaionArtifactType;
  content: DwaionArtifactDraftContent;
} & (
  | {
      sourceConversation: DwaionArtifactConversationSource;
      sources?: never;
    }
  | {
      sourceConversation?: never;
      sources?: DwaionArtifactSourceReference[];
    }
);

const ARTIFACT_BASE = '/api/agent/v1/artifacts';
const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;

export async function getDwaionArtifacts(): Promise<DwaionGovernedArtifact[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(ARTIFACT_BASE);
  return expectAgentData(
    response.data.data,
    (value): value is DwaionGovernedArtifact[] => Array.isArray(value) && value.every(isArtifact),
    'Governed artifact list response is invalid.'
  );
}

export async function getDwaionArtifact(artifactId: string): Promise<DwaionGovernedArtifact> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ARTIFACT_BASE}/${encodeArtifactId(artifactId)}`
  );
  return expectAgentData(response.data.data, isArtifact, 'Governed artifact response is invalid.');
}

export async function createDwaionArtifact(
  input: CreateDwaionArtifactInput,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionGovernedArtifact> {
  if (input.sourceConversation) {
    assertAgentUuid(
      input.sourceConversation.conversationId,
      'Artifact source conversation identifier'
    );
    assertAgentUuid(
      input.sourceConversation.assistantMessageId,
      'Artifact source assistant message identifier'
    );
  }
  const sourceConversation = input.sourceConversation
    ? {
        conversationId: input.sourceConversation.conversationId,
        assistantMessageId: input.sourceConversation.assistantMessageId,
      }
    : undefined;
  const body: AgentSchemas['CreateArtifactRequest'] = {
    ...newAgentCommand(0, 'USER_ARTIFACT_CREATE'),
    artifactType: input.artifactType,
    content: input.content,
    ...(sourceConversation ? { sourceConversation } : { sources: input.sources ?? [] }),
  };
  return mutateArtifact(ARTIFACT_BASE, body, 'post', authority);
}

export async function autosaveDwaionArtifact(
  artifactId: string,
  expectedRevision: number,
  content: DwaionArtifactDraftContent,
  sources: DwaionArtifactSourceReference[],
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionGovernedArtifact> {
  const body: AgentSchemas['AutosaveArtifactRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_ARTIFACT_AUTOSAVE'),
    content,
    sources,
  };
  return mutateArtifact(
    `${ARTIFACT_BASE}/${encodeArtifactId(artifactId)}/draft`,
    body,
    'put',
    authority
  );
}

export async function createDwaionArtifactVersion(
  artifactId: string,
  expectedRevision: number,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionArtifactVersionReceipt> {
  const body: AgentSchemas['CreateArtifactVersionRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_ARTIFACT_VERSION'),
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${ARTIFACT_BASE}/${encodeArtifactId(artifactId)}/versions`,
    body,
    productSurfaceGovernedMutationConfig(authority)
  );
  return expectAgentData(
    response.data.data,
    isVersionReceipt,
    'Artifact version response is invalid.'
  );
}

export async function getDwaionArtifactVersions(
  artifactId: string,
  limit = 20,
  beforeVersion?: number
): Promise<DwaionArtifactVersionSummary[]> {
  const params = new URLSearchParams({
    limit: String(Math.max(1, Math.min(50, Math.trunc(limit)))),
  });
  if (beforeVersion !== undefined) params.set('beforeVersion', String(beforeVersion));
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ARTIFACT_BASE}/${encodeArtifactId(artifactId)}/versions?${params.toString()}`
  );
  return expectAgentData(
    response.data.data,
    (value): value is DwaionArtifactVersionSummary[] =>
      Array.isArray(value) && value.every(isVersionSummary),
    'Artifact version list response is invalid.'
  );
}

export async function getDwaionArtifactVersion(
  artifactId: string,
  versionNumber: number
): Promise<DwaionArtifactVersionDetail> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ARTIFACT_BASE}/${encodeArtifactId(artifactId)}/versions/${assertVersion(versionNumber)}`
  );
  return expectAgentData(
    response.data.data,
    isVersionDetail,
    'Artifact version detail response is invalid.'
  );
}

export async function getCurrentDwaionArtifactPreflight(
  artifactId: string
): Promise<DwaionArtifactPreflightReceipt | null> {
  try {
    const response = await axiosInstance.get<ApiResponse<unknown>>(
      `${ARTIFACT_BASE}/${encodeArtifactId(artifactId)}/preflights/current`
    );
    return expectAgentData(
      response.data.data,
      isPreflight,
      'Artifact preflight response is invalid.'
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

export async function runDwaionArtifactPreflight(
  artifactId: string,
  expectedRevision: number,
  versionNumber: number,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionArtifactPreflightReceipt> {
  const body: AgentSchemas['RunArtifactPreflightRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_ARTIFACT_PREFLIGHT'),
    versionNumber: assertVersion(versionNumber),
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${ARTIFACT_BASE}/${encodeArtifactId(artifactId)}/preflights`,
    body,
    productSurfaceGovernedMutationConfig(authority)
  );
  return expectAgentData(
    response.data.data,
    isPreflight,
    'Artifact preflight response is invalid.'
  );
}

export async function publishDwaionArtifact(
  artifactId: string,
  expectedRevision: number,
  versionNumber: number,
  preflightId: string,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionArtifactPublicationReceipt> {
  assertAgentUuid(preflightId, 'Artifact preflight identifier');
  const body: AgentSchemas['PublishArtifactRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_ARTIFACT_PUBLISH'),
    versionNumber: assertVersion(versionNumber),
    preflightId,
    changeReason: 'The user explicitly published this governed artifact version.',
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${ARTIFACT_BASE}/${encodeArtifactId(artifactId)}/publish`,
    body,
    productSurfaceGovernedMutationConfig(authority)
  );
  return expectAgentData(
    response.data.data,
    isPublication,
    'Artifact publication response is invalid.'
  );
}

export async function requestDwaionArtifactExport(
  artifactId: string,
  expectedRevision: number,
  versionNumber: number,
  preflightId: string,
  exportFormat: DwaionArtifactExportFormat,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionArtifactExportReceipt> {
  assertAgentUuid(preflightId, 'Artifact preflight identifier');
  const body: AgentSchemas['ExportArtifactRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_ARTIFACT_EXPORT'),
    versionNumber: assertVersion(versionNumber),
    preflightId,
    exportFormat,
    changeReason: 'The user explicitly requested this governed artifact export.',
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${ARTIFACT_BASE}/${encodeArtifactId(artifactId)}/exports`,
    body,
    productSurfaceGovernedMutationConfig(authority)
  );
  const receipt = expectAgentData(
    response.data.data,
    isExportReceipt,
    'Artifact export response is invalid.'
  );
  if (
    receipt.artifactId !== artifactId ||
    receipt.versionNumber !== versionNumber ||
    receipt.exportFormat !== exportFormat
  ) {
    throw new HttpError('Artifact export response binding is invalid.', 502);
  }
  return receipt;
}

export async function getDwaionArtifactExport(
  artifactId: string,
  exportJobId: string
): Promise<DwaionArtifactExportReceipt> {
  assertAgentUuid(exportJobId, 'Artifact export identifier');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ARTIFACT_BASE}/${encodeArtifactId(artifactId)}/exports/${exportJobId}`
  );
  const receipt = expectAgentData(
    response.data.data,
    isExportReceipt,
    'Artifact export response is invalid.'
  );
  if (receipt.artifactId !== artifactId || receipt.exportJobId !== exportJobId) {
    throw new HttpError('Artifact export response binding is invalid.', 502);
  }
  return receipt;
}

export async function downloadDwaionArtifactExport(
  receipt: DwaionArtifactExportReceipt
): Promise<Blob> {
  if (!isExportReceipt(receipt) || !receipt.fileAvailable) {
    throw new TypeError('Artifact export file evidence is unavailable.');
  }
  assertAgentUuid(receipt.exportJobId, 'Artifact export identifier');
  const response = await axiosInstance.get<Blob>(
    `${ARTIFACT_BASE}/${encodeArtifactId(receipt.artifactId)}/exports/${receipt.exportJobId}/download`,
    { responseType: 'blob' }
  );
  if (
    response.data.size !== receipt.byteSize ||
    response.headers?.get('X-DWP-Content-Fingerprint') !== receipt.contentFingerprint
  ) {
    throw new HttpError('Artifact export file evidence does not match.', 502);
  }
  return response.data;
}

async function mutateArtifact(
  url: string,
  body: object,
  method: 'post' | 'put',
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionGovernedArtifact> {
  const config = productSurfaceGovernedMutationConfig(authority);
  const response =
    method === 'post'
      ? await axiosInstance.post<ApiResponse<unknown>, object>(url, body, config)
      : await axiosInstance.put<ApiResponse<unknown>, object>(url, body, config);
  return expectAgentData(response.data.data, isArtifact, 'Governed artifact response is invalid.');
}

function encodeArtifactId(artifactId: string): string {
  assertAgentUuid(artifactId, 'Artifact identifier');
  return encodeURIComponent(artifactId);
}

function assertVersion(value: number): number {
  if (!Number.isInteger(value) || value < 1) throw new TypeError('Artifact version is invalid.');
  return value;
}

function isArtifact(value: unknown): value is DwaionGovernedArtifact {
  return (
    isAgentRecord(value) &&
    typeof value.artifactId === 'string' &&
    typeof value.artifactType === 'string' &&
    typeof value.state === 'string' &&
    Number.isInteger(value.revision) &&
    Number.isInteger(value.draftRevision) &&
    isAgentRecord(value.content) &&
    typeof value.content.title === 'string' &&
    typeof value.content.body === 'string' &&
    Array.isArray(value.sources) &&
    isAgentRecord(value.capabilities) &&
    typeof value.capabilities.immutableVersionsAvailable === 'boolean' &&
    typeof value.capabilities.deterministicPreflightAvailable === 'boolean' &&
    typeof value.capabilities.personalPublishStateAvailable === 'boolean' &&
    typeof value.capabilities.exportRequestAvailable === 'boolean' &&
    typeof value.capabilities.exportExecutionAvailable === 'boolean' &&
    typeof value.capabilities.recipientSharingAvailable === 'boolean' &&
    typeof value.capabilities.externalSharingAvailable === 'boolean' &&
    typeof value.capabilities.sourceVerificationAvailable === 'boolean' &&
    typeof value.capabilities.sourceFreshnessAvailable === 'boolean' &&
    isAgentDate(value.createdAt) &&
    isAgentDate(value.updatedAt)
  );
}

function isVersionReceipt(value: unknown): value is DwaionArtifactVersionReceipt {
  return isVersionSummaryShape(value) && Number.isInteger(value.artifactRevision);
}

function isVersionSummary(value: unknown): value is DwaionArtifactVersionSummary {
  return isVersionSummaryShape(value);
}

function isVersionSummaryShape(value: unknown): value is Record<string, unknown> {
  return (
    isAgentRecord(value) &&
    typeof value.artifactId === 'string' &&
    Number.isInteger(value.versionNumber) &&
    typeof value.contentFingerprint === 'string' &&
    Number.isInteger(value.sourceCount) &&
    value.immutable === true &&
    isAgentDate(value.createdAt)
  );
}

function isVersionDetail(value: unknown): value is DwaionArtifactVersionDetail {
  return (
    isVersionSummaryShape(value) &&
    isAgentRecord(value.content) &&
    typeof value.content.title === 'string' &&
    typeof value.content.body === 'string' &&
    Array.isArray(value.sourceEvidence)
  );
}

function isPreflight(value: unknown): value is DwaionArtifactPreflightReceipt {
  return (
    isAgentRecord(value) &&
    typeof value.preflightId === 'string' &&
    typeof value.artifactId === 'string' &&
    Number.isInteger(value.artifactRevision) &&
    Number.isInteger(value.versionNumber) &&
    typeof value.outcome === 'string' &&
    Array.isArray(value.findings) &&
    isAgentDate(value.evaluatedAt) &&
    isAgentDate(value.expiresAt) &&
    typeof value.publishAllowed === 'boolean' &&
    typeof value.exportAllowed === 'boolean'
  );
}

function isPublication(value: unknown): value is DwaionArtifactPublicationReceipt {
  return (
    isAgentRecord(value) &&
    typeof value.artifactId === 'string' &&
    Number.isInteger(value.artifactRevision) &&
    Number.isInteger(value.publishedVersionNumber) &&
    value.publicationScope === 'PERSONAL_WORKSPACE_STATE_ONLY' &&
    value.recipientSharingPerformed === false &&
    value.externalWritePerformed === false
  );
}

function isExportReceipt(value: unknown): value is DwaionArtifactExportReceipt {
  return (
    isAgentRecord(value) &&
    typeof value.exportJobId === 'string' &&
    typeof value.artifactId === 'string' &&
    Number.isInteger(value.artifactRevision) &&
    Number.isInteger(value.versionNumber) &&
    ['MARKDOWN', 'DOCX', 'PDF'].includes(String(value.exportFormat)) &&
    ['PENDING', 'CLAIMED', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(
      String(value.state)
    ) &&
    typeof value.executionAvailable === 'boolean' &&
    typeof value.fileAvailable === 'boolean' &&
    value.fileAvailable === (value.state === 'SUCCEEDED') &&
    (value.fileAvailable
      ? typeof value.fileName === 'string' &&
        value.fileName.length > 0 &&
        typeof value.mediaType === 'string' &&
        value.mediaType.length > 0 &&
        Number.isInteger(value.byteSize) &&
        Number(value.byteSize) > 0 &&
        typeof value.contentFingerprint === 'string' &&
        /^[0-9a-f]{64}$/.test(value.contentFingerprint) &&
        isAgentDate(value.completedAt)
      : [value.fileName, value.mediaType, value.byteSize, value.contentFingerprint].every(
          (field) => field == null
        )) &&
    (value.state !== 'FAILED' || isAgentDate(value.completedAt)) &&
    value.externalWritePerformed === false
  );
}
