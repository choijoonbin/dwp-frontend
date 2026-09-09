import { expect, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './shell-session';
import { MEETING_MEMBER_PERMISSIONS } from './video-meeting-admin-policy';

export const meetingSummary = {
  meetingId: '81000000-0000-0000-0000-000000000001',
  title: 'Platform launch review',
  description: null,
  agenda: 'Confirm launch decisions, owners, and remaining risks.',
  lifecycleState: 'SCHEDULED',
  accessScope: 'INVITED',
  meetingCode: 'ABCD-EFGH-JKMN',
  startsAt: '2026-08-27T01:00:00Z',
  endsAt: '2026-08-27T01:50:00Z',
  durationMinutes: 50,
  timeZone: 'Asia/Seoul',
  organizerUserId: 9,
  organizerName: 'Mina Kim',
  waitingRoomEnabled: true,
  allowJoinBeforeHost: false,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  attendeeCount: 5,
  participantRole: 'ATTENDEE',
  canHost: false,
  canModerate: false,
  version: 2,
};

export const organizer = {
  participantId: '82000000-0000-0000-0000-000000000001',
  userId: 9,
  displayName: 'Mina Kim',
  participantRole: 'ORGANIZER',
  attendanceState: 'ADMITTED',
  canSelfUnmute: true,
  version: 1,
};

export const joiningParticipant = {
  participantId: '82000000-0000-0000-0000-000000000042',
  userId: 42,
  displayName: 'Mina Kim',
  participantRole: 'ATTENDEE',
  attendanceState: 'REQUESTED',
  canSelfUnmute: true,
  joinRequestedAt: '2026-08-26T23:31:00Z',
  version: 1,
};

export const meetingDetail = {
  ...meetingSummary,
  guestAccessEnabled: false,
  provider: 'LIVEKIT',
  participants: [organizer],
  artifacts: [],
  recordingAvailable: false,
  transcriptAvailable: false,
  aiNotesAvailable: false,
};

const capabilities = {
  available: true,
  provider: 'LIVEKIT',
  unavailableReason: null,
  audio: true,
  video: true,
  screenShare: true,
  participantList: true,
  chat: true,
  reactions: true,
  handRaise: true,
  captions: false,
  maximumParticipants: 100,
  tokenTtlSeconds: 300,
  unmuteControl: 'REQUEST_ONLY',
  recordingConfigured: false,
  transcriptConfigured: false,
  aiNotesConfigured: false,
};

export function contentPlan(acknowledgedByViewer = false) {
  return {
    meetingId: meetingSummary.meetingId,
    planId: '85000000-0000-0000-0000-000000000001',
    recordingRequested: true,
    transcriptionRequested: true,
    aiSummaryRequested: false,
    e2eeEnabled: false,
    state: 'BLOCKED',
    blockers: [
      {
        code: 'POLICY_NEVER',
        category: 'POLICY',
        description: 'Tenant policy prohibits recording.',
        retryable: false,
      },
    ],
    dependencies: {
      egressAvailable: false,
      storageAvailable: true,
      kmsAvailable: true,
      auditAvailable: true,
      speechToTextAvailable: false,
      languageModelAvailable: false,
    },
    notice: {
      noticeId: '86000000-0000-0000-0000-000000000001',
      revision: 2,
      state: 'PUBLISHED',
      disclosureCode: 'RECORDING_AND_TRANSCRIPTION',
      recordingDisclosed: true,
      transcriptionDisclosed: true,
      aiSummaryDisclosed: false,
      publishedAt: '2026-08-27T00:55:00Z',
      acknowledgedByViewer,
    },
    consent: {
      requiredAcknowledgements: 2,
      receivedAcknowledgements: acknowledgedByViewer ? 2 : 1,
      complete: acknowledgedByViewer,
    },
    recordingSession: null,
    version: 4,
    updatedAt: '2026-08-27T00:55:00Z',
  };
}

export function disabledContentPlan() {
  return {
    ...contentPlan(false),
    recordingRequested: false,
    transcriptionRequested: false,
    aiSummaryRequested: false,
    state: 'DISABLED',
    blockers: [],
    notice: null,
    consent: {
      requiredAcknowledgements: 0,
      receivedAcknowledgements: 0,
      complete: true,
    },
  };
}

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

export function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: success(data) });
}

