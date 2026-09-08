import { getPersonalWorkTasks } from '@dwp-frontend/shared-utils/api/personal-work-api';
import type {
  PersonalWorkPage,
  PersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

export const HOME_PERSONAL_WORK_PAGE_SIZE = 100;
export const HOME_PERSONAL_WORK_MAX_PAGES = 10;
export const HOME_PERSONAL_WORK_MAX_ITEMS =
  HOME_PERSONAL_WORK_PAGE_SIZE * HOME_PERSONAL_WORK_MAX_PAGES;

type PersonalWorkPageReader = (
  options: Readonly<{ page: number; size: number; signal: AbortSignal }>
) => Promise<PersonalWorkPage<PersonalWorkTask>>;

/**
 * Reads enough owned personal work for Flow without allowing a broken or unbounded
 * pagination contract to hold the home screen open indefinitely.
 */
export async function loadHomePersonalWorkTasks(
  signal: AbortSignal,
  readPage: PersonalWorkPageReader = getPersonalWorkTasks
): Promise<PersonalWorkPage<PersonalWorkTask>> {
  const tasks = new Map<string, PersonalWorkTask>();
  let totalElements = 0;
  let hasMore = false;

  for (let page = 0; page < HOME_PERSONAL_WORK_MAX_PAGES; page += 1) {
    signal.throwIfAborted();
    const result = await readPage({ page, size: HOME_PERSONAL_WORK_PAGE_SIZE, signal });
    signal.throwIfAborted();
    if (result.page !== page) throw new Error('Home personal work pagination did not advance');

    totalElements = Math.max(totalElements, result.totalElements, tasks.size);
    let newTaskCount = 0;
    for (const task of result.items) {
      const previous = tasks.get(task.taskId);
      if (!previous) newTaskCount += 1;
      if (!previous || task.version > previous.version) tasks.set(task.taskId, task);
      if (tasks.size >= HOME_PERSONAL_WORK_MAX_ITEMS) break;
    }
    totalElements = Math.max(totalElements, tasks.size);

    const reachedItemLimit = tasks.size >= HOME_PERSONAL_WORK_MAX_ITEMS;
    const reachedPageLimit = page + 1 >= HOME_PERSONAL_WORK_MAX_PAGES;
    hasMore = result.hasMore || totalElements > tasks.size;
    if (!hasMore) break;
    if (reachedItemLimit || reachedPageLimit) break;
    if (newTaskCount === 0) throw new Error('Home personal work pagination did not advance');
  }

  return {
    items: [...tasks.values()],
    page: 0,
    size: HOME_PERSONAL_WORK_PAGE_SIZE,
    totalElements,
    hasMore,
  };
}
