import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils/axios-instance', () => ({
  axiosInstance: { get: runtime.get, post: runtime.post },
}));

import {
  PAYROLL_CONFIGURATION_WORKBENCH_PATH,
  PAYROLL_ELEMENT_FORMULA_OPERATION_BINDINGS,
  createPayrollElementVersion,
  createPayrollFormulaVersion,
  publishPayrollFormula,
  readPayrollConfigurationWorkbench,
  simulatePayrollFormula,
  validatePayrollFormula,
} from './payroll-element-formula-api';
import { selectPayFormulaAst } from '../model/payroll-element-formula-model';
import {
  PAY006_IDS,
  commandReceiptWire,
  formulaAstWire,
  workbenchWire,
} from '../testing/payroll-element-formula-fixtures.test-support';

const scope = 'tenant:42/payroll-configuration';

function commandAuthority(
  expectedObjectVersion: number | undefined,
  overrides: Partial<ProductSurfaceGovernedMutationAuthority> = {}
) {
  const governance: ProductSurfaceGovernedMutationAuthority = {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: 'decision-11',
    contextKey: 'hcm.management.payroll-configuration',
    contextScopeKey: scope,
    idempotencyKey: PAY006_IDS.command,
    ...(expectedObjectVersion === undefined ? {} : { objectVersion: expectedObjectVersion }),
    ...(expectedObjectVersion === undefined
      ? {}
      : {
          stepUp: {
            challenge: 'signed-payroll-publication',
            challengeId: 'challenge-pay-006',
            decisionRevision: 'decision-11',
            expiresAt: '2099-01-01T00:00:00Z',
          },
        }),
    ...overrides,
  };
  return {
    governance,
    idempotencyKey: PAY006_IDS.command,
    correlationId: PAY006_IDS.correlation,
    expectedObjectVersion,
  };
}

const elementRequest = {
  legalEntityId: PAY006_IDS.legalEntity,
  payrollGroupId: PAY006_IDS.payrollGroup,
  elementCode: 'BASE_PAY',
  displayName: 'Base pay',
  valueType: 'MONEY' as const,
  currency: 'XTS',
  rounding: { scale: 2, mode: 'HALF_EVEN' as const, increment: '0.01' },
  effectiveFrom: '2026-10-01',
};

const formulaRequest = {
  legalEntityId: PAY006_IDS.legalEntity,
  payrollGroupId: PAY006_IDS.payrollGroup,
  formulaCode: 'BASE_PAY',
  displayName: 'Base pay',
  effectiveFrom: '2026-10-01',
  goldenTestDigest: 'f'.repeat(64),
  ast: selectPayFormulaAst(formulaAstWire()),
};

