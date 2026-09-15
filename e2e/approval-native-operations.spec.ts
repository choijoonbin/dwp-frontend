import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { fulfillSuccess, mockShellSession } from './support/shell-session';

import type {
  ApprovalIntegrationDelivery,
  ApprovalOperations,
  ApprovalTask,
} from '../libs/shared-utils/src/api/approval-management-contract';

const basePath = '/api/approvals/v1/admin/operations';
const deliveryIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
] as const;
const taskIds = [
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
] as const;
const candidatePersonId = '66666666-6666-4666-8666-666666666666';
const fallbackReceiptId = '77777777-7777-4777-8777-777777777777';
const nativeRouteKeys = new Set([
  'route.approvals.admin.operations.dead-letter.action',
  'route.approvals.admin.operations.replay.action',
  'route.approvals.admin.operations.batch-retry.action',
  'route.approvals.admin.operations.batch-dead-letter.action',
  'route.approvals.admin.operations.batch-replay.action',
  'route.approvals.admin.operations.reconcile.action',
  'route.approvals.admin.operations.task-reassign.action',
  'route.approvals.admin.operations.task-batch-reassign.action',
]);

type CommandRecord = Readonly<{
  path: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}>;

type NativeFixtureState = {
  operations: ApprovalOperations;
  operationsFailure: number;
  reads: number;
  evaluations: Array<Record<string, unknown>>;
  issuerRequests: Array<
    Readonly<{ body: Record<string, unknown>; headers: Record<string, string> }>
  >;
  commands: CommandRecord[];
  commandFailure: number;
  emptyCommandFailure: boolean;
};

function delivery(
  outboxId: string,
  eventId: string,
  status: 'FAILED' | 'DEAD'
): ApprovalIntegrationDelivery {
  const now = new Date().toISOString();
  return {
    outboxId,
    eventId,
    requestId: '88888888-8888-4888-8888-888888888888',
    eventType: `approval.operation.${eventId}`,
    status,
    attemptCount: 3,
    manualRetryCount: 0,
    version: 7,
    availableAt: now,
    publishedAt: null,
    lastError: `${eventId} downstream response ${'x'.repeat(180)}`,
    createdAt: now,
    lastRetriedAt: null,
    retryEligibility: {
      eligible: true,
      reason: 'ELIGIBLE',
      expectedVersion: 7,
      evaluatedAt: now,
    },
  };
}

function task(taskId: string, requestNumber: string): ApprovalTask {
  const now = new Date();
  return {
    taskId,
    requestId: '99999999-9999-4999-8999-999999999999',
    requestNumber,
    title: `Restore governed delivery ${requestNumber}`,
    summary: `Reassign an overdue approval without losing its current authority ${'y'.repeat(120)}`,
    workflowNameKo: '운영 복구',
    workflowNameEn: 'Operations recovery',
    stepKey: 'MANAGER_REVIEW',
    stepName: 'Manager review',
    stepSequence: 2,
    requesterName: 'Minseo Kim',
    requesterOrgName: 'Digital Workplace',
    status: 'PENDING',
    priority: 'HIGH',
    dataClassification: 'CONFIDENTIAL',
    riskScore: 72,
    submittedAt: new Date(now.getTime() - 3_600_000).toISOString(),
    dueAt: new Date(now.getTime() - 600_000).toISOString(),
    version: 3,
  };
}

function operationsFixture(): ApprovalOperations {
  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    signals: [
      {
        key: 'delivery',
        state: 'ATTENTION',
        titleKo: '전달 복구',
        titleEn: 'Delivery recovery',
        detailKo: '복구 대상 3건',
        detailEn: 'Three recovery targets',
        count: 3,
      },
      {
        key: 'sla',
        state: 'ATTENTION',
        titleKo: 'SLA 위반',
        titleEn: 'SLA breaches',
        detailKo: '재할당 대상 2건',
        detailEn: 'Two reassignment targets',
        count: 2,
      },
    ],
    breachedTasks: [task(taskIds[0], 'APR-16A-001'), task(taskIds[1], 'APR-16A-002')],
    integrationDeliveries: [
      delivery(deliveryIds[0], 'invoice-failed-1', 'FAILED'),
      delivery(deliveryIds[1], 'invoice-failed-2', 'FAILED'),
      delivery(deliveryIds[2], 'invoice-dead-3', 'DEAD'),
    ],
  };
}

