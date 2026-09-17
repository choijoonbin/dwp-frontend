import { describe, expect, it } from 'vitest';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../routes/product-surface-authorization.generated';
import { DWAION_MUTATION_BINDINGS } from './dwaion-governed-mutation-bindings';

describe('DWAI-ON governed mutation bindings', () => {
  it('covers every exact DWAI-ON ACTION route in authorization v21', () => {
    const exactActions = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
      (route) => route.productId === 'dwaion' && route.routeKind === 'ACTION'
    );
    const routeKeys = exactActions.map((route) => route.routeContractKey).sort();
    const bindingKeys = Object.keys(DWAION_MUTATION_BINDINGS).sort();

    expect(routeKeys.length).toBeGreaterThan(0);
    expect(bindingKeys).toEqual(routeKeys);
    for (const route of exactActions) {
      const binding = DWAION_MUTATION_BINDINGS[route.routeContractKey];
      expect(binding).toBeDefined();
      expect(binding.productKey).toBe('dwaion');
      expect(binding.surfaceKey).toBe(route.surfaceId);
      expect(binding.taskKind).toBe(
        route.surfaceId === 'dwaion.management' ? 'ADMINISTRATION' : 'WORK'
      );
    }
  });
});
