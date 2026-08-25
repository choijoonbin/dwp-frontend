import { useMemo } from 'react';

import {
  findGovernedProductEntry,
  GOVERNED_ENTRY_MANIFESTS,
  usesLegacyProductLaunchDiscovery,
  useGovernedProductEntryCatalog,
} from './product-entry-point-registry';
import {
  resolveCanaryProductFlags,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from './product-surface-canary-runtime';

import type { HomeAppDefinition } from '../../components/workspace-composer/app-launchpad-model';

export function useGovernedHomeAppCatalog(
  entitledApps: readonly HomeAppDefinition[]
): HomeAppDefinition[] {
  const surfaceAuthority = useProductSurfaceCanaryAuthority();
  const governedEntries = useGovernedProductEntryCatalog();

  return useMemo(
    () =>
      entitledApps.flatMap((app) => {
        const manifest = GOVERNED_ENTRY_MANIFESTS.find(
          (candidate) => candidate.appKey === app.resourceKey
        );
        if (!manifest) return [app];

        const mode = resolveProductSurfaceRolloutMode(
          resolveCanaryProductFlags(surfaceAuthority, manifest.id)
        );
        if (usesLegacyProductLaunchDiscovery(mode)) return [app];

        const entry = findGovernedProductEntry(governedEntries, app.resourceKey);
        if (!entry || mode === 'invalid') return [];
        return [
          {
            ...app,
            route: entry.work?.path ?? entry.management?.path ?? app.route,
            managementRoute: entry.management?.path,
            managementOnly: !entry.work && Boolean(entry.management),
          },
        ];
      }),
    [entitledApps, governedEntries, surfaceAuthority]
  );
}
