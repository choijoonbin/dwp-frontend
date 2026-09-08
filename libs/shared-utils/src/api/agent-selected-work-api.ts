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
  const result = await client(
    {
      requestId: globalThis.crypto.randomUUID(),
      query: question,
      locale: request.locale,
      agentKey: approval ? DWAION_APPROVAL_EXPERT_AGENT_KEY : DWAION_AGENT_KEY,
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
        selectedWork: {
          sourceSystem,
          sourceReference,
          expectedVersion,
          ...(obligationKey ? { obligationKey } : {}),
        },
      },
    },
    options
  );
  options.signal?.throwIfAborted();
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
