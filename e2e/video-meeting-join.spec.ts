import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  contentPlan,
  createDeferredResponse,
  expectNoMeetingJoinMediaCapture,
  fulfill,
  installMeetingJoinMediaProbe,
  joiningParticipant,
  meetingDetail,
  meetingSummary,
  mockMeetingHome,
  mockMeetingMember,
  organizer,
} from './support/video-meeting-functional-fixtures';

test('join rejects an incomplete code before lookup and never captures media', async ({ page }) => {
  await mockMeetingMember(page);
  await installMeetingJoinMediaProbe(page);
  let resolutionReads = 0;
  await page.route('**/api/meetings/v1/join-codes/**', (route) => {
    resolutionReads += 1;
    return fulfill(route, { message: 'must not be requested' }, 500);
  });

  await page.goto('/meetings/join');
  const codeInput = page.locator('input[autocomplete="one-time-code"]');
  const resolve = page.getByRole('button', { name: 'Find meeting' });
  await expect(codeInput).not.toBeFocused();
  await expect(resolve).toBeDisabled();
  await codeInput.fill('ABCD-1234');
  await codeInput.press('Enter');

  expect(resolutionReads).toBe(0);
  await expect(resolve).toBeDisabled();
  await expectNoMeetingJoinMediaCapture(page);
});

