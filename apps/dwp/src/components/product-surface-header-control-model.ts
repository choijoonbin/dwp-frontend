import type { ProductSurfaceEntryPoint } from '../features/shell/product-entry-point-model';

export type ProductSurfaceNavigationEntry = Pick<
  ProductSurfaceEntryPoint,
  'productId' | 'surfaceId' | 'plane' | 'labelKey' | 'path' | 'entryKind'
>;

export type ProductSurfaceHeaderControlModel = {
  current: ProductSurfaceNavigationEntry;
  currentPlane: ProductSurfaceNavigationEntry['plane'];
  samePlaneEntries: readonly ProductSurfaceNavigationEntry[];
  transitionEntry?: ProductSurfaceNavigationEntry;
};

/** Keeps same-plane navigation separate from the explicit Work/Management transition. */
export function resolveProductSurfaceHeaderControlModel(
  currentSurfaceId: string,
  entries: readonly ProductSurfaceNavigationEntry[]
): ProductSurfaceHeaderControlModel | undefined {
  const current = entries.find((entry) => entry.surfaceId === currentSurfaceId);
  if (!current) return undefined;

  return {
    current,
    currentPlane: current.plane,
    samePlaneEntries: entries.filter(
      (entry) =>
        entry.plane === current.plane &&
        entry.entryKind !== 'management-entry' &&
        entry.entryKind !== 'work-return'
    ),
    transitionEntry: entries.find((entry) =>
      current.plane === 'work'
        ? entry.entryKind === 'management-entry'
        : entry.entryKind === 'work-return'
    ),
  };
}
