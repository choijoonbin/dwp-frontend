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

const APPROVAL_EXECUTION_CHAINS: Readonly<Record<string, readonly string[]>> = {
  createApprovalRequest: ['approvalRequestExecutionConfig'],
  updateApprovalDraft: ['approvalRequestExecutionConfig'],
  submitApprovalRequest: ['approvalRequestExecutionConfig'],
  respondToApprovalInformationRequest: ['approvalRequestExecutionConfig'],
  recoverApprovalDraft: ['draftCommand'],
  deleteApprovalDraft: ['draftCommand'],
  restoreApprovalDraft: ['draftCommand'],
  appendApprovalRequestComment: ['appendApprovalDocumentComment', 'command', 'executionConfig'],
  appendApprovalTaskComment: ['appendApprovalDocumentComment', 'command', 'executionConfig'],
  exportApprovalRequestDocument: ['exportApprovalDocument', 'command', 'executionConfig'],
  exportApprovalTaskDocument: ['exportApprovalDocument', 'command', 'executionConfig'],
  exportApprovalArchive: ['command', 'executionConfig'],
  saveApprovalDocumentPolicy: ['command', 'executionConfig'],
  publishApprovalDocumentPolicy: ['command', 'executionConfig'],
  proposeApprovalDocumentHold: ['command', 'executionConfig'],
  publishApprovalDocumentHold: ['command', 'executionConfig'],
  reserveApprovalAttachmentUpload: ['command', 'config'],
  uploadApprovalAttachmentContent: ['config'],
  reconcileApprovalAttachmentUpload: ['command', 'config'],
  cancelApprovalAttachmentUpload: ['command', 'config'],
  selectApprovalAttachments: ['command', 'config'],
  createApprovalRequestAttachmentDownloadGrant: [
    'createApprovalAttachmentDownloadGrant',
    'command',
    'config',
  ],
  createApprovalTaskAttachmentDownloadGrant: [
    'createApprovalAttachmentDownloadGrant',
    'command',
    'config',
  ],
  branchApprovalFormWorkspaceVersion: ['command'],
  updateApprovalFormWorkingDraft: ['command'],
  retireApprovalFormWorkspace: ['command'],
  reinstateApprovalFormWorkspace: ['command'],
  publishReviewedApprovalFormWorkspace: ['command'],
  saveApprovalAttachmentPolicyDraft: ['settings'],
  publishApprovalAttachmentPolicy: ['settings'],
  requestApprovalFormPublishReview: ['reviewCommand'],
  rejectApprovalFormPublishReview: ['reviewCommand'],
  initializeApprovalRetentionPolicy: ['command'],
  saveApprovalRetentionPolicy: ['command'],
  publishApprovalRetentionPolicy: ['command'],
  createApprovalRetentionClaim: ['command'],
  createApprovalSignatureRequest: ['command'],
  consentApprovalSignatureRequest: ['command'],
  signApprovalSignatureRequest: ['command'],
  cancelApprovalSignatureRequest: ['command'],
  deadLetterApprovalEvent: ['post'],
  replayApprovalEvent: ['post'],
  runApprovalDeliveryBatch: ['post'],
  reassignApprovalTask: ['post'],
  reassignApprovalTasks: ['post'],
  createApprovalExternalSignatureRequest: ['commandConfig'],
  handoverApprovalExternalSignatureRequest: ['command', 'commandConfig'],
  refreshApprovalExternalSignatureRequest: ['command', 'commandConfig'],
  cancelApprovalExternalSignatureRequest: ['command', 'commandConfig'],
  initializeApprovalSignaturePolicy: ['commandConfig'],
  saveApprovalSignaturePolicyDraft: ['commandConfig'],
  publishApprovalSignaturePolicy: ['commandConfig'],
  inspectApprovalSignatureWorm: ['commandConfig'],
};

