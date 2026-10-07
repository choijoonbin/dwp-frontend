import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';

import {
  PAYROLL_FOUNDATION_API_BASE,
  createPayrollFoundation,
  getPayrollFoundationReceipt,
  listPayrollFoundationVersions,
  listPayrollFoundations,
  publishPayrollFoundation,
  reconcilePayrollFoundationReceipt,
  reversePayrollFoundation,
  simulatePayrollFoundation,
  updatePayrollFoundation,
} from './payroll-foundation-api';
import { selectFoundationConfiguration } from '../model/payroll-foundation-model';
import {
  FIXTURE_IDS,
  foundationWire,
  mutationWire,
  workspaceWire,
} from '../testing/payroll-foundation-fixtures.test-support';

function response(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function csrfResponse() {
  return response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' });
}

const scope = { contextScopeKey: 'scope:payroll-foundation' } as const;
const authority = {
  mode: 'SECURE',
  rolloutState: '111',
  expectedDecisionRevision: 'decision-1',
  contextKey: 'context:hcm.operations',
  contextScopeKey: 'scope:payroll-foundation',
} as const;

function highAuthority(commandId: string, objectVersion: number) {
  return {
    ...authority,
    idempotencyKey: commandId,
    objectVersion,
    stepUp: {
      challenge: `signed-payroll-command-${commandId}`,
      challengeId: `challenge-${commandId}`,
      decisionRevision: authority.expectedDecisionRevision,
      expiresAt: '2099-01-01T00:00:00Z',
    },
  } as const;
}

describe('payroll foundation owner API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('reads the canonical workspace through the payroll gateway and preserves scope', async () => {
    const payload = workspaceWire();
    const fetchMock = vi.fn().mockResolvedValue(response(payload));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listPayrollFoundations(scope)).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${PAYROLL_FOUNDATION_API_BASE}/configurations?contextScopeKey=scope%3Apayroll-foundation`
    );
  });

  it('uses the canonical versions endpoint and abort signal', async () => {
    const payload = [foundationWire()];
    const fetchMock = vi.fn().mockResolvedValue(response(payload));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(
      listPayrollFoundationVersions(FIXTURE_IDS.configuration, {
        ...scope,
        signal: controller.signal,
      })
    ).resolves.toEqual(payload);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${PAYROLL_FOUNDATION_API_BASE}/configurations/${FIXTURE_IDS.configuration}/versions?contextScopeKey=scope%3Apayroll-foundation`
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('creates and updates canonical definitions with stable idempotency and integer versions', async () => {
    const definition = selectFoundationConfiguration(foundationWire()).definition;
    const createKey = '20000000-0000-4000-8000-000000000001';
    const updateKey = '20000000-0000-4000-8000-000000000002';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(response(mutationWire()))
      .mockResolvedValueOnce(response(mutationWire()));
    vi.stubGlobal('fetch', fetchMock);

    await createPayrollFoundation(
      { definition },
      createKey,
      { contextScopeKey: 'scope:untrusted-caller-value' },
      authority
    );
    await updatePayrollFoundation(
      FIXTURE_IDS.configuration,
      { expectedVersion: 3, definition },
      updateKey,
      scope,
      authority
    );

    const calls = fetchMock.mock.calls.filter(([url]) => !String(url).includes('/api/auth/csrf'));
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[0]).toContain(`${PAYROLL_FOUNDATION_API_BASE}/configurations`);
    expect(calls[0]?.[0]).toContain('contextScopeKey=scope%3Apayroll-foundation');
    expect(calls[0]?.[0]).not.toContain('untrusted-caller-value');
    expect(new Headers((calls[0]?.[1] as RequestInit).headers).get('Idempotency-Key')).toBe(
      createKey
    );
    const browserHeaders = new Headers((calls[0]?.[1] as RequestInit).headers);
    expect(browserHeaders.get('X-DWP-Expected-Decision-Revision')).toBe('decision-1');
    for (const gatewayOwnedHeader of [
      'X-DWP-Tenant-ID',
      'X-DWP-User-ID',
      'X-DWP-Roles',
      'X-DWP-Permissions',
      'X-DWP-Purpose',
      'X-DWP-Legal-Entity-Scope',
      'X-DWP-Service-Token',
    ]) {
      expect(browserHeaders.has(gatewayOwnedHeader)).toBe(false);
    }
    expect(JSON.parse(String((calls[0]?.[1] as RequestInit).body))).toEqual({ definition });
    expect(calls[1]?.[0]).toContain(`/configurations/${FIXTURE_IDS.configuration}`);
    expect(new Headers((calls[1]?.[1] as RequestInit).headers).get('Idempotency-Key')).toBe(
      updateKey
    );
    const updateBody = JSON.parse(String((calls[1]?.[1] as RequestInit).body));
    expect(updateBody.expectedVersion).toBe(3);
    expect(typeof updateBody.expectedVersion).toBe('number');
    expect(updateBody.definition.legalEntity.countryPack.version).toBe(2);
    expect(updateBody.definition.roundingPolicies.XTS.increment).toBe('0.01');
  });

  it('targets simulation, publish and reversal owner commands exactly', async () => {
    const keys = [
      '20000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000004',
      '20000000-0000-4000-8000-000000000005',
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValue(response(mutationWire()));
    vi.stubGlobal('fetch', fetchMock);

    await simulatePayrollFoundation(
      FIXTURE_IDS.configuration,
      { expectedVersion: 3 },
      keys[0]!,
      scope,
      authority
    );
    await publishPayrollFoundation(
      FIXTURE_IDS.configuration,
      { expectedVersion: 3 },
      keys[1]!,
      scope,
      highAuthority(keys[1]!, 3)
    );
    await reversePayrollFoundation(
      FIXTURE_IDS.configuration,
      { expectedVersion: 3, publishCommandId: FIXTURE_IDS.command },
      keys[2]!,
      scope,
      highAuthority(keys[2]!, 3)
    );

    const commands = fetchMock.mock.calls.filter(
      ([url]) => !String(url).includes('/api/auth/csrf')
    );
    expect(commands.map(([url]) => String(url).split('?')[0])).toEqual([
      `${PAYROLL_FOUNDATION_API_BASE}/configurations/${FIXTURE_IDS.configuration}/simulations`,
      `${PAYROLL_FOUNDATION_API_BASE}/configurations/${FIXTURE_IDS.configuration}/publish`,
      `${PAYROLL_FOUNDATION_API_BASE}/configurations/${FIXTURE_IDS.configuration}/reversals`,
    ]);
    expect(
      commands.map(([, init]) => new Headers((init as RequestInit).headers).get('Idempotency-Key'))
    ).toEqual(keys);
    expect(
      commands
        .slice(1)
        .map(([, init]) =>
          new Headers((init as RequestInit).headers).get('X-DWP-Step-Up-Challenge')
        )
    ).toEqual([`signed-payroll-command-${keys[1]}`, `signed-payroll-command-${keys[2]}`]);
    expect(JSON.parse(String((commands[2]?.[1] as RequestInit).body))).toEqual({
      expectedVersion: 3,
      publishCommandId: FIXTURE_IDS.command,
    });
  });

  it('rejects payroll HIGH commands when signed identity or version is substituted', async () => {
    const commandId = '20000000-0000-4000-8000-000000000099';
    await expect(
      publishPayrollFoundation(
        FIXTURE_IDS.configuration,
        { expectedVersion: 3 },
        commandId,
        scope,
        highAuthority('20000000-0000-4000-8000-000000000098', 3)
      )
    ).rejects.toThrow('Payroll command authority does not match the command.');
    await expect(
      reversePayrollFoundation(
        FIXTURE_IDS.configuration,
        { expectedVersion: 3, publishCommandId: FIXTURE_IDS.command },
        commandId,
        scope,
        highAuthority(commandId, 4)
      )
    ).rejects.toThrow('Payroll command authority does not match the command.');
  });

  it('pins lookup and reconciliation to the same durable MutationResult receipt', async () => {
    const resultUnknown = mutationWire({
      receipt: {
        ...mutationWire().receipt,
        status: 'RESULT_UNKNOWN',
        completedAt: null,
      },
    });
    const reconciled = mutationWire();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(resultUnknown))
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(response(reconciled));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPayrollFoundationReceipt(FIXTURE_IDS.command, scope)).resolves.toEqual(
      resultUnknown
    );
    await expect(
      reconcilePayrollFoundationReceipt(FIXTURE_IDS.command, scope, authority)
    ).resolves.toEqual(reconciled);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${PAYROLL_FOUNDATION_API_BASE}/receipts/${FIXTURE_IDS.command}?contextScopeKey=scope%3Apayroll-foundation`
    );
    const reconciliationCall = fetchMock.mock.calls.at(-1)!;
    expect(reconciliationCall[0]).toBe(
      `${PAYROLL_FOUNDATION_API_BASE}/receipts/${FIXTURE_IDS.command}/reconcile?contextScopeKey=scope%3Apayroll-foundation`
    );
    expect(
      new Headers((reconciliationCall[1] as RequestInit).headers).get('Idempotency-Key')
    ).toBeNull();
    expect(
      new Headers((reconciliationCall[1] as RequestInit).headers).get(
        'X-DWP-Expected-Decision-Revision'
      )
    ).toBe('decision-1');
  });
});
