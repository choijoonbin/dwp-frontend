import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type {
  WorkAssignmentEvent,
  WorkAssignmentMutationResult,
  WorkAssignmentTask,
  WorkAssignmentTaskPage,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import { mockWorkHubFoundation } from './support/work-hub-foundation-fixtures';
import { fulfillSuccess } from './support/shell-session';

const assignmentBase = '/api/platform/v1/workspace/work-hub/assignments';
const ids = {
  assigned: 'a1111111-1111-4111-8111-111111111111',
  requested: 'a2222222-2222-4222-8222-222222222222',
  meeting: 'b1111111-1111-4111-8111-111111111111',
  report: 'b2222222-2222-4222-8222-222222222222',
  candidate: 'b3333333-3333-4333-8333-333333333333',
  createEvent: 'c1111111-1111-4111-8111-111111111111',
  acceptEvent: 'c2222222-2222-4222-8222-222222222222',
  createAudit: 'd1111111-1111-4111-8111-111111111111',
  acceptAudit: 'd2222222-2222-4222-8222-222222222222',
} as const;

const assignedTitle = 'Prepare the verified launch follow-up';
const requestedTitle = 'Review the requested rollout checklist';
const createdAt = '2026-09-08T01:00:00Z';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const noCapabilities = {
  canAccept: false,
  canDecline: false,
  canStart: false,
  canWait: false,
  canComplete: false,
  canReassign: false,
  canCancel: false,
};

function listSource(): WorkAssignmentTask['source'] {
  return {
    availability: 'NOT_REQUESTED',
    reference: null,
    sourceVersion: null,
    sourceRoute: null,
  };
}

function detailSource(available: boolean): WorkAssignmentTask['source'] {
  if (!available)
    return {
      availability: 'UNAVAILABLE',
      reference: null,
      sourceVersion: null,
      sourceRoute: null,
    };
  return {
    availability: 'AVAILABLE',
    reference: {
      sourceSystem: 'MEETING_FOLLOWUP',
      meetingId: ids.meeting,
      reportId: ids.report,
      candidateId: ids.candidate,
    },
    sourceVersion: 7,
    sourceRoute: `/meetings/history?meeting=${ids.meeting}&reportId=${ids.report}&candidateId=${ids.candidate}`,
  };
}

function assignedTask(sourceAvailable: boolean): WorkAssignmentTask {
  return {
    assignmentId: ids.assigned,
    createdByUserId: 2,
    assignedByUserId: 2,
    assigneeUserId: 1,
    title: assignedTitle,
    description: 'Confirm ownership before starting this follow-up.',
    priority: 'HIGH',
    dueAt: '2026-09-18T09:00:00Z',
    assignmentState: 'PENDING',
    workState: 'OPEN',
    assignmentRevision: 0,
    version: 0,
    source: detailSource(sourceAvailable),
    capabilities: { ...noCapabilities, canAccept: true, canDecline: true },
    createdAt,
    updatedAt: createdAt,
    acceptedAt: null,
    completedAt: null,
  };
}

function acceptedAssignedTask(sourceAvailable: boolean): WorkAssignmentTask {
  return {
    ...assignedTask(sourceAvailable),
    assignmentState: 'ACCEPTED',
    version: 1,
    updatedAt: '2026-09-08T02:00:00Z',
    acceptedAt: '2026-09-08T02:00:00Z',
    capabilities: {
      ...noCapabilities,
      canStart: true,
      canWait: true,
      canComplete: true,
    },
  };
}

function requestedTask(): WorkAssignmentTask {
  return {
    assignmentId: ids.requested,
    createdByUserId: 1,
    assignedByUserId: 1,
    assigneeUserId: 2,
    title: requestedTitle,
    description: 'A requester-owned assignment used to prove role filtering.',
    priority: 'NORMAL',
    dueAt: null,
    assignmentState: 'PENDING',
    workState: 'OPEN',
    assignmentRevision: 0,
    version: 0,
    source: detailSource(false),
    capabilities: { ...noCapabilities, canCancel: true },
    createdAt,
    updatedAt: createdAt,
    acceptedAt: null,
    completedAt: null,
  };
}

function fillerTask(index: number): WorkAssignmentTask {
  const suffix = String(index + 1).padStart(12, '0');
  return {
    ...assignedTask(false),
    assignmentId: `a0000000-0000-4000-8000-${suffix}`,
    title: `Assigned queue fixture ${String(index + 1).padStart(3, '0')}`,
    description: null,
    priority: 'LOW',
  };
}

function asListTask(task: WorkAssignmentTask): WorkAssignmentTask {
  return {
    ...task,
    source: listSource(),
    capabilities: { ...task.capabilities, canReassign: false },
  };
}

function eventFor(
  task: WorkAssignmentTask,
  action: WorkAssignmentEvent['action'],
  reasonCode: string | null = null
): WorkAssignmentEvent {
  const suffix = String(task.version + 1).padStart(12, '0');
  return {
    eventId: `c0000000-0000-4000-8000-${suffix}`,
    assignmentId: task.assignmentId,
    action,
    actorUserId: action === 'CREATE' ? task.createdByUserId : 1,
    assigneeUserId: task.assigneeUserId,
    assignmentState: task.assignmentState,
    workState: task.workState,
    assignmentRevision: task.assignmentRevision,
    version: task.version,
    reasonCode,
    occurredAt: `2026-09-08T${String(task.version + 1).padStart(2, '0')}:00:00Z`,
    auditRecordId: `d0000000-0000-4000-8000-${suffix}`,
  };
}

type AssignmentMockOptions = {
  sourceAvailable?: boolean;
  loseFirstAcceptResponse?: boolean;
  initiallyAccepted?: boolean;
  mode?: 'light' | 'dark';
  highContrast?: boolean;
  locale?: 'en' | 'ko';
  assignedTitle?: string;
  assignedDescription?: string;
  emptyAssignments?: boolean;
};

async function mockAssignments(page: Page, options: AssignmentMockOptions = {}) {
  const sourceAvailable = options.sourceAvailable !== false;
  const initialAssigned = options.initiallyAccepted
    ? acceptedAssignedTask(sourceAvailable)
    : assignedTask(sourceAvailable);
  initialAssigned.title = options.assignedTitle ?? initialAssigned.title;
  initialAssigned.description = options.assignedDescription ?? initialAssigned.description;
  const assignments = new Map<string, WorkAssignmentTask>([
    [ids.assigned, initialAssigned],
    [ids.requested, requestedTask()],
  ]);
  const histories = new Map<string, WorkAssignmentEvent[]>([
    [
      ids.assigned,
      [
        eventFor(
          { ...initialAssigned, assignmentState: 'PENDING', workState: 'OPEN', version: 0 },
          'CREATE'
        ),
        ...(options.initiallyAccepted ? [eventFor(initialAssigned, 'ACCEPT')] : []),
      ],
    ],
    [ids.requested, [eventFor(requestedTask(), 'CREATE')]],
  ]);
  const fillers = Array.from({ length: 100 }, (_, index) => fillerTask(index));
  const capturedPosts: Array<{
    path: string;
    body: unknown;
    idempotencyKey: string | undefined;
  }> = [];
  const listReads: Array<{ scope: string | null; page: number; size: number }> = [];
  const receipts = new Map<string, WorkAssignmentMutationResult>();
  let targetRevoked = false;
  let acceptResponseLost = false;
  let driftNextDetail = false;
  let conflictNextPost = false;

  const publish = (
    current: WorkAssignmentTask,
    operation: string,
    reasonCode: string | null
  ): WorkAssignmentTask | null => {
    const version = current.version + 1;
    const common = {
      ...current,
      version,
      updatedAt: `2026-09-08T${String(version + 1).padStart(2, '0')}:00:00Z`,
    };
    let next: WorkAssignmentTask | null = null;
    if (
      operation === 'accept' &&
      current.assignmentState === 'PENDING' &&
      current.workState === 'OPEN'
    )
      next = {
        ...common,
        assignmentState: 'ACCEPTED',
        acceptedAt: common.updatedAt,
      };
    if (
      operation === 'decline' &&
      current.assignmentState === 'PENDING' &&
      current.workState === 'OPEN' &&
      ['CAPACITY_LIMIT', 'OUTSIDE_RESPONSIBILITY'].includes(reasonCode ?? '')
    )
      next = { ...common, assignmentState: 'DECLINED' };
    if (
      operation === 'start' &&
      current.assignmentState === 'ACCEPTED' &&
      !['COMPLETED', 'CANCELLED'].includes(current.workState)
    )
      next = { ...common, workState: 'IN_PROGRESS' };
    if (
      operation === 'wait' &&
      current.assignmentState === 'ACCEPTED' &&
      !['COMPLETED', 'CANCELLED'].includes(current.workState)
    )
      next = { ...common, workState: 'WAITING' };
    if (
      operation === 'complete' &&
      current.assignmentState === 'ACCEPTED' &&
      !['COMPLETED', 'CANCELLED'].includes(current.workState)
    )
      next = { ...common, workState: 'COMPLETED', completedAt: common.updatedAt };
    if (
      operation === 'cancel' &&
      !['COMPLETED', 'CANCELLED'].includes(current.workState) &&
      ['NO_LONGER_REQUIRED', 'DUPLICATE_WORK'].includes(reasonCode ?? '')
    )
      next = { ...common, workState: 'CANCELLED' };
    if (!next) return null;
    const assignee = next.assigneeUserId === 1;
    const requester = next.createdByUserId === 1;
    const active = !['COMPLETED', 'CANCELLED'].includes(next.workState);
    next.capabilities = {
      ...noCapabilities,
      canAccept:
        assignee && active && next.assignmentState === 'PENDING' && next.workState === 'OPEN',
      canDecline:
        assignee && active && next.assignmentState === 'PENDING' && next.workState === 'OPEN',
      canStart:
        assignee &&
        active &&
        next.assignmentState === 'ACCEPTED' &&
        next.workState !== 'IN_PROGRESS',
      canWait:
        assignee && active && next.assignmentState === 'ACCEPTED' && next.workState !== 'WAITING',
      canComplete: assignee && active && next.assignmentState === 'ACCEPTED',
      canCancel: requester && active,
    };
    assignments.set(current.assignmentId, next);
    histories.get(current.assignmentId)!.push(eventFor(next, operation.toUpperCase(), reasonCode));
    return next;
  };

  await page.route('**/api/platform/v1/workspace/work-hub/assignments**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.startsWith(`${assignmentBase}/commands/`) && request.method() === 'GET') {
      const commandId = path.slice(`${assignmentBase}/commands/`.length);
      const receipt = receipts.get(commandId);
      if (!receipt)
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Command receipt not found' }),
        });
      return fulfillSuccess(route, receipt);
    }

    const eventMatch = path.match(new RegExp(`^${assignmentBase}/([^/]+)/events$`, 'u'));
    if (eventMatch && request.method() === 'GET') {
      const assignmentId = eventMatch[1]!;
      if (targetRevoked && assignmentId === ids.assigned) return route.fulfill({ status: 403 });
      const task = assignments.get(assignmentId);
      if (!task) return route.fulfill({ status: 404 });
      const all = histories.get(assignmentId) ?? [];
      const afterVersion = Number(url.searchParams.get('afterVersion') ?? -1);
      const items = all.filter((event) => event.version > afterVersion);
      return fulfillSuccess(route, {
        items,
        nextAfterVersion: items.at(-1)?.version ?? afterVersion,
        hasMore: false,
      });
    }

    if (path === assignmentBase && request.method() === 'GET') {
      const scope = url.searchParams.get('scope');
      const pageNumber = Number(url.searchParams.get('page') ?? 0);
      const size = Number(url.searchParams.get('size') ?? 100);
      listReads.push({ scope, page: pageNumber, size });
      const target = assignments.get(ids.assigned)!;
      const requested = assignments.get(ids.requested)!;
      const scoped = options.emptyAssignments
        ? []
        : scope === 'ASSIGNED_TO_ME'
          ? [...fillers, ...(targetRevoked ? [] : [target])]
          : scope === 'ASSIGNED_BY_ME'
            ? [requested]
            : [];
      const items = scoped.slice(pageNumber * size, pageNumber * size + size).map(asListTask);
      const result: WorkAssignmentTaskPage = {
        items,
        page: pageNumber,
        size,
        totalElements: scoped.length,
        hasMore: (pageNumber + 1) * size < scoped.length,
      };
      return fulfillSuccess(route, result);
    }

    const commandMatch = path.match(
      new RegExp(`^${assignmentBase}/([^/]+)/(accept|decline|start|wait|complete|cancel)$`, 'u')
    );
    if (commandMatch && request.method() === 'POST') {
      const [, assignmentId, operation] = commandMatch;
      const current = assignments.get(assignmentId!);
      const body = request.postDataJSON() as {
        version: number;
        assignmentRevision: number;
        reasonCode?: string;
      };
      const idempotencyKey = request.headers()['idempotency-key'];
      capturedPosts.push({ path, body, idempotencyKey });
      if (
        !current ||
        !idempotencyKey ||
        body.version !== current.version ||
        body.assignmentRevision !== current.assignmentRevision
      )
        return route.fulfill({ status: 409 });
      if (conflictNextPost) {
        conflictNextPost = false;
        publish(current, 'accept', null);
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Work assignment changed' }),
        });
      }
      const changed = publish(current, operation!, body.reasonCode ?? null);
      if (!changed) return route.fulfill({ status: 409 });
      const result: WorkAssignmentMutationResult = {
        assignment: changed,
        receipt: {
          commandId: idempotencyKey,
          assignmentId: assignmentId!,
          operation: operation!.toUpperCase(),
          appliedVersion: changed.version,
          appliedAssignmentRevision: changed.assignmentRevision,
          appliedAt: changed.updatedAt,
          replayed: false,
        },
      };
      receipts.set(idempotencyKey, result);
      if (operation === 'accept' && options.loseFirstAcceptResponse && !acceptResponseLost) {
        acceptResponseLost = true;
        return route.abort('failed');
      }
      return fulfillSuccess(route, result);
    }

    const detailMatch = path.match(new RegExp(`^${assignmentBase}/([^/]+)$`, 'u'));
    if (detailMatch && request.method() === 'GET') {
      const assignmentId = detailMatch[1]!;
      if (targetRevoked && assignmentId === ids.assigned) return route.fulfill({ status: 403 });
      let task = assignments.get(assignmentId);
      if (!task) return route.fulfill({ status: 404 });
      if (driftNextDetail && assignmentId === ids.assigned) {
        driftNextDetail = false;
        task = publish(task, 'accept', null);
        if (!task) return route.fulfill({ status: 409 });
      }
      return fulfillSuccess(route, task);
    }

    return route.fulfill({ status: 405 });
  });

  return {
    capturedPosts,
    listReads,
    revokeTarget() {
      targetRevoked = true;
    },
    driftBeforeNextPreflight() {
      driftNextDetail = true;
    },
    conflictOnNextPost() {
      conflictNextPost = true;
    },
  };
}

