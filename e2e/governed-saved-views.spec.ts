import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

type SavedView = {
  savedViewId: string;
  surfaceKey: string;
  name: string;
  scope: 'PERSONAL' | 'TENANT';
  ownerUserId: number;
  editable: boolean;
  favorite: boolean;
  defaultView: boolean;
  configuration: Record<string, unknown>;
  version: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

async function fulfillNoContent(route: Route) {
  await route.fulfill({ status: 204 });
}

async function mockSavedViewStore(page: Page) {
  let views: SavedView[] = [];
  let createdPayload: Record<string, unknown> | null = null;

  await page.route('**/api/platform/v1/workspace/saved-views**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;

    if (path.endsWith('/saved-views') && method === 'GET') {
      return fulfillSuccess(route, views);
    }
    if (path.endsWith('/saved-views') && method === 'POST') {
      createdPayload = request.postDataJSON();
      const created: SavedView = {
        savedViewId: 'saved-view-1',
        surfaceKey: url.searchParams.get('surfaceKey') ?? 'workspace.work',
        name: String(createdPayload.name),
        scope: createdPayload.scope as SavedView['scope'],
        ownerUserId: 1,
        editable: true,
        favorite: Boolean(createdPayload.favorite),
        defaultView: Boolean(createdPayload.defaultView),
        configuration: createdPayload.configuration as Record<string, unknown>,
        version: 1,
        lastUsedAt: null,
        createdAt: '2026-08-11T00:00:00Z',
        updatedAt: '2026-08-11T00:00:00Z',
      };
      views = [created];
      return fulfillSuccess(route, created);
    }

    const savedViewId = path.split('/').at(-1);
    if (path.endsWith('/preference') && method === 'PUT') {
      const id = path.split('/').at(-2);
      const preference = request.postDataJSON();
      views = views.map((view) =>
        view.savedViewId === id
          ? {
              ...view,
              favorite: Boolean(preference.favorite),
              defaultView: Boolean(preference.defaultView),
              updatedAt: '2026-08-11T00:05:00Z',
            }
          : view
      );
      return fulfillSuccess(
        route,
        views.find((view) => view.savedViewId === id)
      );
    }
    if (path.endsWith('/use') && method === 'POST') return fulfillNoContent(route);
    if (method === 'PUT') {
      const update = request.postDataJSON();
      views = views.map((view) =>
        view.savedViewId === savedViewId
          ? {
              ...view,
              name: String(update.name),
              scope: update.scope,
              configuration: update.configuration,
              version: view.version + 1,
              updatedAt: '2026-08-11T00:10:00Z',
            }
          : view
      );
      return fulfillSuccess(
        route,
        views.find((view) => view.savedViewId === savedViewId)
      );
    }
    if (method === 'DELETE') {
      views = views.filter((view) => view.savedViewId !== savedViewId);
      return fulfillNoContent(route);
    }
    return route.abort('failed');
  });

  return {
    get views() {
      return views;
    },
    get createdPayload() {
      return createdPayload;
    },
  };
}

test('administrators govern shared reusable views through their complete lifecycle', async ({
  page,
}) => {
  await mockShellSession(page, ['ADMIN'], {
    locale: 'en',
    displayName: 'Tenant Admin',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  const store = await mockSavedViewStore(page);

  await page.goto('/work');
  await expect(page.getByRole('heading', { name: 'Work', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Saved views: All' }).click();
  await page.getByRole('menuitem', { name: 'Save current view' }).click();
  await expect(page.getByRole('heading', { name: 'Save the current view' })).toBeVisible();
  await page.getByLabel('View name').fill('Operations leadership');
  await page.getByRole('button', { name: 'Organization' }).click();
  await page.getByRole('switch', { name: 'Add to favorites' }).check();
  await page.getByRole('switch', { name: 'Use as the default for this page' }).check();

  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('The current settings were saved as a new view.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Saved views: Operations leadership' })
  ).toBeVisible();
  expect(store.createdPayload).toMatchObject({
    name: 'Operations leadership',
    scope: 'TENANT',
    favorite: true,
    defaultView: true,
  });

  await page.getByRole('button', { name: 'Saved views: Operations leadership' }).click();
  await page.getByRole('menuitem', { name: 'Manage saved views' }).click();
  await expect(page.getByText('Managed by your organization')).toBeVisible();
  await page.getByRole('button', { name: 'Remove from favorites' }).click();
  await expect.poll(() => store.views[0]?.favorite).toBe(false);

  await page.getByRole('button', { name: 'Edit view' }).click();
  await page.getByLabel('View name').fill('Executive operations');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('The saved view was updated.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Saved views: Executive operations' })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Saved views: Executive operations' }).click();
  await page.getByRole('menuitem', { name: 'Manage saved views' }).click();
  await page.getByRole('button', { name: 'Delete view' }).click();
  await expect(page.getByRole('heading', { name: 'Delete saved view' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('The saved view was deleted.')).toBeVisible();
  await expect.poll(() => store.views).toHaveLength(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved views: All' })).toBeVisible();
});
