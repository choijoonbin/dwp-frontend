// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Shared from '@dwp-frontend/shared-utils';
import type * as MeetingApi from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type * as ScheduleApi from '@dwp-frontend/shared-utils/api/video-meeting-schedule-api';

const runtime = vi.hoisted(() => ({
  get: vi.fn(),
  previewCancel: vi.fn(),
  cancel: vi.fn(),
  previewChange: vi.fn(),
  change: vi.fn(),
  success: vi.fn(),
  changed: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof Shared>()),
  useToast: () => ({ success: runtime.success, error: vi.fn() }),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-schedule-api', async (original) => ({
  ...(await original<typeof ScheduleApi>()),
  getVideoMeetingSchedule: runtime.get,
  previewVideoMeetingCancellation: runtime.previewCancel,
  cancelScheduledVideoMeeting: runtime.cancel,
  previewVideoMeetingReschedule: runtime.previewChange,
  rescheduleVideoMeeting: runtime.change,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
import { MeetingScheduleManagement } from './meeting-schedule-management';

const meetingId = '88000000-0000-4000-8000-000000000101';
const meeting: MeetingApi.VideoMeetingSummary = {
  meetingId,
  meetingCode: 'ABCD-EFGH-JKMN',
  title: 'Architecture review',
  description: '',
  startsAt: '2027-02-01T01:00:00Z',
  endsAt: '2027-02-01T02:00:00Z',
  durationMinutes: 60,
  timeZone: 'Asia/Seoul',
  accessScope: 'INVITED',
  waitingRoomEnabled: true,
  guestAccessEnabled: false,
  allowJoinBeforeHost: false,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  lifecycleState: 'SCHEDULED',
  organizerUserId: 7,
  organizerName: 'Host',
  attendeeCount: 2,
  myRole: 'ORGANIZER',
  canHost: true,
  canModerate: true,
  participants: [],
  decisions: [],
  followUpActions: [],
  artifacts: [],
  aiNotesAvailable: false,
  version: 3,
};
const schedule: ScheduleApi.VideoMeetingScheduleState = {
  meetingId,
  lifecycleState: 'SCHEDULED',
  startsAt: meeting.startsAt,
  endsAt: meeting.endsAt,
  timeZone: meeting.timeZone,
  meetingVersion: 3,
  seriesId: null,
  occurrenceIndex: null,
  occurrenceCount: null,
  frequency: null,
  recurrenceInterval: null,
  seriesVersion: null,
  exceptionState: 'NONE',
  invitationRevision: 2,
  deliveryState: 'PENDING',
};
const impact: ScheduleApi.VideoMeetingCancellationPreview = {
  impactFingerprint: 'a'.repeat(64),
  scope: 'THIS_ONLY',
  affectedOccurrenceCount: 1,
  skippedImmutableOccurrenceCount: 0,
  invitationRevision: 3,
  seriesVersion: null,
};
let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function render() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mount = document.createElement('div');
  document.body.append(mount);
  root = createRoot(mount);
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MeetingScheduleManagement, {
          meeting,
          onChanged: runtime.changed,
        })
      )
    )
  );
  await settle();
}
function button(name: string) {
  const result = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === name
  );
  if (!result) throw new Error('Missing button ' + name);
  return result as HTMLButtonElement;
}
async function click(name: string) {
  await act(async () => button(name).click());
  await settle();
}
async function reviewCancellation() {
  await click('scheduleManagement.cancel');
  await click('scheduleManagement.reviewImpact');
  const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!checkbox) throw new Error('Missing impact confirmation');
  await act(async () => checkbox.click());
}

describe('meeting schedule management runtime', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '88000000-0000-4000-8000-000000000199'
    );
    runtime.get.mockResolvedValue(schedule);
    runtime.previewCancel.mockResolvedValue(impact);
    runtime.cancel.mockResolvedValue({
      ...schedule,
      lifecycleState: 'CANCELLED',
      meetingVersion: 4,
      invitationRevision: 3,
      deliveryState: 'CANCELLED',
    });
    runtime.changed.mockResolvedValue(undefined);
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    client?.clear();
    mount?.remove();
    vi.restoreAllMocks();
  });

  it('requires impact preview and explicit confirmation before cancelling', async () => {
    await render();
    await reviewCancellation();
    expect(runtime.cancel).not.toHaveBeenCalled();
    await click('scheduleManagement.confirmCancel');
    expect(runtime.previewCancel).toHaveBeenCalledWith(meetingId, {
      scope: 'THIS_ONLY',
      expectedSeriesVersion: null,
      expectedVersion: 3,
    });
    expect(runtime.cancel).toHaveBeenCalledWith(
      meetingId,
      expect.objectContaining({ impactFingerprint: impact.impactFingerprint }),
      '88000000-0000-4000-8000-000000000199'
    );
    expect(runtime.success).toHaveBeenCalledWith('scheduleManagement.cancelled');
  });

  it('retains the same command key after an unconfirmed response and does not misreport refresh failure', async () => {
    runtime.cancel.mockRejectedValueOnce(new Error('lost response'));
    await render();
    await reviewCancellation();
    await click('scheduleManagement.confirmCancel');
    expect(document.body.textContent).toContain('scheduleManagement.errors.command');
    runtime.changed.mockRejectedValueOnce(new Error('refresh failed'));
    await click('scheduleManagement.confirmCancel');
    expect(runtime.cancel).toHaveBeenCalledTimes(2);
    expect(runtime.cancel.mock.calls[0][2]).toBe(runtime.cancel.mock.calls[1][2]);
    await settle();
    expect(runtime.success).toHaveBeenCalledWith('scheduleManagement.cancelled');
    expect(document.body.textContent).not.toContain('scheduleManagement.errors.command');
  });

  it('recovers a transient initial load through an explicit retry without losing the meeting context', async () => {
    runtime.get.mockRejectedValueOnce(new Error('temporary outage')).mockResolvedValue(schedule);
    await render();
    expect(document.body.textContent).toContain('scheduleManagement.loadFailed');
    expect(runtime.get).toHaveBeenCalledTimes(1);

    await click('actions.retry');

    expect(runtime.get).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('scheduleManagement.deliveryState');
    expect(document.body.textContent).toContain('scheduleManagement.invitationRevision');
  });
});