test('join scrubs a query code, confirms a safe meeting summary, and keeps media private', async ({
  page,
}) => {
  await mockMeetingMember(page);
  await installMeetingJoinMediaProbe(page);
  await page.route('**/api/meetings/v1/join-codes/ABCDEFGHJKMN', (route) =>
    fulfill(route, {
      meeting: meetingSummary,
      joinAllowed: true,
      denialReason: null,
      waitingRoomRequired: true,
    })
  );

  await page.goto('/meetings/join?code=ABCDEFGHJKMN');
  await expect(page).toHaveURL((url) => url.pathname === '/meetings/join' && url.search === '');
  const codeInput = page.locator('input[autocomplete="one-time-code"]');
  await expect(codeInput).toHaveValue('ABCD-EFGH-JKMN');
  await expect(codeInput).not.toBeFocused();
  await page.getByRole('button', { name: 'Find meeting' }).click();

  const summary = page.getByTestId('meeting-join-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(meetingSummary.title);
  await expect(summary).toContainText(meetingSummary.organizerName);
  await expect(summary).not.toContainText(meetingSummary.meetingCode);
  await expect(page.getByTestId('meeting-join-media-safety')).toBeVisible();
  await expect(summary.getByRole('heading', { level: 2 })).toBeFocused();
  await expectNoMeetingJoinMediaCapture(page);
});

test('join fails closed for an unknown code and returns keyboard focus to recovery', async ({
  page,
}) => {
  await mockMeetingMember(page);
  await installMeetingJoinMediaProbe(page);
  await page.route('**/api/meetings/v1/join-codes/ABCDEFGHJKMN', (route) =>
    fulfill(route, { message: 'not found' }, 404)
  );

  await page.goto('/meetings/join');
  const codeInput = page.locator('input[autocomplete="one-time-code"]');
  await codeInput.fill('ABCD-EFGH-JKMN');
  await page.getByRole('button', { name: 'Find meeting' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('meeting-join-summary')).toHaveCount(0);
  await expect(codeInput).toBeFocused();
  await expectNoMeetingJoinMediaCapture(page);
});

test('join redacts an untrusted denial reason and offers no admission action', async ({ page }) => {
  await mockMeetingMember(page);
  await installMeetingJoinMediaProbe(page);
  const untrustedReason = 'RAW_TENANT_POLICY_SECRET_42';
  await page.route('**/api/meetings/v1/join-codes/ABCDEFGHJKMN', (route) =>
    fulfill(route, {
      meeting: { ...meetingSummary, lifecycleState: 'CANCELLED' },
      joinAllowed: false,
      denialReason: untrustedReason,
      waitingRoomRequired: false,
    })
  );

  await page.goto('/meetings/join?code=ABCDEFGHJKMN');
  await page.getByRole('button', { name: 'Find meeting' }).click();

  const denial = page.getByRole('alert');
  await expect(denial).toBeVisible();
  await expect(denial).not.toContainText(untrustedReason);
  await expect(page.getByRole('button', { name: 'Request to join' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue to device check' })).toHaveCount(0);
  await expectNoMeetingJoinMediaCapture(page);
});

test('join preserves the verified meeting and focuses a recoverable request error', async ({
  page,
}) => {
  await mockMeetingMember(page);
  await installMeetingJoinMediaProbe(page);
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
    (route) => fulfill(route, { message: 'temporary outage' }, 503)
  );

  await page.goto('/meetings/join?code=ABCDEFGHJKMN');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await page.getByRole('button', { name: 'Request to join' }).click();

  const error = page.getByRole('alert');
  await expect(error).toBeVisible();
  await expect(error).toBeFocused();
  await expect(page.getByTestId('meeting-join-summary')).toContainText(meetingSummary.title);
  await expect(page.getByRole('button', { name: 'Request to join' })).toBeEnabled();
  await expectNoMeetingJoinMediaCapture(page);
});

test('join keeps denied admission terminal until the user explicitly starts over', async ({
  page,
}) => {
  await mockMeetingMember(page);
  await installMeetingJoinMediaProbe(page);
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
        state: 'DENIED',
        displayName: joiningParticipant.displayName,
        requestedAt: joiningParticipant.joinRequestedAt,
        version: 2,
      })
  );

  await page.goto('/meetings/join?code=ABCDEFGHJKMN');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await page.getByRole('button', { name: 'Request to join' }).click();

  await expect(page.getByRole('heading', { name: 'The host declined this request' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check camera and microphone' })).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === '/meetings/join');
  await expectNoMeetingJoinMediaCapture(page);
  await page.getByRole('button', { name: 'Enter another code' }).click();
  const restartedCode = page.locator('input[autocomplete="one-time-code"]');
  await expect(restartedCode).toHaveValue('');
  await expect(restartedCode).toBeFocused();
  await expect(page.getByRole('button', { name: 'Find meeting' })).toBeDisabled();
});

test('join code formats 4-4-4 and waits for host approval before device check', async ({
  page,
}) => {
  await mockMeetingMember(page);
  await installMeetingJoinMediaProbe(page);
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
  await expect(
    page.getByTestId('meeting-join-summary').getByRole('heading', { level: 2 })
  ).toBeFocused();
  await expect(page.getByTestId('meeting-join-summary')).not.toContainText(
    meetingSummary.meetingCode
  );
  await page.getByRole('button', { name: 'Request to join' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for the host' })).toBeVisible();
  await expect(page.getByTestId('meeting-join-status')).toHaveAttribute('role', 'status');
  await expect(codeInput).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Check camera and microphone' })).toBeVisible({
    timeout: 8_000,
  });
  await expectNoMeetingJoinMediaCapture(page);
  await page.getByRole('button', { name: 'Check camera and microphone' }).click();
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
  await installMeetingJoinMediaProbe(page);
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
  await expect(page.locator('input[autocomplete="one-time-code"]')).toBeDisabled();
  await expect(page.getByTestId('meeting-join-status')).toHaveAttribute('role', 'status');
  await expectNoMeetingJoinMediaCapture(page);

  statusAvailable = true;
  await page.getByRole('button', { name: 'Check status again' }).click();
  await expect(page.getByRole('button', { name: 'Check camera and microphone' })).toBeVisible();
});

test('join keeps a renewed same-code request waiting and retryable after a cached denial', async ({
  page,
}) => {
  await mockMeetingMember(page);
  await installMeetingJoinMediaProbe(page);
  let requestCount = 0;
  let renewedStatusAvailable = false;
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
    (route) => {
      requestCount += 1;
      return fulfill(route, {
        requestId: joiningParticipant.participantId,
        state: 'WAITING',
        displayName: joiningParticipant.displayName,
        requestedAt:
          requestCount === 1 ? joiningParticipant.joinRequestedAt : '2026-08-26T23:32:00Z',
        version: requestCount * 2 - 1,
      });
    }
  );
  await page.route(
    `**/api/meetings/v1/meetings/${meetingSummary.meetingId}/join-requests/${joiningParticipant.participantId}`,
    (route) => {
      if (requestCount > 1 && !renewedStatusAvailable) {
        return fulfill(route, { message: 'temporary outage' }, 503);
      }
      return fulfill(route, {
        requestId: joiningParticipant.participantId,
        state: requestCount === 1 ? 'DENIED' : 'APPROVED',
        displayName: joiningParticipant.displayName,
        requestedAt:
          requestCount === 1 ? joiningParticipant.joinRequestedAt : '2026-08-26T23:32:00Z',
        version: requestCount * 2,
      });
    }
  );

  await page.goto('/meetings/join?code=ABCDEFGHJKMN');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await page.getByRole('button', { name: 'Request to join' }).click();
  await expect(page.getByRole('heading', { name: 'The host declined this request' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter another code' }).click();
  const code = page.locator('input[autocomplete="one-time-code"]');
  await code.fill('ABCD-EFGH-JKMN');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await page.getByRole('button', { name: 'Request to join' }).click();

  await expect.poll(() => requestCount).toBe(2);
  await expect(page.getByText('The host response could not be checked.')).toBeVisible({
    timeout: 8_000,
  });
  await expect(page.getByRole('heading', { name: 'Waiting for the host' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The host declined this request' })).toHaveCount(
    0
  );
  await expect(code).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Check status again' })).toBeEnabled();
  await expectNoMeetingJoinMediaCapture(page);

  renewedStatusAvailable = true;
  await page.getByRole('button', { name: 'Check status again' }).click();
  await expect(page.getByRole('button', { name: 'Check camera and microphone' })).toBeVisible();
});

test('a meeting without approval moves directly to the room preparation step', async ({ page }) => {
  await mockMeetingMember(page);
  await installMeetingJoinMediaProbe(page);
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
  await expect(
    page.getByTestId('meeting-join-step-rail').locator('[aria-current="step"]')
  ).toContainText(/admission|entry|request/iu);
  await expectNoMeetingJoinMediaCapture(page);
  await page.getByRole('button', { name: 'Continue to device check', exact: true }).click();
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
  await page.getByRole('button', { name: 'Continue to device check', exact: true }).click();
  await expect.poll(() => firstRequestStarted).toBe(true);

  const codeInput = page.locator('input[autocomplete="one-time-code"]');
  await codeInput.fill('NPQR-STUV-WX23');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await expect(page.getByRole('heading', { name: meetingB.title })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to device check', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/meetings/room/${meetingB.meetingId}`));

  firstResponse.release();
  await page.waitForTimeout(250);
  await expect(page).toHaveURL(new RegExp(`/meetings/room/${meetingB.meetingId}`));
  await expect(page).not.toHaveURL(new RegExp(`/meetings/room/${meetingSummary.meetingId}`));
});

test('a late direct-join response cannot reopen J01 after shell navigation leaves it', async ({
  page,
}, testInfo) => {
  await mockMeetingMember(page);
  await mockMeetingHome(page);
  await installMeetingJoinMediaProbe(page);
  const joinResponse = createDeferredResponse();
  let requestStarted = false;
  const joinRequestPath = `/api/meetings/v1/meetings/${meetingSummary.meetingId}/join-requests`;

  await page.route('**/api/meetings/v1/join-codes/ABCDEFGHJKMN', (route) =>
    fulfill(route, {
      meeting: { ...meetingSummary, waitingRoomEnabled: false },
      joinAllowed: true,
      denialReason: null,
      waitingRoomRequired: false,
    })
  );
  await page.route(`**${joinRequestPath}`, async (route) => {
    requestStarted = true;
    await joinResponse.promise;
    return fulfill(route, {
      requestId: joiningParticipant.participantId,
      state: 'APPROVED',
      displayName: joiningParticipant.displayName,
      requestedAt: joiningParticipant.joinRequestedAt,
      version: 2,
    });
  });

  await page.goto('/meetings/join?code=ABCDEFGHJKMN');
  await page.getByRole('button', { name: 'Find meeting' }).click();
  await page.getByRole('button', { name: 'Continue to device check', exact: true }).click();
  await expect.poll(() => requestStarted).toBe(true);
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open meetings navigation' }).click();
  }
  await page.getByTestId('meetings-navigation-item-home').filter({ visible: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/meetings/home');
  await expect(page.getByTestId('meeting-join-workspace')).toHaveCount(0);

  const lateResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === joinRequestPath
  );
  joinResponse.release();
  await (await lateResponse).finished();
  await page.waitForTimeout(250);
  await expect(page).toHaveURL((url) => url.pathname === '/meetings/home');
  await expect(
    page.getByRole('heading', { name: "Today's meetings and next actions" })
  ).toBeVisible();
  await expectNoMeetingJoinMediaCapture(page);
});
