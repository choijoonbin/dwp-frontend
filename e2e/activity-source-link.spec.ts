import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockShellSession } from './support/shell-session';

const runId = 'aaaaaaaa-0000-4000-8000-000000000099';

test('an older source run resolves by ID even when the source list is empty', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER']);
  await page.route('**/api/agent/v1/runs?**', (route) => route.fulfill({ json: { data: [] } }));
  await page.route(`**/api/agent/v1/runs/${runId}`, (route) =>
    route.fulfill({
      json: {
        data: {
          runId,
          agentKey: 'DWP_ASSISTANT',
          agentRevision: 2,
          runState: 'COMPLETED',
          answerState: 'COMPLETED',
          riskTier: 'L0',
          policyOutcome: 'ALLOW',
          statusCode: 'ANSWER_GROUNDED',
          sourceCount: 2,
          latencyMs: 420,
          conversationId: null,
          createdAt: '2026-08-01T00:00:00Z',
          completedAt: '2026-08-01T00:00:01Z',
        },
      },
    })
  );
  await page.route(`**/api/agent/v1/activity/events/${runId}`, (route) =>
    route.fulfill({
      json: {
        data: {
          id: runId,
          actor: 'AGENT',
          actorName: 'DWAI·ON',
          state: 'UNKNOWN',
          title: 'Selected older execution',
          summary: 'The current worker lease cannot be confirmed.',
          objectType: 'AGENT_RUN',
          objectId: runId,
          objectLabel: 'AI execution',
          source: 'DWAI_ON',
          sourceAccess: 'AVAILABLE',
          sourceRoute: `/dwaion/activity?run=${runId}`,
          eventKind: 'EXECUTION_SNAPSHOT',
          occurredAt: '2026-08-01T00:00:00Z',
          sourceObservedAt: new Date().toISOString(),
          executionId: runId,
          executionVersion: 2,
          attempt: 1,
          workStatus: null,
          dataProvenance: 'LIVE',
          auditStatus: 'NOT_LINKED',
          auditRecordId: null,
          auditId: null,
        },
      },
    })
  );
  await page.goto(`/dwaion/activity?run=${runId.toUpperCase()}`);
  const detail = page.getByRole('complementary', { name: 'Signal detail' });
  await expect(page.getByText('Recent run response', { exact: true })).toBeVisible();
  await expect(detail.getByText('Selected older execution', { exact: true })).toBeVisible();
  await expect(detail).toContainText('not a history of every stage or retry');
  await expect(detail).toContainText('No verified audit link');
  await expect(detail.getByRole('button', { name: 'Open source' })).toHaveCount(0);
  const audit = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    audit.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
  ).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('source-run-detail.png'), fullPage: true });
  await page.getByRole('button', { name: 'Close selected execution' }).click();
  await expect(page).toHaveURL(/\/dwaion\/activity$/u);
});

test('a missing source run never selects a different list entry', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER']);
  await page.route('**/api/agent/v1/runs?**', (route) => route.fulfill({ json: { data: [] } }));
  await page.route(`**/api/agent/v1/runs/${runId}`, (route) =>
    route.fulfill({ status: 404, json: { data: null } })
  );
  await page.route(`**/api/agent/v1/activity/events/${runId}`, (route) =>
    route.fulfill({ status: 404, json: { data: null } })
  );
  await page.goto(`/dwaion/activity?run=${runId}`);
  await expect(
    page.getByText('This run record cannot be displayed', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('This event cannot be displayed', { exact: true })).toBeVisible();
  await expect(page.getByText('Selected older execution', { exact: true })).toHaveCount(0);
});
