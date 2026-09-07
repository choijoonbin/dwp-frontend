import { describe, expect, it } from 'vitest';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import type { WorkAssignmentTask } from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import {
  checkedCandidateAssignment,
  projectMeetingFollowUpCandidates,
} from './meeting-follow-up-candidates-model';

const meetingId = '99000000-0000-4000-8000-000000000001';
const reportId = '99000000-0000-4000-8000-000000000002';
const candidateId = '99000000-0000-4000-8000-000000000003';
const meeting = { meetingId, title: 'Planning' } as VideoMeetingSummary;
const report = {
  reportId,
  meetingId,
  runId: '99000000-0000-4000-8000-000000000004',
  state: 'PUBLISHED',
  audience: 'MEETING_PARTICIPANTS',
  schemaVersion: 'meeting-intelligence-v1',
  retentionUntil: '2026-10-01T00:00:00Z',
  legalHold: false,
  publishedAt: '2026-09-04T01:00:00Z',
  version: 8,
  canCurrentViewerReview: false,
  reviews: [],
  analysis: {
    executiveSummary: { text: 'Summary', citations: [] },
    topics: [],
    decisions: [],
    openQuestions: [],
    risks: [],
    actionItems: [{ text: 'Publish the rollout checklist', citations: [] }],
    conversationClimate: { label: 'ALIGNED', signals: [], citations: [] },
  },
  followUpCandidates: [{ candidateId, sourceVersion: 8, actionItemIndex: 0 }],
} satisfies VideoMeetingIntelligenceReport;

describe('Meeting follow-up candidate binding', () => {
  it('projects only the exact published current candidate and no private draft fields', () => {
    const candidates = projectMeetingFollowUpCandidates(
      meeting,
      report,
      Date.parse('2026-09-04T02:00:00Z')
    );
    expect(candidates).toEqual([
      {
        source: { sourceSystem: 'MEETING_FOLLOWUP', meetingId, reportId, candidateId },
        sourceVersion: 8,
        meetingTitle: 'Planning',
        title: 'Publish the rollout checklist',
      },
    ]);
    expect(JSON.stringify(candidates)).not.toContain('citations');
  });

  it.each([
    { state: 'DRAFT' as const },
    { audience: 'PRIVATE_REVIEWERS' as const },
    { meetingId: '99000000-0000-4000-8000-000000000099' },
  ])('rejects stale, private, and cross-meeting report bindings: %j', (override) => {
    expect(() =>
      projectMeetingFollowUpCandidates(
        meeting,
        { ...report, ...override },
        Date.parse('2026-09-04T02:00:00Z')
      )
    ).toThrow();
  });

  it('rejects a by-source task rebound to another user', () => {
    const candidate = projectMeetingFollowUpCandidates(
      meeting,
      report,
      Date.parse('2026-09-04T02:00:00Z')
    )[0];
    const task = {
      assignmentId: '99000000-0000-4000-8000-000000000010',
      createdByUserId: 7,
      assignedByUserId: 7,
      assigneeUserId: 99,
      title: candidate.title,
      description: null,
      priority: 'NORMAL',
      dueAt: null,
      assignmentState: 'PENDING',
      workState: 'OPEN',
      assignmentRevision: 0,
      version: 0,
      source: {
        availability: 'AVAILABLE',
        reference: candidate.source,
        sourceVersion: 8,
        sourceRoute: '/meetings/follow-ups',
      },
      capabilities: {
        canAccept: true,
        canDecline: true,
        canStart: false,
        canWait: false,
        canComplete: false,
        canReassign: false,
        canCancel: false,
      },
      createdAt: '2026-09-04T02:00:00Z',
      updatedAt: '2026-09-04T02:00:00Z',
      acceptedAt: null,
      completedAt: null,
    } satisfies WorkAssignmentTask;
    expect(() => checkedCandidateAssignment(task, candidate, 7)).toThrow(
      'Invalid created Work assignment binding'
    );
  });
});
