import { describe, expect, it } from 'vitest';

import {
  HRM012_QUERY_CONTRACT,
  assertHrm012QueryRequest,
  assertHrm012TrustedScope,
  createHrm012QueryRequest,
  selectHrm012Projection,
} from '../data-quality-contract';
import {
  HRM012_TEST_AS_OF,
  HRM012_TEST_CURSOR,
  HRM012_TEST_DIGEST,
  HRM012_TEST_SCOPE,
  hrm012OmittedProjectionWire,
  hrm012ProjectionWire,
} from './data-quality-fixtures.test-support';

describe('HRM-012 IAQ-012 contract', () => {
  it('pins the exact read-only query contract and empty action set', () => {
    expect(HRM012_QUERY_CONTRACT).toEqual(
      expect.objectContaining({
        queryId: 'IAQ-012',
        operationId: 'IAQ.OP.012',
        variantKey: 'DATA_QUALITY',
        browserPath: '/api/people/v1/hris/workbench/operations/data/quality',
        ownerPath: '/v1/hris/workbench/operations/data/quality',
        route: '/hr/operations/people/data-quality',
        capability: 'hcm.operations.people.view',
        pageLimit: 100,
        availableActions: [],
      })
    );
    expect(HRM012_QUERY_CONTRACT.fieldGroups).toEqual([
      'INGESTION_STATUS',
      'QUALITY_FINDING',
      'COMMAND_RECEIPT',
    ]);
    expect(HRM012_QUERY_CONTRACT.filters).toEqual([
      'ingestionStatus',
      'qualityFinding',
      'commandReceipt',
      'effectiveOn',
    ]);
    expect(HRM012_QUERY_CONTRACT.sorts).toHaveLength(8);
  });

  it('creates only accepted filters and a stable item-public-id tiebreak sort', () => {
    const request = createHrm012QueryRequest(HRM012_TEST_SCOPE, {
      filter: {
        ingestionStatus: { codes: ['APPLIED'], minimumRevision: 2 },
        qualityFinding: { decisionCodes: ['VALID'], evidenceDigest: HRM012_TEST_DIGEST },
        commandReceipt: { receiptIds: ['receipt.public.1'], states: ['SUCCEEDED'] },
        effectiveOn: '2026-10-22',
      },
      sort: ['qualityFinding:DESC'],
      asOf: HRM012_TEST_AS_OF,
      cursor: HRM012_TEST_CURSOR,
    });

    expect(request).toEqual(
      expect.objectContaining({
        limit: 100,
        sort: ['qualityFinding:DESC', 'itemPublicId:ASC'],
        locale: 'en-US',
        timeZone: 'Asia/Seoul',
        correlationId: HRM012_TEST_SCOPE.correlationId,
        asOf: HRM012_TEST_AS_OF,
        cursor: HRM012_TEST_CURSOR,
      })
    );
    expect(assertHrm012QueryRequest(request)).toEqual(request);
    expect(Object.isFrozen(request)).toBe(true);
  });

  it('rejects unknown filters, unstable sorts, and untrusted scope values', () => {
    expect(() =>
      createHrm012QueryRequest(HRM012_TEST_SCOPE, { filter: { tenantId: 'tenant-one' } })
    ).toThrow('request.filter');
    expect(() =>
      createHrm012QueryRequest(HRM012_TEST_SCOPE, {
        sort: ['qualityFinding:DESC', 'commandReceipt:ASC', 'ingestionStatus:ASC'],
      })
    ).toThrow('request.sort');
    expect(() =>
      assertHrm012TrustedScope({ ...HRM012_TEST_SCOPE, tenantId: 'tenant-one' })
    ).toThrow('scope');
    expect(() =>
      assertHrm012TrustedScope({ ...HRM012_TEST_SCOPE, timeZone: 'Mars/Olympus' })
    ).toThrow('localeOrTimeZone');
  });

  it('parses typed VIEW and MASK decisions and counts omitted groups without materializing them', () => {
    const projection = selectHrm012Projection(hrm012ProjectionWire());
    expect(projection.projectionVersion).toBe('1');
    expect(projection.items[0]?.fieldGroups.INGESTION_STATUS).toEqual({
      decision: 'VIEW',
      value: { code: 'APPLIED', revision: 7 },
    });
    expect(projection.items[0]?.fieldGroups.QUALITY_FINDING).toEqual({
      decision: 'MASK',
      value: null,
      maskReason: 'FIELD_POLICY',
      maskedDisplayKey: 'hris.data_quality.restricted',
    });
    expect(projection.items[0]?.availableActions).toEqual([]);

    const omitted = selectHrm012Projection(hrm012OmittedProjectionWire());
    expect(Object.keys(omitted.items[0]!.fieldGroups)).toEqual(['INGESTION_STATUS']);
    expect(omitted.queryState.fieldDecisionSummary).toEqual({
      viewCount: 1,
      maskedCount: 0,
      omittedCount: 2,
    });
  });

  it('fails closed for additive data, action, deep-link, summary, and state violations', () => {
    const additive = hrm012ProjectionWire();
    Object.assign(additive.items[0]!, { rawSourceValue: 'restricted' });
    expect(() => selectHrm012Projection(additive)).toThrow('items[0]');

    const action = hrm012ProjectionWire();
    action.items[0]!.availableActions = [{ actionKey: 'replay' }] as never[];
    expect(() => selectHrm012Projection(action)).toThrow('availableActions');

    const deepLink = hrm012ProjectionWire();
    deepLink.items[0]!.deepLink.resourcePublicId = 'different-item';
    expect(() => selectHrm012Projection(deepLink)).toThrow('deepLink.resourcePublicId');

    const summary = hrm012ProjectionWire();
    summary.queryState.fieldDecisionSummary.viewCount = 99;
    expect(() => selectHrm012Projection(summary)).toThrow('fieldDecisionSummary');

    const partial = hrm012ProjectionWire('PARTIAL');
    partial.queryState.partialFailures = [];
    expect(() => selectHrm012Projection(partial)).toThrow('queryState.cardinality');

    const unavailable = hrm012ProjectionWire('UNAVAILABLE');
    unavailable.queryState.freshness = 'CURRENT';
    expect(() => selectHrm012Projection(unavailable)).toThrow('queryState.cardinality');
  });
});
