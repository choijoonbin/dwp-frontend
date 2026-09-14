import {
  booking,
  floor,
  floorId,
  metadata,
  pageData,
  resource,
  resourceId,
  site,
  siteId,
  setup,
} from './support/workplace-admin-experience-harness';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { fulfillSuccess } from './support/shell-session';
import type { Page } from '@playwright/test';

async function stableViewport(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  if (width < 1200)
    await expect
      .poll(async () =>
        page
          .locator('main')
          .first()
          .evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return Math.abs(rect.x) < 1 && Math.abs(rect.width - window.innerWidth) < 1;
          })
      )
      .toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
}

test('overview exceptions open native detail, insights support keyboard and CSV', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/workplace/admin/overview');
  await expect(page.getByRole('heading', { name: 'Priority exceptions' })).toBeVisible();
  await page
    .getByRole('region', { name: 'Priority exceptions', exact: true })
    .getByRole('button', { name: 'Review', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Booking detail and action review' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.goto('/workplace/admin/overview?view=insights');
  const cell = page.getByRole('button', { name: /2026-09-14 8:00/u });
  await expect
    .poll(() =>
      page
        .getByRole('region', { name: 'Daily booking utilization', exact: true })
        .locator('svg rect')
        .evaluateAll((nodes) => nodes[0]?.getBoundingClientRect().width ?? 0)
    )
    .toBeGreaterThan(0);
  await cell.focus();
  await page.keyboard.press('Enter');
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/u);
});

