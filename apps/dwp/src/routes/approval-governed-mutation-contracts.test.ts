import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  APPROVAL_GOVERNED_MUTATION_API_CONTRACTS,
  APPROVAL_HOME_PREFERENCE_MUTATION_API_CONTRACT,
} from '@dwp-frontend/shared-utils';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from './product-surface-authorization.generated';

describe('Approval governed mutation contract coverage', () => {
  it('maps every canonical Approval ACTION binding to exactly one frontend API wrapper', () => {
    const canonical = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
      (route) => route.productId === 'approvals' && route.routeKind === 'ACTION'
    ).flatMap((route) =>
      route.gatewayBindings.map((binding) => ({
        routeContractKey: route.routeContractKey,
        method: binding.method,
        path: binding.path,
      }))
    );
    const frontend = [
      ...APPROVAL_GOVERNED_MUTATION_API_CONTRACTS,
      APPROVAL_HOME_PREFERENCE_MUTATION_API_CONTRACT,
    ];
    const comparable = (
      values: readonly { routeContractKey: string; method: string; path: string }[]
    ) =>
      values
        .map(({ routeContractKey, method, path }) => ({ routeContractKey, method, path }))
        .sort((left, right) => left.routeContractKey.localeCompare(right.routeContractKey));

    expect(new Set(frontend.map((contract) => contract.apiFunction)).size).toBe(frontend.length);
    expect(new Set(frontend.map((contract) => contract.routeContractKey)).size).toBe(
      frontend.length
    );
    expect(comparable(frontend)).toEqual(comparable(canonical));
  });

  it('passes governed execution at every one of the 21 production API boundaries', () => {
    const contracts = [
      ...APPROVAL_GOVERNED_MUTATION_API_CONTRACTS,
      APPROVAL_HOME_PREFERENCE_MUTATION_API_CONTRACT,
    ];
    const expected = new Set<string>(contracts.map((contract) => contract.apiFunction));
    const found = new Map<string, string[]>();
    const featureRoot = path.resolve(process.cwd(), 'apps/dwp/src/features/approvals');

    for (const filename of fs.readdirSync(featureRoot).filter((name) => name.endsWith('.tsx'))) {
      const absolute = path.join(featureRoot, filename);
      const source = ts.createSourceFile(
        absolute,
        fs.readFileSync(absolute, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          expected.has(node.expression.text)
        ) {
          const lastArgument = node.arguments.at(-1)?.getText(source) ?? '';
          const values = found.get(node.expression.text) ?? [];
          values.push(lastArgument);
          found.set(node.expression.text, values);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }

    expect([...found.keys()].sort()).toEqual([...expected].sort());
    for (const [apiFunction, executionArguments] of found) {
      expect(executionArguments, apiFunction).not.toHaveLength(0);
      expect(
        executionArguments.every((argument) => argument === 'execution'),
        apiFunction
      ).toBe(true);
    }
  });

  it('mounts exactly one HIGH controller for each canonical HIGH operation', () => {
    const highRiskFiles = [
      'approval-workflow-studio.tsx',
      'approval-form-studio.tsx',
      'approval-policy-studio.tsx',
      'approval-admin.tsx',
    ].map((filename) =>
      fs.readFileSync(
        path.resolve(process.cwd(), 'apps/dwp/src/features/approvals', filename),
        'utf8'
      )
    );
    const operations = highRiskFiles.flatMap((source) =>
      [...source.matchAll(/useApprovalHighRiskCommand\(\{[\s\S]*?operation:\s*'([^']+)'/gu)].map(
        (match) => match[1]
      )
    );

    expect(operations.sort()).toEqual(
      ['DELIVERY_RETRY', 'FORM_PUBLISH', 'POLICY_PUBLISH', 'WORKFLOW_PUBLISH'].sort()
    );
  });

  it('keeps delivery retry bodyless and binds its version to the conditional HIGH header', () => {
    const openApi = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), 'libs/api-contracts/openapi/gateway-public.json'),
        'utf8'
      )
    ) as {
      paths: Record<
        string,
        {
          post?: {
            requestBody?: unknown;
            parameters?: Array<Record<string, unknown>>;
          };
        }
      >;
    };
    const operation =
      openApi.paths['/api/approvals/v1/admin/operations/events/{outboxId}/retry']?.post;
    const conditionalHeaders = operation?.parameters?.filter(
      (parameter) => parameter.in === 'header' && 'x-dwp-conditional-required' in parameter
    );

    expect(operation).toBeDefined();
    expect(operation).not.toHaveProperty('requestBody');
    expect(conditionalHeaders?.map((parameter) => parameter.name).sort()).toEqual(
      [
        'Idempotency-Key',
        'X-DWP-Expected-Decision-Revision',
        'X-DWP-Expected-Object-Version',
        'X-DWP-Step-Up-Challenge',
      ].sort()
    );
    for (const parameter of conditionalHeaders ?? []) {
      expect(parameter).toMatchObject({
        required: false,
        'x-dwp-conditional-required': {
          enforcement: 'FAIL_CLOSED',
          rolloutStates: ['110', '111'],
        },
      });
    }
  });
});
