import type { WorkHubSnapshot, WorkHubSourceId } from './work-hub-contracts';
import { assembleWorkHubSnapshot } from './work-hub-loader';

/** Replaces one verified source without claiming that its neighbours were read again. */
export function mergeWorkHubSourceRefresh(
  previous: WorkHubSnapshot,
  refreshed: WorkHubSnapshot,
  sourceId: WorkHubSourceId
): WorkHubSnapshot | null {
  const requested = refreshed.sources.filter((source) => source.state !== 'NOT_REQUESTED');
  const prior = previous.sources.filter((source) => source.sourceId === sourceId);
  if (
    requested.length !== 1 ||
    requested[0].sourceId !== sourceId ||
    prior.length !== 1 ||
    prior[0].state === 'NOT_REQUESTED' ||
    requested[0].items.some((item) => item.sourceId !== sourceId)
  )
    return null;

  const replacedKeys = new Set([
    ...prior[0].items.map((item) => item.key),
    ...previous.items.filter((item) => item.sourceId === sourceId).map((item) => item.key),
  ]);
  const sources = previous.sources.map((source) => {
    if (source.sourceId === sourceId) return requested[0];
    // A stale Workspace projection must not resurrect an owner row removed by this read.
    // Independently authorized owner-source rows retain their own version precedence.
    if (source.sourceId === 'workspace' && sourceId !== 'workspace')
      return { ...source, items: source.items.filter((item) => !replacedKeys.has(item.key)) };
    return source;
  });
  return assembleWorkHubSnapshot(sources, refreshed.receivedAt);
}
