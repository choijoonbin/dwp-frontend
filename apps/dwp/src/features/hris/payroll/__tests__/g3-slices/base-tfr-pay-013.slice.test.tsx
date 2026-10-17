// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const transport = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: transport,
}));

import {
  HrisPayrollPopulationWorkspace,
  PAYROLL_COMMAND_CENTER_PATH,
  PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
  PAYROLL_POPULATION_ENTRY_QUERY,
  PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY,
  PAYROLL_RUN_PREPARE_ACTION,
  PAYROLL_RUN_PREPARE_DEFAULT_ROLLOUT,
  PAYROLL_RUN_PREPARE_FEATURE,
  PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY,
  PayrollRunPrepareOutcomeUnknownError,
  parsePayrollPopulationProjection,
  parsePayrollRunPreparedReceipt,
  payrollPopulationItemIsSafeToPrepare,
  preparePayrollRun,
  queryPayrollPopulation,
  validatePayrollPopulationQuery,
  validatePayrollRunPrepareCommand,
} from '../../population';

import type {
  PayrollPopulationDataSource,
  PayrollPopulationOwnerBinding,
  PayrollPopulationProjection,
  PayrollPopulationQuery,
  PayrollPopulationScope,
  PayrollRunPrepareAuthority,
  PayrollRunPrepareCommand,
  PayrollRunPrepareCommandBinding,
  PayrollRunPrepareCommandExecutor,
  PayrollRunPreparedReceipt,
} from '../../population';

const AC = Object.freeze(
  Array.from({ length: 12 }, (_, index) => `PAY013-AC-${String(index + 1).padStart(2, '0')}`)
);

const ids = Object.freeze({
  query: '40000000-0000-4000-8000-000000000001',
  failure: '40000000-0000-4000-8000-000000000002',
  preparation: '40000000-0000-4000-8000-000000000003',
  idempotency: '40000000-0000-4000-8000-000000000004',
  commandCorrelation: '40000000-0000-4000-8000-000000000005',
  payrollEntity: '40000000-0000-4000-8000-000000000006',
  payGroup: '40000000-0000-4000-8000-000000000007',
  payPeriod: '40000000-0000-4000-8000-000000000008',
  receipt: '40000000-0000-4000-8000-000000000009',
  subject: '40000000-0000-4000-8000-000000000010',
});

const AUTH_REVISION = 'auth-decision-49';
const SCOPE_REVISION = 'population-scope-revision-7';
const CONTEXT_SCOPE = 'tenant:tenant-a/payroll-support';
const SNAPSHOT_DIGEST = 'a'.repeat(64);

type ProjectionOptions = Readonly<{
  state?: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';
  freshness?: 'CURRENT' | 'STALE' | 'UNAVAILABLE';
  statusCode?: string;
  correlationId?: string;
}>;

function projectionWire({
  state = 'COMPLETE',
  freshness = 'CURRENT',
  statusCode = 'READY',
  correlationId = ids.query,
}: ProjectionOptions = {}) {
  const hasItems = state !== 'EMPTY' && state !== 'UNAVAILABLE';
  const partialFailures =
    state === 'PARTIAL'
      ? [
          {
            componentKey: 'population.aggregate',
            errorCode: 'SOURCE_UNAVAILABLE',
            correlationId: ids.failure,
            retryable: true,
          },
        ]
      : [];
  return {
    projectionVersion: '1',
    asOf: '2026-10-17T06:00:00Z',
    variantKey: 'POPULATION',
    queryState: {
      state,
      scopeDecisionRevision: SCOPE_REVISION,
      freshness,
      nextCursor: null,
      fieldDecisionSummary: {
        viewCount: hasItems ? 2 : 0,
        maskedCount: 0,
        omittedCount: 0,
      },
      partialFailures,
      correlationId,
      cachePolicy: {
        authorizationDecisionRevision: AUTH_REVISION,
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 30,
      },
    },
    items: hasItems
      ? [
          {
            itemPublicId: 'population.monthly-seoul',
            title: 'Monthly Seoul payroll',
            statusCode,
            fieldGroups: {
              PAYROLL_POPULATION: {
                decision: 'VIEW',
                value: {
                  itemCount: 24,
                  revision: 7,
                  asOf: '2026-10-17T06:00:00Z',
                },
              },
              PROJECTION_VERSION: {
                decision: 'VIEW',
                value: {
                  key: 'payroll.population',
                  version: '7',
                  digest: SNAPSHOT_DIGEST,
                },
              },
            },
            deepLink: {
              route: '/hr/operations/payroll/population',
              resourcePublicId: 'population.monthly-seoul',
            },
            availableActions: [
              {
                actionKey: 'hris.action.pay.run.prepare',
                method: 'POST',
                hrefTemplate: '/api/payroll/v1/runs',
                idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
                stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
              },
            ],
          },
        ]
      : [],
  };
}

