import type { Page, Route } from '@playwright/test';
import type {
  VideoMeetingPersonalRoom,
  VideoMeetingPersonalRoomSession,
} from '../../libs/shared-utils/src/api/video-meeting-personal-room-api';
import { MEETING_VISUAL_SUMMARY, mockMeetingVisualSession } from './video-meeting-visual-fixtures';

export const PERSONAL_ROOM_PATH = '/meetings/mine?view=personal-room';
export const PERSONAL_ROOM_ALIAS = 'a'.repeat(32);
export const PERSONAL_ROOM_MEETING_ID = '82000000-0000-4000-8000-000000000102';
export const PERSONAL_ROOM: VideoMeetingPersonalRoom = {
  roomId: '82000000-0000-4000-8000-000000000101',
  name: 'Release collaboration room',
  opaqueAlias: PERSONAL_ROOM_ALIAS,
  invitationRevision: 3,
  version: 4,
  updatedAt: '2026-08-31T03:00:00Z',
  currentMeetingId: null,
};
const RECENT: VideoMeetingPersonalRoomSession[] = [
  {
    meetingId: '82000000-0000-4000-8000-000000000103',
    title: 'Release follow-up',
    lifecycleState: 'ENDED',
    invitationRevision: 2,
    createdAt: '2026-08-30T02:00:00Z',
    endedAt: '2026-08-30T02:45:00Z',
  },
  {
    meetingId: '82000000-0000-4000-8000-000000000104',
    title: 'Design alignment',
    lifecycleState: 'ENDED',
    invitationRevision: 2,
    createdAt: '2026-08-28T01:00:00Z',
    endedAt: '2026-08-28T01:30:00Z',
  },
];
function respond(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      status: status < 400 ? 'SUCCESS' : 'ERROR',
      success: status < 400,
      message: status < 400 ? 'OK' : 'Unavailable',
      ...(data == null ? {} : { data }),
    }),
  });
}

