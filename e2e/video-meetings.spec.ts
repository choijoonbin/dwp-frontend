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

function contentPlan(acknowledgedByViewer = false) {
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

function disabledContentPlan() {
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

function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: success(data) });
}

function createDeferredResponse() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function keepMeetingTransportPending(page: Page) {
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

test('host configures a governed content plan before joining and sees authoritative blockers', async ({
  page,
}) => {
  await mockMeetingMember(page);
  await keepMeetingTransportPending(page);
  const hostMeeting = {
    ...meetingDetail,
    lifecycleState: 'LIVE',
    organizerUserId: 42,
    participantRole: 'ORGANIZER',
    canHost: true,
    canModerate: false,
    participants: [{ ...organizer, userId: 42 }],
  };
  let currentPlan = disabledContentPlan();
  let savedPlan: Record<string, unknown> | null = null;
  let idempotencyKey = '';
  let departureRequests = 0;

  await page.route(`**/api/meetings/v1/meetings/${meetingSummary.meetingId}`, (route) =>
    fulfill(route, hostMeeting)
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingSummary.meetingId}/content-plan`,
    async (route) => {
      if (route.request().method() !== 'PUT') return fulfill(route, currentPlan);
      savedPlan = route.request().postDataJSON() as Record<string, unknown>;
      idempotencyKey = route.request().headers()['idempotency-key'] ?? '';
      currentPlan = {
        ...contentPlan(false),
        aiSummaryRequested: true,
        blockers: [
          {
            code: 'EGRESS',
            category: 'DEPENDENCY',
            description: 'A governed media egress dependency is unavailable.',
            retryable: true,
          },
        ],
        notice: {
          ...contentPlan(false).notice,
          revision: 3,
          aiSummaryDisclosed: true,
        },
        version: 5,
        updatedAt: '2026-08-28T02:10:00Z',
      };
      return fulfill(route, currentPlan);
    }
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingSummary.meetingId}/content-notices/*/acknowledge`,
    (route) => {
      currentPlan = {
        ...currentPlan,
        notice: currentPlan.notice
          ? { ...currentPlan.notice, acknowledgedByViewer: true }
          : currentPlan.notice,
        consent: {
          requiredAcknowledgements: 1,
          receivedAcknowledgements: 1,
          complete: true,
        },
      };
      return fulfill(route, {
        acknowledgementId: '87000000-0000-0000-0000-000000000042',
        noticeId: currentPlan.notice?.noticeId,
        noticeRevision: currentPlan.notice?.revision,
        participantId: organizer.participantId,
        acknowledgedAt: '2026-08-28T02:11:00Z',
      });
    }
  );
  await page.route(`**/api/meetings/v1/meetings/${meetingSummary.meetingId}/token`, (route) =>
    fulfill(route, {
      meetingId: meetingSummary.meetingId,
      sessionId: '88000000-0000-0000-0000-000000000042',
      provider: 'LIVEKIT',
      serverUrl: 'wss://meet.example.com',
      participantToken: 'e2e-participant-token',
      participantRole: 'ORGANIZER',
      expiresAt: '2026-08-28T03:15:00Z',
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
  await page.route(`**/api/meetings/v1/meetings/${meetingSummary.meetingId}/leave`, (route) => {
    departureRequests += 1;
    return fulfill(route, {
      ...joiningParticipant,
      attendanceState: 'LEFT',
      leftAt: '2026-08-28T03:12:00Z',
    });
  });
  await page.route(
    `**/api/meetings/v1/meetings/${meetingSummary.meetingId}/chat/messages?*`,
    (route) => fulfill(route, { items: [], nextSequence: 0, hasMore: false })
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingSummary.meetingId}/hand-requests?*`,
    (route) => fulfill(route, { items: [], nextSequence: 0, hasMore: false })
  );

  await page.goto(`/meetings/room/${meetingSummary.meetingId}`);
  await page.getByRole('button', { name: 'Check camera and microphone' }).click();
  await expect(page.getByRole('heading', { name: 'Check camera and microphone' })).toBeVisible();
  await expect(page.getByText('Host content plan')).toBeVisible();
  const save = page.getByRole('button', { name: 'Save content plan' });
  await expect(save).toBeDisabled();

  await page.getByRole('switch', { name: 'Record meeting media' }).check();
  await page.getByRole('switch', { name: 'End-to-end encrypt media' }).check();
  await expect(page.getByText('End-to-end encryption is incompatible')).toBeVisible();
  await page.getByRole('switch', { name: 'End-to-end encrypt media' }).uncheck();
  await page.getByRole('switch', { name: 'Generate AI summary' }).check();
  await expect(page.getByRole('switch', { name: 'Create transcript' })).toBeChecked();
  await save.click();

  await expect.poll(() => savedPlan).not.toBeNull();
  expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/u);
  expect(savedPlan).toEqual({
    recordingRequested: true,
    transcriptionRequested: true,
    aiSummaryRequested: true,
    e2eeEnabled: false,
    expectedVersion: 4,
  });
  await expect(page.getByText('The recording egress service is unavailable.')).toBeVisible();
  await expect(page.getByText('Review and acknowledge this meeting notice')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join meeting' })).toBeDisabled();
  await page.getByRole('button', { name: 'Acknowledge notice' }).click();
  await expect(page.getByText('You acknowledged the current meeting notice')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join meeting' })).toBeEnabled();

  await page.setViewportSize({ width: 320, height: 760 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await test.info().attach('meeting-host-content-plan', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  await page.setViewportSize({ width: 1_280, height: 800 });
  const tokenIssued = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/meetings/${meetingSummary.meetingId}/token`) &&
      response.status() === 200
  );
  await page.getByRole('button', { name: 'Join meeting' }).click();
  await tokenIssued;
  await expect(page.getByRole('button', { name: 'Join meeting' })).toBeHidden();
  expect(departureRequests).toBe(0);

  await page.setViewportSize({ width: 640, height: 640 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce', forcedColors: 'active' });
  const chatTrigger = page.getByRole('button', { name: 'Open meeting chat' });
  await expect(chatTrigger).toBeVisible();
  await expect
    .poll(() =>
      chatTrigger.evaluate(
        (element) => Number.parseFloat(getComputedStyle(element).transitionDuration) || 0
      )
    )
    .toBeLessThanOrEqual(0.001);
  await chatTrigger.click();
  const collaborationClose = page.locator('.dwp-meeting-collaboration__icon-button');
  await expect(collaborationClose).toBeFocused();
  await expect(page.locator('.dwp-meeting-conference__stage')).toHaveAttribute('inert', '');
  await expect(page.locator('.dwp-video-meeting-room__header')).toHaveAttribute('inert', '');
  await expect(page.locator('.dwp-video-meeting-room__header')).toHaveAttribute(
    'aria-hidden',
    'true'
  );
  await expect(page.locator('.dwp-video-meeting-room__interactions')).toHaveAttribute(
    'aria-hidden',
    'true'
  );
  await expect(page.locator('.dwp-video-meeting-room__interactions')).toHaveAttribute('inert', '');
  await expect
    .poll(() =>
      page.locator('.dwp-video-meeting-room').evaluate((element) => {
        const room = element as HTMLElement;
        return room.scrollWidth - room.clientWidth;
      })
    )
    .toBeLessThanOrEqual(1);
  await collaborationClose.press('Shift+Tab');
  await expect(page.getByRole('textbox', { name: 'Type a message' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Type a message' }).press('Tab');
  await expect(collaborationClose).toBeFocused();
  await collaborationClose.press('Escape');
  await expect(chatTrigger).toBeFocused();
  await expect(page.locator('.dwp-video-meeting-room__interactions')).not.toHaveAttribute(
    'aria-hidden',
    'true'
  );

  await page.setViewportSize({ width: 320, height: 760 });
  await page.getByRole('button', { name: 'Open floor requests' }).click();
  await expect(page.locator('.dwp-meeting-collaboration__icon-button')).toBeFocused();
  await page.locator('.dwp-meeting-collaboration__icon-button').press('Escape');
  await expect(page.getByRole('button', { name: 'Open floor requests' })).toBeFocused();
  await page.getByRole('button', { name: 'Open participant list' }).click();
  await expect(page.locator('.dwp-meeting-side-panel__close')).toBeFocused();
  await page.locator('.dwp-meeting-side-panel__close').press('Escape');
  await expect(page.getByRole('button', { name: 'Open participant list' })).toBeFocused();
  expect(
    await page.locator('.dwp-video-meeting-room').evaluate((element) => {
      const room = element as HTMLElement;
      return room.scrollWidth - room.clientWidth;
    })
  ).toBeLessThanOrEqual(1);
  const roomAccessibility = await new AxeBuilder({ page })
    .include('.dwp-video-meeting-room')
    .analyze();
  expect(
    roomAccessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect.poll(() => departureRequests).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect.poll(() => departureRequests).toBe(1);
});

test('join code formats 4-4-4 and waits for host approval before device check', async ({
  page,
}) => {
  await mockMeetingMember(page);
  let requestPolls = 0;
  let noticeAcknowledged = false;
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
  await page.route(
    `**/api/meetings/v1/meetings/${meetingSummary.meetingId}/content-plan`,
    (route) => fulfill(route, contentPlan(noticeAcknowledged))
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingSummary.meetingId}/content-notices/*/acknowledge`,
    (route) => {
      noticeAcknowledged = true;
      return fulfill(route, {
        acknowledgementId: '87000000-0000-0000-0000-000000000001',
        noticeId: contentPlan().notice.noticeId,
        noticeRevision: 2,
        participantId: joiningParticipant.participantId,
        acknowledgedAt: '2026-08-27T00:56:00Z',
      });
    }
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
  await expect(page.getByText('Review and acknowledge this meeting notice')).toBeVisible();
  await expect(page.getByText('Tenant policy prohibits recording.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join meeting' })).toBeDisabled();
  await page.getByRole('button', { name: 'Acknowledge notice' }).click();
  await expect(page.getByText('You acknowledged the current meeting notice')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join meeting' })).toBeEnabled();
  await test.info().attach('meeting-prejoin-content-governance', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  const preJoinAccessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    preJoinAccessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('join request polling failure is recoverable without losing the request', async ({ page }) => {
  await mockMeetingMember(page);
  let statusAvailable = false;
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
        requestedAt: joiningParticipant.joinRequestedAt,
        version: 1,
      })
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingSummary.meetingId}/join-requests/${joiningParticipant.participantId}`,
    (route) =>
      statusAvailable
        ? fulfill(route, {
            requestId: joiningParticipant.participantId,
            state: 'APPROVED',
            displayName: joiningParticipant.displayName,
            requestedAt: joiningParticipant.joinRequestedAt,
            version: 2,
          })
        : fulfill(route, { message: 'temporary outage' }, 503)
  );

  await page.goto('/meetings/join?code=ABCDEFGHJKMN');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await page.getByRole('button', { name: 'Request to join' }).click();
  await expect(page.getByText('The host response could not be checked.')).toBeVisible({
    timeout: 8_000,
  });

  statusAvailable = true;
  await page.getByRole('button', { name: 'Check status again' }).click();
  await expect(page.getByRole('button', { name: 'Check devices' })).toBeVisible();
});

test('a meeting without approval moves directly to the room preparation step', async ({ page }) => {
  await mockMeetingMember(page);
  await page.route('**/api/meetings/v1/join-codes/ABCDEFGHJKMN', (route) =>
    fulfill(route, {
      meeting: { ...meetingSummary, waitingRoomEnabled: false },
      joinAllowed: true,
      denialReason: null,
      waitingRoomRequired: false,
    })
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingSummary.meetingId}/join-requests`,
    (route) =>
      fulfill(route, {
        requestId: joiningParticipant.participantId,
        state: 'APPROVED',
        displayName: joiningParticipant.displayName,
        requestedAt: joiningParticipant.joinRequestedAt,
        version: 2,
      })
  );
  await page.route(`**/api/meetings/v1/meetings/${meetingSummary.meetingId}`, (route) =>
    fulfill(route, {
      ...meetingDetail,
      waitingRoomEnabled: false,
      lifecycleState: 'LIVE',
      participants: [{ ...joiningParticipant, attendanceState: 'ADMITTED', version: 2 }],
    })
  );

  await page.goto('/meetings/join?code=ABCDEFGHJKMN');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/meetings/room/${meetingSummary.meetingId}`));
  await expect(page.getByRole('heading', { name: 'Check the room before entering' })).toBeVisible();
});

test('a late code-resolution error cannot contaminate a newer meeting-code result', async ({
  page,
}) => {
  await mockMeetingMember(page);
  const meetingB = {
    ...meetingSummary,
    meetingId: '81000000-0000-0000-0000-000000000098',
    meetingCode: 'NPQR-STUV-WX23',
    title: 'Current incident review',
  };
  const firstResponse = createDeferredResponse();
  let firstResolutionStarted = false;

  await page.route('**/api/meetings/v1/join-codes/ABCDEFGHJKMN', async (route) => {
    firstResolutionStarted = true;
    await firstResponse.promise;
    return fulfill(route, { message: 'stale resolution failed' }, 503);
  });
  await page.route('**/api/meetings/v1/join-codes/NPQRSTUVWX23', (route) =>
    fulfill(route, {
      meeting: meetingB,
      joinAllowed: true,
      denialReason: null,
      waitingRoomRequired: true,
    })
  );

  await page.goto('/meetings/join?code=ABCDEFGHJKMN');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await expect.poll(() => firstResolutionStarted).toBe(true);

  const codeInput = page.locator('input[autocomplete="one-time-code"]');
  await codeInput.fill('NPQR-STUV-WX23');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await expect(page.getByRole('heading', { name: meetingB.title })).toBeVisible();

  firstResponse.release();
  await page.waitForTimeout(250);
  await expect(page.getByRole('heading', { name: meetingB.title })).toBeVisible();
  await expect(page.getByText('The meeting code could not be resolved.')).toHaveCount(0);
});

test('a late direct-join response cannot replace a newer meeting-code intent', async ({ page }) => {
  await mockMeetingMember(page);
  const meetingB = {
    ...meetingSummary,
    meetingId: '81000000-0000-0000-0000-000000000099',
    meetingCode: 'NPQR-STUV-WX23',
    title: 'Current architecture review',
    waitingRoomEnabled: false,
  };
  const firstResponse = createDeferredResponse();
  let firstRequestStarted = false;

  await page.route('**/api/meetings/v1/join-codes/ABCDEFGHJKMN', (route) =>
    fulfill(route, {
      meeting: { ...meetingSummary, waitingRoomEnabled: false },
      joinAllowed: true,
      denialReason: null,
      waitingRoomRequired: false,
    })
  );
  await page.route('**/api/meetings/v1/join-codes/NPQRSTUVWX23', (route) =>
    fulfill(route, {
      meeting: meetingB,
      joinAllowed: true,
      denialReason: null,
      waitingRoomRequired: false,
    })
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingSummary.meetingId}/join-requests`,
    async (route) => {
      firstRequestStarted = true;
      await firstResponse.promise;
      return fulfill(route, {
        requestId: '82000000-0000-0000-0000-000000000091',
        state: 'APPROVED',
        displayName: 'Mina Kim',
        requestedAt: joiningParticipant.joinRequestedAt,
        version: 2,
      });
    }
  );
  await page.route(`**/api/meetings/v1/meetings/${meetingB.meetingId}/join-requests`, (route) =>
    fulfill(route, {
      requestId: '82000000-0000-0000-0000-000000000099',
      state: 'APPROVED',
      displayName: 'Mina Kim',
      requestedAt: joiningParticipant.joinRequestedAt,
      version: 2,
    })
  );
  await page.route(`**/api/meetings/v1/meetings/${meetingB.meetingId}`, (route) =>
    fulfill(route, {
      ...meetingDetail,
      ...meetingB,
      lifecycleState: 'LIVE',
      participants: [{ ...joiningParticipant, attendanceState: 'ADMITTED', version: 2 }],
    })
  );

  await page.goto('/meetings/join?code=ABCDEFGHJKMN');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await expect(page.getByRole('heading', { name: 'Platform launch review' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect.poll(() => firstRequestStarted).toBe(true);

  const codeInput = page.locator('input[autocomplete="one-time-code"]');
  await codeInput.fill('NPQR-STUV-WX23');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await expect(page.getByRole('heading', { name: meetingB.title })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/meetings/room/${meetingB.meetingId}`));

  firstResponse.release();
  await page.waitForTimeout(250);
  await expect(page).toHaveURL(new RegExp(`/meetings/room/${meetingB.meetingId}`));
  await expect(page).not.toHaveURL(new RegExp(`/meetings/room/${meetingSummary.meetingId}`));
});

test('ended meetings open the selected recap with actual evidence and honest artifact state', async ({
  page,
}) => {
  await mockMeetingMember(page);
  const endedMeeting = {
    ...meetingSummary,
    title: 'Completed launch review',
    lifecycleState: 'ENDED',
    startedAt: '2026-08-27T01:03:00Z',
    endedAt: '2026-08-27T01:45:00Z',
    version: 7,
  };
  const cancelledMeeting = {
    ...meetingSummary,
    meetingId: '81000000-0000-0000-0000-000000000002',
    title: 'Cancelled planning session',
    lifecycleState: 'CANCELLED',
    version: 3,
  };
  let recapReads = 0;
  await page.route('**/api/meetings/v1/meetings?*', (route) =>
    fulfill(route, { items: [endedMeeting, cancelledMeeting], page: 0, pageSize: 30, total: 2 })
  );
  await page.route(`**/api/meetings/v1/meetings/${endedMeeting.meetingId}`, (route) => {
    recapReads += 1;
    const artifactAvailable = recapReads > 1;
    return fulfill(route, {
      ...meetingDetail,
      ...endedMeeting,
      participants: [
        organizer,
        {
          ...joiningParticipant,
          attendanceState: 'LEFT',
          joinedAt: '2026-08-27T01:04:00Z',
          leftAt: '2026-08-27T01:44:00Z',
          version: 4,
        },
      ],
      artifacts: [
        {
          artifactId: '84000000-0000-0000-0000-000000000001',
          artifactType: 'RECORDING',
          artifactState: artifactAvailable ? 'AVAILABLE' : 'PROCESSING',
          contentType: 'video/mp4',
          sizeBytes: 2_048,
          retentionUntil: '2026-09-27T01:50:00Z',
          metadata: {},
          version: 1,
        },
      ],
      recordingAvailable: artifactAvailable,
    });
  });
  await page.route(
    `**/api/meetings/v1/meetings/${endedMeeting.meetingId}/intelligence/reports/latest-published`,
    (route) =>
      fulfill(route, {
        reportId: '88000000-0000-0000-0000-000000000001',
        meetingId: endedMeeting.meetingId,
        runId: '87000000-0000-0000-0000-000000000001',
        state: 'PUBLISHED',
        audience: 'MEETING_PARTICIPANTS',
        schemaVersion: 'meeting-intelligence-v1',
        retentionUntil: '2026-09-27T01:50:00Z',
        legalHold: false,
        approvedAt: '2026-08-27T02:00:00Z',
        publishedAt: '2026-08-27T02:02:00Z',
        version: 2,
        canCurrentViewerReview: false,
        analysis: {
          executiveSummary: {
            text: 'The team approved a staged launch with one regional dependency open.',
            citations: [{ segmentId: 'seg-12', startMillis: 92_000, endMillis: 118_000 }],
          },
          topics: [],
          decisions: [
            {
              text: 'Launch the pilot on Monday.',
              citations: [{ segmentId: 'seg-18', startMillis: 221_000, endMillis: 238_000 }],
            },
          ],
          actionItems: [
            {
              text: 'Verify regional capacity before expansion.',
              citations: [{ segmentId: 'seg-21', startMillis: 281_000, endMillis: 302_000 }],
            },
          ],
          openQuestions: [],
          risks: [],
          conversationClimate: {
            label: 'ALIGNED',
            signals: [],
            citations: [{ segmentId: 'seg-18', startMillis: 221_000, endMillis: 238_000 }],
          },
        },
        reviews: [],
      })
  );

  await page.goto('/meetings/mine');
  await expect(page.getByText('Cancelled planning session')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare to join' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open meeting recap' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/meetings/history\\?meeting=${endedMeeting.meetingId.replaceAll('-', '\\-')}`)
  );
  await expect(page.getByRole('heading', { name: 'Completed launch review' })).toBeVisible();
  await expect(page.getByText('42 minutes')).toBeVisible();
  await expect(page.getByText('1 participant')).toBeVisible();
  await expect(
    page.getByText('The team approved a staged launch with one regional dependency open.')
  ).toBeVisible();
  await expect(page.getByText('Launch the pilot on Monday.')).toBeVisible();
  for (const tabName of ['Overview', 'Recording, transcript, and AI', 'Attendance']) {
    await expect(page.getByRole('tab', { name: tabName })).toBeInViewport({ ratio: 1 });
  }
  await page.getByRole('tab', { name: 'Recording, transcript, and AI' }).click();
  await expect(page.getByText('Processing', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open video recording' })).toBeVisible({
    timeout: 8_000,
  });
  await expect(page.getByText('this client has no authorized retrieval endpoint')).toHaveCount(0);
  await test.info().attach('meeting-recap-artifact-custody', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
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
  await page.route('**/api/meetings/v1/admin/overview?*', (route) =>
    fulfill(route, {
      liveMeetings: 2,
      scheduledToday: 7,
      waitingParticipants: 1,
      meetingsLastSevenDays: 42,
      averageQualityScore: 91,
      failedJoinAttempts: 3,
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

  await page.route('**/api/meetings/v1/admin/intelligence/readiness', (route) =>
    fulfill(route, {
      readinessVersion: 'meeting-intelligence-readiness-v1',
      observedAt: '2026-08-29T06:00:00Z',
      recordingPolicy: 'NEVER',
      providerCode: 'managed-provider',
      providerModel: 'enterprise-model',
      processingRegion: 'kr-central-1',
      capabilities: {
        recording: { state: 'BLOCKED', reason: 'POLICY_NEVER' },
        transcript: { state: 'BLOCKED', reason: 'STT_NOT_READY' },
        aiNotes: { state: 'BLOCKED', reason: 'LLM_NOT_READY' },
      },
      dependencies: {
        provider: { state: 'READY' },
        region: { state: 'READY' },
        kms: { state: 'READY' },
        audit: { state: 'READY' },
        egress: { state: 'BLOCKED', reason: 'EGRESS_NOT_READY' },
        storage: { state: 'READY' },
        stt: { state: 'BLOCKED', reason: 'STT_NOT_READY' },
        llm: { state: 'BLOCKED', reason: 'LLM_NOT_READY' },
        retention: { state: 'READY' },
      },
      governance: {
        humanReview: { state: 'READY' },
        explicitPublish: { state: 'READY' },
        adminContentAccess: { state: 'READY' },
        legalHold: {
          state: 'NOT_VERIFIED',
          reason: 'LEGAL_HOLD_ADMIN_WORKFLOW_NOT_CONFIGURED',
        },
        deletionEvidence: {
          state: 'NOT_VERIFIED',
          reason: 'COMPLETE_DELETION_EVIDENCE_NOT_VERIFIED',
        },
      },
      retention: {
        meetingDays: 90,
        artifactDays: 30,
        chatDays: 60,
        intelligenceWorkerReady: true,
        signals: {
          intelligenceReports: { state: 'READY' },
          meetingRecords: {
            state: 'NOT_VERIFIED',
            reason: 'MEETING_RECORD_RETENTION_WORKER_NOT_CONFIGURED',
          },
          artifacts: {
            state: 'NOT_VERIFIED',
            reason: 'ARTIFACT_RETENTION_WORKER_NOT_CONFIGURED',
          },
          chat: {
            state: 'NOT_VERIFIED',
            reason: 'CHAT_RETENTION_WORKER_NOT_CONFIGURED',
          },
        },
      },
    })
  );
  await page.goto('/meetings/admin/intelligence');
  await expect(page.getByRole('heading', { name: 'AI and data governance' })).toBeVisible();
  await expect(page.getByText('never grants access to recordings')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Language model' })).toBeVisible();
  await expect(page.getByText('managed-provider')).toBeVisible();
  await expect(page.getByText('enterprise-model')).toBeVisible();
  await expect(
    page.getByText('Meeting-record purge execution is not implemented or verified.')
  ).toBeVisible();

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

test('configured administrators can select host opt-in without claiming runtime readiness', async ({
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
    chatRetentionDays: 60,
    allowJoinBeforeHost: false,
    requireAuthenticatedInternalUsers: true,
    maximumParticipants: 100,
    recordingConfigured: true,
    aiNotesConfigured: false,
    version: 4,
  };
  let saved: Record<string, unknown> | null = null;
  await page.route('**/api/meetings/v1/admin/policy', async (route) => {
    if (route.request().method() === 'GET') return fulfill(route, policy);
    saved = route.request().postDataJSON() as Record<string, unknown>;
    return fulfill(route, { ...policy, ...saved, version: 5 });
  });

  await page.goto('/meetings/admin/policies');
  const recording = page.getByRole('switch', { name: 'Allow recording' });
  await expect(recording).toBeEnabled();
  await recording.check();
  await expect(
    page.getByText('Host opt-in permits only a governed recording request.')
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save policy' }).click();

  await expect.poll(() => saved).not.toBeNull();
  expect(saved).toMatchObject({ recordingPolicy: 'HOST_OPT_IN', expectedVersion: 4 });
});

test('administrator-required recording survives unrelated policy edits', async ({ page }) => {
  await mockMeetingMember(page, true);
  const policy = {
    meetingsEnabled: true,
    waitingRoomRequired: true,
    guestsAllowed: false,
    participantChatAllowed: true,
    reactionsAllowed: true,
    screenShareAllowed: true,
    unmuteControl: 'REQUEST_ONLY',
    recordingPolicy: 'ADMIN_REQUIRED',
    retentionDays: 90,
    artifactRetentionDays: 30,
    chatRetentionDays: 60,
    allowJoinBeforeHost: false,
    requireAuthenticatedInternalUsers: true,
    maximumParticipants: 100,
    recordingConfigured: true,
    aiNotesConfigured: false,
    version: 7,
  };
  let saved: Record<string, unknown> | null = null;
  await page.route('**/api/meetings/v1/admin/policy', async (route) => {
    if (route.request().method() === 'GET') return fulfill(route, policy);
    saved = route.request().postDataJSON() as Record<string, unknown>;
    return fulfill(route, { ...policy, ...saved, version: 8 });
  });

  await page.goto('/meetings/admin/policies');
  await expect(page.getByRole('switch', { name: 'Allow recording' })).toBeChecked();
  await expect(
    page.getByText('This inherited policy is preserved until explicitly changed.')
  ).toBeVisible();
  await page.getByRole('switch', { name: 'Allow participant chat' }).uncheck();
  await page.getByRole('button', { name: 'Save policy' }).click();

  await expect.poll(() => saved).not.toBeNull();
  expect(saved).toMatchObject({
    participantChatAllowed: false,
    recordingPolicy: 'ADMIN_REQUIRED',
    expectedVersion: 7,
  });
});
