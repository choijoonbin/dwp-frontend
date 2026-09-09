import { expect, test, type Page } from '@playwright/test';
import { mockDwaionAdminStitch } from './support/dwaion-admin-stitch-fixtures';

const SCREENS = [{ path: 'sources' }, { path: 'actions' }] as const;
async function openScreen(page: Page, screen: { path: string }) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/dwaion/admin/${screen.path}`);
  await expect(
    page.getByRole('heading', { name: /Data sources and connectors|Actions and execution access/ })
  ).toBeVisible();
}
async function inspectRegistry(page: Page, path: string) {
  await page
    .getByRole('button', {
      name: path === 'sources' ? /Calendar.*Configured connection/ : /Create calendar event/,
    })
    .click();
}

for (const path of ['sources', 'actions'] as const) {
  test(`${path} late version recovery cannot overwrite a reopened editor`, async ({ page }) => {
    const { requests, state } = await mockDwaionAdminStitch(page);
    await openScreen(page, SCREENS[path === 'sources' ? 0 : 1]);
    await inspectRegistry(page, path);
    await page.getByRole('button', { name: 'Edit policy', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('textbox', { name: 'Change reason' })
      .fill('Original change review reason.');
    await page.route(
      `**/api/agent/v1/admin/${path}/*`,
      (route) => route.fulfill({ status: 409, json: { detail: 'Policy version conflict' } }),
      { times: 1 }
    );
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      dialog.getByRole('button', { name: 'Load current version for comparison' })
    ).toBeVisible();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      `**/api/agent/v1/admin/${path}`,
      async (route) => {
        await held;
        await route.fulfill({
          json: { success: true, data: state[path].map((row) => ({ ...row, policyVersion: 99 })) },
        });
      },
      { times: 1 }
    );
    const response = page.waitForResponse((item) => item.url().endsWith(`/admin/${path}`));
    await dialog.getByRole('button', { name: 'Load current version for comparison' }).click();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Edit policy', exact: true }).click();
    await dialog
      .getByRole('textbox', { name: 'Change reason' })
      .fill('Reopened editor retains its reviewed version.');
    release();
    await response;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    await expect(
      dialog.getByRole('button', { name: 'Load current version for comparison' })
    ).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(requests.find((item) => item.method === 'PATCH')?.body).toMatchObject({
      expectedVersion: path === 'sources' ? 4 : 5,
      changeReason: 'Reopened editor retains its reviewed version.',
    });
  });
}

for (const lifecycleState of ['DRAFT', 'ACTIVE'] as const) {
  test(`A02 conflict compares current revision and ${lifecycleState === 'DRAFT' ? 'saves reviewed version' : 'blocks published overwrite'}`, async ({
    page,
  }) => {
    const { requests, state } = await mockDwaionAdminStitch(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/dwaion/admin/agents');
    await page.getByRole('button', { name: /DWP work assistant/ }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit agent' });
    const draftName = 'Reviewed agent metadata remains in this draft';
    await dialog.getByRole('textbox', { name: 'Display name', exact: true }).fill(draftName);
    await page.route(
      '**/api/platform/v1/admin/dwaion/agents/*/revisions/*',
      (route) => route.fulfill({ status: 409, json: { detail: 'Revision version conflict' } }),
      { times: 1 }
    );
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog.getByRole('textbox', { name: 'Display name', exact: true })).toHaveValue(
      draftName
    );
    state.agents[0] = {
      ...state.agents[0],
      name: 'Changed server name',
      lifecycleState,
      version: 11,
    };
    await dialog.getByRole('button', { name: 'Load current version for comparison' }).click();
    const review = dialog.getByRole('region', { name: 'Review changes' });
    await expect(review).toContainText('Changed server name');
    await expect(review).toContainText(draftName);
    if (lifecycleState === 'ACTIVE') {
      await expect(dialog).toContainText('This revision is no longer a draft.');
      await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
      expect(requests.filter((item) => item.method === 'PATCH')).toHaveLength(0);
    } else {
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      expect(requests.find((item) => item.method === 'PATCH')?.body).toMatchObject({
        version: 11,
        name: draftName,
      });
    }
  });
}
