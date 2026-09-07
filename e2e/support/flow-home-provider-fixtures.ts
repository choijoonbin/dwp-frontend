import type { Page } from '@playwright/test';

import { fulfillSuccess } from './shell-session';

/** Current execution summaries are independent from historical activity rows. */
export async function routeEmptyFlowExecutionSummaries(page: Page, generatedAt: string) {
  await page.route(
    /\/api\/(?:platform\/v1\/workspace|agent\/v1)\/activity\/executions\/summary(?:\?|$)/u,
    (route) =>
      fulfillSuccess(route, {
        total: 0,
        running: 0,
        needsInput: 0,
        policyBlocked: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        unknown: 0,
        generatedAt,
        coverage: { supportedObjectTypes: [] },
      })
  );
}
