export type ProductAuthorizationRouteProjectionSource = Readonly<{
  routeContractKey: string;
  routeKind: 'PAGE' | 'DATA' | 'ACTION';
  subjectType: 'PRODUCT' | 'GOVERNED_CONTEXT';
  productId: string | null;
  surfaceId: string | null;
}>;

export type ProductAuthorizationProjectionScope = Readonly<{
  productIds: readonly string[];
  includeGovernedContextRoutes: boolean;
}>;

function assertUniqueProductIds(productIds: readonly string[]): Set<string> {
  const selected = new Set<string>();
  for (const productId of productIds) {
    if (!/^[a-z][a-z0-9-]*$/u.test(productId) || selected.has(productId)) {
      throw new Error(`Product authorization projection has an invalid product id: ${productId}`);
    }
    selected.add(productId);
  }
  return selected;
}

/** Selects the exact authorization registry slice that an independent browser app may carry. */
export function projectProductAuthorizationRoutes<
  Projection extends ProductAuthorizationRouteProjectionSource,
>(
  projections: readonly Projection[],
  scope: ProductAuthorizationProjectionScope
): readonly Projection[] {
  const selectedProductIds = assertUniqueProductIds(scope.productIds);

  return projections.filter((projection) => {
    if (projection.subjectType === 'GOVERNED_CONTEXT') {
      if (projection.productId !== null || projection.surfaceId !== null) {
        throw new Error(
          `Governed-context authorization route has a product identity: ${projection.routeContractKey}`
        );
      }
      return scope.includeGovernedContextRoutes;
    }

    if (
      !projection.productId ||
      !projection.surfaceId?.startsWith(`${projection.productId}.`) ||
      !projection.routeContractKey.startsWith(`route.${projection.productId}.`)
    ) {
      throw new Error(
        `Product authorization route has an invalid product identity: ${projection.routeContractKey}`
      );
    }
    return selectedProductIds.has(projection.productId);
  });
}

const ROUTE_CONTRACT_KEY_PATTERN =
  /\broute\.[a-z0-9][a-z0-9._-]*(?:\.[a-z0-9][a-z0-9._-]*)+\.(?:page|data|action)\b/gu;

export type ProductArtifactRouteClosure = Readonly<{
  productIds: readonly string[];
  exactRouteContractKeys: readonly string[];
}>;

/**
 * Returns route keys that escaped the application projection. Administration can explicitly carry
 * only its declared legacy target PAGE keys; Workspace can explicitly add governed-context keys.
 */
export function findForeignProductRouteContractKeys(
  source: string,
  closure: ProductArtifactRouteClosure
): readonly string[] {
  const productIds = assertUniqueProductIds(closure.productIds);
  const exactKeys = new Set(closure.exactRouteContractKeys);
  const violations = new Set<string>();

  for (const match of source.matchAll(ROUTE_CONTRACT_KEY_PATTERN)) {
    const routeContractKey = match[0];
    if (exactKeys.has(routeContractKey)) continue;
    const productId = routeContractKey.split('.')[1];
    if (productId && productIds.has(productId)) continue;
    violations.add(routeContractKey);
  }
  return [...violations].sort();
}