async function setup(page: Page, options: AssignmentMockOptions = {}) {
  await mockWorkHubFoundation(page, {
    personal: false,
    sourceOwned: false,
    nativeWorkspace: false,
    mode: options.mode,
    highContrast: options.highContrast,
    locale: options.locale,
  });
  return mockAssignments(page, options);
}

function assignedRoute() {
  return `/work/queue?work=${encodeURIComponent(`WORK_ASSIGNMENT:${ids.assigned}:`)}`;
}

function requestedRoute() {
  return `/work/queue?work=${encodeURIComponent(`WORK_ASSIGNMENT:${ids.requested}:`)}`;
}

async function openAssigned(page: Page) {
  await page.goto(assignedRoute());
  await expect(page.getByTestId('work-assignment-detail')).toBeVisible({ timeout: 30_000 });
}

async function confirmAccept(page: Page) {
  await page.getByRole('button', { name: 'Accept assignment', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Review before: Accept assignment' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Run reviewed command', exact: true }).click();
}

async function reviewCommand(page: Page, action: string) {
  const button = page.getByRole('button', { name: action, exact: true });
  await button.click();
  const dialog = page.getByRole(
    action === 'Decline assignment' || action === 'Cancel work' ? 'alertdialog' : 'dialog',
    { name: `Review before: ${action}` }
  );
  await expect(dialog).toBeVisible();
  return { button, dialog };
}

