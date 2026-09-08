import type { FollowUpTab } from './meeting-follow-ups-model';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** A URL is an initial selection request, never authority to read arbitrary task details. */
export function meetingFollowUpsNavigation(params: URLSearchParams) {
  const rawScope = params.getAll('scope');
  const scope: FollowUpTab =
    rawScope.length === 1 && (rawScope[0] === 'ASSIGNED_BY_ME' || rawScope[0] === 'CANDIDATES')
      ? rawScope[0]
      : 'ASSIGNED_TO_ME';
  const references = params.getAll('assignment');
  const assignment = references.length === 1 && uuid.test(references[0]) ? references[0] : null;
  return { scope, assignment: scope === 'CANDIDATES' ? null : assignment };
}
