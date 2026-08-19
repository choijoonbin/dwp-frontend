import type { AskDwpResponse, WorkplaceAction } from '@dwp-frontend/shared-utils';

export function buildDwaionActionDraftInputs(
  actionKey: WorkplaceAction['actionKey'],
  query: string | null,
  response: AskDwpResponse | null
): Record<string, string | string[]> {
  const normalizedQuery = compact(query, 2_000);
  const groundedAnswer = response?.state === 'COMPLETED' ? compact(response.answer, 8_000) : '';

  if (actionKey === 'CALENDAR.EVENT.CREATE') {
    return normalizedQuery ? { title: compact(normalizedQuery, 300) } : {};
  }
  if (actionKey === 'MAIL.DRAFT.CREATE') {
    return {
      ...(normalizedQuery ? { subject: compact(normalizedQuery, 500) } : {}),
      ...(groundedAnswer ? { body: groundedAnswer } : {}),
    };
  }
  if (actionKey === 'SERVICE.REQUEST.CREATE') {
    return normalizedQuery ? { requestSummary: compact(normalizedQuery, 240) } : {};
  }
  return {
    ...(normalizedQuery ? { title: compact(normalizedQuery, 300) } : {}),
    ...(groundedAnswer || normalizedQuery
      ? { businessJustification: compact(groundedAnswer || normalizedQuery, 2_000) }
      : {}),
  };
}

function compact(value: string | null | undefined, limit: number): string {
  return value?.replace(/\s+/gu, ' ').trim().slice(0, limit) ?? '';
}
