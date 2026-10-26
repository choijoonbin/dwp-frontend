import {
  INTEGRATION_ACTION_KEYS,
  INTEGRATION_COMMAND_TYPE_BY_ACTION,
} from './integration-control-plane-types';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { HrisIntegrationControlPlaneProjection } from './integration-control-plane-contract';
import type {
  ConnectorCatalogResponse,
  ConnectorExecutionResponse,
  IntegrationActionKey,
  IntegrationCommandAuthority,
  IntegrationCommandReceipt,
  IntegrationCommand,
  IntegrationProjectionResponse,
} from './integration-control-plane-types';

export const FIXTURE_IDS = Object.freeze({
  item: '11111111-1111-4111-8111-111111111111',
  connector: '22222222-2222-4222-8222-222222222222',
  execution: '33333333-3333-4333-8333-333333333333',
  actor: '44444444-4444-4444-8444-444444444444',
  receipt: '55555555-5555-4555-8555-555555555555',
  approvalReceipt: '66666666-6666-4666-8666-666666666666',
  correlation: '77777777-7777-4777-8777-777777777777',
  challenge: '88888888-8888-4888-8888-888888888888',
});

export const FIXTURE_DIGESTS = Object.freeze({
  request: 'a'.repeat(64),
  scope: 'b'.repeat(64),
  selected: 'c'.repeat(64),
  reconciliation: 'd'.repeat(64),
  definition: 'e'.repeat(64),
  mapping: 'f'.repeat(64),
});

export function projectionFixture(
  projection: HrisIntegrationControlPlaneProjection = 'PRIMARY_HRIS_SETTINGS',
  options: Readonly<{
    state?: IntegrationProjectionResponse['state'];
    masked?: boolean;
    actions?: readonly IntegrationActionKey[];
    itemPublicId?: string;
    revision?: number;
  }> = {}
): IntegrationProjectionResponse {
  const state = options.state ?? 'COMPLETE';
  if (state === 'EMPTY' || state === 'UNAVAILABLE') {
    return Object.freeze({ projection, state, items: Object.freeze([]) });
  }
  const masked = options.masked ?? state === 'PARTIAL';
  const actions =
    state === 'COMPLETE' && !masked
      ? (options.actions ?? [
          INTEGRATION_ACTION_KEYS.testConnector,
          INTEGRATION_ACTION_KEYS.validateDefinition,
        ])
      : [];
  const common = {
    CONNECTOR_METADATA: masked
      ? Object.freeze({ decision: 'MASK' as const, value: null })
      : Object.freeze({
          decision: 'VIEW' as const,
          value: Object.freeze({
            displayName: 'Workforce gateway',
            connectorKey: 'workforce.gateway',
            connectorType: 'HTTPS',
          }),
        }),
    EFFECTIVE_STATUS: Object.freeze({
      decision: 'VIEW' as const,
      value: Object.freeze({ state: 'ACTIVE', effectiveFrom: '2026-10-26T00:00:00Z' }),
    }),
  };
  const variant =
    projection === 'PRIMARY_HRIS_SETTINGS'
      ? {
          POLICY_VERSION: Object.freeze({
            decision: 'VIEW' as const,
            value: Object.freeze({ definitionVersion: 3, mappingVersion: 7, policyRevision: 12 }),
          }),
        }
      : {
          EXECUTION_POLICY: Object.freeze({
            decision: 'VIEW' as const,
            value: Object.freeze({ operationMode: 'IMPORT', retryMode: 'FAILED_ITEMS_ONLY' }),
          }),
        };
  return Object.freeze({
    projection,
    state,
    items: Object.freeze([
      Object.freeze({
        itemPublicId: options.itemPublicId ?? FIXTURE_IDS.item,
        effectiveStatusRevision: options.revision ?? 12,
        fields: Object.freeze({ ...common, ...variant }),
        availableActions: Object.freeze([...actions]),
      }),
    ]),
  });
}

export function connectorCatalogFixture(): ConnectorCatalogResponse {
  return Object.freeze({
    asOf: '2026-10-26T00:00:00Z',
    nextCursor: 'cursor-0123456789abcdef',
    items: Object.freeze([
      Object.freeze({
        publicId: FIXTURE_IDS.connector,
        key: 'workforce.gateway',
        type: 'HTTPS',
        state: 'ACTIVE',
        version: 3,
        updatedAt: '2026-10-26T00:00:00Z',
      }),
    ]),
    freshUntil: '2026-10-26T00:05:00Z',
    staleAfter: '2026-10-26T00:15:00Z',
  });
}

