import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';

type AgentSchemas = AgentComponents['schemas'];

export type QuestionLaunchReceipt = AgentSchemas['QuestionLaunchReceipt'];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const QUESTION_LAUNCH_MAX_TTL_MS = 65_000;

export async function createQuestionLaunch(question: string): Promise<QuestionLaunchReceipt> {
  const normalized = question.trim();
  if (normalized.length < 2 || normalized.length > 4_000) {
    throw new TypeError('Question launch content must contain between 2 and 4,000 characters.');
  }
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    AgentSchemas['CreateQuestionLaunchRequest']
  >('/api/agent/v1/question-launches', { question: normalized });
  if (!isQuestionLaunchReceipt(response.data.data)) {
    throw new HttpError('Question launch response is invalid.', 502, response.data);
  }
  return response.data.data;
}

export async function consumeQuestionLaunch(launchId: string): Promise<string> {
  const normalized = launchId.trim();
  if (!UUID_PATTERN.test(normalized)) {
    throw new TypeError('Question launch identifier is invalid.');
  }
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    AgentSchemas['ConsumeQuestionLaunchRequest']
  >('/api/agent/v1/question-launches/consume', { launchId: normalized });
  if (!isQuestionLaunchPayload(response.data.data)) {
    throw new HttpError('Question launch payload is invalid.', 502, response.data);
  }
  return response.data.data.question;
}

function isQuestionLaunchReceipt(value: unknown): value is QuestionLaunchReceipt {
  if (!isRecord(value)) return false;
  const expiresAt = typeof value.expiresAt === 'string' ? Date.parse(value.expiresAt) : Number.NaN;
  const remainingTtl = expiresAt - Date.now();
  return (
    typeof value.launchId === 'string' &&
    UUID_PATTERN.test(value.launchId) &&
    typeof value.expiresAt === 'string' &&
    Number.isFinite(expiresAt) &&
    remainingTtl > 0 &&
    remainingTtl <= QUESTION_LAUNCH_MAX_TTL_MS
  );
}

function isQuestionLaunchPayload(value: unknown): value is AgentSchemas['QuestionLaunchPayload'] {
  if (!isRecord(value) || typeof value.question !== 'string') return false;
  const normalized = value.question.trim();
  return normalized.length >= 2 && normalized.length <= 4_000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
