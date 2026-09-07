import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import {
  MEETING_VISUAL_ID,
  MEETING_VISUAL_NOW,
  MEETING_VISUAL_SUMMARY,
  mockMeetingVisualPrejoin,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

const agendaItemId = '71000000-0000-4000-8000-000000000001';
const pollId = '72000000-0000-4000-8000-000000000001';
const optionMorning = '73000000-0000-4000-8000-000000000001';
const optionEvening = '73000000-0000-4000-8000-000000000002';

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: success(data) });
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

function timer(state: 'IDLE' | 'RUNNING' = 'IDLE') {
  return state === 'IDLE'
    ? {
        state,
        agendaItemId: null,
        agendaItemTitle: null,
        plannedSeconds: null,
        elapsedSeconds: 0,
        remainingSeconds: null,
        runningSince: null,
        version: 0,
      }
    : {
        state,
        agendaItemId,
        agendaItemTitle: 'Release decision',
        plannedSeconds: 900,
        elapsedSeconds: 0,
        remainingSeconds: 900,
        runningSince: MEETING_VISUAL_NOW.toISOString(),
        version: 1,
      };
}

function openPoll(myOptionId: string | null = null) {
  return {
    pollId,
    state: 'OPEN',
    question: 'Choose the release window',
    anonymous: true,
    options: [
      { optionId: optionMorning, position: 0, label: 'Morning', voteCount: 2 },
      {
        optionId: optionEvening,
        position: 1,
        label: 'Evening',
        voteCount: myOptionId ? 2 : 1,
      },
    ],
    totalVotes: myOptionId ? 4 : 3,
    myOptionId,
    myBallotVersion: myOptionId ? 1 : 0,
    canVote: true,
    canModerate: true,
    version: 1,
    sequence: 2,
    openedAt: '2026-08-31T04:18:00Z',
    closedAt: null,
  };
}