async function submitReviewedCommand(page: Page, action: string) {
  const review = await reviewCommand(page, action);
  await review.dialog.getByRole('button', { name: 'Run reviewed command', exact: true }).click();
  return review;
}

async function expectAssignmentAxes(page: Page, assignmentState: string, workState: string) {
  const detail = page.getByTestId('work-assignment-detail');
  await expect(detail.getByText(assignmentState, { exact: true }).first()).toBeVisible();
  await expect(detail.getByText(workState, { exact: true }).first()).toBeVisible();
}

async function expectNoSensitivePresentation(page: Page) {
  const text = await page.locator('body').innerText();
  const markup = await page.locator('body').evaluate((body) => body.outerHTML);
  for (const value of Object.values(ids)) {
    expect(text).not.toContain(value);
    expect(markup).not.toContain(value);
  }
  for (const code of [
    'CAPACITY_LIMIT',
    'OUTSIDE_RESPONSIBILITY',
    'NO_LONGER_REQUIRED',
    'DUPLICATE_WORK',
    'INTERNAL_POLICY_ALPHA',
  ]) {
    expect(text).not.toContain(code);
    expect(markup).not.toContain(code);
  }
}

async function expectLayoutAndAccessibility(page: Page, testInfo: TestInfo) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const detailButtons = page.getByTestId('work-assignment-detail').getByRole('button');
  for (let index = 0; index < (await detailButtons.count()); index += 1) {
    const button = detailButtons.nth(index);
    if (!(await button.isVisible())) continue;
    const bounds = await button.boundingBox();
    expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath(`work-assignment-${testInfo.project.name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

const evidenceDirectory = path.resolve(
  process.cwd(),
  'docs/05-features/DWP-R1-WRK-001-unified-work-execution/implementation-evidence/2026-09-08-stitch-completion/screens'
);

const evidenceLayouts = [
  { name: 'work-assignment-1440-light', width: 1440, height: 1000, mode: 'light' as const },
  {
    name: 'work-assignment-1280-200-percent',
    width: 1280,
    height: 900,
    mode: 'light' as const,
    zoom: 2,
  },
  { name: 'work-assignment-390-dark', width: 390, height: 844, mode: 'dark' as const },
  {
    name: 'work-assignment-320-forced-colors',
    width: 320,
    height: 740,
    mode: 'light' as const,
    forcedColors: true,
  },
];

test('canonical assignment deep link loads every page and preserves role and command boundaries', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const runtime = await setup(page);
  await openAssigned(page);

  await expect(page).toHaveURL(new RegExp(`work=WORK_ASSIGNMENT%3A${ids.assigned}%3A`, 'u'));
  const detail = page.getByTestId('work-assignment-detail');
  await expect(detail.getByText('Assignment state', { exact: true })).toBeVisible();
  await expect(detail.getByText('Execution state', { exact: true })).toBeVisible();
  await expect(detail.getByText('Awaiting acceptance', { exact: true }).first()).toBeVisible();
  await expect(detail.getByText('Not started', { exact: true }).first()).toBeVisible();
  await expect(detail.getByText('Requester', { exact: true })).toBeVisible();
  await expect(detail.getByText('Assignee', { exact: true })).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Review in Meetings' })).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Accept assignment' })).toBeEnabled();
  await expect(detail.getByRole('button', { name: 'Decline assignment' })).toBeEnabled();

  for (const unsupported of ['Add to today plan', 'Schedule work time', 'Ask DWAI·ON'])
    await expect(page.getByRole('button', { name: unsupported, exact: true })).toHaveCount(0);
  const targetRow = page.locator('li').filter({ hasText: assignedTitle });
  await expect(targetRow.getByRole('checkbox')).toHaveCount(0);
  await expect(targetRow.getByRole('button', { name: /today plan|schedule/iu })).toHaveCount(0);
  await expectNoSensitivePresentation(page);

  expect(runtime.listReads).toEqual(
    expect.arrayContaining([
      { scope: 'ASSIGNED_TO_ME', page: 0, size: 100 },
      { scope: 'ASSIGNED_TO_ME', page: 1, size: 100 },
      { scope: 'ASSIGNED_BY_ME', page: 0, size: 100 },
    ])
  );

  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Back to work list', exact: true }).click();
  await page.getByRole('button', { name: /^Filter and sort/u }).click();
  await page.getByRole('combobox', { name: /Assignment role/u }).click();
  await page.getByRole('option', { name: 'Requested by me', exact: true }).click();
  await expect(page.getByText(requestedTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(assignedTitle, { exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: /Assignment role/u }).click();
  await page.getByRole('option', { name: 'Assigned to me', exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Open details for ${assignedTitle}`, exact: true })
  ).toBeVisible();

  await page.goto(assignedRoute());
  await expect(page.getByTestId('work-assignment-detail')).toBeVisible();
  await expectLayoutAndAccessibility(page, testInfo);
  await page
    .getByTestId('work-assignment-detail')
    .getByRole('button', { name: 'Review in Meetings', exact: true })
    .click();
  await expect(page).toHaveURL(
    `/meetings/history?meeting=${ids.meeting}&reportId=${ids.report}&candidateId=${ids.candidate}`
  );
});

