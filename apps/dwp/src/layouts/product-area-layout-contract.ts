import type { ReactNode } from 'react';

import {
  normalizeProductPath,
  type ProductNavigationGroup,
  type ProductNavigationItem,
  type ProductShellNavigationProjection,
  type ProductSurfaceManifest,
  type ProductSurfaceNavigationItem,
} from '../components/product-manifest';

import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';

export type ProductAreaNavigationGroup = ProductNavigationGroup;
export type ProductAreaNavigationItem = ProductNavigationItem;

export type ProductAreaNavigationLocation = Readonly<{
  pathname: string;
  search: string;
  hash: string;
}>;

export function isProductAreaSurfaceNavigationItem(
  item: ProductAreaNavigationItem
): item is ProductSurfaceNavigationItem {
  return 'access' in item && 'taskKind' in item;
}

export type ProductAreaNavigationItemChildrenContext = Readonly<{
  item: ProductAreaNavigationItem;
  selected: boolean;
  compact: boolean;
  onNavigate?: () => void;
  onNavigateToTarget?: (resolveTarget: () => HTMLElement | null, expectedLocation?: string) => void;
  resolveNavigationLocation?: (
    location: ProductAreaNavigationLocation
  ) => ProductAreaNavigationLocation;
}>;

export type ProductAreaMobileShellContext = Readonly<{
  pathname: string;
  search: string;
  visibleNavigationPaths: readonly string[];
  navigation: Readonly<{
    controlsId: string;
    expanded: boolean;
    label: string;
    testId: string;
    onOpen: (trigger: HTMLButtonElement) => void;
  }>;
  onNavigate: (path: string) => void;
}>;

export type ProductAreaMobileShellPresentation = Readonly<{
  header: ReactNode;
  footer?: ReactNode;
}>;

export type ProductAreaLayoutProps = {
  areaKey:
    | 'dwaion'
    | 'work'
    | 'activity'
    | 'communications'
    | 'services'
    | 'hcm'
    | 'calendar'
    | 'rooms'
    | 'approvals'
    | 'mail'
    | 'meetings'
    | 'messaging'
    | 'notifications'
    | 'spaces';
  navigation: readonly ProductAreaNavigationGroup[];
  manifest?: ProductSurfaceManifest;
  translationNamespace?:
    | 'workforce'
    | 'work'
    | 'communications'
    | 'services'
    | 'hcm'
    | 'calendar'
    | 'rooms'
    | 'approvals'
    | 'mail'
    | 'meetings'
    | 'messaging'
    | 'notifications'
    | 'spaces';
  surface?: ProductSurfaceLayoutRuntime;
  shellNavigationProjection?: ProductShellNavigationProjection;
  canAccessLegacySurface?: (surface: ProductSurfaceManifest['surfaces'][number]) => boolean;
  renderNavigationItemChildren?: (context: ProductAreaNavigationItemChildrenContext) => ReactNode;
  navigationChildrenPresentation?: 'disclosure' | 'inline' | 'panel';
  mobileSurfaceNavigation?: 'header' | 'drawer';
  resolveMobileShell?: (
    context: ProductAreaMobileShellContext
  ) => ProductAreaMobileShellPresentation;
};

export function resolveProductAreaParentAriaCurrent({
  selected,
  pathname,
  item,
  hasInlineChildren,
}: Readonly<{
  selected: boolean;
  pathname: string;
  item: ProductAreaNavigationItem;
  hasInlineChildren: boolean;
}>): 'page' | undefined {
  if (!selected || !hasInlineChildren) return selected ? 'page' : undefined;

  const currentPath = normalizeProductPath(pathname);
  const parentPath = normalizeProductPath(item.path);
  if (currentPath === parentPath) return 'page';

  const hasActiveChild = item.activePathPrefixes?.some(
    (candidate) => normalizeProductPath(candidate) === currentPath
  );
  return hasActiveChild ? undefined : 'page';
}