function operationName(path: string) {
  if (path.endsWith('/dead-letter')) return 'DELIVERY_DEAD_LETTER';
  if (path.endsWith('/replay')) return 'DELIVERY_REPLAY';
  if (path.endsWith('/reconcile')) return 'DELIVERY_RECONCILE';
  if (path.endsWith('/retry')) return 'DELIVERY_RETRY';
  return 'TASK_REASSIGN';
}

function commandTargets(command: CommandRecord) {
  const items = Array.isArray(command.body.items)
    ? (command.body.items as Array<Record<string, unknown>>)
    : [];
  if (items.length > 0) return items;
  const targetId = command.path.match(
    /\/(?:events|tasks)\/([0-9a-f-]+)\/(?:dead-letter|replay|reassign)$/u
  )?.[1];
  return targetId
    ? [
        {
          targetId,
          expectedVersion: Number(command.headers['x-dwp-expected-object-version']),
          assigneeUserId: command.body.assigneeUserId,
        },
      ]
    : [];
}

function receipt(command: CommandRecord) {
  const targets = commandTargets(command);
  const operation = operationName(command.path);
  return {
    operationId:
      typeof command.body.operationId === 'string' ? command.body.operationId : fallbackReceiptId,
    operation,
    commandMode: targets.length > 1 || command.body.operationId ? 'BATCH' : 'SINGLE',
    actorUserId: 1,
    managementResourceSetKey: 'RS_APPROVALS',
    itemCount: targets.length,
    committedAt: new Date().toISOString(),
    items: targets.map((target) => {
      const targetId = String(target.targetId);
      const taskTarget = taskIds.includes(targetId as (typeof taskIds)[number]);
      const statusBefore = taskTarget ? 'PENDING' : targetId === deliveryIds[2] ? 'DEAD' : 'FAILED';
      return {
        targetId,
        requestId: taskTarget
          ? '99999999-9999-4999-8999-999999999999'
          : '88888888-8888-4888-8888-888888888888',
        previousVersion: Number(target.expectedVersion),
        committedVersion: Number(target.expectedVersion) + 1,
        statusBefore,
        statusAfter:
          operation === 'DELIVERY_DEAD_LETTER'
            ? 'DEAD'
            : operation === 'DELIVERY_RECONCILE'
              ? statusBefore
              : 'PENDING',
        assigneeUserId: typeof target.assigneeUserId === 'number' ? target.assigneeUserId : null,
      };
    }),
  };
}

function isNativeCommand(path: string) {
  return (
    /^\/api\/approvals\/v1\/admin\/operations\/events\/[0-9a-f-]+\/(?:dead-letter|replay)$/u.test(
      path
    ) ||
    /^\/api\/approvals\/v1\/admin\/operations\/deliveries\/(?:retry|dead-letter|replay|reconcile)$/u.test(
      path
    ) ||
    /^\/api\/approvals\/v1\/admin\/operations\/tasks(?:\/[0-9a-f-]+)?\/reassign$/u.test(path)
  );
}

