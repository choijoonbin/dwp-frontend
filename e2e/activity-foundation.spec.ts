import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CreateSavedViewRequest, GovernedSavedView } from '@dwp-frontend/shared-utils';
import { mockShellSession } from './support/shell-session';

const event = {
  id: 'a1000000-0000-0000-0000-000000000099',
  occurredAt: '2026-09-01T10:00:00Z',
  actor: 'PERSON',
  actorName: 'Mina Kim',
  state: 'COMPLETED',
  title: 'Archived work changed',
  summary: 'An independently loaded older event.',
  objectType: 'WORK_ITEM',
  objectId: 'work-99',
  objectLabel: 'Older work',
  source: 'DWP',
  auditId: null,
  auditRecordId: null,
  auditStatus: 'LEGACY_UNLINKED',
  eventKind: 'CHANGE',
  workStatus: 'COMPLETED',
  dataProvenance: 'LEGACY',
  sourceAccess: 'AVAILABLE',
  sourceRoute: '/work?item=WK-1042',
};
const coverage = {
  supportedObjectTypes: ['WORK_ITEM', 'WORKSPACE_APP'],
  excludedProvenance: ['SAMPLE', 'QUARANTINED'],
  includesLegacy: true,
  includesUsage: false,
  sourceScope: 'WORKSPACE',
};
const sampleRunId = 'b1000000-0000-4000-8000-000000000001';

async function mockActivity(
  page: Page,
  options: { withEvents?: boolean; unavailable?: boolean } = {}
) {
  const requested: URL[] = [];
  let revoked = false;
  await page.route('**/api/agent/v1/activity/**', (route) => {
    const summary = new URL(route.request().url()).pathname.endsWith('/executions/summary');
    return route.fulfill({
      json: {
        data: summary
          ? {
              total: 0,
              running: 0,
              needsInput: 0,
              policyBlocked: 0,
              completed: 0,
              failed: 0,
              cancelled: 0,
              unknown: 0,
              generatedAt: new Date().toISOString(),
              coverage,
            }
          : {
              events: [],
              generatedAt: new Date().toISOString(),
              snapshotAt: new Date().toISOString(),
              coverage,
              hasMore: false,
              nextCursor: null,
              startCursor: null,
            },
      },
    });
  });
  await page.route('**/api/platform/v1/workspace/activity**', (route) => {
    const url = new URL(route.request().url());
    requested.push(url);
    if (url.pathname.endsWith('/sources/status'))
      return route.fulfill({
        json: { data: { observedAt: new Date().toISOString(), sources: [] } },
      });
    if (url.pathname.endsWith('/evidence')) {
      return route.fulfill({ status: 404, json: { errorCode: 'RESOURCE_NOT_FOUND' } });
    }
    if (url.pathname.endsWith('/executions/summary'))
      return route.fulfill({
        json: {
          data: {
            total: 1,
            running: 0,
            needsInput: 0,
            policyBlocked: 0,
            completed: 1,
            failed: 0,
            cancelled: 0,
            unknown: 0,
            generatedAt: new Date().toISOString(),
            coverage,
          },
        },
      });
    if (url.pathname.includes('/events/')) {
      return options.unavailable || revoked
        ? route.fulfill({ status: 404, json: { errorCode: 'RESOURCE_NOT_FOUND' } })
        : route.fulfill({ json: { data: event } });
    }
    const events =
      options.withEvents && !url.searchParams.has('query')
        ? [
            {
              ...event,
              id: 'a1000000-0000-0000-0000-000000000001',
              state: 'RUNNING',
              title: 'Historical running event',
            },
          ]
        : [];
    return route.fulfill({
      json: {
        data: {
          events,
          generatedAt: new Date().toISOString(),
          coverage,
          hasMore: false,
          nextCursor: null,
        },
      },
    });
  });
  return {
    requested,
    revokeSource: () => {
      revoked = true;
    },
  };
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'en', displayName: 'Mina Kim' });
});