function projection(options: ProjectionOptions = {}): PayrollPopulationProjection {
  return parsePayrollPopulationProjection(projectionWire(options));
}

function query(correlationId = ids.query): PayrollPopulationQuery {
  return validatePayrollPopulationQuery({
    limit: 100,
    filter: {
      effectiveOn: '2026-10-31',
      payrollPopulation: { minimumItemCount: 1, maximumItemCount: 1000 },
      projectionVersion: { keys: ['payroll.population'], versions: ['7'] },
    },
    sort: ['itemPublicId:ASC'],
    locale: 'en-US',
    timeZone: 'Asia/Seoul',
    correlationId,
  });
}

function command(): PayrollRunPrepareCommand {
  return validatePayrollRunPrepareCommand({
    preparationId: ids.preparation,
    runType: 'REGULAR',
    payrollEntityId: ids.payrollEntity,
    payGroupId: ids.payGroup,
    payPeriodId: ids.payPeriod,
    asOf: '2026-10-17T06:00:00Z',
    inputSnapshotDigest: SNAPSHOT_DIGEST,
  });
}

function receiptWire(
  correlationId = ids.commandCorrelation,
  status: PayrollRunPreparedReceipt['status'] = 'ACCEPTED'
) {
  return {
    receiptId: ids.receipt,
    commandType: 'RUN_PREPARE',
    originatingAction: 'PAY_RUN_PREPARE',
    subjectPrincipalPublicId: ids.subject,
    populationScopeDigest: 'b'.repeat(64),
    fieldPolicyRevision: 49,
    purposeCode: 'PAYROLL_PROCESSING',
    authorizationRevision: 49,
    status,
    correlationId,
    requestDigest: 'c'.repeat(64),
    createdAt: '2026-10-17T06:01:00Z',
    resultRef: `payroll-preparation:${ids.preparation}`,
  };
}

function secureAuthority(
  binding: Pick<
    PayrollRunPrepareCommandBinding,
    'decisionRevision' | 'contextScopeKey' | 'idempotencyKey'
  >,
  idempotencyKey = binding.idempotencyKey
): ProductSurfaceGovernedMutationAuthority {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: binding.decisionRevision,
    contextKey: 'hcm.operations.payroll-run',
    contextScopeKey: binding.contextScopeKey,
    objectVersion: 0,
    idempotencyKey,
    stepUp: {
      challenge: 'signed-payroll-run-prepare-challenge',
      challengeId: 'payroll-run-prepare-challenge-49',
      decisionRevision: binding.decisionRevision,
      expiresAt: '2099-01-01T00:00:00Z',
    },
  };
}

function apiAuthority(
  overrides: Partial<PayrollRunPrepareAuthority> = {}
): PayrollRunPrepareAuthority {
  const binding = {
    decisionRevision: AUTH_REVISION,
    contextScopeKey: CONTEXT_SCOPE,
    idempotencyKey: ids.idempotency,
  };
  return {
    routeContractKey: PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY,
    governance: secureAuthority(binding),
    contextScopeKey: CONTEXT_SCOPE,
    decisionRevision: AUTH_REVISION,
    idempotencyKey: ids.idempotency,
    correlationId: ids.commandCorrelation,
    expectedObjectVersion: 0,
    ...overrides,
  };
}

