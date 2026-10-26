import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationCommand } from './integration-control-plane-types';

const transport = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: transport.get, post: transport.post },
}));

import {
  executeIntegrationCommand,
  INTEGRATION_COMMAND_AUTHORITY_POLICY,
  IntegrationCommandOutcomeUnknownError,
  readConnectorCatalog,
  readConnectorExecution,
  readIntegrationProjection,
} from './integration-control-plane-client';
import {
  connectorCatalogFixture,
  executionFixture,
  FIXTURE_IDS,
  integrationCommandFixtures,
  projectionFixture,
  receiptFixture,
  secureAuthority,
} from './integration-control-plane-fixtures.test-support';
import { INTEGRATION_ACTION_KEYS } from './integration-control-plane-types';

describe('SYS-008 integration control-plane typed client', () => {
  beforeEach(() => {
    transport.get.mockReset();
    transport.post.mockReset();
  });

  it('pins sixteen commands to exactly twelve CAS and seven step-up policies', () => {
    expect(Object.values(INTEGRATION_COMMAND_AUTHORITY_POLICY)).toHaveLength(16);
    expect(
      Object.values(INTEGRATION_COMMAND_AUTHORITY_POLICY).filter(
        ({ requiresObjectRevision }) => requiresObjectRevision
      )
    ).toHaveLength(12);
    expect(
      Object.values(INTEGRATION_COMMAND_AUTHORITY_POLICY).filter(({ highRisk }) => highRisk)
    ).toHaveLength(7);
    expect(
      Object.entries(INTEGRATION_COMMAND_AUTHORITY_POLICY)
        .filter(([, { highRisk }]) => highRisk)
        .every(([, { requiresObjectRevision }]) => requiresObjectRevision)
    ).toBe(true);
  });

  it('reads each sealed projection with bounded query state and trusted context only', async () => {
    const signal = new AbortController().signal;
    transport.get
      .mockResolvedValueOnce({ data: { data: projectionFixture('PRIMARY_HRIS_SETTINGS') } })
      .mockResolvedValueOnce({ data: { data: projectionFixture('PRIMARY_DWP_CONTROL') } });

    for (const projection of ['PRIMARY_HRIS_SETTINGS', 'PRIMARY_DWP_CONTROL'] as const) {
      await expect(
        readIntegrationProjection(
          projection,
          {
            asOf: '2026-10-26T00:00:00Z',
            filters: {
              connectorMetadata: 'workforce',
              effectiveStatus: 'ACTIVE',
            },
            limit: 25,
            cursor: 'cursor-0123456789abcdef',
          },
          {
            correlationId: FIXTURE_IDS.correlation,
            contextScopeKey: 'tenant:fixture/hris-integration',
            signal,
          }
        )
      ).resolves.toMatchObject({ projection, state: 'COMPLETE' });
    }

    const first = transport.get.mock.calls[0];
    const firstUrl = new URL(first[0], 'http://test.invalid');
    expect(firstUrl.pathname).toBe('/api/platform/v1/hris/workbench/settings-integrations');
    expect(firstUrl.searchParams.get('sort')).toBe('itemPublicId:ASC');
    expect(firstUrl.searchParams.get('connectorMetadata')).toBe('workforce');
    expect(firstUrl.searchParams.has('tenantId')).toBe(false);
    expect(first[1]).toMatchObject({
      contextScopeKey: 'tenant:fixture/hris-integration',
      signal,
      headers: {
        'X-Correlation-Id': FIXTURE_IDS.correlation,
        'X-Purpose-Code': 'HRIS_SYSTEM_ADMIN',
      },
    });
    expect(new URL(transport.get.mock.calls[1][0], 'http://test.invalid').pathname).toBe(
      '/api/platform/v1/hris/workbench/dwp-integrations'
    );
  });

  it('rejects projection filter, cursor, sort and limit widening before transport', async () => {
    await expect(
      readIntegrationProjection(
        'PRIMARY_HRIS_SETTINGS',
        {
          asOf: '2026-10-26T00:00:00Z',
          filters: { executionPolicy: 'not-allowed-on-this-projection' },
        },
        { correlationId: FIXTURE_IDS.correlation }
      )
    ).rejects.toThrow(/filter/i);
    await expect(
      readIntegrationProjection(
        'PRIMARY_DWP_CONTROL',
        { asOf: '2026-10-26T00:00:00Z', sort: 'unknown:ASC', limit: 101 },
        { correlationId: FIXTURE_IDS.correlation }
      )
    ).rejects.toThrow(/sort or limit/i);
    expect(transport.get).not.toHaveBeenCalled();
  });

  it('reads the exact closed connector catalog and execution evidence', async () => {
    transport.get
      .mockResolvedValueOnce({ data: { data: connectorCatalogFixture() } })
      .mockResolvedValueOnce({ data: { data: executionFixture() } });

    await readConnectorCatalog(
      {
        asOf: '2026-10-26T00:00:00Z',
        fields: ['connector.key', 'connector.state'],
        freshness: 'ALLOW_STALE',
        limit: 20,
      },
      { correlationId: FIXTURE_IDS.correlation }
    );
    await readConnectorExecution(FIXTURE_IDS.execution, {
      correlationId: FIXTURE_IDS.correlation,
    });

    const catalogUrl = new URL(transport.get.mock.calls[0][0], 'http://test.invalid');
    expect(catalogUrl.pathname).toBe('/api/platform/v1/admin/hris/connectors');
    expect(catalogUrl.searchParams.getAll('fields')).toEqual(['connector.key', 'connector.state']);
    expect(transport.get.mock.calls[1][0]).toBe(
      `/api/platform/v1/admin/hris/connector-executions/${FIXTURE_IDS.execution}`
    );
  });

  it('submits all sixteen closed bodies with exact CAS and no browser tenant authority', async () => {
    const fixtures = integrationCommandFixtures();
    for (const fixture of fixtures) {
      transport.post.mockResolvedValueOnce({ data: { data: receiptFixture(fixture.actionKey) } });
      const policy = INTEGRATION_COMMAND_AUTHORITY_POLICY[fixture.command.kind];
      await executeIntegrationCommand(
        fixture.command,
        secureAuthority({
          ...(policy.requiresObjectRevision ? { objectRevision: 12 } : {}),
          stepUp: policy.highRisk,
        })
      );
    }

    expect(transport.post).toHaveBeenCalledTimes(16);
    fixtures.forEach((fixture, index) => {
      const [, body, config] = transport.post.mock.calls[index];
      expect(body).toEqual(fixture.command.body);
      const headers = new Headers(config.headers);
      const policy = INTEGRATION_COMMAND_AUTHORITY_POLICY[fixture.command.kind];
      expect(headers.get('Idempotency-Key')).toBe('idempotency-key-0123456789');
      expect(headers.get('If-Match')).toBe(policy.requiresObjectRevision ? '"12"' : null);
      expect(headers.has('X-Tenant-Id')).toBe(false);
      expect(headers.has('X-DWP-Step-Up-Challenge')).toBe(false);
      expect(headers.has('X-DWP-Expected-Object-Version')).toBe(false);
    });
  });

  it('rejects extra body fields and substituted CAS authority before dispatch', async () => {
    const invalid = {
      kind: 'CREATE_DEFINITION',
      body: {
        ...integrationCommandFixtures()[0]!.command.body,
        tenantId: 'browser-must-not-supply-tenant',
      },
    } as unknown as IntegrationCommand;
    await expect(executeIntegrationCommand(invalid, secureAuthority())).rejects.toThrow(
      /closed transport contract/i
    );

    const approve = integrationCommandFixtures().find(
      ({ command }) => command.kind === 'APPROVE_DEFINITION'
    )!;
    await expect(
      executeIntegrationCommand(approve.command, {
        ...secureAuthority({ objectRevision: 12, stepUp: true }),
        expectedObjectRevision: 13,
      })
    ).rejects.toThrow(/does not match/i);
    expect(transport.post).not.toHaveBeenCalled();
  });

  it('requires trusted step-up for the exact seven high-risk commands', async () => {
    const highRisk = integrationCommandFixtures().find(
      ({ command }) => command.kind === 'RECONCILE_EXECUTION'
    )!;
    await expect(
      executeIntegrationCommand(highRisk.command, secureAuthority({ objectRevision: 12 }))
    ).rejects.toThrow(/step-up/i);
    expect(transport.post).not.toHaveBeenCalled();
  });

  it('preserves durable result-unknown receipts and rejects unbound receipts', async () => {
    const command = integrationCommandFixtures().find(
      ({ command: candidate }) => candidate.kind === 'TEST_CONNECTOR'
    )!;
    transport.post.mockResolvedValueOnce({
      data: { data: receiptFixture(command.actionKey, 'RESULT_UNKNOWN') },
    });
    await expect(
      executeIntegrationCommand(command.command, secureAuthority())
    ).resolves.toMatchObject({ status: 'RESULT_UNKNOWN' });

    transport.post.mockResolvedValueOnce({
      data: { data: receiptFixture(INTEGRATION_ACTION_KEYS.createExecution) },
    });
    await expect(
      executeIntegrationCommand(command.command, secureAuthority())
    ).rejects.toBeInstanceOf(IntegrationCommandOutcomeUnknownError);

    transport.post.mockResolvedValueOnce({
      data: {
        data: {
          ...receiptFixture(command.actionKey),
          commandType: 'CREATE_CONNECTOR_EXECUTION',
        },
      },
    });
    await expect(
      executeIntegrationCommand(command.command, secureAuthority())
    ).rejects.toBeInstanceOf(IntegrationCommandOutcomeUnknownError);
  });

  it('distinguishes transport ambiguity from a known RFC7807 response', async () => {
    const command = integrationCommandFixtures()[0]!.command;
    transport.post.mockRejectedValueOnce(new Error('socket closed'));
    await expect(executeIntegrationCommand(command, secureAuthority())).rejects.toBeInstanceOf(
      IntegrationCommandOutcomeUnknownError
    );

    const known = { response: { status: 409 }, message: 'conflict' };
    transport.post.mockRejectedValueOnce(known);
    await expect(executeIntegrationCommand(command, secureAuthority())).rejects.toBe(known);
  });
});
