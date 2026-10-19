import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: runtime.get, post: runtime.post },
}));

import {
  HRM011_API_CONTRACTS,
  hrm011QueryString,
  issueEmploymentContract,
  queryHrm011Entry,
} from '../contracts-compensation-basis-api';
import {
  HRM011_QUERY_CONTRACT,
  assertHrm011EmploymentContractRequest,
  createHrm011QueryRequest,
  selectHrm011Projection,
} from '../contracts-compensation-basis-contract';
import {
  HRM011_TEST_AS_OF,
  HRM011_TEST_CORRELATION_ID,
  HRM011_TEST_DIGEST,
  HRM011_TEST_RELATIONSHIP_ID,
  HRM011_TEST_SCOPE,
  HRM011_TEST_TEMPLATE_ID,
  hrm011ProjectionWire,
  hrm011Receipt,
} from './contracts-compensation-basis-fixtures.test-support';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { Hrm011IssueCommand } from '../contracts-compensation-basis-contract';

const IDEMPOTENCY_KEY = 'employment-contract-command-0001';
const command: Hrm011IssueCommand = Object.freeze({
  expectedObjectVersion: 7,
  idempotencyKey: IDEMPOTENCY_KEY,
  correlationId: HRM011_TEST_CORRELATION_ID,
  request: Object.freeze({
    relationshipPublicId: HRM011_TEST_RELATIONSHIP_ID,
    templatePublicId: HRM011_TEST_TEMPLATE_ID,
    templateVersion: 3,
    locale: 'en-US',
    effectiveFrom: '2026-10-19',
    effectiveTo: null,
    snapshotDigest: HRM011_TEST_DIGEST,
  }),
});

function authority(): Extract<ProductSurfaceGovernedMutationAuthority, { mode: 'SECURE' }> {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: HRM011_TEST_SCOPE.decisionRevision,
    contextKey: 'context:hrm-011:59',
    contextScopeKey: HRM011_TEST_SCOPE.contextScopeKey,
    idempotencyKey: IDEMPOTENCY_KEY,
    objectVersion: 7,
    stepUp: {
      challenge: 'signed-employment-contract-step-up-proof',
      challengeId: 'challenge:hrm-011:59',
      decisionRevision: HRM011_TEST_SCOPE.decisionRevision,
      expiresAt: '2099-10-19T00:00:00Z',
    },
  };
}