export function createDeferredResponse() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

export async function installMeetingJoinMediaProbe(page: Page) {
  await page.addInitScript(() => {
    const probe = { getUserMediaCalls: 0 };
    Object.defineProperty(window, '__dwpMeetingJoinMediaProbe', {
      configurable: true,
      value: probe,
    });
    const existing = navigator.mediaDevices;
    const monitored = existing
      ? new Proxy(existing, {
          get(target, property, receiver) {
            if (property !== 'getUserMedia') return Reflect.get(target, property, receiver);
            return (..._args: unknown[]) => {
              probe.getUserMediaCalls += 1;
              return Promise.reject(new DOMException('Unexpected join-page media capture'));
            };
          },
        })
      : ({
          getUserMedia: (..._args: unknown[]) => {
            probe.getUserMediaCalls += 1;
            return Promise.reject(new DOMException('Unexpected join-page media capture'));
          },
        } as MediaDevices);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: monitored,
    });
  });
}

export async function expectNoMeetingJoinMediaCapture(page: Page) {
  const calls = await page.evaluate(
    () =>
      (
        window as Window & {
          __dwpMeetingJoinMediaProbe?: { getUserMediaCalls: number };
        }
      ).__dwpMeetingJoinMediaProbe?.getUserMediaCalls ?? -1
  );
  expect(calls, 'the code-resolution page must not capture camera or microphone media').toBe(0);
}

export async function keepMeetingTransportPending(page: Page) {
  await page.addInitScript(() => {
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
  });
}

export async function mockMeetingMember(page: Page, admin = false) {
  await mockShellSession(
    page,
    admin ? ['WORKSPACE_MEMBER', 'MEETING_ADMIN'] : ['WORKSPACE_MEMBER'],
    {
      userId: 42,
      locale: 'en',
      displayName: 'Mina Kim',
      email: 'mina.kim@sk.com',
      permissions: [
        ...MEETING_MEMBER_PERMISSIONS,
        ...(admin
          ? ['VIEW', 'MANAGE'].map((permissionCode) => ({
              resourceType: 'ADMIN',
              resourceKey: 'ADMIN.MEETINGS',
              permissionCode,
              effect: 'ALLOW' as const,
            }))
          : []),
      ],
    }
  );
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    fulfill(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'e2e-meetings-baseline',
      sourceRevisions: {
        auth: 'auth-meetings-baseline',
        policy: 'policy-meetings-baseline',
        productRelationship: 'relationship-meetings-baseline',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: '2026-08-26T00:00:00Z',
      contexts: [],
      rollouts: [
        {
          productKey: 'meetings',
          state: '000',
          flags: { contextShadow: false, capabilityEnforcement: false, surfaceUi: false },
          cohort: 'baseline',
          opaqueRevision: 'rollout-meetings-baseline',
          authorityStatus: 'NOT_EVALUATED',
        },
      ],
    })
  );
}

export async function mockMeetingHome(page: Page) {
  await page.route('**/api/meetings/v1/home*', (route) =>
    fulfill(route, {
      serverNow: '2026-08-26T23:30:00Z',
      timeZone: 'Asia/Seoul',
      capabilities,
      activeMeeting: null,
      nextMeeting: meetingSummary,
      today: [meetingSummary],
      recent: [],
      metrics: {
        meetingsToday: 1,
        meetingMinutesToday: 50,
        waitingForApproval: 0,
        qualityScore: null,
        averageJoinSeconds: null,
      },
    })
  );
}
