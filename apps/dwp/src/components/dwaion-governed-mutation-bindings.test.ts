import { describe, expect, it } from 'vitest';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../routes/product-surface-authorization.generated';
import { DWAION_MUTATION_BINDINGS } from './dwaion-governed-mutation-bindings';

describe('DWAI-ON governed mutation bindings', () => {
  it('is closed over every exact DWAI-ON ACTION route in authorization v6', () => {
    const exactActions = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
      (route) => route.productId === 'dwaion' && route.routeKind === 'ACTION'
    );
    const routeKeys = exactActions.map((route) => route.routeContractKey).sort();

    expect(routeKeys).toHaveLength(57);
    expect(Object.keys(DWAION_MUTATION_BINDINGS).sort()).toEqual(routeKeys);
    for (const route of exactActions) {
      const binding = DWAION_MUTATION_BINDINGS[route.routeContractKey];
      expect(binding.productKey).toBe('dwaion');
      expect(binding.surfaceKey).toBe(route.surfaceId);
      expect(binding.taskKind).toBe(
        route.surfaceId === 'dwaion.management' ? 'ADMINISTRATION' : 'WORK'
      );
    }
  });
});