test('Activity navigation contains only its own home and timeline on desktop and mobile', async ({
  page,
}, testInfo) => {
  await mockActivity(page, { withEvents: true });
  await page.goto('/activity/home');
  const mobile = testInfo.project.name === 'mobile';
  if (mobile) await page.getByTestId('activity-mobile-navigation-trigger').click();
  const sidebar = page.getByTestId(mobile ? 'activity-mobile-sidebar' : 'activity-sidebar');
  const navigation = sidebar.getByRole('navigation', { name: 'Activity navigation' });
  await expect(navigation.getByRole('link')).toHaveCount(2);
  await expect(navigation.locator('a[href="/activity/home"]')).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expect(navigation.locator('a[href="/activity/timeline"]')).toBeVisible();
  await expect(navigation.locator('a[href^="/mail"], a[href^="/calendar"]')).toHaveCount(0);
  await expect(sidebar.getByText(/Inbox|Sent mail|Drafts|Chronos/)).toHaveCount(0);

  await navigation.locator('a[href="/activity/timeline"]').click();
  await expect(page).toHaveURL((url) => url.pathname === '/activity/timeline');
  await expect(page.getByText('Historical running event', { exact: true })).toBeVisible();
  if (mobile) {
    await expect(sidebar).toHaveCount(0);
    const trigger = page.getByTestId('activity-mobile-navigation-trigger');
    await trigger.click();
    await expect(navigation.locator('a[href="/activity/timeline"]')).toHaveAttribute(
      'aria-current',
      'page'
    );
    await page.keyboard.press('Escape');
    await expect(sidebar).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

test('invalid time filters suppress feed requests and can be corrected without losing object scope', async ({
  page,
}) => {
  const { requested } = await mockActivity(page, { withEvents: true });
  await page.goto(
    '/activity/timeline?objectType=WORK_ITEM&objectId=work-99&from=2026-09-04T12%3A00%3A00Z&to=2026-09-04T10%3A00%3A00Z'
  );
  await expect(
    page.getByText(
      'Enter start and end timestamps with a timezone. The end must be after the start.'
    )
  ).toBeVisible();
  expect(requested.filter((url) => url.pathname.endsWith('/activity'))).toHaveLength(0);

  await expandActivityFilters(page);
  await page.getByText('Advanced filters', { exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Until (exclusive · ISO 8601)' })
    .fill('2026-09-04T14:00:00Z');
  await expect(page.getByText('Historical running event', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('to') === '2026-09-04T14:00:00Z' &&
      url.searchParams.get('objectType') === 'WORK_ITEM' &&
      url.searchParams.get('objectId') === 'work-99'
  );
  expect(
    requested.some(
      (url) =>
        url.pathname.endsWith('/activity') &&
        url.searchParams.get('to') === '2026-09-04T14:00:00Z' &&
        url.searchParams.get('objectType') === 'WORK_ITEM' &&
        url.searchParams.get('objectId') === 'work-99'
    )
  ).toBe(true);
});

test('a personal saved view restores activity scope but never stores an inspected event or cursor', async ({
  page,
}) => {
  await mockActivity(page, { withEvents: true });
  const store: { saved: GovernedSavedView | null; payload: CreateSavedViewRequest | null } = {
    saved: null,
    payload: null,
  };
  await page.route('**/api/platform/v1/workspace/saved-views**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/use')) return route.fulfill({ status: 204 });
    if (request.method() === 'POST') {
      store.payload = request.postDataJSON() as CreateSavedViewRequest;
      store.saved = {
        ...store.payload,
        savedViewId: 'activity-view-1',
        surfaceKey: url.searchParams.get('surfaceKey') ?? '',
        ownerUserId: 1,
        lifecycleState: 'ACTIVE',
        editable: true,
        version: 1,
        createdAt: '2026-09-07T00:00:00Z',
        updatedAt: '2026-09-07T00:00:00Z',
      };
      return route.fulfill({ json: { data: store.saved } });
    }
    return route.fulfill({ json: { data: store.saved ? [store.saved] : [] } });
  });
  await page.goto(
    '/activity/timeline?actor=agent&state=running&objectType=WORK_ITEM&objectId=work-99'
  );
  await expandActivityFilters(page);
  await page.getByRole('button', { name: /^Saved views/u }).click();
  await page.getByRole('menuitem', { name: 'Save current view' }).click();
  const editor = page.getByRole('dialog', { name: 'Save the current view' });
  await editor.getByRole('textbox', { name: 'View name' }).fill('My work execution review');
  await editor.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Saved views: My work execution review' })
  ).toBeVisible();
  expect(store.payload).toMatchObject({
    scope: 'PERSONAL',
    configuration: {
      actor: 'agent',
      state: 'running',
      objectType: 'WORK_ITEM',
      objectId: 'work-99',
    },
  });
  expect(store.payload?.configuration).not.toHaveProperty('event');
  expect(store.payload?.configuration).not.toHaveProperty('cursor');
  expect(store.saved?.surfaceKey).toBe('workspace.activity');

  await page.goto(`/activity/timeline?actor=person&event=${event.id}`);
  await expect(page.getByRole('complementary')).toBeVisible();
  // Close the mobile inspector before changing the view behind its modal boundary.
  await page.getByRole('button', { name: 'Close signal detail' }).click();
  await expandActivityFilters(page);
  await page.getByRole('button', { name: /^Saved views/u }).click();
  await page.getByRole('menuitem', { name: /My work execution review/u }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('actor') === 'agent' &&
      url.searchParams.get('state') === 'running' &&
      url.searchParams.get('objectType') === 'WORK_ITEM' &&
      url.searchParams.get('objectId') === 'work-99' &&
      !url.searchParams.has('event') &&
      !url.searchParams.has('cursor')
  );
});

test('older-page navigation uses the server cursor and filter changes return to the latest page', async ({
  page,
}) => {
  await mockActivity(page);
  const requests: URL[] = [];
  await page.route('**/api/platform/v1/workspace/activity**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/activity')) return route.fallback();
    requests.push(url);
    const older = url.searchParams.has('cursor');
    return route.fulfill({
      json: {
        data: {
          events: [
            {
              ...event,
              title: older ? 'Older execution evidence' : 'Latest execution evidence',
              resumeCursor: older ? 'workspace-end-page' : 'workspace-next-page',
            },
          ],
          generatedAt: new Date().toISOString(),
          snapshotAt: '2026-09-07T00:00:00Z',
          coverage,
          hasMore: !older,
          nextCursor: older ? null : 'workspace-next-page',
          startCursor: null,
        },
      },
    });
  });
  await page.goto('/activity/timeline?actor=person');
  await expect(page.getByText('Latest execution evidence', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Older events' }).click();
  await expect(page).toHaveURL((url) => Boolean(url.searchParams.get('cursor')));
  await expect(page.getByText('Older execution evidence', { exact: true })).toBeVisible();
  expect(requests.some((url) => url.searchParams.get('cursor') === 'workspace-next-page')).toBe(
    true
  );
  await expect(page.getByRole('button', { name: 'Older events' })).toBeDisabled();
  await page.getByRole('button', { name: 'Latest page' }).click();
  await expect(page.getByText('Latest execution evidence', { exact: true })).toBeVisible();
  await expect(page).toHaveURL((url) => !url.searchParams.has('cursor'));

  await page.getByRole('button', { name: 'Older events' }).click();
  await expect(page.getByText('Older execution evidence', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search activity' }).fill('evidence');
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('q') === 'evidence' &&
      !url.searchParams.has('cursor') &&
      url.searchParams.get('actor') === 'person'
  );
  await expect(page.getByText('Latest execution evidence', { exact: true })).toBeVisible();
});

test('explicit old-event links load detail even when the first feed page is empty', async ({
  page,
}) => {
  await mockActivity(page);
  await page.goto(`/activity/events/${event.id}?actor=person`);
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/activity/timeline' &&
      url.searchParams.get('event') === event.id &&
      url.searchParams.get('actor') === 'person'
  );
  await expect(page.getByRole('complementary').getByText(event.title)).toBeVisible();
  await expect(page.getByText('Legacy record · no verified audit link')).toBeVisible();
  await expect(page.getByText('No collected audit evidence was found')).toBeVisible();
  await expect(page.getByText('No activity matches these filters')).toBeVisible();
  await expect(page.getByText('Polled every 60 seconds').first()).toBeVisible();
});

test('common Activity excludes labelled Agent samples from both timeline and current totals', async ({
  page,
}) => {
  await mockActivity(page);
  await page.unroute('**/api/agent/v1/activity/**');
  await page.route('**/api/agent/v1/activity/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/executions/summary')) {
      return route.fulfill({
        json: {
          data: {
            total: 0,
            running: 0,
            needsInput: 0,
            policyBlocked: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            unknown: 0,
            generatedAt: new Date().toISOString(),
            coverage: {
              ...coverage,
              supportedObjectTypes: ['AGENT_RUN'],
              sourceScope: 'DWAI_ON',
              excludedProvenance: ['SAMPLE', 'QUARANTINED'],
            },
          },
        },
      });
    }
    if (path.endsWith(`/${sampleRunId}`)) {
      return route.fulfill({ status: 404, json: { errorCode: 'RESOURCE_NOT_FOUND' } });
    }
    return route.fulfill({
      json: {
        data: {
          events: [],
          generatedAt: new Date().toISOString(),
          snapshotAt: new Date().toISOString(),
          coverage: {
            ...coverage,
            supportedObjectTypes: ['AGENT_RUN'],
            sourceScope: 'DWAI_ON',
            excludedProvenance: ['SAMPLE', 'QUARANTINED'],
          },
          hasMore: false,
          nextCursor: null,
          startCursor: null,
        },
      },
    });
  });
  await page.goto(`/activity/timeline?event=${encodeURIComponent(`dwaion:${sampleRunId}`)}`);
  const detail = page.getByRole('complementary', { name: 'Signal detail' });
  await expect(detail.getByText('This event cannot be displayed', { exact: true })).toBeVisible();
  await expect(detail.getByText('Development verification data')).toHaveCount(0);
  await expect(page.getByText('No activity matches these filters', { exact: true })).toBeVisible();

  if (await page.locator('.MuiDrawer-paper').isVisible()) {
    await page.getByRole('button', { name: 'Close signal detail' }).click();
  }
  await expandCurrentSummary(page);
  const summary = page.getByRole('region', { name: 'Activity summary' });
  await expect(summary.getByText('Connected executions').locator('..')).toContainText('1');
});

