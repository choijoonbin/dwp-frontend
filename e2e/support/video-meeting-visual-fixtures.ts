import { mockShellSession } from './shell-session';

import type { Page, Route } from '@playwright/test';

export const MEETING_VISUAL_NOW = new Date('2026-08-31T04:20:00.000Z');
export const MEETING_VISUAL_ID = '81000000-0000-0000-0000-000000000301';
export const MEETING_VISUAL_RECENT_ID = '81000000-0000-0000-0000-000000000304';

type MeetingVisualLocale = 'en' | 'ko';
type MeetingVisualColorScheme = 'light' | 'dark';
type MeetingVisualHomeState = 'EMPTY' | 'NEXT' | 'LIVE' | 'BLOCKED' | 'SAMPLE';
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
  agenda:
    'Confirm the launch scope and release criteria\nReview accountable owners and open risks\nRecord the final decision and next checkpoint',
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
  guestAccessEnabled: false,
  allowJoinBeforeHost: false,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  attendeeCount: 8,
  participantLimit: 100,
  participants: [
    {
      participantId: '82000000-0000-0000-0000-000000000301',
      userId: 42,
      displayName: 'Mina Kim',
      participantRole: 'ORGANIZER',
      attendanceState: 'INVITED',
      canSelfUnmute: true,
      joinedAt: null,
      leftAt: null,
      joinRequestedAt: null,
      admittedAt: null,
      deniedAt: null,
      organizationName: 'Digital Workplace',
      version: 1,
    },
    {
      participantId: '82000000-0000-0000-0000-000000000302',
      userId: 43,
      displayName: 'Alex Lee',
      participantRole: 'ATTENDEE',
      attendanceState: 'INVITED',
      canSelfUnmute: true,
      joinedAt: null,
      leftAt: null,
      joinRequestedAt: null,
      admittedAt: null,
      deniedAt: null,
      organizationName: 'Platform Engineering',
      version: 1,
    },
    {
      participantId: '82000000-0000-0000-0000-000000000303',
      userId: 44,
      displayName: 'Sujin Park',
      participantRole: 'ATTENDEE',
      attendanceState: 'INVITED',
      canSelfUnmute: true,
      joinedAt: null,
      leftAt: null,
      joinRequestedAt: null,
      admittedAt: null,
      deniedAt: null,
      organizationName: 'Product Strategy',
      version: 1,
    },
  ],
  decisions: [],
  followUpActions: [],
  artifacts: [],
  aiNotesAvailable: false,
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
  await page.route('**/api/platform/v1/workspace/work-hub/assignments**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const query = new URL(route.request().url()).searchParams;
    const items =
      state === 'SAMPLE'
        ? [
            {
              assignmentId: '89000000-0000-4000-8000-000000000021',
              createdByUserId: 42,
              assignedByUserId: 42,
              assigneeUserId: 42,
              title: 'Publish the launch decision checklist',
              description: null,
              priority: 'HIGH',
              dueAt: '2026-08-31T04:00:00Z',
              assignmentState: 'ACCEPTED',
              workState: 'IN_PROGRESS',
              assignmentRevision: 2,
              version: 3,
              source: {
                availability: 'NOT_REQUESTED',
                reference: null,
                sourceVersion: null,
                sourceRoute: null,
              },
              capabilities: {
                canAccept: false,
                canDecline: false,
                canStart: false,
                canWait: true,
                canComplete: true,
                canReassign: false,
                canCancel: true,
              },
              createdAt: '2026-08-31T01:00:00Z',
              updatedAt: '2026-08-31T03:30:00Z',
              acceptedAt: '2026-08-31T02:00:00Z',
              completedAt: null,
            },
          ]
        : [];
    return fulfill(route, {
      items,
      page: Number(query.get('page') ?? 0),
      size: Number(query.get('size') ?? 20),
      totalElements: items.length,
      hasMore: false,
    });
  });
  await page.route('**/api/meetings/v1/templates?*', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const query = new URL(route.request().url()).searchParams;
    const items =
      state === 'EMPTY' || state === 'BLOCKED'
        ? []
        : [
            { name: 'Weekly team meeting', durationMinutes: 50, scope: 'ORGANIZATION' },
            { name: 'Decision review', durationMinutes: 45, scope: 'PERSONAL' },
            { name: 'One-to-one check-in', durationMinutes: 30, scope: 'PERSONAL' },
          ].map((item, index) => ({
            ...item,
            templateId: `89000000-0000-4000-8000-00000000000${index + 1}`,
            purpose: 'Prepare the agenda and record decisions.',
            category: 'GENERAL',
            agendaItems: [],
            favorite: true,
            canEdit: item.scope === 'PERSONAL',
            version: 2,
            updatedAt: MEETING_VISUAL_NOW.toISOString(),
          }));
    const pageSize = Number(query.get('pageSize') ?? 3);
    return fulfill(route, {
      items: items.slice(0, pageSize),
      total: items.length,
      page: 0,
      pageSize,
    });
  });
  const nextMeeting = state === 'NEXT' || state === 'SAMPLE' ? MEETING_VISUAL_SUMMARY : null;
  const activeMeeting =
    state === 'LIVE'
      ? {
          ...MEETING_VISUAL_SUMMARY,
          title: 'Executive launch room',
          lifecycleState: 'LIVE',
          startsAt: '2026-08-31T04:00:00Z',
          endsAt: '2026-08-31T05:00:00Z',
          durationMinutes: 60,
          startedAt: '2026-08-31T04:02:00Z',
          attendeeCount: 12,
          version: 8,
        }
      : null;
  const available = state !== 'BLOCKED';
  const today =
    state === 'SAMPLE'
      ? [
          MEETING_VISUAL_SUMMARY,
          {
            ...MEETING_VISUAL_SUMMARY,
            meetingId: '81000000-0000-0000-0000-000000000302',
            title: 'Platform design decisions',
            startsAt: '2026-08-31T06:30:00Z',
            endsAt: '2026-08-31T07:15:00Z',
            durationMinutes: 45,
            attendeeCount: 5,
            participantRole: 'ATTENDEE',
            canHost: false,
            canModerate: false,
          },
          {
            ...MEETING_VISUAL_SUMMARY,
            meetingId: '81000000-0000-0000-0000-000000000303',
            title: 'Weekly one-to-one check-in',
            startsAt: '2026-08-31T08:00:00Z',
            endsAt: '2026-08-31T08:30:00Z',
            durationMinutes: 30,
            attendeeCount: 2,
          },
        ]
      : activeMeeting
        ? [activeMeeting]
        : nextMeeting
          ? [nextMeeting]
          : [];
  await page.route('**/api/meetings/v1/meetings/*/intelligence/reports/latest*', (route) =>
    fulfill(route, null)
  );
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
      today,
      recent:
        state === 'EMPTY' || state === 'BLOCKED'
          ? []
          : [
              {
                ...ENDED_MEETING,
                meetingId: MEETING_VISUAL_RECENT_ID,
                actualDurationMinutes: 42,
                participantPeak: 6,
                averageQualityScore: 96,
                recordingAvailable: false,
                transcriptAvailable: false,
              },
            ],
      metrics: {
        meetingsToday: state === 'SAMPLE' ? 3 : activeMeeting ? 2 : nextMeeting ? 1 : 0,
        meetingMinutesToday: state === 'SAMPLE' ? 125 : activeMeeting ? 62 : nextMeeting ? 50 : 0,
        waitingForApproval: activeMeeting ? 3 : 0,
        qualityScore: activeMeeting ? 94 : null,
        averageJoinSeconds: activeMeeting ? 11 : null,
      },
    })
  );
}

