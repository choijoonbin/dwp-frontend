import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

const MAIL_PERMISSIONS = [
  ...['VIEW', 'UPDATE'].map((permissionCode) => ({
    resourceType: 'APP',
    resourceKey: 'APP.MAIL',
    permissionCode,
    effect: 'ALLOW' as const,
  })),
  ...['VIEW', 'CREATE'].map((permissionCode) => ({
    resourceType: 'APP',
    resourceKey: 'APP.CALENDAR',
    permissionCode,
    effect: 'ALLOW' as const,
  })),
];

const calendarProposal = proposal({
  proposalId: '50000000-0000-4000-8000-000000000001',
  type: 'CREATE_CALENDAR_EVENT',
  title: 'Schedule the customer renewal review',
  summary: 'The sender proposed a review window with the account team.',
  evidence: [{ label: 'Sarah Jenkins renewal message' }],
  proposedPayload: {
    startsAt: '2026-09-10T06:00:00Z',
    durationMinutes: 60,
    timeZone: 'Asia/Seoul',
    location: 'Meeting room 4A',
    attendees: ['sarah@example.com', 'mina@example.com'],
    requiresConfirmation: true,
  },
  confidence: 0.98,
  riskLevel: 'MEDIUM',
  requiredResourceKey: 'APP.CALENDAR',
  requiredPermissionCode: 'CREATE',
  targetRoute: '/calendar/schedule?action=create',
});

const taskProposal = proposal({
  proposalId: '50000000-0000-4000-8000-000000000002',
  type: 'CREATE_TASK',
  title: 'Create a renewal follow-up task',
  summary: 'Track the contractual review as a governed work item.',
  evidence: [{ label: 'Enterprise License Agreement thread' }],
  proposedPayload: {
    provider: 'Jira',
    projectKey: 'DWP',
    assigneeName: 'Mina Kim',
    dueAt: '2026-09-12T09:00:00Z',
    priority: 'HIGH',
    requiresConfirmation: true,
  },
  confidence: 0.94,
  riskLevel: 'MEDIUM',
  requiredResourceKey: 'APP.WORK',
  requiredPermissionCode: 'UPDATE',
  targetRoute: '/work?action=create',
});

const draftProposal = proposal({
  proposalId: '50000000-0000-4000-8000-000000000003',
  type: 'DRAFT_REPLY',
  title: 'Review a prepared customer reply',
  summary: 'A concise response is ready for your edits and final send decision.',
  evidence: [{ label: 'CX Desk escalation message' }],
  proposedPayload: {
    tone: 'PROFESSIONAL',
    language: 'ENGLISH',
    requiresConfirmation: true,
  },
  confidence: 0.91,
  riskLevel: 'LOW',
  requiredResourceKey: 'APP.MAIL',
  requiredPermissionCode: 'CREATE',
  targetRoute: '/mail/inbox?compose=open',
});

const leaveProposal = proposal({
  proposalId: '50000000-0000-4000-8000-000000000004',
  type: 'CREATE_LEAVE_REQUEST',
  title: 'Prepare a leave request',
  summary: 'The requested dates can be reviewed in the HR app.',
  evidence: [{ label: 'People Operations follow-up' }],
  proposedPayload: {
    startsOn: '2026-09-14',
    endsOn: '2026-09-14',
    durationDays: 1,
    requiresConfirmation: true,
  },
  confidence: 0.87,
  riskLevel: 'HIGH',
  requiredResourceKey: 'APP.HCM',
  requiredPermissionCode: 'VIEW',
  targetRoute: '/hr/leave?action=create',
});

const notificationProposal = proposal({
  proposalId: '50000000-0000-4000-8000-000000000005',
  type: 'ESCALATE_NOTIFICATION',
  title: 'Escalate an expiring secure link',
  summary: 'A time-sensitive notification is ready for review.',
  evidence: [{ label: 'Security Operations message' }],
  proposedPayload: {
    channel: 'IN_APP',
    urgency: 'HIGH',
    requiresConfirmation: true,
  },
  confidence: 0.96,
  riskLevel: 'LOW',
  requiredResourceKey: 'APP.MAIL',
  requiredPermissionCode: 'UPDATE',
  targetRoute: '/mail/inbox?lane=URGENT',
});

