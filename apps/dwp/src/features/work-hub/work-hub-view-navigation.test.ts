import { describe, expect, it } from 'vitest';
import {
  WORK_HUB_VIEWS,
  workHubFiltersForPath,
  workHubPathForScope,
  workHubScopeForPath,
  workHubViewFromPath,
  workHubViewLocation,
} from './work-hub-view-navigation';

describe('Work menu location contract', () => {
  it.each(WORK_HUB_VIEWS)('binds $path to the $scope scope', ({ path, scope, view }) => {
    expect(workHubViewFromPath(path)).toBe(view);
    expect(workHubScopeForPath(path)).toBe(scope);
    expect(workHubPathForScope(scope)).toBe(path);
    expect(workHubFiltersForPath(path, new URLSearchParams({ scope: 'WAITING' })).scope).toBe(
      scope
    );
  });

  it('preserves search refinements across menu navigation and clears the previous selection', () => {
    const current = new URLSearchParams({
      scope: 'WAITING',
      q: '한글 업무',
      source: 'PERSONAL_TASK',
      urgency: 'OVERDUE',
      sort: 'priority',
      work: 'private-source-key',
      item: 'legacy-id',
      personalTaskId: 'old-task',
      compose: 'task',
      panel: 'sources',
      select: '1',
    });
    const next = workHubViewLocation('completed', current);
    expect(next.pathname).toBe('/work/completed');
    expect(Object.fromEntries(new URLSearchParams(next.search))).toEqual({
      q: '한글 업무',
      source: 'PERSONAL_TASK',
      urgency: 'OVERDUE',
      sort: 'priority',
    });
    expect(current.get('work')).toBe('private-source-key');
  });

  it('keeps direct detail URLs in their owning menu and defaults compatibility paths to the inbox', () => {
    expect(workHubViewFromPath('/work/completed/task-1')).toBe('completed');
    expect(workHubViewFromPath('/work/completed-other')).toBe('queue');
    expect(workHubScopeForPath('/work/home')).toBe('ALL');
    expect(
      workHubFiltersForPath('/work/queue', new URLSearchParams({ q: 'invoice' }))
    ).toMatchObject({
      scope: 'ALL',
      query: 'invoice',
    });
  });
});
