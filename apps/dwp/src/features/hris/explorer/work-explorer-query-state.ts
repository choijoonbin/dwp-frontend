import { EXPLORER_MODULES, EXPLORER_WORKBENCHES } from './work-explorer-contract';

import type { ExplorerModule, ExplorerWorkbench } from './work-explorer-contract';

export type WorkExplorerQueryState = Readonly<{
  query: string;
  module: ExplorerModule | 'ALL';
  workbench: ExplorerWorkbench | 'ALL';
  selected: string | null;
}>;

export const EMPTY_WORK_EXPLORER_QUERY_STATE: WorkExplorerQueryState = Object.freeze({
  query: '',
  module: 'ALL',
  workbench: 'ALL',
  selected: null,
});

const ROUTE_KEY = /^hris\.explorer\.[a-z0-9.-]{3,80}$/;

export function parseWorkExplorerQueryState(search: URLSearchParams): WorkExplorerQueryState {
  const rawQuery = (search.get('q') ?? '').slice(0, 200);
  const rawModule = search.get('module');
  const rawWorkbench = search.get('workbench');
  const rawSelected = search.get('selected');
  return Object.freeze({
    query: rawQuery.trim() ? rawQuery : '',
    module:
      rawModule && EXPLORER_MODULES.includes(rawModule as ExplorerModule)
        ? (rawModule as ExplorerModule)
        : 'ALL',
    workbench:
      rawWorkbench && EXPLORER_WORKBENCHES.includes(rawWorkbench as ExplorerWorkbench)
        ? (rawWorkbench as ExplorerWorkbench)
        : 'ALL',
    selected: rawSelected && ROUTE_KEY.test(rawSelected) ? rawSelected : null,
  });
}

export function mergeWorkExplorerQueryState(
  current: URLSearchParams,
  patch: Partial<WorkExplorerQueryState>
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (patch.query !== undefined) {
    const query = patch.query.slice(0, 200);
    if (query.trim()) next.set('q', query);
    else next.delete('q');
  }
  if (patch.module !== undefined) {
    if (patch.module === 'ALL') next.delete('module');
    else next.set('module', patch.module);
  }
  if (patch.workbench !== undefined) {
    if (patch.workbench === 'ALL') next.delete('workbench');
    else next.set('workbench', patch.workbench);
  }
  if (patch.selected !== undefined) {
    if (patch.selected) next.set('selected', patch.selected);
    else next.delete('selected');
  }
  return next;
}
