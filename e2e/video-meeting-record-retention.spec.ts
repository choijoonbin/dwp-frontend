import { expect, test, type Page, type Route } from '@playwright/test';
import {
  mockMeetingVisualAdminReadiness,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

const ID = '96000000-0000-4000-8000-000000000001';
const endpoint = `**/api/meetings/v1/admin/record-retention/meetings/${ID}`;
const initial = {
  meetingId: ID,
  meetingVersion: 5,
  policyVersion: 8,
  controlVersion: 0,
  retentionUntil: '2026-08-01T00:00:00Z',
  hold: false,
  purgeAuthorized: false,
  state: 'UNCONFIGURED',
  reasons: ['AUTHORIZATION_AUDIT_NOT_PUBLISHED'],
  authorizationAuditPublished: false,
  workerEnabled: false,
  purgedAt: null,
};
function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      success: status < 400,
      status: status < 400 ? 'SUCCESS' : 'ERROR',
      message: 'Retention response',
      data,
    }),
  });
}
async function open(page: Page, handler: (route: Route) => Promise<unknown>) {
  await mockMeetingVisualSession(page, { locale: 'en', admin: true, reducedMotion: true });
  await mockMeetingVisualAdminReadiness(page, 'BLOCKED');
  await page.route(endpoint, handler);
  await page.goto('/meetings/admin/intelligence');
  await expect(page.getByRole('progressbar', { name: /Loading page/u })).toHaveCount(0, {
    timeout: 15_000,
  });
  const control = page.getByTestId('meeting-record-retention-control');
  await expect(control).toBeVisible();
  await control.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await control.getByLabel('Meeting reference (UUID)').fill(ID);
  await control.getByRole('button', { name: 'Look up current record' }).click();
  return control;
}
async function confirm(page: Page, label: string) {
  await page
    .getByTestId('meeting-record-retention-control')
    .getByRole('button', { name: label, exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: label, exact: true });
  const apply = dialog.getByRole('button', { name: 'Apply this disposition' });
  await expect(apply).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await expect(apply).toBeEnabled();
  await apply.click();
}

test('current metadata, explicit acknowledgement and version-bound hold/approval are connected without immediate deletion', async ({
  page,
}) => {
  let current = { ...initial };
  const writes: { body: Record<string, unknown>; key: string | undefined }[] = [];
  const control = await open(page, async (route) => {
    if (route.request().method() === 'GET') return fulfill(route, current);
    const body = route.request().postDataJSON();
    writes.push({ body, key: route.request().headers()['idempotency-key'] });
    current = {
      ...current,
      hold: body.hold,
      purgeAuthorized: body.purgeAuthorized,
      state: body.hold ? 'HELD' : 'UNCONFIGURED',
      controlVersion: current.controlVersion + 1,
    };
    return fulfill(route, current);
  });
  await expect(
    control.getByText('Disabled — no automatic deletion', { exact: false })
  ).toBeVisible();
  await confirm(page, 'Hold record deletion');
  await expect(
    control.getByRole('button', { name: 'Approve eligible record deletion' })
  ).toBeDisabled();
  await confirm(page, 'Release record hold');
  await confirm(page, 'Approve eligible record deletion');
  await expect(control.getByRole('button', { name: 'Revoke deletion approval' })).toBeVisible();
  expect(writes.map(({ body }) => body)).toEqual([
    {
      expectedMeetingVersion: 5,
      expectedPolicyVersion: 8,
      expectedControlVersion: 0,
      hold: true,
      purgeAuthorized: false,
    },
    {
      expectedMeetingVersion: 5,
      expectedPolicyVersion: 8,
      expectedControlVersion: 1,
      hold: false,
      purgeAuthorized: false,
    },
    {
      expectedMeetingVersion: 5,
      expectedPolicyVersion: 8,
      expectedControlVersion: 2,
      hold: false,
      purgeAuthorized: true,
    },
  ]);
  expect(new Set(writes.map(({ key }) => key)).size).toBe(3);
  expect(writes.every(({ key }) => /^[0-9a-f-]{36}$/u.test(key ?? ''))).toBe(true);
  await expectNoHorizontalOverflow(page, 'record disposition');
  await expectNoBlockingA11y(page, 'record disposition');
});

