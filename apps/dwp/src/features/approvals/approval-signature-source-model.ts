import { APPROVAL_SIGNATURE_BINDINGS } from '@dwp-frontend/shared-utils/api/approval-signature-contract';
import type {
  ApprovalSignatureCeremony,
  ApprovalSignatureContext,
} from '@dwp-frontend/shared-utils/api/approval-signature-contract';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';

export type ApprovalSignatureLeaf = keyof typeof APPROVAL_SIGNATURE_BINDINGS;
export type ApprovalSignatureDocument = ApprovalSignatureContext | ApprovalSignatureCeremony;

export function approvalSignatureRouteInstalled(
  leaf: ApprovalSignatureLeaf,
  projections: readonly ProductAuthorizationRouteProjection[] = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS
) {
  const [method, path] = APPROVAL_SIGNATURE_BINDINGS[leaf];
  const matches = projections.filter(
    (route) => route.routeContractKey === `route.approvals.work.${leaf}`
  );
  return (
    matches.length === 1 &&
    matches[0]!.productId === 'approvals' &&
    matches[0]!.surfaceId === 'approvals.work' &&
    matches[0]!.routeKind === (method === 'GET' ? 'DATA' : 'ACTION') &&
    matches[0]!.gatewayBindings.length === 1 &&
    matches[0]!.gatewayBindings[0]!.method === method &&
    matches[0]!.gatewayBindings[0]!.path === path
  );
}

export function approvalSignatureDocumentFingerprint(document: ApprovalSignatureDocument) {
  return JSON.stringify({
    source: document.source,
    sourceDigest: document.sourceDigest,
    terms: document.terms,
    ...('signatureRequestId' in document
      ? {
          signatureRequestId: document.signatureRequestId,
          version: document.version,
          state: document.state,
          consentReceiptId: document.consentReceiptId,
          expiresAt: document.expiresAt,
        }
      : { signingReadiness: document.signingReadiness }),
  });
}

export function approvalSignatureDocumentCurrent(
  document: ApprovalSignatureDocument,
  context: ApprovalSignatureContext,
  requestId: string,
  requestVersion: number,
  actorId: string,
  nowMs: number
) {
  const termsExpiry = Date.parse(document.terms.expiresAt);
  const ceremonyExpiry = 'expiresAt' in document ? Date.parse(document.expiresAt) : termsExpiry;
  return (
    document.source.requestId === requestId &&
    document.source.requestVersion === requestVersion &&
    String(document.source.ownerUserId) === actorId &&
    document.sourceDigest === context.sourceDigest &&
    JSON.stringify(document.source) === JSON.stringify(context.source) &&
    JSON.stringify(document.terms) === JSON.stringify(context.terms) &&
    Number.isFinite(termsExpiry) &&
    termsExpiry > nowMs &&
    Number.isFinite(ceremonyExpiry) &&
    ceremonyExpiry > nowMs
  );
}
