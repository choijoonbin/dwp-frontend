import { describe, expect, it, vi } from 'vitest';
import type {
  PersonalWorkPage,
  PersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import {
  HOME_PERSONAL_WORK_MAX_ITEMS,
  HOME_PERSONAL_WORK_MAX_PAGES,
  HOME_PERSONAL_WORK_PAGE_SIZE,
  loadHomePersonalWorkTasks,
} from './home-personal-work-loader';

const timestamp = '2026-09-07T00:00:00.000Z';

function task(taskId: string, version = 0): PersonalWorkTask {
  return {
    taskId,
    title: taskId,
    description: null,
    status: 'OPEN',
    priority: 'NORMAL',
    dueAt: null,
    source: null,
    version,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };
}

function page(
  pageNumber: number,
  items: PersonalWorkTask[],
  hasMore: boolean,
  totalElements: number
): PersonalWorkPage<PersonalWorkTask> {
  return {
    items,
    page: pageNumber,
    size: HOME_PERSONAL_WORK_PAGE_SIZE,
    totalElements,
    hasMore,
  };
}

describe('Flow personal work pagination', () => {
  it('reads every page, forwards one cancellation signal, and keeps the newest task version', async () => {
    const controller = new AbortController();
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(page(0, [task('a'), task('b')], true, 4))
      .mockResolvedValueOnce(page(1, [task('b', 2), task('c')], true, 4))
      .mockResolvedValueOnce(page(2, [task('d')], false, 4));

    const result = await loadHomePersonalWorkTasks(controller.signal, readPage);

    expect(readPage).toHaveBeenCalledTimes(3);
    expect(readPage.mock.calls).toEqual([
      [{ page: 0, size: HOME_PERSONAL_WORK_PAGE_SIZE, signal: controller.signal }],
      [{ page: 1, size: HOME_PERSONAL_WORK_PAGE_SIZE, signal: controller.signal }],
      [{ page: 2, size: HOME_PERSONAL_WORK_PAGE_SIZE, signal: controller.signal }],
    ]);
    expect(result.items.map(({ taskId, version }) => [taskId, version])).toEqual([
      ['a', 0],
      ['b', 2],
      ['c', 0],
      ['d', 0],
    ]);
    expect(result).toMatchObject({ totalElements: 4, hasMore: false });
  });

  it('returns an explicit partial page when the defensive page/item ceiling is reached', async () => {
    const readPage = vi.fn(async ({ page: pageNumber }: { page: number }) =>
      page(
        pageNumber,
        Array.from({ length: HOME_PERSONAL_WORK_PAGE_SIZE }, (_, index) =>
          task(`${pageNumber}-${index}`)
        ),
        true,
        HOME_PERSONAL_WORK_MAX_ITEMS + 1
      )
    );

    const result = await loadHomePersonalWorkTasks(new AbortController().signal, readPage);

    expect(readPage).toHaveBeenCalledTimes(HOME_PERSONAL_WORK_MAX_PAGES);
    expect(result.items).toHaveLength(HOME_PERSONAL_WORK_MAX_ITEMS);
    expect(result.hasMore).toBe(true);
  });

  it('fails a non-advancing pagination contract instead of looping', async () => {
    const repeated = task('same');
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(page(0, [repeated], true, 3))
      .mockResolvedValueOnce(page(1, [repeated], true, 3));

    await expect(loadHomePersonalWorkTasks(new AbortController().signal, readPage)).rejects.toThrow(
      'pagination did not advance'
    );
    expect(readPage).toHaveBeenCalledTimes(2);
  });

  it('stops before another page when the owning query is cancelled', async () => {
    const controller = new AbortController();
    const readPage = vi.fn(async () => {
      controller.abort();
      return page(0, [task('private')], true, 2);
    });

    await expect(loadHomePersonalWorkTasks(controller.signal, readPage)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(readPage).toHaveBeenCalledTimes(1);
  });
});