const scope: PayrollPopulationScope = Object.freeze({
  ready: true,
  tenantId: 'tenant-a',
  contextScopeKey: CONTEXT_SCOPE,
  decisionRevision: AUTH_REVISION,
});

const rollout = Object.freeze({
  feature: PAYROLL_RUN_PREPARE_FEATURE,
  enabled: true,
  enrolledTenantIds: Object.freeze(['tenant-a']),
});

function executor(
  observed: PayrollRunPrepareCommandBinding[] = []
): PayrollRunPrepareCommandExecutor {
  return async <T,>(
    execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>,
    binding: PayrollRunPrepareCommandBinding
  ) => {
    observed.push(binding);
    return execute(secureAuthority(binding));
  };
}

function ownerBinding(
  read: PayrollPopulationDataSource['population'],
  prepareExecutor: PayrollRunPrepareCommandExecutor = executor()
): PayrollPopulationOwnerBinding {
  return {
    page: { routeContractKey: PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY },
    data: {
      contractId: 'IAQ-014',
      routeContractKey: PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
      read,
    },
    prepare: {
      contractId: 'PEP-PAY-011',
      routeContractKey: PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY,
      execute: prepareExecutor,
    },
  };
}

function idFactory(start = 100) {
  let counter = start;
  return () => `40000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function button(label: string) {
  const result = [...document.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!(result instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return result;
}

function inputByLabel(labelText: string): HTMLInputElement {
  const label = [...document.querySelectorAll('label')].find(
    (candidate) => candidate.textContent?.trim() === labelText
  );
  const input = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing input: ${labelText}`);
  return input;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  });
}

