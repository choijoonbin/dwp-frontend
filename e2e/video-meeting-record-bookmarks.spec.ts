import { expect, test, type Route } from '@playwright/test';
import {
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
  MEETING_VISUAL_ID,
} from './support/video-meeting-visual-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

const title = '분기 제품 출시 의사결정';
function reply(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      status: status === 200 ? 'SUCCESS' : 'ERROR',
      success: status === 200,
      data,
    }),
  });
}
test.beforeEach(async ({ page, isMobile }) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: isMobile ? 844 : 960 });
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page, true);
});

test('personal favorite saves, survives reload, filters on the server, and removes without a stale row', async ({
  page,
}) => {
  const commands: { path: string; key: string | undefined; body: unknown }[] = [];
  const reads: URL[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/bookmark'))
      commands.push({
        path: url.pathname,
        key: request.headers()['idempotency-key'],
        body: request.postDataJSON(),
      });
    if (url.pathname === '/api/meetings/v1/history') reads.push(url);
  });
  await page.goto('/meetings/history');
  const add = page.getByRole('button', { name: `Add ${title} to favorites`, exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  const remove = page.getByRole('button', { name: `Remove ${title} from favorites`, exact: true });
  await expect(remove).toBeEnabled();
  await expect(remove).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(remove).toBeEnabled();
  await page.getByRole('tab', { name: 'Favorites', exact: true }).click();
  await expect(page.getByTestId('meeting-library-list').locator('article')).toHaveCount(1);
  expect(
    reads.some(
      (url) =>
        url.searchParams.get('favoriteOnly') === 'true' && url.searchParams.get('page') === '0'
    )
  ).toBe(true);
  await expectNoHorizontalOverflow(page, 'U07 saved favorites');
  await expectNoBlockingA11y(page, 'U07 saved favorites');
  await remove.click();
  await expect(
    page.getByRole('heading', { name: 'No meeting history', exact: true })
  ).toBeVisible();
  await expect(page.getByTestId('meeting-library-list')).toHaveCount(0);
  expect(commands).toHaveLength(2);
  expect(commands[0]).toMatchObject({
    path: `/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/bookmark`,
    body: { favorite: true, expectedVersion: 0 },
  });
  expect(commands[1].body).toEqual({ favorite: false, expectedVersion: 1 });
  expect(commands[0].key).toMatch(/^[0-9a-f-]{36}$/u);
  expect(commands[1].key).not.toBe(commands[0].key);
});

test('favorite pagination uses the server total and does not filter only the first loaded page', async ({
  page,
}) => {
  const all = Array.from({ length: 12 }, (_, index) => ({
    meetingId: `81000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    title: `Saved decision ${index + 1}`,
    organizerName: 'Meeting reviewer',
    organizerUserId: 42,
    participantRole: 'ATTENDEE',
    canHost: false,
    endedAt: '2026-09-07T01:00:00Z',
    actualDurationMinutes: 30,
    participantPeak: 4,
    averageQualityScore: null,
    recordingAvailable: false,
    transcriptAvailable: false,
  }));
  const requests: URL[] = [];
  await page.route('**/api/meetings/v1/history?*', (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const current = Number(url.searchParams.get('page'));
    const pageSize = Number(url.searchParams.get('pageSize'));
    return reply(route, {
      items: all.slice(current * pageSize, (current + 1) * pageSize),
      total: all.length,
      page: current,
      pageSize,
    });
  });
  await page.goto('/meetings/history');
  await page.getByRole('tab', { name: 'Favorites', exact: true }).click();
  await expect(page.getByTestId('meeting-library-list').locator('article')).toHaveCount(10);
  await page.getByRole('button', { name: 'Go to page 2', exact: true }).click();
  await expect(page.getByTestId('meeting-library-list').locator('article')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Saved decision 12', exact: true })).toBeVisible();
  expect(
    requests.some(
      (url) =>
        url.searchParams.get('favoriteOnly') === 'true' && url.searchParams.get('page') === '1'
    )
  ).toBe(true);
  await page.getByRole('tab', { name: 'All', exact: true }).click();
  await expect(page.getByTestId('meeting-library-list').locator('article')).toHaveCount(10);
  expect(requests.at(-1)?.searchParams.get('page')).toBe('0');
});

test('a denied bookmark command withdraws the previously visible meeting instead of retaining stale authority', async ({
  page,
}) => {
  await page.route('**/api/meetings/v1/meetings/*/bookmark', (route) =>
    reply(route, { code: 'ACCESS_DENIED' }, 403)
  );
  await page.goto('/meetings/history');
  const add = page.getByRole('button', { name: `Add ${title} to favorites`, exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByTestId('meeting-library-workspace')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
  await expectNoBlockingA11y(page, 'U07 revoked bookmark authority');
});

test('removing the only favorite on the last page returns to the remaining authorized records', async ({
  page,
}) => {
  let total = 11;
  const item = (index: number) => ({
    meetingId: `81000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    title: `Saved decision ${index + 1}`,
    organizerName: 'Meeting reviewer',
    organizerUserId: 42,
    participantRole: 'ATTENDEE',
    canHost: false,
    endedAt: '2026-09-07T01:00:00Z',
    actualDurationMinutes: 30,
    participantPeak: 4,
    averageQualityScore: null,
    recordingAvailable: false,
    transcriptAvailable: false,
  });
  await page.route('**/api/meetings/v1/history?*', (route) => {
    const query = new URL(route.request().url()).searchParams;
    const current = Number(query.get('page'));
    const pageSize = Number(query.get('pageSize'));
    return reply(route, {
      items: Array.from({ length: total }, (_, index) => item(index)).slice(
        current * pageSize,
        (current + 1) * pageSize
      ),
      page: current,
      pageSize,
      total,
    });
  });
  await page.route('**/api/meetings/v1/history/bookmarks?*', (route) =>
    reply(route, {
      items: new URL(route.request().url()).searchParams.getAll('meetingIds').map((meetingId) => ({
        meetingId,
        favorite: true,
        version: 1,
        updatedAt: '2026-09-07T05:00:00Z',
      })),
    })
  );
  await page.route('**/api/meetings/v1/meetings/*/bookmark', (route) => {
    total = 10;
    const meetingId = new URL(route.request().url()).pathname.split('/').at(-2);
    return reply(route, {
      meetingId,
      favorite: false,
      version: 2,
      updatedAt: '2026-09-07T05:01:00Z',
    });
  });
  await page.goto('/meetings/history');
  await page.getByRole('tab', { name: 'Favorites', exact: true }).click();
  await page.getByRole('button', { name: 'Go to page 2', exact: true }).click();
  const remove = page.getByRole('button', {
    name: 'Remove Saved decision 11 from favorites',
    exact: true,
  });
  await expect(remove).toBeEnabled();
  await remove.click();
  await expect(page.getByTestId('meeting-library-list').locator('article')).toHaveCount(10);
  await expect(
    page
      .getByTestId('meeting-library-list')
      .getByRole('heading', { name: 'Saved decision 1', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No meeting history', exact: true })).toHaveCount(
    0
  );
});

test('unavailable bookmark storage never fabricates a saved state or sends an unchecked mutation', async ({
  page,
}) => {
  let writes = 0;
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().endsWith('/bookmark')) writes += 1;
  });
  await page.route('**/api/meetings/v1/history/bookmarks?*', (route) =>
    reply(route, { code: 'SERVICE_UNAVAILABLE' }, 503)
  );
  await page.goto('/meetings/history');
  await expect(
    page.getByText(
      'Favorites could not be verified. The previous state is not used; refresh before trying again.'
    )
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Add ${title} to favorites`, exact: true })
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: `Add ${title} to favorites`, exact: true })
  ).toHaveAttribute('aria-pressed', 'false');
  expect(writes).toBe(0);
  await expectNoBlockingA11y(page, 'U07 unavailable bookmark provider');
});
