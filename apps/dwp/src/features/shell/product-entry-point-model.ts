import type { ProductPlane, ProductSurfaceManifest } from '../../components/product-manifest';

import { resolveEffectiveScope } from './product-surface-context';

import type { EffectiveProductSurfaceContext } from './product-surface-context';

export type ProductSurfaceEntryPoint = {
  productId: string;
  surfaceId: string;
  plane: ProductPlane;
  labelKey: string;
  path: string;
  contextKey: string;
  contextScopeKey?: string;
  requiresScopeSelection: boolean;
  readOnly: boolean;
  entryKind?: 'surface' | 'management-entry' | 'work-return';
};

export type ProductAppCardEntryPoints = {
  primary?: ProductSurfaceEntryPoint;
  managementActions: readonly ProductSurfaceEntryPoint[];
};

function scopedEntryPath(indexPath: string, contextScopeKey: string | undefined): string {
  if (!contextScopeKey) return indexPath;
  return `${indexPath}?${new URLSearchParams({ scope: contextScopeKey }).toString()}`;
}

export function buildProductSurfaceEntryPoints(
  manifest: ProductSurfaceManifest,
  contexts: readonly EffectiveProductSurfaceContext[],
  nowMs = Date.now()
): readonly ProductSurfaceEntryPoint[] {
  const productContexts = contexts.filter((context) => context.productKey === manifest.id);
  if (new Set(productContexts.map((context) => context.accessMode)).size > 1) return [];
  if (
    productContexts.some((context) => {
      const surface = manifest.surfaces.find((candidate) => candidate.id === context.surfaceKey);
      const revalidateAt = Date.parse(context.revalidateAt);
      return (
        !surface ||
        surface.plane !== context.plane ||
        !Number.isFinite(revalidateAt) ||
        revalidateAt <= nowMs ||
        context.scopes.some((scope) => !surface.supportedScopeKinds.includes(scope.kind)) ||
        productContexts.filter((candidate) => candidate.surfaceKey === context.surfaceKey).length >
          1
      );
    })
  ) {
    return [];
  }
  return manifest.surfaces.flatMap((surface) => {
    const matchingContexts = productContexts.filter(
      (context) => context.surfaceKey === surface.id && context.plane === surface.plane
    );
    if (matchingContexts.length !== 1) return [];
    const context = matchingContexts[0]!;
    const scope = resolveEffectiveScope(context.scopes, undefined, nowMs);
    if (
      scope.state === 'authority-unavailable' ||
      scope.state === 'expired' ||
      scope.state === 'scope-invalid'
    ) {
      return [];
    }
    const selectedScope = scope.state === 'selected' ? scope.scope : undefined;
    return [
      {
        productId: manifest.id,
        surfaceId: surface.id,
        plane: surface.plane,
        labelKey: surface.labelKey,
        path: scopedEntryPath(surface.indexPath, selectedScope?.key),
        contextKey: context.contextKey,
        contextScopeKey: selectedScope?.key,
        requiresScopeSelection: scope.state === 'scope-selection-required',
        readOnly:
          selectedScope?.readOnly ?? context.effectiveGrants.every((grant) => grant.readOnly),
      },
    ];
  });
}

function preferredManagementEntry(
  manifest: ProductSurfaceManifest,
  entries: readonly ProductSurfaceEntryPoint[]
): ProductSurfaceEntryPoint | undefined {
  const managementEntries = entries.filter((entry) => entry.plane === 'management');
  const administrationSurfaceIds = new Set(
    manifest.surfaces
      .filter(
        (surface) => surface.plane === 'management' && surface.taskKinds.includes('administration')
      )
      .map((surface) => surface.id)
  );
  return (
    managementEntries.find((entry) => administrationSurfaceIds.has(entry.surfaceId)) ??
    managementEntries[0]
  );
}

/**
 * Work presents one explicit App Management transition. Once inside the management plane,
 * its product-owned sub-surfaces may be selected without leaking them into the work header.
 */
export function buildProductHeaderEntryPoints(
  manifest: ProductSurfaceManifest,
  currentSurfaceId: string,
  entries: readonly ProductSurfaceEntryPoint[]
): readonly ProductSurfaceEntryPoint[] {
  const currentSurface = manifest.surfaces.find((surface) => surface.id === currentSurfaceId);
  if (!currentSurface) return [];
  const workEntries = entries.filter((entry) => entry.plane === 'work');
  const managementEntries = entries.filter((entry) => entry.plane === 'management');

  if (currentSurface.plane === 'work') {
    const managementEntry = preferredManagementEntry(manifest, entries);
    return managementEntry
      ? [...workEntries, { ...managementEntry, entryKind: 'management-entry' }]
      : workEntries;
  }

  const returnSurfaceId = currentSurface.returnSurfaceId;
  const workReturn =
    workEntries.find((entry) => entry.surfaceId === returnSurfaceId) ?? workEntries[0];
  return [
    ...(workReturn ? [{ ...workReturn, entryKind: 'work-return' as const }] : []),
    ...managementEntries,
  ];
}

export function buildProductAppCardEntryPoints(
  manifest: ProductSurfaceManifest,
  contexts: readonly EffectiveProductSurfaceContext[],
  nowMs = Date.now()
): ProductAppCardEntryPoints {
  const entries = buildProductSurfaceEntryPoints(manifest, contexts, nowMs);
  const workEntry = entries.find((entry) => entry.plane === 'work');
  const managementEntry = preferredManagementEntry(manifest, entries);
  return {
    primary: workEntry ?? managementEntry,
    managementActions: workEntry && managementEntry ? [managementEntry] : [],
  };
}

export function buildManageableProductList(
  manifests: readonly ProductSurfaceManifest[],
  contexts: readonly EffectiveProductSurfaceContext[],
  nowMs = Date.now()
): readonly { productId: string; entries: readonly ProductSurfaceEntryPoint[] }[] {
  return manifests.flatMap((manifest) => {
    const entry = preferredManagementEntry(
      manifest,
      buildProductSurfaceEntryPoints(manifest, contexts, nowMs)
    );
    return entry ? [{ productId: manifest.id, entries: [entry] }] : [];
  });
}
