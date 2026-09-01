import { mockShellSession } from './shell-session';

import type { Page, Route } from '@playwright/test';

export const MEETING_VISUAL_NOW = new Date('2026-08-31T04:20:00.000Z');
export const MEETING_VISUAL_ID = '81000000-0000-0000-0000-000000000301';

type MeetingVisualLocale = 'en' | 'ko';
type MeetingVisualColorScheme = 'light' | 'dark';
type MeetingVisualHomeState = 'EMPTY' | 'NEXT' | 'LIVE' | 'BLOCKED';
type MeetingVisualReadinessState = 'BLOCKED' | 'READY';

const MEMBER_PERMISSIONS = ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
  resourceType: 'APP',
  resourceKey: 'APP.MEETINGS',
  permissionCode,
  effect: 'ALLOW' as const,
}));

export const MEETING_VISUAL_CAPABILITIES = {
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
  recordingConfigured: true,
  transcriptConfigured: true,
  aiNotesConfigured: true,
} as const;

export const MEETING_VISUAL_SUMMARY = {
  meetingId: MEETING_VISUAL_ID,
  title: 'Global launch decision review',
  description: null,
  agenda: 'Confirm the launch decision, accountable owners, open risk, and next checkpoint.',
  lifecycleState: 'SCHEDULED',
  accessScope: 'INVITED',
  meetingCode: 'DWPX-MEET-2026',
  startsAt: '2026-08-31T05:00:00Z',
  endsAt: '2026-08-31T05:50:00Z',
  durationMinutes: 50,
  timeZone: 'Asia/Seoul',
  organizerUserId: 42,
  organizerName: 'Mina Kim',
  waitingRoomEnabled: true,
  allowJoinBeforeHost: false,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  attendeeCount: 8,
  participantRole: 'ORGANIZER',
  canHost: true,
  canModerate: true,
  version: 7,
} as const;

const ENDED_MEETING = {
  ...MEETING_VISUAL_SUMMARY,
  title: 'Regional launch readiness review',
  lifecycleState: 'ENDED',
  startsAt: '2026-08-29T01:00:00Z',
  endsAt: '2026-08-29T01:50:00Z',
  startedAt: '2026-08-29T01:03:00Z',
  endedAt: '2026-08-29T01:45:00Z',
  attendeeCount: 6,
  version: 9,
} as const;

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: success(data) });
}

