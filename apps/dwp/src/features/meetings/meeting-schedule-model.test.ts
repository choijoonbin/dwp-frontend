import { describe, expect, it, vi } from 'vitest';
import {
  emptyMeetingSchedule,
  meetingScheduleAttempt,
  meetingScheduleDraftAttempt,
  meetingScheduleDraftInput,
  meetingScheduleDraftStep,
  meetingScheduleDraftStepIndex,
  meetingScheduleError,
  meetingScheduleStepError,
  moveMeetingScheduleAgenda,
  scheduleMeetingInput,
  restoreMeetingScheduleDraft,
} from './meeting-schedule-model';
import type { VideoMeetingTemplateScheduleDraft } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import type { VideoMeetingScheduleDraft } from '@dwp-frontend/shared-utils/api/video-meeting-schedule-api';

const template: VideoMeetingTemplateScheduleDraft = {
  sourceTemplateId: '88000000-0000-4000-8000-000000000001',
  sourceTemplateVersion: 2,
  title: ' Release decision ',
  purpose: ' Prepare a choice ',
  durationMinutes: 45,
  agendaItems: [
    { title: ' Risks ', description: ' Evidence ', role: 'Facilitator', durationMinutes: 15 },
  ],
  accessScope: 'INVITED',
  waitingRoomEnabled: true,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  requiresPolicyRevalidation: true,
};
function valid() {
  return emptyMeetingSchedule('Asia/Seoul', template, new Date(Date.now() + 3_600_000));
}
describe('U03 shared desktop/mobile scheduling model', () => {
  it('starts with explicit safe media and no identities or consent from a template', () => {
    const draft = valid();
    expect(draft.participants).toEqual([]);
    expect(draft.agendaItems[0].ownerUserId).toBeNull();
    expect(draft.agendaItems[0].roleHint).toBe('Facilitator');
    const input = scheduleMeetingInput(draft, 'key');
    expect(input.defaultMicrophoneEnabled).toBe(false);
    expect(input.defaultCameraEnabled).toBe(false);
    expect(input).not.toHaveProperty('consent');
    expect(input.agendaItems?.[0]).not.toHaveProperty('key');
    expect(input.agendaItems?.[0]).not.toHaveProperty('roleHint');
    expect(input.sourceTemplateVersion).toBe(2);
    expect(input.title).toBe('Release decision');
  });
  it('never sends an unverified join-before-host request from stale client state', () => {
    const stale = { ...valid(), allowJoinBeforeHost: true };
    expect(meetingScheduleDraftInput(stale, 3, 3).allowJoinBeforeHost).toBe(false);
    expect(scheduleMeetingInput(stale, 'key').allowJoinBeforeHost).toBe(false);
  });
  it('supports an intentionally empty agenda for a valid single meeting', () => {
    const draft = {
      ...valid(),
      agendaItems: [],
      sourceTemplateId: undefined,
      sourceTemplateVersion: undefined,
    };
    expect(meetingScheduleError(draft, 7)).toBeNull();
    expect(scheduleMeetingInput(draft, 'key')).not.toHaveProperty('sourceTemplateId');
  });
  it.each([
    ['title', { title: '  ' }],
    ['title', { title: 'a'.repeat(241) }],
    ['purpose', { agenda: 'a'.repeat(8001) }],
    ['time', { startsAt: null }],
    ['time', { startsAt: 'not-a-time' }],
    ['time', { startsAt: '2020-01-01T00:00:00Z' }],
    ['duration', { durationMinutes: 4 }],
    ['duration', { durationMinutes: 1441 }],
    ['duration', { durationMinutes: 5.5 }],
    ['timeZone', { timeZone: 'Invalid/Zone' }],
    ['source', { sourceTemplateVersion: -1 }],
  ])('validates %s without sending a command', (error, patch) => {
    expect(meetingScheduleError({ ...valid(), ...patch }, 7)).toBe(error);
  });
  it('requires agenda owners to be organizer or a selected participant', () => {
    const draft = valid();
    draft.agendaItems[0].ownerUserId = 9;
    expect(meetingScheduleError(draft, 7)).toBe('owner');
    draft.participants = [
      { userId: 9, displayName: 'Reviewer', emailAddress: 'reviewer@example.test' },
    ];
    expect(meetingScheduleError(draft, 7)).toBeNull();
    draft.participants = [];
    draft.agendaItems[0].ownerUserId = 7;
    expect(meetingScheduleError(draft, 7)).toBeNull();
  });
  it('validates agenda limits and total time', () => {
    const draft = valid();
    draft.agendaItems[0].plannedMinutes = 46;
    expect(meetingScheduleError(draft, 7)).toBe('agendaTime');
    draft.agendaItems[0].plannedMinutes = 0;
    expect(meetingScheduleError(draft, 7)).toBe('agenda');
    draft.agendaItems = Array.from({ length: 51 }, (_, index) => ({
      ...valid().agendaItems[0],
      key: String(index),
    }));
    expect(meetingScheduleError(draft, 7)).toBe('agendaLimit');
  });
  it('preserves stable local item identity during keyboard reorder', () => {
    const draft = valid();
    draft.agendaItems.push({ ...draft.agendaItems[0], key: 'second', title: 'Decide' });
    expect(
      moveMeetingScheduleAgenda(draft, 'second', -1).agendaItems.map((item) => item.key)
    ).toEqual(['second', 'template-0']);
    expect(moveMeetingScheduleAgenda(draft, 'missing', 1)).toBe(draft);
    expect(moveMeetingScheduleAgenda(draft, 'template-0', -1)).toBe(draft);
  });
  it('validates each mobile step independently of errors in another step', () => {
    const draft = { ...valid(), title: '', startsAt: null };
    expect(meetingScheduleStepError(draft, 7, 0)).toBe('title');
    expect(meetingScheduleStepError(draft, 7, 1)).toBe('time');
    expect(meetingScheduleStepError(draft, 7, 2)).toBeNull();
    expect(meetingScheduleStepError(draft, 7, 3)).toBe('title');
  });
  it('keeps the key for an ambiguous retry and changes it only when the canonical body changes', () => {
    const input = scheduleMeetingInput(valid(), 'ignored');
    const key = vi.fn().mockReturnValueOnce('one').mockReturnValueOnce('two');
    const first = meetingScheduleAttempt(null, input, key);
    expect(meetingScheduleAttempt(first, { ...input, idempotencyKey: 'different' }, key)).toBe(
      first
    );
    expect(meetingScheduleAttempt(first, { ...input, title: 'New title' }, key).key).toBe('two');
    expect(key).toHaveBeenCalledTimes(2);
  });
  it('maps the four UI steps to the persisted draft contract in both directions', () => {
    expect([0, 1, 2, 3].map(meetingScheduleDraftStep)).toEqual([
      'DETAILS',
      'SCHEDULE',
      'RECURRENCE',
      'REVIEW',
    ]);
    expect(
      (['DETAILS', 'SCHEDULE', 'RECURRENCE', 'REVIEW'] as const).map(meetingScheduleDraftStepIndex)
    ).toEqual([0, 1, 2, 3]);
  });
  it('serializes only the governed draft allowlist and preserves server agenda identity', () => {
    const draft = valid();
    draft.agendaItems = [
      { ...draft.agendaItems[0], key: '88000000-0000-4000-8000-000000000010' },
      { ...draft.agendaItems[0], key: 'local-only', title: 'New item' },
    ];
    const input = meetingScheduleDraftInput(draft, 4, 2);
    expect(input).toMatchObject({ expectedVersion: 4, lastStep: 'RECURRENCE' });
    expect(input.agendaItems?.[0].itemId).toBe('88000000-0000-4000-8000-000000000010');
    expect(input.agendaItems?.[1]).not.toHaveProperty('itemId');
    expect(input).not.toHaveProperty('defaultCameraEnabled');
    expect(input).not.toHaveProperty('consent');
    expect(input.agendaItems?.[0]).not.toHaveProperty('key');
    expect(input.agendaItems?.[0]).not.toHaveProperty('roleHint');
  });
  it('hydrates a server draft in canonical agenda order without restoring browser-only fields', () => {
    const fallback = valid();
    const persisted = {
      draftId: '88000000-0000-4000-8000-000000000099',
      title: 'Server draft',
      agenda: null,
      startsAt: null,
      durationMinutes: null,
      timeZone: null,
      accessScope: null,
      waitingRoomEnabled: null,
      allowJoinBeforeHost: true,
      participants: [],
      agendaItems: [
        {
          itemId: '88000000-0000-4000-8000-000000000012',
          position: 1,
          title: 'Second',
          objective: null,
          ownerUserId: null,
          plannedMinutes: null,
        },
        {
          itemId: '88000000-0000-4000-8000-000000000011',
          position: 0,
          title: 'First',
          objective: 'Prepare evidence',
          ownerUserId: null,
          plannedMinutes: 10,
        },
      ],
      recurrence: null,
      sourceTemplateId: null,
      sourceTemplateVersion: null,
      lastStep: 'DETAILS',
      version: 0,
      retentionUntil: '2026-10-04T00:00:00Z',
      updatedAt: '2026-09-04T00:00:00Z',
    } satisfies VideoMeetingScheduleDraft;
    const restored = restoreMeetingScheduleDraft(persisted, fallback);
    expect(restored.agendaItems.map((item) => item.title)).toEqual(['First', 'Second']);
    expect(restored.durationMinutes).toBe(fallback.durationMinutes);
    expect(restored.allowJoinBeforeHost).toBe(false);
    expect(restored).not.toHaveProperty('draftId');
    expect(restored).not.toHaveProperty('retentionUntil');
  });
  it('keeps stable draft command keys only for an identical optimistic payload', () => {
    const input = meetingScheduleDraftInput(valid(), null, 0);
    const key = vi.fn().mockReturnValueOnce('one').mockReturnValueOnce('two');
    const first = meetingScheduleDraftAttempt(null, input, key);
    expect(meetingScheduleDraftAttempt(first, { ...input }, key)).toBe(first);
    expect(meetingScheduleDraftAttempt(first, { ...input, lastStep: 'REVIEW' }, key).key).toBe(
      'two'
    );
  });
});
