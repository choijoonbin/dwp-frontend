import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG,
  HRIS_V52_PAGE_AUTHORITY_ROUTE_BINDINGS,
  HRIS_WORKBENCH_VIEW_BY_ID,
  isHrisRuntimeEffectiveRouteAlias,
} from '../apps/dwp/src/features/hris/shell/navigation-policy/seven-workbench-navigation-policy';
import { mockHcmProductSurfaceAuthority } from './support/product-surface-authority';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

const REVISION_PIN = `nav-v2-${'a'.repeat(64)}`;
const TOPOLOGY_REVISION = 'HRIS-IA-99-WB7-G46-N98-R6';
const TOPOLOGY_SHA256 = '4ac4b5411d804888ff1a4bd0373c70419b698a0abe43d0de43bd646966cfe166';
const IA_REGISTER_SHA256 = 'ab506a2bb2f80c8ab81a4b9d575374d6bda83b312d11dce07495d4812bdf4686';
const SHELL_REGISTER_SHA256 = 'f85ee40a66ce4100c5578fd3ca96bc89b652b0762e19d74cc7aeb76338009000';
const TASK_GROUP_REGISTER_SHA256 =
  'f0b1ebb316e4d5944aac90002e144f25d8c1318216b6733e674cdc8c5042872b';
const GENERATED_IA_SHA256 = '584cc32f845720ad06fb1bdcea7c967026c0e3a648f70e0215fd8a95a6b055bd';
const AUTHORITY_TEST_NOW = '2026-08-11T00:20:00Z';
const AUTHORITY_GENERATED_AT = '2026-08-11T00:19:00Z';
const AUTHORITY_REVALIDATE_AT = '2026-08-11T01:20:00Z';

test('R6 successor drives the seven-workbench shell and adjacent enterprise task panel', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'desktop evidence is captured once');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.clock.setFixedTime(AUTHORITY_TEST_NOW);
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MANAGER', 'HR_ADMIN'], {
    locale: 'en',
    displayName: 'Navigation Operator',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'dark',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await mockHcmProductSurfaceAuthority(page, {
    generatedAt: AUTHORITY_GENERATED_AT,
    revalidateAt: AUTHORITY_REVALIDATE_AT,
  });
  const requests = await mockAggregateProjection(page);

  await page.goto('/hr/operations');
  await expect(page.getByTestId('hcm-navigation-item-shell-home')).toBeVisible();
  await expect(page.locator('[data-testid^="hcm-navigation-item-workbench-"]')).toHaveCount(7);
  const peopleOperationsTrigger = page.getByTestId('hcm-navigation-item-workbench-hr-operations');
  await expect(peopleOperationsTrigger).toContainText('People');
  await expect(peopleOperationsTrigger).not.toContainText('People operations');
  await expect(page.getByTestId('hcm-desktop-task-navigator')).toHaveCount(0);
  await expect(page.locator('[data-testid^="hris-task-navigation-workbench-"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/hr/explore"]')).toHaveCount(0);

  for (const workbench of HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG) {
    const view = HRIS_WORKBENCH_VIEW_BY_ID[workbench.workbenchId];
    const trigger = page.getByTestId(`hcm-navigation-item-${view}`);
    await trigger.click();
    const representativePanel = page.getByTestId('hcm-desktop-task-navigator');
    await expect(representativePanel).toBeVisible();
    await expect(representativePanel.getByTestId(`hris-task-navigation-${view}`)).toBeVisible();
    if (view === 'workbench-hr-operations') {
      await expect(
        representativePanel.getByRole('heading', { name: 'People', exact: true })
      ).toBeVisible();
    }
    await expect(
      representativePanel.locator('[data-testid^="hris-task-node-"]').first()
    ).toBeVisible();
    await trigger.click();
    await expect(representativePanel).toHaveCount(0);
  }
  expect(requests.count).toBe(1);

  const performanceTrigger = page.getByTestId('hcm-navigation-item-workbench-performance');
  const entryUrl = page.url();
  await performanceTrigger.click();
  await expect(page).toHaveURL(entryUrl);
  await expect(performanceTrigger).toHaveAttribute('aria-expanded', 'true');

  const taskPanel = page.getByTestId('hcm-desktop-task-navigator');
  await expect(taskPanel).toBeVisible();
  const taskNavigation = taskPanel.getByTestId('hris-task-navigation-workbench-performance');
  await expect(taskNavigation).toHaveAttribute('data-policy-revision', REVISION_PIN);
  await expect(taskPanel.locator('a[href^="/hr/explore?scope="]')).toHaveCount(1);
  await expect(taskPanel.locator('a[href^="/hr/benefits"]')).toHaveCount(0);
  await expect(taskPanel.locator('a[href^="/hr/operations/benefits"]')).toHaveCount(0);

  const goalCyclesTask = taskPanel.getByTestId('hris-task-node-BASE:performance-goal-cycles');
  await expect(goalCyclesTask).toHaveAttribute(
    'href',
    '/hr/operations/performance/goal-cycles?scope=scope%3Ahcm%3Aoperations'
  );
  await goalCyclesTask.focus();
  await expect(goalCyclesTask).toBeFocused();

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="hcm-shell"]')
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await goalCyclesTask.click();
  await expect(page).toHaveURL(
    '/hr/operations/performance/goal-cycles?scope=scope%3Ahcm%3Aoperations'
  );
  await expect(page.getByTestId('hcm-desktop-task-navigator')).toHaveCount(0);
  expect(requests.count).toBe(1);

  await performanceTrigger.click();
  await expect(taskPanel).toBeVisible();

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

