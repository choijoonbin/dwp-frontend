import { describe, expect, it } from 'vitest';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../routes/product-surface-authorization.generated';
import { resolveDwaionMutationBinding } from './dwaion-governed-mutation-bindings';

describe('DWAI-ON governed mutation bindings', () => {
  it('covers every exact DWAI-ON ACTION route in authorization v21', () => {
    const exactActions = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
      (route) => route.productId === 'dwaion' && route.routeKind === 'ACTION'
    );
    expect(exactActions.length).toBeGreaterThan(0);
    for (const route of exactActions) {
      const binding = resolveDwaionMutationBinding(
        route.routeContractKey as `route.dwaion.${'work' | 'management'}.${string}.action`
      );
      expect(binding.productKey).toBe('dwaion');
      expect(binding.surfaceKey).toBe(route.surfaceId);
      expect(binding.taskKind).toBe(
        route.surfaceId === 'dwaion.management' ? 'ADMINISTRATION' : 'WORK'
      );
    }

    expect(() => resolveDwaionMutationBinding('route.dwaion.work.invalid' as never)).toThrow(
      /Invalid DWAI-ON mutation route/
    );
  });
});