async function setup(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: [],
    appearance: { mode: 'light', density: 'standard', highContrast: false, reduceMotion: true },
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    rolloutState: '111',
    decisionRevisionFormat: 'sha256',
    generatedAt: new Date().toISOString(),
    revalidateAt: new Date(Date.now() + 600_000).toISOString(),
  });
  const state: NativeFixtureState = {
    operations: operationsFixture(),
    operationsFailure: 0,
    reads: 0,
    evaluations: [],
    issuerRequests: [],
    commands: [],
    commandFailure: 0,
    emptyCommandFailure: false,
  };

  await page.route('**/api/auth/product-surface-access/evaluate', (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const routeContractKey = String(body.routeContractKey ?? '');
    if (!nativeRouteKeys.has(routeContractKey)) return route.fallback();
    state.evaluations.push(body);
    return fulfillSuccess(route, {
      decision: 'STEP_UP_REQUIRED',
      reasonCode: 'STEP_UP_REQUIRED',
      decisionRevision: authority.revision(),
      requiredAssurance: 'urn:dwp:assurance:high',
      revalidateAt: new Date(Date.now() + 600_000).toISOString(),
    });
  });
  await page.route('**/api/auth/product-surface-step-up-challenges', (route) => {
    state.issuerRequests.push({
      body: route.request().postDataJSON() as Record<string, unknown>,
      headers: route.request().headers(),
    });
    return fulfillSuccess(route, {
      state: 'ISSUED',
      challenge: 'signed-approval-native-operation',
      challengeId: fallbackReceiptId,
      decisionRevision: authority.revision(),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    });
  });
  await page.route(
    (url) => url.pathname === basePath,
    (route) => {
      state.reads += 1;
      if (state.operationsFailure) {
        return route.fulfill({
          status: state.operationsFailure,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', errorCode: 'OPERATIONS_SOURCE_UNAVAILABLE' }),
        });
      }
      return fulfillSuccess(route, state.operations);
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/delegations/candidates',
    (route) =>
      fulfillSuccess(route, [
        {
          userId: 92,
          personPublicId: candidatePersonId,
          displayName: 'Alex Operator',
          email: 'alex.operator@example.test',
          jobTitle: 'Approval operations lead',
        },
      ])
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/approvals/v1/admin/retention/'),
    (route) => route.fulfill({ status: 404, body: '' })
  );
  await page.route(
    (url) => isNativeCommand(url.pathname),
    (route) => {
      const command: CommandRecord = {
        path: new URL(route.request().url()).pathname,
        body: (route.request().postDataJSON() ?? {}) as Record<string, unknown>,
        headers: route.request().headers(),
      };
      state.commands.push(command);
      if (state.commandFailure) {
        if (state.emptyCommandFailure) {
          return route.fulfill({ status: state.commandFailure, body: '' });
        }
        return route.fulfill({
          status: state.commandFailure,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', errorCode: 'COMMAND_REJECTED' }),
        });
      }
      return fulfillSuccess(route, receipt(command));
    }
  );

  await page.goto('/approvals/admin/operations?scope=scope%3Aapprovals%3Atenant');
  await expect(page.getByRole('tab', { name: 'Event delivery', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  return { state, authority };
}

async function openBatchRetry(page: Page) {
  const targetCheckboxes = page.getByRole('checkbox', { name: /^Select approval\.operation/u });
  await expect(targetCheckboxes).toHaveCount(3);
  await targetCheckboxes.nth(0).check();
  await targetCheckboxes.nth(1).check();
  await page.getByRole('button', { name: 'Retry selected', exact: true }).click();
  const reasonDialog = page.getByRole('dialog', { name: 'Retry selected', exact: true });
  await expect(reasonDialog).toContainText('All selected targets commit together');
  await reasonDialog
    .getByRole('textbox', { name: 'Reason', exact: true })
    .fill('Retry both failed deliveries after verified downstream recovery.');
  await reasonDialog.getByRole('button', { name: 'Verify identity', exact: true }).click();
}

async function issueChallenge(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Verify this high-risk action', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Verify identity', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Confirm action', exact: true })).toBeEnabled();
  return dialog;
}

test('batch delivery recovery is atomic, step-up bound and accessible without overflow', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === 'mobile' ? 390 : 1440,
    height: 1000,
  });
  const { state, authority } = await setup(page);
  await openBatchRetry(page);
  await expect.poll(() => state.evaluations.length).toBe(1);
  const highRisk = await issueChallenge(page);

  expect(state.evaluations.at(-1)?.routeContractKey).toBe(
    'route.approvals.admin.operations.batch-retry.action'
  );
  expect(state.issuerRequests).toHaveLength(1);
  expect(state.issuerRequests[0]!.body).toMatchObject({
    commandMethod: 'POST',
    commandPath: `${basePath}/deliveries/retry`,
    targetType: 'OPERATION_BATCH',
    expectedObjectVersion: 0,
    contextScopeKey: 'scope:approvals:tenant',
    payload: {
      items: deliveryIds.slice(0, 2).map((targetId) => ({ targetId, expectedVersion: 7 })),
      reason: 'Retry both failed deliveries after verified downstream recovery.',
    },
  });

  await highRisk.getByRole('button', { name: 'Confirm action', exact: true }).click();
  await expect.poll(() => state.commands.length).toBe(1);
  const command = state.commands[0]!;
  expect(command.path).toBe(`${basePath}/deliveries/retry`);
  expect(command.body).toEqual(state.issuerRequests[0]!.body.payload);
  expect(command.headers['x-dwp-expected-object-version']).toBe('0');
  expect(command.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
  expect(command.headers['x-dwp-step-up-challenge']).toBe('signed-approval-native-operation');
  expect(command.headers['idempotency-key']).toBe(state.issuerRequests[0]!.body.idempotencyKey);
  await expect(highRisk).toHaveCount(0);

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('single delivery inspector exposes only status-valid recovery actions', async ({ page }) => {
  await setup(page);
  const detail = page.getByRole('heading', {
    name: 'approval.operation.invoice-failed-1',
    exact: true,
  });
  await expect(detail).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Move to dead-letter', exact: true })
  ).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Replay selected', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Reconcile delivery state', exact: true })
  ).toBeEnabled();

  await page.getByRole('button').filter({ hasText: 'invoice-dead-3' }).click();
  await expect(
    page.getByRole('button', { name: 'Move to dead-letter', exact: true })
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Replay selected', exact: true })).toBeEnabled();
});

