import type { LucideIcon } from 'lucide-react';

export type ProductNavigationItem = {
  path: string;
  view: string;
  icon: LucideIcon;
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
  requiredAnyPermissionCodes?: readonly string[];
  requiredAllPermissionCodes?: readonly string[];
  requiredAnyAuthorities?: readonly {
    resourceKey: string;
    permissionCode: string;
  }[];
  requiredAnySupportScopes?: readonly string[];
};

export type ProductNavigationGroup = {
  id: string;
  items: readonly ProductNavigationItem[];
};

export type ProductManifest<AreaKey extends string = string> = {
  id: string;
  appKey: string;
  basePath: `/${string}`;
  homePath: `/${string}`;
  shellKey: AreaKey;
  adminMode: 'none' | 'embedded' | 'control-center';
  navigation: readonly ProductNavigationGroup[];
  legacyPaths?: readonly `/${string}`[];
};

export function defineProductManifest<AreaKey extends string>(
  manifest: ProductManifest<AreaKey>
): ProductManifest<AreaKey> {
  if (!manifest.homePath.startsWith(`${manifest.basePath}/`)) {
    throw new Error(`${manifest.id} home path must be owned by its product base path.`);
  }
  const items = manifest.navigation.flatMap((group) => group.items);
  const paths = new Set<string>();
  for (const item of items) {
    if (!item.path.startsWith(`${manifest.basePath}/`)) {
      throw new Error(
        `${manifest.id} navigation path is outside its product boundary: ${item.path}`
      );
    }
    if (paths.has(item.path)) {
      throw new Error(`${manifest.id} navigation path is duplicated: ${item.path}`);
    }
    paths.add(item.path);
    if (
      (item.requiredPermissionCode ||
        item.requiredAnyPermissionCodes?.length ||
        item.requiredAllPermissionCodes?.length) &&
      !item.requiredResourceKey
    ) {
      throw new Error(`${manifest.id} governed navigation requires a resource: ${item.path}`);
    }
    if (
      item.requiredAnyAuthorities?.some(
        (authority) => !authority.resourceKey.trim() || !authority.permissionCode.trim()
      )
    ) {
      throw new Error(`${manifest.id} navigation authority is incomplete: ${item.path}`);
    }
    if (item.requiredAnySupportScopes?.some((scope) => !scope.trim())) {
      throw new Error(`${manifest.id} navigation support scope is incomplete: ${item.path}`);
    }
  }
  return manifest;
}
