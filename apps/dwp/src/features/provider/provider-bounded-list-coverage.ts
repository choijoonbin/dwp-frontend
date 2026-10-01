export type ProviderBoundedListCoverage = 'COMPLETE' | 'POSSIBLY_TRUNCATED';

export function providerBoundedListCoverage(
  itemCount: number,
  ownerLimit: number
): ProviderBoundedListCoverage {
  return itemCount < ownerLimit ? 'COMPLETE' : 'POSSIBLY_TRUNCATED';
}

export function providerBoundedMetric<T>(
  items: readonly T[] | undefined,
  ownerLimit: number,
  predicate: (item: T) => boolean
): number | null {
  if (!items || providerBoundedListCoverage(items.length, ownerLimit) !== 'COMPLETE') return null;
  return items.filter(predicate).length;
}

export function providerOwnerCountLabel(visibleCount: number, hasMore: boolean): string {
  return hasMore ? `${visibleCount}+` : String(visibleCount);
}

export function providerOwnerListCanClaimEmpty(visibleCount: number, hasMore: boolean): boolean {
  return visibleCount === 0 && !hasMore;
}
