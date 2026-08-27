import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

const MEMBER_PERMISSIONS = ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
  resourceType: 'APP',
  resourceKey: 'APP.MEETINGS',
  permissionCode,
  effect: 'ALLOW' as const,
}));

const meetingSummary = {
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

const organizer = {
  participantId: '82000000-0000-0000-0000-000000000001',
  userId: 9,
  displayName: 'Mina Kim',
  participantRole: 'ORGANIZER',
  attendanceState: 'ADMITTED',
  canSelfUnmute: true,
  version: 1,
};

const joiningParticipant = {
  participantId: '82000000-0000-0000-0000-000000000042',
  userId: 42,
  displayName: 'Mina Kim',
  participantRole: 'ATTENDEE',
  attendanceState: 'REQUESTED',
  canSelfUnmute: true,
  joinRequestedAt: '2026-08-26T23:31:00Z',
  version: 1,
};

const meetingDetail = {
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

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: success(data) });
}

async function mockMeetingMember(page: Page, admin = false) {
  await mockShellSession(
    page,
    admin ? ['WORKSPACE_MEMBER', 'MEETING_ADMIN'] : ['WORKSPACE_MEMBER'],
    {
      userId: 42,
      locale: 'en',
      displayName: 'Mina Kim',
      email: 'mina.kim@sk.com',
      permissions: [
        ...MEMBER_PERMISSIONS,
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

async function mockMeetingHome(page: Page) {
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

test('meeting home prioritizes the three actions and remains accessible on mobile', async ({
  page,
}) => {
  await mockMeetingMember(page);
  await mockMeetingHome(page);

  await page.goto('/meetings/home');
  await expect(
    page.getByRole('heading', { name: "Run today's conversations with less friction" })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start now' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Schedule meeting' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enter code' })).toBeVisible();
  await expect(page.getByText('Platform launch review').first()).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await page.setViewportSize({ width: 320, height: 760 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('schedule persists governed settings at the canonical create endpoint', async ({ page }) => {
  await mockMeetingMember(page);
  await mockMeetingHome(page);
  let payload: Record<string, unknown> | null = null;
  let idempotencyKey = '';
  await page.route('**/api/meetings/v1/people*', (route) =>
    fulfill(route, [
      {
        userId: 17,
        personPublicId: '83000000-0000-0000-0000-000000000017',
        emailAddress: 'alex.lee@sk.com',
        displayName: 'Alex Lee',
        jobTitle: 'Platform Engineer',
        organizationName: 'Platform Engineering',
      },
    ])
  );
  await page.route('**/api/meetings/v1/meetings', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    payload = route.request().postDataJSON() as Record<string, unknown>;
    idempotencyKey = route.request().headers()['idempotency-key'] ?? '';
    return fulfill(route, { meeting: meetingDetail, meetingCode: meetingDetail.meetingCode });
  });

  await page.goto('/meetings/home');
  await page.getByRole('button', { name: 'Schedule meeting' }).click();
  const dialog = page.getByRole('dialog', { name: 'Schedule a video meeting' });
  await dialog.getByLabel('Meeting title').fill('Architecture decision review');
  await dialog
    .getByLabel('Purpose and agenda')
    .fill('Choose the rollout option and assign owners.');
  const participants = dialog.getByRole('combobox', { name: 'Invite people' });
  await participants.fill('alex');
  await page
    .getByRole('option', { name: 'Alex Lee · alex.lee@sk.com · Platform Engineering' })
    .click();
  await dialog.getByRole('button', { name: 'Schedule meeting' }).click();

  await expect.poll(() => payload).not.toBeNull();
  expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/u);
  expect(payload).toMatchObject({
    title: 'Architecture decision review',
    agenda: 'Choose the rollout option and assign owners.',
    participantUserIds: [17],
    accessScope: 'INVITED',
    waitingRoomEnabled: true,
    allowJoinBeforeHost: false,
    defaultMicrophoneEnabled: false,
    defaultCameraEnabled: false,
  });
});

test('join code formats 4-4-4 and waits for host approval before device check', async ({
  page,
}) => {
  await mockMeetingMember(page);
  let requestPolls = 0;
  await page.route('**/api/meetings/v1/join-codes/ABCDEFGHJKMN', (route) =>
    fulfill(route, {
      meeting: meetingSummary,
      joinAllowed: true,
      denialReason: null,
      waitingRoomRequired: true,
    })
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingSummary.meetingId}/join-requests`,
    (route) =>
      fulfill(route, {
        requestId: joiningParticipant.participantId,
        state: 'WAITING',
        displayName: joiningParticipant.displayName,
        email: 'mina.kim@sk.com',
        organizationName: 'Platform Engineering',
        external: false,
        requestedAt: joiningParticipant.joinRequestedAt,
        version: joiningParticipant.version,
      })
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingSummary.meetingId}/join-requests/${joiningParticipant.participantId}`,
    (route) => {
      requestPolls += 1;
      return fulfill(route, {
        requestId: joiningParticipant.participantId,
        state: requestPolls > 1 ? 'APPROVED' : 'WAITING',
        displayName: joiningParticipant.displayName,
        email: 'mina.kim@sk.com',
        organizationName: 'Platform Engineering',
        external: false,
        requestedAt: joiningParticipant.joinRequestedAt,
        version: requestPolls > 1 ? 2 : 1,
      });
    }
  );
  await page.route(`**/api/meetings/v1/meetings/${meetingSummary.meetingId}`, (route) =>
    fulfill(route, {
      ...meetingDetail,
      lifecycleState: 'LIVE',
      startedAt: '2026-08-26T23:31:04Z',
      participants: [
        organizer,
        {
          ...joiningParticipant,
          attendanceState: 'ADMITTED',
          admittedAt: '2026-08-26T23:31:05Z',
          version: 2,
        },
      ],
      artifacts: [
        {
          artifactId: '84000000-0000-0000-0000-000000000001',
          artifactType: 'RECORDING',
          artifactState: 'AVAILABLE',
          contentType: 'video/mp4',
          sizeBytes: 1_024,
          retentionUntil: '2026-09-27T01:50:00Z',
          metadata: {},
          version: 1,
        },
        {
          artifactId: '84000000-0000-0000-0000-000000000002',
          artifactType: 'SUMMARY',
          artifactState: 'AVAILABLE',
          contentType: 'application/json',
          sizeBytes: 512,
          retentionUntil: '2026-09-27T01:50:00Z',
          metadata: {},
          version: 1,
        },
      ],
      recordingAvailable: true,
      aiNotesAvailable: true,
    })
  );

  await page.goto('/meetings/join');
  const codeInput = page.locator('input[autocomplete="one-time-code"]');
  await codeInput.fill('abcd efgh-jkmn');
  await expect(codeInput).toHaveValue('ABCD-EFGH-JKMN');
  await expect(codeInput).toHaveAttribute('aria-label', 'Meeting code A B C D E F G H J K M N');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await page.getByRole('button', { name: 'Request to join' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for the host' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check devices' })).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: 'Check devices' }).click();
  await expect(page).toHaveURL(new RegExp(`/meetings/room/${meetingSummary.meetingId}`));
  await expect(page.getByRole('heading', { name: 'Check the room before entering' })).toBeVisible();
  await page.getByRole('button', { name: 'Check camera and microphone' }).click();
  await expect(page.getByText('No active recording')).toBeVisible();
  await expect(
    page.getByText('AI note-taking is not enabled for this live session.')
  ).toBeVisible();
  const preJoinAccessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    preJoinAccessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('administrators see unsupported recording and persist supported governed policy fields', async ({
  page,
}) => {
  await mockMeetingMember(page, true);
  const policy = {
    meetingsEnabled: true,
    waitingRoomRequired: true,
    guestsAllowed: false,
    participantChatAllowed: true,
    reactionsAllowed: true,
    screenShareAllowed: true,
    unmuteControl: 'REQUEST_ONLY',
    recordingPolicy: 'NEVER',
    retentionDays: 90,
    artifactRetentionDays: 30,
    chatRetentionDays: 90,
    allowJoinBeforeHost: false,
    requireAuthenticatedInternalUsers: true,
    maximumParticipants: 100,
    recordingConfigured: false,
    aiNotesConfigured: false,
    version: 4,
  };
  let saved: Record<string, unknown> | null = null;
  let idempotencyKey = '';
  await page.route('**/api/meetings/v1/admin/policy', async (route) => {
    if (route.request().method() === 'GET') return fulfill(route, policy);
    saved = route.request().postDataJSON() as Record<string, unknown>;
    idempotencyKey = route.request().headers()['idempotency-key'] ?? '';
    return fulfill(route, { ...policy, ...saved, version: 5 });
  });

  await page.goto('/meetings/admin/policies');
  await expect(
    page.getByText('LiveKit Egress is not configured. Recording cannot be enabled.')
  ).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Allow recording' })).toBeDisabled();
  await page.getByRole('switch', { name: 'Allow participant chat' }).uncheck();
  const chatRetention = page.getByLabel('Meeting chat retention (days)');
  await chatRetention.fill('120');
  await expect(
    page.getByText('Meeting chat retention cannot exceed meeting record retention.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save policy' })).toBeDisabled();
  await chatRetention.fill('60');
  await page.getByRole('button', { name: 'Save policy' }).click();

  await expect.poll(() => saved).not.toBeNull();
  expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/u);
  expect(saved).toMatchObject({
    guestsAllowed: false,
    participantChatAllowed: false,
    recordingPolicy: 'NEVER',
    chatRetentionDays: 60,
    expectedVersion: 4,
  });
  expect(saved).not.toHaveProperty('unmuteControl');

  await page.setViewportSize({ width: 320, height: 760 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const adminAccessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    adminAccessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});