test('uncertain approval retries the identical body and key before any new disposition', async ({
  page,
}) => {
  const writes: { body: unknown; key: string | undefined }[] = [];
  const control = await open(page, async (route) => {
    if (route.request().method() === 'GET') return fulfill(route, initial);
    writes.push({
      body: route.request().postDataJSON(),
      key: route.request().headers()['idempotency-key'],
    });
    return writes.length === 1
      ? fulfill(route, null, 503)
      : fulfill(route, {
          ...initial,
          controlVersion: 1,
          purgeAuthorized: true,
          state: 'UNCONFIGURED',
        });
  });
  await expect(
    control.getByRole('button', { name: 'Approve eligible record deletion' })
  ).toBeEnabled();
  await confirm(page, 'Approve eligible record deletion');
  await expect(control.getByText('The command outcome is not yet confirmed')).toBeVisible();
  await expect(control.getByRole('button', { name: 'Look up current record' })).toBeDisabled();
  await expect(control.getByText(/Meeting v5/u)).toHaveCount(0);
  await control.getByRole('button', { name: 'Resolve the same command' }).click();
  await expect(control.getByRole('button', { name: 'Revoke deletion approval' })).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
});

test('access denial clears previously visible administrative metadata and mutation controls', async ({
  page,
}) => {
  let reads = 0;
  const control = await open(page, (route) =>
    fulfill(route, ++reads === 1 ? initial : null, reads === 1 ? 200 : 403)
  );
  await expect(control.getByText(/Meeting v5/u)).toBeVisible();
  await control.getByRole('button', { name: 'Look up current record' }).click();
  await expect(control.getByText('Access to this record is no longer available')).toBeVisible();
  await expect(control.getByText(/Meeting v5/u)).toHaveCount(0);
  await expect(control.getByRole('button', { name: 'Hold record deletion' })).toHaveCount(0);
});

test('a changed snapshot needs a fresh lookup and never leaves the old approval actionable', async ({
  page,
}) => {
  const control = await open(page, (route) =>
    route.request().method() === 'GET' ? fulfill(route, initial) : fulfill(route, null, 409)
  );
  await expect(control.getByRole('button', { name: 'Hold record deletion' })).toBeEnabled();
  await confirm(page, 'Hold record deletion');
  await expect(control.getByText('The record or policy changed')).toBeVisible();
  await expect(control.getByText(/Meeting v5/u)).toHaveCount(0);
  await expect(control.getByRole('button', { name: 'Hold record deletion' })).toHaveCount(0);
  await expect(control.getByRole('button', { name: 'Look up current record' })).toBeEnabled();
});

test('future retention stays unapprovable and the explicit control remains usable at 320px and double text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const control = await open(page, (route) =>
    fulfill(route, {
      ...initial,
      retentionUntil: '2036-01-01T00:00:00Z',
      reasons: ['RECORD_RETENTION_NOT_EXPIRED'],
    })
  );
  await expect(
    control.getByRole('button', { name: 'Approve eligible record deletion' })
  ).toBeDisabled();
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expectNoHorizontalOverflow(page, 'record disposition 320px double text');
  await expectNoBlockingA11y(page, 'record disposition 320px double text');
});

test('a purged tombstone exposes evidence only and cannot issue further mutations', async ({
  page,
}) => {
  let writes = 0;
  const control = await open(page, (route) => {
    if (route.request().method() !== 'GET') writes++;
    return fulfill(route, {
      ...initial,
      controlVersion: 2,
      state: 'PURGED',
      purgeAuthorized: true,
      authorizationAuditPublished: true,
      reasons: [],
      purgedAt: '2026-08-30T00:00:00Z',
    });
  });
  await expect(control.getByText('Record deletion evidence available')).toBeVisible();
  await expect(control.getByRole('button', { name: 'Hold record deletion' })).toBeDisabled();
  await expect(control.getByRole('button', { name: 'Revoke deletion approval' })).toBeDisabled();
  expect(writes).toBe(0);
});
