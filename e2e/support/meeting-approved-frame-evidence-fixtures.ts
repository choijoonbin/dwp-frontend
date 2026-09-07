import type { Page, Route } from '@playwright/test';

import { mockShellSession } from './shell-session';
import {
  MEETING_VISUAL_ID,
  MEETING_VISUAL_NOW,
  MEETING_VISUAL_SUMMARY,
  mockMeetingVisualAdminReadiness,
  mockMeetingVisualPrejoin,
  mockMeetingVisualSession,
} from './video-meeting-visual-fixtures';

const followUpId = '99000000-0000-4000-8000-000000000901';
const followUpReportId = '99000000-0000-4000-8000-000000000902';
const templateId = '88000000-0000-4000-8000-000000000001';

function response(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      status: status < 400 ? 'SUCCESS' : 'ERROR',
      success: status < 400,
      message: status < 400 ? 'OK' : 'Not available',
      data,
    }),
  });
}

function dormantWebSocket() {
  class DormantMeetingWebSocket extends EventTarget {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readonly extensions = '';
    readonly protocol = '';
    readonly url: string;
    binaryType: BinaryType = 'blob';
    bufferedAmount = 0;
    readyState = DormantMeetingWebSocket.CONNECTING;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onopen: ((event: Event) => void) | null = null;

    constructor(url: string | URL) {
      super();
      this.url = String(url);
    }

    close() {
      this.readyState = DormantMeetingWebSocket.CLOSED;
    }

    send(_data: string | ArrayBufferLike | Blob | ArrayBufferView) {}
  }

  Object.defineProperty(window, 'WebSocket', {
    configurable: true,
    value: DormantMeetingWebSocket,
  });
}

