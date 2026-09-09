import { expect, test } from '@playwright/test';

import {
  mockWorkHubFoundation,
  personalTaskRoute,
  WORK_HUB_FIXTURE as work,
} from './support/work-hub-foundation-fixtures';

import type { Page } from '@playwright/test';

const eventId = '90000000-0000-4000-8000-000000000001';
const commandId = '90000000-0000-4000-8000-000000000002';
const auditId = '90000000-0000-4000-8000-000000000003';
const sourceRoute = personalTaskRoute(work.personalId);
const event = {
  id: eventId,
  occurredAt: '2026-09-08T01:00:00Z',
  actor: 'PERSON',
  actorName: 'Mina Kim',
  state: 'COMPLETED',
  title: 'Personal work completed',
  summary: 'The exact personal Work command was projected with verified evidence.',
  objectType: 'WORK_ITEM',
  objectId: work.personalId,
  objectLabel: work.personalTitle,
  source: 'PERSONAL_TASK',
  sourceReference: work.personalId,
  sourceAccess: 'AVAILABLE',
  sourceRoute,
  sourceEventId: `personal-work-command:900018:${commandId}`,
  resourceVersion: 1,
  idempotencyKey: commandId,
  resultState: 'COMPLETED',
  eventKind: 'CHANGE',
  workStatus: 'COMPLETED',
  dataProvenance: 'LIVE',
  auditStatus: 'VERIFIED',
  auditRecordId: auditId,
  auditId: null,
  auditAccess: 'RESTRICTED',
};
const coverage = {
  supportedObjectTypes: ['WORK_ITEM'],
  excludedProvenance: ['SAMPLE', 'QUARANTINED'],
  includesLegacy: false,
  includesUsage: false,
  sourceScope: 'WORKSPACE',
};

async function mockPersonalWorkActivity(page: Page) {
  await page.route('**/api/agent/v1/activity/**', (route) => {
    const summary = new URL(route.request().url()).pathname.endsWith('/executions/summary');
    return route.fulfill({
      json: {
        data: summary
          ? {
              total: 0,
              running: 0,
              needsInput: 0,
              policyBlocked: 0,
              completed: 0,
              failed: 0,
              cancelled: 0,
              unknown: 0,
              generatedAt: '2026-09-08T01:01:00Z',
              coverage: { ...coverage, supportedObjectTypes: [], sourceScope: 'DWAI_ON' },
            }
          : {
              events: [],
              generatedAt: '2026-09-08T01:01:00Z',
              snapshotAt: '2026-09-08T01:01:00Z',
              coverage: { ...coverage, supportedObjectTypes: [], sourceScope: 'DWAI_ON' },
              hasMore: false,
              nextCursor: null,
              startCursor: null,
            },
      },
    });
  });
  await page.route('**/api/platform/v1/workspace/activity**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/sources/status')) {
      return route.fulfill({
        json: { data: { observedAt: '2026-09-08T01:01:00Z', sources: [] } },
      });
    }
    if (url.pathname.endsWith('/evidence')) {
      return route.fulfill({ status: 404, json: { errorCode: 'RESOURCE_NOT_FOUND' } });
    }
    if (url.pathname.endsWith('/executions/summary')) {
      return route.fulfill({
        json: {
          data: {
            total: 0,
            running: 0,
            needsInput: 0,
            policyBlocked: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            unknown: 0,
            generatedAt: '2026-09-08T01:01:00Z',
            coverage,
          },
        },
      });
    }
    if (url.pathname.includes('/events/')) {
      return route.fulfill({ json: { data: event } });
    }
    return route.fulfill({
      json: {
        data: {
          events: [event],
          generatedAt: '2026-09-08T01:01:00Z',
          snapshotAt: '2026-09-08T01:01:00Z',
          coverage,
          hasMore: false,
          nextCursor: null,
          startCursor: null,
        },
      },
    });
  });
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`${viewport.width}px PERSONAL_TASK Activity opens canonical Work and restores source focus`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await mockWorkHubFoundation(page);
    await mockPersonalWorkActivity(page);

    const activityRoute = `/activity/timeline?event=${eventId}`;
    await page.goto(activityRoute);
    const detail = page.getByRole('complementary', { name: 'Signal detail' });
    await expect(detail.getByText(event.title, { exact: true })).toBeVisible();
    const sourceAction = detail.getByRole('button', { name: 'Open source', exact: true });
    await sourceAction.click();

    await expect(page).toHaveURL(
      (url) => `${url.pathname}${url.search}${url.hash}` === sourceRoute
    );
    await expect(
      page.getByRole('heading', { name: work.personalTitle, exact: true })
    ).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(
      (url) => `${url.pathname}${url.search}${url.hash}` === activityRoute
    );
    await expect(detail.getByText(event.title, { exact: true })).toBeVisible();
    await expect(sourceAction).toBeFocused();
  });
}
