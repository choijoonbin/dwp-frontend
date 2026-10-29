// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpTransportError } from '@dwp-frontend/shared-utils';

import enHcm from '../../../../../../../../libs/shared-i18n/src/locales/en/hcm.json';

import {
  TIME_INTERPRETATION_API_CONTRACTS,
  TIME_INTERPRETATION_AUTHORIZATION_CONTRACT,
  TimeInterpretationWorkbenchRuntime,
  assertTimeInterpretationReplayInvariant,
  assertTimeInterpretationTraceDeterminism,
  buildTimeInterpretationRunRequest,
  createTimeInterpretationDataSource,
  parseTimeInterpretationReceipt,
  parseTimeInterpretationTrace,
  parseTimeInterpretationWorkbench,
  parseTypedTimeRuleAst,
  timeInterpretationTotalMinutes,
} from '../../index';

import type {
  TimeInterpretationDataSource,
  TimeInterpretationHttpClient,
  TimeInterpretationOwnerBinding,
  TimeInterpretationReceipt,
  TimeInterpretationRunRequest,
  TimeInterpretationScope,
  TimeRuleContractError,
} from '../../index';

const scope: TimeInterpretationScope = {
  ready: true,
  contextScopeKey: 'scope:tenant-300:time-group-7',
  decisionRevision: 'decision:tim:37',
  locale: 'en-US',
  timeZone: 'Asia/Seoul',
  correlationId: '30000000-0000-4000-8000-000000000099',
};

const runId = '30000000-0000-4000-8000-000000000010';
const workerId = '30000000-0000-4000-8000-000000000011';
const idempotencyKey = '30000000-0000-4000-8000-000000000012';

const runRequest: TimeInterpretationRunRequest = {
  workerIds: [workerId],
  periodStart: '2026-10-01',
  periodEnd: '2026-10-01',
  asOf: '2026-10-01T12:00:00Z',
};

function typedRuleSource(): Record<string, unknown> {
  return {
    registryId: 'TIM_RULE_AST_V1',
    registryVersion: 1,
    rootNodeId: 'isOvertime',
    nodes: [
      {
        nodeId: 'worked',
        operator: 'INPUT',
        arguments: [],
        returnType: 'QUANTITY_MINUTE',
        value: null,
        inputRef: {
          owner: 'TIM',
          schemaId: 'TIM.WorkedMinutes.v1',
          publicId: '30000000-0000-4000-8000-000000000001',
          revision: 7,
          contentHash: 'a'.repeat(64),
        },
        roundingRef: null,
      },
      {
        nodeId: 'threshold',
        operator: 'QUANTITY_LITERAL',
        arguments: [],
        returnType: 'QUANTITY_MINUTE',
        value: '480',
        inputRef: null,
        roundingRef: null,
      },
      {
        nodeId: 'isOvertime',
        operator: 'COMPARE_LT',
        arguments: ['threshold', 'worked'],
        returnType: 'BOOLEAN',
        value: null,
        inputRef: null,
        roundingRef: null,
      },
    ],
  };
}

function projectionSource(): Record<string, unknown> {
  return {
    projectionVersion: '1',
    asOf: '2026-10-01T12:01:00Z',
    variantKey: 'INTERPRETATION',
    queryState: {
      state: 'COMPLETE',
      scopeDecisionRevision: 'scope:tim:37',
      freshness: 'CURRENT',
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 3, maskedCount: 0, omittedCount: 0 },
      partialFailures: [],
      correlationId: scope.correlationId,
      cachePolicy: {
        authorizationDecisionRevision: 'decision:tim:37',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 30,
      },
    },
    items: [
      {
        itemPublicId: runId,
        title: 'Synthetic Seoul day interpretation · 서울 기준 일일 판정',
        statusCode: 'SUCCEEDED',
        fieldGroups: {
          INTERPRETATION_RESULT: {
            decision: 'VIEW',
            value: { code: 'INTERPRETED', revision: 9 },
          },
          RULE_VERSION: {
            decision: 'VIEW',
            value: {
              policyKey: 'tim.standard-day',
              revision: 7,
              effectiveFrom: '2026-01-01',
              effectiveTo: null,
              status: 'PUBLISHED',
            },
          },
          TRACE_SUMMARY: {
            decision: 'VIEW',
            value: { itemCount: 3, revision: 9, asOf: '2026-10-01T12:00:01Z' },
          },
        },
        deepLink: {
          route: '/hr/operations/time/interpretation',
          resourcePublicId: runId,
        },
        availableActions: [
          {
            actionKey: 'hris.action.tim.interpretation.run',
            method: 'POST',
            hrefTemplate: '/api/time/v1/interpretation-runs',
            idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
            stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
          },
        ],
      },
    ],
  };
}

