import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APPROVAL_SIGNATURE_BINDINGS } from '@dwp-frontend/shared-utils/api/approval-signature-contract';
import {
  APPROVAL_SIGNATURE_OFFICIAL_GATEWAY_ROUTES,
  approvalSignatureOfficialGatewayRouteAvailable,
} from './approval-signature-gateway-contract';
import { APPROVAL_SIGNATURE_NATIVE_ROUTES } from './approval-signature-native-routes';
import { APPROVAL_SIGNATURE_PROVIDER_ROUTES } from './use-approval-signature-provider-diagnostics';

type OpenApiDocument = Readonly<{
  paths: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}>;

const bindingKey = (method: string, routePath: string) => `${method} ${routePath}`;
const official = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), 'libs/api-contracts/openapi/gateway-public.json'),
    'utf8'
  )
) as OpenApiDocument;

describe('APR-16B official Gateway route availability', () => {
  it('matches the official OpenAPI instead of inferring availability from authorization', () => {
    const actual = Object.entries(official.paths)
      .flatMap(([routePath, operations]) =>
        Object.keys(operations)
          .filter((method) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
          .map((method) => bindingKey(method.toUpperCase(), routePath))
      )
      .filter((binding) => binding.includes('signature'))
      .sort();
    const declaredAvailable = APPROVAL_SIGNATURE_OFFICIAL_GATEWAY_ROUTES.filter(
      (route) => route.available
    )
      .map((route) => bindingKey(route.method, route.path))
      .sort();

    expect(declaredAvailable).toEqual(actual);
    expect(declaredAvailable).toHaveLength(28);
  });

  it('covers every Approval signature UI binding and fails closed on absent routes', () => {
    const expected = new Set([
      bindingKey('GET', '/api/approvals/v1/admin/signatures'),
      ...Object.values(APPROVAL_SIGNATURE_BINDINGS).map(([method, routePath]) =>
        bindingKey(method, routePath)
      ),
      ...Object.values(APPROVAL_SIGNATURE_NATIVE_ROUTES).map(([, method, routePath]) =>
        bindingKey(method, routePath)
      ),
      ...Object.values(APPROVAL_SIGNATURE_PROVIDER_ROUTES).map(([method, routePath]) =>
        bindingKey(method, routePath)
      ),
    ]);
    const declared = APPROVAL_SIGNATURE_OFFICIAL_GATEWAY_ROUTES.map((route) =>
      bindingKey(route.method, route.path)
    );

    expect(new Set(declared)).toEqual(expected);
    expect(declared).toHaveLength(expected.size);
    expect(
      approvalSignatureOfficialGatewayRouteAvailable(
        'GET',
        '/api/approvals/v1/requests/{requestId}/signature-context'
      )
    ).toBe(true);
    expect(
      approvalSignatureOfficialGatewayRouteAvailable('GET', '/api/approvals/v1/admin/signatures')
    ).toBe(true);
    expect(APPROVAL_SIGNATURE_OFFICIAL_GATEWAY_ROUTES.every((route) => route.available)).toBe(true);
  });
});
