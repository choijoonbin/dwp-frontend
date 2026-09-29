export const FIXTURE_IDS = Object.freeze({
  configuration: '10000000-0000-4000-8000-000000000001',
  legalEntity: '10000000-0000-4000-8000-000000000002',
  payrollGroup: '10000000-0000-4000-8000-000000000003',
  calendar: '10000000-0000-4000-8000-000000000004',
  dependency: '10000000-0000-4000-8000-000000000005',
  simulation: '10000000-0000-4000-8000-000000000006',
  command: '10000000-0000-4000-8000-000000000007',
});

export function foundationWire(overrides: Record<string, unknown> = {}) {
  return {
    configurationId: FIXTURE_IDS.configuration,
    version: 3,
    status: 'SIMULATED',
    definition: {
      legalEntity: {
        id: FIXTURE_IDS.legalEntity,
        code: 'SYNTHETIC-ENTITY',
        displayName: 'Synthetic Payroll Entity',
        countryPack: {
          packId: 'SYNTHETIC-PACK',
          version: 2,
          digest: 'a'.repeat(64),
        },
      },
      payrollGroup: {
        id: FIXTURE_IDS.payrollGroup,
        code: 'SYNTHETIC-GROUP',
        legalEntityId: FIXTURE_IDS.legalEntity,
        currencies: ['XTS', 'XUA'],
        settlementCurrency: 'XTS',
      },
      payCalendar: {
        id: FIXTURE_IDS.calendar,
        payrollGroupId: FIXTURE_IDS.payrollGroup,
        cadence: 'CUSTOM',
        periods: [
          {
            code: 'SYNTHETIC-PERIOD-A',
            startsOn: '2026-10-01',
            endsOn: '2026-10-15',
            paymentDate: '2026-10-18',
          },
          {
            code: 'SYNTHETIC-PERIOD-B',
            startsOn: '2026-10-16',
            endsOn: '2026-10-31',
            paymentDate: '2026-11-03',
          },
        ],
      },
      effectivePeriod: { startsOn: '2026-10-01', endsOn: null },
      roundingPolicies: {
        XTS: { scale: 2, mode: 'HALF_EVEN', increment: '0.01' },
        XUA: { scale: 4, mode: 'HALF_UP', increment: '0.0001' },
      },
      dependencies: [{ owner: 'SYNTHETIC-OWNER', resourceId: FIXTURE_IDS.dependency, version: 7 }],
    },
    authorId: 101,
    publisherId: null,
    createdAt: '2026-09-17T01:00:00Z',
    updatedAt: '2026-09-17T02:00:00Z',
    simulation: {
      simulationId: FIXTURE_IDS.simulation,
      configurationVersion: 3,
      definitionDigest: 'b'.repeat(64),
      dependencyDigest: 'c'.repeat(64),
      successful: true,
      findings: [],
      simulatedAt: '2026-09-17T02:00:00Z',
      simulatedBy: 102,
    },
    lastCommandId: FIXTURE_IDS.command,
    access: {
      canCreate: true,
      canEdit: true,
      canSimulate: true,
      canPublish: true,
      canReverse: false,
      canReconcile: true,
      publishDenialCode: null,
    },
    freshness: {
      state: 'LIVE',
      lastSuccessfulRefreshAt: '2026-09-17T02:00:00Z',
    },
    ...overrides,
  };
}

export function receiptWire(overrides: Record<string, unknown> = {}) {
  return {
    commandId: FIXTURE_IDS.command,
    commandType: 'SIMULATE',
    status: 'SUCCEEDED',
    configurationId: FIXTURE_IDS.configuration,
    resultVersion: 3,
    reversalOfCommandId: null,
    failureCode: null,
    correlationId: 'synthetic-correlation',
    createdAt: '2026-09-17T02:00:00Z',
    completedAt: '2026-09-17T02:00:01Z',
    ...overrides,
  };
}

export function mutationWire(overrides: Record<string, unknown> = {}) {
  return {
    receipt: receiptWire(),
    configuration: foundationWire(),
    ...overrides,
  };
}

export function workspaceWire(overrides: Record<string, unknown> = {}) {
  return {
    configurations: [foundationWire()],
    access: foundationWire().access,
    partialFailures: [],
    ...overrides,
  };
}