test('missing or revoked explicit events never show a different feed item as their detail', async ({
  page,
}) => {
  await mockActivity(page, { withEvents: true, unavailable: true });
  await page.goto(`/activity/timeline?event=${event.id}`);
  await expect(page.getByText('Historical running event', { exact: true })).toBeVisible();
  const detail = page.getByRole('complementary');
  await expect(detail.getByText('This event cannot be displayed')).toBeVisible();
  await expect(detail.getByText('Historical running event')).toHaveCount(0);
  await expect(detail.getByRole('button', { name: 'Open source' })).toHaveCount(0);
});

test('current counts use the execution summary and filters are sent to the server', async ({
  page,
}) => {
  const { requested } = await mockActivity(page, { withEvents: true });
  await page.goto('/activity/timeline');
  await expect(page.getByText('Historical running event', { exact: true })).toBeVisible();
  await expandCurrentSummary(page);
  const summary = page.getByRole('region', { name: 'Activity summary' });
  await expect(summary.getByText('Currently running').locator('..')).toContainText('0');
  await page.getByRole('textbox', { name: 'Search activity' }).fill('older work');
  await expect(page.getByText('No activity matches these filters')).toBeVisible();
  expect(requested.some((url) => url.searchParams.get('query') === 'older work')).toBe(true);
  expect(
    requested
      .filter((url) => url.pathname.endsWith('/activity'))
      .every((url) => !url.searchParams.has('includeUsage'))
  ).toBe(true);
});

