import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const transport = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils/axios-instance', () => ({
  axiosInstance: transport,
}));

import {
  PayrollCalculationCommandOutcomeUnknownError,
  approvePayrollRun,
  calculatePayrollRun,
  finalizePayrollRun,
  getPayrollCalculationReceipt,
  getPayrollCalculationRun,
} from './payroll-calculation-api';

const ids = Object.freeze({
  run: '20000000-0000-4000-8000-000000000001',
  period: '20000000-0000-4000-8000-000000000002',
  receipt: '20000000-0000-4000-8000-000000000003',
  subject: '20000000-0000-4000-8000-000000000004',
  correlation: '20000000-0000-4000-8000-000000000005',
  idempotency: '20000000-0000-4000-8000-000000000006',
});

function runWire() {
  return {
    runId: ids.run,
    runType: 'REGULAR',
    payPeriodId: ids.period,
    state: 'READY',
    workerCount: 10,
    gross: { amount: '5000.0000', currency: 'USD' },
    net: { amount: '4000.0000', currency: 'USD' },
    version: 3,
  };
}

const pairs = {
  attempts: ['RUN_CALCULATE', 'PAY_RUN_CALCULATE'],
  approvals: ['RUN_APPROVE', 'PAY_RUN_APPROVE'],
  finalize: ['RUN_FINALIZE', 'PAY_RUN_FINALIZE'],
} as const;

function receiptWire(kind: keyof typeof pairs) {
  const [commandType, originatingAction] = pairs[kind];
  return {
    receiptId: ids.receipt,
    commandType,
    originatingAction,
    subjectPrincipalPublicId: ids.subject,
    populationScopeDigest: 'a'.repeat(64),
    fieldPolicyRevision: 41,
    purposeCode: 'PAYROLL_PROCESSING',
    authorizationRevision: 41,
    status: 'RUNNING',
    correlationId: ids.correlation,
    requestDigest: 'b'.repeat(64),
    createdAt: '2026-10-14T05:00:00Z',
  };
}

type SecureAuthority = Extract<ProductSurfaceGovernedMutationAuthority, { mode: 'SECURE' }>;

function authority(highRisk: boolean) {
  const governance: SecureAuthority = {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: 'decision-41',
    contextKey: 'hcm.operations.payroll',
    contextScopeKey: 'tenant:7/pay-group:9',
    idempotencyKey: ids.idempotency,
    objectVersion: 3,
    ...(highRisk
      ? {
          stepUp: {
            challenge: 'signed-payroll-run-command',
            challengeId: 'payroll-run-challenge',
            decisionRevision: 'decision-41',
            expiresAt: '2099-01-01T00:00:00Z',
          },
        }
      : {}),
  };
  return {
    governance,
    idempotencyKey: ids.idempotency,
    correlationId: ids.correlation,
    expectedObjectVersion: 3,
  };
}

