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

export async function mockApprovedLiveRoom(page: Page, rich = false) {
  await page.addInitScript(dormantWebSocket);
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });
  await mockMeetingVisualPrejoin(page);
  await page.unroute(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`);
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`, (route) =>
    response(route, {
      ...MEETING_VISUAL_SUMMARY,
      ...(rich ? { title: '분기 제품 출시 의사결정 (Q3 Final Go/No-Go)' } : {}),
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
        ...(rich
          ? [
              {
                itemId: '71000000-0000-4000-8000-000000000002',
                position: 1,
                title: '보안·성능 위험 최종 검토',
                objective: '확장 전 검증 조건과 담당자를 확인합니다',
                ownerUserId: 43,
                ownerDisplayName: '박수석',
                plannedMinutes: 15,
              },
              {
                itemId: '71000000-0000-4000-8000-000000000003',
                position: 2,
                title: '배포 승인자 일정 확정 및 결재',
                objective: '다음 단계와 출시 승인을 결정합니다',
                ownerUserId: 42,
                ownerDisplayName: '김민아',
                plannedMinutes: 15,
              },
            ]
          : []),
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
      timer: rich
        ? {
            state: 'RUNNING',
            agendaItemId: '71000000-0000-4000-8000-000000000002',
            agendaItemTitle: '보안·성능 위험 최종 검토',
            plannedSeconds: 900,
            elapsedSeconds: 540,
            remainingSeconds: 360,
            runningSince: '2026-08-31T04:11:00Z',
            version: 1,
          }
        : {
            state: 'IDLE',
            agendaItemId: null,
            agendaItemTitle: null,
            plannedSeconds: null,
            elapsedSeconds: 0,
            remainingSeconds: null,
            runningSince: null,
            version: 0,
          },
      questions: rich
        ? [
            {
              questionId: '75000000-0000-4000-8000-000000000001',
              state: 'OPEN',
              text: '이번 처리량 테스트에는 해외 리전 지연도 포함되었나요?',
              authorDisplayName: '송예은',
              answer: null,
              upvoteCount: 5,
              upvotedByMe: false,
              mine: false,
              canModerate: true,
              version: 1,
              sequence: 1,
              createdAt: '2026-08-31T04:18:00Z',
              answeredAt: null,
            },
          ]
        : [],
      polls: rich
        ? [
            {
              pollId: '72000000-0000-4000-8000-000000000001',
              state: 'OPEN',
              question: 'Go/No-Go 최종 출시 승인',
              anonymous: true,
              options: [
                {
                  optionId: '73000000-0000-4000-8000-000000000001',
                  position: 0,
                  label: '출시 승인',
                  voteCount: 5,
                },
                {
                  optionId: '73000000-0000-4000-8000-000000000002',
                  position: 1,
                  label: '보완 후 검토',
                  voteCount: 1,
                },
              ],
              totalVotes: 6,
              myOptionId: null,
              myBallotVersion: 0,
              canVote: true,
              canModerate: true,
              version: 1,
              sequence: 2,
              openedAt: '2026-08-31T04:18:00Z',
              closedAt: null,
            },
          ]
        : [],
    })
  );
}

export async function mockApprovedFollowUps(page: Page, rich = false) {
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
  const tasks = rich
    ? [
        task,
        {
          ...task,
          assignmentId: '99000000-0000-4000-8000-000000000911',
          title: '지역별 용량 검증 및 출시 위험 확인',
          assignmentState: 'ACCEPTED',
          workState: 'IN_PROGRESS',
          acceptedAt: '2026-09-04T01:30:00Z',
          capabilities: {
            ...task.capabilities,
            canAccept: false,
            canDecline: false,
            canComplete: true,
            canWait: true,
          },
        },
        {
          ...task,
          assignmentId: '99000000-0000-4000-8000-000000000912',
          title: '보안 검토 결과를 회의에 공유',
          priority: 'NORMAL',
          assignmentState: 'ACCEPTED',
          workState: 'WAITING',
          acceptedAt: '2026-09-04T01:30:00Z',
          capabilities: {
            ...task.capabilities,
            canAccept: false,
            canDecline: false,
            canStart: true,
          },
        },
        {
          ...task,
          assignmentId: '99000000-0000-4000-8000-000000000913',
          title: '제품 요구사항 최종 정리',
          priority: 'NORMAL',
          assignmentState: 'ACCEPTED',
          workState: 'COMPLETED',
          acceptedAt: '2026-09-04T01:30:00Z',
          completedAt: '2026-09-04T02:00:00Z',
          capabilities: {
            ...task.capabilities,
            canAccept: false,
            canDecline: false,
            canCancel: false,
          },
        },
      ]
    : [task];
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
    const detail = tasks.find((item) => url.pathname.endsWith(`/${item.assignmentId}`));
    if (route.request().method() === 'GET' && detail) {
      return response(route, detail);
    }
    if (route.request().method() === 'GET') {
      return response(route, {
        items: tasks,
        page: 0,
        size: 20,
        totalElements: tasks.length,
        hasMore: false,
      });
    }
    return response(route, null, 501);
  });
}

export async function mockApprovedTemplatesAndPreferences(page: Page, rich = false) {
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
  const templates = rich
    ? [
        template,
        {
          ...template,
          templateId: '88000000-0000-4000-8000-000000000002',
          scope: 'ORGANIZATION',
          name: '주간 프로젝트 정기 회의',
          purpose: '팀별 진행 상황과 위험을 공유하고 다음 주 실행 항목을 정리합니다.',
          category: 'GENERAL',
          canEdit: false,
          favorite: false,
        },
        {
          ...template,
          templateId: '88000000-0000-4000-8000-000000000003',
          name: '디자인 리뷰와 피드백',
          purpose: '사용자 흐름과 디자인 시안을 검토하고 개선 방향에 합의합니다.',
          category: 'REVIEW',
          durationMinutes: 30,
          favorite: false,
        },
        {
          ...template,
          templateId: '88000000-0000-4000-8000-000000000004',
          name: '일대일 성장 대화',
          purpose: '성과와 성장 목표를 확인하고 다음 실행을 함께 계획합니다.',
          category: 'GENERAL',
          durationMinutes: 30,
          favorite: false,
        },
      ]
    : [template];
  await page.route('**/api/meetings/v1/templates**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    return response(
      route,
      templates.find((item) => pathname.endsWith('/' + item.templateId)) ?? {
        items: templates,
        total: templates.length,
        page: 0,
        pageSize: 30,
      }
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
