import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG } from '../apps/dwp/src/features/hris/shell/navigation-policy/seven-workbench-navigation-policy';
import { mockHcmProductSurfaceAuthority } from './support/product-surface-authority';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

const REVISION_PIN = `nav-v2-${'a'.repeat(64)}`;
const TOPOLOGY_REVISION = 'HRIS-IA-98-WB7-G46-N97-R5';
const TOPOLOGY_SHA256 = '4d27b3b8958d591968ed42e7ccd6387664fff66a364adfc83a8a5b7f223a6d8a';
const IA_REGISTER_SHA256 = 'ab506a2bb2f80c8ab81a4b9d575374d6bda83b312d11dce07495d4812bdf4686';
const SHELL_REGISTER_SHA256 =
  'f85ee40a66ce4100c5578fd3ca96bc89b652b0762e19d74cc7aeb76338009000';
const TASK_GROUP_REGISTER_SHA256 =
  'f0b1ebb316e4d5944aac90002e144f25d8c1318216b6733e674cdc8c5042872b';
const GENERATED_IA_SHA256 =
  '584cc32f845720ad06fb1bdcea7c967026c0e3a648f70e0215fd8a95a6b055bd';

test('R5 aggregate pin drives the seven-workbench shell and one progressive task navigation', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'desktop evidence is captured once');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MANAGER', 'HR_ADMIN'], {
    locale: 'en',
    displayName: 'R5 Navigation Operator',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'dark',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await mockHcmProductSurfaceAuthority(page);
  const requests = await mockAggregateProjection(page);

  await page.goto('/hr/operations');
  await expect(page.getByTestId('hcm-navigation-item-shell-home')).toBeVisible();
  await expect(page.locator('[data-testid^="hcm-navigation-item-workbench-"]')).toHaveCount(7);
  await expect(page.locator('[data-testid^="hris-task-navigation-workbench-"]')).toHaveCount(1);
  await expect(page.getByTestId('hris-task-navigation-workbench-hr-operations')).toHaveAttribute(
    'data-policy-revision',
    REVISION_PIN
  );
  await expect(page.locator('a[href^="/hr/explore"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/hr/benefits"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/hr/operations/benefits"]')).toHaveCount(0);

  const firstTask = page
    .getByTestId('hris-task-navigation-workbench-hr-operations')
    .locator('[data-testid^="hris-task-node-"]')
    .first();
  await firstTask.focus();
  await expect(firstTask).toBeFocused();

  await page.getByTestId('hcm-navigation-item-workbench-performance').click();
  await expect(page).toHaveURL(/\/hr\/operations\/talent/u);
  await expect(page.locator('[data-testid^="hris-task-navigation-workbench-"]')).toHaveCount(1);
  await expect(page.getByTestId('hris-task-navigation-workbench-performance')).toHaveAttribute(
    'data-policy-revision',
    REVISION_PIN
  );
  expect(requests.count).toBe(1);

  const accessibility = await new AxeBuilder({ page }).include('[data-testid="hcm-shell"]').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  const evidenceDirectory = process.env.HRIS_R5_EVIDENCE_DIR;
  if (evidenceDirectory) {
    await mkdir(evidenceDirectory, { recursive: true });
    await page.screenshot({
      path: `${evidenceDirectory}/seven-workbench-dark-reduced-motion.png`,
      fullPage: true,
    });
  }

  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce', forcedColors: 'active' });
  await expectNoHorizontalOverflow(page);
  if (evidenceDirectory) {
    await page.screenshot({
      path: `${evidenceDirectory}/seven-workbench-200-percent-forced-colors.png`,
      fullPage: true,
    });
  }
});

test('R5 selected workbench remains keyboard-usable at mobile 200% high contrast', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile evidence is captured once');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce', forcedColors: 'active' });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MANAGER', 'HR_ADMIN'], {
    locale: 'en',
    displayName: 'R5 Navigation Operator',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockHcmProductSurfaceAuthority(page);
  const requests = await mockAggregateProjection(page);

  await page.goto('/hr/operations/talent');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  const trigger = page.getByTestId('hcm-mobile-navigation-trigger');
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.locator('[data-testid^="hcm-navigation-item-workbench-"]:visible')).toHaveCount(
    7
  );
  await expect(
    page.locator('[data-testid^="hris-task-navigation-workbench-"]:visible')
  ).toHaveCount(1);
  const taskNavigation = page.locator(
    '[data-testid="hris-task-navigation-workbench-performance"]:visible'
  );
  await expect(taskNavigation).toHaveAttribute(
    'data-policy-revision',
    REVISION_PIN
  );
  const task = taskNavigation.locator('[data-testid^="hris-task-node-"]').first();
  await task.focus();
  await expect(task).toBeFocused();
  await expectNoHorizontalOverflow(page);
  expect(requests.count).toBe(1);

  const evidenceDirectory = process.env.HRIS_R5_EVIDENCE_DIR;
  if (evidenceDirectory) {
    await mkdir(evidenceDirectory, { recursive: true });
    await page.screenshot({
      path: `${evidenceDirectory}/seven-workbench-mobile-200-percent-forced-colors.png`,
      fullPage: true,
    });
  }
});

async function mockAggregateProjection(page: Page) {
  const requests = { count: 0 };
  await page.route('**/api/platform/v2/hris/navigation/projection**', (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.getAll('navigationScope')).toEqual(['TENANT']);
    expect(url.searchParams.has('legalEntityPublicId')).toBe(false);
    requests.count += 1;
    return fulfillSuccess(route, {
      schemaVersion: '2',
      topologyRevision: TOPOLOGY_REVISION,
      topologySha256: TOPOLOGY_SHA256,
      iaRegisterSha256: IA_REGISTER_SHA256,
      shellRegisterSha256: SHELL_REGISTER_SHA256,
      taskGroupRegisterSha256: TASK_GROUP_REGISTER_SHA256,
      generatedIaSha256: GENERATED_IA_SHA256,
      enforcementState: 'ENFORCED',
      policyEnforced: true,
      tenantPolicyId: '10000000-0000-4000-8000-000000000001',
      tenantRevisionId: '10000000-0000-4000-8000-000000000002',
      tenantRevisionNumber: 7,
      legalEntityRevisionId: null,
      legalEntityRevisionNumber: null,
      revisionPin: REVISION_PIN,
      workbenches: HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.map((workbench) => ({
        workbenchId: workbench.workbenchId,
        displayOrder: workbench.displayOrder,
        landingNodeId: workbench.defaultNodeId,
        groups: workbench.groups.map((group) => ({
          groupId: group.groupId,
          displayOrder: group.displayOrder,
          defaultNodeId: group.defaultNodeId,
          nodes: group.nodes.map((node) => ({
            nodeId: node.nodeId,
            displayOrder: node.displayOrder,
          })),
        })),
      })),
      denialReason: null,
      evaluatedAt: '2026-08-11T00:20:00Z',
    });
  });
  return requests;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}