// Shared transports must forward the same authority at every AST call edge.
function approvalExecutionBody(source: ts.SourceFile, apiFunction: string) {
  const declarations = new Map(
    source.statements
      .filter(ts.isFunctionDeclaration)
      .filter((node) => node.name && node.body)
      .map((node) => [node.name!.text, node])
  );
  const chain = APPROVAL_EXECUTION_CHAINS[apiFunction];
  if (!chain) throw new Error(`Unregistered approval execution chain: ${apiFunction}`);
  const highRisk = [
    'publishApprovalDocumentPolicy',
    'publishApprovalDocumentHold',
    'publishReviewedApprovalFormWorkspace',
    'publishApprovalAttachmentPolicy',
  ].includes(apiFunction);
  const bodies: string[] = [];
  let current = declarations.get(apiFunction);
  for (const calleeName of chain) {
    if (!current?.body) throw new Error(`Missing approval wrapper: ${apiFunction}`);
    bodies.push(current.body.getText(source));
    const calls: ts.CallExpression[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === calleeName
      )
        calls.push(node);
      ts.forEachChild(node, visit);
    };
    visit(current.body);
    expect(calls, `${current.name?.text} -> ${calleeName}`).toHaveLength(1);
    const callee = declarations.get(calleeName);
    const executionIndex = callee?.parameters.findIndex(
      (parameter) => parameter.name.getText(source) === 'execution'
    );
    expect(executionIndex, `${calleeName} authority parameter`).toBeGreaterThanOrEqual(0);
    expect(calls[0]?.arguments[executionIndex!]?.getText(source)).toBe('execution');
    if (calleeName === 'command' && source.fileName.endsWith('approval-document-api.ts')) {
      expect(calls[0]?.arguments[3]?.getText(source) ?? 'false').toBe(String(highRisk));
      expect(callee?.parameters[3]?.initializer?.getText(source)).toBe('false');
    }
    if (calleeName === 'command' && source.fileName.endsWith('approval-form-workspace-api.ts')) {
      expect(calls[0]?.arguments[5]?.getText(source) ?? 'false').toBe(String(highRisk));
      expect(callee?.parameters[5]?.initializer?.getText(source)).toBe('false');
    }
    if (calleeName === 'settings' && source.fileName.endsWith('approval-attachment-policy-api.ts'))
      expect(calls[0]?.arguments[3]?.getText(source)).toBe(String(highRisk));
    if (calleeName === 'command' && source.fileName.endsWith('approval-retention-api.ts')) {
      const high = ['publishApprovalRetentionPolicy', 'createApprovalRetentionClaim'].includes(
        apiFunction
      );
      const options = calls[0]?.arguments[3];
      const highProperty =
        options && ts.isObjectLiteralExpression(options)
          ? options.properties.find(
              (property) =>
                ts.isPropertyAssignment(property) && property.name.getText(source) === 'high'
            )
          : undefined;
      expect(
        highProperty && ts.isPropertyAssignment(highProperty)
          ? highProperty.initializer.getText(source)
          : 'false'
      ).toBe(String(high));
      expect(current.body.getText(source)).toContain('Object.freeze(');
      expect(callee?.body?.getText(source)).toContain("csrfReplay: 'NEVER'");
      expect(callee?.body?.getText(source)).toContain('objectVersionHeader: true');
    }
    if (calleeName === 'command' && source.fileName.endsWith('approval-signature-api.ts')) {
      const operation = {
        createApprovalSignatureRequest: 'CREATE',
        consentApprovalSignatureRequest: 'CONSENT',
        signApprovalSignatureRequest: 'SIGN',
        cancelApprovalSignatureRequest: 'CANCEL',
      }[apiFunction];
      expect(calls[0]?.arguments[0]?.getText(source)).toBe(`'${operation}'`);
      expect(callee?.body?.getText(source)).toContain("operation === 'SIGN'");
      expect(callee?.body?.getText(source)).toContain('objectVersionHeader: false');
      expect(callee?.body?.getText(source)).toContain("csrfReplay: 'NEVER'");
      expect(callee?.body?.getText(source)).toContain('Object.freeze({');
    }
    if (calleeName === 'executionConfig')
      expect(calls[0]?.arguments[2]?.getText(source)).toBe('publish');
    if (calleeName === 'draftCommand') {
      const action = {
        recoverApprovalDraft: 'recover',
        deleteApprovalDraft: 'delete',
        restoreApprovalDraft: 'restore',
      }[apiFunction];
      expect(calls[0]?.arguments[1]?.getText(source)).toBe(`'${action}'`);
    }
    current = callee;
  }
  if (!current?.body) throw new Error('Missing approval authority configuration');
  bodies.push(current.body.getText(source));
  if (chain.at(-1) === 'executionConfig')
    expect(current.body.getText(source)).toContain(
      "if (publish && execution.mode !== 'SECURE') invalid();"
    );
  return bodies.join('\n');
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
      'approval-document-api.ts',
      'approval-draft-api.ts',
      'approval-form-workspace-api.ts',
      'approval-attachment-api.ts',
      'approval-attachment-policy-api.ts',
      'approval-attachment-policy-initialize-api.ts',
      'approval-retention-api.ts',
      'approval-signature-api.ts',
      'approval-native-operations-api.ts',
      'approval-external-signature-api.ts',
      'approval-signature-policy-api.ts',
      'approval-signature-provider-api.ts',
      'approval-delegation-api.ts',
      'approval-resubmit-draft-api.ts',
      'approval-policy-create-api.ts',
      'approval-draft-migration-api.ts',
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
            body: Object.hasOwn(APPROVAL_EXECUTION_CHAINS, node.name.text)
              ? approvalExecutionBody(source, node.name.text)
              : node.body.getText(source),
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
    const ownerOpenApi = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), 'libs/api-contracts/openapi/gateway-public.json'),
        'utf8'
      )
    ) as {
      paths: Record<string, Record<string, { parameters?: Array<{ in: string; name: string }> }>>;
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
        const ownerDeclaresVersionHeader = ownerOpenApi.paths[gateway.path]?.[
          gateway.method.toLowerCase()
        ]?.parameters?.some(
          (parameter) =>
            parameter.in === 'header' && parameter.name === 'X-DWP-Expected-Object-Version'
        );
        const apiFunction = contract.apiFunction.split(':')[0];
        const supplementalOwnerHeader = [
          'createApprovalRetentionClaim',
          'publishApprovalRetentionPolicy',
        ].includes(apiFunction);
        if (supplementalOwnerHeader) {
          expect(stepUp.expectedObjectVersionSource).toBe('COMMAND_BODY');
          expect(ownerDeclaresVersionHeader, `${apiFunction} native header`).toBe(true);
        }
        return {
          apiFunction,
          canonicalHeader: stepUp.expectedObjectVersionSource === 'COMMAND_HEADER',
          supplementalOwnerHeader,
        };
      })
    );

    expect(highRiskBindings.length).toBeGreaterThan(0);
    // Retention compares the signed body version and an additional native owner header.
    expect(
      highRiskBindings
        .filter((binding) => !binding.canonicalHeader && binding.supplementalOwnerHeader)
        .map((binding) => binding.apiFunction)
        .sort()
    ).toEqual(['createApprovalRetentionClaim', 'publishApprovalRetentionPolicy']);
    for (const binding of highRiskBindings) {
      const body = found.get(binding.apiFunction)?.body ?? '';
      expect(body, `${binding.apiFunction} strict HIGH config`).toMatch(
        /(approvalHighRiskMutationExecutionConfig|productSurfaceHighRiskMutationConfig)\(/u
      );
      expect(body, `${binding.apiFunction} version binding`).toContain(
        `objectVersionHeader: ${binding.canonicalHeader || binding.supplementalOwnerHeader}`
      );
    }
  });
});
