import type { AskDwpResponse, WorkspaceWorkItem } from '@dwp-frontend/shared-utils';

export const DWAION_MODE_KEYS = ['brief', 'blockers', 'meeting', 'access'] as const;

export type DwaionModeKey = (typeof DWAION_MODE_KEYS)[number];

export const DWAION_SOURCE_TYPES = ['WORK_ITEM', 'MAIL', 'CALENDAR'] as const;

export type DwaionWorkspaceState = 'idle' | 'loading' | 'ready' | 'error';

export function verifiedConversationId(
  selectedConversationId: string | null,
  loadedConversationId: string | undefined
): string | undefined {
  return selectedConversationId && selectedConversationId === loadedConversationId
    ? selectedConversationId
    : undefined;
}

export function visibleWorkItems(items: readonly WorkspaceWorkItem[]): WorkspaceWorkItem[] {
  return [...items]
    .sort((left, right) => {
      const priority = { high: 0, medium: 1, low: 2 } as const;
      const priorityDelta = priority[left.priority] - priority[right.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    })
    .slice(0, 4);
}

export function responseTone(response: AskDwpResponse): 'success' | 'warning' | 'info' {
  if (response.state === 'COMPLETED') return 'success';
  if (response.state === 'CONFIGURATION_REQUIRED') return 'info';
  return 'warning';
}

export function confidenceValue(response: AskDwpResponse): string {
  return response.confidence ?? 'NOT_AVAILABLE';
}
