import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';

type AgentSchemas = AgentComponents['schemas'];

export type DwaionProposal = AgentSchemas['AgentProposal'];
export type DwaionProposalDecision = AgentSchemas['ProposalDecision'];
export type DwaionProposalInboxPage = AgentSchemas['ProposalInboxPage'];
export type DwaionProposalInboxView = AgentSchemas['ProposalInboxView'];
export type DwaionProposalDecisionReceipt = AgentSchemas['ProposalDecisionReceipt'];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const VIEWS = new Set<DwaionProposalInboxView>(['ACTIVE', 'SNOOZED', 'HANDLED', 'ALL']);
const STATES = new Set(['PENDING', 'SNOOZED', 'ACCEPTED', 'DISMISSED', 'EXPIRED']);
const PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const KINDS = new Set(['WORK_SIGNAL', 'RISK', 'SCHEDULE', 'APPROVAL', 'INSIGHT']);

export async function getDwaionProposals(
  view: DwaionProposalInboxView = 'ACTIVE',
  limit = 50,
  cursor?: string
): Promise<DwaionProposalInboxPage> {
  if (!VIEWS.has(view)) throw new TypeError('Agent proposal inbox view is invalid.');
  const params = new URLSearchParams({
    view,
    limit: String(Math.max(1, Math.min(Math.trunc(limit), 100))),
  });
  if (cursor?.trim()) params.set('cursor', cursor.trim());
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/agent/v1/proposals?${params.toString()}`
  );
  if (!isProposalInboxPage(response.data.data)) {
    throw new HttpError('Agent proposal inbox response is invalid.', 502, response.data);
  }
  return response.data.data;
}

export async function decideDwaionProposal(
  proposalId: string,
  decision: DwaionProposalDecision,
  expectedRevision: number,
  snoozeUntil?: string
): Promise<DwaionProposalDecisionReceipt> {
  if (!UUID_PATTERN.test(proposalId)) throw new TypeError('Agent proposal identifier is invalid.');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new TypeError('Agent proposal revision is invalid.');
  }
  if (decision === 'SNOOZE' && (!snoozeUntil || Number.isNaN(Date.parse(snoozeUntil)))) {
    throw new TypeError('Agent proposal snooze time is invalid.');
  }
  const body: AgentSchemas['DecideAgentProposalRequest'] = {
    commandId: globalThis.crypto.randomUUID(),
    expectedRevision,
    decision,
    snoozeUntil: decision === 'SNOOZE' ? snoozeUntil! : null,
    note: null,
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `/api/agent/v1/proposals/${encodeURIComponent(proposalId)}/decisions`,
    body
  );
  if (!isProposalDecisionReceipt(response.data.data)) {
    throw new HttpError('Agent proposal decision response is invalid.', 502, response.data);
  }
  return response.data.data;
}

function isProposalInboxPage(value: unknown): value is DwaionProposalInboxPage {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.summary)) return false;
  return (
    value.items.every(isProposal) &&
    isCount(value.summary.active) &&
    isCount(value.summary.highPriority) &&
    isCount(value.summary.snoozed) &&
    isCount(value.summary.handled) &&
    (value.nextCursor === null || typeof value.nextCursor === 'string')
  );
}

function isProposalDecisionReceipt(value: unknown): value is DwaionProposalDecisionReceipt {
  return (
    isRecord(value) && isProposal(value.proposal) && typeof value.actionReviewRequired === 'boolean'
  );
}

function isProposal(value: unknown): value is DwaionProposal {
  if (!isRecord(value) || !isRecord(value.content)) return false;
  return (
    typeof value.proposalId === 'string' &&
    UUID_PATTERN.test(value.proposalId) &&
    typeof value.kind === 'string' &&
    KINDS.has(value.kind) &&
    typeof value.priority === 'string' &&
    PRIORITIES.has(value.priority) &&
    typeof value.state === 'string' &&
    STATES.has(value.state) &&
    Number.isInteger(value.revision) &&
    Number(value.revision) >= 1 &&
    typeof value.agentKey === 'string' &&
    (value.actionKey === null || typeof value.actionKey === 'string') &&
    typeof value.content.title === 'string' &&
    typeof value.content.summary === 'string' &&
    typeof value.content.rationale === 'string' &&
    isRecord(value.content.actionInputs) &&
    Array.isArray(value.content.evidence) &&
    value.content.evidence.every(isEvidence) &&
    isDate(value.proposedAt) &&
    isDate(value.availableAt) &&
    isDate(value.expiresAt) &&
    (value.snoozedUntil === null || isDate(value.snoozedUntil)) &&
    (value.decidedAt === null || isDate(value.decidedAt))
  );
}

function isEvidence(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.sourceType === 'string' &&
    typeof value.referenceId === 'string' &&
    typeof value.label === 'string' &&
    (value.occurredAt === null || isDate(value.occurredAt))
  );
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
