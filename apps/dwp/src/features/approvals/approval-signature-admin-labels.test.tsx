import { describe, expect, it } from 'vitest';
import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';
import {
  APPROVAL_SIGNATURE_PROVIDER_ROUTES,
  approvalSignatureProviderReadModelInstalled,
  approvalSignatureProviderRouteInstalled,
} from './use-approval-signature-provider-diagnostics';
import type { ApprovalSignatureGatewayRouteStatus } from './approval-signature-gateway-contract';

type RouteLeaf = keyof typeof APPROVAL_SIGNATURE_PROVIDER_ROUTES;

function projection(
  leaf: RouteLeaf,
  patch: Partial<ProductAuthorizationRouteProjection> = {}
): ProductAuthorizationRouteProjection {
  const [method, path] = APPROVAL_SIGNATURE_PROVIDER_ROUTES[leaf];
  return {
    routeContractKey: `route.approvals.admin.${leaf}`,
    routeKind: method === 'GET' ? 'DATA' : 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [{ method, path }],
    ...patch,
  };
}

function official(...leaves: RouteLeaf[]): readonly ApprovalSignatureGatewayRouteStatus[] {
  return leaves.map((leaf) => {
    const [method, path] = APPROVAL_SIGNATURE_PROVIDER_ROUTES[leaf];
    return { method, path, available: true };
  });
}

function unavailable(...leaves: RouteLeaf[]): readonly ApprovalSignatureGatewayRouteStatus[] {
  return official(...leaves).map((route) => ({ ...route, available: false }));
}

describe('APR16B Source13 route installation boundary', () => {
  it.each(Object.keys(APPROVAL_SIGNATURE_PROVIDER_ROUTES) as RouteLeaf[])(
    'accepts %s only when the official route and exact projection are both present',
    (leaf) => {
      expect(approvalSignatureProviderRouteInstalled(leaf, [projection(leaf)])).toBe(true);
      expect(
        approvalSignatureProviderRouteInstalled(leaf, [projection(leaf)], official(leaf))
      ).toBe(true);
      expect(
        approvalSignatureProviderRouteInstalled(leaf, [projection(leaf)], unavailable(leaf))
      ).toBe(false);
    }
  );

  it('rejects duplicate, wrong-product, wrong-kind, wrong-method and wrong-path projections', () => {
    const leaf: RouteLeaf = 'signature-probe.action';
    const exact = projection(leaf);
    expect(approvalSignatureProviderRouteInstalled(leaf, [exact, exact], official(leaf))).toBe(
      false
    );
    expect(
      approvalSignatureProviderRouteInstalled(
        leaf,
        [projection(leaf, { productId: 'mail' })],
        official(leaf)
      )
    ).toBe(false);
    expect(
      approvalSignatureProviderRouteInstalled(
        leaf,
        [projection(leaf, { routeKind: 'DATA' })],
        official(leaf)
      )
    ).toBe(false);
    expect(
      approvalSignatureProviderRouteInstalled(
        leaf,
        [
          projection(leaf, {
            gatewayBindings: [
              {
                method: 'GET',
                path: APPROVAL_SIGNATURE_PROVIDER_ROUTES[leaf][1],
              },
            ],
          }),
        ],
        official(leaf)
      )
    ).toBe(false);
    expect(
      approvalSignatureProviderRouteInstalled(
        leaf,
        [
          projection(leaf, {
            gatewayBindings: [{ method: 'POST', path: '/api/approvals/v1/admin/signatures' }],
          }),
        ],
        official(leaf)
      )
    ).toBe(false);
  });

  it('does not infer a native route from a similarly named legacy projection', () => {
    expect(
      approvalSignatureProviderRouteInstalled(
        'signature-diagnostics.data',
        [
          projection('signature-diagnostics.data', {
            routeContractKey: 'route.approvals.admin.signature.data',
            gatewayBindings: [{ method: 'GET', path: '/api/approvals/v1/admin/signatures' }],
          }),
        ],
        official('signature-diagnostics.data')
      )
    ).toBe(false);
  });

  it('opens the production model only when every required read route is exact', () => {
    const readLeaves = (Object.keys(APPROVAL_SIGNATURE_PROVIDER_ROUTES) as RouteLeaf[]).filter(
      (leaf) => APPROVAL_SIGNATURE_PROVIDER_ROUTES[leaf][0] === 'GET'
    );
    const complete = readLeaves.map((leaf) => projection(leaf));
    const officialReads = official(...readLeaves);
    expect(approvalSignatureProviderReadModelInstalled(complete)).toBe(true);
    expect(approvalSignatureProviderReadModelInstalled(complete, officialReads)).toBe(true);
    expect(approvalSignatureProviderReadModelInstalled(complete, unavailable(...readLeaves))).toBe(
      false
    );
    for (const missing of readLeaves) {
      expect(
        approvalSignatureProviderReadModelInstalled(
          complete.filter((route) => route.routeContractKey !== `route.approvals.admin.${missing}`),
          officialReads
        )
      ).toBe(false);
    }
  });
});