test('mail home presents governed action proposals as compact contextual workflows', async ({
  page,
}) => {
  await mockMailProposalHome(page);

  await page.goto('/mail/home');
  await expect(page.getByText('5 recent proposals shown from 8 pending proposals.')).toBeVisible();

  const calendarCard = page.getByTestId('mail-proposal-CREATE_CALENDAR_EVENT');
  await expect(calendarCard.getByText('Calendar event')).toBeVisible();
  await expect(calendarCard.getByText('Meeting room 4A')).toBeVisible();
  await expect(calendarCard.getByText('About 60 minutes')).toBeVisible();
  await expect(calendarCard.getByText('98% match')).toBeVisible();

  const taskCard = page.getByTestId('mail-proposal-CREATE_TASK');
  await expect(taskCard.getByText('Work item', { exact: true })).toBeVisible();
  await expect(taskCard.getByText('Jira')).toBeVisible();
  await expect(taskCard.getByText('DWP', { exact: true })).toBeVisible();

  const draftCard = page.getByTestId('mail-proposal-DRAFT_REPLY');
  await expect(draftCard.getByText('Email reply draft')).toBeVisible();
  await expect(draftCard.getByText('Professional')).toBeVisible();

  await expect(page.getByTestId('mail-proposal-CREATE_LEAVE_REQUEST')).toBeHidden();
  await expect(page.getByTestId('mail-proposal-ESCALATE_NOTIFICATION')).toBeHidden();
  await page.getByRole('button', { name: 'Show 2 more proposals' }).click();
  await expect(page.getByTestId('mail-proposal-CREATE_LEAVE_REQUEST')).toBeVisible();
  await expect(page.getByTestId('mail-proposal-ESCALATE_NOTIFICATION')).toBeVisible();
  await page.getByRole('button', { name: 'Show fewer proposals' }).click();
  await expect(page.getByTestId('mail-proposal-CREATE_LEAVE_REQUEST')).toBeHidden();

  await calendarCard.getByRole('button', { name: 'Review and continue' }).click();
  const dialog = page.getByRole('dialog', { name: 'Schedule the customer renewal review' });
  await expect(dialog).toContainText('This step does not create or send business data.');
  await expect(dialog).toContainText('Calendar');
  await expect(dialog).toContainText('Evidence items reviewed: 1');
  await expect(dialog.getByRole('button', { name: 'Approve and open calendar' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(calendarCard).toBeVisible();
  await expect
    .poll(async () => {
      const bounds = await calendarCard.boundingBox();
      return Boolean(bounds && bounds.x >= -1 && bounds.x + bounds.width <= 321);
    })
    .toBe(true);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('accepting a proposal records the decision before opening the target app', async ({
  page,
}) => {
  await mockMailProposalHome(page);
  let decision: unknown;
  await page.route('**/api/platform/v1/mail/proposals/*/decision', async (route) => {
    decision = route.request().postDataJSON();
    await fulfill(route, { ...calendarProposal, status: 'ACCEPTED', version: 3 });
  });

  await page.goto('/mail/home');
  const calendarCard = page.getByTestId('mail-proposal-CREATE_CALENDAR_EVENT');
  await calendarCard.getByRole('button', { name: 'Review and continue' }).click();
  await page.getByRole('button', { name: 'Approve and open calendar' }).click();

  await expect.poll(() => decision).toEqual({ decision: 'ACCEPT', version: 2 });
  await expect(page).toHaveURL(/\/calendar\/schedule\?action=create$/u);
});

test('mail home retains work context across themes, reflow, and reduced motion', async ({
  page,
}, testInfo) => {
  const scenarios =
    testInfo.project.name === 'mobile'
      ? ([
          { width: 390, mode: 'light', contrast: false },
          { width: 320, mode: 'dark', contrast: false },
          { width: 320, mode: 'light', contrast: true },
        ] as const)
      : ([
          { width: 1440, mode: 'light', contrast: false },
          { width: 1280, mode: 'dark', contrast: false },
          { width: 720, mode: 'light', contrast: false },
        ] as const);
  for (const scenario of scenarios) {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await page.emulateMedia({
      colorScheme: scenario.mode,
      forcedColors: scenario.contrast ? 'active' : 'none',
      reducedMotion: 'reduce',
    });
    await mockMailProposalHome(page, scenario.mode, scenario.contrast);
    await page.goto('/mail/home');
    const card = page.getByTestId('mail-proposal-CREATE_CALENDAR_EVENT');
    await expect(card.getByRole('heading')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      )
      .toBeLessThanOrEqual(1);
    const accessibility = await new AxeBuilder({ page }).include('main').analyze();
    expect(
      accessibility.violations.filter(
        (item) => item.impact === 'critical' || item.impact === 'serious'
      )
    ).toEqual([]);
    await expect
      .poll(() =>
        card.evaluate((element) =>
          Math.max(
            ...getComputedStyle(element).transitionDuration.split(',').map(Number.parseFloat)
          )
        )
      )
      .toBeLessThanOrEqual(0.001);
    await testInfo.attach(
      `mail-home-${scenario.width}-${scenario.mode}-${scenario.contrast ? 'contrast' : 'standard'}`,
      {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      }
    );
  }
});

async function mockMailProposalHome(
  page: Page,
  mode: 'light' | 'dark' = 'light',
  highContrast = false
) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    email: 'mina.kim@example.com',
    permissions: MAIL_PERMISSIONS,
    appearance: { mode, density: 'standard', highContrast, reduceMotion: true },
  });
  await page.route('**/api/platform/v1/mail/address-book**', (route) =>
    fulfill(route, {
      contacts: { items: [], total: 0, page: 0, pageSize: 1 },
      groups: [],
      summary: { contactCount: 0, favoriteCount: 0, groupCount: 0 },
      generatedAt: '2026-09-04T00:00:00Z',
    })
  );
  await page.route('**/api/platform/v1/mail/organization', (route) =>
    fulfill(route, {
      accounts: [],
      folders: [],
      rules: [],
      recentRuns: [],
      generatedAt: '2026-09-04T00:00:00Z',
    })
  );
  await page.route('**/api/platform/v1/mail/home', (route) =>
    fulfill(route, {
      accounts: [],
      metrics: {
        unread: 14,
        urgent: 3,
        needsReply: 6,
        assigned: 0,
        snoozed: 19,
        activeProposals: 8,
      },
      focusQueue: [],
      proposals: [
        calendarProposal,
        taskProposal,
        draftProposal,
        leaveProposal,
        notificationProposal,
      ],
      sharedInboxes: [],
      generatedAt: '2026-09-04T00:00:00Z',
    })
  );
}

function proposal(overrides: Record<string, unknown>) {
  return {
    threadId: '40000000-0000-4000-8000-000000000001',
    actionContractVersion: 1,
    status: 'PROPOSED',
    expiresAt: '2099-12-31T23:59:59Z',
    version: 2,
    ...overrides,
  };
}

function fulfill(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data }),
  });
}