test('native booking policy review recovers from conflict with the draft preserved', async ({
  page,
}) => {
  const state = await setup(page, { policyConflict: true });
  await page.goto('/workplace/admin/policies');
  await page.getByRole('button', { name: 'Operating hours and duration', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Minimum duration (min)' }).fill('45');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Policy change impact' });
  await dialog.getByRole('button', { name: 'Review change impact' }).click();
  await dialog
    .getByRole('textbox', { name: 'Reason for change' })
    .fill('Native policy fixture approval');
  await dialog
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    })
    .check();
  await dialog.getByRole('button', { name: 'Save reviewed change' }).click();
  await dialog.getByRole('button', { name: 'Reload current values' }).click();
  await dialog.getByRole('button', { name: 'Review change impact' }).click();
  await dialog
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    })
    .check();
  await dialog.getByRole('button', { name: 'Save reviewed change' }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]?.body).toMatchObject({
    proposed: { minimumBookingMinutes: 45, version: 3 },
    confirmed: true,
  });
});
test('policy subject editing compares native fields, previews actual bookings and saves the reviewed draft', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/workplace/admin/policies');
  await page.getByRole('button', { name: 'Operating hours and duration', exact: true }).click();
  const editor = page.getByTestId('policy-editor');
  await editor.getByRole('spinbutton', { name: 'Minimum duration (min)' }).fill('45');
  await page.getByRole('button', { name: 'Advance booking window', exact: true }).click();
  await editor.getByRole('spinbutton', { name: 'Advance booking window', exact: true }).fill('45');
  await editor.getByRole('spinbutton', { name: 'Maximum consecutive days', exact: true }).fill('6');
  await editor.getByRole('switch', { name: 'Allow recurring bookings', exact: true }).check();
  const rail = page.getByRole('complementary', { name: 'Change review', exact: true });
  await expect(
    rail
      .getByRole('region', { name: 'Current values', exact: true })
      .getByText('30', { exact: true })
  ).toHaveCount(2);
  await expect(
    rail
      .getByRole('region', { name: 'Proposed values', exact: true })
      .getByText('45', { exact: true })
  ).toHaveCount(2);
  const preview = page.getByRole('region', { name: 'Policy change impact', exact: true });
  await preview.getByRole('button', { name: 'Preview policy impact', exact: true }).click();
  await expect(
    preview.getByText('Below the proposed minimum duration', { exact: true })
  ).toBeVisible();
  await expect.poll(() => state.policyPreviews.length).toBe(1);
  expect(state.policyPreviews[0]).toMatchObject({
    siteId,
    minimumBookingMinutes: '45',
    page: '0',
    size: '20',
  });
  await expect(preview.getByRole('img')).toBeVisible();
  await page.getByRole('button', { name: 'Operating hours and duration', exact: true }).click();
  const axe = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    axe.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? '')),
    JSON.stringify(axe.violations)
  ).toEqual([]);
  for (const width of [1440, 1280, 390, 320, 640]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page
          .locator('main')
          .first()
          .evaluate((element) => {
            const sidebar = document.querySelector('[data-testid="rooms-sidebar"]')!;
            const offset = window.innerWidth >= 1200 ? sidebar.getBoundingClientRect().width : 0;
            const rect = element.getBoundingClientRect();
            return (
              Math.abs(rect.x - offset) < 1 &&
              Math.abs(rect.width - (window.innerWidth - offset)) < 1
            );
          })
      )
      .toBe(true);
    if (width < 1200)
      await expect
        .poll(() =>
          page
            .locator('main')
            .first()
            .evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return Math.abs(rect.x) < 1 && Math.abs(rect.width - window.innerWidth) < 1;
            })
        )
        .toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({
      path: `/tmp/workplace-policy-reflection-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Policy change impact', exact: true });
  await dialog.getByRole('button', { name: 'Review change impact', exact: true }).click();
  await dialog
    .getByRole('textbox', { name: 'Reason for change', exact: true })
    .fill('Native booking limits and hours review');
  await dialog
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    })
    .check();
  await dialog.getByRole('button', { name: 'Save reviewed change', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]?.body).toMatchObject({
    proposed: {
      bookingWindowDays: 45,
      minimumBookingMinutes: 45,
      maximumConsecutiveDays: 6,
      allowRecurring: true,
      version: 2,
    },
    reason: 'Native booking limits and hours review',
    confirmed: true,
  });
});

test('facility closures retain bookings and request status uses reason and optimistic version', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/workplace/admin/operations?view=facilities');
  await page
    .getByRole('region', { name: 'Spaces to work on' })
    .getByRole('button', { name: /QA desk/u })
    .click();
  await page.getByRole('textbox', { name: 'Closure reason' }).fill('Fixture scheduled maintenance');
  await page
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    })
    .check();
  await page.getByRole('button', { name: 'Schedule closure' }).click();
  await expect(page.getByRole('button', { name: /Fixture scheduled maintenance/u })).toBeVisible();
  expect(state.writes[0]).toMatchObject({
    body: { version: 1, reason: 'Fixture scheduled maintenance', confirmed: true },
  });
  expect(state.writes[0]?.key).toBeTruthy();
  const created = state.writes[0]!.body;
  // A fresh page proposes a later start than the already persisted closure.
  await page.reload();
  await page
    .getByRole('region', { name: 'Spaces to work on' })
    .getByRole('button', { name: /QA desk/u })
    .click();
  await expect.poll(() => state.impacts.at(-1)?.from).not.toBe(created.startsAt);
  const closurePanel = page.getByRole('region', { name: 'Scheduled space closure', exact: true });
  await closurePanel.getByRole('button', { name: /Fixture scheduled maintenance/u }).click();
  await expect.poll(() => state.detailReads).toBeGreaterThan(0);
  await expect
    .poll(() => state.impacts.at(-1))
    .toEqual({ from: created.startsAt, to: created.endsAt });
  await expect(closurePanel.getByRole('button', { name: /^Choose date/u }).first()).toBeDisabled();
  await closurePanel
    .getByRole('textbox', { name: 'Cancellation reason', exact: true })
    .fill('Fixture maintenance completed');
  await closurePanel
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    })
    .check();
  await closurePanel.getByRole('button', { name: 'Cancel closure', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[1]?.body).toEqual({
    version: 0,
    reason: 'Fixture maintenance completed',
    confirmed: true,
  });
  const requests = page.getByRole('region', { name: 'Facility requests', exact: true });
  await requests.getByRole('button', { name: /QA desk/u }).click();
  await requests
    .getByRole('textbox', { name: 'Reason for change' })
    .fill('Fixture engineer dispatched');
  await requests
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    })
    .check();
  await requests.getByRole('button', { name: 'Change status', exact: true }).click();
  await expect(requests.getByText('Fixture engineer dispatched')).toBeVisible();
  expect(state.writes[2]?.body).toMatchObject({
    status: 'IN_PROGRESS',
    version: 0,
    reason: 'Fixture engineer dispatched',
    confirmed: true,
  });
  let releaseStatus!: () => void;
  state.statusGate = new Promise<void>((resolve) => {
    releaseStatus = resolve;
  });
  state.statusFailure = true;
  await requests.getByRole('combobox', { name: /^Change status/u }).click();
  await page.getByRole('option', { name: 'Resolved', exact: true }).click();
  await requests
    .getByRole('textbox', { name: 'Reason for change' })
    .fill('Fixture repair verified');
  await requests
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    })
    .check();
  await requests.getByRole('button', { name: 'Change status', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(4);
  const queueFilter = requests.getByRole('combobox', { name: 'Status', exact: true });
  await expect(queueFilter).toBeDisabled();
  releaseStatus();
  await expect(
    requests.getByText(
      'The save result is unknown. Check the current values and audit before submitting again.'
    )
  ).toBeVisible();
  await expect(queueFilter).toBeDisabled();
  await expect(requests.getByRole('button', { name: 'Close', exact: true })).toBeDisabled();
  await expect(requests.getByRole('button', { name: 'Change status', exact: true })).toBeDisabled();
  expect(state.writes[3]?.body).toEqual({
    status: 'RESOLVED',
    version: 1,
    reason: 'Fixture repair verified',
    confirmed: true,
  });
  await requests.getByRole('button', { name: 'Reload current values', exact: true }).click();
  await expect(queueFilter).toBeEnabled();
  await expect(
    requests.getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    })
  ).not.toBeChecked();
  await expect(requests.getByRole('button', { name: 'Change status', exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(4);
});

test('partial report and impact failures hide data and block dependent writes until recovery', async ({
  page,
}) => {
  const state = await setup(page, { reportFailure: true, impactFailure: true });
  await page.goto('/workplace/admin/overview?view=insights');
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  state.reportFailure = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
  for (const status of [403, 404]) {
    state.floorFailureStatus = status;
    await page.getByRole('combobox', { name: /^Floor/u }).click();
    await page.getByRole('option', { name: 'QA floor', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
    await expect(page.getByText('Total bookings', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /^Floor/u })).toBeVisible();
    await page.getByRole('combobox', { name: /^Floor/u }).click();
    await page.getByRole('option', { name: 'All floors', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
    expect(new URL(page.url()).searchParams.has('floor')).toBe(false);
  }
  await page.goto('/workplace/admin/operations?view=facilities');
  await page
    .getByRole('region', { name: 'Spaces to work on' })
    .getByRole('button', { name: /QA desk/u })
    .click();
  await expect(page.getByRole('button', { name: 'Schedule closure' })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});

test('admin overview, insights, policy and facilities reflow and pass scoped Axe in dark contrast reduced motion', async ({
  page,
}) => {
  await setup(page, { dark: true });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [key, path] of [
    ['overview', '/workplace/admin/overview'],
    ['insights', '/workplace/admin/overview?view=insights'],
    ['policy', '/workplace/admin/policies'],
    ['facilities', '/workplace/admin/operations?view=facilities'],
  ] as const) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (key === 'insights')
      await expect(page.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
    if (key === 'policy')
      await expect(
        page.getByRole('region', { name: 'Room approval rules', exact: true })
      ).toBeVisible();
    if (key === 'facilities') {
      await page
        .getByRole('region', { name: 'Spaces to work on' })
        .getByRole('button', { name: /QA desk/u })
        .click();
      await expect(page.getByRole('region', { name: 'Scheduled space closure' })).toBeVisible();
    }
    for (const width of [1440, 1280, 390, 320, 640]) {
      await stableViewport(page, width);
      await page.screenshot({
        path: `/tmp/workplace-admin-${key}-${width}-dark-hc-rm.png`,
        fullPage: true,
      });
    }
    const axe = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      axe.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? '')),
      JSON.stringify(
        axe.violations.map((issue) => ({
          id: issue.id,
          nodes: issue.nodes.map((node) => node.target),
        }))
      )
    ).toEqual([]);
  }
});

test('member facility request posts a single authorized resource request with retry key', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto(`/workplace/explore?floor=${floorId}&resource=${resourceId}`);
  await stableViewport(page, 390);
  await page.getByRole('button', { name: 'Facility request', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Facility request', exact: true });
  await dialog.getByRole('textbox', { name: 'Description' }).fill('Fixture loose desk bracket');
  await dialog.getByRole('button', { name: 'Submit request', exact: true }).click();
  await expect(dialog.getByText(/Your facility request was submitted/u)).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]?.path).toBe(
    `/api/platform/v1/workplace/experience/facilities/resources/${resourceId}/requests`
  );
  expect(state.writes[0]?.body).toEqual({
    category: 'REPAIR',
    description: 'Fixture loose desk bracket',
  });
  expect(state.writes[0]?.key).toBeTruthy();
  await page.screenshot({ path: '/tmp/workplace-member-facility-request-390.png', fullPage: true });
});

test('registered photo uses authoritative alt/version and editing invalidates confirmation', async ({
  page,
}) => {
  await setup(page);
  let registered = false;
  let uploadBody = '';
  let metadataDenied = false;
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=',
    'base64'
  );
  const photo = {
    resourceId,
    url: '',
    altText: 'Fixture registered south entrance',
    contentType: 'image/png',
    sizeBytes: png.length,
    sha256: 'qa-photo-sha',
    version: 9,
  };
  await page.route(
    `**/api/platform/v1/admin/workplace/experience/collaboration/resources/${resourceId}/photo**`,
    async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        uploadBody = request.postData() ?? '';
        registered = true;
        return fulfillSuccess(route, photo);
      }
      if (metadataDenied)
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'FORBIDDEN', message: 'Fixture permission changed' }),
        });
      if (!registered)
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'NOT_FOUND' }),
        });
      if (new URL(request.url()).pathname.endsWith('/metadata'))
        return fulfillSuccess(route, photo);
      return route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'image/png', ETag: '"qa-photo-sha"' },
        body: png,
      });
    }
  );
  await page.goto(
    `/workplace/admin/locations?site=${siteId}&floor=${floorId}&resource=${resourceId}`
  );
  const inspector = page.getByTestId('workplace-location-resource-inspector');
  await expect(inspector).toBeVisible();
  for (const width of [1280, 390]) {
    await stableViewport(page, width);
    const closureDisclosure = inspector.getByRole('button', {
      name: 'Scheduled space closure',
      exact: true,
    });
    if ((await closureDisclosure.getAttribute('aria-expanded')) !== 'true')
      await closureDisclosure.click();
    await expect(
      inspector.getByRole('region', { name: 'Scheduled space closure', exact: true })
    ).toBeVisible();
    await page.screenshot({
      path: `/tmp/workplace-admin-resource-closure-${width}.png`,
      fullPage: true,
    });
  }
  await inspector.getByRole('button', { name: 'Manage space photo', exact: true }).click();
  await inspector
    .getByLabel(/Photo file/u)
    .setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: png });
  await inspector
    .getByRole('textbox', { name: 'Photo description', exact: true })
    .fill(photo.altText);
  await inspector
    .getByRole('textbox', { name: 'Reason for change', exact: true })
    .fill('Fixture actual photo registration');
  const confirmation = inspector
    .getByRole('region', { name: 'Space photo', exact: true })
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    });
  await confirmation.check();
  await inspector
    .getByRole('textbox', { name: 'Photo description', exact: true })
    .fill('Changed proposal');
  await expect(confirmation).not.toBeChecked();
  await inspector
    .getByRole('textbox', { name: 'Photo description', exact: true })
    .fill(photo.altText);
  await confirmation.check();
  await inspector.getByRole('button', { name: 'Upload photo', exact: true }).click();
  await expect(inspector.getByRole('img', { name: photo.altText, exact: true })).toBeVisible();
  expect(uploadBody).toContain('name="version"');
  expect(uploadBody).toContain('name="reason"');
  expect(uploadBody).toContain('Fixture actual photo registration');
  expect(uploadBody).toContain('name="altText"');
  metadataDenied = true;
  await page.reload();
  await expect(
    page
      .getByTestId('workplace-location-resource-inspector')
      .getByRole('img', { name: photo.altText })
  ).toHaveCount(0);
  await expect(
    page
      .getByTestId('workplace-location-resource-inspector')
      .getByText('Photo unavailable', { exact: true })
  ).toBeVisible();
});

test('polished admin loaded compositions link scope and actual hourly slots across desktop and mobile', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await setup(page);
  for (const [key, path] of [
    ['overview', '/workplace/admin/overview'],
    ['insights', '/workplace/admin/overview?view=insights'],
    ['facilities', '/workplace/admin/operations?view=facilities'],
  ] as const) {
    await page.goto(path);
    if (key === 'overview') {
      await expect(
        page.getByRole('img', { name: /QA floor.*registered resources/u })
      ).toBeVisible();
      await page
        .getByRole('region', { name: 'Utilization by floor' })
        .getByRole('button', { name: 'QA floor', exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`floor=${floorId}`, 'u'));
    }
    if (key === 'insights')
      await expect(page.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
    if (key === 'facilities')
      await page
        .getByRole('region', { name: 'Spaces to work on' })
        .getByRole('button', { name: /QA desk/u })
        .click();
    for (const width of [1440, 1280, 390, 320]) {
      await stableViewport(page, width);
      if (key === 'insights') {
        const cell = page
          .getByRole('button', { name: /2026-09-14 9:00/u })
          .filter({ visible: true });
        await cell.click();
        await expect(cell).toHaveAttribute('aria-pressed', 'true');
        await expect(
          page.getByRole('region', { name: 'Selected period', exact: true })
        ).toContainText('9:00');
      }
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.scrollTo(0, 0);
        document.querySelector('main')?.scrollTo(0, 0);
      });
      await page.screenshot({
        path: `/tmp/workplace-admin-polished-${key}-${width}-light.png`,
        fullPage: true,
      });
      const axe = await new AxeBuilder({ page }).include('main').analyze();
      expect(
        axe.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
      ).toEqual([]);
    }
  }
});

test('global operations scope sends canonical site and floor, opens exact native detail and follows URL tabs both ways', async ({
  page,
}) => {
  await setup(page);
  const reads: Record<string, string>[] = [];
  const row = {
    ...booking,
    siteName: site.name,
    floorName: floor.name,
    userId: 7,
    personPublicId: null,
    bookedForDisplayName: 'QA booking owner',
    purpose: 'QA booking purpose',
    visibleToColleagues: false,
    cancelledAt: null,
    personalDataExpiresAt: '2027-09-14T00:00:00Z',
    anonymizedAt: null,
    createdAt: metadata.generatedAt,
  };
  await page.route('**/api/platform/v1/admin/workplace/bookings?*', (route) => {
    reads.push(Object.fromEntries(new URL(route.request().url()).searchParams));
    return fulfillSuccess(route, pageData([row]));
  });
  await page.route('**/api/platform/v1/admin/workplace/audit-events?*', (route) =>
    fulfillSuccess(route, pageData([]))
  );
  await page.goto('/workplace/admin/operations?view=bookings');
  await page.getByRole('combobox', { name: 'Building', exact: true }).click();
  await page.getByRole('option', { name: site.name, exact: true }).click();
  await page.getByRole('combobox', { name: 'Floor', exact: true }).click();
  await page.getByRole('option', { name: floor.name, exact: true }).click();
  await expect.poll(() => reads.at(-1)).toMatchObject({ siteId, floorId });
  await page.getByRole('table').getByRole('button', { name: resource.name, exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Booking detail and action review' })
  ).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.getByRole('tab', { name: 'Audit trail', exact: true }).click();
  await expect(page).toHaveURL(/view=audit/u);
  await page.getByRole('link', { name: 'Bookings', exact: true }).click();
  await expect(page).toHaveURL(/view=bookings/u);
  await expect(page.getByRole('tab', { name: 'Bookings', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByRole('tab', { name: 'Audit trail', exact: true })).toHaveAttribute(
    'aria-selected',
    'false'
  );
  for (const width of [1440, 1280, 390, 320]) {
    await stableViewport(page, width);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `/tmp/workplace-admin-polished-operations-${width}-light.png`,
      fullPage: true,
    });
    const axe = await new AxeBuilder({ page }).include('main').analyze();
    expect(
      axe.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
    ).toEqual([]);
  }
});

test('scoped operations closes rows when an older producer omits canonical location identity', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/platform/v1/admin/workplace/bookings?*', (route) =>
    fulfillSuccess(
      route,
      pageData([
        {
          ...booking,
          siteId: undefined,
          floorId: undefined,
          siteName: site.name,
          floorName: floor.name,
          userId: 7,
          bookedForDisplayName: 'Legacy QA owner',
          visibleToColleagues: false,
        },
      ])
    )
  );
  await page.goto(`/workplace/admin/operations?view=bookings&site=${siteId}&floor=${floorId}`);
  await expect(page.getByText('Could not load this information.')).toBeVisible();
  await expect(page.locator('main').getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Force cancel', exact: true })).toHaveCount(0);
});