export async function mockMeetingVisualMine(
  page: Page,
  options: Readonly<{ totalItems?: number }> = {}
) {
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/schedule`, (route) =>
    fulfill(route, {
      meetingId: MEETING_VISUAL_ID,
      lifecycleState: 'SCHEDULED',
      startsAt: MEETING_VISUAL_SUMMARY.startsAt,
      endsAt: MEETING_VISUAL_SUMMARY.endsAt,
      timeZone: MEETING_VISUAL_SUMMARY.timeZone,
      meetingVersion: MEETING_VISUAL_SUMMARY.version,
      seriesId: null,
      occurrenceIndex: null,
      occurrenceCount: null,
      frequency: null,
      recurrenceInterval: null,
      seriesVersion: null,
      exceptionState: 'NONE',
      invitationRevision: 1,
      deliveryState: 'DELIVERED',
    })
  );
  const meetings = [
    MEETING_VISUAL_SUMMARY,
    {
      ...MEETING_VISUAL_SUMMARY,
      meetingId: '81000000-0000-0000-0000-000000000302',
      title: 'Platform design decisions',
      startsAt: '2026-08-31T06:30:00Z',
      endsAt: '2026-08-31T07:15:00Z',
      durationMinutes: 45,
      participantRole: 'ATTENDEE',
      canHost: false,
      canModerate: false,
      attendeeCount: 5,
    },
    {
      ...MEETING_VISUAL_SUMMARY,
      meetingId: '81000000-0000-0000-0000-000000000303',
      title: 'Executive launch room',
      lifecycleState: 'LIVE',
      startsAt: '2026-08-31T04:00:00Z',
      endsAt: '2026-08-31T05:00:00Z',
      startedAt: '2026-08-31T04:02:00Z',
      durationMinutes: 60,
      participantRole: 'ATTENDEE',
      canHost: false,
      canModerate: false,
      attendeeCount: 12,
    },
    {
      ...MEETING_VISUAL_SUMMARY,
      meetingId: '81000000-0000-0000-0000-000000000305',
      title: 'Cancelled regional planning',
      lifecycleState: 'CANCELLED',
      startsAt: '2026-08-30T06:00:00Z',
      endsAt: '2026-08-30T06:45:00Z',
      durationMinutes: 45,
    },
  ];
  const requestedTotal = Math.max(meetings.length, options.totalItems ?? meetings.length);
  for (let index = meetings.length; index < requestedTotal; index += 1) {
    meetings.push({
      ...MEETING_VISUAL_SUMMARY,
      meetingId: `81000000-0000-0000-0000-${String(index + 901).padStart(12, '0')}`,
      title: `Bounded planning review ${index + 1}`,
      startsAt: `2026-09-${String(index + 1).padStart(2, '0')}T05:00:00Z`,
      endsAt: `2026-09-${String(index + 1).padStart(2, '0')}T05:50:00Z`,
      participantRole: 'ATTENDEE',
      canHost: false,
      canModerate: false,
    });
  }
  await page.route('**/api/meetings/v1/meetings?*', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const query = new URL(route.request().url()).searchParams;
    const requestedPage = Math.max(0, Number(query.get('page') ?? 0));
    const requestedPageSize = Math.max(1, Number(query.get('pageSize') ?? 10));
    const offset = requestedPage * requestedPageSize;
    return fulfill(route, {
      items: meetings.slice(offset, offset + requestedPageSize),
      page: requestedPage,
      pageSize: requestedPageSize,
      total: meetings.length,
    });
  });
}

export async function mockMeetingVisualPrejoin(page: Page) {
  await page.addInitScript(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices) return;
    Object.defineProperty(mediaDevices, 'enumerateDevices', {
      configurable: true,
      value: () =>
        Promise.resolve([
          {
            deviceId: 'visual-microphone',
            groupId: 'visual-local',
            kind: 'audioinput',
            label: 'Built-in microphone',
            toJSON: () => ({}),
          },
          {
            deviceId: 'visual-camera',
            groupId: 'visual-local',
            kind: 'videoinput',
            label: 'Front camera',
            toJSON: () => ({}),
          },
          {
            deviceId: 'visual-speaker',
            groupId: 'visual-local',
            kind: 'audiooutput',
            label: 'Built-in speakers',
            toJSON: () => ({}),
          },
        ] satisfies MediaDeviceInfo[]),
    });
  });
  const participant = {
    participantId: '82000000-0000-0000-0000-000000000301',
    userId: 42,
    displayName: 'Mina Kim',
    participantRole: 'ORGANIZER',
    attendanceState: 'ADMITTED',
    canSelfUnmute: true,
    joinedAt: null,
    leftAt: null,
    joinRequestedAt: null,
    admittedAt: null,
    deniedAt: null,
    organizationName: 'Digital Workplace',
    version: 1,
  };
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`, (route) =>
    fulfill(route, {
      ...MEETING_VISUAL_SUMMARY,
      guestAccessEnabled: false,
      provider: 'LIVEKIT',
      participants: [participant],
      artifacts: [],
      decisions: [],
      followUpActions: [],
      recordingAvailable: false,
      transcriptAvailable: false,
      aiNotesAvailable: false,
    })
  );
  await page.route('**/api/meetings/v1/preferences', (route) =>
    fulfill(route, {
      displayName: 'Mina Kim',
      microphoneOff: true,
      cameraOff: true,
      prejoinEnabled: true,
      reminderEnabled: true,
      reminderMinutes: 10,
      recapNotifications: true,
      version: 3,
      updatedAt: MEETING_VISUAL_NOW.toISOString(),
    })
  );
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/lobby*`, (route) =>
    fulfill(route, { waiting: [] })
  );
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/content-plan`, (route) =>
    fulfill(route, {
      meetingId: MEETING_VISUAL_ID,
      planId: '85000000-0000-0000-0000-000000000301',
      recordingRequested: false,
      transcriptionRequested: false,
      aiSummaryRequested: false,
      e2eeEnabled: false,
      state: 'DISABLED',
      blockers: [],
      dependencies: {
        egressAvailable: false,
        storageAvailable: false,
        kmsAvailable: false,
        auditAvailable: true,
        speechToTextAvailable: false,
        languageModelAvailable: false,
      },
      notice: null,
      consent: {
        requiredAcknowledgements: 0,
        receivedAcknowledgements: 0,
        complete: true,
      },
      recordingSession: null,
      version: 2,
      updatedAt: MEETING_VISUAL_NOW.toISOString(),
    })
  );
}