for (const layout of evidenceLayouts) {
  test(`${layout.name} renders a privacy-safe assignment evidence screen`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'One deterministic evidence image is enough.');
    test.setTimeout(120_000);
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await setup(page, {
      mode: layout.mode,
      highContrast: 'forcedColors' in layout && layout.forcedColors,
    });
    if ('forcedColors' in layout && layout.forcedColors)
      await page.emulateMedia({
        colorScheme: layout.mode,
        forcedColors: 'active',
        reducedMotion: 'reduce',
      });
    await openAssigned(page);
    if ('zoom' in layout)
      await page.evaluate((zoom) => {
        document.documentElement.style.zoom = String(zoom);
      }, layout.zoom);
    await expectNoSensitivePresentation(page);
    await mkdir(evidenceDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceDirectory, `${layout.name}.png`),
      animations: 'disabled',
    });
    await expectLayoutAndAccessibility(page, testInfo);
  });
}

test('accept sends the exact reviewed version and keeps execution not started', async ({
  page,
}) => {
  const runtime = await setup(page);
  await openAssigned(page);
  await confirmAccept(page);

  await expect(page.getByText('Assigned work change confirmed', { exact: true })).toBeVisible();
  const detail = page.getByTestId('work-assignment-detail');
  await expect(detail.getByText('Accepted', { exact: true }).first()).toBeVisible();
  await expect(detail.getByText('Not started', { exact: true }).first()).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Start work', exact: true })).toBeEnabled();
  await expect(detail.getByText('Assignment accepted', { exact: true })).toBeVisible();
  expect(runtime.capturedPosts).toHaveLength(1);
  expect(runtime.capturedPosts[0]).toMatchObject({
    path: `${assignmentBase}/${ids.assigned}/accept`,
    body: { version: 0, assignmentRevision: 0 },
  });
  expect(runtime.capturedPosts[0]!.body).toEqual({ version: 0, assignmentRevision: 0 });
  expect(runtime.capturedPosts[0]!.idempotencyKey).toMatch(uuid);
  await expectNoSensitivePresentation(page);
});