export function executionFixture(
  state: ConnectorExecutionResponse['state'] = 'RESULT_UNKNOWN'
): ConnectorExecutionResponse {
  return Object.freeze({
    executionId: FIXTURE_IDS.execution,
    mappingVersion: 7,
    state,
    sourceCount: 10,
    acceptedCount: state === 'RECONCILED' ? 10 : 7,
    rejectedCount: state === 'RECONCILED' ? 0 : 3,
    selectedItemCount: 10,
    selectedItemDigest: FIXTURE_DIGESTS.selected,
    reconciliationDigest: state === 'RECONCILED' ? FIXTURE_DIGESTS.reconciliation : null,
    aggregateVersion: 4,
  });
}

export function receiptFixture(
  action: IntegrationActionKey = INTEGRATION_ACTION_KEYS.testConnector,
  status: IntegrationCommandReceipt['status'] = 'ACCEPTED'
): IntegrationCommandReceipt {
  return Object.freeze({
    receiptId: FIXTURE_IDS.receipt,
    commandType: INTEGRATION_COMMAND_TYPE_BY_ACTION[action],
    originatingAction: action,
    subjectPrincipalPublicId: FIXTURE_IDS.actor,
    populationScopeDigest: FIXTURE_DIGESTS.scope,
    fieldPolicyRevision: 9,
    purposeCode: 'HRIS_SYSTEM_ADMIN',
    authorizationRevision: 11,
    status,
    correlationId: FIXTURE_IDS.correlation,
    requestDigest: FIXTURE_DIGESTS.request,
    createdAt: '2026-10-26T00:00:00Z',
    ...(status === 'SUCCEEDED'
      ? { aggregateVersion: 4, resultRef: 'ref_result_0123456789abcdef' }
      : {}),
  });
}

export function secureAuthority(
  options: Readonly<{ objectRevision?: number; stepUp?: boolean }> = {}
): IntegrationCommandAuthority {
  const objectRevision = options.objectRevision;
  const governance = {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: 'decision-12',
    contextKey: 'hcm.management',
    contextScopeKey: 'tenant:fixture',
    idempotencyKey: 'idempotency-key-0123456789',
    ...(objectRevision === undefined ? {} : { objectVersion: objectRevision }),
    ...(options.stepUp
      ? {
          stepUp: {
            challenge: 'sealed-challenge',
            challengeId: FIXTURE_IDS.challenge,
            decisionRevision: 'decision-12',
            expiresAt: '2099-10-26T00:00:00Z',
          },
        }
      : {}),
  } satisfies ProductSurfaceGovernedMutationAuthority;
  return Object.freeze({
    governance,
    idempotencyKey: 'idempotency-key-0123456789',
    correlationId: FIXTURE_IDS.correlation,
    ...(objectRevision === undefined ? {} : { expectedObjectRevision: objectRevision }),
  });
}