/** Public-route UI fixture only; this is not a live provider or database acceptance test. */
export async function mockPersonalRoom(
  page: Page,
  options: {
    empty?: boolean;
    current?: boolean;
    clipboardFailure?: boolean;
    colorScheme?: 'light' | 'dark';
    forcedColors?: 'active' | 'none';
    locale?: 'ko' | 'en';
  } = {}
) {
  await mockMeetingVisualSession(page, {
    locale: options.locale ?? 'en',
    colorScheme: options.colorScheme,
    forcedColors: options.forcedColors,
  });
  await page.addInitScript(
    ({ clipboardFailure }) => {
      const evidence = { mediaCalls: 0, clipboard: '' };
      Object.defineProperty(window, '__personalRoomEvidence', { value: evidence });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            if (clipboardFailure) throw new DOMException('Unavailable', 'NotAllowedError');
            evidence.clipboard = text;
          },
        },
      });
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            evidence.mediaCalls += 1;
            throw new DOMException('Test media access is not allowed', 'NotAllowedError');
          },
          enumerateDevices: async () => [],
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        },
      });
    },
    { clipboardFailure: options.clipboardFailure ?? false }
  );
  const state = {
    room: options.empty
      ? null
      : (structuredClone(PERSONAL_ROOM) as VideoMeetingPersonalRoom | null),
    history: options.empty ? [] : structuredClone(RECENT),
    forbidden: false,
    historyFailure: false,
    conflict: false,
    sessionFailure: false,
    resolverRequests: 0,
    commands: [] as Array<{
      path: string;
      method: string;
      body: Record<string, unknown>;
      key: string;
    }>,
    unexpected: [] as string[],
  };
  if (options.current && state.room) state.room.currentMeetingId = PERSONAL_ROOM_MEETING_ID;
  await page.route('**/api/meetings/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/meetings/v1', '');
    const method = route.request().method();
    if (method !== 'GET') {
      state.commands.push({
        path,
        method,
        body: route.request().postDataJSON(),
        key: route.request().headers()['idempotency-key'],
      });
    }
    if (path === '/personal-room' && method === 'GET')
      return respond(route, state.forbidden ? null : state.room, state.forbidden ? 403 : 200);
    if (path === '/personal-room' && method === 'POST') {
      const body = route.request().postDataJSON();
      state.room = { ...PERSONAL_ROOM, name: body.name, version: 0, invitationRevision: 1 };
      return respond(route, state.room);
    }
    if (path === '/personal-room' && method === 'PUT') {
      const body = route.request().postDataJSON();
      if (!state.room) return respond(route, null, 404);
      if (state.conflict || body.expectedVersion !== state.room.version) {
        state.conflict = false;
        state.room.version += 1;
        return respond(route, null, 409);
      }
      state.room = { ...state.room, name: body.name, version: state.room.version + 1 };
      return respond(route, state.room);
    }
    if (path === '/personal-room/rotate-invitation' && method === 'POST') {
      if (!state.room) return respond(route, null, 404);
      const body = route.request().postDataJSON();
      if (body.expectedVersion !== state.room.version) return respond(route, null, 409);
      state.room = {
        ...state.room,
        version: state.room.version + 1,
        invitationRevision: state.room.invitationRevision + 1,
      };
      return respond(route, state.room);
    }
    if (path === '/personal-room/sessions' && method === 'GET') {
      if (state.forbidden || state.historyFailure)
        return respond(route, null, state.forbidden ? 403 : 500);
      const index = Number(url.searchParams.get('page'));
      const pageSize = Number(url.searchParams.get('pageSize'));
      return respond(route, {
        items: state.history.slice(index * pageSize, (index + 1) * pageSize),
        total: state.history.length,
        page: index,
        pageSize,
      });
    }
    if (path === '/personal-room/sessions' && method === 'POST') {
      if (state.sessionFailure) return respond(route, null, 503);
      if (!state.room) return respond(route, null, 404);
      const body = route.request().postDataJSON();
      if (
        body.expectedVersion !== state.room.version ||
        body.invitationRevision !== state.room.invitationRevision
      )
        return respond(route, null, 409);
      const session: VideoMeetingPersonalRoomSession = {
        meetingId: PERSONAL_ROOM_MEETING_ID,
        title: state.room.name,
        lifecycleState: 'LOBBY',
        invitationRevision: state.room.invitationRevision,
        createdAt: PERSONAL_ROOM.updatedAt,
        endedAt: null,
      };
      state.room.currentMeetingId = PERSONAL_ROOM_MEETING_ID;
      if (!state.history.some((item) => item.meetingId === session.meetingId))
        state.history.unshift(session);
      return respond(route, session);
    }
    if (path === `/personal-rooms/${PERSONAL_ROOM_ALIAS}/invitation` && method === 'GET') {
      state.resolverRequests += 1;
      if (state.forbidden) return respond(route, null, 403);
      if (!state.room || Number(url.searchParams.get('revision')) !== state.room.invitationRevision)
        return respond(route, null, 404);
      return respond(route, {
        name: state.room.name,
        meetingId: state.room.currentMeetingId,
        sessionAvailable: Boolean(state.room.currentMeetingId),
      });
    }
    if (path === `/meetings/${PERSONAL_ROOM_MEETING_ID}` && method === 'GET')
      return respond(route, {
        ...MEETING_VISUAL_SUMMARY,
        meetingId: PERSONAL_ROOM_MEETING_ID,
        title: state.room?.name ?? PERSONAL_ROOM.name,
        lifecycleState: 'LOBBY',
        accessScope: 'INTERNAL',
        canModerate: false,
        participants: [],
        artifacts: [],
        guestAccessEnabled: false,
        recordingAvailable: false,
        transcriptAvailable: false,
        aiNotesAvailable: false,
      });
    if (path === '/preferences' && method === 'GET')
      return respond(route, {
        displayName: '',
        microphoneOff: true,
        cameraOff: true,
        prejoinEnabled: true,
        reminderEnabled: false,
        reminderMinutes: 10,
        recapNotifications: false,
        version: 0,
        updatedAt: null,
      });
    state.unexpected.push(`${method} ${path}`);
    return respond(route, null, 404);
  });
  return state;
}

export async function readPersonalRoomBrowserEvidence(page: Page) {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __personalRoomEvidence: { mediaCalls: number; clipboard: string };
        }
      ).__personalRoomEvidence
  );
}