test('decline requires a policy reason and preserves the open execution state', async ({
  page,
}) => {
  const runtime = await setup(page);
  await openAssigned(page);
  const { dialog } = await reviewCommand(page, 'Decline assignment');
  const submit = dialog.getByRole('button', { name: 'Run reviewed command', exact: true });
  await submit.click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText('Choose one of the defined policy reasons.', { exact: true })
  ).toBeVisible();
  expect(runtime.capturedPosts).toHaveLength(0);
  await dialog.getByRole('combobox', { name: 'Policy reason' }).click();
  await expectNoSensitivePresentation(page);
  await page.getByRole('option', { name: 'Current capacity limit', exact: true }).click();
  await expectNoSensitivePresentation(page);
  await submit.click();

  await expect(page.getByText('Assigned work change confirmed', { exact: true })).toBeVisible();
  await expectAssignmentAxes(page, 'Declined', 'Not started');
  expect(runtime.capturedPosts).toHaveLength(1);
  expect(runtime.capturedPosts[0]).toMatchObject({
    path: `${assignmentBase}/${ids.assigned}/decline`,
    body: { version: 0, assignmentRevision: 0, reasonCode: 'CAPACITY_LIMIT' },
  });
  expect(runtime.capturedPosts[0]!.idempotencyKey).toMatch(uuid);
  await expectNoSensitivePresentation(page);
});

