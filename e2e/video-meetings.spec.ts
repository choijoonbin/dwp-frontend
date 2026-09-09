import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectMeetingAdminRuntimeEvidence } from './support/video-meeting-admin-intelligence-assertions';
import { openUnsupportedRecordingPolicyEditor } from './support/video-meeting-admin-policy';
import {
  contentPlan,
  disabledContentPlan,
  fulfill,
  joiningParticipant,
  keepMeetingTransportPending,
  meetingDetail,
  meetingSummary,
  mockMeetingHome,
  mockMeetingMember,
  organizer,
} from './support/video-meeting-functional-fixtures';
import {
  expectMeetingChatOverlayKeyboardBoundary,
  expectMeetingRoomWorkspaceTools,
} from './support/video-meeting-room-assertions';

test('meeting home prioritizes the three actions and remains accessible on mobile', async ({
  page,
}) => {
  await mockMeetingMember(page);
  await mockMeetingHome(page);

  await page.goto('/meetings/home');
  await expect(
    page.getByRole('heading', { name: "Today's meetings and next actions" })
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

test('host configures a governed content plan before joining and sees authoritative blockers', async ({
  page,
}) => {
  test.slow(); // Full prejoin, content-plan command and room keyboard journey in both engines.
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
  await expect(page.getByRole('heading', { level: 1, name: meetingSummary.title })).toBeVisible();
  await page.getByTestId('meeting-content-plan-disclosure').locator('summary').click();
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
  await expectMeetingRoomWorkspaceTools(page);

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
  await expect
    .poll(() =>
      page.locator('.dwp-video-meeting-room').evaluate((element) => {
        const room = element as HTMLElement;
        return room.scrollWidth - room.clientWidth;
      })
    )
    .toBeLessThanOrEqual(1);
  await expectMeetingChatOverlayKeyboardBoundary(page);
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
  await page.getByRole('tab', { name: /^Past /u }).click();
  await expect(page.getByText('Cancelled planning session')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare to join' })).toHaveCount(0);
  const endedRow = page
    .getByTestId('my-meetings-list')
    .getByRole('article')
    .filter({
      has: page.getByRole('heading', { name: endedMeeting.title, exact: true }),
    });
  await endedRow.getByRole('button', { name: 'Open meeting recap', exact: true }).click();

  await expect(page).toHaveURL(
    new RegExp(`/meetings/history\\?meeting=${endedMeeting.meetingId.replaceAll('-', '\\-')}`)
  );
  await expect(
    page.getByRole('article').getByRole('heading', { name: 'Completed launch review' })
  ).toBeVisible();
  await expect(page.getByText('42 minutes')).toBeVisible();
  await expect(page.getByText('1 participant')).toBeVisible();
  await expect(
    page.getByText('The team approved a staged launch with one regional dependency open.')
  ).toBeVisible();
  await expect(page.getByText('Launch the pilot on Monday.')).toBeVisible();
  for (const tabName of ['Overview', 'Recording, transcript, and AI', 'Attendance']) {
    await page.getByRole('tab', { name: tabName }).click();
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
  const chatRetention = await openUnsupportedRecordingPolicyEditor(page);
  await chatRetention.fill('120');
  await expect(
    page.getByText('Meeting chat retention cannot exceed meeting record retention.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save policy', exact: true })).toBeDisabled();
  await chatRetention.fill('60');
  await page.getByRole('button', { name: 'Save policy', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save policy', exact: true }).click();
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
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'This administration view exposes policy and dependency status only.' })
  ).toBeVisible();
  await expectMeetingAdminRuntimeEvidence(page, 'managed-provider', 'enterprise-model');
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
