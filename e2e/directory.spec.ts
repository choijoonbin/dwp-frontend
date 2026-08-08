import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type User = {
  userId: number;
  displayName: string;
  email: string;
  status: 'ACTIVE';
  primaryOrgUnitId: number | null;
  primaryOrgName: string | null;
};

type Organization = {
  orgUnitId: number;
  orgKey: string;
  name: string;
  description: string;
  parentOrgUnitId: number | null;
  parentName: string | null;
  sourceType: 'LOCAL';
  status: 'ACTIVE' | 'INACTIVE';
  memberCount: number;
  revision: number;
  version: number;
};

type Group = {
  groupId: number;
  groupKey: string;
  displayName: string;
  description: string;
  sourceType: 'LOCAL';
  status: 'ACTIVE' | 'INACTIVE';
  memberCount: number;
  revision: number;
  version: number;
};

function envelope(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

function pageResult(content: unknown[]) {
  return { content, page: 0, size: 50, totalElements: content.length, totalPages: 1 };
}

async function mockAdminSession(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        userId: 1,
        displayName: 'Admin User',
        email: 'admin@dwp.local',
        tenantId: 1,
        tenantCode: 'default',
        roles: ['ADMIN'],
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope([]) })
  );
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }),
    })
  );
}

test('tenant administrators govern organizations and direct groups', async ({ page }, testInfo) => {
  await mockAdminSession(page);
  const users: User[] = [
    {
      userId: 1,
      displayName: 'Admin User',
      email: 'admin@dwp.local',
      status: 'ACTIVE',
      primaryOrgUnitId: null,
      primaryOrgName: null,
    },
    {
      userId: 2,
      displayName: 'Operations Lead',
      email: 'operations@dwp.local',
      status: 'ACTIVE',
      primaryOrgUnitId: null,
      primaryOrgName: null,
    },
  ];
  const organizations: Organization[] = [];
  const groups: Group[] = [];
  const organizationMembers = new Map<number, number[]>();
  const groupMembers = new Map<number, number[]>();

  await page.route('**/api/auth/admin/directory/users**', (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope(pageResult(users)) })
  );

  await page.route('**/api/auth/admin/directory/organizations**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const suffix = url.pathname.replace('/api/auth/admin/directory/organizations', '');
    const body = request.postDataJSON() as Record<string, unknown> | null;

    if (request.method() === 'GET' && suffix === '') {
      await route.fulfill({
        contentType: 'application/json',
        body: envelope(pageResult(organizations)),
      });
      return;
    }
    if (request.method() === 'POST' && suffix === '') {
      const organization: Organization = {
        orgUnitId: organizations.length + 10,
        orgKey: String(body?.orgKey),
        name: String(body?.name),
        description: String(body?.description || ''),
        parentOrgUnitId: null,
        parentName: null,
        sourceType: 'LOCAL',
        status: 'ACTIVE',
        memberCount: 0,
        revision: 1,
        version: 0,
      };
      organizations.push(organization);
      organizationMembers.set(organization.orgUnitId, []);
      await route.fulfill({ contentType: 'application/json', body: envelope(organization) });
      return;
    }
    const detailMatch = suffix.match(/^\/(\d+)$/);
    if (request.method() === 'GET' && detailMatch) {
      const id = Number(detailMatch[1]);
      const organization = organizations.find((item) => item.orgUnitId === id)!;
      const members = users.filter((user) => organizationMembers.get(id)?.includes(user.userId));
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({ organization, members }),
      });
      return;
    }
    const membersMatch = suffix.match(/^\/(\d+)\/members$/);
    if (request.method() === 'PUT' && membersMatch) {
      const id = Number(membersMatch[1]);
      const organization = organizations.find((item) => item.orgUnitId === id)!;
      const userIds = (body?.userIds as number[]) ?? [];
      organizationMembers.set(id, userIds);
      organization.memberCount = userIds.length;
      organization.revision += 1;
      organization.version += 1;
      users.forEach((user) => {
        if (userIds.includes(user.userId)) {
          user.primaryOrgUnitId = id;
          user.primaryOrgName = organization.name;
        } else if (user.primaryOrgUnitId === id) {
          user.primaryOrgUnitId = null;
          user.primaryOrgName = null;
        }
      });
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({
          organization,
          members: users.filter((user) => userIds.includes(user.userId)),
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/auth/admin/directory/groups**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const suffix = url.pathname.replace('/api/auth/admin/directory/groups', '');
    const body = request.postDataJSON() as Record<string, unknown> | null;

    if (request.method() === 'GET' && suffix === '') {
      await route.fulfill({ contentType: 'application/json', body: envelope(pageResult(groups)) });
      return;
    }
    if (request.method() === 'POST' && suffix === '') {
      const group: Group = {
        groupId: groups.length + 20,
        groupKey: String(body?.groupKey),
        displayName: String(body?.displayName),
        description: String(body?.description || ''),
        sourceType: 'LOCAL',
        status: 'ACTIVE',
        memberCount: 0,
        revision: 1,
        version: 0,
      };
      groups.push(group);
      groupMembers.set(group.groupId, []);
      await route.fulfill({ contentType: 'application/json', body: envelope(group) });
      return;
    }
    const detailMatch = suffix.match(/^\/(\d+)$/);
    if (request.method() === 'GET' && detailMatch) {
      const id = Number(detailMatch[1]);
      const group = groups.find((item) => item.groupId === id)!;
      const members = users.filter((user) => groupMembers.get(id)?.includes(user.userId));
      await route.fulfill({ contentType: 'application/json', body: envelope({ group, members }) });
      return;
    }
    const membersMatch = suffix.match(/^\/(\d+)\/members$/);
    if (request.method() === 'PUT' && membersMatch) {
      const id = Number(membersMatch[1]);
      const group = groups.find((item) => item.groupId === id)!;
      const userIds = (body?.userIds as number[]) ?? [];
      groupMembers.set(id, userIds);
      group.memberCount = userIds.length;
      group.revision += 1;
      group.version += 1;
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({ group, members: users.filter((user) => userIds.includes(user.userId)) }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/admin?view=directory');
  await expect(page.getByRole('heading', { name: 'Directory' })).toBeVisible();
  await page.getByRole('button', { name: 'New organization' }).click();
  const organizationDialog = page.getByRole('dialog', { name: 'New organization' });
  await organizationDialog.getByLabel('Organization key').fill('OPERATIONS');
  await organizationDialog.getByLabel('Name').fill('Operations');
  await organizationDialog.getByRole('button', { name: 'Create organization' }).click();

  const organizationList =
    testInfo.project.name === 'mobile'
      ? page.getByRole('list', { name: 'Organizations' })
      : page.getByRole('grid', { name: 'Organizations' });
  await expect(organizationList).toContainText('Operations');
  await page.getByRole('button', { name: 'Manage members for Operations' }).click();
  const organizationMembersDialog = page.getByRole('dialog', { name: 'Manage members' });
  await organizationMembersDialog.getByRole('checkbox', { name: /Operations Lead/ }).check();
  await organizationMembersDialog.getByRole('button', { name: 'Save members' }).click();
  await expect(organizationList).toContainText('1');

  await page.getByRole('button', { name: 'Groups', exact: true }).click();
  await page.getByRole('button', { name: 'New group' }).click();
  const groupDialog = page.getByRole('dialog', { name: 'New group' });
  await groupDialog.getByLabel('Group key').fill('SHIFT_LEADS');
  await groupDialog.getByLabel('Display name').fill('Shift leads');
  await groupDialog.getByRole('button', { name: 'Create group' }).click();

  const groupList =
    testInfo.project.name === 'mobile'
      ? page.getByRole('list', { name: 'Directory groups' })
      : page.getByRole('grid', { name: 'Directory groups' });
  await expect(groupList).toContainText('Shift leads');
  await page.getByRole('button', { name: 'Manage members for Shift leads' }).click();
  const groupMembersDialog = page.getByRole('dialog', { name: 'Manage members' });
  await groupMembersDialog.getByRole('checkbox', { name: /Admin User/ }).check();
  await groupMembersDialog.getByRole('button', { name: 'Save members' }).click();
  await expect(groupList).toContainText('1');

  await expect(page.getByRole('alert')).toBeHidden({ timeout: 10_000 });
  await page.mouse.move(0, 0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
