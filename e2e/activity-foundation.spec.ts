import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
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
  await expect(page.getByText('No verified audit link')).toBeVisible();
  await expect(page.getByText('No activity matches these filters')).toBeVisible();
  await expect(page.getByText('Polled every 60 seconds').first()).toBeVisible();
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
  const summary = page.getByRole('region', { name: 'Activity summary' });
  await expect(summary.getByText('—', { exact: true })).toHaveCount(4);
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