test('accepted work advances through start wait restart and complete with each latest version', async ({
  page,
}) => {
  const runtime = await setup(page, { initiallyAccepted: true });
  await openAssigned(page);
  await expectAssignmentAxes(page, 'Accepted', 'Not started');

  const steps = [
    { action: 'Start work', operation: 'start', version: 1, state: 'In progress' },
    {
      action: 'Wait for a response',
      operation: 'wait',
      version: 2,
      state: 'Waiting for an external response',
    },
    { action: 'Start work', operation: 'start', version: 3, state: 'In progress' },
    { action: 'Complete work', operation: 'complete', version: 4, state: 'Completed' },
  ] as const;
  for (const [index, step] of steps.entries()) {
    await submitReviewedCommand(page, step.action);
    await expectAssignmentAxes(page, 'Accepted', step.state);
    expect(runtime.capturedPosts).toHaveLength(index + 1);
    expect(runtime.capturedPosts[index]).toMatchObject({
      path: `${assignmentBase}/${ids.assigned}/${step.operation}`,
      body: { version: step.version, assignmentRevision: 0 },
    });
  }
  const commandIds = runtime.capturedPosts.map((entry) => entry.idempotencyKey);
  commandIds.forEach((commandId) => expect(commandId).toMatch(uuid));
  expect(new Set(commandIds).size).toBe(steps.length);
  await expect(
    page
      .getByTestId('work-assignment-detail')
      .getByText('No Work command is available in the current state.')
  ).toBeVisible();
  await expectNoSensitivePresentation(page);
});

