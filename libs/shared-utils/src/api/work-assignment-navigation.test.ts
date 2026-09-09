import { describe, expect, it } from 'vitest';
import {
  workAssignmentReference,
  workAssignmentReferenceKey,
  workAssignmentSourceRoute,
  workAssignmentWorkRoute,
} from './work-assignment-navigation';

const assignmentId = '00000000-0000-4000-8000-000000000040';

describe('Work assignment navigation', () => {
  it('uses the Work-owned aggregate identity for canonical queue links', () => {
    expect(workAssignmentReference(assignmentId)).toEqual({
      sourceSystem: 'WORK_ASSIGNMENT',
      sourceReference: assignmentId,
    });
    expect(workAssignmentReferenceKey(assignmentId)).toBe(`WORK_ASSIGNMENT:${assignmentId}:`);
    expect(workAssignmentWorkRoute(assignmentId)).toBe(
      `/work/queue?work=WORK_ASSIGNMENT%3A${assignmentId}%3A`
    );
  });

  it('rejects non-canonical assignment identities', () => {
    expect(() => workAssignmentWorkRoute('../assignment')).toThrow('canonical');
  });

  it('returns only an inspected, safe internal Meeting route', () => {
    const available = {
      availability: 'AVAILABLE' as const,
      reference: {
        sourceSystem: 'MEETING_FOLLOWUP' as const,
        meetingId: '00000000-0000-4000-8000-000000000001',
        reportId: '00000000-0000-4000-8000-000000000002',
        candidateId: '00000000-0000-4000-8000-000000000003',
      },
      sourceVersion: 2,
      sourceRoute:
        '/meetings/follow-ups?meetingId=00000000-0000-4000-8000-000000000001&reportId=00000000-0000-4000-8000-000000000002&candidateId=00000000-0000-4000-8000-000000000003',
    };
    expect(workAssignmentSourceRoute(available)).toBe(
      '/meetings/history?meeting=00000000-0000-4000-8000-000000000001&reportId=00000000-0000-4000-8000-000000000002&candidateId=00000000-0000-4000-8000-000000000003'
    );
    expect(
      workAssignmentSourceRoute({ ...available, sourceRoute: '//outside.example' })
    ).toBeNull();
    expect(
      workAssignmentSourceRoute({
        ...available,
        sourceRoute:
          '/meetings/follow-ups?meetingId=00000000-0000-4000-8000-000000000099&reportId=00000000-0000-4000-8000-000000000002&candidateId=00000000-0000-4000-8000-000000000003',
      })
    ).toBeNull();
    expect(
      workAssignmentSourceRoute({
        availability: 'UNAVAILABLE',
        reference: null,
        sourceVersion: null,
        sourceRoute: null,
      })
    ).toBeNull();
  });
});
