import type { CommunicationFeed, CommunicationItem } from '@dwp-frontend/shared-utils';

export type CommunicationActionKind = 'CRITICAL' | 'REQUIRED';

export type CommunicationActionRailItem = Readonly<{
  item: CommunicationItem;
  kind: CommunicationActionKind;
}>;

function needsAcknowledgement(item: CommunicationItem): boolean {
  return item.acknowledgementRequired && !item.readerState.acknowledged;
}

function isUnreadCritical(item: CommunicationItem): boolean {
  return item.severity === 'CRITICAL' && item.readerState.unread;
}

function actionKind(item: CommunicationItem): CommunicationActionKind | undefined {
  if (item.readerState.dismissed) return undefined;
  if (isUnreadCritical(item)) return 'CRITICAL';
  if (needsAcknowledgement(item)) return 'REQUIRED';
  return undefined;
}

function feedStories(feed?: CommunicationFeed): Array<CommunicationItem | null | undefined> {
  return [feed?.featured, ...(feed?.items ?? [])];
}

/**
 * The server-provided action slice is already ordered by urgency. Required-feed
 * stories are appended only as a rolling-deployment fallback, and every story is
 * represented once even when it is also featured in the editorial feed.
 */
export function buildCommunicationActionRailItems(
  feed?: CommunicationFeed,
  requiredFeed?: CommunicationFeed
): CommunicationActionRailItem[] {
  const candidates = [
    ...(feed?.actionableItems ?? []),
    ...(requiredFeed?.actionableItems ?? []),
    ...feedStories(requiredFeed),
  ];
  const unique = new Map<number, CommunicationActionRailItem>();

  for (const item of candidates) {
    if (!item) continue;
    const kind = actionKind(item);
    if (!kind) continue;
    const current = unique.get(item.communicationId);
    if (!current || (current.kind === 'REQUIRED' && kind === 'CRITICAL')) {
      unique.set(item.communicationId, { item, kind });
    }
  }

  return [...unique.values()];
}

export function communicationActionIds(
  items: readonly CommunicationActionRailItem[]
): ReadonlySet<number> {
  return new Set(items.map(({ item }) => item.communicationId));
}
