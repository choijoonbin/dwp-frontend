// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type * as Api from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type * as ScheduleApi from '@dwp-frontend/shared-utils/api/video-meeting-schedule-api';
import type { VideoMeetingTemplateScheduleDraft } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import { HttpError } from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({
  auth: { userId: 7, tenantId: 1, identityPlane: 'TENANT' },
  authenticated: true,
  capability: vi.fn(),
  draftGet: vi.fn(),
  draftSave: vi.fn(),
  draftPreview: vi.fn(),
  draftCommit: vi.fn(),
  draftDiscard: vi.fn(),
  seriesPreview: vi.fn(),
  people: vi.fn(),
  created: vi.fn(),
  cancel: vi.fn(),
  refreshAuth: () => undefined as void,
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof SharedUtils>()),
  useAuth: () => ({ isAuthenticated: runtime.authenticated, user: runtime.auth }),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-api', async (original) => ({
  ...(await original<typeof Api>()),
  getVideoMeetingCapabilities: runtime.capability,
  searchVideoMeetingPeople: runtime.people,
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-schedule-api', async (original) => ({
  ...(await original<typeof ScheduleApi>()),
  getVideoMeetingScheduleDraft: runtime.draftGet,
  saveVideoMeetingScheduleDraft: runtime.draftSave,
  previewVideoMeetingScheduleDraftRecurrence: runtime.draftPreview,
  commitVideoMeetingScheduleDraft: runtime.draftCommit,
  discardVideoMeetingScheduleDraft: runtime.draftDiscard,
  previewVideoMeetingSeries: runtime.seriesPreview,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
import { MeetingScheduleWorkspace } from './meeting-schedule-workspace';

const id = '88000000-0000-4000-8000-000000000001';
const template: VideoMeetingTemplateScheduleDraft = {
  sourceTemplateId: id,
  sourceTemplateVersion: 2,
  title: 'Release decision',
  purpose: 'Private preparation notes',
  durationMinutes: 45,
  agendaItems: [
    { title: 'Review risks', description: 'Evidence', role: 'Host', durationMinutes: 15 },
  ],
  accessScope: 'INVITED',
  waitingRoomEnabled: true,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  requiresPolicyRevalidation: true,
};
let root: Root;
let mount: HTMLDivElement;
let router: ReturnType<typeof createMemoryRouter>;
const capability = { available: true, recordingConfigured: false, unavailableReason: null };
const emptySlot: ScheduleApi.VideoMeetingScheduleDraftSlot = {
  draft: null,
  discardOnly: false,
  draftId: null,
  version: null,
  retentionUntil: null,
  observedAt: '2026-09-04T00:00:00Z',
};
const persistedDraft = (
  input: ScheduleApi.VideoMeetingScheduleDraftInput,
  version = (input.expectedVersion ?? -1) + 1
): ScheduleApi.VideoMeetingScheduleDraft => ({
  draftId: '88000000-0000-4000-8000-000000000099',
  title: input.title ?? null,
  agenda: input.agenda ?? null,
  startsAt: input.startsAt ?? null,
  durationMinutes: input.durationMinutes ?? null,
  timeZone: input.timeZone ?? null,
  accessScope: input.accessScope ?? null,
  waitingRoomEnabled: input.waitingRoomEnabled ?? null,
  allowJoinBeforeHost: input.allowJoinBeforeHost ?? null,
  participants: (input.participantUserIds ?? []).map((userId) => ({
    userId,
    personPublicId: null,
    emailAddress: `person-${userId}@example.test`,
    displayName: `Person ${userId}`,
    jobTitle: null,
    organizationName: null,
  })),
  agendaItems: (input.agendaItems ?? []).map((item, position) => ({
    itemId: item.itemId ?? `88000000-0000-4000-8000-${String(position + 1).padStart(12, '0')}`,
    position,
    title: item.title ?? null,
    objective: item.objective ?? null,
    ownerUserId: item.ownerUserId ?? null,
    plannedMinutes: item.plannedMinutes ?? null,
  })),
  recurrence: input.recurrence ?? null,
  sourceTemplateId: input.sourceTemplateId ?? null,
  sourceTemplateVersion: input.sourceTemplateVersion ?? null,
  lastStep: input.lastStep ?? 'DETAILS',
  version,
  retentionUntil: '2026-10-04T00:00:00Z',
  updatedAt: '2026-09-04T00:05:00Z',
});
async function settle(ms = 30) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function render(initialTemplateDraft: VideoMeetingTemplateScheduleDraft | null = template) {
  function Harness() {
    const [, update] = useState(0);
    runtime.refreshAuth = () => update((value) => value + 1);
    return createElement(MeetingScheduleWorkspace, {
      initialTemplateDraft: initialTemplateDraft ?? undefined,
      onCreated: runtime.created,
      onCancel: runtime.cancel,
    });
  }
  mount = document.createElement('div');
  document.body.append(mount);
  root = createRoot(mount);
  router = createMemoryRouter(
    [
      { path: '/meetings/mine', element: createElement(Harness) },
      { path: '/elsewhere', element: createElement('p', null, 'elsewhere') },
    ],
    { initialEntries: ['/meetings/mine?view=schedule'] }
  );
  await act(async () => root.render(createElement(RouterProvider, { router })));
  await settle();
}
function button(label: string) {
  const result = [...document.querySelectorAll('button')].find(
    (item) => item.getAttribute('aria-label') === label || item.textContent === label
  );
  if (!(result instanceof HTMLButtonElement)) throw new Error('Missing button ' + label);
  return result;
}
async function click(label: string) {
  await act(async () => button(label).click());
  await settle();
}
async function clickLast(label: string) {
  const matches = [...document.querySelectorAll('button')].filter(
    (item) => item.getAttribute('aria-label') === label || item.textContent === label
  );
  const target = matches.at(-1);
  if (!(target instanceof HTMLButtonElement)) throw new Error('Missing button ' + label);
  await act(async () => target.click());
  await settle();
}
function input(label: string) {
  const fieldLabel = [...mount.querySelectorAll('label')].find(
    (item) => item.textContent?.replace(/\s*\*$/, '') === label
  );
  const field = fieldLabel?.htmlFor ? document.getElementById(fieldLabel.htmlFor) : undefined;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement))
    throw new Error('Missing field ' + label);
  return field;
}
async function fill(label: string, value: string) {
  const field = input(label);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      field instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype,
      'value'
    )?.set?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle();
}
describe('U03 runtime safety and workflow', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    runtime.auth = { userId: 7, tenantId: 1, identityPlane: 'TENANT' };
    runtime.authenticated = true;
    runtime.capability.mockResolvedValue(capability);
    runtime.people.mockResolvedValue([]);
    runtime.draftGet.mockResolvedValue(emptySlot);
    runtime.draftSave.mockImplementation((input: ScheduleApi.VideoMeetingScheduleDraftInput) =>
      Promise.resolve(persistedDraft(input))
    );
    runtime.draftCommit.mockResolvedValue({ meetingId: id, meetingCode: 'ABCDEFGHJK' });
    runtime.draftDiscard.mockResolvedValue({
      draftId: '88000000-0000-4000-8000-000000000099',
      version: 1,
      discarded: true,
    });
    runtime.seriesPreview.mockResolvedValue({
      previewFingerprint: 'a'.repeat(64),
      hasCalendarAdjustments: false,
      occurrences: [],
    });
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    router?.dispose();
    mount?.remove();
    vi.restoreAllMocks();
  });
  it('renders five desktop sections and four mobile steps without automatically saving, creating or searching', async () => {
    await render();
    expect(mount.querySelectorAll('section').length).toBe(6);
    expect(mount.querySelector('nav')?.querySelectorAll('button')).toHaveLength(4);
    expect(input('schedule.meetingTitle').value).toBe('Release decision');
    expect(runtime.draftGet).toHaveBeenCalledOnce();
    expect(runtime.draftSave).not.toHaveBeenCalled();
    expect(runtime.draftCommit).not.toHaveBeenCalled();
    expect(runtime.people).not.toHaveBeenCalled();
    expect(button('scheduleWorkspace.saveDraft').disabled).toBe(false);
    expect(mount.textContent).toContain('scheduleWorkspace.availabilityUnavailable');
    expect(mount.textContent).toContain('scheduleWorkspace.recordingUnavailable');
  });
  it('creates only explicitly with safe media, typed agenda and immutable template tracing', async () => {
    await render();
    await click('scheduleWorkspace.submit');
    expect(runtime.draftSave).toHaveBeenCalledOnce();
    expect(runtime.draftSave.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        expectedVersion: null,
        title: 'Release decision',
        agenda: 'Private preparation notes',
        sourceTemplateId: id,
        sourceTemplateVersion: 2,
        participantUserIds: [],
        agendaItems: [
          { title: 'Review risks', objective: 'Evidence', ownerUserId: null, plannedMinutes: 15 },
        ],
      })
    );
    expect(runtime.draftSave.mock.calls[0][0]).not.toHaveProperty('defaultCameraEnabled');
    expect(runtime.draftCommit).toHaveBeenCalledWith(
      0,
      null,
      expect.stringMatching(/^[0-9a-f-]{36}$/u)
    );
    expect(runtime.created).toHaveBeenCalledWith(id);
    await click('scheduleWorkspace.submit');
    expect(runtime.draftCommit).toHaveBeenCalledTimes(1);
  });
  it('retains entries and stable save key after an ambiguous failure; changed content gets a new key', async () => {
    runtime.draftSave.mockRejectedValue(new HttpError('Unavailable', 503));
    await render();
    await click('scheduleWorkspace.saveDraft');
    expect(mount.textContent).toContain('scheduleWorkspace.draftSaveError');
    await click('scheduleWorkspace.saveDraft');
    expect(runtime.draftSave.mock.calls[0][1]).toBe(runtime.draftSave.mock.calls[1][1]);
    await fill('schedule.meetingTitle', 'Changed decision');
    await click('scheduleWorkspace.saveDraft');
    expect(runtime.draftSave.mock.calls[2][1]).not.toBe(runtime.draftSave.mock.calls[1][1]);
    expect(input('schedule.meetingTitle').value).toBe('Changed decision');
  });
  it('reuses the commit key after an ambiguous outcome without duplicating the saved draft', async () => {
    runtime.draftCommit.mockRejectedValue(new HttpError('Unavailable', 503));
    await render();
    await click('scheduleWorkspace.submit');
    await click('scheduleWorkspace.submit');
    expect(runtime.draftSave).toHaveBeenCalledOnce();
    expect(runtime.draftCommit.mock.calls[0][2]).toBe(runtime.draftCommit.mock.calls[1][2]);
    expect(mount.textContent).toContain('scheduleWorkspace.createFailed');
  });
  it('prevents concurrent duplicate creates', async () => {
    const pending = deferred<{ meetingId: string; meetingCode: string }>();
    runtime.draftCommit.mockReturnValue(pending.promise);
    await render();
    await act(async () => {
      button('scheduleWorkspace.submit').click();
      button('scheduleWorkspace.submit').click();
    });
    await settle();
    expect(runtime.draftCommit).toHaveBeenCalledOnce();
    expect(input('schedule.meetingTitle').disabled).toBe(true);
    await act(async () => pending.resolve({ meetingId: id, meetingCode: 'ABCDEFGHJK' }));
  });
  it.each([400, 409])(
    'shows %s scheduling rejection while preserving the draft',
    async (status) => {
      runtime.draftCommit.mockRejectedValue(new HttpError('Denied', status));
      await render();
      await click('scheduleWorkspace.submit');
      expect(input('schedule.meetingTitle').value).toBe('Release decision');
      expect(mount.textContent).toContain(
        status === 409 ? 'scheduleWorkspace.conflict' : 'scheduleWorkspace.policyRejected'
      );
      expect(runtime.created).not.toHaveBeenCalled();
    }
  );
  it('removes sensitive fields after a 403 create without fabricated success', async () => {
    runtime.draftCommit.mockRejectedValue(new HttpError('Forbidden', 403));
    await render();
    await click('scheduleWorkspace.submit');
    expect(mount.textContent).toContain('scheduleWorkspace.accessRevoked');
    expect(mount.textContent).not.toContain('Private preparation notes');
    expect(mount.querySelector('input')).toBeNull();
    expect(runtime.created).not.toHaveBeenCalled();
  });
  it('invalidates the old draft and late create on tenant/user scope change', async () => {
    const pending = deferred<{ meetingId: string; meetingCode: string }>();
    runtime.draftCommit.mockReturnValue(pending.promise);
    await render();
    await click('scheduleWorkspace.submit');
    runtime.auth = { userId: 9, tenantId: 2, identityPlane: 'TENANT' };
    await act(async () => runtime.refreshAuth());
    await settle();
    expect(input('schedule.meetingTitle').value).toBe('');
    await act(async () => pending.resolve({ meetingId: id, meetingCode: 'ABCDEFGHJK' }));
    expect(runtime.created).not.toHaveBeenCalled();
    expect(input('schedule.meetingTitle').value).toBe('');
  });
  it('fences a late create success after an in-flight people lookup returns 403', async () => {
    const lookup = deferred<Api.VideoMeetingPerson[]>();
    const creating = deferred<{ meetingId: string; meetingCode: string }>();
    runtime.people.mockReturnValue(lookup.promise);
    runtime.draftCommit.mockReturnValue(creating.promise);
    await render();
    await fill('schedule.participants', 'Review');
    await settle(300);
    expect(runtime.people).toHaveBeenCalledWith('Review', 30);
    await click('scheduleWorkspace.submit');
    await act(async () => lookup.reject(new HttpError('Revoked', 403)));
    await settle();
    await act(async () => creating.resolve({ meetingId: id, meetingCode: 'ABCDEFGHJK' }));
    expect(mount.textContent).toContain('scheduleWorkspace.accessRevoked');
    expect(runtime.created).not.toHaveBeenCalled();
  });
  it('blocks creation on organization policy denial and on capability lookup failure', async () => {
    runtime.capability.mockResolvedValue({
      ...capability,
      unavailableReason: 'MEETINGS_DISABLED_BY_POLICY',
    });
    await render();
    expect(button('scheduleWorkspace.submit').disabled).toBe(true);
    expect(mount.textContent).toContain('scheduleWorkspace.policyDisabled');
    expect(runtime.draftCommit).not.toHaveBeenCalled();
  });
  it('keeps a failed capability check local and retries it before enabling create', async () => {
    runtime.capability
      .mockRejectedValueOnce(new HttpError('Unavailable', 503))
      .mockResolvedValue(capability);
    await render();
    expect(button('scheduleWorkspace.submit').disabled).toBe(true);
    expect(mount.textContent).toContain('scheduleWorkspace.capabilityError');
    expect(
      mount.querySelector('[data-testid="meeting-schedule-mobile-capability-error"]')
    ).not.toBeNull();
    await click('actions.retry');
    expect(button('scheduleWorkspace.submit').disabled).toBe(false);
    expect(input('schedule.meetingTitle').value).toBe('Release decision');
  });
  it('ignores an obsolete search failure after a newer search succeeds', async () => {
    const older = deferred<Api.VideoMeetingPerson[]>();
    runtime.people.mockReturnValueOnce(older.promise).mockResolvedValueOnce([]);
    await render();
    await fill('schedule.participants', 'Older');
    await settle(300);
    await fill('schedule.participants', 'Current');
    await settle(300);
    await act(async () => older.reject(new HttpError('Older lookup failed', 503)));
    await settle();
    expect(runtime.people.mock.calls.map((call) => call[0])).toEqual(['Older', 'Current']);
    expect(mount.textContent).not.toContain('schedule.participantSearchError');
    expect(input('schedule.participants').value).toBe('Current');
  });
  it('stores no meeting body in browser storage or URL', async () => {
    const store = vi.spyOn(Storage.prototype, 'setItem');
    await render();
    await fill('scheduleWorkspace.purpose', 'Confidential updated notes');
    expect(store).not.toHaveBeenCalled();
    expect(router.state.location.search).toBe('?view=schedule');
    expect(input('scheduleWorkspace.purpose').value).toBe('Confidential updated notes');
  });
  it('restores a persisted server draft and its last completed step without browser storage', async () => {
    const saved = persistedDraft({
      expectedVersion: null,
      title: 'Restored server draft',
      agenda: 'Server-only notes',
      startsAt: new Date(Date.now() + 3_600_000).toISOString(),
      durationMinutes: 30,
      timeZone: 'Asia/Seoul',
      accessScope: 'INVITED',
      waitingRoomEnabled: true,
      allowJoinBeforeHost: false,
      participantUserIds: [],
      agendaItems: [],
      recurrence: { frequency: 'NONE', interval: 1, occurrenceCount: 4 },
      lastStep: 'REVIEW',
    });
    runtime.draftGet.mockResolvedValue({
      draft: saved,
      discardOnly: false,
      draftId: saved.draftId,
      version: saved.version,
      retentionUntil: saved.retentionUntil,
      observedAt: saved.updatedAt,
    });
    const store = vi.spyOn(Storage.prototype, 'setItem');
    await render(null);
    expect(input('schedule.meetingTitle').value).toBe('Restored server draft');
    expect(mount.querySelector('[aria-current="step"]')?.textContent).toContain(
      'scheduleWorkspace.steps.review'
    );
    expect(mount.textContent).toContain('scheduleWorkspace.draftRestored');
    expect(store).not.toHaveBeenCalled();
  });
  it('renders stale join-before-host state as disabled and unchecked', async () => {
    const saved = persistedDraft({
      expectedVersion: null,
      title: 'Safe restored draft',
      agenda: null,
      startsAt: new Date(Date.now() + 3_600_000).toISOString(),
      durationMinutes: 30,
      timeZone: 'Asia/Seoul',
      accessScope: 'INVITED',
      waitingRoomEnabled: true,
      allowJoinBeforeHost: true,
      participantUserIds: [],
      agendaItems: [],
      recurrence: { frequency: 'NONE', interval: 1, occurrenceCount: 4 },
      lastStep: 'REVIEW',
    });
    runtime.draftGet.mockResolvedValue({
      draft: saved,
      discardOnly: false,
      draftId: saved.draftId,
      version: saved.version,
      retentionUntil: saved.retentionUntil,
      observedAt: saved.updatedAt,
    });

    await render(null);

    const label = [...mount.querySelectorAll('label')].find(
      (candidate) => candidate.textContent === 'scheduleWorkspace.joinBeforeHost'
    );
    const control = label?.querySelector('input');
    expect(control).toBeInstanceOf(HTMLInputElement);
    expect(control?.disabled).toBe(true);
    expect(control?.checked).toBe(false);
    expect(mount.textContent).toContain('scheduleWorkspace.joinBeforeHostUnavailable');
  });
  it('keeps a revoked or expired source opaque and supports blind discard', async () => {
    runtime.draftGet.mockResolvedValue({
      draft: null,
      discardOnly: true,
      draftId: '88000000-0000-4000-8000-000000000099',
      version: 3,
      retentionUntil: '2026-10-04T00:00:00Z',
      observedAt: '2026-09-04T00:05:00Z',
    });
    await render();
    expect(mount.textContent).toContain('scheduleWorkspace.draftSourceUnavailable');
    expect(mount.textContent).not.toContain('Private preparation notes');
    expect(mount.querySelector('input')).toBeNull();
    await click('scheduleWorkspace.discardSavedDraft');
    await clickLast('scheduleWorkspace.discardSavedDraft');
    expect(runtime.draftDiscard).toHaveBeenCalledWith(3, expect.stringMatching(/^[0-9a-f-]{36}$/u));
    expect(input('schedule.meetingTitle').value).toBe('');
  });
  it('preserves current entries on a conflicting save until the user restores latest', async () => {
    const latest = persistedDraft(
      {
        expectedVersion: null,
        title: 'Latest server draft',
        agenda: 'Latest server notes',
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        durationMinutes: 30,
        timeZone: 'Asia/Seoul',
        accessScope: 'INVITED',
        waitingRoomEnabled: true,
        allowJoinBeforeHost: false,
        participantUserIds: [],
        agendaItems: [],
        recurrence: { frequency: 'NONE', interval: 1, occurrenceCount: 4 },
        lastStep: 'DETAILS',
      },
      4
    );
    runtime.draftGet.mockResolvedValueOnce(emptySlot).mockResolvedValueOnce({
      draft: latest,
      discardOnly: false,
      draftId: latest.draftId,
      version: latest.version,
      retentionUntil: latest.retentionUntil,
      observedAt: latest.updatedAt,
    });
    runtime.draftSave.mockRejectedValue(new HttpError('Conflict', 409));
    await render();
    await click('scheduleWorkspace.saveDraft');
    expect(input('schedule.meetingTitle').value).toBe('Release decision');
    expect(mount.textContent).toContain('scheduleWorkspace.draftConflictHint');
    await click('scheduleWorkspace.restoreLatestDraft');
    expect(input('schedule.meetingTitle').value).toBe('Latest server draft');
  });
  it('fences a late saved-draft response after tenant scope changes', async () => {
    const pending = deferred<ScheduleApi.VideoMeetingScheduleDraftSlot>();
    runtime.draftGet.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(emptySlot);
    await render();
    runtime.auth = { userId: 9, tenantId: 2, identityPlane: 'TENANT' };
    await act(async () => runtime.refreshAuth());
    await settle();
    const sensitive = persistedDraft({
      expectedVersion: null,
      title: 'Old tenant confidential draft',
      lastStep: 'DETAILS',
    });
    await act(async () =>
      pending.resolve({
        draft: sensitive,
        discardOnly: false,
        draftId: sensitive.draftId,
        version: sensitive.version,
        retentionUntil: sensitive.retentionUntil,
        observedAt: sensitive.updatedAt,
      })
    );
    await settle();
    expect(input('schedule.meetingTitle').value).toBe('');
    expect(mount.textContent).not.toContain('Old tenant confidential draft');
  });
  it('does not fetch or expose a draft for an unauthenticated session', async () => {
    runtime.authenticated = false;
    await render();
    expect(runtime.capability).not.toHaveBeenCalled();
    expect(runtime.draftGet).not.toHaveBeenCalled();
    expect(mount.textContent).toContain('scheduleWorkspace.accessRevoked');
    expect(mount.querySelector('input')).toBeNull();
  });
  it('keeps provider unavailability truthful while allowing a future reservation', async () => {
    runtime.capability.mockResolvedValue({
      ...capability,
      available: false,
      unavailableReason: 'PROVIDER_NOT_CONFIGURED',
    });
    await render();
    expect(button('scheduleWorkspace.submit').disabled).toBe(false);
    expect(mount.textContent).toContain('scheduleWorkspace.mediaUnavailable');
  });
  it('validates mobile progression and keeps entered agenda when returning to a step', async () => {
    await render(null);
    await click('scheduleWorkspace.next');
    expect(mount.textContent).toContain('scheduleWorkspace.validation.title');
    await fill('schedule.meetingTitle', 'Planning');
    await click('scheduleWorkspace.next');
    expect(mount.querySelector('[aria-current="step"]')?.textContent).toContain(
      'scheduleWorkspace.steps.people'
    );
    await click('scheduleWorkspace.previous');
    expect(input('schedule.meetingTitle').value).toBe('Planning');
  });
  it('requires confirmation to discard user-entered data', async () => {
    await render();
    await fill('schedule.meetingTitle', 'Unsaved change');
    await click('actions.cancel');
    expect(runtime.cancel).not.toHaveBeenCalled();
    await click('templates.discard');
    expect(runtime.cancel).toHaveBeenCalledOnce();
  });
});
