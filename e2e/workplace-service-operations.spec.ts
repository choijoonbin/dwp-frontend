import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  ITEM_ID,
  ORDER_ID,
  SITE_ID,
  mockServices,
} from './support/workplace-reservation-services-fixtures';
import { mockWorkplaceServiceOperations } from './support/workplace-service-operations-fixtures';

test('records requester-owned inspection against the frozen line and task versions', async ({
  page,
}) => {
  await mockServices(page, 'en', false, { requesterInspection: true });
  const operations = await mockWorkplaceServiceOperations(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/workplace/service-orders?order=${ORDER_ID}`);

  const inspection = page.getByTestId('workplace-service-inspection-panel');
  await expect(inspection).toBeVisible();
  await inspection.getByRole('checkbox', { name: 'Equipment ready' }).check();
  await inspection.getByRole('textbox', { name: 'Acceptance note' }).fill('Verified in the room');
  await inspection
    .getByRole('checkbox', { name: /completed service and checklist evidence/u })
    .check();
  await inspection.getByRole('button', { name: 'Accept service' }).click();

  await expect.poll(() => operations.inspectionRequests).toHaveLength(1);
  expect(operations.inspectionRequests[0]?.body).toEqual({
    decision: 'PASSED',
    checklistResponses: { equipment_ready: true },
    attachmentIds: [],
    expectedOrderVersion: 7,
    expectedTaskVersion: 4,
    explicitConfirmation: true,
    reason: 'Verified in the room',
  });
  await expect(inspection.getByText('Accepted', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
});

test('persists bucketed catalog policy before publishing provider-backed capacity', async ({
  page,
}) => {
  const services = await mockServices(page, 'en');
  const operations = await mockWorkplaceServiceOperations(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/workplace/admin/service-catalog');
  await page.getByRole('button', { name: 'Edit' }).click();
  const editor = page.getByTestId('workplace-service-catalog-editor');

  await editor.getByRole('combobox', { name: 'Capacity mode' }).click();
  await page.getByRole('option', { name: 'Time buckets' }).click();
  await editor
    .getByRole('textbox', { name: 'Change reason' })
    .last()
    .fill('Enable verified time-slot capacity');
  await editor
    .getByRole('checkbox', {
      name: /provider truth, site scope, options, pricing, cutoff, and cancellation policy/u,
    })
    .check();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();

  await expect.poll(services.catalogUpdatePosts).toBe(1);
  await expect(editor.getByRole('heading', { name: 'Capacity by time slot' })).toBeVisible();
  await expect.poll(() => operations.capacityQueries).toHaveLength(1);
  const capacity = editor.getByTestId('workplace-service-capacity-admin');
  await capacity.getByRole('spinbutton', { name: 'Capacity limit' }).fill('12');
  await capacity
    .getByRole('textbox', { name: 'Change reason' })
    .fill('Publish the provider capacity evidence');
  await capacity
    .getByRole('checkbox', { name: /totals match the provider-backed capacity source/u })
    .check();
  await capacity.getByRole('button', { name: 'Save capacity' }).click();

  await expect.poll(() => operations.capacityRequests).toHaveLength(1);
  expect(operations.capacityRequests[0]?.body).toEqual({
    siteReference: SITE_ID,
    buckets: [
      {
        startsAt: '2026-09-17T01:00:00Z',
        endsAt: '2026-09-17T02:00:00Z',
        capacityLimit: 12,
        sourceVersion: 'capacity-v18',
        sourceObservedAt: '2026-09-17T00:59:00Z',
      },
    ],
    explicitConfirmation: true,
    reason: 'Publish the provider capacity evidence',
  });
  expect(operations.capacityRequests[0]?.url).toContain(
    `/v1/admin/workplace/service-catalog/${ITEM_ID}/capacity`
  );
  expect(operations.capacityRequests[0]?.headers['x-dwp-active-access-mode']).toBe('ELEVATED');
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
});
