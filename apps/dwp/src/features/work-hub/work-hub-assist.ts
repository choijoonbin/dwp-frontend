import type {
  AskDwpOptions,
  AskDwpResponse,
} from '@dwp-frontend/shared-utils/api/agent-runtime-api';
import {
  askSelectedWorkStream,
  type SelectedWorkBinding,
} from '@dwp-frontend/shared-utils/api/agent-selected-work-api';
import type { WorkHubItem } from './work-hub-contracts';

export type WorkHubAssistRequest = {
  question: string;
  expectedKey: string;
  expectedVersion: number;
};
export type WorkHubAssistSourceContext = {
  workKey: string;
  sourceVersion: number;
  excerpt: string;
  verifiedAt: string;
};
export type WorkHubAssistDraft = { workKey: string; sourceVersion: number; message: string };
export type WorkHubAssistOptions = AskDwpOptions & {
  locale: string;
  route: string;
  conversationId?: string;
};

export type WorkHubAssistDisposition =
  'ANSWER' | 'PURGE' | 'REFRESH' | 'RETRY' | 'RESTRICTED' | 'UNSUPPORTED';

const supportedSourceSystems = new Set([
  'PERSONAL_TASK',
  'SERVICE_REQUEST',
  'APPROVAL_TASK',
  'APPROVAL_REQUEST',
]);

export function isWorkHubAssistSourceSystem(sourceSystem: string) {
  return supportedSourceSystems.has(sourceSystem);
}

/** Converts server abstentions into explicit UI recovery without guessing source authority. */
export function workHubAssistDisposition(response: AskDwpResponse): WorkHubAssistDisposition {
  if (response.state === 'COMPLETED') return 'ANSWER';
  switch (response.statusCode) {
    case 'SELECTED_WORK_FORBIDDEN':
    case 'SELECTED_WORK_NOT_FOUND':
      return 'PURGE';
    case 'SELECTED_WORK_STALE':
    case 'SELECTED_WORK_INVALID_SOURCE':
      return 'REFRESH';
    case 'SELECTED_WORK_RESTRICTED':
      return 'RESTRICTED';
    case 'SELECTED_WORK_UNSUPPORTED':
      return 'UNSUPPORTED';
    case 'SELECTED_WORK_AUTHORIZATION_REQUIRED':
    case 'SELECTED_WORK_UNAVAILABLE':
    default:
      return 'RETRY';
  }
}

function verifyWorkContext(
  item: WorkHubItem,
  request: WorkHubAssistRequest,
  verifiedAt: string,
  now: number
) {
  const age = now - Date.parse(verifiedAt);
  if (!Number.isFinite(age) || age < -30_000 || age > 300_000)
    throw new Error('Refresh the work context before requesting AI help.');
  if (item.key !== request.expectedKey || item.version !== request.expectedVersion)
    throw new Error('The selected work changed. Review its current context.');
  const question = request.question.trim();
  if (question.length < 2 || question.length > 2_000)
    throw new Error('A question must contain between 2 and 2,000 characters.');
  return question;
}

function selectedWorkBinding(item: WorkHubItem): SelectedWorkBinding {
  const { sourceSystem, sourceReference, obligationKey } = item.reference;
  switch (sourceSystem) {
    case 'PERSONAL_TASK':
    case 'SERVICE_REQUEST':
    case 'APPROVAL_TASK':
    case 'APPROVAL_REQUEST':
      return {
        sourceSystem,
        sourceReference,
        expectedVersion: item.version,
        ...(obligationKey ? { obligationKey } : {}),
      };
    default:
      throw new Error('Open the source work to verify its current context first.');
  }
}

export function verifiedWorkAssistExcerpt(
  item: WorkHubItem,
  context: WorkHubAssistSourceContext | null | undefined,
  now = Date.now()
) {
  if (!context) return null;
  const age = now - Date.parse(context.verifiedAt);
  return context.workKey === item.key &&
    context.sourceVersion === item.version &&
    Number.isFinite(age) &&
    age >= -30_000 &&
    age <= 300_000
    ? context.excerpt.trim().slice(0, 1500) || null
    : null;
}

/** The owning runtime resolves source evidence; Work sends only the question and exact binding. */
export async function askWorkHubAssist(
  item: WorkHubItem,
  request: WorkHubAssistRequest,
  verifiedAt: string,
  options: WorkHubAssistOptions,
  client: typeof askSelectedWorkStream = askSelectedWorkStream,
  now = Date.now()
): Promise<AskDwpResponse> {
  const question = verifyWorkContext(item, request, verifiedAt, now);
  return client(
    {
      selection: selectedWorkBinding(item),
      question,
      locale: options.locale,
      route: options.route,
      ...(options.conversationId ? { conversationId: options.conversationId } : {}),
    },
    { signal: options.signal, timeoutMs: options.timeoutMs, onProgress: options.onProgress }
  );
}

export function workHubAssistDraft(
  item: WorkHubItem,
  response: AskDwpResponse | null,
  text: string
): WorkHubAssistDraft | null {
  const message = text.trim();
  return item.reference.sourceSystem === 'SERVICE_REQUEST' &&
    item.sourceStatus === 'AWAITING_REQUESTER' &&
    response?.state === 'COMPLETED' &&
    response.policy.outcome === 'ALLOW' &&
    response.policy.mutationAllowed === false &&
    message.length >= 10 &&
    message.length <= 2000
    ? { workKey: item.key, sourceVersion: item.version, message }
    : null;
}
