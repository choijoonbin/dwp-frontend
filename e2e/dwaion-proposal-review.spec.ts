import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { AgentComponents } from '../libs/api-contracts/src';

import { PROPOSAL_DESIGN_ITEMS } from './support/dwaion-proposal-design-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

type Proposal = AgentComponents['schemas']['AgentProposal'];
const NOW = new Date('2026-09-08T00:00:00Z');
const SOURCE_ROUTE = '/work/queue?item=11000000-0000-4000-8000-000000000001';

test.use({ timezoneId: 'Asia/Seoul' });

async function setup(
  page: Page,
  options: { expiresAt?: string; ticking?: boolean; conflict?: boolean } = {}
) {
  if (options.ticking) await page.clock.install({ time: NOW });
  else await page.clock.setFixedTime(NOW);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  let proposal: Proposal = {
    ...structuredClone(PROPOSAL_DESIGN_ITEMS[0]),
    expiresAt: options.expiresAt ?? '2026-09-08T04:00:00Z',
    content: {
      ...PROPOSAL_DESIGN_ITEMS[0].content,
      evidence: [
        {
          sourceType: 'WORK_ITEM',
          referenceId: 'work-100',
          label: 'Meeting preparation task',
          occurredAt: '2026-09-07T23:30:00Z',
          route: SOURCE_ROUTE,
        },
        {
          sourceType: 'MAIL',
          referenceId: 'mail-100',
          label: 'Restricted mail reference',
          occurredAt: null,
          route: '//outside.example.test/mail',
        },
      ],
    },
  };
  const decisions: Array<Record<string, unknown>> = [];
  const previews: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/action-plans/preview')) previews.push(request.url());
  });
  await page.route('**/api/agent/v1/proposals/preferences', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { proactiveAnalysisEnabled: false, revision: 0, updatedAt: null },
      },
    })
  );
  await page.route('**/api/agent/v1/proposals?**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          items: [proposal],
          summary: {
            active: proposal.state === 'PENDING' ? 1 : 0,
            highPriority: 1,
            snoozed: proposal.state === 'SNOOZED' ? 1 : 0,
            handled: proposal.state === 'ACCEPTED' ? 1 : 0,
          },
          nextCursor: null,
        },
      },
    })
  );
  await page.route('**/api/agent/v1/proposals/*/decisions', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    decisions.push(body);
    proposal = {
      ...proposal,
      state: body.decision === 'SNOOZE' ? 'SNOOZED' : 'ACCEPTED',
      revision: proposal.revision + 1,
      snoozedUntil: typeof body.snoozeUntil === 'string' ? body.snoozeUntil : null,
      decidedAt: NOW.toISOString(),
    };
    if (options.conflict)
      return route.fulfill({ status: 409, json: { detail: 'Proposal revision changed.' } });
    return route.fulfill({
      json: { success: true, data: { proposal, actionReviewRequired: body.decision === 'ACCEPT' } },
    });
  });
  await page.goto(`/dwaion/proposals?proposal=${proposal.proposalId}`);
  const inspector = page.getByRole('dialog', { name: 'DWAI·ON proposal' });
  await expect(inspector).toBeVisible();
  return { inspector, decisions, previews };
}

test('review exposes permitted source links, recorded source times and priority before acceptance', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { inspector, decisions, previews } = await setup(page);
  await expect(inspector.getByText('Priority: High', { exact: true })).toBeVisible();
  await expect(
    inspector.getByRole('link', { name: 'Open source: Meeting preparation task' })
  ).toHaveAttribute('href', SOURCE_ROUTE);
  await expect(inspector.getByRole('link')).toHaveCount(1);
  await expect(inspector.getByText('Restricted mail reference')).toBeVisible();
  await expect(inspector.getByText('Source time was not provided.')).toBeVisible();
  await expect(inspector.getByText(/Source time:.*Sep 8, 2026/)).toBeVisible();
  await expect(inspector.getByText('Asia/Seoul', { exact: true })).toBeVisible();
  await expect(inspector.getByText(/Accepting never executes automatically/).first()).toBeVisible();
  const audit = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(
    audit.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('proposal-review-desktop.png') });
  await inspector.getByRole('button', { name: 'Accept for review' }).click();
  await expect(inspector.getByText('Accepted', { exact: true })).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Continue to action review' })).toBeVisible();
  expect(decisions).toHaveLength(1);
  expect(decisions[0]).toMatchObject({ expectedRevision: 2, decision: 'ACCEPT' });
  expect(previews).toEqual([]);
  await expect(page).toHaveURL(/\/dwaion\/proposals\?proposal=/);
});

