import { describe, expect, it } from 'vitest';

import {
  PAYROLL_SELF_SERVICE_CONTRACT,
  buildPayrollSelfServiceModel,
  normalizePayrollStatementAvailability,
  toPayrollStatementModel,
} from './payroll-self-service-model';

import type { PayrollStatementSource, PayrollWorkspaceSource } from './payroll-self-service-model';

function workspace(overrides: Partial<PayrollWorkspaceSource> = {}): PayrollWorkspaceSource {
  return {
    nextCycle: {
      payCycleId: 'cycle-1',
      name: 'September payroll',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      payDate: '2026-09-25',
      status: 'OPEN',
      timeValidated: true,
      absenceValidated: false,
      sourceConfirmed: true,
      dataOrigin: 'SOURCE',
    },
    statements: [],
    monetaryDataRedacted: true,
    ...overrides,
  };
}

function statement(overrides: Partial<PayrollStatementSource> = {}): PayrollStatementSource {
  return {
    statementId: 'statement-1',
    periodLabel: 'August 2026',
    availabilityState: 'AVAILABLE',
    publishedAt: '2026-08-25T00:00:00Z',
    downloadable: true,
    ...overrides,
  };
}

describe('PAYROLL_SELF_SERVICE_CONTRACT', () => {
  it('keeps the personal pay anchor outside payroll calculation and payment execution', () => {
    expect(PAYROLL_SELF_SERVICE_CONTRACT).toMatchObject({
      route: '/hr/pay',
      primaryUser: 'EMPLOYEE',
      primaryAction: 'DOWNLOAD_AVAILABLE_SOURCE_STATEMENT',
      calculatesPayroll: false,
      confirmsPayroll: false,
      initiatesPayment: false,
      displaysMonetaryValues: false,
    });
  });
});

describe('buildPayrollSelfServiceModel', () => {
  it('exposes reference provenance, source confirmation and redaction without inventing values', () => {
    const model = buildPayrollSelfServiceModel(
      workspace({
        nextCycle: {
          ...workspace().nextCycle!,
          dataOrigin: 'REFERENCE',
          sourceConfirmed: false,
        },
        monetaryDataRedacted: false,
      })
    );

    expect(model).toMatchObject({
      dataOrigin: 'REFERENCE',
      containsReferenceData: true,
      sourceConfirmed: false,
      monetaryDataRedacted: false,
    });
  });

  it('reports an empty anchor only when neither cycle nor statement exists', () => {
    expect(buildPayrollSelfServiceModel(workspace({ nextCycle: null })).empty).toBe(true);
    expect(
      buildPayrollSelfServiceModel(workspace({ nextCycle: null, statements: [statement()] })).empty
    ).toBe(false);
  });

  it('projects only declared cycle fields and does not retain source objects or sensitive extras', () => {
    const source = workspace();
    const cycle = { ...source.nextCycle!, bankAccount: 'must-not-reach-ui', grossAmount: 12345 };
    const model = buildPayrollSelfServiceModel({ ...source, nextCycle: cycle });

    expect(model.nextCycle).not.toBe(cycle);
    expect(model.nextCycle).toEqual(source.nextCycle);
    expect(model.nextCycle).not.toHaveProperty('bankAccount');
    expect(model.nextCycle).not.toHaveProperty('grossAmount');
    cycle.name = 'Changed source after projection';
    expect(model.nextCycle?.name).toBe('September payroll');
  });

  it.each([
    ['monetaryDataRedacted', 'false'],
    ['statements', null],
    ['statements', {}],
    ['nextCycle', false],
  ])('rejects malformed workspace field %s=%j before projection', (field, value) => {
    const source = { ...workspace(), [field]: value } as unknown as PayrollWorkspaceSource;
    expect(() => buildPayrollSelfServiceModel(source)).toThrow(/Invalid payroll source/);
  });

  it.each([
    ['payCycleId', ''],
    ['payCycleId', ' cycle-1'],
    ['payCycleId', 'cycle\n1'],
    ['name', { secret: 'must-not-reach-ui' }],
    ['status', 1],
    ['timeValidated', 'false'],
    ['absenceValidated', 0],
    ['sourceConfirmed', {}],
    ['dataOrigin', 'CUSTOM'],
    ['periodStart', '2026-02-30'],
    ['periodEnd', '2026-13-01'],
    ['payDate', 'not-a-date'],
  ])('rejects malformed cycle field %s=%j before projection', (field, value) => {
    const source = workspace({
      nextCycle: { ...workspace().nextCycle!, [field]: value },
    } as unknown as Partial<PayrollWorkspaceSource>);
    expect(() => buildPayrollSelfServiceModel(source)).toThrow(/Invalid payroll source/);
  });

  it('rejects reversed periods, sparse lists and colliding statement identities', () => {
    expect(() =>
      buildPayrollSelfServiceModel(
        workspace({
          nextCycle: {
            ...workspace().nextCycle!,
            periodStart: '2026-10-01',
          },
        })
      )
    ).toThrow(/Invalid payroll source/);
    expect(() => buildPayrollSelfServiceModel(workspace({ statements: new Array(1) }))).toThrow(
      /Invalid payroll source/
    );
    expect(() =>
      buildPayrollSelfServiceModel(workspace({ statements: [statement(), statement()] }))
    ).toThrow(/Invalid payroll source/);
  });

  it('does not echo rejected source values or accept nested source references', () => {
    const source = workspace({
      nextCycle: {
        ...workspace().nextCycle!,
        name: { secret: 'sensitive-value' },
      },
    } as unknown as Partial<PayrollWorkspaceSource>);
    expect(() => buildPayrollSelfServiceModel(source)).toThrow(
      'Invalid payroll source: nextCycle.name'
    );
    expect(() => buildPayrollSelfServiceModel(source)).not.toThrow(/sensitive-value/);
  });
});

