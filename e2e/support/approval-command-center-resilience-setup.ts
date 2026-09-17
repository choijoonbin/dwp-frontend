import type { Page, Route } from '@playwright/test';

import { approvalTaskSearchPage } from './approval-search-fixtures';
import {
  APPROVAL_HOME_FIXTURE,
  APPROVAL_MEMBER_PERMISSIONS,
} from './approval-command-center-fixtures';
import { mockApprovalProductSurfaceAuthority } from './product-surface-authority';
import { APPROVAL_TASK_DETAIL_FIXTURE } from './product-area-fixtures';
import { mockShellSession } from './shell-session';

export function fulfillApprovalSuccess(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', data }),
  });
}

export async function prepareApprovalCommandCenter(page: Page, dark = false) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '이서연',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
    appearance: {
      mode: dark ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  await page.route('**/api/approvals/v1/home', (route) =>
    fulfillApprovalSuccess(route, APPROVAL_HOME_FIXTURE)
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/tasks' && url.searchParams.get('view') === 'INBOX',
    (route) => fulfillApprovalSuccess(route, APPROVAL_HOME_FIXTURE.focusQueue)
  );
  await page.route('**/api/approvals/v1/tasks/search?*', async (route) =>
    fulfillApprovalSuccess(
      route,
      approvalTaskSearchPage(
        new URL(route.request().url()),
        APPROVAL_HOME_FIXTURE.focusQueue,
        await page.evaluate(() => Date.now())
      )
    )
  );
  await page.route(
    (url) => /^\/api\/approvals\/v1\/tasks\/approval-task-[12]$/u.test(url.pathname),
    (route) => {
      const task = APPROVAL_HOME_FIXTURE.focusQueue.find((item) =>
        route.request().url().endsWith(item.taskId)
      );
      return fulfillApprovalSuccess(route, {
        ...APPROVAL_TASK_DETAIL_FIXTURE,
        task,
        canDecide: true,
      });
    }
  );
}
