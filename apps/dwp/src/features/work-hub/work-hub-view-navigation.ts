import { parseWorkHubFilters, type WorkHubFilters } from './work-hub-model';
import { WORK_HUB_VIEWS, type WorkHubView } from './work-hub-view-contract';

export { WORK_HUB_VIEWS, type WorkHubView } from './work-hub-view-contract';

export function workHubViewFromPath(pathname: string): WorkHubView {
  return (
    WORK_HUB_VIEWS.find(
      (candidate) => pathname === candidate.path || pathname.startsWith(`${candidate.path}/`)
    )?.view ?? 'queue'
  );
}

export function workHubScopeForPath(pathname: string): WorkHubFilters['scope'] {
  return WORK_HUB_VIEWS.find((candidate) => candidate.view === workHubViewFromPath(pathname))!
    .scope;
}

export function workHubPathForScope(scope: WorkHubFilters['scope']): string {
  return WORK_HUB_VIEWS.find((candidate) => candidate.scope === scope)?.path ?? '/work/queue';
}

export function workHubFiltersForPath(pathname: string, params: URLSearchParams): WorkHubFilters {
  return { ...parseWorkHubFilters(params), scope: workHubScopeForPath(pathname) };
}

/** Preserve refinements when moving between Work menus, without carrying a stale selection. */
export function workHubViewLocation(view: WorkHubView, params: URLSearchParams) {
  const next = new URLSearchParams(params);
  for (const key of ['scope', 'work', 'item', 'personalTaskId', 'compose', 'panel', 'select'])
    next.delete(key);
  const search = next.toString();
  return {
    pathname: WORK_HUB_VIEWS.find((candidate) => candidate.view === view)!.path,
    search: search ? `?${search}` : '',
  };
}
