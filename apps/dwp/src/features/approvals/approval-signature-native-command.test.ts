import { describe, expect, it } from 'vitest';
import {
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  type ProductAuthorizationRouteProjection,
} from '../../routes/product-surface-authorization.generated';
import { productSurfaceHighRiskOperationBinding } from '../../components/product-surface-high-risk-command-model';
import {
  approvalExternalSignatureHandoverCommand,
  approvalSignaturePolicyPublishCommand,
} from './approval-signature-command';
import {
  APPROVAL_SIGNATURE_NATIVE_ROUTES,
  approvalExternalSignatureReadRoutesInstalled,
  approvalSignatureNativeRouteInstalled,
} from './approval-signature-native-routes';
import type { ApprovalSignatureGatewayRouteStatus } from './approval-signature-gateway-contract';

const targetId = '11111111-1111-4111-8111-111111111111';
const draftId = '22222222-2222-4222-8222-222222222222';
const sha = 'a'.repeat(64);

describe('APR-16 signature native route and HIGH command bindings', () => {
  it.each(Object.keys(APPROVAL_SIGNATURE_NATIVE_ROUTES))(
    'requires official public availability and the exact Product Surface projection for %s',
    (leaf) => {
      const routeLeaf = leaf as keyof typeof APPROVAL_SIGNATURE_NATIVE_ROUTES;
      const [, method, path] = APPROVAL_SIGNATURE_NATIVE_ROUTES[routeLeaf];
      const official: readonly ApprovalSignatureGatewayRouteStatus[] = [
        { method, path, available: true },
      ];
      const unavailable: readonly ApprovalSignatureGatewayRouteStatus[] = [
        { method, path, available: false },
      ];
      expect(approvalSignatureNativeRouteInstalled(routeLeaf)).toBe(true);
      expect(
        approvalSignatureNativeRouteInstalled(
          routeLeaf,
          PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
          official
        )
      ).toBe(true);
      expect(
        approvalSignatureNativeRouteInstalled(
          routeLeaf,
          PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
          unavailable
        )
      ).toBe(false);
    }
  );

  it('fails closed on a missing, duplicate, or path-drifted projection', () => {
    const leaf = 'external-signature-context.data' as const;
    const routeKey = 'route.approvals.work.external-signature-context.data';
    const route = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.find(
      (candidate) => candidate.routeContractKey === routeKey
    )!;
    const without = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
      (candidate) => candidate.routeContractKey !== routeKey
    );
    const drifted: ProductAuthorizationRouteProjection = {
      ...route,
      gatewayBindings: [{ method: 'GET', path: '/api/approvals/v1/requests/{requestId}/wrong' }],
    };
    const official: readonly ApprovalSignatureGatewayRouteStatus[] = [
      {
        method: APPROVAL_SIGNATURE_NATIVE_ROUTES[leaf][1],
        path: APPROVAL_SIGNATURE_NATIVE_ROUTES[leaf][2],
        available: true,
      },
    ];
    expect(approvalSignatureNativeRouteInstalled(leaf, without, official)).toBe(false);
    expect(approvalSignatureNativeRouteInstalled(leaf, [...without, route, route], official)).toBe(
      false
    );
    expect(approvalSignatureNativeRouteInstalled(leaf, [...without, drifted], official)).toBe(
      false
    );
    expect(approvalExternalSignatureReadRoutesInstalled(without, official)).toBe(false);
  });

  it('builds the exact signature policy publish route, CAS and backend DTO', () => {
    const input = {
      expectedVersion: 5,
      expectedDraftVersionId: draftId,
      expectedSourceRevision: `sigp-${sha}`,
      expectedSourceSha256: sha,
      reviewContentSha256: sha,
      idempotencyKey: 'signature-policy:publish:1',
    };
    expect(approvalSignaturePolicyPublishCommand(targetId, input)).toEqual({
      operation: 'SIGNATURE_POLICY_PUBLISH',
      commandMethod: 'POST',
      commandPath: `/api/approvals/v1/admin/signatures/policies/${targetId}/publish`,
      targetType: 'SIGNATURE_POLICY',
      targetId,
      expectedObjectVersion: 5,
      idempotencyKey: input.idempotencyKey,
      idempotencyPayloadPath: 'ROOT',
      payload: input,
    });
    expect(productSurfaceHighRiskOperationBinding('SIGNATURE_POLICY_PUBLISH')).toEqual({
      routeContractKey: 'route.approvals.admin.signature-policy-publish.action',
      target: { productKey: 'approvals', surfaceKey: 'approvals.admin' },
    });
  });

  it('builds the exact external handover route, CAS and backend DTO', () => {
    const input = {
      expectedVersion: 7,
      expectedSourceRevision: `sigp-${sha}`,
      expectedSourceSha256: sha,
      idempotencyKey: 'external-signature:handover:1',
    };
    expect(approvalExternalSignatureHandoverCommand(targetId, input)).toEqual({
      operation: 'EXTERNAL_SIGNATURE_HANDOVER',
      commandMethod: 'POST',
      commandPath: `/api/approvals/v1/external-signature-requests/${targetId}/handovers`,
      targetType: 'EXTERNAL_SIGNATURE_REQUEST',
      targetId,
      expectedObjectVersion: 7,
      idempotencyKey: input.idempotencyKey,
      idempotencyPayloadPath: 'ROOT',
      payload: input,
    });
    expect(productSurfaceHighRiskOperationBinding('EXTERNAL_SIGNATURE_HANDOVER')).toEqual({
      routeContractKey: 'route.approvals.work.external-signature-handover.action',
      target: { productKey: 'approvals', surfaceKey: 'approvals.work' },
    });
  });
});