export async function mockApprovedLiveRoom(page: Page) {
  await page.addInitScript(dormantWebSocket);
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });
  await mockMeetingVisualPrejoin(page);
  await page.unroute(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`);
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`, (route) =>
    response(route, {
      ...MEETING_VISUAL_SUMMARY,
      lifecycleState: 'LIVE',
      startedAt: '2026-08-31T04:02:00Z',
      provider: 'LIVEKIT',
      participants: [
        {
          ...MEETING_VISUAL_SUMMARY.participants[0],
          attendanceState: 'JOINED',
          joinedAt: '2026-08-31T04:02:00Z',
          admittedAt: '2026-08-31T04:01:00Z',
        },
      ],
      artifacts: [],
      recordingAvailable: false,
      transcriptAvailable: false,
      aiNotesAvailable: false,
      canHost: true,
      canModerate: true,
      version: 8,
    })
  );
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/token`, (route) =>
    response(route, {
      meetingId: MEETING_VISUAL_ID,
      sessionId: '74000000-0000-4000-8000-000000000001',
      provider: 'LIVEKIT',
      serverUrl: 'wss://meet.example.test',
      participantToken: 'approved-frame-pending-livekit-token',
      participantRole: 'ORGANIZER',
      expiresAt: '2026-08-31T04:25:00Z',
      effectivePermissions: {
        microphone: true,
        camera: true,
        screenShare: true,
        participantList: true,
        chat: true,
        reactions: true,
        handRaise: true,
      },
    })
  );
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/chat/messages?*`, (route) =>
    response(route, { items: [], nextSequence: 0, hasMore: false })
  );
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/hand-requests?*`, (route) =>
    response(route, { items: [], nextSequence: 0, hasMore: false })
  );
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/preparation`, (route) =>
    response(route, {
      meetingId: MEETING_VISUAL_ID,
      meetingVersion: 8,
      agendaVersion: 1,
      materialsVersion: 0,
      invitationRevision: 1,
      agendaItems: [
        {
          itemId: '71000000-0000-4000-8000-000000000001',
          position: 0,
          title: '출시 결정',
          objective: '출시 시간대를 결정합니다',
          ownerUserId: 42,
          ownerDisplayName: '김민아',
          plannedMinutes: 15,
        },
      ],
      materials: [],
      myResponse: null,
      invitationResponses: [],
      invitationCounts: { accepted: 0, tentative: 0, declined: 0, pending: 0 },
      myPreparation: {
        agendaVersion: 1,
        version: 0,
        preparedAgendaItemIds: [],
        updatedAt: null,
      },
      canEditAgenda: true,
      canManageMaterials: true,
      canRespond: false,
      canPrepare: true,
      observedAt: MEETING_VISUAL_NOW.toISOString(),
    })
  );
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/facilitation**`, (route) =>
    response(route, {
      transport: 'POLLING',
      pollingIntervalMillis: 3_000,
      serverTime: MEETING_VISUAL_NOW.toISOString(),
      sequence: 0,
      capabilities: {
        meetingLive: true,
        canAskQuestion: true,
        canVote: true,
        canModerate: true,
      },
      timer: {
        state: 'IDLE',
        agendaItemId: null,
        agendaItemTitle: null,
        plannedSeconds: null,
        elapsedSeconds: 0,
        remainingSeconds: null,
        runningSince: null,
        version: 0,
      },
      questions: [],
      polls: [],
    })
  );
}

export async function mockApprovedFollowUps(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 42,
    locale: 'ko',
    displayName: '김민아',
    permissions: ['APP.MEETINGS', 'APP.WORK'].flatMap((resourceKey) =>
      ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
        resourceType: 'APP',
        resourceKey,
        permissionCode,
        effect: 'ALLOW' as const,
      }))
    ),
    appearance: { mode: 'light', density: 'standard', reduceMotion: true },
  });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  const task = {
    assignmentId: followUpId,
    createdByUserId: 42,
    assignedByUserId: 42,
    assigneeUserId: 42,
    title: '출시 체크리스트 게시',
    description: '검증된 담당자 인계를 확인하고 체크리스트를 게시합니다.',
    priority: 'HIGH',
    dueAt: '2026-09-05T08:00:00Z',
    assignmentState: 'PENDING',
    workState: 'OPEN',
    assignmentRevision: 1,
    version: 3,
    source: {
      availability: 'AVAILABLE',
      reference: {
        sourceSystem: 'MEETING_FOLLOWUP',
        meetingId: followUpId,
        reportId: followUpReportId,
        candidateId: '99000000-0000-4000-8000-000000000903',
      },
      sourceVersion: 7,
      sourceRoute: '/meetings/follow-ups',
    },
    capabilities: {
      canAccept: true,
      canDecline: true,
      canStart: false,
      canWait: false,
      canComplete: false,
      canReassign: false,
      canCancel: true,
    },
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T01:00:00Z',
    acceptedAt: null,
    completedAt: null,
  };
  await page.route('**/api/meetings/v1/home*', (route) =>
    response(route, {
      serverNow: '2026-09-04T02:00:00Z',
      timeZone: 'Asia/Seoul',
      capabilities: {},
      activeMeeting: null,
      nextMeeting: null,
      today: [],
      recent: [],
      metrics: { meetingsToday: 0, meetingMinutesToday: 0, waitingForApproval: 0 },
    })
  );
  await page.route('**/api/platform/v1/workspace/work-hub/assignments**', (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.pathname.endsWith(`/${followUpId}`)) {
      return response(route, task);
    }
    if (route.request().method() === 'GET') {
      return response(route, {
        items: [task],
        page: 0,
        size: 20,
        totalElements: 1,
        hasMore: false,
      });
    }
    return response(route, null, 501);
  });
}

export async function mockApprovedTemplatesAndPreferences(page: Page) {
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });
  const template = {
    templateId,
    scope: 'PERSONAL',
    name: '출시 의사결정',
    purpose: '출시 날짜와 후속 작업을 결정합니다.',
    category: 'DECISION',
    durationMinutes: 45,
    agendaItems: [
      {
        title: '근거 검토',
        description: '열린 위험을 확인합니다',
        role: '주최자',
        durationMinutes: 15,
      },
      {
        title: '다음 단계 결정',
        description: '출시 기준에 합의합니다',
        role: '팀',
        durationMinutes: 30,
      },
    ],
    favorite: true,
    canEdit: true,
    version: 2,
    updatedAt: '2026-09-04T01:00:00Z',
  };
  await page.route('**/api/meetings/v1/templates**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    return response(
      route,
      pathname.endsWith('/' + templateId)
        ? template
        : { items: [template], total: 1, page: 0, pageSize: 30 }
    );
  });
  await page.route('**/api/meetings/v1/preferences', (route) =>
    response(route, {
      displayName: '김민아',
      microphoneOff: true,
      cameraOff: true,
      prejoinEnabled: true,
      reminderEnabled: true,
      reminderMinutes: 10,
      recapNotifications: true,
      version: 0,
      updatedAt: null,
    })
  );
  await page.route('**/api/meetings/v1/capabilities', (route) =>
    response(route, {
      available: false,
      provider: 'LIVEKIT',
      unavailableReason: 'PROVIDER_NOT_CONFIGURED',
      maximumParticipants: 100,
    })
  );
}

export async function mockApprovedAdmin(page: Page, includeOperations: boolean) {
  await mockMeetingVisualSession(page, {
    locale: 'ko',
    admin: true,
    colorScheme: 'light',
    reducedMotion: true,
  });
  await mockMeetingVisualAdminReadiness(page, 'BLOCKED');
  if (!includeOperations) return;
  await page.route('**/api/meetings/v1/admin/overview?*', (route) =>
    response(route, {
      liveMeetings: 2,
      scheduledToday: 7,
      waitingParticipants: 3,
      meetingsLastSevenDays: 42,
      averageQualityScore: null,
      failedJoinAttempts: 4,
      capabilities: {
        video: true,
        screenShare: true,
        chat: true,
        captions: false,
        recordingConfigured: false,
        transcriptConfigured: false,
        aiNotesConfigured: false,
      },
    })
  );
}
