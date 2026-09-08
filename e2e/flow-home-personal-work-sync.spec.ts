import { expect, test, type Locator, type Page } from '@playwright/test';

import { createHomeOverviewFixture, fulfillSuccess } from './support/shell-session';
import {
  mockWorkHubFoundation,
  personalTaskRoute,
  WORK_HUB_FIXTURE,
} from './support/work-hub-foundation-fixtures';

const createdTaskId = 'b3333333-3333-4333-8333-333333333333';
const createdTaskTitle = 'Confirm Flow home synchronization';

const flowExperience = {
  headline: null,
  subheadline: null,
  localizedContent: {},
  defaultLocale: 'en',
  backgroundPosition: 'RIGHT',
  overlayOpacity: 18,
  backgroundUrl: null,
  launchpadConfiguration: { schemaVersion: 1, groups: [], placements: [] },
  compositionPolicy: {
    schemaVersion: 3,
    experienceVariant: 'FLOW_V1',
    personalCustomizationEnabled: true,
    governedZones: [],
  },
  effectiveExperienceVariant: 'FLOW_V1',
  advancedPersonalizationEnabled: false,
  composerEnabled: false,
  homePreferenceStore: 'LEGACY',
  version: 7,
} as const;

async function mockFlowPersonalWorkJourney(page: Page) {
  const runtime = await mockWorkHubFoundation(page);
  await page.route('**/api/auth/permissions', (route) =>
    fulfillSuccess(route, [
      {
        resourceType: 'APP',
        resourceKey: 'APP.WORK',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'APP',
        resourceKey: 'APP.WORK',
        permissionCode: 'UPDATE',
        effect: 'ALLOW',
      },
    ])
  );
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, flowExperience)
  );
  await page.route('**/api/platform/v1/home/overview**', (route) => {
    const overview = createHomeOverviewFixture(['WORKSPACE_MEMBER']);
    const generatedAt = new Date().toISOString();
    return fulfillSuccess(route, {
      ...overview,
      generatedAt,
      work: {
        ...overview.work,
        generatedAt,
        data: {
          ...overview.work.data,
          summary: { total: 0, dueSoon: 0, inProgress: 0, waiting: 0, completed: 0 },
          items: [],
          generatedAt,
        },
      },
    });
  });
  return runtime;
}

function flowSection(page: Page, key: 'action' | 'pulse') {
  return page.getByTestId('flow-home').locator(`[data-flow-section="purpose-${key}"]`);
}

function personalContribution(section: Locator, taskId: string) {
  return section.locator(`a[data-home-contribution][href="${personalTaskRoute(taskId)}"]`);
}

async function expectActionCount(page: Page, count: number) {
  await expect(flowSection(page, 'action').locator('[data-home-purpose-list]')).toHaveAttribute(
    'data-home-purpose-visible-count',
    String(count)
  );
}

async function expectPlanCount(page: Page, count: number) {
  const link = flowSection(page, 'pulse').locator(
    'a[data-home-contribution][href="/work/day-plan"]'
  );
  if (count === 0) {
    await expect(link).toHaveCount(0);
    return;
  }
  await expect(link).toBeVisible();
  await expect(link).toContainText('Today plan');
  await expect(link.getByText(String(count), { exact: true })).toHaveCount(count > 1 ? 1 : 0);
}

async function returnToFlow(page: Page) {
  await page.getByTestId('work-surface-return').click();
  await expect(page).toHaveURL('/');
  await expect(page.getByTestId('flow-home')).toBeVisible();
}

