import type { Page, Route } from '@playwright/test';
import { mockShellSession } from './shell-session';

export const SCHEDULE_MEETING_ID = '81000000-0000-4000-8000-000000000001';
export const SCHEDULE_TEMPLATE_ID = '88000000-0000-4000-8000-000000000001';
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
export function scheduleResponse(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      status: status < 400 ? 'SUCCESS' : 'ERROR',
      data,
      message: status < 400 ? 'OK' : 'Request rejected',
    }),
  });
}

export async function mockScheduleWorkspace(
  page: Page,
  options: {
    commitStatuses?: number[];
    saveStatuses?: number[];
    templateVersion?: number;
    templateStatus?: number;
    sourceRevokedDraft?: boolean;
    locale?: 'ko' | 'en';
    dark?: boolean;
  } = {}
) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 42,
    locale: options.locale ?? 'en',
    displayName: 'Mina Kim',
    email: 'mina.kim@sk.com',
    appearance: {
      mode: options.dark ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
    permissions: ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
      resourceType: 'APP',
      resourceKey: 'APP.MEETINGS',
      permissionCode,
      effect: 'ALLOW' as const,
    })),
  });
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    scheduleResponse(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'e2e-meetings-baseline',
      sourceRevisions: {
        auth: 'auth-meetings-baseline',
        policy: 'policy-meetings-baseline',
        productRelationship: 'relationship-meetings-baseline',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: '2026-09-04T00:00:00Z',
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
  const state = {
    saves: [] as { body: Record<string, unknown>; key: string }[],
    commits: [] as { body: Record<string, unknown>; key: string }[],
    discards: [] as { body: Record<string, unknown>; key: string }[],
  };
  let savedDraft: Record<string, unknown> | null = null;
  let discardOnly = options.sourceRevokedDraft ?? false;
  let latest: Record<string, unknown> = {
    title: 'Scheduled meeting',
    agenda: '',
    startsAt: new Date(Date.now() + 3_600_000).toISOString(),
    durationMinutes: 45,
    participantUserIds: [],
    agendaItems: [],
  };
  const meeting = () => ({
    ...latest,
    meetingId: SCHEDULE_MEETING_ID,
    description: null,
    lifecycleState: 'SCHEDULED',
    accessScope: 'INVITED',
    meetingCode: 'ABCD-EFGH-JKMN',
    endsAt: new Date(
      Date.parse(String(latest.startsAt)) + Number(latest.durationMinutes) * 60_000
    ).toISOString(),
    timeZone: 'Asia/Seoul',
    organizerUserId: 42,
    organizerName: 'Mina Kim',
    waitingRoomEnabled: true,
    guestAccessEnabled: false,
    allowJoinBeforeHost: false,
    defaultMicrophoneEnabled: false,
    defaultCameraEnabled: false,
    attendeeCount: 2,
    participantRole: 'ORGANIZER',
    canHost: true,
    canModerate: true,
    version: 0,
    provider: 'LIVEKIT',
    artifacts: [],
    recordingAvailable: false,
    transcriptAvailable: false,
    aiNotesAvailable: false,
    participants: [
      {
        participantId: '82000000-0000-4000-8000-000000000042',
        userId: 42,
        displayName: 'Mina Kim',
        participantRole: 'ORGANIZER',
        attendanceState: 'INVITED',
        canSelfUnmute: true,
        version: 0,
      },
    ],
  });
  await page.route('**/api/meetings/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/capabilities')) return scheduleResponse(route, capabilities);
    if (path.endsWith('/people'))
      return scheduleResponse(route, [
        {
          userId: 17,
          emailAddress: 'alex.lee@sk.com',
          displayName: 'Alex Lee',
          organizationName: 'Platform Engineering',
        },
      ]);
    if (path.endsWith('/templates/' + SCHEDULE_TEMPLATE_ID))
      return scheduleResponse(
        route,
        {
          templateId: SCHEDULE_TEMPLATE_ID,
          scope: 'PERSONAL',
          name: 'Release decision template',
          purpose: 'Confidential template preparation',
          category: 'DECISION',
          durationMinutes: 45,
          agendaItems: [
            {
              title: 'Review risks',
              description: 'Use approved evidence',
              role: 'Facilitator',
              durationMinutes: 15,
            },
          ],
          favorite: false,
          canEdit: true,
          version: options.templateVersion ?? 2,
          updatedAt: '2026-09-04T00:00:00Z',
        },
        options.templateStatus ?? 200
      );
    if (path.endsWith('/schedule-draft') && route.request().method() === 'GET')
      return scheduleResponse(route, {
        draft: discardOnly ? null : savedDraft,
        discardOnly,
        draftId: discardOnly
          ? '88000000-0000-4000-8000-000000000099'
          : (savedDraft?.draftId ?? null),
        version: discardOnly ? 3 : (savedDraft?.version ?? null),
        retentionUntil: discardOnly ? '2026-10-04T00:00:00Z' : (savedDraft?.retentionUntil ?? null),
        observedAt: '2026-09-04T00:05:00Z',
      });
    if (path.endsWith('/schedule-draft') && route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.saves.push({ body, key: route.request().headers()['idempotency-key'] ?? '' });
      const status = options.saveStatuses?.[state.saves.length - 1] ?? 200;
      const previousVersion = savedDraft ? Number(savedDraft.version) : -1;
      const nextDraft = {
        draftId: '88000000-0000-4000-8000-000000000099',
        title: body.title ?? null,
        agenda: body.agenda ?? null,
        startsAt: body.startsAt ?? null,
        durationMinutes: body.durationMinutes ?? null,
        timeZone: body.timeZone ?? null,
        accessScope: body.accessScope ?? null,
        waitingRoomEnabled: body.waitingRoomEnabled ?? null,
        allowJoinBeforeHost: body.allowJoinBeforeHost ?? null,
        participants: ((body.participantUserIds as number[] | undefined) ?? []).map((userId) => ({
          userId,
          personPublicId: null,
          emailAddress: userId === 17 ? 'alex.lee@sk.com' : `person-${userId}@example.test`,
          displayName: userId === 17 ? 'Alex Lee' : `Person ${userId}`,
          jobTitle: null,
          organizationName: userId === 17 ? 'Platform Engineering' : null,
        })),
        agendaItems: ((body.agendaItems as Record<string, unknown>[] | undefined) ?? []).map(
          (item, position) => ({
            itemId:
              item.itemId ?? `89000000-0000-4000-8000-${String(position + 1).padStart(12, '0')}`,
            position,
            title: item.title ?? null,
            objective: item.objective ?? null,
            ownerUserId: item.ownerUserId ?? null,
            plannedMinutes: item.plannedMinutes ?? null,
          })
        ),
        recurrence: body.recurrence ?? null,
        sourceTemplateId: body.sourceTemplateId ?? null,
        sourceTemplateVersion: body.sourceTemplateVersion ?? null,
        lastStep: body.lastStep ?? 'DETAILS',
        version: previousVersion + 1,
        retentionUntil: '2026-10-04T00:00:00Z',
        updatedAt: '2026-09-04T00:05:00Z',
      };
      if (status === 409)
        savedDraft = {
          ...nextDraft,
          title: 'Draft updated in another session',
          version: Math.max(previousVersion + 2, 1),
        };
      if (status !== 200) return scheduleResponse(route, null, status);
      savedDraft = nextDraft;
      latest = {
        ...body,
        participantUserIds: body.participantUserIds ?? [],
        agendaItems: body.agendaItems ?? [],
      };
      return scheduleResponse(route, savedDraft);
    }
    if (
      path.endsWith('/schedule-draft/recurrence-preview') &&
      route.request().method() === 'POST'
    ) {
      const recurrence = savedDraft?.recurrence as { occurrenceCount?: number } | undefined;
      const start = Date.parse(String(savedDraft?.startsAt));
      return scheduleResponse(route, {
        previewFingerprint: 'a'.repeat(64),
        hasCalendarAdjustments: false,
        occurrences: Array.from({ length: recurrence?.occurrenceCount ?? 0 }, (_, index) => ({
          occurrenceIndex: index + 1,
          startsAt: new Date(start + index * 7 * 24 * 60 * 60 * 1000).toISOString(),
          localStart: new Date(start + index * 7 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 19),
          utcOffset: '+09:00',
          adjustment: 'NONE',
        })),
      });
    }
    if (path.endsWith('/schedule-draft/commit') && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.commits.push({ body, key: route.request().headers()['idempotency-key'] ?? '' });
      const status = options.commitStatuses?.[state.commits.length - 1] ?? 200;
      if (status !== 200) return scheduleResponse(route, null, status);
      return scheduleResponse(route, {
        meeting: { meetingId: SCHEDULE_MEETING_ID, meetingCode: 'ABCDEFGHJK' },
        meetingCode: 'ABCDEFGHJK',
      });
    }
    if (path.endsWith('/schedule-draft/discard') && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.discards.push({ body, key: route.request().headers()['idempotency-key'] ?? '' });
      const version = Number(savedDraft?.version ?? body.expectedVersion);
      const draftId = String(savedDraft?.draftId ?? '88000000-0000-4000-8000-000000000099');
      savedDraft = null;
      discardOnly = false;
      return scheduleResponse(route, { draftId, version: version + 1, discarded: true });
    }
    if (path.endsWith('/meeting-series/preview') && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as {
        meeting: Record<string, unknown>;
        recurrence: { occurrenceCount: number };
      };
      const start = Date.parse(String(body.meeting.startsAt));
      return scheduleResponse(route, {
        previewFingerprint: 'a'.repeat(64),
        hasCalendarAdjustments: false,
        occurrences: Array.from({ length: body.recurrence.occurrenceCount }, (_, index) => ({
          occurrenceIndex: index + 1,
          startsAt: new Date(start + index * 7 * 24 * 60 * 60 * 1000).toISOString(),
          localStart: new Date(start + index * 7 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 19),
          utcOffset: '+09:00',
          adjustment: 'NONE',
        })),
      });
    }
    if (path.endsWith('/meetings/' + SCHEDULE_MEETING_ID))
      return scheduleResponse(route, meeting());
    if (path.endsWith('/meetings/' + SCHEDULE_MEETING_ID + '/preparation'))
      return scheduleResponse(route, {
        meetingId: SCHEDULE_MEETING_ID,
        meetingVersion: 0,
        agendaVersion: 0,
        materialsVersion: 0,
        invitationRevision: 1,
        agendaItems: (latest.agendaItems as Record<string, unknown>[]).map((item, index) => ({
          ...item,
          itemId: `89000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          position: index,
          ownerDisplayName: null,
        })),
        materials: [],
        myResponse: null,
        invitationResponses: [],
        invitationCounts: { accepted: 0, tentative: 0, declined: 0, pending: 0 },
        myPreparation: {
          agendaVersion: 0,
          version: 0,
          preparedAgendaItemIds: [],
          updatedAt: null,
        },
        canEditAgenda: true,
        canManageMaterials: true,
        canRespond: false,
        canPrepare: true,
        observedAt: new Date().toISOString(),
      });
    if (path.endsWith('/meetings'))
      return scheduleResponse(route, { items: [], total: 0, page: 0, pageSize: 30 });
    return route.fallback();
  });
  return state;
}
