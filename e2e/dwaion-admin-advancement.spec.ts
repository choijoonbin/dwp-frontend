import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { mockDwaionControlPlaneAuthority } from './support/dwaion-admin-advancement-fixtures';
import { mockDwaionAdminStitch } from './support/dwaion-admin-stitch-fixtures';

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }))
    )
    .toMatchObject({
      viewport: await page.evaluate(() => document.documentElement.clientWidth),
      content: await page.evaluate(() => document.documentElement.clientWidth),
    });
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function expectAccessible(page: Page) {
  const accessibility = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    accessibility.violations.filter((issue) =>
      ['serious', 'critical'].includes(issue.impact ?? '')
    ),
    JSON.stringify(accessibility.violations)
  ).toEqual([]);
}

test('A01 models and routing keeps the governed work visible at every required width', async ({
  page,
}, testInfo) => {
  await mockDwaionAdminStitch(page);

  for (const width of [1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
    await page.goto('/dwaion/admin/models');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole('heading', { name: 'Models & routing' })).toBeVisible();
    await expect(page.getByText('Managed enterprise provider')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change policy' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Routing simulator' })).toBeVisible();
    await expect(page.getByText('Provider & immutable model registry')).toBeVisible();
    await expect(page.getByText('Work domain & task routing matrix')).toBeVisible();
    await expect(page.getByText('ROUTED', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, `a01-models-routing-${width}`);
  }

  // A 1,440px physical viewport at 200% browser zoom exposes 720 CSS pixels.
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto('/dwaion/admin/models');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('heading', { name: 'Models & routing' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, 'a01-models-routing-200-percent');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dwaion/admin/models');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Change policy' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();

  await expectAccessible(page);
});

test('A02-A06 are integrated into the canonical admin information architecture', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await mockDwaionAdminStitch(page);

  const surfaces = [
    {
      id: 'a02-agent-governance',
      path: '/dwaion/admin/agents',
      pageHeading: 'Agent and publishing management',
      heading: 'Builder, evaluation & rollout governance',
      action: 'Sign evaluation certificate',
    },
    {
      id: 'a03-connector-operations',
      path: '/dwaion/admin/sources',
      pageHeading: 'Data sources and connectors',
      heading: 'Connector & ACL operations',
      action: 'OAuth reauthorize',
    },
    {
      id: 'a04-evaluation-safety',
      path: '/dwaion/admin/evaluation',
      pageHeading: 'Response quality and evaluation',
      heading: 'Continuous evaluation & production monitoring',
      action: 'New evaluation run',
    },
    {
      id: 'a05-incident-workbench',
      path: '/dwaion/admin/overview',
      pageHeading: 'DWAI·ON operations overview',
      heading: 'AI incident workbench',
      action: 'Emergency kill',
      selector: '#dwaion-incident-workbench',
    },
    {
      id: 'a06-outcomes',
      path: '/dwaion/admin/overview',
      pageHeading: 'DWAI·ON operations overview',
      heading: 'Outcome, quality & cost',
      action: 'Open delivery ticket',
      selector: '#dwaion-outcomes-operations',
    },
  ] as const;

  for (const surface of surfaces) {
    for (const viewport of [
      { width: 1440, height: 900, label: '1440' },
      { width: 720, height: 450, label: '200-percent' },
      { width: 390, height: 844, label: '390' },
      { width: 320, height: 760, label: '320' },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(surface.path);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expect(page.getByRole('heading', { name: surface.pageHeading })).toBeVisible();
      await expect(page.getByRole('heading', { name: surface.heading })).toBeVisible();
      await expect(page.getByRole('button', { name: surface.action })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page);
      if ('selector' in surface) await expect(page.locator(surface.selector)).toBeVisible();
      await capture(page, testInfo, `${surface.id}-${viewport.label}`);
    }
  }
});

test('governed commands persist the audited preflight and block maker self-approval', async ({
  page,
}) => {
  const { requests } = await mockDwaionAdminStitch(page);
  await mockDwaionControlPlaneAuthority(page);
  await page.goto('/dwaion/admin/models');

  await page.getByRole('button', { name: 'Change policy' }).click();
  const dialog = page.getByTestId('dwaion-governed-command-dialog');
  await dialog
    .getByLabel('Change reason')
    .fill('Route the verified workload through the reviewed policy.');
  await dialog.getByLabel('Ticket or incident').fill('AI-OPS-42');
  await dialog.getByLabel('Evidence references').fill('audit:event:42, evaluation:run:7');
  await dialog.getByLabel('I reviewed the impact and recovery plan.').check();
  await dialog.getByRole('button', { name: 'Request approval' }).click();

  await expect(dialog.getByText('Awaiting checker approval')).toBeVisible();
  await expect(
    dialog.getByText(
      'The maker cannot approve or reject this command. An independent checker is required.'
    )
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Reject' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Cancel execution' })).toBeVisible();

  const request = requests.find(
    (item) => item.method === 'POST' && item.path.endsWith('/control-plane/commands')
  );
  expect(request?.search).toContain('contextScopeKey=scope%3Adwaion%3Atenant');
  expect(request?.body).toMatchObject({
    kind: 'MODEL_ROUTING_UPDATE',
    expectedVersion: 7,
    impactAcknowledged: true,
    preflight: {
      impactScopes: expect.arrayContaining(['tenant:fixture']),
      recoveryPlan: expect.any(String),
      recoveryPlanHash: expect.stringMatching(/^[a-f\d]{64}$/),
      changes: expect.arrayContaining([
        expect.objectContaining({ field: 'Primary model', before: 'model-primary' }),
      ]),
    },
  });
  expect(request?.body?.commandId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
});

test('an independent checker can review the persisted record and approve from the queue', async ({
  page,
}) => {
  const { requests } = await mockDwaionAdminStitch(page);
  await mockDwaionControlPlaneAuthority(page);
  await page.goto('/dwaion/admin/models');

  await page
    .getByRole('button', {
      name: 'Review approval command: MODEL_ROUTING_UPDATE route-enterprise',
    })
    .click();
  const dialog = page.getByTestId('dwaion-governed-command-dialog');
  await expect(dialog.getByText('Submitted review record')).toBeVisible();
  await expect(dialog.getByText('AI-OPS-41', { exact: false })).toBeVisible();
  await expect(dialog.getByText('Restore model-primary', { exact: false })).toBeVisible();
  await dialog
    .getByLabel('Decision or follow-up reason')
    .fill('Independent review confirms the bounded canary and rollback plan.');
  await dialog.getByLabel('Decision evidence references').fill('checker:review:42');
  await dialog.getByRole('button', { name: 'Approve' }).click();

  await expect(dialog.getByText('QUEUED')).toBeVisible();
  const decision = requests.find((item) => item.path.endsWith('/decision'));
  expect(decision?.body).toMatchObject({
    decision: 'APPROVE',
    expectedVersion: 1,
    evidenceRefs: ['checker:review:42'],
  });
  expect(decision?.body?.commandId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('There are no verified commands awaiting approval.')).toBeVisible();
});