export async function mockMeetingVisualSession(
  page: Page,
  options: Readonly<{
    locale: MeetingVisualLocale;
    admin?: boolean;
    colorScheme?: MeetingVisualColorScheme;
    forcedColors?: 'active' | 'none';
    reducedMotion?: boolean;
  }>
) {
  const colorScheme = options.colorScheme ?? 'light';
  const reducedMotion = options.reducedMotion ?? true;
  await page.clock.install({ time: MEETING_VISUAL_NOW });
  await page.emulateMedia({
    colorScheme,
    forcedColors: options.forcedColors ?? 'none',
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  await mockShellSession(
    page,
    options.admin ? ['WORKSPACE_MEMBER', 'MEETING_ADMIN'] : ['WORKSPACE_MEMBER'],
    {
      userId: 42,
      locale: options.locale,
      displayName: options.locale === 'ko' ? '김민아' : 'Mina Kim',
      jobTitle: options.locale === 'ko' ? '디지털 워크플레이스 담당자' : 'Digital workplace lead',
      email: 'mina.kim@dwp.example',
      appearance: {
        mode: colorScheme,
        density: 'standard',
        highContrast: options.forcedColors === 'active',
        reduceMotion: reducedMotion,
      },
      permissions: [
        ...MEMBER_PERMISSIONS,
        ...(options.admin
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
  await page.route('**/api/platform/v1/observability/web-vitals', (route) =>
    route.fulfill({ status: 202, body: '' })
  );
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    fulfill(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'meeting-visual-quality',
      sourceRevisions: {
        auth: 'auth-meeting-visual',
        policy: 'policy-meeting-visual',
        productRelationship: 'relationship-meeting-visual',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: MEETING_VISUAL_NOW.toISOString(),
      contexts: [],
      rollouts: [
        {
          productKey: 'meetings',
          state: '000',
          flags: { contextShadow: false, capabilityEnforcement: false, surfaceUi: false },
          cohort: 'visual-quality',
          opaqueRevision: 'rollout-meeting-visual',
          authorityStatus: 'NOT_EVALUATED',
        },
      ],
    })
  );
}

export async function mockMeetingVisualHome(page: Page, state: MeetingVisualHomeState) {
  const nextMeeting = state === 'NEXT' ? MEETING_VISUAL_SUMMARY : null;
  const activeMeeting =
    state === 'LIVE'
      ? {
          ...MEETING_VISUAL_SUMMARY,
          title: 'Executive launch room',
          lifecycleState: 'LIVE',
          startsAt: '2026-08-31T04:00:00Z',
          endsAt: '2026-08-31T05:00:00Z',
          startedAt: '2026-08-31T04:02:00Z',
          attendeeCount: 12,
          version: 8,
        }
      : null;
  const available = state !== 'BLOCKED';
  await page.route('**/api/meetings/v1/home*', (route) =>
    fulfill(route, {
      serverNow: MEETING_VISUAL_NOW.toISOString(),
      timeZone: 'Asia/Seoul',
      capabilities: available
        ? MEETING_VISUAL_CAPABILITIES
        : {
            ...MEETING_VISUAL_CAPABILITIES,
            available: false,
            unavailableReason: 'LIVEKIT_CONTROL_PLANE_NOT_CONFIGURED',
            recordingConfigured: false,
            transcriptConfigured: false,
            aiNotesConfigured: false,
          },
      activeMeeting,
      nextMeeting,
      today: activeMeeting ? [activeMeeting] : nextMeeting ? [nextMeeting] : [],
      recent: state === 'EMPTY' || state === 'BLOCKED' ? [] : [ENDED_MEETING],
      metrics: {
        meetingsToday: activeMeeting ? 2 : nextMeeting ? 1 : 0,
        meetingMinutesToday: activeMeeting ? 62 : nextMeeting ? 50 : 0,
        waitingForApproval: activeMeeting ? 3 : 0,
        qualityScore: activeMeeting ? 94 : null,
        averageJoinSeconds: activeMeeting ? 11 : null,
      },
    })
  );
}

export async function mockMeetingVisualPublishedRecap(page: Page) {
  const participants = [
    {
      participantId: '82000000-0000-0000-0000-000000000301',
      userId: 42,
      displayName: 'Mina Kim',
      participantRole: 'ORGANIZER',
      attendanceState: 'LEFT',
      canSelfUnmute: true,
      joinedAt: '2026-08-29T01:03:00Z',
      leftAt: '2026-08-29T01:45:00Z',
      organizationName: 'Digital Workplace',
      version: 4,
    },
    {
      participantId: '82000000-0000-0000-0000-000000000302',
      userId: 43,
      displayName: 'Alex Lee',
      participantRole: 'ATTENDEE',
      attendanceState: 'LEFT',
      canSelfUnmute: true,
      joinedAt: '2026-08-29T01:05:00Z',
      leftAt: '2026-08-29T01:43:00Z',
      organizationName: 'Platform Engineering',
      version: 3,
    },
  ];
  await page.route('**/api/meetings/v1/history?*', (route) =>
    fulfill(route, {
      items: [
        {
          ...ENDED_MEETING,
          endedAt: ENDED_MEETING.endedAt,
          actualDurationMinutes: 42,
          participantPeak: 6,
          averageQualityScore: 96,
          recordingAvailable: true,
          transcriptAvailable: true,
        },
      ],
      page: 0,
      pageSize: 30,
      total: 1,
    })
  );
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`, (route) =>
    fulfill(route, {
      ...ENDED_MEETING,
      guestAccessEnabled: false,
      provider: 'LIVEKIT',
      participants,
      artifacts: [
        {
          artifactId: '84000000-0000-0000-0000-000000000301',
          artifactType: 'RECORDING',
          artifactState: 'AVAILABLE',
          contentType: 'video/mp4',
          sizeBytes: 84_000_000,
          retentionUntil: '2026-09-28T01:50:00Z',
          metadata: {},
          version: 2,
        },
        {
          artifactId: '84000000-0000-0000-0000-000000000302',
          artifactType: 'TRANSCRIPT',
          artifactState: 'AVAILABLE',
          contentType: 'application/json',
          sizeBytes: 48_000,
          retentionUntil: '2026-09-28T01:50:00Z',
          metadata: {},
          version: 2,
        },
      ],
      decisions: [],
      followUpActions: [],
      recordingAvailable: true,
      transcriptAvailable: true,
      aiNotesAvailable: true,
    })
  );
  await page.route(
    `**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/intelligence/reports/latest-published`,
    (route) =>
      fulfill(route, {
        reportId: '88000000-0000-0000-0000-000000000301',
        meetingId: MEETING_VISUAL_ID,
        runId: '87000000-0000-0000-0000-000000000301',
        state: 'PUBLISHED',
        audience: 'MEETING_PARTICIPANTS',
        schemaVersion: 'meeting-intelligence-v1',
        retentionUntil: '2026-09-28T01:50:00Z',
        legalHold: false,
        approvedAt: '2026-08-29T02:00:00Z',
        publishedAt: '2026-08-29T02:02:00Z',
        version: 2,
        canCurrentViewerReview: false,
        analysis: {
          executiveSummary: {
            text: 'The group approved a staged launch while keeping regional capacity as an explicit release gate.',
            citations: [{ segmentId: 'seg-12', startMillis: 92_000, endMillis: 118_000 }],
          },
          topics: [
            {
              text: 'Staged launch readiness',
              citations: [{ segmentId: 'seg-12', startMillis: 92_000, endMillis: 118_000 }],
            },
          ],
          decisions: [
            {
              text: 'Launch the internal pilot on Monday.',
              citations: [{ segmentId: 'seg-18', startMillis: 221_000, endMillis: 238_000 }],
            },
          ],
          actionItems: [
            {
              text: 'Verify regional capacity before external expansion.',
              citations: [{ segmentId: 'seg-21', startMillis: 281_000, endMillis: 302_000 }],
            },
          ],
          openQuestions: [],
          risks: [
            {
              text: 'Regional quota may delay the second rollout wave.',
              citations: [{ segmentId: 'seg-24', startMillis: 340_000, endMillis: 354_000 }],
            },
          ],
          conversationClimate: {
            label: 'ALIGNED',
            signals: ['CONSTRUCTIVE_DISAGREEMENT'],
            citations: [{ segmentId: 'seg-18', startMillis: 221_000, endMillis: 238_000 }],
          },
        },
        reviews: [],
      })
  );
}

function readinessSignal(state: 'READY' | 'BLOCKED', reason?: string) {
  return reason ? { state, reason } : { state };
}

export async function mockMeetingVisualAdminReadiness(
  page: Page,
  state: MeetingVisualReadinessState
) {
  const ready = state === 'READY';
  const blocked = readinessSignal('BLOCKED', 'CAPABILITY_NOT_READY');
  const healthy = readinessSignal('READY');
  await page.route('**/api/meetings/v1/admin/policy', (route) =>
    fulfill(route, {
      meetingsEnabled: true,
      waitingRoomRequired: true,
      guestsAllowed: false,
      participantChatAllowed: true,
      reactionsAllowed: true,
      screenShareAllowed: true,
      unmuteControl: 'REQUEST_ONLY',
      recordingPolicy: ready ? 'HOST_OPT_IN' : 'NEVER',
      retentionDays: 90,
      artifactRetentionDays: 30,
      chatRetentionDays: 30,
      allowJoinBeforeHost: false,
      requireAuthenticatedInternalUsers: true,
      maximumParticipants: 100,
      recordingConfigured: ready,
      aiNotesConfigured: ready,
      version: 8,
    })
  );
  await page.route('**/api/meetings/v1/admin/intelligence/readiness', (route) =>
    fulfill(route, {
      readinessVersion: 'meeting-intelligence-readiness-v1',
      observedAt: MEETING_VISUAL_NOW.toISOString(),
      recordingPolicy: ready ? 'HOST_OPT_IN' : 'NEVER',
      providerCode: ready ? 'managed-provider' : null,
      providerModel: ready ? 'enterprise-model' : null,
      processingRegion: 'kr-central-1',
      capabilities: {
        recording: ready ? healthy : blocked,
        transcript: ready ? healthy : blocked,
        aiNotes: ready ? healthy : blocked,
      },
      dependencies: {
        provider: ready ? healthy : blocked,
        region: healthy,
        kms: ready ? healthy : blocked,
        audit: healthy,
        egress: ready ? healthy : blocked,
        storage: ready ? healthy : blocked,
        stt: ready ? healthy : blocked,
        llm: ready ? healthy : blocked,
      },
      governance: {
        humanReview: healthy,
        explicitPublish: healthy,
        adminContentAccess: healthy,
        legalHold: ready ? healthy : blocked,
        deletionEvidence: ready ? healthy : blocked,
      },
      retention: {
        meetingDays: 90,
        artifactDays: 30,
        chatDays: 30,
        intelligenceWorkerReady: ready,
        signals: {
          intelligenceReports: ready ? healthy : blocked,
          meetingRecords: ready ? healthy : blocked,
          artifacts: ready ? healthy : blocked,
          chat: ready ? healthy : blocked,
        },
      },
    })
  );
}
