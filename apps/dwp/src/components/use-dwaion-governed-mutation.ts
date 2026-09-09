import { useCallback, useMemo } from 'react';
import {
  productSurfaceServerNow,
  useProductSurfaceAuthority,
  type ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';

import { useOptionalAllowedProductSurface } from './allowed-product-surface-context';
import {
  ProductSurfaceMutationAuthorityError,
  buildProductSurfaceMutationEvaluationRequest,
  resolveProductSurfaceMutationEntryBinding,
  secureProductSurfaceMutationAuthority,
} from './use-product-surface-governed-mutation';
import {
  DWAION_MUTATION_BINDINGS,
  type DwaionMutationRouteContractKey,
} from './dwaion-governed-mutation-bindings';

export type { DwaionMutationRouteContractKey } from './dwaion-governed-mutation-bindings';

/**
 * Resolves DWAI overlay commands against DWAI's own SELF authority. The assistant can be open
 * above another product page, so this cannot depend on that page's allowed-surface decision.
 * Gateway and Agent PEPs still re-evaluate the exact route and revision before execution.
 */
export function useDwaionGovernedMutation(routeContractKey: DwaionMutationRouteContractKey) {
  const authority = useProductSurfaceAuthority();
  const pageDecision = useOptionalAllowedProductSurface();
  const binding = DWAION_MUTATION_BINDINGS[routeContractKey];
  const rollout = authority.rolloutForProduct('dwaion');
  const rolloutState = rollout.state === 'ready' ? rollout.rollout.state : undefined;
  const selectedScopeKey =
    pageDecision?.context.productKey === binding.productKey &&
    pageDecision.context.surfaceKey === binding.surfaceKey
      ? pageDecision.scope.key
      : undefined;
  const entry = useMemo(
    () => resolveProductSurfaceMutationEntryBinding(authority.snapshot, binding, selectedScopeKey),
    [authority.snapshot, binding, selectedScopeKey]
  );

  return useCallback(
    async <T>(
      execute: (mutationAuthority: ProductSurfaceGovernedMutationAuthority) => Promise<T>
    ): Promise<T> => {
      if (rolloutState === '000' || rolloutState === '100') {
        return execute({ mode: 'LEGACY_COMPATIBILITY', rolloutState });
      }
      if (
        (rolloutState !== '110' && rolloutState !== '111') ||
        authority.status !== 'ready' ||
        !authority.snapshot ||
        !entry
      ) {
        throw new ProductSurfaceMutationAuthorityError();
      }
      const evaluation = await authority.evaluateProduct(
        buildProductSurfaceMutationEvaluationRequest(binding, entry)
      );
      const secure = secureProductSurfaceMutationAuthority(
        rolloutState,
        binding,
        entry,
        evaluation,
        productSurfaceServerNow(authority.snapshot)
      );
      if (!secure) throw new ProductSurfaceMutationAuthorityError();
      return execute(secure);
    },
    [authority, binding, entry, rolloutState]
  );
}
