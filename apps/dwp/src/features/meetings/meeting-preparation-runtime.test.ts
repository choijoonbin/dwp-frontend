// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Shared from '@dwp-frontend/shared-utils';
import type * as Api from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type * as PreparationApi from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import { HttpError } from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({
  auth: { userId: 1, tenantId: 1, identityPlane: 'TENANT' },
  meeting: vi.fn(),
  preparation: vi.fn(),
  agenda: vi.fn(),
  respond: vi.fn(),
  registerMaterial: vi.fn(),
  removeMaterial: vi.fn(),
  accessMaterial: vi.fn(),
  personalPreparation: vi.fn(),
  enter: vi.fn(),
  back: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof Shared>()),
  useAuth: () => ({ isAuthenticated: true, user: runtime.auth }),
  useToast: () => ({ success: runtime.success, error: runtime.error }),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-api', async (original) => ({
  ...(await original<typeof Api>()),
  getVideoMeeting: runtime.meeting,
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-preparation-api', async (original) => ({
  ...(await original<typeof PreparationApi>()),
  getVideoMeetingPreparation: runtime.preparation,
  replaceVideoMeetingAgenda: runtime.agenda,
  respondVideoMeetingInvitation: runtime.respond,
  registerVideoMeetingMaterial: runtime.registerMaterial,
  removeVideoMeetingMaterial: runtime.removeMaterial,
  issueVideoMeetingMaterialAccessTicket: runtime.accessMaterial,
  replaceMyVideoMeetingPreparation: runtime.personalPreparation,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
import { MeetingPreparation } from './meeting-preparation';

const id = '99000000-0000-4000-8000-000000000001';
const itemId = '99000000-0000-4000-8000-000000000002';
const participantId = '99000000-0000-4000-8000-000000000003';
const meeting: Api.VideoMeetingSummary = {
  meetingId: id,
  meetingCode: 'ABCD-1234',
  title: 'Release review',
  description: 'Choose the rollout',
  startsAt: '2026-09-04T01:00:00Z',
  endsAt: '2026-09-04T02:00:00Z',
  durationMinutes: 60,
  timeZone: 'Asia/Seoul',
  accessScope: 'INVITED',
  waitingRoomEnabled: true,
  guestAccessEnabled: false,
  allowJoinBeforeHost: false,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  lifecycleState: 'SCHEDULED',
  organizerUserId: 1,
  organizerName: 'Host',
  attendeeCount: 1,
  myRole: 'ORGANIZER',
  canHost: true,
  canModerate: true,
  participants: [],
  decisions: [],
  followUpActions: [],
  artifacts: [],
  aiNotesAvailable: false,
  version: 1,
};
const response = {
  participantId,
  displayName: 'Host',
  response: 'PENDING' as const,
  invitationRevision: 1,
  respondedAt: null,
  version: 0,
  mine: true,
};
const preparation: PreparationApi.VideoMeetingPreparation = {
  meetingId: id,
  meetingVersion: 1,
  agendaVersion: 1,
  materialsVersion: 0,
  invitationRevision: 1,
  agendaItems: [
    {
      itemId,
      position: 0,
      title: 'Review release',
      objective: 'Decide release readiness',
      ownerUserId: 1,
      ownerDisplayName: 'Host',
      plannedMinutes: 20,
    },
  ],
  materials: [],
  myResponse: response,
  invitationResponses: [response],
  invitationCounts: { accepted: 0, tentative: 0, declined: 0, pending: 1 },
  myPreparation: {
    agendaVersion: 1,
    version: 0,
    preparedAgendaItemIds: [],
    updatedAt: null,
  },
  canEditAgenda: true,
  canManageMaterials: true,
  canRespond: true,
  canPrepare: true,
  observedAt: '2026-09-04T00:00:00Z',
};
let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;
let router: ReturnType<typeof createMemoryRouter>;
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
const element = () =>
  createElement(MeetingPreparation, {
    meetingId: id,
    onEnterMeeting: runtime.enter,
    onBack: runtime.back,
  });
async function render() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mount = document.createElement('div');
  document.body.append(mount);
  root = createRoot(mount);
  router = createMemoryRouter([{ path: '/', element: element() }], { initialEntries: ['/'] });
  await act(async () =>
    root.render(
      createElement(QueryClientProvider, { client }, createElement(RouterProvider, { router }))
    )
  );
  await settle();
}
function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find(
    (value) => value.getAttribute('aria-label') === label || value.textContent === label
  );
  if (!found) throw new Error('Missing button: ' + label);
  return found;
}
async function click(label: string) {
  await act(async () => button(label).click());
  await settle();
}
function field(label: string) {
  const labelElement = [...document.querySelectorAll('label')].find((value) =>
    value.textContent?.includes(label)
  );
  return document.getElementById(labelElement!.htmlFor) as HTMLInputElement;
}
async function type(label: string, value: string) {
  await act(async () => {
    const input = field(label);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('meeting preparation runtime', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    runtime.auth = { userId: 1, tenantId: 1, identityPlane: 'TENANT' };
    runtime.meeting.mockResolvedValue(meeting);
    runtime.preparation.mockResolvedValue(preparation);
    runtime.agenda.mockResolvedValue({
      ...preparation,
      agendaVersion: 2,
      myPreparation: { ...preparation.myPreparation, agendaVersion: 2, preparedAgendaItemIds: [] },
    });
    runtime.respond.mockResolvedValue({
      ...preparation,
      myResponse: { ...response, response: 'ACCEPTED', version: 1 },
    });
    runtime.registerMaterial.mockResolvedValue({
      ...preparation,
      materialsVersion: 1,
      materials: [
        {
          materialId: itemId,
          displayName: 'Release evidence',
          contentType: 'application/pdf',
          referenceProvider: 'DWP_FILES',
          opaqueReference: 'files/release-evidence',
          sourceVersion: 'v1',
          classification: 'CONFIDENTIAL',
          sizeBytes: 2048,
          contentSha256: null,
          retentionUntil: '2026-10-04T00:00:00Z',
          accessVerificationState: 'PENDING_REVALIDATION',
          version: 0,
        },
      ],
    });
    runtime.removeMaterial.mockResolvedValue({ ...preparation, materialsVersion: 2 });
    runtime.accessMaterial.mockResolvedValue({
      meetingId: id,
      materialId: itemId,
      materialVersion: 0,
      accessUrl: 'https://files.example.test/meeting-materials/open?ticket=short-lived-ticket-001',
      expiresAt: '2099-09-04T00:01:00Z',
      contentType: 'application/pdf',
      displayName: 'Release evidence',
    });
    runtime.personalPreparation.mockResolvedValue({
      ...preparation,
      myPreparation: {
        ...preparation.myPreparation,
        version: 1,
        preparedAgendaItemIds: [itemId],
        updatedAt: '2026-09-04T00:05:00Z',
      },
    });
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    router?.dispose();
    client?.clear();
    mount?.remove();
  });
  it('renders real meeting, ordered agenda and governed material state honestly', async () => {
    await render();
    expect(mount.textContent).toContain('Release review');
    expect(mount.textContent).toContain('Review release');
    expect(mount.textContent).toContain('preparation.materialVerificationNotice');
    expect(mount.textContent).toContain('preparation.addMaterial');
    expect(mount.textContent).toContain('preparation.chatUnavailable');
    expect(mount.textContent).toContain('preparation.briefingUnavailable');
    expect(runtime.agenda).not.toHaveBeenCalled();
    expect(runtime.enter).not.toHaveBeenCalled();
  });
  it('fails closed when the preparation material contract is incomplete', async () => {
    runtime.preparation.mockResolvedValue({
      ...preparation,
      materials: undefined,
    } as unknown as PreparationApi.VideoMeetingPreparation);
    await render();
    expect(mount.textContent).toContain('preparation.loadError');
    expect(mount.textContent).not.toContain('preparation.addMaterial');
  });
  it('registers only governed provider metadata with the current collection version', async () => {
    await render();
    await click('preparation.addMaterial');
    await type('preparation.materialDisplayName', 'Release evidence');
    await type('preparation.materialOpaqueReference', 'files/release-evidence');
    await click('preparation.registerMaterial');
    expect(runtime.registerMaterial).toHaveBeenCalledWith(
      id,
      expect.objectContaining({
        displayName: 'Release evidence',
        opaqueReference: 'files/release-evidence',
        referenceProvider: 'DWP_FILES',
        classification: 'INTERNAL',
      }),
      0,
      expect.stringMatching(/^[0-9a-f-]{36}$/u)
    );
    expect(runtime.registerMaterial.mock.calls[0][1]).not.toHaveProperty('contents');
  });
  it('revalidates source access before rendering a no-referrer external open action', async () => {
    runtime.preparation.mockResolvedValue({
      ...preparation,
      materials: [
        {
          materialId: itemId,
          displayName: 'Release evidence',
          contentType: 'application/pdf',
          referenceProvider: 'DWP_FILES',
          opaqueReference: null,
          sourceVersion: 'v1',
          classification: 'CONFIDENTIAL',
          sizeBytes: 2048,
          contentSha256: null,
          retentionUntil: '2099-10-04T00:00:00Z',
          accessVerificationState: 'PENDING_REVALIDATION',
          version: 0,
        },
      ],
    });
    await render();
    expect(document.querySelector('a[href*="meeting-materials"]')).toBeNull();
    await click('preparation.verifyMaterialAccess');
    expect(runtime.accessMaterial).toHaveBeenCalledWith(id, itemId, 0);
    const link = document.querySelector<HTMLAnchorElement>('a[href*="meeting-materials"]');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noopener');
    expect(link?.rel).toContain('noreferrer');
    expect(link?.href).not.toContain('files/release-evidence');
  });
  it('preserves purpose, agenda, resources, attendees and policy DOM order for mobile', async () => {
    await render();
    const ids = [...mount.querySelectorAll('section[aria-labelledby]')].map((value) =>
      value.getAttribute('aria-labelledby')
    );
    expect(ids).toEqual([
      'preparation-title',
      'preparation-purpose',
      'preparation-agenda',
      'preparation-materials',
      'preparation-chat',
      'preparation-people',
      'preparation-devices',
      'preparation-policy',
    ]);
  });
  it('updates only the current user checklist with agenda and personal CAS versions', async () => {
    await render();
    const checkbox = mount.querySelector<HTMLInputElement>(
      'input[aria-label="preparation.personalAgendaItemLabel"]'
    );
    expect(checkbox).not.toBeNull();
    await act(async () => checkbox!.click());
    await settle();
    expect(runtime.personalPreparation).toHaveBeenCalledWith(
      id,
      [itemId],
      1,
      0,
      expect.stringMatching(/^[0-9a-f-]{36}$/u)
    );
    expect(runtime.success).toHaveBeenCalledWith('preparation.personalPreparationSaved');
    expect(mount.textContent).not.toContain('another participant');
  });
  it('requires explicit review after a private checklist version conflict', async () => {
    runtime.personalPreparation.mockRejectedValue(new HttpError('Conflict', 409));
    await render();
    const checkbox = mount.querySelector<HTMLInputElement>(
      'input[aria-label="preparation.personalAgendaItemLabel"]'
    );
    await act(async () => checkbox!.click());
    await settle();
    expect(checkbox!.disabled).toBe(true);
    expect(mount.textContent).toContain('preparation.personalPreparationConflict');
    await click('preparation.reviewPersonalPreparation');
    expect(checkbox!.disabled).toBe(false);
  });
  it('passes device entry to the parent only after an explicit action', async () => {
    await render();
    await click('preparation.enter');
    expect(runtime.enter).toHaveBeenCalledTimes(1);
  });
  it('does not enter cancelled meetings', async () => {
    runtime.meeting.mockResolvedValue({ ...meeting, lifecycleState: 'CANCELLED' });
    await render();
    expect(button('preparation.enter').disabled).toBe(true);
  });
  it('does not expose host agenda commands to a read-only attendee', async () => {
    runtime.preparation.mockResolvedValue({ ...preparation, canEditAgenda: false });
    await render();
    expect(mount.textContent).not.toContain('preparation.editAgenda');
  });
  it('responds using the exact current invitation revision and response version', async () => {
    await render();
    await click('preparation.responseActions.ACCEPTED');
    expect(runtime.respond).toHaveBeenCalledWith(
      id,
      'ACCEPTED',
      1,
      0,
      expect.stringMatching(/^[0-9a-f-]{36}$/u)
    );
  });
  it('saves ordered host agenda with its optimistic version and explicit owner IDs', async () => {
    await render();
    await click('preparation.editAgenda');
    await type('preparation.fields.title', 'My edited agenda');
    await click('preparation.saveAgenda');
    expect(runtime.agenda).toHaveBeenCalledWith(
      id,
      [
        {
          itemId,
          title: 'My edited agenda',
          objective: 'Decide release readiness',
          ownerUserId: 1,
          plannedMinutes: 20,
        },
      ],
      1,
      expect.any(String)
    );
  });
  it('preserves a draft after failure and reuses the same command key', async () => {
    runtime.agenda.mockRejectedValue(new Error('Temporary failure'));
    await render();
    await click('preparation.editAgenda');
    await type('preparation.fields.title', 'My edited agenda');
    await click('preparation.saveAgenda');
    expect(field('preparation.fields.title').value).toBe('My edited agenda');
    expect(document.body.textContent).toContain('preparation.commandError');
    await click('preparation.saveAgenda');
    expect(runtime.agenda.mock.calls[0][3]).toBe(runtime.agenda.mock.calls[1][3]);
  });
  it('requires comparing and confirming a new agenda version after a conflict without overwriting draft', async () => {
    runtime.agenda.mockRejectedValue(new HttpError('Conflict', 409));
    await render();
    await click('preparation.editAgenda');
    await type('preparation.fields.title', 'My edited agenda');
    runtime.preparation.mockResolvedValue({
      ...preparation,
      agendaVersion: 2,
      agendaItems: [{ ...preparation.agendaItems[0], title: 'Latest agenda' }],
      myPreparation: {
        ...preparation.myPreparation,
        agendaVersion: 2,
        preparedAgendaItemIds: [],
      },
    });
    await click('preparation.saveAgenda');
    expect(field('preparation.fields.title').value).toBe('My edited agenda');
    expect(button('preparation.saveAgenda').disabled).toBe(true);
    await click('preparation.reviewLatest');
    expect(button('preparation.saveAgenda').disabled).toBe(true);
    await click('preparation.confirmLatest');
    runtime.agenda.mockResolvedValue({
      ...preparation,
      agendaVersion: 3,
      myPreparation: { ...preparation.myPreparation, agendaVersion: 3, preparedAgendaItemIds: [] },
    });
    await click('preparation.saveAgenda');
    expect(runtime.agenda.mock.calls[1][2]).toBe(2);
  });
  it('requires invitation re-review after stale revision conflict', async () => {
    runtime.respond.mockRejectedValue(new HttpError('Conflict', 409));
    await render();
    runtime.preparation.mockResolvedValue({ ...preparation, invitationRevision: 2 });
    await click('preparation.responseActions.ACCEPTED');
    expect(button('preparation.responseActions.ACCEPTED').disabled).toBe(true);
    await click('preparation.reviewInvitation');
    runtime.respond.mockResolvedValue({ ...preparation, invitationRevision: 2 });
    await click('preparation.responseActions.TENTATIVE');
    expect(runtime.respond.mock.calls[1][2]).toBe(2);
  });
  it('clears meeting and editor data immediately when authority is revoked', async () => {
    await render();
    await click('preparation.editAgenda');
    runtime.preparation.mockRejectedValue(new HttpError('Not allowed', 403));
    await act(async () => client.invalidateQueries({ queryKey: ['meetings', 'preparation'] }));
    await settle();
    expect(document.body.textContent).not.toContain('Release review');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(mount.textContent).toContain('preparation.accessTitle');
  });
  it('rejects a late mutation success after a 403 rather than restoring meeting data', async () => {
    let resolve!: (value: unknown) => void;
    runtime.respond.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    await render();
    await act(async () => button('preparation.responseActions.ACCEPTED').click());
    runtime.preparation.mockRejectedValue(new HttpError('Not allowed', 403));
    await click('actions.refresh');
    await act(async () => resolve(preparation));
    await settle();
    expect(mount.textContent).not.toContain('Release review');
    expect(runtime.success).not.toHaveBeenCalled();
  });
  it('rejects a cross-meeting preparation binding', async () => {
    runtime.preparation.mockResolvedValue({ ...preparation, meetingId: 'other' });
    await render();
    expect(mount.textContent).toContain('preparation.loadError');
    expect(mount.textContent).not.toContain('Release review');
  });
  it('clears prior account content and ignores its late command when identity changes', async () => {
    let complete!: (value: unknown) => void;
    runtime.respond.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    await render();
    await act(async () => button('preparation.responseActions.ACCEPTED').click());
    runtime.auth = { userId: 8, tenantId: 2, identityPlane: 'TENANT' };
    runtime.preparation.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      router.routes[0].element = element();
      await router.navigate('/?identity=2');
    });
    expect(mount.textContent).not.toContain('Release review');
    expect(mount.textContent).not.toContain('Review release');
    await act(async () => complete(preparation));
    await settle();
    expect(runtime.success).not.toHaveBeenCalled();
    expect(mount.textContent).not.toContain('Release review');
  });
  it('does not fabricate agenda or people when empty', async () => {
    runtime.preparation.mockResolvedValue({
      ...preparation,
      agendaItems: [],
      invitationResponses: [],
      myResponse: null,
    });
    await render();
    expect(mount.textContent).toContain('preparation.noAgenda');
    expect(mount.textContent).toContain('preparation.noPeople');
    expect(mount.textContent).not.toContain('Review release');
  });
});