describe('pay statement availability', () => {
  it.each([
    [' available ', 'AVAILABLE'],
    ['PENDING', 'PENDING'],
    ['withheld', 'WITHHELD'],
    ['RETIRED', 'RETIRED'],
    ['PUBLISHED', 'UNKNOWN'],
    ['', 'UNKNOWN'],
  ] as const)('normalizes %j conservatively to %s', (source, expected) => {
    expect(normalizePayrollStatementAvailability(source)).toBe(expected);
  });

  it('requires both AVAILABLE state and the source download flag', () => {
    expect(toPayrollStatementModel(statement()).access).toBe('DOWNLOADABLE');
    expect(toPayrollStatementModel(statement({ downloadable: false })).access).toBe(
      'DOWNLOAD_NOT_GRANTED'
    );
    expect(
      toPayrollStatementModel(statement({ availabilityState: 'WITHHELD', downloadable: true }))
    ).toMatchObject({
      availability: 'WITHHELD',
      sourceAvailability: 'WITHHELD',
      sourceDownloadable: false,
      access: 'NOT_AVAILABLE',
    });
  });

  it('preserves an unknown source value for truthful display', () => {
    expect(
      toPayrollStatementModel(statement({ availabilityState: 'SOURCE_DELAYED' }))
    ).toMatchObject({
      availability: 'UNKNOWN',
      sourceAvailability: 'SOURCE_DELAYED',
      sourceDownloadable: false,
    });
  });

  it.each([
    ['statementId', ''],
    ['statementId', ' statement-1'],
    ['periodLabel', {}],
    ['availabilityState', 7],
    ['downloadable', 'false'],
    ['downloadable', 1],
    ['publishedAt', '2026-02-30T00:00:00Z'],
    ['publishedAt', '2026-08-25'],
    ['publishedAt', '2026-08-25T24:00:00Z'],
  ])('rejects malformed statement field %s=%j without coercion', (field, value) => {
    const source = { ...statement(), [field]: value } as unknown as PayrollStatementSource;
    expect(() => toPayrollStatementModel(source)).toThrow(/Invalid payroll source/);
  });

  it('accepts calendar-valid leap dates, explicit offsets and fractional publication instants', () => {
    expect(
      buildPayrollSelfServiceModel(
        workspace({
          nextCycle: {
            ...workspace().nextCycle!,
            periodStart: '2024-02-01',
            periodEnd: '2024-02-29',
            payDate: '2024-02-15',
          },
        })
      ).nextCycle?.periodEnd
    ).toBe('2024-02-29');
    expect(
      toPayrollStatementModel(
        statement({
          publishedAt: '2026-08-25T09:30:00.123456789+09:00',
        })
      ).publishedAt
    ).toBe('2026-08-25T09:30:00.123456789+09:00');
    expect(toPayrollStatementModel(statement({ publishedAt: null })).publishedAt).toBeNull();
    expect(toPayrollStatementModel(statement({ publishedAt: undefined })).publishedAt).toBeNull();
  });

  it('rejects non-string availability through its public normalizer', () => {
    expect(() => normalizePayrollStatementAvailability(7 as unknown as string)).toThrow(
      /Invalid payroll source/
    );
  });
});
