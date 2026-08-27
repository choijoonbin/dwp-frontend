import { describe, expect, it } from 'vitest';

import { GOVERNED_PRODUCT_MANIFESTS } from '../../components/product-manifest-registry';
import { GOVERNED_PRODUCT_ENTRY_CATALOG } from '../../components/product-entry-point-catalog';

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

describe('governed product entry catalog projection', () => {
  it('is a unique, set-equal projection of every governed product manifest', () => {
    const catalogProductIds = GOVERNED_PRODUCT_ENTRY_CATALOG.map((manifest) => manifest.id);
    const governedProductIds = GOVERNED_PRODUCT_MANIFESTS.map((manifest) => manifest.id);

    expect(new Set(catalogProductIds).size).toBe(catalogProductIds.length);
    expect(sorted(catalogProductIds)).toEqual(sorted(governedProductIds));

    for (const manifest of GOVERNED_PRODUCT_MANIFESTS) {
      const entry = GOVERNED_PRODUCT_ENTRY_CATALOG.find(
        (candidate) => candidate.id === manifest.id
      );
      expect(entry, `catalog entry for ${manifest.id}`).toBeDefined();
      expect(entry?.appKey).toBe(manifest.appKey);

      const entrySurfaceIds = entry?.surfaces.map((surface) => surface.id) ?? [];
      const manifestSurfaceIds = manifest.surfaces.map((surface) => surface.id);
      expect(new Set(entrySurfaceIds).size).toBe(entrySurfaceIds.length);
      expect(sorted(entrySurfaceIds)).toEqual(sorted(manifestSurfaceIds));

      for (const surface of manifest.surfaces) {
        const entrySurface = entry?.surfaces.find((candidate) => candidate.id === surface.id);
        expect(entrySurface, `catalog surface for ${surface.id}`).toBeDefined();
        expect(entrySurface).toMatchObject({
          plane: surface.plane,
          indexPath: surface.indexPath,
        });
        expect(entrySurface?.returnSurfaceId).toBe(surface.returnSurfaceId);
        expect(sorted(entrySurface?.taskKinds ?? [])).toEqual(sorted(surface.taskKinds));
        expect(new Set(entrySurface?.taskKinds).size).toBe(entrySurface?.taskKinds.length);
        expect(sorted(entrySurface?.supportedScopeKinds ?? [])).toEqual(
          sorted(surface.supportedScopeKinds)
        );
        expect(new Set(entrySurface?.supportedScopeKinds).size).toBe(
          entrySurface?.supportedScopeKinds.length
        );
      }
    }
  });
});