describe('PAY-006 owner API', () => {
  beforeEach(() => {
    runtime.get.mockReset();
    runtime.post.mockReset();
  });

  it('pins IAQ-055 and PEP-PAY-004..008 to their exact gateway paths and permissions', () => {
    expect(PAYROLL_ELEMENT_FORMULA_OPERATION_BINDINGS).toEqual([
      expect.objectContaining({
        contract: 'IAQ-055',
        permission: 'hcm.configuration.workbench.view',
      }),
      expect.objectContaining({
        contract: 'PEP-PAY-004',
        path: '/api/payroll/v1/elements/versions',
      }),
      expect.objectContaining({
        contract: 'PEP-PAY-005',
        path: '/api/payroll/v1/formulas/versions',
      }),
      expect.objectContaining({
        contract: 'PEP-PAY-006',
        path: '/api/payroll/v1/formulas/{formulaId}/validations',
      }),
      expect.objectContaining({
        contract: 'PEP-PAY-007',
        path: '/api/payroll/v1/formulas/{formulaId}/simulations',
      }),
      expect.objectContaining({
        contract: 'PEP-PAY-008',
        permission: 'hcm.configuration.policy.publish',
        path: '/api/payroll/v1/formulas/{formulaId}/publish',
      }),
    ]);
  });

  it('reads IAQ-055 with bounded filter/sort, locale, time zone, correlation and scope', async () => {
    runtime.get.mockResolvedValue({ data: { data: workbenchWire() } });
    const signal = new AbortController().signal;

    await expect(
      readPayrollConfigurationWorkbench(
        {
          limit: 25,
          policyVersion: {
            policyKeys: ['pay.formula.base-pay', 'pay.formula.overtime'],
            minimumRevision: 2,
          },
          payrollPolicy: { policyKeys: ['pay.policy.standard', 'pay.policy.hourly'] },
          effectiveStatus: { codes: ['VALIDATED', 'PUBLISHED'], minimumRevision: 1 },
          effectiveOn: '2026-10-13',
          sort: ['policyVersion:DESC', 'itemPublicId:ASC'],
          locale: 'ko-KR',
          timeZone: 'Asia/Seoul',
          correlationId: PAY006_IDS.correlation,
        },
        { contextScopeKey: scope, signal }
      )
    ).resolves.toMatchObject({ variantKey: 'PAYROLL' });

    const requested = new URL(runtime.get.mock.calls[0][0], 'http://test.invalid');
    expect(requested.pathname).toBe(PAYROLL_CONFIGURATION_WORKBENCH_PATH);
    expect(requested.searchParams.getAll('sort')).toEqual([
      'policyVersion:DESC',
      'itemPublicId:ASC',
    ]);
    expect(requested.searchParams.get('correlationId')).toBe(PAY006_IDS.correlation);
    expect(requested.searchParams.getAll('filter.policyVersion.policyKeys')).toEqual([
      'pay.formula.base-pay',
      'pay.formula.overtime',
    ]);
    expect(requested.searchParams.getAll('filter.payrollPolicy.policyKeys')).toEqual([
      'pay.policy.standard',
      'pay.policy.hourly',
    ]);
    expect(requested.searchParams.getAll('filter.effectiveStatus.codes')).toEqual([
      'VALIDATED',
      'PUBLISHED',
    ]);
    expect(requested.searchParams.get('filter.effectiveOn')).toBe('2026-10-13');
    expect(runtime.get.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        contextScopeKey: scope,
        signal,
        headers: {
          'X-Correlation-ID': PAY006_IDS.correlation,
          'X-Purpose-Code': 'PAYROLL_CONFIGURATION',
        },
      })
    );
  });

  it('dispatches all five owner mutations with CAS, stable idempotency and no tenant headers', async () => {
    runtime.post.mockImplementation((path: string) => {
      const commandType = path.endsWith('/elements/versions')
        ? 'CREATE_ELEMENT_VERSION'
        : path.endsWith('/formulas/versions')
          ? 'CREATE_FORMULA_VERSION'
          : path.endsWith('/validations')
            ? 'VALIDATE_FORMULA'
            : path.endsWith('/simulations')
              ? 'SIMULATE_FORMULA'
              : 'PUBLISH_FORMULA';
      return Promise.resolve({ data: { data: commandReceiptWire(commandType) } });
    });

    await createPayrollElementVersion(elementRequest, commandAuthority(undefined));
    await createPayrollFormulaVersion(formulaRequest, commandAuthority(undefined));
    await validatePayrollFormula(PAY006_IDS.formula, { expectedVersion: 1 }, commandAuthority(1));
    await simulatePayrollFormula(
      PAY006_IDS.formula,
      {
        expectedVersion: 1,
        inputs: { basePay: { type: 'MONEY', value: '7500.00', currency: 'XTS' } },
        rounding: { scale: 2, mode: 'HALF_EVEN', increment: '0.01' },
        timeoutMillis: 250,
      },
      commandAuthority(1)
    );
    await publishPayrollFormula(PAY006_IDS.formula, { expectedVersion: 1 }, commandAuthority(1));

    expect(runtime.post.mock.calls.map(([path]) => path)).toEqual([
      '/api/payroll/v1/elements/versions',
      '/api/payroll/v1/formulas/versions',
      `/api/payroll/v1/formulas/${PAY006_IDS.formula}/validations`,
      `/api/payroll/v1/formulas/${PAY006_IDS.formula}/simulations`,
      `/api/payroll/v1/formulas/${PAY006_IDS.formula}/publish`,
    ]);
    for (const [, body, config] of runtime.post.mock.calls) {
      const headers = new Headers(config.headers);
      expect(headers.get('Idempotency-Key')).toBe(PAY006_IDS.command);
      expect(headers.get('X-Correlation-ID')).toBe(PAY006_IDS.correlation);
      expect(headers.get('X-Purpose-Code')).toBe('PAYROLL_CONFIGURATION');
      expect(headers.has('X-DWP-Tenant-ID')).toBe(false);
      expect(headers.has('X-DWP-User-ID')).toBe(false);
      expect(JSON.stringify(body)).not.toContain('tenantId');
      expect(config.contextScopeKey).toBe(scope);
      expect(config.csrfReplay).toBe('NEVER');
      expect(headers.has('If-Match')).toBe(false);
      expect(headers.has('X-Step-Up-Session')).toBe(false);
    }
    expect(
      runtime.post.mock.calls.map(([, , config]) =>
        new Headers(config.headers).get('X-DWP-Expected-Object-Version')
      )
    ).toEqual([null, null, '1', '1', '1']);
    expect(new Headers(runtime.post.mock.calls[4][2].headers)).toMatchObject(expect.any(Headers));
    expect(new Headers(runtime.post.mock.calls[4][2].headers).get('X-DWP-Step-Up-Challenge')).toBe(
      'signed-payroll-publication'
    );
  });

  it('rejects an IAQ query outside the canonical limit and sort bounds', async () => {
    await expect(
      readPayrollConfigurationWorkbench(
        {
          limit: 101,
          sort: [
            'policyVersion:ASC',
            'payrollPolicy:ASC',
            'effectiveStatus:ASC',
            'itemPublicId:ASC',
          ],
          correlationId: PAY006_IDS.correlation,
        },
        {}
      )
    ).rejects.toThrow('Payroll workbench query is invalid');
    expect(runtime.get).not.toHaveBeenCalled();
  });

  it('rejects substituted publish identity or object version before transport', async () => {
    await expect(
      publishPayrollFormula(
        PAY006_IDS.formula,
        { expectedVersion: 1 },
        {
          ...commandAuthority(1),
          idempotencyKey: '20000000-0000-4000-8000-000000000099',
        }
      )
    ).rejects.toThrow('does not match the command');
    await expect(
      publishPayrollFormula(
        PAY006_IDS.formula,
        { expectedVersion: 1 },
        commandAuthority(1, { objectVersion: 2 })
      )
    ).rejects.toThrow('does not match the command');
    expect(runtime.post).not.toHaveBeenCalled();
  });

  it('uses the same idempotency key for a caller-controlled replay', async () => {
    runtime.post.mockResolvedValue({ data: { data: commandReceiptWire('PUBLISH_FORMULA') } });
    const authority = commandAuthority(1);

    await publishPayrollFormula(PAY006_IDS.formula, { expectedVersion: 1 }, authority);
    await publishPayrollFormula(PAY006_IDS.formula, { expectedVersion: 1 }, authority);

    expect(
      runtime.post.mock.calls.map(([, , config]) =>
        new Headers(config.headers).get('Idempotency-Key')
      )
    ).toEqual([PAY006_IDS.command, PAY006_IDS.command]);
  });

  it('fails closed when a synchronous mutation receipt is not SUCCEEDED', async () => {
    runtime.post.mockResolvedValue({
      data: {
        data: commandReceiptWire('PUBLISH_FORMULA', { status: 'RESULT_UNKNOWN' }),
      },
    });

    await expect(
      publishPayrollFormula(PAY006_IDS.formula, { expectedVersion: 1 }, commandAuthority(1))
    ).rejects.toThrow(/receipt\.status\.RESULT_UNKNOWN/);
  });
});
