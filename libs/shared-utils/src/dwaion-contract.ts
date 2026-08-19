export const DWAION_AGENT_KEY = 'DWP_ASSISTANT';
export const DWAION_APPROVAL_EXPERT_AGENT_KEY = 'DWP_APPROVAL_EXPERT';
export const DWAION_WORKSPACE_PATH = '/dwaion';
export const DWAION_LEGACY_PATH = '/ask';

export type DwaionAgentKey = typeof DWAION_AGENT_KEY | typeof DWAION_APPROVAL_EXPERT_AGENT_KEY;

export function resolveDwaionAgentKey(value: string | null | undefined): DwaionAgentKey {
  return value?.trim().toUpperCase() === DWAION_APPROVAL_EXPERT_AGENT_KEY
    ? DWAION_APPROVAL_EXPERT_AGENT_KEY
    : DWAION_AGENT_KEY;
}

export function dwaionWorkspaceRoute(
  query?: string,
  conversationId?: string,
  agentKey: DwaionAgentKey = DWAION_AGENT_KEY
): string {
  const params = new URLSearchParams();
  const normalizedConversationId = conversationId?.trim();
  if (normalizedConversationId) params.set('conversation', normalizedConversationId);
  else if (query?.trim()) params.set('q', query.trim());
  if (agentKey !== DWAION_AGENT_KEY) params.set('agent', agentKey);
  const search = params.toString();
  return search ? `${DWAION_WORKSPACE_PATH}?${search}` : DWAION_WORKSPACE_PATH;
}
