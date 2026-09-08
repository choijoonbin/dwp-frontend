import type { Page, Route } from '@playwright/test';

function fulfill(route: Route, data: unknown, status = 200) {
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

/** Synthetic per-page state for design/interaction evidence, never operational authorization evidence. */
export async function mockMeetingRecordBookmarks<T extends { meetingId: string }>(
  page: Page,
  historyItems: readonly T[]
) {
  const bookmarks = new Map<
    string,
    { meetingId: string; favorite: boolean; version: number; updatedAt: string | null }
  >();
  await page.route('**/api/meetings/v1/history/bookmarks?*', (route) => {
    const ids = new URL(route.request().url()).searchParams.getAll('meetingIds');
    return fulfill(route, {
      items: ids.map(
        (meetingId) =>
          bookmarks.get(meetingId) ?? {
            meetingId,
            favorite: false,
            version: 0,
            updatedAt: null,
          }
      ),
    });
  });
  await page.route('**/api/meetings/v1/meetings/*/bookmark', (route) => {
    const meetingId = new URL(route.request().url()).pathname.split('/').at(-2)!;
    const input = route.request().postDataJSON() as { favorite: boolean; expectedVersion: number };
    const previous = bookmarks.get(meetingId);
    if (route.request().method() !== 'PUT' || input.expectedVersion !== (previous?.version ?? 0))
      return fulfill(route, { code: 'VERSION_CONFLICT' }, 409);
    const result = {
      meetingId,
      favorite: input.favorite,
      version: input.expectedVersion + 1,
      updatedAt: '2026-09-07T05:00:00Z',
    };
    bookmarks.set(meetingId, result);
    return fulfill(route, result);
  });
  await page.route('**/api/meetings/v1/history?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const items =
      params.get('favoriteOnly') === 'true'
        ? historyItems.filter(({ meetingId }) => bookmarks.get(meetingId)?.favorite)
        : historyItems;
    const pageNumber = Number(params.get('page') ?? 0);
    const pageSize = Number(params.get('pageSize') ?? 30);
    return fulfill(route, {
      items: items.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize),
      page: pageNumber,
      pageSize,
      total: items.length,
    });
  });
}
