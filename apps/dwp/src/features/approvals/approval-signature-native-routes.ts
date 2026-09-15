import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';
import {
  APPROVAL_SIGNATURE_OFFICIAL_GATEWAY_ROUTES,
  approvalSignatureOfficialGatewayRouteAvailable,
  type ApprovalSignatureGatewayRouteStatus,
} from './approval-signature-gateway-contract';

export const APPROVAL_SIGNATURE_NATIVE_ROUTES = {
  'signature-policy-initialize.action': [
    'approvals.admin',
    'POST',
    '/api/approvals/v1/admin/signatures/policies',
  ],
  'signature-policy-draft-update.action': [
    'approvals.admin',
    'PUT',
    '/api/approvals/v1/admin/signatures/policies/{policyId}/draft',
  ],
  'signature-policy-publish.action': [
    'approvals.admin',
    'POST',
    '/api/approvals/v1/admin/signatures/policies/{policyId}/publish',
  ],
  'signature-worm-inspection.action': [
    'approvals.admin',
    'POST',
    '/api/approvals/v1/admin/signatures/worm-inspections',
  ],
  'external-signature-context.data': [
    'approvals.work',
    'GET',
    '/api/approvals/v1/requests/{requestId}/external-signature-context',
  ],
  'external-signature-request-create.action': [
    'approvals.work',
    'POST',
    '/api/approvals/v1/requests/{requestId}/external-signature-requests',
  ],
  'external-signature-request.data': [
    'approvals.work',
    'GET',
    '/api/approvals/v1/external-signature-requests/{signatureRequestId}',
  ],
  'external-signature-handover.action': [
    'approvals.work',
    'POST',
    '/api/approvals/v1/external-signature-requests/{signatureRequestId}/handovers',
  ],
  'external-signature-refresh.action': [
    'approvals.work',
    'POST',
    '/api/approvals/v1/external-signature-requests/{signatureRequestId}/refresh',
  ],
  'external-signature-cancel.action': [
    'approvals.work',
    'POST',
    '/api/approvals/v1/external-signature-requests/{signatureRequestId}/cancel',
  ],
  'external-signature-audit.data': [
    'approvals.work',
    'GET',
    '/api/approvals/v1/external-signature-requests/{signatureRequestId}/audit',
  ],
  'external-signature-artifact.data': [
    'approvals.work',
    'GET',
    '/api/approvals/v1/external-signature-requests/{signatureRequestId}/artifacts/{artifactId}',
  ],
} as const;

export type ApprovalSignatureNativeRoute = keyof typeof APPROVAL_SIGNATURE_NATIVE_ROUTES;

export function approvalSignatureNativeRouteInstalled(
  leaf: ApprovalSignatureNativeRoute,
  projections: readonly ProductAuthorizationRouteProjection[] = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  officialRoutes: readonly ApprovalSignatureGatewayRouteStatus[] = APPROVAL_SIGNATURE_OFFICIAL_GATEWAY_ROUTES
): boolean {
  const [surfaceId, method, path] = APPROVAL_SIGNATURE_NATIVE_ROUTES[leaf];
  const matches = projections.filter(
    (route) => route.routeContractKey === `route.approvals.${surfaceId.split('.')[1]}.${leaf}`
  );
  return (
    approvalSignatureOfficialGatewayRouteAvailable(method, path, officialRoutes) &&
    matches.length === 1 &&
    matches[0]!.productId === 'approvals' &&
    matches[0]!.surfaceId === surfaceId &&
    matches[0]!.routeKind === (method === 'GET' ? 'DATA' : 'ACTION') &&
    matches[0]!.gatewayBindings.length === 1 &&
    matches[0]!.gatewayBindings[0]!.method === method &&
    matches[0]!.gatewayBindings[0]!.path === path
  );
}

export function approvalExternalSignatureReadRoutesInstalled(
  projections: readonly ProductAuthorizationRouteProjection[] = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  officialRoutes: readonly ApprovalSignatureGatewayRouteStatus[] = APPROVAL_SIGNATURE_OFFICIAL_GATEWAY_ROUTES
) {
  return (
    approvalSignatureNativeRouteInstalled(
      'external-signature-context.data',
      projections,
      officialRoutes
    ) &&
    approvalSignatureNativeRouteInstalled(
      'external-signature-request.data',
      projections,
      officialRoutes
    ) &&
    approvalSignatureNativeRouteInstalled(
      'external-signature-audit.data',
      projections,
      officialRoutes
    ) &&
    approvalSignatureNativeRouteInstalled(
      'external-signature-artifact.data',
      projections,
      officialRoutes
    )
  );
}