test('requester can only cancel and cancellation preserves the pending assignment state', async ({
  page,
}) => {
  const runtime = await setup(page);
  await page.goto(requestedRoute());
  const detail = page.getByTestId('work-assignment-detail');
  await expect(detail).toBeVisible({ timeout: 30_000 });
  await expect(detail.getByRole('button', { name: 'Cancel work', exact: true })).toBeEnabled();
  for (const unavailable of [
    'Accept assignment',
    'Decline assignment',
    'Start work',
    'Wait for a response',
    'Complete work',
  ])
    await expect(detail.getByRole('button', { name: unavailable, exact: true })).toHaveCount(0);

  const { dialog } = await reviewCommand(page, 'Cancel work');
  const submit = dialog.getByRole('button', { name: 'Run reviewed command', exact: true });
  await submit.click();
  await expect(dialog).toBeVisible();
  expect(runtime.capturedPosts).toHaveLength(0);
  await dialog.getByRole('combobox', { name: 'Policy reason' }).click();
  await expectNoSensitivePresentation(page);
  await page.getByRole('option', { name: 'No longer required', exact: true }).click();
  await expectNoSensitivePresentation(page);
  await submit.click();

  await expectAssignmentAxes(page, 'Awaiting acceptance', 'Cancelled');
  expect(runtime.capturedPosts).toHaveLength(1);
  expect(runtime.capturedPosts[0]).toMatchObject({
    path: `${assignmentBase}/${ids.requested}/cancel`,
    body: { version: 0, assignmentRevision: 0, reasonCode: 'NO_LONGER_REQUIRED' },
  });
  expect(runtime.capturedPosts[0]!.idempotencyKey).toMatch(uuid);
});

test('preflight drift shows the latest task and sends no command', async ({ page }) => {
  const runtime = await setup(page);
  await openAssigned(page);
  runtime.driftBeforeNextPreflight();
  await submitReviewedCommand(page, 'Accept assignment');

  await expect(page.getByText('The work changed after review', { exact: true })).toBeVisible();
  await expectAssignmentAxes(page, 'Accepted', 'Not started');
  expect(runtime.capturedPosts).toHaveLength(0);
  const review = page.getByRole('button', { name: 'Review current state', exact: true });
  await expect(review).toBeVisible();
  await review.click();
  await expect(page.getByText('The work changed after review', { exact: true })).toHaveCount(0);
});

test('a 409 loads the latest state without automatically resending the command', async ({
  page,
}) => {
  const runtime = await setup(page);
  await openAssigned(page);
  runtime.conflictOnNextPost();
  await submitReviewedCommand(page, 'Accept assignment');

  await expect(page.getByText('The work changed after review', { exact: true })).toBeVisible();
  await expectAssignmentAxes(page, 'Accepted', 'Not started');
  expect(runtime.capturedPosts).toHaveLength(1);
  await page.waitForTimeout(300);
  expect(runtime.capturedPosts).toHaveLength(1);
  await expect(
    page.getByRole('button', { name: 'Review current state', exact: true })
  ).toBeVisible();
});

test('an unavailable source does not suppress Work-owned assignment commands', async ({ page }) => {
  await setup(page, { sourceAvailable: false });
  await openAssigned(page);
  const detail = page.getByTestId('work-assignment-detail');
  await expect(
    detail.getByText(
      'Source detail cannot be shown now. You can still act on the Work-owned assignment.'
    )
  ).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Review in Meetings' })).toHaveCount(0);
  await expect(detail.getByRole('button', { name: 'Accept assignment' })).toBeEnabled();
  await expect(detail.getByRole('button', { name: 'Decline assignment' })).toBeEnabled();
  await expectNoSensitivePresentation(page);
});

