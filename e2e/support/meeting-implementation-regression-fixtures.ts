import type { Page } from '@playwright/test';
import {
  MEETING_VISUAL_ID,
  MEETING_VISUAL_NOW,
  MEETING_VISUAL_SUMMARY,
} from './video-meeting-visual-fixtures';
import { scheduleResponse } from './meeting-schedule-fixtures';

/** The existing four-meeting list now consumes governed preparation metadata per visible row. */
export async function mockImplementationMeetingPreparation(page: Page) {
  const ids = [
    MEETING_VISUAL_ID,
    '81000000-0000-0000-0000-000000000302',
    '81000000-0000-0000-0000-000000000303',
    '81000000-0000-0000-0000-000000000305',
  ];
  for (const meetingId of ids) {
    const host = meetingId === MEETING_VISUAL_ID || meetingId.endsWith('305');
    const roster = MEETING_VISUAL_SUMMARY.participants.map((person, index) => ({
      participantId: person.participantId,
      displayName: person.displayName,
      response: index === 0 ? 'ACCEPTED' : 'NEEDS_RESPONSE',
      invitationRevision: 1,
      respondedAt: null,
      version: 0,
      mine: index === 0,
    }));
    const index = ids.indexOf(meetingId);
    const starts = [
      MEETING_VISUAL_SUMMARY.startsAt,
      '2026-08-31T06:30:00Z',
      '2026-08-31T04:00:00Z',
      '2026-08-30T06:00:00Z',
    ];
    const ends = [
      MEETING_VISUAL_SUMMARY.endsAt,
      '2026-08-31T07:15:00Z',
      '2026-08-31T05:00:00Z',
      '2026-08-30T06:45:00Z',
    ];
    await page.route(`**/api/meetings/v1/meetings/${meetingId}/schedule`, (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return scheduleResponse(route, {
        meetingId,
        lifecycleState: index === 2 ? 'LIVE' : index === 3 ? 'CANCELLED' : 'SCHEDULED',
        startsAt: starts[index],
        endsAt: ends[index],
        timeZone: 'Asia/Seoul',
        meetingVersion: MEETING_VISUAL_SUMMARY.version,
        seriesId: null,
        occurrenceIndex: null,
        occurrenceCount: null,
        frequency: null,
        recurrenceInterval: null,
        seriesVersion: null,
        exceptionState: 'NONE',
        invitationRevision: 1,
        deliveryState: 'DELIVERED',
      });
    });
    await page.route(`**/api/meetings/v1/meetings/${meetingId}/content-plan`, (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return scheduleResponse(route, {
        meetingId,
        planId: '85000000-0000-4000-8000-000000000301',
        recordingRequested: false,
        transcriptionRequested: false,
        aiSummaryRequested: false,
        e2eeEnabled: false,
        state: 'DISABLED',
        blockers: [],
        dependencies: {
          egressAvailable: false,
          storageAvailable: false,
          kmsAvailable: false,
          auditAvailable: true,
          speechToTextAvailable: false,
          languageModelAvailable: false,
        },
        notice: null,
        consent: { requiredAcknowledgements: 0, receivedAcknowledgements: 0, complete: true },
        recordingSession: null,
        version: 2,
        updatedAt: MEETING_VISUAL_NOW.toISOString(),
      });
    });
    await page.route(`**/api/meetings/v1/meetings/${meetingId}/preparation`, (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return scheduleResponse(route, {
        meetingId,
        meetingVersion: MEETING_VISUAL_SUMMARY.version,
        agendaVersion: 1,
        materialsVersion: 0,
        invitationRevision: 1,
        agendaItems: MEETING_VISUAL_SUMMARY.agenda.split('\n').map((title, position) => ({
          itemId: '88000000-0000-4000-8000-00000000000' + (position + 1),
          title,
          position,
          objective: null,
          ownerUserId: MEETING_VISUAL_SUMMARY.participants[position].userId,
          ownerDisplayName: MEETING_VISUAL_SUMMARY.participants[position].displayName,
          plannedMinutes: 15,
        })),
        materials: [],
        myResponse: roster[0],
        invitationResponses: host ? roster : [roster[0]],
        invitationCounts: { accepted: 1, tentative: 0, declined: 0, pending: 2 },
        myPreparation: { agendaVersion: 1, version: 0, preparedAgendaItemIds: [], updatedAt: null },
        canEditAgenda: host,
        canManageMaterials: host,
        canRespond: !host,
        canPrepare: true,
        observedAt: MEETING_VISUAL_NOW.toISOString(),
      });
    });
  }
}