test('mobile snooze shows the exact timezone and sends only an available time before expiry', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { inspector, decisions } = await setup(page);
  for (const name of ['Accept for review', 'Review later', 'Dismiss proposal']) {
    const bounds = await inspector.getByRole('button', { name }).boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
  await inspector.getByRole('button', { name: 'Review later' }).click();
  const menu = page.getByRole('menu');
  await expect(
    menu.getByText('Times use Asia/Seoul. Choose a time before the proposal expires.')
  ).toBeVisible();
  const inTwoHours = menu.getByRole('menuitem', { name: /In 2 hours/ });
  await expect(inTwoHours).toContainText('11:00');
  await expect(menu.getByRole('menuitem', { name: /Tomorrow at 9 AM/ })).toHaveAttribute(
    'aria-disabled',
    'true'
  );
  await expect(menu.getByRole('menuitem', { name: /Next Monday/ })).toHaveAttribute(
    'aria-disabled',
    'true'
  );
  expect(await menu.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('proposal-review-mobile-snooze.png') });
  const audit = await new AxeBuilder({ page }).include('[role="menu"]').analyze();
  expect(
    audit.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
  ).toEqual([]);
  await inTwoHours.click();
  expect(decisions).toHaveLength(1);
  expect(decisions[0]).toMatchObject({
    decision: 'SNOOZE',
    expectedRevision: 2,
    snoozeUntil: '2026-09-08T02:00:00.000Z',
  });
  await expect(inspector.getByText('Snoozed', { exact: true })).toBeVisible();
});

test('an expired pending receipt keeps its server state while disabling every decision', async ({
  page,
}) => {
  const { inspector, decisions } = await setup(page, { expiresAt: '2026-09-07T23:59:59Z' });
  await expect(inspector.getByText('Awaiting review', { exact: true })).toBeVisible();
  await expect(inspector.getByRole('alert')).toContainText('The validity window has ended');
  for (const name of ['Accept for review', 'Review later', 'Dismiss proposal']) {
    await expect(inspector.getByRole('button', { name })).toBeDisabled();
  }
  expect(decisions).toEqual([]);
});

test('expiry while the inspector is open disables decisions without a page refresh', async ({
  page,
}) => {
  const { inspector, decisions } = await setup(page, {
    expiresAt: '2026-09-08T00:01:00Z',
    ticking: true,
  });
  const accept = inspector.getByRole('button', { name: 'Accept for review' });
  await expect(accept).toBeEnabled();
  await page.clock.runFor(61_000);
  await expect(accept).toBeDisabled();
  await expect(inspector.getByRole('alert')).toContainText('The validity window has ended');
  expect(decisions).toEqual([]);
});

test('a revision conflict replaces the prior decision controls with the canonical state', async ({
  page,
}) => {
  const { inspector, decisions } = await setup(page, { conflict: true });
  await inspector.getByRole('button', { name: 'Accept for review' }).click();
  await expect(inspector.getByText('Accepted', { exact: true })).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Continue to action review' })).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Accept for review' })).toHaveCount(0);
  expect(decisions).toHaveLength(1);
});

test('expiry closes an open dismissal confirmation without submitting a decision', async ({
  page,
}) => {
  const { inspector, decisions } = await setup(page, {
    expiresAt: '2026-09-08T00:01:00Z',
    ticking: true,
  });
  await inspector.getByRole('button', { name: 'Dismiss proposal' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Dismiss this proposal?' });
  await expect(confirmation).toBeVisible();
  await page.clock.runFor(61_000);
  await expect(confirmation).toHaveCount(0);
  await expect(inspector.getByRole('button', { name: 'Dismiss proposal' })).toBeDisabled();
  expect(decisions).toEqual([]);
});
