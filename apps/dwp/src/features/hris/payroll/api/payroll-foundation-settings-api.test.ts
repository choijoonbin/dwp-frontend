import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';
import { productSurfaceHighRiskOperationBinding } from '../../../../components/product-surface-high-risk-command-model';

import {
  PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS,
  PAYROLL_FOUNDATION_SETTINGS_API_BASE,
  PAYROLL_FOUNDATION_SETTINGS_READ_CONTRACTS,
  payrollFoundationSettingsDataSource,
} from './payroll-foundation-settings-api';
import {
  payrollFoundationSettingsPublishCommand,
  payrollFoundationSettingsReverseCommand,
} from '../hooks/use-payroll-foundation-settings-command-executors';

import type { PayrollFoundationDefinition } from '../model/payroll-foundation-model';

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

const scope = { contextScopeKey: 'scope:payroll-settings' } as const;
const authority = {
  mode: 'SECURE',
  rolloutState: '111',
  expectedDecisionRevision: 'decision-settings-1',
  contextKey: 'context:hcm.management',
  contextScopeKey: 'scope:payroll-settings',
} as const;

function highAuthority(commandId: string, objectVersion: number) {
  return {
    ...authority,
    idempotencyKey: commandId,
    objectVersion,
    stepUp: {
      challenge: `signed-settings-command-${commandId}`,
      challengeId: `challenge-${commandId}`,
      decisionRevision: authority.expectedDecisionRevision,
      expiresAt: '2099-01-01T00:00:00Z',
    },
  } as const;
}

describe('payroll Foundation settings API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('pins exactly four settings reads and never addresses the operations family', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({}));
    vi.stubGlobal('fetch', fetchMock);
    const configurationId = '10000000-0000-4000-8000-000000000001';
    const commandId = '20000000-0000-4000-8000-000000000001';

    await payrollFoundationSettingsDataSource.list(scope);
    await payrollFoundationSettingsDataSource.get(configurationId, scope);
    await payrollFoundationSettingsDataSource.versions(configurationId, scope);
    await payrollFoundationSettingsDataSource.receipt(commandId, scope);

    expect(Object.keys(PAYROLL_FOUNDATION_SETTINGS_READ_CONTRACTS)).toEqual([
      'list',
      'detail',
      'versions',
      'receipt',
    ]);
    expect(fetchMock.mock.calls.map(([url]) => String(url).split('?')[0])).toEqual([
      `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations`,
      `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/${configurationId}`,
      `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/${configurationId}/versions`,
      `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/receipts/${commandId}`,
    ]);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/hris/payroll/'))).toBe(
      true
    );
  });

  it('pins exactly six hcm.management actions and preserves governed/high-risk authority', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(csrfResponse()).mockResolvedValue(response({}));
    vi.stubGlobal('fetch', fetchMock);
    const configurationId = '10000000-0000-4000-8000-000000000001';
    const receiptId = '20000000-0000-4000-8000-000000000099';
    const commandIds = [
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000004',
      '20000000-0000-4000-8000-000000000005',
    ] as const;
    const definition = {} as PayrollFoundationDefinition;

    await payrollFoundationSettingsDataSource.create(
      { definition },
      commandIds[0],
      scope,
      authority
    );
    await payrollFoundationSettingsDataSource.update(
      configurationId,
      { expectedVersion: 3, definition },
      commandIds[1],
      scope,
      authority
    );
    await payrollFoundationSettingsDataSource.simulate(
      configurationId,
      { expectedVersion: 3 },
      commandIds[2],
      scope,
      authority
    );
    await payrollFoundationSettingsDataSource.publish(
      configurationId,
      { expectedVersion: 3 },
      commandIds[3],
      scope,
      highAuthority(commandIds[3], 3)
    );
    await payrollFoundationSettingsDataSource.reverse(
      configurationId,
      { expectedVersion: 3, publishCommandId: receiptId },
      commandIds[4],
      scope,
      highAuthority(commandIds[4], 3)
    );
    await payrollFoundationSettingsDataSource.reconcile(receiptId, scope, authority);

    expect(Object.values(PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS)).toHaveLength(6);
    expect(
      Object.values(PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS).every(
        (key) => key.startsWith('route.hcm.configuration.') && !key.includes('.operations.')
      )
    ).toBe(true);
    const calls = fetchMock.mock.calls.filter(([url]) => !String(url).includes('/api/auth/csrf'));
    expect(calls.map(([url]) => String(url).split('?')[0])).toEqual([
      `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations`,
      `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/${configurationId}`,
      `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/${configurationId}/simulations`,
      `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/${configurationId}/publish`,
      `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/${configurationId}/reversals`,
      `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/receipts/${receiptId}/reconcile`,
    ]);
    expect(
      calls
        .slice(3, 5)
        .map(([, init]) =>
          new Headers((init as RequestInit).headers).get('X-DWP-Step-Up-Challenge')
        )
    ).toEqual([
      `signed-settings-command-${commandIds[3]}`,
      `signed-settings-command-${commandIds[4]}`,
    ]);
    expect(
      productSurfaceHighRiskOperationBinding('HCM_PAYROLL_FOUNDATION_SETTINGS_PUBLISH')
    ).toEqual({
      routeContractKey: PAYROLL_FOUNDATION_SETTINGS_ACTION_CONTRACTS.publish,
      target: { productKey: 'hcm', surfaceKey: 'hcm.management' },
    });
    expect(
      payrollFoundationSettingsPublishCommand({
        configurationId,
        commandId: commandIds[3],
        request: { expectedVersion: 3 },
      })
    ).toMatchObject({
      operation: 'HCM_PAYROLL_FOUNDATION_SETTINGS_PUBLISH',
      commandPath: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/${configurationId}/publish`,
    });
    expect(
      payrollFoundationSettingsReverseCommand({
        configurationId,
        commandId: commandIds[4],
        request: { expectedVersion: 3, publishCommandId: receiptId },
      })
    ).toMatchObject({
      operation: 'HCM_PAYROLL_FOUNDATION_SETTINGS_REVERSE',
      commandPath: `${PAYROLL_FOUNDATION_SETTINGS_API_BASE}/configurations/${configurationId}/reversals`,
    });
  });
});
