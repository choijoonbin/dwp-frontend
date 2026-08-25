import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  APPROVAL_GOVERNED_MUTATION_API_CONTRACTS,
  APPROVAL_HOME_PREFERENCE_MUTATION_API_CONTRACT,
  COMMUNICATIONS_MANAGEMENT_MUTATION_API_CONTRACTS,
  COMMUNICATIONS_WORK_MUTATION_API_CONTRACTS,
  HCM_HRIS_MUTATION_API_CONTRACTS,
  HCM_HOME_PREFERENCE_MUTATION_API_CONTRACT,
  HCM_HR_MUTATION_API_CONTRACTS,
  HCM_ORGANIZATION_MUTATION_API_CONTRACTS,
  HCM_WORKFORCE_EXPORT_MUTATION_API_CONTRACTS,
  HCM_WORKFORCE_REFERENCE_MUTATION_API_CONTRACT,
  SERVICES_MUTATION_API_CONTRACTS,
} from '@dwp-frontend/shared-utils';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from './product-surface-authorization.generated';

type ComparableContract = Readonly<{
  routeContractKey: string;
  method: string;
  path: string;
}>;

const IMPLEMENTED_ACTION_CONTRACTS = [
  ...APPROVAL_GOVERNED_MUTATION_API_CONTRACTS,
  APPROVAL_HOME_PREFERENCE_MUTATION_API_CONTRACT,
  ...COMMUNICATIONS_MANAGEMENT_MUTATION_API_CONTRACTS,
  ...COMMUNICATIONS_WORK_MUTATION_API_CONTRACTS,
  ...SERVICES_MUTATION_API_CONTRACTS,
  ...HCM_HR_MUTATION_API_CONTRACTS,
  ...HCM_ORGANIZATION_MUTATION_API_CONTRACTS,
  ...HCM_HRIS_MUTATION_API_CONTRACTS,
  ...HCM_WORKFORCE_EXPORT_MUTATION_API_CONTRACTS,
  HCM_WORKFORCE_REFERENCE_MUTATION_API_CONTRACT,
  HCM_HOME_PREFERENCE_MUTATION_API_CONTRACT,
] as const;

function comparable(values: readonly ComparableContract[]) {
  return values
    .map(({ routeContractKey, method, path }) => ({ routeContractKey, method, path }))
    .sort((left, right) =>
      `${left.routeContractKey}\u0000${left.method}\u0000${left.path}`.localeCompare(
        `${right.routeContractKey}\u0000${right.method}\u0000${right.path}`
      )
    );
}

describe('Generated product ACTION mutation closure', () => {
  it('maps every generated production ACTION binding with no missing or extra API boundary', () => {
    const canonical = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
      (route) =>
        route.routeKind === 'ACTION' &&
        route.subjectType === 'PRODUCT' &&
        ['approvals', 'communications', 'hcm', 'services'].includes(route.productId ?? '')
    ).flatMap((route) =>
      route.gatewayBindings.map((binding) => ({
        routeContractKey: route.routeContractKey,
        method: binding.method,
        path: binding.path,
      }))
    );

    expect(comparable(IMPLEMENTED_ACTION_CONTRACTS)).toEqual(comparable(canonical));
  });

  it('assigns each concrete gateway binding to exactly one frontend API function', () => {
    const bindingKeys = IMPLEMENTED_ACTION_CONTRACTS.map(
      ({ routeContractKey, method, path }) => `${routeContractKey}\u0000${method}\u0000${path}`
    );
    expect(new Set(bindingKeys).size).toBe(bindingKeys.length);
    expect(new Set(IMPLEMENTED_ACTION_CONTRACTS.map(({ apiFunction }) => apiFunction)).size).toBe(
      IMPLEMENTED_ACTION_CONTRACTS.length
    );
  });

  it('requires governed authority at every declared production API wrapper', () => {
    const expected = new Set(
      IMPLEMENTED_ACTION_CONTRACTS.map(({ apiFunction }) => apiFunction.split(':')[0])
    );
    const found = new Map<string, { parameters: string[]; body: string }>();
    const apiRoot = path.resolve(process.cwd(), 'libs/shared-utils/src/api');
    const files = [
      'approval-api.ts',
      'announcement-api.ts',
      'communication-api.ts',
      'service-center-api.ts',
      'hr-api.ts',
      'people-admin-api.ts',
      'hris-admin-api.ts',
      'workforce-export-api.ts',
      'workforce-api.ts',
      'home-preference-api.ts',
    ];

    for (const filename of files) {
      const absolute = path.join(apiRoot, filename);
      const source = ts.createSourceFile(
        absolute,
        fs.readFileSync(absolute, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isFunctionDeclaration(node) &&
          node.name &&
          expected.has(node.name.text) &&
          node.body
        ) {
          found.set(node.name.text, {
            parameters: node.parameters.map((parameter) => parameter.name.getText(source)),
            body: node.body.getText(source),
          });
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }

    expect([...found.keys()].sort()).toEqual([...expected].sort());
    for (const [apiFunction, declaration] of found) {
      expect(
        declaration.parameters.some((parameter) => ['authority', 'execution'].includes(parameter)),
        `${apiFunction} authority parameter`
      ).toBe(true);
      expect(declaration.body, `${apiFunction} governed request config`).toMatch(
        /(approval(?:HighRisk)?MutationExecutionConfig|productSurface(?:Governed|HighRisk)MutationConfig|updateApprovalHomeSurfacePreference)\(/u
      );
    }

    const snapshot = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), 'architecture/product-surface-authorization.v1.json'),
        'utf8'
      )
    ) as {
      bundles: Array<{
        routes: Array<{
          routeContractKey: string;
          gatewayApiBindings?: Array<{ bindingKey: string; method: string; path: string }>;
          stepUpCommandBindings?: Array<{
            bindingKey: string;
            expectedObjectVersionSource: 'COMMAND_BODY' | 'COMMAND_HEADER';
          }>;
        }>;
      }>;
    };
    const highRiskBindings = (snapshot.bundles.at(-1)?.routes ?? []).flatMap((route) =>
      (route.stepUpCommandBindings ?? []).map((stepUp) => {
        const gateway = (route.gatewayApiBindings ?? []).find(
          (binding) => binding.bindingKey === stepUp.bindingKey
        );
        if (!gateway) throw new Error(`Missing HIGH gateway binding: ${stepUp.bindingKey}`);
        const contract = IMPLEMENTED_ACTION_CONTRACTS.find(
          (candidate) =>
            candidate.routeContractKey === route.routeContractKey &&
            candidate.method === gateway.method &&
            candidate.path === gateway.path
        );
        if (!contract) throw new Error(`Missing HIGH frontend binding: ${stepUp.bindingKey}`);
        return {
          apiFunction: contract.apiFunction.split(':')[0],
          objectVersionHeader: stepUp.expectedObjectVersionSource === 'COMMAND_HEADER',
        };
      })
    );

    expect(highRiskBindings).toHaveLength(11);
    for (const binding of highRiskBindings) {
      const body = found.get(binding.apiFunction)?.body ?? '';
      expect(body, `${binding.apiFunction} strict HIGH config`).toMatch(
        /(approvalHighRiskMutationExecutionConfig|productSurfaceHighRiskMutationConfig)\(/u
      );
      expect(body, `${binding.apiFunction} version binding`).toContain(
        `objectVersionHeader: ${binding.objectVersionHeader}`
      );
    }
  });
});
