import { describe, expect, it } from 'vitest';
import {
  approvalSignatureContextFixture,
  approvalSignatureCeremonyFixture,
} from '../../../../../e2e/support/approval-signature-fixtures';
import {
  approvalSignatureDocumentCurrent,
  approvalSignatureDocumentFingerprint,
  approvalSignatureRouteInstalled,
} from './approval-signature-source-model';
import { APPROVAL_SIGNATURE_BINDINGS } from '@dwp-frontend/shared-utils/api/approval-signature-contract';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import type { ApprovalSignatureGatewayRouteStatus } from './approval-signature-gateway-contract';

describe('signature source10 UI selection (not live Auth activation)', () => {
  it('requires official public availability plus one exact work projection', () => {
    for (const leaf of Object.keys(APPROVAL_SIGNATURE_BINDINGS) as Array<
      keyof typeof APPROVAL_SIGNATURE_BINDINGS
    >) {
      const [method, path] = APPROVAL_SIGNATURE_BINDINGS[leaf];
      const official: readonly ApprovalSignatureGatewayRouteStatus[] = [
        { method, path, available: true },
      ];
      const unavailable: readonly ApprovalSignatureGatewayRouteStatus[] = [
        { method, path, available: false },
      ];
      expect(approvalSignatureRouteInstalled(leaf)).toBe(true);
      expect(
        approvalSignatureRouteInstalled(leaf, PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS, official)
      ).toBe(true);
      expect(
        approvalSignatureRouteInstalled(leaf, PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS, unavailable)
      ).toBe(false);
      expect(approvalSignatureRouteInstalled(leaf, [])).toBe(false);
      const route = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.find(
        (value) => value.routeContractKey === `route.approvals.work.${leaf}`
      )!;
      expect(approvalSignatureRouteInstalled(leaf, [route, route], official)).toBe(false);
      expect(
        approvalSignatureRouteInstalled(
          leaf,
          [{ ...route, surfaceId: 'approvals.admin' }],
          official
        )
      ).toBe(false);
    }
  });
  it('requires exact requester, request version, policy/manifest/form/workflow source and both expiries', () => {
    const context = approvalSignatureContextFixture(),
      document = approvalSignatureCeremonyFixture(context);
    const valid = (candidate = document, version = 3, actor = '1', now = Date.now()) =>
      approvalSignatureDocumentCurrent(
        candidate,
        context,
        context.source.requestId,
        version,
        actor,
        now
      );
    expect(valid()).toBe(true);
    expect(valid(document, 4)).toBe(false);
    expect(valid(document, 3, '2')).toBe(false);
    for (const key of [
      'manifestSha256',
      'formSchemaSha256',
      'workflowSha256',
      'providerSha256',
      'documentPolicySha256',
      'attachmentPolicySha256',
    ] as const)
      expect(valid({ ...document, source: { ...document.source, [key]: '0'.repeat(64) } })).toBe(
        false
      );
    expect(valid({ ...document, expiresAt: 'invalid' })).toBe(false);
    expect(valid(document, 3, '1', Date.parse(document.expiresAt))).toBe(false);
  });
  it('excludes context evaluation timestamp, but does not heal source, consent, state or CAS', () => {
    const context = approvalSignatureContextFixture(),
      document = approvalSignatureCeremonyFixture(context);
    expect(
      approvalSignatureDocumentFingerprint({ ...context, evaluatedAt: '2030-01-01T00:00:00Z' })
    ).toBe(approvalSignatureDocumentFingerprint(context));
    for (const patch of [
      { version: 1 },
      { state: 'CANCELLED' as const },
      { consentReceiptId: context.source.requestId },
      { sourceDigest: '0'.repeat(64) },
    ])
      expect(approvalSignatureDocumentFingerprint({ ...document, ...patch })).not.toBe(
        approvalSignatureDocumentFingerprint(document)
      );
  });
});
