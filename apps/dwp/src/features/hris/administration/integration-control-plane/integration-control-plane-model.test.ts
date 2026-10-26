import { describe, expect, it } from 'vitest';

import {
  assertConnectorCatalogResponse,
  assertConnectorExecutionResponse,
  assertDualProjectionIdentity,
  assertIntegrationCommandReceipt,
  assertIntegrationProjectionResponse,
  integrationActionsForItem,
  integrationProjectionRows,
  resolveIntegrationControlPlaneState,
} from './integration-control-plane-model';
import {
  connectorCatalogFixture,
  executionFixture,
  FIXTURE_IDS,
  projectionFixture,
  receiptFixture,
} from './integration-control-plane-fixtures.test-support';

describe('SYS-008 integration control-plane model', () => {
  it('parses the exact sealed projection and derives safe rows from server actions', () => {
    const projection = assertIntegrationProjectionResponse(
      projectionFixture('PRIMARY_HRIS_SETTINGS'),
      'PRIMARY_HRIS_SETTINGS'
    );
    const rows = integrationProjectionRows(projection);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: FIXTURE_IDS.item,
      title: 'Workforce gateway · workforce.gateway · HTTPS',
      effectiveStatusRevision: 12,
      redacted: false,
    });
    expect(rows[0]?.actions).toEqual(projection.items[0]?.availableActions);
  });

  it('rejects serialized owner lineage, unknown response keys and projection replay', () => {
    expect(() =>
      assertIntegrationProjectionResponse({
        ...projectionFixture(),
        ownerReceipt: 'server-only',
      })
    ).toThrow(/invalid/i);
    expect(() =>
      assertIntegrationProjectionResponse(
        projectionFixture('PRIMARY_HRIS_SETTINGS'),
        'PRIMARY_DWP_CONTROL'
      )
    ).toThrow(/invalid/i);
  });

  it('rejects cross-policy fields and projected secret or raw payload material', () => {
    const wrongField = clone(projectionFixture('PRIMARY_HRIS_SETTINGS'));
    Object.assign(wrongField.items[0]!.fields, {
      EXECUTION_POLICY: { decision: 'VIEW', value: { retryMode: 'NONE' } },
    });
    expect(() => assertIntegrationProjectionResponse(wrongField)).toThrow(/policy group/i);

    const unsafe = clone(projectionFixture('PRIMARY_HRIS_SETTINGS'));
    Object.assign(unsafe.items[0]!.fields, {
      CONNECTOR_METADATA: {
        decision: 'VIEW',
        value: { secretValue: 'must-never-reach-the-browser' },
      },
    });
    expect(() => assertIntegrationProjectionResponse(unsafe)).toThrow(/decision/i);
  });

  it('withholds all commands for partial or masked evidence', () => {
    const partial = assertIntegrationProjectionResponse(
      projectionFixture('PRIMARY_HRIS_SETTINGS', { state: 'PARTIAL', masked: true })
    );
    expect(partial.items[0]?.availableActions).toEqual([]);
    expect(integrationActionsForItem(partial, partial.items[0]!)).toEqual([]);

    const invalid = clone(projectionFixture('PRIMARY_HRIS_SETTINGS', { masked: true }));
    Object.assign(invalid.items[0]!, {
      availableActions: ['hris.action.sys.post.platform.v1.admin.hris.connectors.resource.test'],
    });
    expect(() => assertIntegrationProjectionResponse(invalid)).toThrow(/masked/i);
  });

  it('requires all three projection-specific VIEW groups before exposing an action', () => {
    const incomplete = clone(projectionFixture('PRIMARY_HRIS_SETTINGS'));
    delete (incomplete.items[0]!.fields as Record<string, unknown>).POLICY_VERSION;

    expect(() => assertIntegrationProjectionResponse(incomplete)).toThrow(/incomplete/i);

    Object.assign(incomplete.items[0]!, { availableActions: [] });
    expect(assertIntegrationProjectionResponse(incomplete).items[0]?.availableActions).toEqual([]);
  });

  it('requires both projections to retain the same owner identity revision', () => {
    const hris = assertIntegrationProjectionResponse(projectionFixture('PRIMARY_HRIS_SETTINGS'));
    const dwp = assertIntegrationProjectionResponse(projectionFixture('PRIMARY_DWP_CONTROL'));
    expect(() => assertDualProjectionIdentity(hris, dwp)).not.toThrow();

    const drifted = assertIntegrationProjectionResponse(
      projectionFixture('PRIMARY_DWP_CONTROL', { revision: 13 })
    );
    expect(() => assertDualProjectionIdentity(hris, drifted)).toThrow(/owner identity/i);
  });

  it('maps read state and command result-unknown independently', () => {
    const projection = assertIntegrationProjectionResponse(projectionFixture());
    expect(
      resolveIntegrationControlPlaneState({
        loading: false,
        forbidden: false,
        stepUpRequired: false,
        readFailed: false,
        retryable: false,
        projection,
      })
    ).toBe('complete');
    expect(
      resolveIntegrationControlPlaneState({
        loading: false,
        forbidden: false,
        stepUpRequired: false,
        readFailed: false,
        retryable: false,
        commandResultUnknown: true,
        projection,
      })
    ).toBe('result-unknown');
    expect(projection.items).toHaveLength(1);
  });

  it('parses exact catalog and execution evidence and rejects count drift', () => {
    expect(assertConnectorCatalogResponse(connectorCatalogFixture()).items).toHaveLength(1);
    expect(assertConnectorExecutionResponse(executionFixture()).state).toBe('RESULT_UNKNOWN');

    const invalid = { ...executionFixture(), acceptedCount: 9, rejectedCount: 3 };
    expect(() => assertConnectorExecutionResponse(invalid)).toThrow(/invalid/i);
  });

  it('seals receipt action identity and paired safe result references', () => {
    expect(assertIntegrationCommandReceipt(receiptFixture()).status).toBe('ACCEPTED');
    expect(
      assertIntegrationCommandReceipt(receiptFixture(undefined, 'RESULT_UNKNOWN')).status
    ).toBe('RESULT_UNKNOWN');
    expect(() =>
      assertIntegrationCommandReceipt({ ...receiptFixture(), aggregateVersion: 3 })
    ).toThrow(/binding/i);
    expect(() =>
      assertIntegrationCommandReceipt({ ...receiptFixture(), originatingAction: 'unknown.action' })
    ).toThrow(/invalid/i);
  });
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