test('bulk task reassignment binds canonical person identity and exact target versions', async ({
  page,
}) => {
  const { state } = await setup(page);
  await page.getByRole('tab', { name: 'Overdue decisions', exact: true }).click();
  const taskCheckboxes = page.getByRole('checkbox', { name: /^Select Restore governed delivery/u });
  await expect(taskCheckboxes).toHaveCount(2);
  await taskCheckboxes.nth(0).check();
  await taskCheckboxes.nth(1).check();
  await page.getByRole('button', { name: 'Reassign task', exact: true }).first().click();
  const reasonDialog = page.getByRole('dialog', { name: 'Reassign task', exact: true });
  const delegate = reasonDialog.getByRole('combobox', { name: 'Delegate', exact: true });
  await delegate.fill('Alex');
  await page.getByRole('option', { name: /Alex Operator/u }).click();
  await reasonDialog
    .getByRole('textbox', { name: 'Reason', exact: true })
    .fill('Reassign both overdue decisions to the active operations lead.');
  await reasonDialog.getByRole('button', { name: 'Verify identity', exact: true }).click();
  const highRisk = await issueChallenge(page);
  expect(state.evaluations.at(-1)?.routeContractKey).toBe(
    'route.approvals.admin.operations.task-batch-reassign.action'
  );
  expect(state.issuerRequests[0]!.body).toMatchObject({
    commandPath: `${basePath}/tasks/reassign`,
    targetType: 'OPERATION_BATCH',
    expectedObjectVersion: 0,
    payload: {
      items: taskIds.map((targetId) => ({
        targetId,
        expectedVersion: 3,
        assigneeUserId: 92,
        assigneePersonPublicId: candidatePersonId,
      })),
    },
  });
  await highRisk.getByRole('button', { name: 'Confirm action', exact: true }).click();
  await expect.poll(() => state.commands.length).toBe(1);
  expect(state.commands[0]!.path).toBe(`${basePath}/tasks/reassign`);
  expect(state.commands[0]!.body).toEqual(state.issuerRequests[0]!.body.payload);
});

for (const status of [403, 409, 422, 503]) {
  test(`first native command HTTP ${status} sends exactly one POST and never auto-replays`, async ({
    page,
  }) => {
    const { state } = await setup(page);
    state.commandFailure = status;
    state.emptyCommandFailure = status === 403;
    await openBatchRetry(page);
    const highRisk = await issueChallenge(page);
    await highRisk.getByRole('button', { name: 'Confirm action', exact: true }).click();
    await expect.poll(() => state.commands.length).toBe(1);
    await page.waitForTimeout(500);
    expect(state.commands).toHaveLength(1);
  });
}

test('first operations source failure cancels an armed command and sends zero POST', async ({
  page,
}) => {
  await page.clock.install({ time: new Date() });
  const { state } = await setup(page);
  await openBatchRetry(page);
  const highRisk = await issueChallenge(page);
  state.operationsFailure = 503;
  const reads = state.reads;
  await page.clock.fastForward(30_001);
  await expect.poll(() => state.reads).toBe(reads + 1);
  await expect(
    page.getByText('Approval operations could not be loaded.', { exact: true })
  ).toBeVisible();
  await expect(highRisk).toHaveCount(0);
  expect(state.commands).toHaveLength(0);
});

test('native operation dialogs remain usable at 320px and 200 percent text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await setup(page);
  await page.evaluate(() => {
    const current = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    document.documentElement.style.setProperty('font-size', `${current * 2}px`, 'important');
  });
  await page
    .getByRole('checkbox', { name: /^Select approval\.operation/u })
    .first()
    .check();
  await page.getByRole('button', { name: 'Move to dead-letter', exact: true }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Move to dead-letter', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Reason', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    []
  );
});
