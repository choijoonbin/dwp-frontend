import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';
import {
  assertAgentRevision,
  assertAgentUuid,
  isAgentDate,
  isAgentRecord,
} from './agent-governed-api';
import {
  productSurfaceGovernedMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';

export type DwaionProposalHandoffDraft = {
  draftId: string;
  handoffId: string;
  proposalId: string;
  handoffVersion: number;
  revision: number;
  reviewedInputs: Record<string, unknown>;
  contentSha256: string;
  savedAt: string;
};

const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;

export async function getDwaionProposalHandoffDraft(
  handoffId: string,
  signal?: AbortSignal
): Promise<DwaionProposalHandoffDraft | null> {
  assertAgentUuid(handoffId, 'Proposal handoff');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/agent/v1/proposal-handoffs/${encodeURIComponent(handoffId)}/drafts/current`,
    { signal }
  );
  return response.data.data === null ? null : parseDwaionProposalHandoffDraft(response.data.data);
}

export async function saveDwaionProposalHandoffDraft(
  handoffId: string,
  expectedVersion: number,
  reviewedInputs: Record<string, unknown>,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionProposalHandoffDraft> {
  assertAgentUuid(handoffId, 'Proposal handoff');
  assertAgentUuid(commandId, 'Proposal handoff draft command');
  assertAgentRevision(expectedVersion, 'Proposal handoff version', 1);
  if (!isJsonObject(reviewedInputs) || Object.keys(reviewedInputs).length > 20) {
    throw new TypeError('Proposal handoff draft inputs are invalid.');
  }
  const response = await axiosInstance.put<ApiResponse<unknown>, object>(
    `/api/agent/v1/proposal-handoffs/${encodeURIComponent(handoffId)}/drafts/current`,
    { commandId, expectedVersion, reviewedInputs },
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionProposalHandoffDraft(response.data.data);
}

export function parseDwaionProposalHandoffDraft(value: unknown): DwaionProposalHandoffDraft {
  if (
    !isAgentRecord(value) ||
    !UUID.test(String(value.draftId)) ||
    !UUID.test(String(value.handoffId)) ||
    !UUID.test(String(value.proposalId)) ||
    !Number.isSafeInteger(value.handoffVersion) ||
    Number(value.handoffVersion) < 1 ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 1 ||
    !isJsonObject(value.reviewedInputs) ||
    Object.keys(value.reviewedInputs).length > 20 ||
    typeof value.contentSha256 !== 'string' ||
    !SHA256.test(value.contentSha256) ||
    !isAgentDate(value.savedAt)
  ) {
    throw new HttpError('Proposal handoff draft response is invalid.', 502, value);
  }
  return value as DwaionProposalHandoffDraft;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return isAgentRecord(value) && Object.values(value).every((item) => isJsonValue(item));
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isAgentRecord(value) && Object.values(value).every(isJsonValue);
}