describe('HRM-011 IAQ-008 v2 and PEP-HRM-011 API contracts', () => {
  beforeEach(() => {
    runtime.get.mockReset();
    runtime.post.mockReset();
  });

  it('pins one exact GET and one exact HIGH-risk POST contract', () => {
    expect(HRM011_API_CONTRACTS).toEqual([
      expect.objectContaining({
        bindingId: 'IAQ-008',
        operationId: 'IAQ.OP.008',
        method: 'GET',
        browserPath: '/api/people/v1/hris/workbench/operations/contracts/compensation/basis',
        ownerPath: '/v1/hris/workbench/operations/contracts/compensation/basis',
      }),
      expect.objectContaining({
        bindingId: 'PEP-HRM-011',
        method: 'POST',
        browserPath: '/api/people/v1/hris/employment-contracts',
        ownerPath: '/v1/hris/employment-contracts',
        successStatus: 202,
      }),
    ]);
    expect(HRM011_QUERY_CONTRACT.filters).toEqual([
      'contractMetadata',
      'compensationBasis',
      'effectiveOn',
    ]);
    expect(HRM011_QUERY_CONTRACT.sorts).toHaveLength(6);
  });

  it('serializes only the sealed IAQ-008 query and never serializes trusted tenancy', async () => {
    runtime.get.mockResolvedValue({ data: hrm011ProjectionWire() });
    const request = createHrm011QueryRequest(HRM011_TEST_SCOPE, {
      filter: {
        contractMetadata: { keys: [HRM011_TEST_TEMPLATE_ID], versions: ['3'] },
        compensationBasis: {
          currency: 'USD',
          minimumAmount: '100000.00',
          maximumAmount: '150000.00',
        },
        effectiveOn: '2026-10-19',
      },
      sort: ['compensationBasis:DESC', 'itemPublicId:ASC'],
      asOf: HRM011_TEST_AS_OF,
      cursor: 'abcdefghijklmnop',
    });

    await queryHrm011Entry(
      request,
      HRM011_TEST_SCOPE.contextScopeKey,
      new AbortController().signal
    );

    const [url, config] = runtime.get.mock.calls[0]!;
    const requestUrl = new URL(url, 'https://dwp.invalid');
    expect(requestUrl.pathname).toBe(HRM011_QUERY_CONTRACT.browserPath);
    expect(requestUrl.searchParams.getAll('sort')).toEqual([
      'compensationBasis:DESC',
      'itemPublicId:ASC',
    ]);
    expect(requestUrl.searchParams.get('filter[contractMetadata][keys]')).toBe(
      HRM011_TEST_TEMPLATE_ID
    );
    expect(requestUrl.searchParams.get('filter[compensationBasis][currency]')).toBe('USD');
    expect(requestUrl.searchParams.get('tenantId')).toBeNull();
    expect(config).toEqual({
      contextScopeKey: HRM011_TEST_SCOPE.contextScopeKey,
      signal: expect.any(AbortSignal),
    });
    expect(
      selectHrm011Projection(runtime.get.mock.results[0]?.value ? hrm011ProjectionWire() : null)
    ).toBeTruthy();
  });

  it('uses the exact seven-field body, raw strong If-Match, and trusted purpose injection', async () => {
    runtime.post.mockResolvedValue({ data: hrm011Receipt() });

    await expect(issueEmploymentContract(command, authority())).resolves.toEqual(hrm011Receipt());

    const [url, body, config] = runtime.post.mock.calls[0]!;
    expect(url).toBe('/api/people/v1/hris/employment-contracts');
    expect(body).toEqual(command.request);
    expect(Object.keys(body)).toEqual([
      'relationshipPublicId',
      'templatePublicId',
      'templateVersion',
      'locale',
      'effectiveFrom',
      'effectiveTo',
      'snapshotDigest',
    ]);
    expect(config).toMatchObject({
      contextScopeKey: HRM011_TEST_SCOPE.contextScopeKey,
      csrfReplay: 'NEVER',
      headers: {
        'Idempotency-Key': IDEMPOTENCY_KEY,
        'If-Match': '"7"',
        'X-Correlation-ID': HRM011_TEST_CORRELATION_ID,
        'X-DWP-Expected-Object-Version': '7',
        'X-DWP-Expected-Decision-Revision': HRM011_TEST_SCOPE.decisionRevision,
        'X-DWP-Step-Up-Challenge': 'signed-employment-contract-step-up-proof',
      },
    });
    expect(config.headers['X-Purpose-Code']).toBeUndefined();
  });

  it('fails closed before I/O for unknown body fields, authority mismatch, or receipt mismatch', async () => {
    expect(() =>
      assertHrm011EmploymentContractRequest({ ...command.request, tenantId: 'tenant-one' })
    ).toThrow();
    await expect(
      issueEmploymentContract(command, { ...authority(), objectVersion: 8 })
    ).rejects.toThrow('HIGH-risk authority does not match');
    expect(runtime.post).not.toHaveBeenCalled();

    runtime.post.mockResolvedValue({
      data: { ...hrm011Receipt(), purposeCode: 'EMPLOYMENT_CONTRACT' },
    });
    await expect(issueEmploymentContract(command, authority())).rejects.toThrow(
      'receipt does not match'
    );
  });

  it('rejects additive projection fields and invalid state, action, summary, and version boundaries', () => {
    const additive = hrm011ProjectionWire();
    Object.assign(additive.items[0]!, { personName: 'restricted' });
    expect(() => selectHrm011Projection(additive)).toThrow();

    const partialAction = hrm011ProjectionWire('PARTIAL');
    partialAction.items[0]!.availableActions = [
      { ...hrm011ProjectionWire().items[0]!.availableActions[0]! },
    ];
    partialAction.items[0]!.statusCode = 'READY_TO_ISSUE';
    expect(() => selectHrm011Projection(partialAction)).toThrow('queryState.cardinality');

    const summary = hrm011ProjectionWire();
    summary.queryState.fieldDecisionSummary.viewCount = 99;
    expect(() => selectHrm011Projection(summary)).toThrow('fieldDecisionSummary');

    const badVersion = hrm011ProjectionWire();
    badVersion.items[0]!.resourceVersion = -1;
    expect(() => selectHrm011Projection(badVersion)).toThrow('resourceVersion');

    expect(hrm011QueryString(createHrm011QueryRequest(HRM011_TEST_SCOPE))).toContain(
      'filter=%7B%7D'
    );
  });
});
