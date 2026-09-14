import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  APPROVAL_GOVERNED_MUTATION_API_CONTRACTS,
  APPROVAL_HOME_PREFERENCE_MUTATION_API_CONTRACT,
} from '@dwp-frontend/shared-utils';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from './product-surface-authorization.generated';
import { PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG } from '../components/product-surface-high-risk-command-catalog';

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

  it('passes governed execution at every production API boundary, including draft hooks', () => {
    const contracts = [
      ...APPROVAL_GOVERNED_MUTATION_API_CONTRACTS,
      APPROVAL_HOME_PREFERENCE_MUTATION_API_CONTRACT,
    ];
    const expected = new Set<string>(contracts.map((contract) => contract.apiFunction));
    const executionParameters = new Map<string, number>();
    const apiRoot = path.resolve(process.cwd(), 'libs/shared-utils/src/api');
    for (const filename of fs
      .readdirSync(apiRoot)
      .filter(
        (name) =>
          /^(?:approval.*|home-preference-api)\.ts$/u.test(name) && !/\.test\.ts$/u.test(name)
      )) {
      const source = ts.createSourceFile(
        filename,
        fs.readFileSync(path.join(apiRoot, filename), 'utf8'),
        ts.ScriptTarget.Latest,
        true
      );
      for (const node of source.statements) {
        if (
          !ts.isFunctionDeclaration(node) ||
          !node.body ||
          !node.name ||
          !expected.has(node.name.text)
        )
          continue;
        const index = node.parameters.findIndex(
          (parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === 'execution'
        );
        expect(index, node.name.text).toBeGreaterThanOrEqual(0);
        expect(executionParameters.has(node.name.text), node.name.text).toBe(false);
        executionParameters.set(node.name.text, index);
      }
    }
    expect([...executionParameters.keys()].sort()).toEqual([...expected].sort());
    const found = new Map<string, string[]>();
    const featureRoot = path.resolve(process.cwd(), 'apps/dwp/src/features/approvals');

    for (const filename of fs
      .readdirSync(featureRoot)
      .filter((name) => /\.tsx?$/u.test(name) && !/\.test\.tsx?$/u.test(name))) {
      const absolute = path.join(featureRoot, filename);
      const source = ts.createSourceFile(
        absolute,
        fs.readFileSync(absolute, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          expected.has(node.expression.text)
        ) {
          const executionIndex = executionParameters.get(node.expression.text)!;
          const executionArgument = node.arguments[executionIndex]?.getText(source) ?? '';
          const values = found.get(node.expression.text) ?? [];
          values.push(executionArgument);
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
    const catalog = PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG.filter(
      (entry) => entry.productKey === 'approvals'
    );
    const snapshot = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), 'architecture/product-surface-authorization.v1.json'),
        'utf8'
      )
    ) as {
      latestAlias: { bundleKey: string; version: number };
      bundles: Array<{
        bundleKey: string;
        version: number;
        routes: Array<{
          routeContractKey: string;
          subject: { productKey?: string };
          stepUpCommandBindings?: unknown[];
        }>;
      }>;
    };
    const latest = snapshot.bundles.filter(
      (bundle) =>
        bundle.bundleKey === snapshot.latestAlias.bundleKey &&
        bundle.version === snapshot.latestAlias.version
    );
    expect(latest).toHaveLength(1);
    const canonical = latest[0]!.routes.filter(
      (route) => route.subject.productKey === 'approvals' && route.stepUpCommandBindings?.length
    );
    expect(catalog).toHaveLength(11);
    expect(catalog.map((entry) => entry.routeContractKey).sort()).toEqual(
      canonical.map((route) => route.routeContractKey).sort()
    );

    const featureRoot = path.resolve(process.cwd(), 'apps/dwp/src/features/approvals');
    const operations: string[] = [];
    for (const filename of fs
      .readdirSync(featureRoot)
      .filter((name) => /\.tsx?$/u.test(name) && !/\.test\.tsx?$/u.test(name))) {
      const source = ts.createSourceFile(
        filename,
        fs.readFileSync(path.join(featureRoot, filename), 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ['useApprovalHighRiskCommand', 'useApprovalManagementHighRiskCommand'].includes(
            node.expression.text
          )
        ) {
          const input = node.arguments[0];
          expect(input && ts.isObjectLiteralExpression(input), filename).toBe(true);
          if (input && ts.isObjectLiteralExpression(input)) {
            const operation = input.properties.find(
              (property) =>
                ts.isPropertyAssignment(property) &&
                ts.isIdentifier(property.name) &&
                property.name.text === 'operation'
            );
            if (operation && ts.isPropertyAssignment(operation)) {
              expect(ts.isStringLiteral(operation.initializer), filename).toBe(true);
              if (ts.isStringLiteral(operation.initializer))
                operations.push(operation.initializer.text);
            } else {
              // The management adapter forwards the caller's operation, not a new mount.
              expect(filename).toBe('approval-management-command-scope.ts');
              expect(
                input.properties.some(
                  (property) =>
                    ts.isShorthandPropertyAssignment(property) && property.name.text === 'operation'
                )
              ).toBe(true);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(new Set(operations).size).toBe(operations.length);
    expect(operations.sort()).toEqual(catalog.map((entry) => entry.operation).sort());
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
