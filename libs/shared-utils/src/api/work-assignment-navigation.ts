import type { WorkSourceReference } from './personal-work-contracts';
import type { WorkAssignmentSourceView } from './work-assignment-contracts';
import { workspaceWorkSourceRoute } from './workspace-work-policy';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export const WORK_ASSIGNMENT_SOURCE_SYSTEM = 'WORK_ASSIGNMENT' as const;

export function workAssignmentReference(assignmentId: string): WorkSourceReference {
  if (!UUID_PATTERN.test(assignmentId))
    throw new Error('A canonical Work assignment ID is required.');
  return { sourceSystem: WORK_ASSIGNMENT_SOURCE_SYSTEM, sourceReference: assignmentId };
}

export function workAssignmentReferenceKey(assignmentId: string): string {
  const reference = workAssignmentReference(assignmentId);
  return [reference.sourceSystem, reference.sourceReference, ''].map(encodeURIComponent).join(':');
}

/** Shared entry point used by Meeting and every other owner of a Work assignment link. */
export function workAssignmentWorkRoute(assignmentId: string): string {
  return `/work/queue?work=${encodeURIComponent(workAssignmentReferenceKey(assignmentId))}`;
}

/** Source metadata is usable only after the Work detail endpoint has inspected its owner. */
export function workAssignmentSourceRoute(source: WorkAssignmentSourceView): string | null {
  if (source.availability !== 'AVAILABLE') return null;
  const reference = source.reference;
  if (
    reference.sourceSystem !== 'MEETING_FOLLOWUP' ||
    ![reference.meetingId, reference.reportId, reference.candidateId].every((value) =>
      UUID_PATTERN.test(value)
    ) ||
    !Number.isSafeInteger(source.sourceVersion) ||
    source.sourceVersion < 0
  )
    return null;
  const route = workspaceWorkSourceRoute({ sourceRoute: source.sourceRoute });
  if (!route) return null;
  const parsed = new URL(route, 'https://dwp.invalid');
  const params = parsed.searchParams;
  const values = [...params.keys()];
  const followUps = parsed.pathname === '/meetings/follow-ups';
  const history = parsed.pathname === '/meetings/history';
  if (
    parsed.hash ||
    (!followUps && !history) ||
    values.length !== 3 ||
    new Set(values).size !== 3 ||
    !['meetingId', 'meeting', 'reportId', 'candidateId'].every(
      (key) => !params.has(key) || params.getAll(key).length === 1
    ) ||
    params.get(followUps ? 'meetingId' : 'meeting') !== reference.meetingId ||
    params.get('reportId') !== reference.reportId ||
    params.get('candidateId') !== reference.candidateId
  )
    return null;
  return `/meetings/history?${new URLSearchParams({
    meeting: reference.meetingId,
    reportId: reference.reportId,
    candidateId: reference.candidateId,
  }).toString()}`;
}
