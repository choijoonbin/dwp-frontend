import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import type { WorkAssignmentTask } from '../libs/shared-utils/src/api/work-assignment-contracts';
import { mockShellSession } from './support/shell-session';

const id = '99000000-0000-4000-8000-000000000901';
const reportId = '99000000-0000-4000-8000-000000000902';
const path = '/meetings/follow-ups';
const base = '/api/platform/v1/workspace/work-hub/assignments';
const task: WorkAssignmentTask = {
  assignmentId: id,
  createdByUserId: 42,
  assignedByUserId: 42,
  assigneeUserId: 42,
  title: 'Publish release checklist',
  description: 'Verify the rollout checklist and publish the human-confirmed owner handoff.',
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
      meetingId: id,
      reportId,
      candidateId: '99000000-0000-4000-8000-000000000903',
    },
    sourceVersion: 7,
    sourceRoute: 'https://untrusted.example/ignored',
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
function fulfill(route: Route, data: unknown, status = 200) {
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
async function setup(
  page: Page,
  options: {
    dark?: boolean;
    sourceUnavailable?: boolean;
    readonly?: boolean;
    conflict?: boolean;
    lostResponse?: boolean;
    candidates?: boolean;
    locale?: 'en' | 'ko';
  } = {}
) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 42,
    locale: options.locale ?? 'en',
    displayName: 'Mina Kim',
    permissions: ['APP.MEETINGS', 'APP.WORK'].flatMap((resourceKey) =>
      ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
        resourceType: 'APP',
        resourceKey,
        permissionCode,
        effect: 'ALLOW' as const,
      }))
    ),
    appearance: { mode: options.dark ? 'dark' : 'light', density: 'standard', reduceMotion: true },
  });
  await page.emulateMedia({
    reducedMotion: 'reduce',
    colorScheme: options.dark ? 'dark' : 'light',
  });
  const state = {
    current: structuredClone(task),
    listCalls: [] as string[],
    detailCalls: 0,
    detailIds: [] as string[],
    commands: [] as {
      action: string;
      body: { version: number; assignmentRevision: number; reasonCode?: string };
      key: string;
    }[],
    createCommands: [] as {
      body: { source: unknown; expectedSourceVersion: number };
      key: string;
    }[],
    createdCandidate: null as WorkAssignmentTask | null,
    receipt: null as unknown,
    receiptCalls: [] as string[],
    revoked: false,
    conflict: options.conflict ?? false,
    lostResponse: options.lostResponse ?? false,
    hold: false,
    release: null as null | (() => Promise<void>),
  };
  if (options.sourceUnavailable)
    state.current.source = {
      availability: 'UNAVAILABLE',
      reference: null,
      sourceVersion: null,
      sourceRoute: null,
    };
  if (options.readonly)
    state.current.capabilities = {
      canAccept: false,
      canDecline: false,
      canStart: false,
      canWait: false,
      canComplete: false,
      canReassign: false,
      canCancel: false,
    };
  await page.route('**/api/meetings/v1/home*', (route) =>
    fulfill(route, {
      serverNow: '2026-09-04T02:00:00Z',
      timeZone: 'Asia/Seoul',
      capabilities: {},
      activeMeeting: null,
      nextMeeting: null,
      today: [],
      recent: options.candidates
        ? [
            {
              meetingId: id,
              title: 'Release planning',
              description: null,
              agenda: null,
              lifecycleState: 'ENDED',
              accessScope: 'INVITED',
              meetingCode: 'ABCD-EFGH-JKMN',
              startsAt: '2026-09-04T00:00:00Z',
              endsAt: '2026-09-04T01:00:00Z',
              durationMinutes: 60,
              timeZone: 'Asia/Seoul',
              organizerUserId: 42,
              organizerName: 'Mina Kim',
              waitingRoomEnabled: true,
              allowJoinBeforeHost: false,
              defaultMicrophoneEnabled: false,
              defaultCameraEnabled: false,
              attendeeCount: 3,
              participantRole: 'ORGANIZER',
              canHost: true,
              canModerate: true,
              version: 2,
            },
          ]
        : [],
      metrics: { meetingsToday: 0, meetingMinutesToday: 0, waitingForApproval: 0 },
    })
  );
  await page.route(
    `**/api/meetings/v1/meetings/${id}/intelligence/reports/latest-published`,
    (route) =>
      fulfill(route, {
        reportId,
        meetingId: id,
        runId: '99000000-0000-4000-8000-000000000904',
        state: 'PUBLISHED',
        audience: 'MEETING_PARTICIPANTS',
        schemaVersion: 'meeting-intelligence-v1',
        retentionUntil: '2026-10-04T00:00:00Z',
        legalHold: false,
        publishedAt: '2026-09-04T01:30:00Z',
        version: 7,
        canCurrentViewerReview: false,
        reviews: [],
        analysis: {
          executiveSummary: { text: 'Published recap', citations: [] },
          topics: [],
          decisions: [],
          openQuestions: [],
          risks: [],
          actionItems: [{ text: 'Publish release checklist', citations: [] }],
          conversationClimate: { label: 'ALIGNED', signals: [], citations: [] },
        },
        followUpCandidates: [
          {
            candidateId: '99000000-0000-4000-8000-000000000903',
            sourceVersion: 7,
            actionItemIndex: 0,
          },
        ],
      })
  );
  await page.route('**/api/platform/v1/workspace/work-hub/assignments**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname === base) {
      state.listCalls.push(url.searchParams.get('scope') ?? '');
      return fulfill(
        route,
        state.revoked
          ? null
          : {
              items: [state.current],
              page: Number(url.searchParams.get('page')),
              size: Number(url.searchParams.get('size')),
              totalElements: 1,
              hasMore: false,
            },
        state.revoked ? 403 : 200
      );
    }
    if (request.method() === 'GET' && url.pathname === `${base}/${id}`) {
      state.detailCalls += 1;
      state.detailIds.push(id);
      return fulfill(route, state.revoked ? null : state.current, state.revoked ? 403 : 200);
    }
    if (request.method() === 'GET' && url.pathname.startsWith(`${base}/commands/`)) {
      state.receiptCalls.push(url.pathname.split('/').at(-1)!);
      return fulfill(route, { assignment: state.current, receipt: state.receipt });
    }
    if (request.method() === 'GET' && url.pathname === `${base}/by-source`) {
      return state.createdCandidate
        ? fulfill(route, state.createdCandidate)
        : fulfill(route, null, 404);
    }
    if (request.method() === 'POST' && url.pathname === base) {
      const body = request.postDataJSON();
      const key = request.headers()['idempotency-key'];
      state.createCommands.push({ body, key });
      state.createdCandidate = {
        ...structuredClone(task),
        createdByUserId: 42,
        assignedByUserId: 42,
        assigneeUserId: 42,
        title: 'Publish release checklist',
        description: null,
        priority: 'NORMAL',
        source: {
          availability: 'AVAILABLE',
          reference: body.source,
          sourceVersion: body.expectedSourceVersion,
          sourceRoute: '/meetings/follow-ups',
        },
      };
      return fulfill(route, {
        assignment: state.createdCandidate,
        receipt: {
          assignmentId: state.createdCandidate.assignmentId,
          commandId: key,
          operation: 'CREATE',
          appliedVersion: state.createdCandidate.version,
          appliedAssignmentRevision: state.createdCandidate.assignmentRevision,
          appliedAt: '2026-09-04T02:00:00Z',
          replayed: false,
        },
      });
    }
    const action = url.pathname.split('/').at(-1)!;
    if (
      request.method() === 'POST' &&
      ['accept', 'decline', 'start', 'wait', 'complete', 'cancel'].includes(action)
    ) {
      const body = request.postDataJSON();
      const key = request.headers()['idempotency-key'];
      state.commands.push({ action, body, key });
      if (state.conflict) {
        state.conflict = false;
        state.current.version = 8;
        return fulfill(route, null, 409);
      }
      state.current.version = body.version + 1;
      if (action === 'accept') {
        state.current.assignmentState = 'ACCEPTED';
        state.current.capabilities = {
          ...state.current.capabilities,
          canAccept: false,
          canDecline: false,
          canStart: true,
          canWait: true,
          canComplete: true,
        };
      }
      if (action === 'start') {
        state.current.workState = 'IN_PROGRESS';
        state.current.capabilities.canStart = false;
      }
      if (action === 'decline') {
        state.current.assignmentState = 'DECLINED';
        state.current.capabilities.canAccept = false;
        state.current.capabilities.canDecline = false;
      }
      if (action === 'cancel') {
        state.current.workState = 'CANCELLED';
      }
      state.receipt = {
        assignmentId: id,
        commandId: key,
        operation: action.toUpperCase(),
        appliedVersion: state.current.version,
        appliedAssignmentRevision: body.assignmentRevision,
        appliedAt: '2026-09-04T02:00:00Z',
        replayed: false,
      };
      const payload = { assignment: structuredClone(state.current), receipt: state.receipt };
      if (state.hold) {
        state.release = () => fulfill(route, payload);
        return;
      }
      if (state.lostResponse) {
        state.lostResponse = false;
        return route.abort('connectionfailed');
      }
      return fulfill(route, payload);
    }
    return fulfill(route, null, 501);
  });
  await page.goto(path);
  const korean = options.locale === 'ko';
  await expect(
    page.getByRole('heading', {
      name: korean ? '내 후속 업무' : 'My follow-up work',
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByRole('region', {
      name: korean ? '정본 후속 업무 요약' : 'Authoritative follow-up work summary',
      exact: true,
    })
  ).toBeVisible();
  await expect(page.getByTestId('follow-up-row-' + id)).toBeVisible();
  return state;
}
async function detail(page: Page) {
  await page.getByTestId('follow-up-row-' + id).click();
  await expect(page.getByRole('heading', { name: 'Work detail', exact: true })).toBeVisible();
  await expect(
    page
      .getByTestId('meeting-follow-up-detail')
      .getByRole('heading', { name: task.title, exact: true })
  ).toBeVisible();
}
async function command(page: Page, label: string) {
  await page
    .getByTestId('meeting-follow-up-detail')
    .getByRole('button', { name: label, exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm and apply', exact: true }).click();
}

test.describe('Meeting follow-up canonical Work consumer', () => {
  test('selects only one source, keeps acceptance separate, and performs a version-bound start', async ({
    page,
  }) => {
    const state = await setup(page, { sourceUnavailable: true });
    expect(state.detailCalls).toBe(0);
    await detail(page);
    // Dev StrictMode can remount the selected query. It must never inspect other rows.
    expect(new Set(state.detailIds)).toEqual(new Set([id]));
    await expect(page.getByRole('button', { name: 'View linked report' })).toHaveCount(0);
    await expect(
      page
        .getByTestId('meeting-follow-up-detail')
        .getByRole('button', { name: 'Start', exact: true })
    ).toHaveCount(0);
    await expect(page).toHaveScreenshot('meeting-u09-follow-ups.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });
    await command(page, 'Accept');
    await expect(page.getByText('Command application confirmed')).toBeVisible();
    expect(state.current.workState).toBe('OPEN');
    await command(page, 'Start');
    await expect.poll(() => state.commands.length).toBe(2);
    expect(state.commands.map(({ action, body }) => ({ action, body }))).toEqual([
      { action: 'accept', body: { version: 3, assignmentRevision: 1 } },
      { action: 'start', body: { version: 4, assignmentRevision: 1 } },
    ]);
    expect(state.commands[0].key).toMatch(/^[0-9a-f-]{36}$/u);
  });
  test('recovers a lost response through the exact command receipt without a second mutation', async ({
    page,
  }) => {
    const state = await setup(page, { lostResponse: true });
    await detail(page);
    await command(page, 'Accept');
    await expect(page.getByText('The command result is not yet confirmed')).toBeVisible();
    await page.getByRole('button', { name: 'Check original command result', exact: true }).click();
    await expect(page.getByText('Command application confirmed')).toBeVisible();
    expect(state.commands).toHaveLength(1);
    expect(state.receiptCalls).toEqual([state.commands[0].key]);
  });
  test('requires current-version review after conflict and a selected reason for destructive commands', async ({
    page,
  }) => {
    const state = await setup(page, { conflict: true });
    await detail(page);
    await command(page, 'Accept');
    await expect(page.getByText('The work changed', { exact: true })).toBeVisible();
    await expect(
      page
        .getByTestId('meeting-follow-up-detail')
        .getByRole('button', { name: 'Accept', exact: true })
    ).toBeDisabled();
    await page.getByRole('button', { name: 'I reviewed the latest work' }).click();
    await page
      .getByTestId('meeting-follow-up-detail')
      .getByRole('button', { name: 'Decline', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirm and apply' }).click();
    expect(state.commands).toHaveLength(1);
    await page.getByRole('combobox', { name: 'Reason', exact: true }).click();
    await page.getByRole('option', { name: 'Insufficient capacity' }).click();
    await page.getByRole('button', { name: 'Confirm and apply' }).click();
    await expect.poll(() => state.commands.length).toBe(2);
    expect(state.commands[1].body).toEqual({
      version: 8,
      assignmentRevision: 1,
      reasonCode: 'CAPACITY_LIMIT',
    });
  });
  test('clears task text on authority revocation and ignores a late successful command', async ({
    page,
  }) => {
    const state = await setup(page);
    await detail(page);
    state.hold = true;
    await command(page, 'Accept');
    await expect.poll(() => Boolean(state.release)).toBe(true);
    state.revoked = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByText('Follow-up work is not accessible', { exact: true })).toBeVisible();
    await state.release!();
    await expect(page.getByText(task.title, { exact: true })).toHaveCount(0);
    await expect(page.getByText('Command application confirmed')).toHaveCount(0);
  });
  test('separates scopes and keeps candidate promotion closed without current authority', async ({
    page,
  }) => {
    const state = await setup(page, { candidates: true });
    await detail(page);
    await page.getByRole('tab', { name: 'Requested by me', exact: true }).click();
    await expect.poll(() => state.listCalls.at(-1)).toBe('ASSIGNED_BY_ME');
    await expect(page.getByTestId('meeting-follow-up-detail')).toHaveCount(0);
    const reads = state.listCalls.length;
    await page.getByRole('tab', { name: 'AI candidates', exact: true }).click();
    await expect(page.getByText('Confirmed AI follow-up candidates')).toBeVisible();
    await expect(page.getByText('Work creation is not available yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create work from candidate' })).toBeDisabled();
    await page.getByRole('button', { name: 'Review candidate', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Candidate review', exact: true })
    ).toBeVisible();
    await expect(page.getByText('Published source', { exact: true })).toBeVisible();
    await expect(page.getByText('Expected impact', { exact: true })).toBeVisible();
    expect(state.createCommands).toHaveLength(0);
    expect(state.listCalls).toHaveLength(reads);
    expect(state.commands).toHaveLength(0);
  });
  test('keeps authority-blocked candidate review legible at approved desktop and mobile widths', async ({
    page,
  }, testInfo) => {
    const widths = testInfo.project.name === 'mobile' ? [390, 320] : [1280];
    await page.setViewportSize({
      width: widths[0],
      height: testInfo.project.name === 'mobile' ? 844 : 900,
    });
    const state = await setup(page, { candidates: true });
    await page.getByRole('tab', { name: 'AI candidates', exact: true }).click();
    await expect(page.getByText('Confirmed AI follow-up candidates')).toBeVisible();
    await expect(page.getByText('Work creation is not available yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create work from candidate' })).toBeDisabled();

    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
      await expect(page.getByTestId('meeting-follow-up-candidates')).toBeVisible();
      if (width === 320) {
        const activeTab = await page
          .getByRole('tab', { name: 'AI candidates', exact: true })
          .boundingBox();
        const tabViewport = await page.locator('.MuiTabs-scroller').boundingBox();
        expect(activeTab).not.toBeNull();
        expect(tabViewport).not.toBeNull();
        expect(activeTab!.x).toBeGreaterThanOrEqual(tabViewport!.x - 1);
        expect(activeTab!.x + activeTab!.width).toBeLessThanOrEqual(
          tabViewport!.x + tabViewport!.width + 1
        );
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false
      );
      const issues = await new AxeBuilder({ page })
        .include('[data-testid="meeting-follow-up-candidates"]')
        .analyze();
      expect(
        issues.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')
      ).toEqual([]);
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await expect(page).toHaveScreenshot(`meeting-u09-candidates-authority-blocked-${width}.png`, {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        maxDiffPixelRatio: 0.002,
      });
      await page.getByRole('button', { name: 'Review candidate', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Candidate review', exact: true })
      ).toBeVisible();
      await expect(page.getByText('Published source', { exact: true })).toBeVisible();
      await expect(page.getByText('Expected impact', { exact: true })).toBeVisible();
      const reviewIssues = await new AxeBuilder({ page })
        .include('[data-testid="meeting-follow-up-candidate-review"]')
        .analyze();
      expect(
        reviewIssues.violations.filter(
          ({ impact }) => impact === 'critical' || impact === 'serious'
        )
      ).toEqual([]);
      await expect(page).toHaveScreenshot(
        `meeting-u09-candidate-review-authority-blocked-${width}.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
          maxDiffPixelRatio: 0.002,
        }
      );
      await page.getByRole('button', { name: 'Close review', exact: true }).click();
      await expect(page.getByTestId('meeting-follow-up-candidate-review')).toHaveCount(0);
    }
    expect(state.createCommands).toHaveLength(0);
  });
  test('preserves the approved Korean candidate hierarchy without implying creation authority', async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.name === 'mobile' ? 390 : 1280;
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    const state = await setup(page, { candidates: true, locale: 'ko' });
    await page.getByRole('tab', { name: 'AI 업무 후보', exact: true }).click();
    await expect(page.getByText('확정된 AI 후속 작업 후보')).toBeVisible();
    await expect(page.getByText('아직 업무를 생성할 수 없습니다')).toBeVisible();
    await expect(page.getByRole('button', { name: '후보를 업무로 만들기' })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false
    );
    const issues = await new AxeBuilder({ page })
      .include('[data-testid="meeting-follow-up-candidates"]')
      .analyze();
    expect(
      issues.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')
    ).toEqual([]);
    await expect(page).toHaveScreenshot(
      `meeting-u09-candidates-authority-blocked-ko-${width}.png`,
      {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        maxDiffPixelRatio: 0.002,
      }
    );
    expect(state.createCommands).toHaveLength(0);
  });
  test('keeps 320px dark mode readable with keyboard focus, no overflow, and no serious accessibility violations', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await setup(page, { dark: true, readonly: true });
    await detail(page);
    await expect(page.getByText('No work action is currently available.')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open in Work app', exact: true })
    ).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false
    );
    const close = page.getByRole('button', { name: 'Close work detail', exact: true });
    await close.focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
    await close.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('meeting-follow-up-detail')).toHaveCount(0);
    await detail(page);
    const issues = await new AxeBuilder({ page })
      .include('[data-testid="meeting-follow-ups"]')
      .analyze();
    expect(
      issues.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')
    ).toEqual([]);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('follow-ups-320-dark.png'), fullPage: true });
  });
});