function traceSource(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    runId,
    inputDigest: 'b'.repeat(64),
    ruleDigest: 'c'.repeat(64),
    steps: [
      { sequence: 1, ruleCode: 'PAIR_CLOCK_EVENTS', inputMinutes: 0, outputMinutes: 540 },
      { sequence: 2, ruleCode: 'DEDUCT_BREAK', inputMinutes: 540, outputMinutes: 480 },
      { sequence: 3, ruleCode: 'CLASSIFY_REGULAR', inputMinutes: 480, outputMinutes: 480 },
    ],
    ...overrides,
  };
}

function receiptSource(
  status: TimeInterpretationReceipt['status'] = 'ACCEPTED',
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    receiptId: '30000000-0000-4000-8000-000000000020',
    commandType: 'INTERPRETATION_RUN',
    originatingAction: 'TIME_INTERPRET_RUN',
    subjectPrincipalPublicId: workerId,
    populationScopeDigest: 'd'.repeat(64),
    fieldPolicyRevision: 37,
    purposeCode: 'TIME_INTERPRETATION',
    authorizationRevision: 37,
    status,
    correlationId: scope.correlationId,
    requestDigest: 'e'.repeat(64),
    createdAt: '2026-10-01T12:00:00Z',
    aggregateVersion: 9,
    resultRef: runId,
    ...overrides,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function buttonByText(container: ParentNode, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return button;
}

describe('[SLICE:BASE-TFR-TIM-010] deterministic time interpretation', () => {
  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      defaultNS: 'hcm',
      ns: ['hcm'],
      resources: { en: { hcm: enHcm } },
      interpolation: { escapeValue: false },
    });
  });

  it('prepares only a closed worker population and civil-date period for the production adapter', () => {
    expect(
      buildTimeInterpretationRunRequest(
        {
          workerIds: `${workerId}\n30000000-0000-4000-8000-000000000013`,
          periodStart: '2026-10-01',
          periodEnd: '2026-10-02',
        },
        '2026-10-01T12:00:00Z'
      )
    ).toEqual({
      workerIds: [workerId, '30000000-0000-4000-8000-000000000013'],
      periodStart: '2026-10-01',
      periodEnd: '2026-10-02',
      asOf: '2026-10-01T12:00:00Z',
    });
    expect(() =>
      buildTimeInterpretationRunRequest({
        workerIds: `${workerId},${workerId}`,
        periodStart: '2026-10-02',
        periodEnd: '2026-10-01',
      })
    ).toThrow('Invalid TIM interpretation run request.');
  });

  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('accepts TIM-P-RULE and rejects an unknown operator and cyclic AST with typed codes', () => {
    const parsed = parseTypedTimeRuleAst(typedRuleSource());
    expect(parsed.registryId).toBe('TIM_RULE_AST_V1');
    expect(parsed.registryVersion).toBe(1);
    expect(parsed.nodes.map((node) => node.operator)).toEqual([
      'INPUT',
      'QUANTITY_LITERAL',
      'COMPARE_LT',
    ]);
    expect(Object.isFrozen(parsed.nodes)).toBe(true);

    const unknownOperator = typedRuleSource();
    (unknownOperator.nodes as Record<string, unknown>[])[2]!.operator = 'EXECUTE_SCRIPT';
    expect(() => parseTypedTimeRuleAst(unknownOperator)).toThrowError(
      expect.objectContaining<Partial<TimeRuleContractError>>({ code: 'UNKNOWN_OPERATOR' })
    );

    const cyclic = typedRuleSource();
    (cyclic.nodes as Record<string, unknown>[])[0]!.arguments = ['isOvertime'];
    expect(() => parseTypedTimeRuleAst(cyclic)).toThrowError(
      expect.objectContaining<Partial<TimeRuleContractError>>({ code: 'CYCLE' })
    );
  });

  it('parses only the exact IAQ-041 projection, action, deep link, and field-decision totals', () => {
    const projection = parseTimeInterpretationWorkbench(projectionSource());
    expect(projection.queryState).toBe('COMPLETE');
    expect(projection.items[0]?.ruleVersion).toMatchObject({
      decision: 'VIEW',
      value: { policyKey: 'tim.standard-day', revision: 7 },
    });
    expect(projection.items[0]?.availableActions).toEqual([
      expect.objectContaining({ actionKey: 'hris.action.tim.interpretation.run' }),
    ]);
    expect(JSON.stringify(projection)).not.toContain('tenantId');

    const hostileAction = projectionSource();
    const item = (hostileAction.items as Record<string, unknown>[])[0]!;
    (item.availableActions as Record<string, unknown>[])[0]!.hrefTemplate =
      '/api/time/v1/admin/reverse-all';
    expect(() => parseTimeInterpretationWorkbench(hostileAction)).toThrow(
      'Invalid TIM interpretation available action.'
    );

    const driftedSummary = projectionSource();
    (
      (driftedSummary.queryState as Record<string, unknown>).fieldDecisionSummary as Record<
        string,
        unknown
      >
    ).viewCount = 2;
    expect(() => parseTimeInterpretationWorkbench(driftedSummary)).toThrow(
      'Invalid TIM interpretation field decision summary.'
    );

    const empty = projectionSource();
    empty.items = [];
    (empty.queryState as Record<string, unknown>).state = 'EMPTY';
    (empty.queryState as Record<string, unknown>).fieldDecisionSummary = {
      viewCount: 0,
      maskedCount: 0,
      omittedCount: 0,
    };
    expect(parseTimeInterpretationWorkbench(empty).items).toHaveLength(0);

    const partial = projectionSource();
    (partial.queryState as Record<string, unknown>).state = 'PARTIAL';
    (partial.queryState as Record<string, unknown>).partialFailures = [
      {
        componentKey: 'trace.projector',
        errorCode: 'TRACE_LAGGING',
        correlationId: '30000000-0000-4000-8000-000000000098',
        retryable: true,
      },
    ];
    expect(parseTimeInterpretationWorkbench(partial)).toMatchObject({
      queryState: 'PARTIAL',
      partialFailures: ['TRACE_LAGGING'],
    });
    (partial.queryState as Record<string, unknown>).partialFailures = [];
    expect(() => parseTimeInterpretationWorkbench(partial)).toThrow(
      'Invalid TIM interpretation partial query state.'
    );

    const unavailable = projectionSource();
    unavailable.items = [];
    Object.assign(unavailable.queryState as Record<string, unknown>, {
      state: 'UNAVAILABLE',
      freshness: 'UNAVAILABLE',
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 0, maskedCount: 0, omittedCount: 0 },
    });
    expect(parseTimeInterpretationWorkbench(unavailable)).toMatchObject({
      queryState: 'UNAVAILABLE',
      freshness: 'UNAVAILABLE',
      items: [],
    });

    const policyLimited = projectionSource();
    const limitedItem = (policyLimited.items as Record<string, unknown>[])[0]!;
    const limitedGroups = limitedItem.fieldGroups as Record<string, unknown>;
    limitedGroups.RULE_VERSION = {
      decision: 'MASK',
      value: null,
      maskReason: 'PURPOSE_POLICY',
      maskedDisplayKey: 'hris.masked.policy',
    };
    delete limitedGroups.TRACE_SUMMARY;
    (policyLimited.queryState as Record<string, unknown>).fieldDecisionSummary = {
      viewCount: 1,
      maskedCount: 1,
      omittedCount: 1,
    };
    expect(parseTimeInterpretationWorkbench(policyLimited).items[0]).toMatchObject({
      ruleVersion: { decision: 'MASK', value: null },
      traceSummary: { decision: 'OMIT', value: null },
    });
  });

  it('preserves golden minute totals and detects nondeterministic trace or receipt replay', () => {
    const trace = parseTimeInterpretationTrace(traceSource());
    expect(trace.steps.map((step) => step.outputMinutes)).toEqual([540, 480, 480]);
    expect(timeInterpretationTotalMinutes(trace)).toBe(480);
    expect(() => assertTimeInterpretationTraceDeterminism(trace, clone(trace))).not.toThrow();

    const changedTrace = parseTimeInterpretationTrace(
      traceSource({
        steps: [
          { sequence: 1, ruleCode: 'PAIR_CLOCK_EVENTS', inputMinutes: 0, outputMinutes: 540 },
          { sequence: 2, ruleCode: 'DEDUCT_BREAK', inputMinutes: 540, outputMinutes: 479 },
          { sequence: 3, ruleCode: 'CLASSIFY_REGULAR', inputMinutes: 479, outputMinutes: 479 },
        ],
      })
    );
    expect(() => assertTimeInterpretationTraceDeterminism(trace, changedTrace)).toThrow(
      'TIM interpretation replay changed deterministic trace evidence.'
    );

    const receipt = parseTimeInterpretationReceipt(receiptSource('SUCCEEDED'));
    expect(() => assertTimeInterpretationReplayInvariant(receipt, clone(receipt))).not.toThrow();
    const substituted = parseTimeInterpretationReceipt(
      receiptSource('SUCCEEDED', { requestDigest: 'f'.repeat(64) })
    );
    expect(() => assertTimeInterpretationReplayInvariant(receipt, substituted)).toThrow(
      'TIM interpretation replay changed sealed command identity.'
    );
  });

  it('binds IAQ-041, PEP-TIM-009, and PEP-TIM-010 to scope and a preserved idempotency key', async () => {
    const get = vi.fn<TimeInterpretationHttpClient['get']>();
    const post = vi.fn<TimeInterpretationHttpClient['post']>();
    const client: TimeInterpretationHttpClient = { get, post };
    const dataSource = createTimeInterpretationDataSource(client);
    const signal = new AbortController().signal;
    get.mockResolvedValueOnce({
      data: { status: 'SUCCESS', message: '', data: projectionSource() },
    });
    post.mockResolvedValueOnce({
      data: { status: 'SUCCESS', message: '', data: receiptSource('ACCEPTED') },
    });
    get.mockResolvedValueOnce({
      data: { status: 'SUCCESS', message: '', data: traceSource() },
    });

    await expect(dataSource.read(scope, {}, signal)).resolves.toMatchObject({
      queryState: 'COMPLETE',
    });
    expect(get).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/time/v1/hris/workbench/time-interpretation?'),
      {
        contextScopeKey: scope.contextScopeKey,
        signal,
        headers: { 'X-Correlation-ID': scope.correlationId },
      }
    );

    await expect(
      dataSource.run(
        runRequest,
        scope,
        {
          mode: 'SECURE',
          rolloutState: '111',
          expectedDecisionRevision: scope.decisionRevision,
          contextKey: 'hcm.operations.time.interpretation',
          contextScopeKey: scope.contextScopeKey,
          idempotencyKey,
        },
        signal
      )
    ).resolves.toMatchObject({ originatingAction: 'TIME_INTERPRET_RUN' });
    expect(post).toHaveBeenCalledWith('/api/time/v1/interpretation-runs', runRequest, {
      contextScopeKey: scope.contextScopeKey,
      signal,
      headers: {
        'Idempotency-Key': idempotencyKey,
        'X-Correlation-ID': scope.correlationId,
        'X-DWP-Expected-Decision-Revision': scope.decisionRevision,
      },
    });

    await expect(dataSource.trace(runId, scope, signal)).resolves.toMatchObject({ runId });
    expect(get).toHaveBeenNthCalledWith(2, `/api/time/v1/interpretation-runs/${runId}/trace`, {
      contextScopeKey: scope.contextScopeKey,
      signal,
      headers: { 'X-Correlation-ID': scope.correlationId },
    });
    expect(TIME_INTERPRETATION_API_CONTRACTS.map((entry) => entry.bindingId)).toEqual([
      'IAQ-041',
      'PEP-TIM-009',
      'PEP-TIM-010',
    ]);
    expect(TIME_INTERPRETATION_AUTHORIZATION_CONTRACT).toMatchObject({
      version: 38,
      sha256: 'a41145d6a2faefd2e6030a2ca9a070769019d4db5513ea214bf542dda31c374a',
      gatewayOpenApiSha256: '453f3620dca02a5ce82df273be986633fb5d694084ca080859bb47472027d234',
      readCapabilities: ['hcm.operations.time.view'],
      runCapabilities: ['hcm.operations.time.update', 'hcm.personal.time.submit'],
      traceCapabilities: ['hcm.operations.time.update', 'hcm.personal.time.view'],
    });

    for (const hostileReceipt of [
      { commandType: 'CLOCK_RECORD' },
      { originatingAction: 'TIME_CLOCK_RECORD' },
      { purposeCode: 'TIME_REVERSAL' },
      { correlationId: '30000000-0000-4000-8000-000000000097' },
    ]) {
      post.mockResolvedValueOnce({
        data: {
          status: 'SUCCESS',
          message: '',
          data: receiptSource('ACCEPTED', hostileReceipt),
        },
      });
      await expect(
        dataSource.run(
          runRequest,
          scope,
          {
            mode: 'SECURE',
            rolloutState: '111',
            expectedDecisionRevision: scope.decisionRevision,
            contextKey: 'hcm.operations.time.interpretation',
            contextScopeKey: scope.contextScopeKey,
            idempotencyKey,
          },
          signal
        )
      ).rejects.toThrow('The TIM owner returned an unverifiable interpretation receipt.');
    }

    await expect(
      dataSource.run(
        runRequest,
        scope,
        {
          mode: 'SECURE',
          rolloutState: '111',
          expectedDecisionRevision: scope.decisionRevision,
          contextKey: 'hcm.operations.time.interpretation',
          contextScopeKey: 'scope:another-tenant',
          idempotencyKey,
        },
        signal
      )
    ).rejects.toThrow('Governed TIM interpretation authority is invalid.');
    expect(post).toHaveBeenCalledTimes(5);
  });

  it('stays closed without the exact tenant-scoped page authority and never reuses an adjacent grant', async () => {
    const read = vi.fn(() => Promise.resolve(parseTimeInterpretationWorkbench(projectionSource())));
    const dataSource: TimeInterpretationDataSource = {
      read,
      run: vi.fn(),
      trace: vi.fn(),
    };

    await act(async () => {
      root.render(
        createElement(TimeInterpretationWorkbenchRuntime, {
          scope: { ...scope, ready: false },
          ownerBinding: { page: { contractId: 'IAQ-041', read } },
          dataSource,
        })
      );
      await Promise.resolve();
    });
    expect(read).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="time-interpretation-closed"]')).not.toBeNull();

    await act(async () => {
      root.render(
        createElement(TimeInterpretationWorkbenchRuntime, {
          scope,
          ownerBinding: undefined,
          dataSource,
        })
      );
      await Promise.resolve();
    });
    expect(read).not.toHaveBeenCalled();
    expect(host.textContent).toContain('No adjacent time permission is reused.');
  });

  it('renders list-detail evidence, typed rule version, golden totals, and no inferred reversal action', async () => {
    const workbench = parseTimeInterpretationWorkbench(projectionSource());
    const trace = parseTimeInterpretationTrace(traceSource());
    const ownerBinding: TimeInterpretationOwnerBinding = {
      page: { contractId: 'IAQ-041', read: vi.fn(() => Promise.resolve(workbench)) },
      trace: { contractId: 'PEP-TIM-010', read: vi.fn(() => Promise.resolve(trace)) },
    };

    await act(async () => {
      root.render(createElement(TimeInterpretationWorkbenchRuntime, { scope, ownerBinding }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.querySelector('table[aria-label="Time interpretation evidence"]')).not.toBeNull();
    expect(host.querySelector('ul[aria-label="Time interpretation agenda"]')).not.toBeNull();
    expect(
      host.querySelector('table[aria-label="Deterministic interpretation trace"]')
    ).not.toBeNull();
    expect(host.textContent).toContain('tim.standard-day · r7 · PUBLISHED');
    expect(host.textContent).toContain('Golden total minutes');
    expect(host.textContent).toContain('480');
    expect(buttonByText(host, 'Run exact interpretation').disabled).toBe(true);
    expect(host.textContent?.toLowerCase()).not.toContain('reverse run');
  });

  it('retries an unknown command with the exact same idempotency key and suppresses duplicate submission', async () => {
    const workbench = parseTimeInterpretationWorkbench(projectionSource());
    const trace = parseTimeInterpretationTrace(traceSource());
    const run = vi
      .fn<TimeInterpretationDataSource['run']>()
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'))
      .mockResolvedValueOnce(parseTimeInterpretationReceipt(receiptSource('ACCEPTED')));
    const dataSource: TimeInterpretationDataSource = {
      read: vi.fn(() => Promise.resolve(workbench)),
      trace: vi.fn(() => Promise.resolve(trace)),
      run,
    };
    const observedKeys: string[] = [];
    const ownerBinding: TimeInterpretationOwnerBinding = {
      page: { contractId: 'IAQ-041', read: dataSource.read },
      trace: { contractId: 'PEP-TIM-010', read: dataSource.trace },
      run: {
        contractId: 'PEP-TIM-009',
        actionKey: 'hris.action.tim.interpretation.run',
        execute: async (execute, binding) => {
          observedKeys.push(binding.idempotencyKey);
          return execute({
            mode: 'SECURE',
            rolloutState: '111',
            expectedDecisionRevision: scope.decisionRevision,
            contextKey: 'hcm.operations.time.interpretation',
            contextScopeKey: scope.contextScopeKey,
          });
        },
      },
    };

    await act(async () => {
      root.render(
        createElement(TimeInterpretationWorkbenchRuntime, {
          scope,
          ownerBinding,
          runRequest,
          dataSource,
          idFactory: () => idempotencyKey,
        })
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(buttonByText(host, 'Run exact interpretation').disabled).toBe(false);

    await act(async () => {
      buttonByText(host, 'Run exact interpretation').click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain('Do not submit a new command.');
    expect(buttonByText(host, 'Run exact interpretation').disabled).toBe(true);

    await act(async () => {
      buttonByText(host, 'Retry exact command').click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(run).toHaveBeenCalledTimes(2);
    expect(observedKeys).toEqual([idempotencyKey, idempotencyKey]);
    expect(run.mock.calls[0]?.[2]).toMatchObject({ idempotencyKey });
    expect(run.mock.calls[1]?.[2]).toMatchObject({ idempotencyKey });
    expect(host.textContent).toContain('Interpretation command accepted');
  });

  it.each(['REJECTED', 'FAILED'] as const)(
    'keeps a sealed %s receipt terminal and never exposes it as success or exact retry',
    async (status) => {
      const workbench = parseTimeInterpretationWorkbench(projectionSource());
      const trace = parseTimeInterpretationTrace(traceSource());
      const run = vi
        .fn<TimeInterpretationDataSource['run']>()
        .mockResolvedValue(parseTimeInterpretationReceipt(receiptSource(status)));
      const dataSource: TimeInterpretationDataSource = {
        read: vi.fn(() => Promise.resolve(workbench)),
        trace: vi.fn(() => Promise.resolve(trace)),
        run,
      };
      const ownerBinding: TimeInterpretationOwnerBinding = {
        page: { contractId: 'IAQ-041', read: dataSource.read },
        trace: { contractId: 'PEP-TIM-010', read: dataSource.trace },
        run: {
          contractId: 'PEP-TIM-009',
          actionKey: 'hris.action.tim.interpretation.run',
          execute: (execute) =>
            execute({
              mode: 'SECURE',
              rolloutState: '111',
              expectedDecisionRevision: scope.decisionRevision,
              contextKey: 'hcm.operations.time.interpretation',
              contextScopeKey: scope.contextScopeKey,
            }),
        },
      };

      await act(async () => {
        root.render(
          createElement(TimeInterpretationWorkbenchRuntime, {
            scope,
            ownerBinding,
            runRequest,
            dataSource,
            idFactory: () => idempotencyKey,
          })
        );
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        buttonByText(host, 'Run exact interpretation').click();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(run).toHaveBeenCalledTimes(1);
      expect(host.textContent).toContain(`Interpretation command failed: ${status}`);
      expect(host.textContent).toContain(
        'The TIM owner returned a sealed terminal failure receipt.'
      );
      expect(host.textContent).toContain('30000000-0000-4000-8000-000000000020');
      expect(host.textContent).not.toContain('Interpretation command accepted');
      expect(host.textContent).not.toContain('Retry exact command');
      expect(buttonByText(host, 'Run exact interpretation').disabled).toBe(false);
    }
  );
});
