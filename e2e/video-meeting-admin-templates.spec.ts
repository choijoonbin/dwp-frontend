import { expect, test, type Page, type Route } from '@playwright/test';
import ko from '../libs/shared-i18n/src/locales/ko/meetings.json' with { type: 'json' };
import en from '../libs/shared-i18n/src/locales/en/meetings.json' with { type: 'json' };
import { mockApprovedAdmin } from './support/meeting-approved-frame-evidence-fixtures';
import { mockMeetingVisualSession } from './support/video-meeting-visual-fixtures';
import {
  expectMinimumTarget,
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

const id = '88000000-0000-4000-8000-000000000911';
const initial = {
  templateId: id,
  scope: 'ORGANIZATION',
  name: 'Global decision review',
  purpose: 'Agree the launch owners.',
  category: 'DECISION',
  durationMinutes: 30,
  agendaItems: [
    {
      title: 'Decision and owners',
      description: 'Review the evidence.',
      role: 'Facilitator',
      durationMinutes: 20,
    },
  ],
  favorite: false,
  canEdit: true,
  version: 2,
  updatedAt: '2026-09-08T00:00:00Z',
};
function reply(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      status: status < 400 ? 'SUCCESS' : 'ERROR',
      success: status < 400,
      message: status < 400 ? 'OK' : 'Unavailable',
      data,
    }),
  });
}
async function setup(page: Page, mobile: boolean) {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 });
  await mockApprovedAdmin(page, true);
}
const adminPath = '/meetings/admin/policies?section=templates';

test('organization templates create edit and delete through the admin API with version and explicit confirmation', async ({
  page,
}, info) => {
  await setup(page, info.project.name === 'mobile');
  let current: typeof initial | null = null;
  const writes: {
    method: string;
    body: Record<string, unknown> | null;
    url: string;
    key: string | undefined;
  }[] = [];
  await page.route('**/api/meetings/v1/admin/templates**', async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === 'GET')
      return reply(
        route,
        new URL(request.url()).pathname.endsWith('/' + id)
          ? current
          : { items: current ? [current] : [], total: current ? 1 : 0, page: 0, pageSize: 20 }
      );
    const body = method === 'DELETE' ? null : (request.postDataJSON() as Record<string, unknown>);
    writes.push({ method, body, url: request.url(), key: request.headers()['idempotency-key'] });
    if (method === 'DELETE') {
      current = null;
      return reply(route, { resourceId: id, version: 4, deleted: true });
    }
    current = {
      ...initial,
      ...(method === 'POST' ? body : (body?.template as object)),
      version: method === 'POST' ? 2 : 3,
    };
    return reply(route, current);
  });
  await page.goto('/meetings/admin/policies');
  const tab = page.getByRole('tab', { name: ko.admin.templates.title, exact: true });
  await expectMinimumTarget(tab, 'organization templates tab');
  await tab.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL((url) => url.searchParams.get('section') === 'templates');
  await expect(page.getByText(ko.admin.templates.empty, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: ko.admin.templates.create, exact: true }).click();
  await page
    .getByRole('textbox', { name: ko.templates.fields.name, exact: false })
    .fill('Organization planning');
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: ko.templates.save, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Organization planning', exact: true })
  ).toBeVisible();
  expect(writes[0]).toMatchObject({
    method: 'POST',
    body: { name: 'Organization planning', agendaItems: [] },
  });
  expect(writes[0].key).toMatch(/^[\da-f-]{36}$/u);
  await page.getByRole('button', { name: ko.templates.edit, exact: true }).click();
  await page
    .getByRole('textbox', { name: ko.templates.fields.purpose, exact: true })
    .fill('Review the regional owners.');
  await page.getByRole('button', { name: ko.templates.save, exact: true }).click();
  await expect(page.getByText('Review the regional owners.', { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('U14-organization-template-selected.png'),
    fullPage: true,
  });
  expect(writes[1]).toMatchObject({
    method: 'PUT',
    body: {
      expectedVersion: 2,
      template: { name: 'Organization planning', purpose: 'Review the regional owners.' },
    },
  });
  await page.getByRole('button', { name: ko.templates.delete, exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: ko.admin.templates.deleteTitle });
  await expect(confirmation).toBeVisible();
  expect(writes).toHaveLength(2);
  await confirmation.getByRole('button', { name: ko.actions.cancel, exact: true }).click();
  expect(writes).toHaveLength(2);
  await page.getByRole('button', { name: ko.templates.delete, exact: true }).click();
  await confirmation.getByRole('button', { name: ko.templates.delete, exact: true }).click();
  await expect(page.getByText(ko.admin.templates.empty, { exact: true })).toBeVisible();
  expect(writes[2].method).toBe('DELETE');
  expect(new URL(writes[2].url).searchParams.get('expectedVersion')).toBe('3');
  await expectNoHorizontalOverflow(page, 'organization template CRUD');
  await expectNoBlockingA11y(page, 'organization template CRUD');
  await page.screenshot({
    path: info.outputPath('U14-organization-template-empty.png'),
    fullPage: true,
  });
});

