// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';
import type { VideoMeetingParticipant } from '@dwp-frontend/shared-utils/api/video-meeting-api';
const runtime = vi.hoisted(() => ({ disconnect: vi.fn(), actionRoute: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-moderation-api', () => ({
  disconnectVideoMeetingParticipant: runtime.disconnect,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../components/use-product-action-mutation', () => ({
  useProductActionMutation: (route: string) => {
    runtime.actionRoute(route);
    return (
      execute: (authority: { mode: 'LEGACY_COMPATIBILITY'; rolloutState: '100' }) => unknown
    ) => execute({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' });
  },
}));
import { MeetingParticipantDisconnect } from './meeting-participant-disconnect';
const meetingId = '87000000-0000-4000-8000-000000000001';
const participant: VideoMeetingParticipant = {
  participantId: '87000000-0000-4000-8000-000000000002',
  userId: 20,
  displayName: 'Participant',
  participantRole: 'ATTENDEE',
  attendanceState: 'JOINED',
  canSelfUnmute: true,
  version: 7,
};
let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;
async function render(
  scope = 'tenant:1:user:4',
  currentParticipant: VideoMeetingParticipant = participant
) {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MeetingParticipantDisconnect, {
          meetingId,
          authorizationScope: scope,
          participant: currentParticipant,
        })
      )
    )
  );
}
async function click(label: string) {
  const buttons = [...document.querySelectorAll('button')].filter(
    (button) => button.textContent === label
  );
  const button = buttons.at(-1);
  if (!button) throw new Error('Missing button ' + label);
  await act(async () => button.click());
}
async function openDisconnect() {
  const button = mount.querySelector<HTMLButtonElement>(
    'button[aria-label="room.moderation.disconnectNamed"]'
  );
  if (!button) throw new Error('Missing named disconnect button');
  await act(async () => button.click());
}
describe('participant disconnect confirmation and recovery', () => {
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    client = new QueryClient();
    runtime.disconnect.mockResolvedValue({ state: 'DISCONNECTED' });
    await render();
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    mount.remove();
  });
  it('requires a concrete confirmation and cancellation sends no command', async () => {
    expect(runtime.actionRoute).toHaveBeenCalledWith(
      'route.meetings.work.participant-disconnect.action'
    );
    await openDisconnect();
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(runtime.disconnect).not.toHaveBeenCalled();
    await click('actions.cancel');
    expect(runtime.disconnect).not.toHaveBeenCalled();
  });
  it('keeps provider pending distinct and reuses the original key and CAS on retry', async () => {
    runtime.disconnect.mockResolvedValueOnce({ state: 'PENDING' });
    await openDisconnect();
    await click('room.moderation.disconnect');
    expect(mount.textContent).toContain('room.moderation.pending');
    const request = runtime.disconnect.mock.calls[0];
    await click('actions.retry');
    expect(runtime.disconnect.mock.calls[1]).toEqual(request);
    expect(request?.slice(0, 3)).toEqual([meetingId, participant.participantId, 7]);
    expect(request?.[4]).toEqual({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' });
    expect(mount.textContent).toContain('room.moderation.disconnected');
  });
  it('fences a prior account response and suppresses duplicate commands', async () => {
    let resolve!: (value: unknown) => void;
    runtime.disconnect.mockImplementationOnce(
      () =>
        new Promise((accept) => {
          resolve = accept;
        })
    );
    await openDisconnect();
    await click('room.moderation.disconnect');
    expect(runtime.disconnect).toHaveBeenCalledOnce();
    await render('tenant:1:user:5');
    await act(async () => resolve({ state: 'DISCONNECTED' }));
    expect(mount.textContent).not.toContain('room.moderation.disconnected');
  });
  it('resets a stale command only after a newer participant version is rendered', async () => {
    runtime.disconnect.mockRejectedValueOnce(new HttpError('Conflict', 409));
    await openDisconnect();
    await click('room.moderation.disconnect');
    expect(mount.textContent).toContain('room.moderation.stale');
    expect(mount.textContent).toContain('actions.refresh');

    await render('tenant:1:user:4', { ...participant, version: 8 });
    await openDisconnect();
    await click('room.moderation.disconnect');

    expect(runtime.disconnect.mock.calls.map((call) => call.slice(0, 4))).toEqual([
      [meetingId, participant.participantId, 7, expect.any(String)],
      [meetingId, participant.participantId, 8, expect.any(String)],
    ]);
    expect(runtime.disconnect.mock.calls[1]?.slice(0, 3)).toEqual([
      meetingId,
      participant.participantId,
      8,
    ]);
    expect(runtime.disconnect.mock.calls[1]?.[3]).not.toBe(runtime.disconnect.mock.calls[0]?.[3]);
  });
  it('offers an explicit current-data refresh when authority is denied without a version change', async () => {
    runtime.disconnect.mockRejectedValueOnce(new HttpError('Forbidden', 403));
    await openDisconnect();
    await click('room.moderation.disconnect');
    expect(mount.textContent).toContain('room.moderation.stale');
    expect(mount.textContent).toContain('actions.refresh');

    await click('actions.refresh');
    await openDisconnect();
    await click('room.moderation.disconnect');
    expect(runtime.disconnect).toHaveBeenCalledTimes(2);
  });
});