test('a lost accept response is recovered by receipt without sending a duplicate command', async ({
  page,
}) => {
  const runtime = await setup(page, { loseFirstAcceptResponse: true });
  await openAssigned(page);
  await confirmAccept(page);

  await expect(
    page.getByText('The command result is not confirmed yet', { exact: true })
  ).toBeVisible();
  expect(runtime.capturedPosts).toHaveLength(1);
  await page.getByRole('button', { name: 'Check existing request', exact: true }).click();
  await expect(page.getByText('Assigned work change confirmed', { exact: true })).toBeVisible();
  await expect(
    page.getByTestId('work-assignment-detail').getByText('Accepted', { exact: true }).first()
  ).toBeVisible();
  expect(runtime.capturedPosts).toHaveLength(1);
  await expectNoSensitivePresentation(page);
});

test('revoked assignment access purges the previously rendered task', async ({ page }) => {
  const runtime = await setup(page);
  await openAssigned(page);
  await expect(page.getByRole('heading', { name: assignedTitle, exact: true })).toBeVisible();
  runtime.revokeTarget();
  await page.reload();
  await expect(page.getByText(assignedTitle, { exact: true })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId('work-assignment-detail')).toHaveCount(0);
  await expectNoSensitivePresentation(page);
});

test('keyboard opens an assignment, restores the command trigger, and returns mobile focus', async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.goto('/work/queue');
  const row = page.getByRole('button', {
    name: `Open details for ${assignedTitle}`,
    exact: true,
  });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.focus();
  await expect(row).toBeFocused();
  await row.press('Enter');

  const heading = page.getByRole('heading', { name: assignedTitle, exact: true });
  await expect(heading).toBeVisible();
  if (testInfo.project.name === 'mobile') await expect(heading).toBeFocused();
  const action = page.getByRole('button', { name: 'Accept assignment', exact: true });
  await action.focus();
  await action.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Review before: Accept assignment' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(action).toBeFocused();

  if (testInfo.project.name === 'mobile') {
    const back = page.getByRole('button', { name: 'Back to work list', exact: true });
    await back.focus();
    await back.press('Enter');
    await expect(row).toBeVisible();
    await expect(row).toBeFocused();
  }
});

test('long Korean assignment and policy reason text reflows at 390px and 320px', async ({
  page,
}) => {
  const longTitle =
    '고객 전환 회의에서 확정된 후속 조치의 책임 범위와 외부 응답 대기 조건을 검토합니다';
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, {
    locale: 'ko',
    assignedTitle: longTitle,
    assignedDescription:
      '협업 부서의 확인이 늦어질 때에도 수락 상태와 수행 상태를 구분하고 정해진 정책 사유를 검토합니다.'.repeat(
        3
      ),
  });
  await openAssigned(page);
  const heading = page.getByRole('heading', { name: longTitle, exact: true });
  await expect(heading).toBeFocused();
  await expect(page.getByText('수락 대기', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '배정 거절', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: '배정 거절 전에 확인' });
  const submit = dialog.getByRole('button', { name: '검토한 명령 실행', exact: true });
  await submit.click();
  await expect(
    dialog.getByText('정해진 정책 사유를 선택해야 합니다.', { exact: true }).last()
  ).toBeVisible();
  const reason = dialog.getByRole('combobox', { name: '정책 사유' });
  await reason.focus();
  await expect(reason).toBeFocused();

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 740 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);
    expect(
      await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)
    ).toBeLessThanOrEqual(1);
    await expect(reason).toBeInViewport();
  }
  await reason.click();
  await expect(
    page.getByRole('option', { name: '현재 처리 용량 부족', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('option', { name: '담당 범위 밖의 업무', exact: true })
  ).toBeVisible();
});

test('assignment role filter remains available when the enabled source returns zero rows', async ({
  page,
}) => {
  const runtime = await setup(page, { emptyAssignments: true });
  await page.goto('/work/queue');
  await expect(page.getByText('0 results', { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: /^Filter and sort/u }).click();
  const roles = page.getByRole('combobox', { name: /Assignment role/u });
  await expect(roles).toBeVisible();
  await roles.click();
  await page.getByRole('option', { name: 'Requested by me', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Unified queue search and filters' })
      .getByText('0 results', { exact: true })
  ).toBeVisible();
  expect(runtime.listReads).toEqual(
    expect.arrayContaining([
      { scope: 'ASSIGNED_TO_ME', page: 0, size: 100 },
      { scope: 'ASSIGNED_BY_ME', page: 0, size: 100 },
    ])
  );
});
