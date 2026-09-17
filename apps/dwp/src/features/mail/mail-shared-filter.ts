export type MailSharedAssignmentFilter = 'ALL' | 'MINE' | 'UNASSIGNED';

export function mailSharedAssignmentFilter(value: string | null): MailSharedAssignmentFilter {
  return value === 'MINE' || value === 'UNASSIGNED' ? value : 'ALL';
}

export function updateMailSharedFilters(
  params: URLSearchParams,
  updates: { assignment?: MailSharedAssignmentFilter; sharedInboxId?: string | null }
) {
  const next = new URLSearchParams(params);
  if (updates.assignment === 'MINE' || updates.assignment === 'UNASSIGNED') {
    next.set('assignment', updates.assignment);
  } else if ('assignment' in updates) next.delete('assignment');
  if (updates.sharedInboxId) next.set('sharedInboxId', updates.sharedInboxId);
  else if ('sharedInboxId' in updates) next.delete('sharedInboxId');
  next.delete('thread');
  next.delete('page');
  return next;
}