describe('PAY-011 owner API', () => {
  beforeEach(() => {
    transport.get.mockReset();
    transport.post.mockReset();
  });

  it('reads the exact run and receipt routes with correlation and governed scope', async () => {
    transport.get
      .mockResolvedValueOnce({ data: { data: runWire() } })
      .mockResolvedValueOnce({ data: { data: receiptWire('attempts') } });
    const signal = new AbortController().signal;

    await getPayrollCalculationRun(ids.run, {
      contextScopeKey: 'tenant:7/pay-group:9',
      correlationId: ids.correlation,
      signal,
    });
    await getPayrollCalculationReceipt(ids.receipt, {
      contextScopeKey: 'tenant:7/pay-group:9',
      correlationId: ids.correlation,
    });

    expect(transport.get.mock.calls.map(([path]) => path)).toEqual([
      `/api/payroll/v1/runs/${ids.run}`,
      `/api/payroll/v1/command-receipts/${ids.receipt}`,
    ]);
    expect(transport.get.mock.calls[0][1]).toMatchObject({
      contextScopeKey: 'tenant:7/pay-group:9',
      signal,
      headers: {
        'X-Correlation-ID': ids.correlation,
      },
    });
    expect(transport.get.mock.calls[0][1].headers).not.toHaveProperty('X-Purpose-Code');
    expect(transport.get.mock.calls[1][1].headers).not.toHaveProperty('X-Purpose-Code');
  });

  it('posts calculate, approve and finalize using closed bodies and exact v41 headers', async () => {
    transport.post.mockImplementation((path: string) => {
      const kind = path.endsWith('/attempts')
        ? 'attempts'
        : path.endsWith('/approvals')
          ? 'approvals'
          : 'finalize';
      return Promise.resolve({ data: { data: receiptWire(kind) } });
    });

    await calculatePayrollRun(ids.run, { reasonCode: 'PAYROLL_CALCULATION' }, authority(false));
    await approvePayrollRun(ids.run, { reasonCode: 'PAYROLL_APPROVAL' }, authority(true));
    await finalizePayrollRun(
      ids.run,
      { reasonCode: 'PAYROLL_FINALIZATION', approvalReceiptId: ids.receipt },
      authority(true)
    );

    expect(transport.post.mock.calls.map(([path]) => path)).toEqual([
      `/api/payroll/v1/runs/${ids.run}/attempts`,
      `/api/payroll/v1/runs/${ids.run}/approvals`,
      `/api/payroll/v1/runs/${ids.run}/finalize`,
    ]);
    for (const [, body, config] of transport.post.mock.calls) {
      const headers = new Headers(config.headers);
      expect(headers.get('Idempotency-Key')).toBe(ids.idempotency);
      expect(headers.get('X-Correlation-ID')).toBe(ids.correlation);
      expect(headers.has('X-Purpose-Code')).toBe(false);
      expect(headers.get('X-DWP-Expected-Object-Version')).toBe('3');
      expect(headers.has('If-Match')).toBe(false);
      expect(headers.has('X-Step-Up-Session')).toBe(false);
      expect(headers.has('X-DWP-Tenant-ID')).toBe(false);
      expect(headers.has('X-DWP-User-ID')).toBe(false);
      expect(body).not.toHaveProperty('expectedVersion');
      expect(config.contextScopeKey).toBe('tenant:7/pay-group:9');
      expect(config.csrfReplay).toBe('NEVER');
    }
    expect(
      transport.post.mock.calls.map(([, , config]) =>
        new Headers(config.headers).get('X-DWP-Step-Up-Challenge')
      )
    ).toEqual([null, 'signed-payroll-run-command', 'signed-payroll-run-command']);
    expect(
      new Headers(transport.post.mock.calls[2][2].headers).get('X-DWP-Expected-Decision-Revision')
    ).toBe('decision-41');
  });

  it('preserves an uncertain receipt and fails closed on substituted response binding', async () => {
    transport.post.mockResolvedValueOnce({ data: { data: receiptWire('attempts') } });
    await expect(
      calculatePayrollRun(ids.run, { reasonCode: 'PAYROLL_CALCULATION' }, authority(false))
    ).resolves.toMatchObject({ status: 'RUNNING', receiptId: ids.receipt });

    transport.post.mockResolvedValueOnce({ data: { data: receiptWire('approvals') } });
    await expect(
      calculatePayrollRun(ids.run, { reasonCode: 'PAYROLL_CALCULATION' }, authority(false))
    ).rejects.toBeInstanceOf(PayrollCalculationCommandOutcomeUnknownError);
  });

  it('marks an unverifiable first command response unknown only after transport dispatch', async () => {
    transport.post.mockResolvedValueOnce({ data: { data: receiptWire('approvals') } });

    await expect(
      calculatePayrollRun(ids.run, { reasonCode: 'PAYROLL_CALCULATION' }, authority(false))
    ).rejects.toBeInstanceOf(PayrollCalculationCommandOutcomeUnknownError);
    expect(transport.post).toHaveBeenCalledTimes(1);
  });

  it('rejects mismatched command authority before transport', async () => {
    await expect(
      approvePayrollRun(
        ids.run,
        { reasonCode: 'PAYROLL_APPROVAL' },
        {
          ...authority(true),
          idempotencyKey: '20000000-0000-4000-8000-000000000099',
        }
      )
    ).rejects.toThrow(/does not match/);
    await expect(
      finalizePayrollRun(
        ids.run,
        { reasonCode: 'PAYROLL_FINALIZATION' },
        {
          governance: { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' },
          idempotencyKey: ids.idempotency,
          correlationId: ids.correlation,
          expectedObjectVersion: 3,
        }
      )
    ).rejects.toThrow(/requires step-up/);
    expect(transport.post).not.toHaveBeenCalled();
  });
});
