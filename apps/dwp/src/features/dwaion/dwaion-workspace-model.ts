import type { AskDwpResponse, WorkspaceWorkItem } from '@dwp-frontend/shared-utils';
import { rankWorkspaceWorkItems } from '@dwp-frontend/shared-utils/api/workspace-work-policy';

export const DWAION_MODE_KEYS = ['brief', 'blockers', 'meeting', 'access'] as const;

export type DwaionModeKey = (typeof DWAION_MODE_KEYS)[number];

export type DwaionWorkspaceState = 'idle' | 'loading' | 'ready' | 'error';

const GROUNDED_FALLBACK_PROVIDER = 'DWP_GROUNDED_FALLBACK';
const GROUNDED_FALLBACK_STATUS = 'ANSWER_GROUNDED_FALLBACK';

export function verifiedConversationId(
  selectedConversationId: string | null,
  loadedConversationId: string | undefined
): string | undefined {
  return selectedConversationId && selectedConversationId === loadedConversationId
    ? selectedConversationId
    : undefined;
}

export function visibleWorkItems(items: readonly WorkspaceWorkItem[]): WorkspaceWorkItem[] {
  return rankWorkspaceWorkItems(items).slice(0, 4);
}

export function responseTone(response: AskDwpResponse): 'success' | 'warning' | 'info' {
  if (isGroundedFallbackResponse(response)) return 'info';
  if (response.state === 'COMPLETED') return 'success';
  if (response.state === 'CONFIGURATION_REQUIRED') return 'info';
  return 'warning';
}

export function isGroundedFallbackResponse(response: AskDwpResponse): boolean {
  return (
    response.state === 'COMPLETED' &&
    response.modelRoute.state === 'COMPLETED' &&
    response.modelRoute.provider === GROUNDED_FALLBACK_PROVIDER &&
    isGroundedFallbackStatus(response.statusCode)
  );
}

export function isGroundedFallbackStatus(statusCode: string | null | undefined): boolean {
  return statusCode === GROUNDED_FALLBACK_STATUS;
}

export function confidenceValue(response: AskDwpResponse): string {
  return response.confidence ?? 'NOT_AVAILABLE';
}
