import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { HttpError } from '../http-error';
import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import {
  isAgentActionHandoffOrigin,
  type AgentActionHandoffOrigin,
  type AgentPlanPreview,
} from './agent-plan-api';
import type { AskCitation } from './agent-runtime-api';
import {
  DWAION_ACTION_KEYS,
  type DwaionActionKey,
  type DwaionHandoffInputValue,
} from '../dwaion-contract';

type AgentSchemas = AgentComponents['schemas'];

export type DwaionConversationSummary = AgentSchemas['ConversationSummary'];

export type DwaionConversationMessage = Omit<
  AgentSchemas['ConversationMessage'],
  'runId' | 'statusCode' | 'citations'
> & {
  runId: string | null;
  statusCode: string | null;
  citations: AskCitation[];
};

export type DwaionConversation = Omit<
  AgentSchemas['ConversationDetail'],
  'summary' | 'messages'
> & {
  summary: DwaionConversationSummary;
  messages: DwaionConversationMessage[];
};

export type WorkplaceAction = Omit<AgentSchemas['WorkplaceAction'], 'actionKey' | 'inputFields'> & {
  actionKey: DwaionActionKey;
  inputFields: string[];
};

export type WorkplaceActionPreview = Omit<
  AgentSchemas['WorkplaceActionPreview'],
  'action' | 'reviewedInputs' | 'plan'
> & {
  action: WorkplaceAction;
  reviewedInputs: Record<string, DwaionHandoffInputValue>;
  plan: AgentPlanPreview & { handoffOrigin: AgentActionHandoffOrigin };
};

export async function getDwaionConversations(): Promise<DwaionConversationSummary[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>('/api/agent/v1/conversations');
  if (!Array.isArray(response.data.data) || !response.data.data.every(isSummary)) {
    throw new HttpError('Conversation list response is invalid.', 502, response.data);
  }
  return response.data.data;
}

export async function getDwaionConversation(conversationId: string): Promise<DwaionConversation> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/agent/v1/conversations/${encodeURIComponent(conversationId)}`
  );
  if (!isConversation(response.data.data)) {
    throw new HttpError('Conversation response is invalid.', 502, response.data);
  }
  return response.data.data;
}

export async function renameDwaionConversation(
  conversationId: string,
  title: string
): Promise<DwaionConversation> {
  const response = await axiosInstance.patch<ApiResponse<unknown>, { title: string }>(
    `/api/agent/v1/conversations/${encodeURIComponent(conversationId)}`,
    { title }
  );
  if (!isConversation(response.data.data)) {
    throw new HttpError('Conversation rename response is invalid.', 502, response.data);
  }
  return response.data.data;
}

export async function deleteDwaionConversation(conversationId: string): Promise<void> {
  await axiosInstance.delete(`/api/agent/v1/conversations/${encodeURIComponent(conversationId)}`);
}

export async function recordDwaionFeedback(
  runId: string,
  rating: 'UP' | 'DOWN',
  reasonCodes: string[] = [],
  comment?: string
): Promise<void> {
  await axiosInstance.put(`/api/agent/v1/runs/${encodeURIComponent(runId)}/feedback`, {
    rating,
    reasonCodes,
    comment,
  });
}

export async function getWorkplaceActions(): Promise<WorkplaceAction[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>('/api/agent/v1/actions');
  if (!Array.isArray(response.data.data) || !response.data.data.every(isAction)) {
    throw new HttpError('Workplace action catalog response is invalid.', 502, response.data);
  }
  return response.data.data;
}

export async function previewWorkplaceAction(
  actionKey: string,
  input: {
    requestId: string;
    inputs?: Record<string, unknown>;
    sourceReferences?: string[];
    origin: AgentActionHandoffOrigin;
  }
): Promise<WorkplaceActionPreview> {
  const response = await axiosInstance.post<ApiResponse<unknown>>(
    `/api/agent/v1/actions/${encodeURIComponent(actionKey)}/preview`,
    {
      requestId: input.requestId,
      inputs: input.inputs ?? {},
      sourceReferences: input.sourceReferences ?? [],
      origin: input.origin,
    }
  );
  const value = response.data.data as WorkplaceActionPreview | undefined;
  if (
    !value ||
    !isAction(value.action) ||
    !isReviewedInputs(value.reviewedInputs) ||
    !isPlan(value.plan) ||
    !isAgentActionHandoffOrigin(value.plan.handoffOrigin)
  ) {
    throw new HttpError('Workplace action preview response is invalid.', 502, response.data);
  }
  return value;
}

function isReviewedInputs(value: unknown): value is Record<string, DwaionHandoffInputValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (item) =>
      typeof item === 'string' ||
      (Array.isArray(item) && item.every((entry) => typeof entry === 'string'))
  );
}

function isSummary(value: unknown): value is DwaionConversationSummary {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.conversationId === 'string' &&
    typeof item.title === 'string' &&
    typeof item.locale === 'string' &&
    typeof item.messageCount === 'number' &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string' &&
    typeof item.lastMessageAt === 'string'
  );
}

function isConversation(value: unknown): value is DwaionConversation {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isSummary(item.summary) &&
    Array.isArray(item.messages) &&
    item.messages.every((message) => {
      if (typeof message !== 'object' || message === null) return false;
      const record = message as Record<string, unknown>;
      return (
        typeof record.messageId === 'string' &&
        (record.role === 'USER' || record.role === 'ASSISTANT') &&
        typeof record.content === 'string' &&
        Array.isArray(record.citations) &&
        typeof record.createdAt === 'string'
      );
    })
  );
}

function isAction(value: unknown): value is WorkplaceAction {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.actionKey === 'string' &&
    DWAION_ACTION_KEYS.includes(item.actionKey as DwaionActionKey) &&
    typeof item.title === 'string' &&
    typeof item.description === 'string' &&
    (item.mode === 'REDIRECT' || item.mode === 'APPROVAL_HANDOFF') &&
    ['L0', 'L1', 'L2', 'L3'].includes(String(item.riskTier)) &&
    typeof item.requiredPermission === 'string' &&
    typeof item.targetRoute === 'string' &&
    item.confirmationRequired === true &&
    Array.isArray(item.inputFields)
  );
}

function isPlan(value: unknown): value is AgentPlanPreview {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    item.state === 'REVIEW' &&
    item.mutationAllowed === false &&
    item.approvalRequired === true &&
    typeof item.planHash === 'string' &&
    Array.isArray(item.steps)
  );
}