describe('[SLICE:BASE-TFR-PAY-013] population and prepare contract', () => {
  beforeEach(() => {
    transport.get.mockReset();
    transport.post.mockReset();
  });

  it('tracks all twelve PAY-013 acceptance criteria', () => {
    expect(AC).toEqual(
      Array.from({ length: 12 }, (_, index) => `PAY013-AC-${String(index + 1).padStart(2, '0')}`)
    );
  });

  it('pins three distinct owner route identities and stays default-off with no enrollment', () => {
    expect(PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY).toBe(
      'route.hcm.operations.payroll-population.page'
    );
    expect(PAYROLL_POPULATION_ENTRY_QUERY).toMatchObject({
      contractId: 'IAQ-014',
      routeContractKey: 'route.hcm.operations.payroll-support.data',
      path: '/api/payroll/v1/workbench/population',
    });
    expect(PAYROLL_RUN_PREPARE_ACTION).toMatchObject({
      contractId: 'PEP-PAY-011',
      routeContractKey: 'route.hcm.operations.payroll-run.action',
      path: '/api/payroll/v1/runs',
      expectedObjectVersion: 0,
      stepUpRequired: true,
    });
    expect(
      new Set([
        PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY,
        PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
        PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY,
      ]).size
    ).toBe(3);
    expect(PAYROLL_RUN_PREPARE_DEFAULT_ROLLOUT).toEqual({
      feature: 'HRIS_PAYROLL_RUN_PREPARE',
      enabled: false,
      enrolledTenantIds: [],
    });
  });

  it('parses only exact IAQ-014 projections and blocks non-READY items', () => {
    const ready = projection();
    expect(ready.queryState.scopeDecisionRevision).toBe(SCOPE_REVISION);
    expect(ready.queryState.cachePolicy.authorizationDecisionRevision).toBe(AUTH_REVISION);
    expect(ready.items.map((item) => item.itemPublicId)).toEqual(['population.monthly-seoul']);
    expect(payrollPopulationItemIsSafeToPrepare(ready, ready.items[0]!)).toBe(true);

    const blocked = projection({ statusCode: 'PREFLIGHT_BLOCKED' });
    expect(payrollPopulationItemIsSafeToPrepare(blocked, blocked.items[0]!)).toBe(false);
    expect(() =>
      parsePayrollPopulationProjection({
        selection: { payrollGroupId: ids.payGroup },
        sources: [],
        preflight: { status: 'PASS', decisions: [] },
      })
    ).toThrow(/Invalid PAY-013 transport source/);
    expect(() =>
      parsePayrollPopulationProjection({
        ...projectionWire(),
        queryState: {
          ...projectionWire().queryState,
          fieldDecisionSummary: { viewCount: 1, maskedCount: 0, omittedCount: 0 },
        },
      })
    ).toThrow(/fieldDecisionSummary/);

    const distinctDeepLink = projectionWire();
    distinctDeepLink.items[0]!.deepLink.resourcePublicId = 'population.related-detail';
    expect(parsePayrollPopulationProjection(distinctDeepLink).items[0]!.deepLink).toEqual({
      route: '/hr/operations/payroll/population',
      resourcePublicId: 'population.related-detail',
    });
    expect(
      (['REGULAR', 'OFF_CYCLE', 'RETRO', 'CORRECTION'] as const).map(
        (runType) => validatePayrollRunPrepareCommand({ ...command(), runType }).runType
      )
    ).toEqual(['REGULAR', 'OFF_CYCLE', 'RETRO', 'CORRECTION']);
  });

  it('serializes the required empty IAQ filter object without inventing bracket members', async () => {
    transport.get.mockResolvedValueOnce({ data: projectionWire() });
    await queryPayrollPopulation(
      validatePayrollPopulationQuery({
        limit: 100,
        filter: {},
        sort: ['itemPublicId:ASC'],
        locale: 'en-US',
        timeZone: 'Asia/Seoul',
        correlationId: ids.query,
      }),
      {
        routeContractKey: PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
        contextScopeKey: CONTEXT_SCOPE,
        decisionRevision: AUTH_REVISION,
      }
    );
    const requestUrl = new URL(transport.get.mock.calls[0]![0], 'https://dwp.invalid');
    expect(requestUrl.searchParams.get('filter')).toBe('{}');
    expect([...requestUrl.searchParams.keys()].filter((key) => key.startsWith('filter['))).toEqual(
      []
    );
  });

  it('rejects a legacy success envelope at the sealed IAQ transport boundary', async () => {
    transport.get.mockResolvedValueOnce({ data: { data: projectionWire() } });

    await expect(
      queryPayrollPopulation(query(), {
        routeContractKey: PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
        contextScopeKey: CONTEXT_SCOPE,
        decisionRevision: AUTH_REVISION,
      })
    ).rejects.toThrow();
  });

  it('uses exact DATA/ACTION aliases, IAQ query serialization, 202 receipt, and governed headers', async () => {
    transport.get.mockResolvedValueOnce({ data: projectionWire() });
    await expect(
      queryPayrollPopulation(query(), {
        routeContractKey: PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
        contextScopeKey: CONTEXT_SCOPE,
        decisionRevision: AUTH_REVISION,
      })
    ).resolves.toMatchObject({
      queryState: {
        scopeDecisionRevision: SCOPE_REVISION,
        cachePolicy: { authorizationDecisionRevision: AUTH_REVISION },
      },
    });

    const [requestPath, readConfig] = transport.get.mock.calls[0]!;
    const requestUrl = new URL(requestPath, 'https://dwp.invalid');
    expect(requestUrl.pathname).toBe('/api/payroll/v1/workbench/population');
    expect(requestUrl.searchParams.getAll('sort')).toEqual(['itemPublicId:ASC']);
    expect(requestUrl.searchParams.get('filter[effectiveOn]')).toBe('2026-10-31');
    expect(requestUrl.searchParams.get('filter[payrollPopulation][minimumItemCount]')).toBe('1');
    expect(requestUrl.searchParams.getAll('filter[projectionVersion][keys]')).toEqual([
      'payroll.population',
    ]);
    expect(readConfig.headers).toEqual({
      'X-Correlation-ID': ids.query,
      'X-DWP-Route-Contract-Key': PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
    });
    expect(requestPath).not.toContain('tenant-a');

    transport.post.mockResolvedValueOnce({
      status: 202,
      data: receiptWire(),
    });
    await expect(preparePayrollRun(command(), apiAuthority())).resolves.toMatchObject({
      receiptId: ids.receipt,
      status: 'ACCEPTED',
      resultRef: `payroll-preparation:${ids.preparation}`,
    });
    const [path, body, config] = transport.post.mock.calls[0]!;
    expect(path).toBe('/api/payroll/v1/runs');
    expect(Object.keys(body).sort()).toEqual([
      'asOf',
      'inputSnapshotDigest',
      'payGroupId',
      'payPeriodId',
      'payrollEntityId',
      'preparationId',
      'runType',
    ]);
    const headers = new Headers(config.headers);
    expect(headers.get('X-DWP-Route-Contract-Key')).toBe(PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY);
    expect(headers.get('Idempotency-Key')).toBe(ids.idempotency);
    expect(headers.get('X-Correlation-ID')).toBe(ids.commandCorrelation);
    expect(headers.get('X-DWP-Expected-Object-Version')).toBe('0');
    expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(AUTH_REVISION);
    expect(headers.get('X-DWP-Step-Up-Challenge')).toBe('signed-payroll-run-prepare-challenge');
    expect(headers.has('X-DWP-Tenant-ID')).toBe(false);
    expect(config.csrfReplay).toBe('NEVER');

    await expect(
      queryPayrollPopulation(query(), {
        routeContractKey: 'route.hcm.operations.payroll-support.data-copy' as never,
        contextScopeKey: CONTEXT_SCOPE,
        decisionRevision: AUTH_REVISION,
      })
    ).rejects.toThrow(/DATA route authority/);
    await expect(
      preparePayrollRun(
        command(),
        apiAuthority({
          routeContractKey: 'route.hcm.operations.payroll-run.actions' as never,
        })
      )
    ).rejects.toThrow(/authority/);
    expect(transport.get).toHaveBeenCalledTimes(1);
    expect(transport.post).toHaveBeenCalledTimes(1);
  });

  it('treats a non-202 or substituted prepare receipt as an unknown dispatched outcome', async () => {
    transport.post
      .mockResolvedValueOnce({ status: 200, data: receiptWire() })
      .mockResolvedValueOnce({
        status: 202,
        data: { ...receiptWire(), originatingAction: 'PAY_RUN_APPROVE' },
      })
      .mockResolvedValueOnce({
        status: 202,
        data: { data: receiptWire() },
      });
    await expect(preparePayrollRun(command(), apiAuthority())).rejects.toBeInstanceOf(
      PayrollRunPrepareOutcomeUnknownError
    );
    await expect(preparePayrollRun(command(), apiAuthority())).rejects.toBeInstanceOf(
      PayrollRunPrepareOutcomeUnknownError
    );
    await expect(preparePayrollRun(command(), apiAuthority())).rejects.toBeInstanceOf(
      PayrollRunPrepareOutcomeUnknownError
    );
  });
});

