import type { LucideIcon } from 'lucide-react';

import type {
  ProductNavigationAccess,
  ProductSurfaceNavigationGroup,
  ProductTaskKind,
} from './product-manifest';

type LegacyNavigationItem = {
  path: string;
  view: string;
  icon: LucideIcon;
};

type LegacyNavigationGroup = {
  id: string;
  items: readonly LegacyNavigationItem[];
};

export type SurfaceNavigationContract = {
  taskKind: ProductTaskKind;
  access: ProductNavigationAccess;
};

/**
 * Projects a compatibility navigation source into exact, server-authorized surface navigation.
 * Every selected item must have one explicit contract; legacy permission fields are intentionally
 * discarded so they can never become an authorization fallback in an enforced surface.
 */
export function projectProductSurfaceNavigation(
  source: readonly LegacyNavigationGroup[],
  contracts: Readonly<Record<string, SurfaceNavigationContract>>
): readonly ProductSurfaceNavigationGroup[] {
  const projected = source.flatMap((group) => {
    const items = group.items.flatMap((item) => {
      const contract = contracts[item.view];
      if (!contract) return [];
      return [
        {
          path: item.path,
          view: item.view,
          icon: item.icon,
          taskKind: contract.taskKind,
          access: contract.access,
        },
      ];
    });
    return items.length > 0 ? [{ id: group.id, items }] : [];
  });

  const projectedViews = new Set(
    projected.flatMap((group) => group.items.map((item) => item.view))
  );
  const requestedViews = Object.keys(contracts);
  if (
    projectedViews.size !== requestedViews.length ||
    requestedViews.some((view) => !projectedViews.has(view))
  ) {
    throw new Error('Surface navigation contract references a missing or duplicate legacy item.');
  }
  return projected;
}