test('R6 mobile navigation drills from the workbench list into and back from the task panel', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile evidence is captured once');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce', forcedColors: 'active' });
  await page.clock.setFixedTime(AUTHORITY_TEST_NOW);
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MANAGER', 'HR_ADMIN'], {
    locale: 'en',
    displayName: 'Navigation Operator',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockHcmProductSurfaceAuthority(page, {
    generatedAt: AUTHORITY_GENERATED_AT,
    revalidateAt: AUTHORITY_REVALIDATE_AT,
  });
  const requests = await mockAggregateProjection(page);

  await page.goto('/hr/operations/talent');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  const trigger = page.getByTestId('hcm-mobile-navigation-trigger');
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await trigger.click();
  const drawer = page.getByTestId('hcm-mobile-sidebar');
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('[data-testid^="hcm-navigation-item-workbench-"]')).toHaveCount(7);
  await expect(drawer.getByTestId('hcm-mobile-task-navigator')).toHaveCount(0);

  const performanceTrigger = drawer.getByTestId('hcm-navigation-item-workbench-performance');
  const entryUrl = page.url();
  await performanceTrigger.click();
  await expect(page).toHaveURL(entryUrl);

  const taskPanel = drawer.getByTestId('hcm-mobile-task-navigator');
  await expect(taskPanel).toBeVisible();
  await expect(taskPanel.locator('[data-testid^="hcm-navigation-item-workbench-"]')).toHaveCount(0);
  const taskNavigation = taskPanel.getByTestId('hris-task-navigation-workbench-performance');
  await expect(taskNavigation).toHaveAttribute('data-policy-revision', REVISION_PIN);

  const back = taskPanel.getByRole('button', { name: 'Back' });
  await back.click();
  await expect(drawer.getByTestId('hcm-mobile-task-navigator')).toHaveCount(0);
  const remountedPerformanceTrigger = drawer.getByTestId(
    'hcm-navigation-item-workbench-performance'
  );
  await expect(remountedPerformanceTrigger).toBeVisible();
  await expect(remountedPerformanceTrigger).toBeFocused();

  await remountedPerformanceTrigger.click();
  const reopenedTaskPanel = drawer.getByTestId('hcm-mobile-task-navigator');
  await expect(reopenedTaskPanel).toBeVisible();
  const goalCyclesTask = reopenedTaskPanel.getByTestId(
    'hris-task-node-BASE:performance-goal-cycles'
  );
  await expect(goalCyclesTask).toHaveAttribute(
    'href',
    '/hr/operations/performance/goal-cycles?scope=scope%3Ahcm%3Aoperations'
  );
  await goalCyclesTask.focus();
  await expect(goalCyclesTask).toBeFocused();
  await expectNoHorizontalOverflow(page);

  const evidenceDirectory = process.env.HRIS_R5_EVIDENCE_DIR;
  if (evidenceDirectory) {
    await mkdir(evidenceDirectory, { recursive: true });
    await page.screenshot({
      path: `${evidenceDirectory}/seven-workbench-mobile-200-percent-forced-colors.png`,
      fullPage: true,
    });
  }

  await goalCyclesTask.click();
  await expect(page).toHaveURL(
    '/hr/operations/performance/goal-cycles?scope=scope%3Ahcm%3Aoperations'
  );
  await expect(drawer).not.toBeVisible();
  expect(requests.count).toBe(1);
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
      workbenches: effectiveAggregateWorkbenches(),
      denialReason: null,
      evaluatedAt: '2026-08-11T00:20:00Z',
    });
  });
  return requests;
}

function effectiveAggregateWorkbenches() {
  return HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.map((workbench) => {
    const groups = workbench.groups.flatMap((group) => {
      const nodes = group.nodes.flatMap((node) => {
        const routeAliases = node.routeAliases.filter((route) => {
          const v52Candidate = HRIS_V52_PAGE_AUTHORITY_ROUTE_BINDINGS.some(
            (binding) => binding.nodeId === node.nodeId && binding.path === route
          );
          return isHrisRuntimeEffectiveRouteAlias(route) && !v52Candidate;
        });
        return routeAliases.length
          ? [{ nodeId: node.nodeId, displayOrder: node.displayOrder, routeAliases }]
          : [];
      });
      if (!nodes.length) return [];
      return [
        {
          groupId: group.groupId,
          displayOrder: group.displayOrder,
          defaultNodeId: nodes.some((node) => node.nodeId === group.defaultNodeId)
            ? group.defaultNodeId
            : nodes[0]!.nodeId,
          nodes,
        },
      ];
    });
    const nodeIds = new Set(groups.flatMap((group) => group.nodes.map((node) => node.nodeId)));
    return {
      workbenchId: workbench.workbenchId,
      displayOrder: workbench.displayOrder,
      landingNodeId: nodeIds.has(workbench.defaultNodeId)
        ? workbench.defaultNodeId
        : groups[0]!.defaultNodeId,
      groups,
    };
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}