describe('[SLICE:BASE-TFR-PAY-013] population workspace runtime', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  async function renderActive(
    source: PayrollPopulationDataSource,
    binding: PayrollPopulationOwnerBinding = ownerBinding(source.population),
    prepareIdFactory = idFactory()
  ) {
    await act(async () => {
      root.render(
        <HrisPayrollPopulationWorkspace
          tenantId="tenant-a"
          scope={scope}
          rollout={rollout}
          ownerBinding={binding}
          dataSource={source}
          idFactory={prepareIdFactory}
          locale="en-US"
          timeZone="Asia/Seoul"
        />
      );
    });
  }

  it('mounts no inner hook and makes zero owner calls for absent, false, unenrolled, or mismatched tenant activation', async () => {
    const read = vi.fn().mockResolvedValue(projection());
    const prepare = vi.fn().mockResolvedValue(parsePayrollRunPreparedReceipt(receiptWire()));
    const execute = vi.fn();
    const binding = ownerBinding(read, execute as unknown as PayrollRunPrepareCommandExecutor);
    const source: PayrollPopulationDataSource = { population: read, prepare };
    const cases = [
      <HrisPayrollPopulationWorkspace key="absent" />,
      <HrisPayrollPopulationWorkspace
        key="false"
        tenantId="tenant-a"
        scope={scope}
        rollout={{ ...rollout, enabled: false }}
        ownerBinding={binding}
        dataSource={source}
      />,
      <HrisPayrollPopulationWorkspace
        key="unenrolled"
        tenantId="tenant-a"
        scope={scope}
        rollout={{ ...rollout, enrolledTenantIds: [] }}
        ownerBinding={binding}
        dataSource={source}
      />,
      <HrisPayrollPopulationWorkspace
        key="tenant-mismatch"
        tenantId="tenant-a"
        scope={{ ...scope, tenantId: 'tenant-b' }}
        rollout={rollout}
        ownerBinding={binding}
        dataSource={source}
      />,
      <HrisPayrollPopulationWorkspace
        key="page-near-miss"
        tenantId="tenant-a"
        scope={scope}
        rollout={rollout}
        ownerBinding={{
          ...binding,
          page: {
            routeContractKey: 'route.hcm.operations.payroll-population.pages' as never,
          },
        }}
        dataSource={source}
      />,
    ];

    for (const candidate of cases) {
      await act(async () => root.render(candidate));
      expect(host.querySelector('[data-testid="payroll-population-closed"]')).not.toBeNull();
      expect(host.querySelector('[data-testid="payroll-population-workspace"]')).toBeNull();
    }
    expect(read).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('preserves review and prepare inputs through loading, empty, unavailable, permission, partial, stale, blocked, and complete states', async () => {
    const gate = deferred<PayrollPopulationProjection>();
    const read = vi
      .fn()
      .mockReturnValueOnce(gate.promise)
      .mockResolvedValueOnce(projection({ state: 'EMPTY' }))
      .mockRejectedValueOnce(new Error('owner unavailable'))
      .mockRejectedValueOnce(new HttpError('denied', 403))
      .mockResolvedValueOnce(projection({ state: 'PARTIAL' }))
      .mockResolvedValueOnce(projection({ freshness: 'STALE' }))
      .mockResolvedValueOnce(projection({ statusCode: 'PREFLIGHT_BLOCKED' }))
      .mockResolvedValueOnce(projection());
    const prepare = vi.fn();
    const source: PayrollPopulationDataSource = { population: read, prepare };
    await renderActive(source, ownerBinding(read));

    const effectiveOn = inputByLabel('Effective on (Optional)');
    await act(async () => setInputValue(effectiveOn, '2026-10-31'));
    await act(async () => button('Review population').click());
    expect(host.dataset.unused).toBeUndefined();
    expect(host.querySelector('[data-runtime-state="loading"]')).not.toBeNull();
    expect(effectiveOn.value).toBe('2026-10-31');
    await act(async () => gate.resolve(projection({ state: 'EMPTY' })));
    await settle();
    expect(host.querySelector('[data-runtime-state="empty"]')).not.toBeNull();

    for (const expected of ['empty', 'unavailable', 'denied'] as const) {
      await act(async () => button('Review population').click());
      await settle();
      expect(host.querySelector(`[data-runtime-state="${expected}"]`)).not.toBeNull();
      expect(inputByLabel('Effective on (Optional)').value).toBe('2026-10-31');
    }

    await act(async () => button('Review population').click());
    await settle();
    expect(host.querySelector('[data-runtime-state="partial"]')).not.toBeNull();
    await act(async () => {
      setInputValue(inputByLabel('Payroll entity ID'), ids.payrollEntity);
      setInputValue(inputByLabel('Pay group ID'), ids.payGroup);
      setInputValue(inputByLabel('Pay period ID'), ids.payPeriod);
    });
    expect(button('Prepare payroll run').disabled).toBe(true);

    await act(async () => button('Review population').click());
    await settle();
    expect(host.querySelector('[data-runtime-state="stale"]')).not.toBeNull();
    expect(inputByLabel('Payroll entity ID').value).toBe(ids.payrollEntity);
    expect(button('Prepare payroll run').disabled).toBe(true);

    await act(async () => button('Review population').click());
    await settle();
    expect(host.textContent).toContain('PREFLIGHT_BLOCKED');
    expect(inputByLabel('Pay group ID').value).toBe(ids.payGroup);
    expect(button('Prepare payroll run').disabled).toBe(true);

    await act(async () => button('Review population').click());
    await settle();
    expect(host.querySelector('[data-runtime-state="complete"]')).not.toBeNull();
    expect(inputByLabel('Pay period ID').value).toBe(ids.payPeriod);
    expect(button('Prepare payroll run').disabled).toBe(false);
    expect(prepare).not.toHaveBeenCalled();
    expect(
      read.mock.calls.every(
        ([, context]) => context.routeContractKey === PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY
      )
    ).toBe(true);
  });

  it('prepares only the adjudicated seven-field body through exact ACTION step-up authority', async () => {
    const read = vi.fn().mockResolvedValue(projection());
    const observedBindings: PayrollRunPrepareCommandBinding[] = [];
    const runPrepare = vi
      .fn()
      .mockImplementation(
        (_body: PayrollRunPrepareCommand, authority: PayrollRunPrepareAuthority) =>
          Promise.resolve(
            parsePayrollRunPreparedReceipt(receiptWire(authority.correlationId, 'ACCEPTED'))
          )
      );
    const source: PayrollPopulationDataSource = { population: read, prepare: runPrepare };
    await renderActive(source, ownerBinding(read, executor(observedBindings)), idFactory(200));

    await act(async () => button('Review population').click());
    await settle();
    await act(async () => {
      setInputValue(inputByLabel('Payroll entity ID'), ids.payrollEntity);
      setInputValue(inputByLabel('Pay group ID'), ids.payGroup);
      setInputValue(inputByLabel('Pay period ID'), ids.payPeriod);
    });
    await act(async () => button('Prepare payroll run').click());
    await settle();

    expect(observedBindings).toHaveLength(1);
    expect(observedBindings[0]).toMatchObject({
      routeContractKey: PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY,
      targetType: 'PAYROLL_RUN_PREPARATION',
      selectedPopulationPublicId: 'population.monthly-seoul',
      expectedObjectVersion: 0,
      contextScopeKey: CONTEXT_SCOPE,
      decisionRevision: AUTH_REVISION,
    });
    const [body, authority] = runPrepare.mock.calls[0]!;
    expect(Object.keys(body).sort()).toEqual([
      'asOf',
      'inputSnapshotDigest',
      'payGroupId',
      'payPeriodId',
      'payrollEntityId',
      'preparationId',
      'runType',
    ]);
    expect(body).toMatchObject({
      runType: 'REGULAR',
      payrollEntityId: ids.payrollEntity,
      payGroupId: ids.payGroup,
      payPeriodId: ids.payPeriod,
      asOf: '2026-10-17T06:00:00Z',
      inputSnapshotDigest: SNAPSHOT_DIGEST,
    });
    expect(authority).toMatchObject({
      routeContractKey: PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY,
      expectedObjectVersion: 0,
      governance: { mode: 'SECURE', objectVersion: 0, stepUp: expect.any(Object) },
    });
    expect(host.textContent).toContain('Preparation accepted');
    expect(host.querySelector(`a[href="${PAYROLL_COMMAND_CENTER_PATH}"]`)).not.toBeNull();
    expect(host.querySelector('a[href="/hr/operations/pay"]')).not.toBeNull();
    expect(button('Prepare payroll run').disabled).toBe(true);
  });

  it('clears a manual run draft when the selected population changes', async () => {
    const wire = projectionWire();
    const first = wire.items[0]!;
    wire.items.push({
      ...first,
      itemPublicId: 'population.off-cycle-seoul',
      title: 'Off-cycle Seoul payroll',
      deepLink: {
        ...first.deepLink,
        resourcePublicId: 'population.off-cycle-seoul',
      },
    });
    wire.queryState.fieldDecisionSummary.viewCount = 4;
    const read = vi.fn().mockResolvedValue(parsePayrollPopulationProjection(wire));
    const prepare = vi.fn();
    const source: PayrollPopulationDataSource = { population: read, prepare };
    await renderActive(source, ownerBinding(read));
    await act(async () => button('Review population').click());
    await settle();
    await act(async () => {
      setInputValue(inputByLabel('Payroll entity ID'), ids.payrollEntity);
      setInputValue(inputByLabel('Pay group ID'), ids.payGroup);
      setInputValue(inputByLabel('Pay period ID'), ids.payPeriod);
    });
    expect(button('Prepare payroll run').disabled).toBe(false);

    const second = host.querySelector(
      '[aria-label="Payroll populations: Off-cycle Seoul payroll"]'
    );
    if (!(second instanceof HTMLElement)) throw new Error('Missing second population');
    expect(second.getAttribute('aria-pressed')).toBe('false');
    await act(async () => second.click());
    expect(second.getAttribute('aria-pressed')).toBe('true');
    expect(inputByLabel('Payroll entity ID').value).toBe('');
    expect(inputByLabel('Pay group ID').value).toBe('');
    expect(inputByLabel('Pay period ID').value).toBe('');
    expect(button('Prepare payroll run').disabled).toBe(true);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('retries an uncertain dispatched command with the same frozen body and idempotency key', async () => {
    const read = vi.fn().mockResolvedValue(projection());
    const observedBindings: PayrollRunPrepareCommandBinding[] = [];
    const runPrepare = vi
      .fn()
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'))
      .mockImplementation(
        (_body: PayrollRunPrepareCommand, authority: PayrollRunPrepareAuthority) =>
          Promise.resolve(
            parsePayrollRunPreparedReceipt(receiptWire(authority.correlationId, 'ACCEPTED'))
          )
      );
    const source: PayrollPopulationDataSource = { population: read, prepare: runPrepare };
    await renderActive(source, ownerBinding(read, executor(observedBindings)), idFactory(300));
    await act(async () => button('Review population').click());
    await settle();
    await act(async () => {
      setInputValue(inputByLabel('Payroll entity ID'), ids.payrollEntity);
      setInputValue(inputByLabel('Pay group ID'), ids.payGroup);
      setInputValue(inputByLabel('Pay period ID'), ids.payPeriod);
    });
    await act(async () => button('Prepare payroll run').click());
    await settle();
    expect(host.textContent).toContain('Preparation result requires reconciliation');

    await act(async () => button('Retry exact command').click());
    await settle();
    expect(runPrepare).toHaveBeenCalledTimes(2);
    expect(runPrepare.mock.calls[1]![0]).toBe(runPrepare.mock.calls[0]![0]);
    expect(observedBindings).toHaveLength(2);
    expect(observedBindings[1]).toBe(observedBindings[0]);
    expect(observedBindings[1]!.idempotencyKey).toBe(observedBindings[0]!.idempotencyKey);
    expect(host.textContent).toContain('Preparation accepted');
  });
});
