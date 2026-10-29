import { describe, expect, it } from 'vitest';

import {
  PAY004_DEFAULT_ROLLOUT,
  PAY004_QUERY_CONTRACT,
  assertPay004QueryRequest,
  createPay004QueryRequest,
  selectPay004Projection,
} from '../retirement-contract';
import {
  PAY004_TEST_AS_OF,
  PAY004_TEST_CURSOR,
  PAY004_TEST_DECISION_REVISION,
  PAY004_TEST_SCOPE_DECISION_REVISION,
  PAY004_TEST_SCOPE,
  pay004OmittedProjectionWire,
  pay004ProjectionWire,
} from './retirement-fixtures.test-support';

describe('PAY-004 IAQ-049 contract', () => {
  it('pins the provider-neutral read-only contract and default-OFF rollout', () => {
    expect(PAY004_QUERY_CONTRACT).toEqual(
      expect.objectContaining({
        queryId: 'IAQ-049',
        operationId: 'IAQ.OP.049',
        variantKey: 'RETIREMENT',
        browserPath: '/api/payroll/v1/workbench/pay-retirement',
        ownerPath: '/v1/workbench/pay-retirement',
        route: '/hr/operations/payroll/retirement',
        resolvedCapability: 'DATA.HRIS_PAYROLL_STATUS:VIEW',
        purpose: 'PAYROLL_OPERATIONS',
        scopeResolver: 'PAY_TARGET_POPULATION',
        targetBindingKind: 'TARGET_POPULATION',
        projectionPolicyKey: 'pay004.iaq-049.fields.v1',
        defaultSort: 'itemPublicId:ASC',
        pageLimit: 100,
        availableActions: [],
      })
    );
    expect(PAY004_QUERY_CONTRACT.filters).toEqual([
      'retirementResult',
      'policyVersion',
      'caseStatus',
      'effectiveOn',
    ]);
    expect(PAY004_QUERY_CONTRACT.sorts).toHaveLength(8);
    expect(PAY004_DEFAULT_ROLLOUT).toEqual({
      feature: 'HRIS_PAY_RETIREMENT_WORKBENCH',
      enabled: false,
      enrolledTenantIds: [],
    });
  });

  it('validates four filters, limit 1..100 and the stable item tie-break sort', () => {
    const request = createPay004QueryRequest(PAY004_TEST_SCOPE, {
      limit: 25,
      filter: {
        retirementResult: {
          currency: 'KRW',
          minimumAmount: '1000000.0000',
          maximumAmount: '20000000.0000',
        },
        policyVersion: { policyKeys: ['kr.retirement'], minimumRevision: 2 },
        caseStatus: { codes: ['CALCULATED'], minimumRevision: 1 },
        effectiveOn: '2026-10-22',
      },
      sort: ['caseStatus:DESC'],
      asOf: PAY004_TEST_AS_OF,
      cursor: PAY004_TEST_CURSOR,
    });
    expect(request.limit).toBe(25);
    expect(request.sort).toEqual(['caseStatus:DESC', 'itemPublicId:ASC']);
    expect(request.filter).toEqual(expect.objectContaining({ effectiveOn: '2026-10-22' }));
    expect(() => createPay004QueryRequest(PAY004_TEST_SCOPE, { limit: 0 })).toThrow(
      'request.limit'
    );
    expect(() =>
      createPay004QueryRequest(PAY004_TEST_SCOPE, { filter: { tenantId: 'tenant-a' } })
    ).toThrow('request.filter');
    expect(() =>
      createPay004QueryRequest(PAY004_TEST_SCOPE, {
        filter: { caseStatus: { codes: ['UNKNOWN'] } },
      })
    ).toThrow('request.filter.caseStatus.codes');
    expect(() =>
      createPay004QueryRequest(PAY004_TEST_SCOPE, {
        sort: ['caseStatus:ASC', 'caseStatus:DESC'],
      })
    ).toThrow('request.sort');

    const sealedRequest = createPay004QueryRequest(PAY004_TEST_SCOPE);
    for (const invalidSort of [
      [],
      ['caseStatus:ASC'],
      ['itemPublicId:ASC', 'itemPublicId:DESC'],
      [7, 'itemPublicId:ASC'],
    ]) {
      expect(() => assertPay004QueryRequest({ ...sealedRequest, sort: invalidSort })).toThrow(
        'request.sort'
      );
    }
  });

  it('parses VIEW, MASK and OMIT without materializing restricted values', () => {
    const projection = selectPay004Projection(pay004ProjectionWire());
    expect(projection.items[0]?.fieldGroups.RETIREMENT_RESULT).toEqual({
      decision: 'VIEW',
      value: { amount: '12850000.0000', currency: 'KRW' },
    });
    expect(projection.items[0]?.fieldGroups.POLICY_VERSION).toEqual({
      decision: 'MASK',
      value: null,
      maskReason: 'FIELD_POLICY',
      maskedDisplayKey: 'hris.retirement.policy.restricted',
    });
    expect(projection.items[0]?.availableActions).toEqual([]);

    const omitted = selectPay004Projection(pay004OmittedProjectionWire());
    expect(Object.keys(omitted.items[0]!.fieldGroups)).toEqual(['CASE_STATUS']);
    expect(omitted.queryState.fieldDecisionSummary.omittedCount).toBe(2);

    const allOmittedWire = pay004ProjectionWire();
    allOmittedWire.items[0]!.fieldGroups = {} as never;
    allOmittedWire.queryState.fieldDecisionSummary = {
      viewCount: 0,
      maskedCount: 0,
      omittedCount: 3,
    };
    expect(() => selectPay004Projection(allOmittedWire)).toThrow('items[0].fieldGroups');
  });

  it('fails closed for non-canonical UUIDs, action injection and deep-link widening', () => {
    const nonUuid = pay004ProjectionWire();
    Object.assign(nonUuid.items[0]!, {
      itemPublicId: 'run-or-pack-shaped-id',
      deepLink: {
        ...nonUuid.items[0]!.deepLink,
        resourcePublicId: 'run-or-pack-shaped-id',
      },
    });
    expect(() => selectPay004Projection(nonUuid)).toThrow('items[0].itemPublicId');

    const uppercaseUuid = pay004ProjectionWire();
    uppercaseUuid.items[0]!.itemPublicId = uppercaseUuid.items[0]!.itemPublicId.toUpperCase();
    uppercaseUuid.items[0]!.deepLink.resourcePublicId =
      uppercaseUuid.items[0]!.deepLink.resourcePublicId.toUpperCase();
    expect(() => selectPay004Projection(uppercaseUuid)).toThrow('items[0].itemPublicId');

    const action = pay004ProjectionWire();
    action.items[0]!.availableActions = [{ actionKey: 'calculate' }] as never[];
    expect(() => selectPay004Projection(action)).toThrow('availableActions');

    const deepLink = pay004ProjectionWire();
    deepLink.items[0]!.deepLink.route = '/api/payroll/v1/runs/x/attempts';
    expect(() => selectPay004Projection(deepLink)).toThrow('deepLink.route');
  });

  it('fails closed for unknown case and policy lifecycle values', () => {
    const unknownTopLevelStatus = pay004ProjectionWire();
    unknownTopLevelStatus.items[0]!.statusCode = 'UNKNOWN';
    expect(() => selectPay004Projection(unknownTopLevelStatus)).toThrow('items[0].statusCode');

    const unknownCaseStatus = pay004ProjectionWire();
    unknownCaseStatus.items[0]!.fieldGroups.CASE_STATUS = {
      decision: 'VIEW',
      value: { code: 'UNKNOWN', revision: 7 },
    };
    expect(() => selectPay004Projection(unknownCaseStatus)).toThrow(
      'items[0].fieldGroups.CASE_STATUS.value.code'
    );

    const unknownPolicyStatus = pay004ProjectionWire();
    unknownPolicyStatus.items[0]!.fieldGroups.POLICY_VERSION = {
      decision: 'VIEW',
      value: {
        policyKey: 'kr.retirement',
        revision: 2,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        status: 'UNKNOWN',
      },
    } as never;
    unknownPolicyStatus.queryState.fieldDecisionSummary = {
      viewCount: 3,
      maskedCount: 0,
      omittedCount: 0,
    };
    expect(() => selectPay004Projection(unknownPolicyStatus)).toThrow(
      'items[0].fieldGroups.POLICY_VERSION.value.status'
    );

    const nonCanonicalPolicyKey = pay004ProjectionWire();
    nonCanonicalPolicyKey.items[0]!.fieldGroups.POLICY_VERSION = {
      decision: 'VIEW',
      value: {
        policyKey: 'GB.RETIREMENT',
        revision: 2,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        status: 'ACTIVE',
      },
    } as never;
    nonCanonicalPolicyKey.queryState.fieldDecisionSummary = {
      viewCount: 3,
      maskedCount: 0,
      omittedCount: 0,
    };
    expect(() => selectPay004Projection(nonCanonicalPolicyKey)).toThrow(
      'items[0].fieldGroups.POLICY_VERSION.value.policyKey'
    );
  });

  it('rejects a negative PostedMoney result without weakening signed filter ranges', () => {
    const negativeResult = pay004ProjectionWire();
    negativeResult.items[0]!.fieldGroups.RETIREMENT_RESULT = {
      decision: 'VIEW',
      value: { amount: '-0.0001', currency: 'KRW' },
    };
    expect(() => selectPay004Projection(negativeResult)).toThrow(
      'items[0].fieldGroups.RETIREMENT_RESULT.value.amount'
    );

    expect(
      createPay004QueryRequest(PAY004_TEST_SCOPE, {
        filter: {
          retirementResult: {
            minimumAmount: '-100.000001',
            maximumAmount: '100000000000000000000.123456',
          },
        },
      }).filter
    ).toEqual({
      retirementResult: {
        minimumAmount: '-100.000001',
        maximumAmount: '100000000000000000000.123456',
      },
    });
  });

  it('enforces state cardinality and exact field-decision summary', () => {
    const completeWithoutItem = pay004ProjectionWire();
    completeWithoutItem.items = [];
    completeWithoutItem.queryState.fieldDecisionSummary = {
      viewCount: 0,
      maskedCount: 0,
      omittedCount: 0,
    };
    expect(() => selectPay004Projection(completeWithoutItem)).toThrow('queryState.cardinality');

    const summary = pay004ProjectionWire();
    summary.queryState.fieldDecisionSummary.viewCount = 99;
    expect(() => selectPay004Projection(summary)).toThrow('fieldDecisionSummary');

    const partial = pay004ProjectionWire('PARTIAL');
    partial.queryState.partialFailures = [];
    expect(() => selectPay004Projection(partial)).toThrow('queryState.cardinality');
  });

  it('keeps derived scope revision distinct from the trusted authorization revision', () => {
    const projection = selectPay004Projection(pay004ProjectionWire());
    expect(projection.queryState.scopeDecisionRevision).toBe(PAY004_TEST_SCOPE_DECISION_REVISION);
    expect(projection.queryState.cachePolicy.authorizationDecisionRevision).toBe(
      PAY004_TEST_DECISION_REVISION
    );
    expect(projection.queryState.scopeDecisionRevision).not.toBe(
      projection.queryState.cachePolicy.authorizationDecisionRevision
    );
  });
});
