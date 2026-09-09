import type { AgentComponents } from '@dwp-frontend/api-contracts';

import {
  DWAION_AGENT_KEY,
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
  dwaionWorkspaceRoute,
} from '../dwaion-contract';
import { askDwpStream, type AskDwpOptions, type AskDwpResponse } from './agent-runtime-api';

export type SelectedWorkBinding = AgentComponents['schemas']['AskSelectedWork'];
export type SelectedWorkQuestion = {
  selection: SelectedWorkBinding;
  question: string;
  locale: string;
  route: string;
  conversationId?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SUPPORTED_SOURCE_SYSTEMS = new Set<SelectedWorkBinding['sourceSystem']>([
  'PERSONAL_TASK',
  'SERVICE_REQUEST',
  'APPROVAL_TASK',
  'APPROVAL_REQUEST',
]);

export function isSelectedWorkBinding(value: unknown): value is SelectedWorkBinding {
  if (typeof value !== 'object' || value === null) return false;
  const binding = value as Partial<SelectedWorkBinding>;
  return (
    SUPPORTED_SOURCE_SYSTEMS.has(binding.sourceSystem as SelectedWorkBinding['sourceSystem']) &&
    typeof binding.sourceReference === 'string' &&
    UUID.test(binding.sourceReference) &&
    Number.isSafeInteger(binding.expectedVersion) &&
    Number(binding.expectedVersion) >= 0 &&
    (binding.obligationKey == null ||
      (typeof binding.obligationKey === 'string' && binding.obligationKey.length <= 128)) &&
    (binding.sourceSystem !== 'APPROVAL_TASK' || Boolean(binding.obligationKey?.trim()))
  );
}

export function matchesSelectedWorkBinding(
  actual: unknown,
  expected: SelectedWorkBinding
): boolean {
  if (typeof actual !== 'object' || actual === null) return false;
  const binding = actual as Partial<SelectedWorkBinding>;
  return (
    binding.sourceSystem === expected.sourceSystem &&
    typeof binding.sourceReference === 'string' &&
    binding.sourceReference.toLowerCase() === expected.sourceReference.toLowerCase() &&
    binding.expectedVersion === expected.expectedVersion &&
    (binding.obligationKey ?? null) === (expected.obligationKey ?? null)
  );
}

export function selectedWorkAgentKey(selection: SelectedWorkBinding): string {
  return selection.sourceSystem === 'APPROVAL_TASK' || selection.sourceSystem === 'APPROVAL_REQUEST'
    ? DWAION_APPROVAL_EXPERT_AGENT_KEY
    : DWAION_AGENT_KEY;
}

export type SelectedWorkResponseExpectation = {
  requestId: string;
  agentKey: string;
  selection: SelectedWorkBinding;
  conversationId?: string;
};

export function assertSelectedWorkResponseBinding(
  result: AskDwpResponse,
  expected: SelectedWorkResponseExpectation
): void {
  if (
    result.requestId !== expected.requestId ||
    result.agentRegistry?.entryKey !== expected.agentKey ||
    !matchesSelectedWorkBinding(result.selectedWork, expected.selection) ||
    (expected.conversationId != null && result.conversationId !== expected.conversationId)
  ) {
    throw new Error('Selected work response binding is invalid.');
  }
}

/** Selected owner evidence is resolved server-side; no work list, snapshot, or body is submitted. */
export async function askSelectedWorkStream(
  request: SelectedWorkQuestion,
  options: AskDwpOptions = {},
  client: typeof askDwpStream = askDwpStream
): Promise<AskDwpResponse> {
  options.signal?.throwIfAborted();
  const question = request.question.trim();
  const { sourceSystem, sourceReference, expectedVersion, obligationKey } = request.selection;
  if (
    question.length < 2 ||
    question.length > 2000 ||
    !SUPPORTED_SOURCE_SYSTEMS.has(sourceSystem) ||
    !UUID.test(sourceReference) ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0 ||
    (sourceSystem === 'APPROVAL_TASK' && !obligationKey?.trim()) ||
    (obligationKey != null && obligationKey.length > 128) ||
    (request.conversationId != null && !UUID.test(request.conversationId))
  )
    throw new Error('A current selected work reference and question are required.');
  const approval = sourceSystem === 'APPROVAL_TASK' || sourceSystem === 'APPROVAL_REQUEST';
  const requestId = globalThis.crypto.randomUUID();
  const selectedWork: SelectedWorkBinding = {
    sourceSystem,
    sourceReference,
    expectedVersion,
    ...(obligationKey ? { obligationKey } : {}),
  };
  const agentKey = selectedWorkAgentKey(selectedWork);
  const result = await client(
    {
      requestId,
      query: question,
      locale: request.locale,
      agentKey,
      ...(request.conversationId ? { conversationId: request.conversationId } : {}),
      sourceScopes: [approval ? sourceSystem : 'WORK_ITEM'],
      pageContext: {
        appKey: approval
          ? 'APP.APPROVALS'
          : sourceSystem === 'SERVICE_REQUEST'
            ? 'APP.EMPLOYEE_SERVICES'
            : 'APP.WORK',
        route: request.route.startsWith('/work/') ? request.route.split(/[?#]/u)[0] : '/work/queue',
        surface: 'selected-work-assist',
        entityType: sourceSystem,
        entityRef: sourceReference,
        selectedWork,
      },
    },
    options
  );
  options.signal?.throwIfAborted();
  assertSelectedWorkResponseBinding(result, {
    requestId,
    agentKey,
    selection: selectedWork,
    ...(request.conversationId ? { conversationId: request.conversationId } : {}),
  });
  return result;
}

/** Open the persisted conversation without exposing the question or source content in the URL. */
export function selectedWorkConversationRoute(response: AskDwpResponse): string | null {
  if (
    response.state !== 'COMPLETED' ||
    !response.conversationId ||
    !UUID.test(response.conversationId)
  )
    return null;
  const agent = response.agentRegistry.entryKey;
  if (agent !== DWAION_AGENT_KEY && agent !== DWAION_APPROVAL_EXPERT_AGENT_KEY) return null;
  return dwaionWorkspaceRoute(undefined, response.conversationId, agent);
}
