// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoMeetingPreparation } from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
const runtime = vi.hoisted(() => ({
  read: vi.fn(),
  navigate: vi.fn(),
  copy: vi.fn(),
  toast: vi.fn(),
  userId: 7,
}));
vi.mock('@dwp-frontend/shared-utils', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { tenantId: 1, userId: runtime.userId, identityPlane: 'TENANT' },
  }),
  useToast: () => ({ success: runtime.toast, error: runtime.toast }),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-preparation-api', () => ({
  getVideoMeetingPreparation: runtime.read,
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => runtime.navigate }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: object) => key + (values ? JSON.stringify(values) : ''),
    i18n: { language: 'ko' },
  }),
}));
import { MeetingHomeFocus } from './meeting-home-focus';

const id = '99000000-0000-4000-8000-000000000001';
const now = Date.parse('2026-09-07T04:00:00Z');
const meeting = {
  meetingId: id,
  title: 'Authorized meeting',
  meetingCode: 'ABCD-EFGH',
  startsAt: '2026-09-07T05:00:00Z',
  endsAt: '2026-09-07T05:45:00Z',
  durationMinutes: 45,
  lifecycleState: 'SCHEDULED',
  organizerName: 'Host',
  attendeeCount: 3,
  canHost: true,
  accessScope: 'INTERNAL',
  participants: [],
  agenda: 'Legacy agenda',
} as unknown as VideoMeetingSummary;
const preparation = {
  meetingId: id,
  agendaVersion: 3,
  agendaItems: [
    {
      itemId: 'a',
      title: 'Actual approved agenda',
      plannedMinutes: 15,
      ownerDisplayName: 'Agenda owner',
    },
  ],
  materials: [
    { retentionUntil: '2026-09-08T04:00:00Z' },
    { retentionUntil: '2026-09-06T04:00:00Z' },
  ],
  invitationResponses: [{ participantId: 'p', displayName: 'Invited user' }],
  invitationCounts: { accepted: 2, pending: 1 },
  myPreparation: { agendaVersion: 3, preparedAgendaItemIds: ['a', 'removed'] },
} as unknown as VideoMeetingPreparation;
let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;
async function render(disabled = false) {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MeetingHomeFocus, {
          meeting,
          now,
          timeZone: 'Asia/Seoul',
          disabled,
          onStart: vi.fn(),
        })
      )
    )
  );
}
async function shown(text: string) {
  await act(async () => {
    await vi.waitFor(() => expect(mount.textContent).toContain(text));
  });
}
async function click(label: string) {
  const button = [...mount.querySelectorAll('button')].find((item) =>
    item.textContent?.startsWith(label)
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
describe('home uses the actual authorized preparation contract', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    runtime.userId = 7;
    runtime.read.mockReset().mockResolvedValue(preparation);
    runtime.navigate.mockReset();
    runtime.copy.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: runtime.copy },
    });
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    mount.remove();
  });
  it('replaces legacy plain text with actual agenda, time, owner, response and valid material counts', async () => {
    await render();
    await shown('Actual approved agenda');
    expect(mount.textContent).toContain('Agenda owner');
    expect(mount.textContent).toContain('home.design.materialCount{"count":1}');
    expect(mount.textContent).toContain('home.design.prepared{"completed":1,"total":1}');
    expect(mount.textContent).toContain('home.design.responses{"accepted":2,"pending":1}');
    expect(mount.textContent).not.toContain('Legacy agenda');
    expect(runtime.read).toHaveBeenCalledWith(id, expect.any(AbortSignal));
  });
  it('does not claim my preparation completed against an old agenda version', async () => {
    runtime.read.mockResolvedValue({
      ...preparation,
      myPreparation: { agendaVersion: 2, preparedAgendaItemIds: ['a'] },
    });
    await render();
    await shown('home.design.prepared{"completed":0,"total":1}');
  });
  it('opens real preparation and prejoin as distinct actions without creating a meeting', async () => {
    await render();
    await shown('Actual approved agenda');
    await click('home.design.materialCount');
    await click('home.design.enterAndCheck');
    expect(runtime.navigate.mock.calls.map(([path]) => path)).toEqual([
      '/meetings/mine?view=preparation&meetingId=' + id,
      '/meetings/room/' + id,
    ]);
  });
  it('copies only the existing invitation code rather than private agenda content', async () => {
    await render();
    await shown('Actual approved agenda');
    await click('home.design.copyLink');
    expect(runtime.copy).toHaveBeenCalledOnce();
    expect(runtime.copy.mock.calls[0][0]).toContain('/meetings/join?code=ABCD-EFGH');
    expect(runtime.copy.mock.calls[0][0]).not.toContain('Actual');
  });
  it('removes preparation content immediately when revalidation fails', async () => {
    await render();
    await shown('Actual approved agenda');
    runtime.read.mockRejectedValue(new Error('403'));
    await act(async () =>
      client.invalidateQueries({ queryKey: ['meetings', 'home', 'preparation'] })
    );
    await shown('home.design.preparationUnavailable');
    expect(mount.textContent).not.toContain('Actual approved agenda');
    expect(mount.textContent).not.toContain('Agenda owner');
    expect(mount.textContent).not.toContain('home.design.materialCount');
  });
  it('aborts a stale scope request and never renders its late source data', async () => {
    let resolve!: (value: VideoMeetingPreparation) => void;
    runtime.read
      .mockReturnValueOnce(
        new Promise<VideoMeetingPreparation>((done) => {
          resolve = done;
        })
      )
      .mockResolvedValue({ ...preparation, agendaItems: [] });
    await render();
    const signal = runtime.read.mock.calls[0][1] as AbortSignal;
    runtime.userId = 8;
    await render();
    await act(async () => resolve(preparation));
    expect(signal.aborted).toBe(true);
    expect(mount.textContent).not.toContain('Actual approved agenda');
  });
});