export function integrationCommandFixtures(): readonly Readonly<{
  command: IntegrationCommand;
  actionKey: IntegrationActionKey;
}>[] {
  const connectorPublicId = FIXTURE_IDS.connector;
  const executionPublicId = FIXTURE_IDS.execution;
  const mappingVersion = 7;
  const approvalRequest = {
    approvalWorkflowKey: 'hris.integration.approval',
    subjectRevision: 12,
    payloadDigest: FIXTURE_DIGESTS.request,
  } as const;
  const approvalDecision = {
    approvalReceiptId: FIXTURE_IDS.approvalReceipt,
    decisionDigest: FIXTURE_DIGESTS.request,
  } as const;
  const activation = {
    approvalReceiptId: FIXTURE_IDS.approvalReceipt,
    effectiveAt: '2026-10-26T01:00:00Z',
  } as const;
  return Object.freeze([
    {
      command: {
        kind: 'CREATE_DEFINITION',
        body: {
          connectorKey: 'workforce.gateway',
          type: 'HTTPS',
          endpoint: 'https://connector.invalid/v1',
          secretRef: 'secret_0123456789abcdef',
          egressPolicyKey: 'hris-egress-workforce',
        },
      },
      actionKey: INTEGRATION_ACTION_KEYS.createDefinition,
    },
    {
      command: {
        kind: 'TEST_CONNECTOR',
        connectorPublicId,
        body: {
          testMode: 'CONNECTIVITY',
          sampleRef: 'ref_sample_0123456789abcdef',
          sampleDigest: FIXTURE_DIGESTS.request,
        },
      },
      actionKey: INTEGRATION_ACTION_KEYS.testConnector,
    },
    {
      command: {
        kind: 'DRY_RUN_MAPPING',
        connectorPublicId,
        mappingVersion,
        body: {
          sampleRef: 'ref_sample_0123456789abcdef',
          sampleDigest: FIXTURE_DIGESTS.request,
          maxRows: 100,
          asOf: '2026-10-26T00:00:00Z',
        },
      },
      actionKey: INTEGRATION_ACTION_KEYS.dryRunMapping,
    },
    {
      command: {
        kind: 'CREATE_EXECUTION',
        connectorPublicId,
        body: {
          operation: 'IMPORT',
          payloadRef: 'ref_payload_0123456789abcdef',
          payloadDigest: FIXTURE_DIGESTS.request,
          asOf: '2026-10-26T00:00:00Z',
        },
      },
      actionKey: INTEGRATION_ACTION_KEYS.createExecution,
    },
    {
      command: {
        kind: 'VALIDATE_DEFINITION',
        connectorPublicId,
        body: {
          definitionDigest: FIXTURE_DIGESTS.definition,
          endpointPolicyRevision: 4,
          secretRevision: 2,
        },
      },
      actionKey: INTEGRATION_ACTION_KEYS.validateDefinition,
    },
    {
      command: { kind: 'SUBMIT_DEFINITION', connectorPublicId, body: approvalRequest },
      actionKey: INTEGRATION_ACTION_KEYS.submitDefinition,
    },
    {
      command: { kind: 'APPROVE_DEFINITION', connectorPublicId, body: approvalDecision },
      actionKey: INTEGRATION_ACTION_KEYS.approveDefinition,
    },
    {
      command: { kind: 'ACTIVATE_DEFINITION', connectorPublicId, body: activation },
      actionKey: INTEGRATION_ACTION_KEYS.activateDefinition,
    },
    {
      command: {
        kind: 'CREATE_MAPPING',
        connectorPublicId,
        body: {
          sourceSchemaVersion: 3,
          targetSchemaVersion: 5,
          mappingRef: 'ref_mapping_0123456789abcdef',
          mappingDigest: FIXTURE_DIGESTS.mapping,
          compatibilityMode: 'BACKWARD',
          effectiveFrom: '2026-10-26T00:00:00Z',
          effectiveTo: null,
        },
      },
      actionKey: INTEGRATION_ACTION_KEYS.createMapping,
    },
    {
      command: {
        kind: 'VALIDATE_MAPPING',
        connectorPublicId,
        mappingVersion,
        body: {
          mappingDigest: FIXTURE_DIGESTS.mapping,
          sourceSchemaDigest: FIXTURE_DIGESTS.definition,
          targetSchemaDigest: FIXTURE_DIGESTS.request,
        },
      },
      actionKey: INTEGRATION_ACTION_KEYS.validateMapping,
    },
    {
      command: {
        kind: 'SUBMIT_MAPPING',
        connectorPublicId,
        mappingVersion,
        body: approvalRequest,
      },
      actionKey: INTEGRATION_ACTION_KEYS.submitMapping,
    },
    {
      command: {
        kind: 'APPROVE_MAPPING',
        connectorPublicId,
        mappingVersion,
        body: approvalDecision,
      },
      actionKey: INTEGRATION_ACTION_KEYS.approveMapping,
    },
    {
      command: {
        kind: 'ACTIVATE_MAPPING',
        connectorPublicId,
        mappingVersion,
        body: activation,
      },
      actionKey: INTEGRATION_ACTION_KEYS.activateMapping,
    },
    {
      command: {
        kind: 'RECONCILE_EXECUTION',
        executionPublicId,
        body: {
          providerReceiptRef: 'ref_provider_0123456789abcdef',
          providerReceiptDigest: FIXTURE_DIGESTS.request,
          expectedSourceCount: 10,
          asOf: '2026-10-26T00:00:00Z',
        },
      },
      actionKey: INTEGRATION_ACTION_KEYS.reconcileExecution,
    },
    {
      command: {
        kind: 'RETRY_EXECUTION',
        executionPublicId,
        body: {
          failedItemIds: [FIXTURE_IDS.item],
          failedItemSetDigest: FIXTURE_DIGESTS.selected,
          expectedRejectedCount: 1,
          reasonCode: 'TRANSIENT_PROVIDER_FAILURE',
        },
      },
      actionKey: INTEGRATION_ACTION_KEYS.retryExecution,
    },
    {
      command: {
        kind: 'CANCEL_EXECUTION',
        executionPublicId,
        body: {
          reasonCode: 'OPERATOR_REQUEST',
          compensationPolicyRef: 'policy_0123456789abcdef',
        },
      },
      actionKey: INTEGRATION_ACTION_KEYS.cancelExecution,
    },
  ]);
}
