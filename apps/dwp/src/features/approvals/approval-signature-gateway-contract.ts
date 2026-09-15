import type { paths as GatewayPublicPaths } from '@dwp-frontend/api-contracts';

export type ApprovalSignatureGatewayMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ApprovalSignatureGatewayRouteStatus = Readonly<{
  method: ApprovalSignatureGatewayMethod;
  path: string;
  available: boolean;
}>;

type GatewayOperationAvailable<
  Path extends string,
  Method extends ApprovalSignatureGatewayMethod,
> = Path extends keyof GatewayPublicPaths
  ? [GatewayPublicPaths[Path][Extract<Lowercase<Method>, keyof GatewayPublicPaths[Path]>]] extends [
      never | undefined,
    ]
    ? false
    : true
  : false;

function officialGatewayRoute<
  const Method extends ApprovalSignatureGatewayMethod,
  const Path extends string,
>(method: Method, path: Path, available: GatewayOperationAvailable<Path, Method>) {
  return Object.freeze({ method, path, available });
}

// Values are compile-time checked against the generated official Gateway paths.
// The adjacent contract test also verifies exact parity with the source OpenAPI JSON.
export const APPROVAL_SIGNATURE_OFFICIAL_GATEWAY_ROUTES = Object.freeze([
  officialGatewayRoute('GET', '/api/approvals/v1/admin/signatures', true),
  officialGatewayRoute('GET', '/api/approvals/v1/admin/signatures/diagnostics', true),
  officialGatewayRoute('GET', '/api/approvals/v1/admin/signatures/diagnostic-history', true),
  officialGatewayRoute('POST', '/api/approvals/v1/admin/signatures/kms/probes', true),
  officialGatewayRoute('GET', '/api/approvals/v1/admin/signatures/policy', true),
  officialGatewayRoute('POST', '/api/approvals/v1/admin/signatures/policies', true),
  officialGatewayRoute('PUT', '/api/approvals/v1/admin/signatures/policies/{policyId}/draft', true),
  officialGatewayRoute(
    'GET',
    '/api/approvals/v1/admin/signatures/policies/{policyId}/history',
    true
  ),
  officialGatewayRoute(
    'POST',
    '/api/approvals/v1/admin/signatures/policies/{policyId}/publish',
    true
  ),
  officialGatewayRoute('POST', '/api/approvals/v1/admin/signatures/probes', true),
  officialGatewayRoute(
    'GET',
    '/api/approvals/v1/admin/signatures/providers/{providerId}/diagnostics',
    true
  ),
  officialGatewayRoute('POST', '/api/approvals/v1/admin/signatures/worm-inspections', true),
  officialGatewayRoute(
    'GET',
    '/api/approvals/v1/external-signature-requests/{signatureRequestId}',
    true
  ),
  officialGatewayRoute(
    'GET',
    '/api/approvals/v1/external-signature-requests/{signatureRequestId}/artifacts/{artifactId}',
    true
  ),
  officialGatewayRoute(
    'GET',
    '/api/approvals/v1/external-signature-requests/{signatureRequestId}/audit',
    true
  ),
  officialGatewayRoute(
    'POST',
    '/api/approvals/v1/external-signature-requests/{signatureRequestId}/cancel',
    true
  ),
  officialGatewayRoute(
    'POST',
    '/api/approvals/v1/external-signature-requests/{signatureRequestId}/handovers',
    true
  ),
  officialGatewayRoute(
    'POST',
    '/api/approvals/v1/external-signature-requests/{signatureRequestId}/refresh',
    true
  ),
  officialGatewayRoute(
    'GET',
    '/api/approvals/v1/requests/{requestId}/external-signature-context',
    true
  ),
  officialGatewayRoute(
    'POST',
    '/api/approvals/v1/requests/{requestId}/external-signature-requests',
    true
  ),
  officialGatewayRoute('GET', '/api/approvals/v1/requests/{requestId}/signature-context', true),
  officialGatewayRoute('POST', '/api/approvals/v1/requests/{requestId}/signature-requests', true),
  officialGatewayRoute(
    'GET',
    '/api/approvals/v1/signature-command-receipts/{idempotencyKey}',
    true
  ),
  officialGatewayRoute('GET', '/api/approvals/v1/signature-requests/{signatureRequestId}', true),
  officialGatewayRoute(
    'GET',
    '/api/approvals/v1/signature-requests/{signatureRequestId}/audit',
    true
  ),
  officialGatewayRoute(
    'POST',
    '/api/approvals/v1/signature-requests/{signatureRequestId}/cancel',
    true
  ),
  officialGatewayRoute(
    'POST',
    '/api/approvals/v1/signature-requests/{signatureRequestId}/consents',
    true
  ),
  officialGatewayRoute(
    'POST',
    '/api/approvals/v1/signature-requests/{signatureRequestId}/sign',
    true
  ),
]);

export function approvalSignatureOfficialGatewayRouteAvailable(
  method: ApprovalSignatureGatewayMethod,
  path: string,
  routes: readonly ApprovalSignatureGatewayRouteStatus[] = APPROVAL_SIGNATURE_OFFICIAL_GATEWAY_ROUTES
): boolean {
  const matches = routes.filter(
    (route) => route.method === method && route.path === path && route.available
  );
  return matches.length === 1;
}