test('opening a source rechecks current access and stops when access was revoked', async ({
  page,
}) => {
  const { revokeSource } = await mockActivity(page);
  await page.goto(`/activity/timeline?event=${event.id}`);
  await expect(page.getByRole('button', { name: 'Open source' })).toBeEnabled();
  revokeSource();
  await page.getByRole('button', { name: 'Open source' }).click();
  await expect(page.getByText('This event cannot be displayed')).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === '/activity/timeline');
});

test('a failed execution source shows unavailable counts and preserves accessible event inspection', async ({
  page,
}) => {
  await mockActivity(page);
  await page.route('**/api/agent/v1/activity/**', (route) =>
    route.fulfill({ status: 503, json: { errorCode: 'SOURCE_UNAVAILABLE' } })
  );
  await page.goto(`/activity/timeline?event=${event.id}`);
  await expect(page.getByRole('complementary').getByText(event.title)).toBeVisible();
  if (await page.locator('.MuiDrawer-paper').isVisible()) {
    await page.getByRole('button', { name: 'Close signal detail' }).click();
  }
  await expandCurrentSummary(page);
  const summary = page.getByRole('region', { name: 'Activity summary' });
  await expect(summary.getByText('—', { exact: true })).toHaveCount(5);
  await expect(page.getByText('Some information could not be refreshed').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Older events' })).toBeDisabled();
});

test('dark high-contrast and enlarged-text inspection remains usable', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    appearance: { mode: 'dark', density: 'standard', highContrast: true, reduceMotion: true },
  });
  await mockActivity(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`/activity/timeline?event=${event.id}`);
  await expect(page.getByRole('complementary').getByText(event.title)).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('activity-foundation-dark-text200.png'),
    fullPage: true,
  });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.screenshot({
    path: testInfo.outputPath('activity-foundation-forced-colors.png'),
    fullPage: true,
  });
  const source = page.getByRole('button', { name: 'Open source' });
  await source.focus();
  await expect(source).toBeFocused();
  await expect(source).toBeEnabled();
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

async function expandCurrentSummary(page: Page) {
  const region = page.locator('[aria-label="Activity summary"]');
  await expect(region).toBeAttached();
  if (!(await region.isVisible())) {
    await page.locator('details').filter({ has: region }).locator('summary').click();
  }
  await expect(region).toBeVisible();
}

async function expandActivityFilters(page: Page) {
  await expect(
    page.getByRole('heading', { level: 1, name: 'Activity', exact: true })
  ).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Activity filters and saved views' });
  if ((await trigger.isVisible()) && (await trigger.getAttribute('aria-expanded')) === 'false') {
    await trigger.click();
  }
}

test('foundation controls remain readable and accessible at required widths', async ({
  page,
}, testInfo) => {
  await mockActivity(page);
  await page.goto(`/activity/timeline?event=${event.id}`);
  await expect(page.getByRole('complementary').getByText(event.title)).toBeVisible();
  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflow).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`activity-foundation-${width}.png`),
      fullPage: true,
    });
  }
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});