async function mockLiveRoom(page: Page, unavailable = false, authorization?: { revoked: boolean }) {
  await keepMeetingTransportPending(page);
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualPrejoin(page);
  await page.unroute(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`);
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`, (route) =>
    authorization?.revoked
      ? fulfill(route, { code: 'MEETING_ACCESS_REVOKED' }, 403)
      : fulfill(route, {
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
    fulfill(route, {
      meetingId: MEETING_VISUAL_ID,
      sessionId: '74000000-0000-4000-8000-000000000001',
      provider: 'LIVEKIT',
      serverUrl: 'wss://meet.example.test',
      participantToken: 'e2e-pending-livekit-token',
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
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/leave`, (route) =>
    fulfill(route, {
      ...MEETING_VISUAL_SUMMARY.participants[0],
      attendanceState: 'LEFT',
      leftAt: MEETING_VISUAL_NOW.toISOString(),
    })
  );
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/chat/messages?*`, (route) =>
    authorization?.revoked
      ? fulfill(route, { code: 'MEETING_ACCESS_REVOKED' }, 403)
      : fulfill(route, {
          items: authorization
            ? [
                {
                  messageId: '76000000-0000-4000-8000-000000000001',
                  sequence: 1,
                  createdSequence: 1,
                  sender: {
                    participantId: 'participant-peer',
                    userId: 43,
                    displayName: 'Alex Reviewer',
                    participantRole: 'ATTENDEE',
                  },
                  state: 'ACTIVE',
                  text: 'Confidential launch dependency',
                  sentAt: '2026-08-31T04:12:00Z',
                  retentionUntil: '2026-09-30T04:12:00Z',
                  mine: false,
                  canDelete: false,
                },
              ]
            : [],
          nextSequence: authorization ? 1 : 0,
          hasMore: false,
        })
  );
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/hand-requests?*`, (route) =>
    fulfill(route, { items: [], nextSequence: 0, hasMore: false })
  );
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/preparation`, (route) =>
    fulfill(route, {
      meetingId: MEETING_VISUAL_ID,
      meetingVersion: 8,
      agendaVersion: 1,
      materialsVersion: 0,
      invitationRevision: 1,
      agendaItems: [
        {
          itemId: agendaItemId,
          position: 0,
          title: 'Release decision',
          objective: 'Choose the release window',
          ownerUserId: 42,
          ownerDisplayName: 'Mina Kim',
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
  if (unavailable) {
    await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/facilitation`, (route) =>
      fulfill(route, { reasonCode: 'AUTHORITY_UNAVAILABLE' }, 503)
    );
  }
}

async function enterRoom(page: Page) {
  await page.goto(`/meetings/room/${MEETING_VISUAL_ID}`);
  await page.getByRole('button', { name: 'Check camera and microphone' }).click();
  await expect(page.getByRole('button', { name: 'Join meeting' })).toBeEnabled();
  await page.getByRole('button', { name: 'Join meeting' }).click();
  await expect(page.getByRole('button', { name: 'Facilitate' })).toBeVisible();
}

async function expectNarrowRoomHeader(page: Page, width: 320 | 390) {
  await page.setViewportSize({ width, height: 844 });
  const header = page.locator('.dwp-video-meeting-room__header');
  const title = header.locator('.dwp-video-meeting-room__title');
  const connectionToast = page.locator('.lk-toast-connection-state');
  await expect(header).toBeVisible();
  await expect(title).toBeVisible();
  await expect(connectionToast).toBeVisible();
  const bounds = await page.evaluate(() => {
    const rect = (selector: string) => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) throw new Error(`Missing ${selector}`);
      const value = target.getBoundingClientRect();
      return {
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        left: value.left,
        width: value.width,
      };
    };
    const header = rect('.dwp-video-meeting-room__header');
    const title = rect('.dwp-video-meeting-room__title');
    const actions = rect('.dwp-video-meeting-room__actions');
    const toast = rect('.lk-toast-connection-state');
    const intersects = (first: typeof header, second: typeof header) =>
      first.left < second.right &&
      first.right > second.left &&
      first.top < second.bottom &&
      first.bottom > second.top;
    return {
      header,
      identity: rect('.dwp-video-meeting-room__identity'),
      actions,
      title,
      toast,
      titleToastIntersection: intersects(title, toast),
      actionsToastIntersection: intersects(actions, toast),
    };
  });
  expect(bounds.identity.bottom, `${width}px identity/action rows overlap`).toBeLessThanOrEqual(
    bounds.actions.top + 1
  );
  expect(bounds.identity.right).toBeLessThanOrEqual(bounds.header.right + 1);
  expect(bounds.actions.right).toBeLessThanOrEqual(bounds.header.right + 1);
  expect(bounds.title.width, `${width}px meeting title has no readable width`).toBeGreaterThan(32);
  expect(
    bounds.toast.top,
    `${width}px connection toast overlaps the header safe zone`
  ).toBeGreaterThanOrEqual(bounds.header.bottom);
  expect(bounds.titleToastIntersection, `${width}px title/toast intersection`).toBe(false);
  expect(bounds.actionsToastIntersection, `${width}px actions/toast intersection`).toBe(false);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    `${width}px live room overflow`
  ).toBeLessThanOrEqual(1);

  const buttons = header.getByRole('button');
  expect(await buttons.count()).toBeGreaterThan(0);
  const targetSizes = await buttons.evaluateAll((targets) =>
    targets.map((target) => {
      const rect = target.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })
  );
  for (const target of targetSizes) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }
  await buttons.first().focus();
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(header.locator(':focus')).toHaveCount(1);
  const a11y = await new AxeBuilder({ page }).include('.dwp-video-meeting-room__header').analyze();
  expect(
    a11y.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

test('narrow live-room header keeps identity and icon actions in separate accessible rows', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Narrow header evidence belongs to mobile.');
  await mockLiveRoom(page);
  await enterRoom(page);
  for (const width of [390, 320] as const) {
    await expectNarrowRoomHeader(page, width);
    await expect(page).toHaveScreenshot(`meeting-u06-live-header-${width}.png`, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      maxDiffPixelRatio: 0.002,
    });
  }
});

test('live facilitation connects verified Q&A, voting and server-clock agenda tools on desktop and mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1_280, height: 900 });
  await mockLiveRoom(page);
  let currentTimer = timer();
  let currentPoll = openPoll();
  let questionBody: Record<string, unknown> | null = null;
  let questionKey = '';
  let voteBody: Record<string, unknown> | null = null;
  let timerBody: Record<string, unknown> | null = null;
  await page.route(
    `**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/facilitation**`,
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET') {
        return fulfill(route, {
          transport: 'POLLING',
          pollingIntervalMillis: 3_000,
          serverTime: MEETING_VISUAL_NOW.toISOString(),
          sequence: 3,
          capabilities: {
            meetingLive: true,
            canAskQuestion: true,
            canVote: true,
            canModerate: true,
          },
          timer: currentTimer,
          questions: [
            {
              questionId: '75000000-0000-4000-8000-000000000001',
              state: 'OPEN',
              text: 'What is the final release gate?',
              authorDisplayName: 'Alex Lee',
              answer: null,
              upvoteCount: 2,
              upvotedByMe: false,
              mine: false,
              canModerate: true,
              version: 0,
              sequence: 1,
              createdAt: '2026-08-31T04:17:00Z',
              answeredAt: null,
            },
          ],
          polls: [currentPoll],
        });
      }
      if (path.endsWith('/questions')) {
        questionBody = request.postDataJSON() as Record<string, unknown>;
        questionKey = request.headers()['idempotency-key'] ?? '';
        return fulfill(route, {
          resource: {
            questionId: '75000000-0000-4000-8000-000000000002',
            state: 'OPEN',
            text: questionBody.text,
            authorDisplayName: 'Mina Kim',
            answer: null,
            upvoteCount: 0,
            upvotedByMe: false,
            mine: true,
            canModerate: true,
            version: 0,
            sequence: 4,
            createdAt: MEETING_VISUAL_NOW.toISOString(),
            answeredAt: null,
          },
          sequence: 4,
          serverTime: MEETING_VISUAL_NOW.toISOString(),
        });
      }
      if (path.endsWith('/vote')) {
        voteBody = request.postDataJSON() as Record<string, unknown>;
        currentPoll = openPoll(String(voteBody.optionId));
        return fulfill(route, {
          resource: currentPoll,
          sequence: 5,
          serverTime: MEETING_VISUAL_NOW.toISOString(),
        });
      }
      if (path.endsWith('/timer/start')) {
        timerBody = request.postDataJSON() as Record<string, unknown>;
        currentTimer = timer('RUNNING');
        return fulfill(route, {
          resource: currentTimer,
          sequence: 6,
          serverTime: MEETING_VISUAL_NOW.toISOString(),
        });
      }
      return fulfill(route, { reasonCode: 'UNEXPECTED_TEST_COMMAND' }, 400);
    }
  );

  await enterRoom(page);
  if (mobile) {
    const headerTargets = page.locator('.dwp-video-meeting-room__header button');
    expect(await headerTargets.count()).toBeGreaterThan(0);
    const targetSizes = await headerTargets.evaluateAll((targets) =>
      targets.map((target) => {
        const bounds = target.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      })
    );
    for (const target of targetSizes) {
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
    }
  }
  if (!mobile) {
    await expect(page.getByText('Not configured.', { exact: false })).toHaveCount(0);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ).toBeLessThanOrEqual(1);
  const roomA11y = await new AxeBuilder({ page }).include('.dwp-video-meeting-room').analyze();
  expect(
    roomA11y.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await expect(page).toHaveScreenshot(
    `meeting-u06-live-room-${mobile ? 'mobile' : 'desktop'}.png`,
    {
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      maxDiffPixelRatio: 0.002,
    }
  );
  await page
    .getByRole('button', {
      name: mobile ? 'Facilitate' : 'Open verified facilitation tools',
      exact: true,
    })
    .click();
  const drawer = page.locator('.MuiDrawer-paper');
  await expect(
    drawer.getByRole('heading', { name: 'Live facilitation', exact: true })
  ).toBeVisible();
  await expect(drawer.getByText('Verified every 3s')).toBeVisible();
  await expect(drawer.getByText('What is the final release gate?')).toBeVisible();
  await expect(drawer.getByText('Choose the release window')).toBeVisible();
  await expect(drawer.getByLabel('Poll question')).toBeHidden();

  await drawer.getByLabel('Ask a question').fill('Can we confirm the rollback owner?');
  await drawer.getByRole('button', { name: 'Submit' }).click();
  await expect.poll(() => questionBody).toEqual({ text: 'Can we confirm the rollback owner?' });
  expect(questionKey).toMatch(/^[0-9a-f-]{36}$/u);

  await drawer.getByRole('button', { name: 'Evening' }).click();
  await expect.poll(() => voteBody).toEqual({ optionId: optionEvening, expectedBallotVersion: 0 });

  await drawer.getByRole('button', { name: 'Start timebox' }).click();
  await expect.poll(() => timerBody).toEqual({ agendaItemId, expectedVersion: 0 });

  expect(
    await drawer.evaluate((element) => element.scrollWidth - element.clientWidth)
  ).toBeLessThanOrEqual(1);
  if (mobile) await expect(drawer).toHaveCSS('width', '390px');
  else expect(await drawer.evaluate((element) => element.getBoundingClientRect().width)).toBe(480);
  const a11y = await new AxeBuilder({ page }).include('.MuiDrawer-paper').analyze();
  expect(
    a11y.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await drawer.evaluate((element) => {
    for (const child of element.querySelectorAll<HTMLElement>('*')) {
      if (child.scrollHeight > child.clientHeight) child.scrollTop = 0;
    }
  });
  await expect(page).toHaveScreenshot(
    `meeting-u06-live-facilitation-${mobile ? 'mobile' : 'desktop'}.png`,
    {
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      maxDiffPixelRatio: 0.002,
    }
  );
});

test('live facilitation fails closed when its governed snapshot cannot be verified', async ({
  page,
}) => {
  await mockLiveRoom(page, true);
  await enterRoom(page);
  await page.getByRole('button', { name: 'Facilitate' }).click();
  const drawer = page.locator('.MuiDrawer-paper');

  await expect(drawer.getByText('Live facilitation is unavailable')).toBeVisible();
  await expect(drawer.getByLabel('Ask a question')).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: 'Start timebox' })).toHaveCount(0);
});

test('live room immediately removes meeting and chat content when access is revoked', async ({
  page,
}) => {
  const authorization = { revoked: false };
  await mockLiveRoom(page, false, authorization);
  await enterRoom(page);

  await page.getByRole('button', { name: 'Open meeting chat' }).click();
  await expect(page.getByText('Confidential launch dependency')).toBeVisible();

  authorization.revoked = true;
  await expect(page.getByRole('heading', { name: 'Meeting access changed' })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('.dwp-video-meeting-room')).toHaveCount(0);
  await expect(page.getByText('Confidential launch dependency')).toHaveCount(0);
});