test('organization template conflicts retain the draft and require reopening the authoritative revision', async ({
  page,
}, info) => {
  await setup(page, info.project.name === 'mobile');
  let current = { ...initial };
  const versions: number[] = [];
  await page.route('**/api/meetings/v1/admin/templates**', (route) => {
    const request = route.request();
    if (request.method() === 'GET')
      return reply(
        route,
        new URL(request.url()).pathname.endsWith('/' + id)
          ? current
          : { items: [current], total: 1, page: 0, pageSize: 20 }
      );
    const body = request.postDataJSON();
    versions.push(body.expectedVersion);
    if (versions.length === 1) {
      current = { ...initial, version: 3, purpose: 'A different administrator updated this.' };
      return reply(route, null, 409);
    }
    current = { ...current, ...body.template, version: 4 };
    return reply(route, current);
  });
  await page.goto(adminPath);
  await page.getByRole('button', { name: ko.templates.edit, exact: true }).click();
  await page
    .getByRole('textbox', { name: ko.templates.fields.name, exact: false })
    .fill('My unsaved proposal');
  await page.getByRole('button', { name: ko.templates.save, exact: true }).click();
  await expect(page.getByText(ko.admin.templates.conflict, { exact: true })).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: ko.templates.fields.name, exact: false })
  ).toHaveValue('My unsaved proposal');
  await expect(page.getByRole('button', { name: ko.templates.save, exact: true })).toBeDisabled();
  expect(versions).toEqual([2]);
  await page
    .getByRole('dialog', { name: ko.templates.edit, exact: true })
    .getByRole('button', { name: ko.actions.cancel, exact: true })
    .click();
  await page
    .getByRole('dialog', { name: ko.templates.discardTitle, exact: true })
    .getByRole('button', { name: ko.templates.discard, exact: true })
    .click();
  await page.getByRole('button', { name: ko.templates.edit, exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: ko.templates.fields.purpose, exact: true })
  ).toHaveValue('A different administrator updated this.');
  await page
    .getByRole('textbox', { name: ko.templates.fields.name, exact: false })
    .fill('Reviewed with latest version');
  await page.getByRole('button', { name: ko.templates.save, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Reviewed with latest version', exact: true })
  ).toBeVisible();
  expect(versions).toEqual([2, 3]);
});