export async function mockMeetingVisualHomeReports(page: Page) {
  let revoked = false;
  const citation = { segmentId: 'seg-18', startMillis: 221_000, endMillis: 238_000 };
  await page.route(
    `**/api/meetings/v1/meetings/${MEETING_VISUAL_RECENT_ID}/intelligence/reports/latest*`,
    (route) => {
      if (revoked) {
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Report access revoked' }),
        });
      }
      const published = new URL(route.request().url()).pathname.endsWith('/latest-published');
      return fulfill(route, {
        reportId: published
          ? '88000000-0000-0000-0000-000000000304'
          : '88000000-0000-0000-0000-000000000305',
        meetingId: MEETING_VISUAL_RECENT_ID,
        runId: '87000000-0000-0000-0000-000000000304',
        state: published ? 'PUBLISHED' : 'DRAFT',
        audience: published ? 'MEETING_PARTICIPANTS' : 'REVIEWERS',
        schemaVersion: 'meeting-intelligence-v1',
        retentionUntil: '2026-09-28T01:50:00Z',
        legalHold: false,
        approvedAt: published ? '2026-08-29T02:00:00Z' : null,
        publishedAt: published ? '2026-08-29T02:02:00Z' : null,
        canCurrentViewerReview: !published,
        version: 2,
        analysis: {
          executiveSummary: {
            text: published
              ? 'The group approved a staged launch with an explicit regional checkpoint.'
              : 'Private unreviewed draft text must never appear on the home screen.',
            citations: [citation],
          },
          topics: [],
          decisions: [],
          actionItems: [],
          openQuestions: [],
          risks: [],
          conversationClimate: { label: 'ALIGNED', signals: [], citations: [citation] },
        },
        reviews: [],
      });
    }
  );
  return { revoke: () => (revoked = true) };
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
        {
          meetingId: '81000000-0000-0000-0000-000000000306',
          title: 'Platform design decisions',
          endedAt: '2026-08-28T07:15:00Z',
          actualDurationMinutes: 45,
          participantPeak: 5,
          averageQualityScore: 91,
          recordingAvailable: false,
          transcriptAvailable: true,
        },
        {
          meetingId: '81000000-0000-0000-0000-000000000307',
          title: 'Weekly one-to-one check-in',
          endedAt: '2026-08-27T08:30:00Z',
          actualDurationMinutes: 30,
          participantPeak: 2,
          averageQualityScore: null,
          recordingAvailable: false,
          transcriptAvailable: false,
        },
      ],
      page: 0,
      pageSize: 30,
      total: 3,
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
