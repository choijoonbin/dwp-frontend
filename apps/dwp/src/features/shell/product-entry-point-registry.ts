import { useMemo } from 'react';

import { GOVERNED_PRODUCT_MANIFESTS } from '../../components/product-manifest-registry';
import { buildProductAppCardEntryPoints } from './product-entry-point-model';
import {
  isProductSurfaceUiSeparated,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from './product-surface-canary-runtime';

import type { ProductSurfaceManifest } from '../../components/product-manifest';
import type { ProductSurfaceEntryPoint } from './product-entry-point-model';
import type { EffectiveProductSurfaceContextEnvelope } from './product-surface-context';
import type { ProductSurfaceCanaryAuthority } from './product-surface-canary-runtime';
import type { ProductSurfaceRolloutMode } from './product-surface-canary-runtime';

export type GovernedProductEntry = {
  productId: string;
  appResourceKey: string;
  work?: ProductSurfaceEntryPoint;
  management?: ProductSurfaceEntryPoint;
};

export const GOVERNED_ENTRY_MANIFESTS: readonly ProductSurfaceManifest[] = [
  ...GOVERNED_PRODUCT_MANIFESTS,
];

export function usesLegacyProductLaunchDiscovery(mode: ProductSurfaceRolloutMode): boolean {
  return mode !== 'invalid' && !isProductSurfaceUiSeparated(mode);
}

export function buildGovernedProductEntryCatalog(
  authority: Pick<ProductSurfaceCanaryAuthority, 'productFlags'>,
  envelope: EffectiveProductSurfaceContextEnvelope | undefined,
  manifests: readonly ProductSurfaceManifest[] = GOVERNED_ENTRY_MANIFESTS,
  nowMs = Date.now()
): readonly GovernedProductEntry[] {
  if (!envelope) return [];
  return manifests.flatMap((manifest) => {
    const flags = authority.productFlags?.[manifest.id];
    if (!flags) return [];
    const mode = resolveProductSurfaceRolloutMode(flags);
    // 110 deliberately keeps the compatibility shell and its legacy app launch/discovery model.
    // The new single management transition is disclosed only when the complete Surface UI is on.
    if (!isProductSurfaceUiSeparated(mode)) return [];
    const entry = buildProductAppCardEntryPoints(manifest, envelope.contexts, nowMs);
    const work = entry.primary?.plane === 'work' ? entry.primary : undefined;
    const management = [entry.primary, ...entry.managementActions].find(
      (candidate) => candidate?.plane === 'management'
    );
    return work || management
      ? [{ productId: manifest.id, appResourceKey: manifest.appKey, work, management }]
      : [];
  });
}

export function useGovernedProductEntryCatalog(): readonly GovernedProductEntry[] {
  const authority = useProductSurfaceCanaryAuthority();
  return useMemo(
    () =>
      buildGovernedProductEntryCatalog(
        authority,
        authority.envelope,
        GOVERNED_ENTRY_MANIFESTS,
        authority.serverNowMs
      ),
    [authority]
  );
}

export function findGovernedProductEntry(
  entries: readonly GovernedProductEntry[],
  resourceKey: string
): GovernedProductEntry | undefined {
  return entries.find((entry) => entry.appResourceKey === resourceKey);
}
