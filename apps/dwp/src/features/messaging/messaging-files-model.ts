import type { MessagingSharedAsset } from '@dwp-frontend/shared-utils';

export type MessagingAssetKindFilter = 'ALL' | MessagingSharedAsset['kind'];

export function messagingAssetKindFilter(value: string | null): MessagingAssetKindFilter {
  return value === 'FILE' || value === 'LINK' ? value : 'ALL';
}

export function filterMessagingAssets(
  items: readonly MessagingSharedAsset[],
  query: string,
  kind: MessagingAssetKindFilter
) {
  const normalized = query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    if (kind !== 'ALL' && item.kind !== kind) return false;
    if (!normalized) return true;
    return [item.title, item.conversationName, item.senderName, item.contentType]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalized));
  });
}

export function messagingAssetFileSize(sizeBytes: number | null) {
  if (sizeBytes === null) return null;
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.ceil(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