test('Flow immediately reconciles personal task lifecycle and today-plan counts after SPA return', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const runtime = await mockFlowPersonalWorkJourney(page);

  await page.goto('/');
  await expect(page.getByTestId('flow-home')).toBeVisible({ timeout: 20_000 });
  await expectActionCount(page, 2);
  await expectPlanCount(page, 0);

  const firstTask = personalContribution(flowSection(page, 'action'), WORK_HUB_FIXTURE.personalId);
  await expect(firstTask).toContainText(WORK_HUB_FIXTURE.personalTitle);
  await firstTask.click();
  await expect(page).toHaveURL(personalTaskRoute(WORK_HUB_FIXTURE.personalId));
  await page.getByRole('article').getByRole('button', { name: 'Add to today plan' }).click();
  await expect(
    page.getByRole('article').getByRole('button', { name: 'Remove from today plan' })
  ).toBeVisible();
  await returnToFlow(page);
  await expectPlanCount(page, 1);

  await personalContribution(
    flowSection(page, 'action'),
    WORK_HUB_FIXTURE.secondaryPersonalId
  ).click();
  await expect(page).toHaveURL(personalTaskRoute(WORK_HUB_FIXTURE.secondaryPersonalId));
  await page.getByRole('article').getByRole('button', { name: 'Add to today plan' }).click();
  await expect(
    page.getByRole('article').getByRole('button', { name: 'Remove from today plan' })
  ).toBeVisible();
  await returnToFlow(page);
  await expectPlanCount(page, 2);

  await personalContribution(flowSection(page, 'action'), WORK_HUB_FIXTURE.personalId).click();
  await page
    .locator('#dwp-main-content')
    .getByRole('button', { name: 'Add personal task', exact: true })
    .click();
  const createDialog = page.getByRole('dialog', { name: 'Add a personal task' });
  await createDialog.getByRole('textbox', { name: 'Title', exact: true }).fill(createdTaskTitle);
  await createDialog.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(createDialog).toHaveCount(0);
  await expect(
    page.getByRole('article').getByRole('heading', { name: createdTaskTitle, exact: true })
  ).toBeVisible();
  await returnToFlow(page);
  await expectActionCount(page, 3);
  const createdContribution = personalContribution(flowSection(page, 'action'), createdTaskId);
  await expect(createdContribution).toContainText(createdTaskTitle);

  await createdContribution.click();
  await page.getByRole('article').getByRole('button', { name: 'Complete', exact: true }).click();
  await expect(
    page.getByRole('article').getByRole('button', { name: 'Complete', exact: true })
  ).toHaveCount(0);
  await returnToFlow(page);
  await expect(personalContribution(flowSection(page, 'action'), createdTaskId)).toHaveCount(0);
  await expectActionCount(page, 2);

  await flowSection(page, 'pulse')
    .locator('a[data-home-contribution][href="/work/day-plan"]')
    .click();
  const plan = page.getByTestId('work-today-plan-page');
  await expect(plan).toBeVisible();
  await plan
    .getByRole('button', {
      name: `Remove ${WORK_HUB_FIXTURE.secondaryTitle} from the plan`,
      exact: true,
    })
    .click();
  await plan.getByRole('button', { name: 'Save plan', exact: true }).click();
  await returnToFlow(page);
  await expectPlanCount(page, 1);

  const secondContribution = personalContribution(
    flowSection(page, 'action'),
    WORK_HUB_FIXTURE.secondaryPersonalId
  );
  await secondContribution.click();
  await page.getByRole('button', { name: 'Delete task', exact: true }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete this personal task?' });
  await deleteDialog.getByRole('button', { name: 'Delete task', exact: true }).click();
  await expect(page).toHaveURL('/work/queue');
  await returnToFlow(page);
  await expect(secondContribution).toHaveCount(0);
  await expectActionCount(page, 1);

  await flowSection(page, 'pulse')
    .locator('a[data-home-contribution][href="/work/day-plan"]')
    .click();
  await page
    .getByTestId('work-today-plan-page')
    .getByRole('button', {
      name: `Remove ${WORK_HUB_FIXTURE.personalTitle} from the plan`,
      exact: true,
    })
    .click();
  await page
    .getByTestId('work-today-plan-page')
    .getByRole('button', { name: 'Save plan', exact: true })
    .click();
  await returnToFlow(page);
  await expectPlanCount(page, 0);

  expect(runtime.creations).toHaveLength(1);
  expect(runtime.mutations.filter((mutation) => mutation.path.endsWith('/complete'))).toHaveLength(
    1
  );
  expect(runtime.mutations.filter((mutation) => mutation.path.endsWith('/delete'))).toHaveLength(1);
  expect(runtime.planSaves).toHaveLength(4);
});