test('organization template query and delete failures recover without claiming success or changing retry identity', async ({
  page,
}, info) => {
  await setup(page, info.project.name === 'mobile');
  let listFails = true;
  let detailFails = true;
  let deletes = 0;
  const keys: string[] = [];
  await page.route('**/api/meetings/v1/admin/templates**', (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      if (new URL(request.url()).pathname.endsWith('/' + id))
        return reply(route, detailFails ? null : initial, detailFails ? 503 : 200);
      return reply(
        route,
        listFails
          ? null
          : {
              items: deletes > 1 ? [] : [initial],
              total: deletes > 1 ? 0 : 1,
              page: 0,
              pageSize: 20,
            },
        listFails ? 503 : 200
      );
    }
    deletes += 1;
    keys.push(request.headers()['idempotency-key']);
    if (deletes === 1) return reply(route, null, 503);
    return reply(route, { resourceId: id, version: 3, deleted: true });
  });
  await page.goto(adminPath);
  await expect(page.getByText(ko.admin.templates.loadError, { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: ko.admin.templates.create, exact: true })
  ).toBeDisabled();
  listFails = false;
  await page.getByRole('button', { name: ko.actions.retry, exact: true }).click();
  await expect(page.getByText(ko.admin.templates.detailError, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: ko.templates.edit, exact: true })).toHaveCount(0);
  detailFails = false;
  await page.getByRole('button', { name: ko.actions.retry, exact: true }).click();
  await page.getByRole('button', { name: ko.templates.delete, exact: true }).click();
  const confirmation = page.getByRole('alertdialog');
  await confirmation.getByRole('button', { name: ko.templates.delete, exact: true }).click();
  await expect(
    confirmation.getByText(ko.admin.templates.commandError, { exact: true })
  ).toBeVisible();
  await confirmation.getByRole('button', { name: ko.templates.delete, exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByText(ko.admin.templates.empty, { exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test('organization template server permissions stay authoritative with English dark 200 percent text', async ({
  page,
}, info) => {
  await setup(page, info.project.name === 'mobile');
  await page.setViewportSize(
    info.project.name === 'mobile' ? { width: 320, height: 844 } : { width: 1280, height: 960 }
  );
  await mockMeetingVisualSession(page, {
    locale: 'en',
    admin: true,
    colorScheme: 'dark',
    forcedColors: 'active',
    reducedMotion: true,
  });
  let denied = false;
  await page.route('**/api/meetings/v1/admin/templates**', (route) => {
    if (route.request().method() !== 'GET') {
      denied = true;
      return reply(route, null, 403);
    }
    if (denied) return reply(route, null, 403);
    const item = { ...initial, canEdit: false };
    return reply(
      route,
      new URL(route.request().url()).pathname.endsWith('/' + id)
        ? item
        : { items: [item], total: 1, page: 0, pageSize: 20 }
    );
  });
  await page.goto(adminPath);
  await expect(page.getByRole('heading', { name: initial.name, exact: true })).toBeVisible();
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  await expect(page.getByRole('button', { name: en.templates.edit, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: en.templates.delete, exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 'organization templates English 200%');
  await expectNoBlockingA11y(page, 'organization templates English 200%');
  await page.screenshot({
    path: info.outputPath('U14-organization-template-English-dark-200.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: en.admin.templates.create, exact: true }).click();
  await page
    .getByRole('textbox', { name: en.templates.fields.name, exact: false })
    .fill('Permission changed');
  await page.getByRole('button', { name: en.templates.save, exact: true }).click();
  await expect(page.getByText(en.admin.templates.accessError, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: initial.name, exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: en.admin.templates.create, exact: true })
  ).toBeDisabled();
});

test('opening organization templates requires discarding an unsaved policy draft explicitly', async ({
  page,
}, info) => {
  await setup(page, info.project.name === 'mobile');
  await page.route('**/api/meetings/v1/admin/templates**', (route) =>
    reply(route, { items: [], total: 0, page: 0, pageSize: 20 })
  );
  await page.goto('/meetings/admin/policies');
  const waitingRoom = page.getByRole('switch', { name: ko.admin.policy.waitingRoom, exact: true });
  await waitingRoom.click();
  const changed = await waitingRoom.isChecked();
  await page.getByRole('tab', { name: ko.admin.templates.title, exact: true }).click();
  const confirmation = page.getByRole('alertdialog', {
    name: ko.admin.templates.discardPolicyTitle,
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  await expect(page).toHaveURL((url) => !url.searchParams.has('section'));
  await confirmation.getByRole('button', { name: ko.actions.cancel, exact: true }).click();
  expect(await waitingRoom.isChecked()).toBe(changed);
  await page.getByRole('tab', { name: ko.admin.templates.title, exact: true }).click();
  await confirmation.getByRole('button', { name: ko.admin.templates.discard, exact: true }).click();
  await expect(page.getByText(ko.admin.templates.empty, { exact: true })).toBeVisible();
});

test('organization template detail access can be revalidated without restoring stale data', async ({
  page,
}, info) => {
  await setup(page, info.project.name === 'mobile');
  let detailDenied = true;
  await page.route('**/api/meetings/v1/admin/templates**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/' + id))
      return reply(route, detailDenied ? null : initial, detailDenied ? 403 : 200);
    return reply(route, { items: [initial], total: 1, page: 0, pageSize: 20 });
  });
  await page.goto(adminPath);
  await expect(page.getByText(ko.admin.templates.accessError, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: initial.name, exact: true })).toHaveCount(0);
  detailDenied = false;
  await page.getByRole('button', { name: ko.actions.retry, exact: true }).click();
  await expect(page.getByRole('heading', { name: initial.name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: ko.templates.edit, exact: true })).toBeEnabled();
});
