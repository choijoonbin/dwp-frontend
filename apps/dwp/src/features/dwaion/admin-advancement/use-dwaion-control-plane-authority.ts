import { useCallback, useMemo } from 'react';
import {
  productSurfaceServerNow,
  useProductSurfaceAuthority,
  type ProductSurfaceSecureMutationAuthority,
} from '@dwp-frontend/shared-utils';

import { useOptionalAllowedProductSurface } from '../../../components/allowed-product-surface-context';
import {
  ProductSurfaceMutationAuthorityError,
  buildProductSurfaceMutationEvaluationRequest,
  resolveProductSurfaceMutationEntryBinding,
  secureProductSurfaceMutationAuthority,
} from '../../../components/use-product-surface-governed-mutation';

const BINDING = {
  productKey: 'dwaion',
  surfaceKey: 'dwaion.management',
  routeContractKey: 'route.dwaion.management.control-plane-command.action',
  taskKind: 'ADMINISTRATION',
} as const;

export function useDwaionControlPlaneAuthority() {
  const authority = useProductSurfaceAuthority();
  const pageDecision = useOptionalAllowedProductSurface();
  const rollout = authority.rolloutForProduct('dwaion');
  const rolloutState = rollout.state === 'ready' ? rollout.rollout.state : undefined;
  const selectedScopeKey =
    pageDecision?.context.productKey === BINDING.productKey &&
    pageDecision.context.surfaceKey === BINDING.surfaceKey
      ? pageDecision.scope.key
      : undefined;
  const entry = useMemo(
    () => resolveProductSurfaceMutationEntryBinding(authority.snapshot, BINDING, selectedScopeKey),
    [authority.snapshot, selectedScopeKey]
  );
  const available =
    (rolloutState === '110' || rolloutState === '111') &&
    authority.status === 'ready' &&
    Boolean(authority.snapshot && entry);

  const execute = useCallback(
    async <T>(run: (secure: ProductSurfaceSecureMutationAuthority) => Promise<T>): Promise<T> => {
      if (
        (rolloutState !== '110' && rolloutState !== '111') ||
        authority.status !== 'ready' ||
        !authority.snapshot ||
        !entry
      ) {
        throw new ProductSurfaceMutationAuthorityError();
      }
      const evaluation = await authority.evaluateProduct(
        buildProductSurfaceMutationEvaluationRequest(BINDING, entry)
      );
      const secure = secureProductSurfaceMutationAuthority(
        rolloutState,
        BINDING,
        entry,
        evaluation,
        productSurfaceServerNow(authority.snapshot)
      );
      if (!secure) throw new ProductSurfaceMutationAuthorityError();
      return run(secure);
    },
    [authority, entry, rolloutState]
  );

  return {
    available,
    loading: authority.status === 'loading',
    execute,
  };
}
