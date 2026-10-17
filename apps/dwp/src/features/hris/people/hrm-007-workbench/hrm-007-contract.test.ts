import { describe, expect, it } from 'vitest';

import {
  HRM007_QUERY_CONTRACTS,
  Hrm007ContractError,
  assertHrm007TrustedScope,
  createHrm007QueryRequest,
  selectHrm007Projection,
} from './hrm-007-contract';
import { HRM007_TEST_SCOPE, hrm007ProjectionWire } from './hrm-007-fixtures.test-support';

import type { Hrm007QueryId } from './hrm-007-contract';

const QUERY_IDS: readonly Hrm007QueryId[] = ['IAQ-005', 'IAQ-007', 'IAQ-013'];

describe('HRM-007 sealed entry-query contract', () => {
  it.each(QUERY_IDS)('selects the exact %s variant, route, groups, and actions', (queryId) => {
    const selected = selectHrm007Projection(queryId, hrm007ProjectionWire(queryId));
    const contract = HRM007_QUERY_CONTRACTS[queryId];

    expect(selected.variantKey).toBe(contract.variantKey);
    expect(selected.items[0]?.deepLink.route).toBe(contract.route);
    expect(Object.keys(selected.items[0]?.fieldGroups ?? {}).sort()).toEqual(
      [...contract.fieldGroups].sort()
    );
    expect(selected.items[0]?.availableActions.map((action) => action.actionKey)).toEqual(
      contract.actions.map((action) => action.actionKey)
    );
    expect(Object.isFrozen(selected)).toBe(true);
  });

  it('keeps EFFECTIVE_ON request-only and rejects it as a response field group', () => {
    const wire = hrm007ProjectionWire('IAQ-005');
    wire.items[0]!.fieldGroups.EFFECTIVE_ON = {
      decision: 'VIEW',
      value: { effectiveFrom: '2026-10-17', effectiveTo: null, revision: 1 },
    };
    wire.queryState.fieldDecisionSummary.viewCount += 1;
    expect(() => selectHrm007Projection('IAQ-005', wire)).toThrow(/fieldGroups/u);
  });

  it('enforces EMPTY, PARTIAL, COMPLETE, and UNAVAILABLE cardinality invariants', () => {
    for (const queryId of QUERY_IDS) {
      expect(selectHrm007Projection(queryId, hrm007ProjectionWire(queryId, 'EMPTY')).items).toEqual(
        []
      );
      expect(
        selectHrm007Projection(queryId, hrm007ProjectionWire(queryId, 'PARTIAL')).queryState
          .partialFailures
      ).toHaveLength(1);
      expect(
        selectHrm007Projection(queryId, hrm007ProjectionWire(queryId, 'UNAVAILABLE')).queryState
          .freshness
      ).toBe('UNAVAILABLE');
    }

    const falseEmpty = hrm007ProjectionWire('IAQ-005');
    falseEmpty.queryState.state = 'EMPTY';
    expect(() => selectHrm007Projection('IAQ-005', falseEmpty)).toThrow(/cardinality/u);

    const falsePartial = hrm007ProjectionWire('IAQ-007');
    falsePartial.queryState.state = 'PARTIAL';
    expect(() => selectHrm007Projection('IAQ-007', falsePartial)).toThrow(/cardinality/u);

    const falseComplete = hrm007ProjectionWire('IAQ-013', 'PARTIAL');
    falseComplete.queryState.state = 'COMPLETE';
    expect(() => selectHrm007Projection('IAQ-013', falseComplete)).toThrow(/cardinality/u);

    const unavailableWithoutUnavailableFreshness = hrm007ProjectionWire('IAQ-005', 'UNAVAILABLE');
    unavailableWithoutUnavailableFreshness.queryState.freshness = 'CURRENT';
    expect(() => selectHrm007Projection('IAQ-005', unavailableWithoutUnavailableFreshness)).toThrow(
      Hrm007ContractError
    );
  });

  it('matches VIEW, MASK, and omitted fields to the authoritative decision summary', () => {
    const wire = hrm007ProjectionWire('IAQ-013');
    wire.items[0]!.fieldGroups.EMPLOYMENT_RULE = {
      decision: 'MASK',
      value: null,
      maskReason: 'FIELD_POLICY',
      maskedDisplayKey: 'hris.masked.field',
    };
    delete wire.items[0]!.fieldGroups.IMPACT_SUMMARY;
    wire.queryState.fieldDecisionSummary = { viewCount: 1, maskedCount: 1, omittedCount: 1 };

    expect(selectHrm007Projection('IAQ-013', wire).queryState.fieldDecisionSummary).toEqual({
      viewCount: 1,
      maskedCount: 1,
      omittedCount: 1,
    });

    wire.queryState.fieldDecisionSummary.viewCount = 2;
    expect(() => selectHrm007Projection('IAQ-013', wire)).toThrow(/fieldDecisionSummary/u);
  });

  it('rejects foreign routes, action substitutions, duplicates, and trusted-context disclosure', () => {
    const wrongRoute = hrm007ProjectionWire('IAQ-005');
    wrongRoute.items[0]!.deepLink.route = '/hr/operations/people/appointments';
    expect(() => selectHrm007Projection('IAQ-005', wrongRoute)).toThrow(/deepLink/u);

    const wrongAction = hrm007ProjectionWire('IAQ-007');
    wrongAction.items[0]!.availableActions[0]!.hrefTemplate = '/api/people/v1/unsafe';
    expect(() => selectHrm007Projection('IAQ-007', wrongAction)).toThrow(/availableActions/u);

    const duplicate = hrm007ProjectionWire('IAQ-005');
    duplicate.items.push(structuredClone(duplicate.items[0]!));
    expect(() => selectHrm007Projection('IAQ-005', duplicate)).toThrow(/itemPublicId/u);

    const disclosed = hrm007ProjectionWire('IAQ-013') as unknown as Record<string, unknown>;
    disclosed.tenantId = 'tenant-one';
    expect(() => selectHrm007Projection('IAQ-013', disclosed)).toThrow(/root/u);
  });

  it('builds bounded requests with exact filters and a stable itemPublicId tie-breaker', () => {
    const peopleChanges = createHrm007QueryRequest('IAQ-005', HRM007_TEST_SCOPE, {
      filter: {
        changeRequestSummary: { minimumItemCount: 1, maximumItemCount: 20 },
        approvalStatus: { codes: ['APPROVED'], minimumRevision: 2 },
        effectiveOn: '2026-10-17',
      },
      sort: ['approvalStatus:DESC'],
      asOf: '2026-10-17T00:00:00Z',
    });
    expect(peopleChanges.limit).toBe(100);
    expect(peopleChanges.sort).toEqual(['approvalStatus:DESC', 'itemPublicId:ASC']);
    expect(JSON.stringify(peopleChanges)).not.toContain('tenant');
    expect(peopleChanges.filter).toMatchObject({ effectiveOn: '2026-10-17' });

    expect(() =>
      createHrm007QueryRequest('IAQ-005', HRM007_TEST_SCOPE, {
        filter: { appointment: { startFrom: '2026-10-17T00:00:00Z' } },
      })
    ).toThrow(/request\.filter\.appointment/u);
    expect(() =>
      createHrm007QueryRequest('IAQ-013', HRM007_TEST_SCOPE, {
        sort: ['appointment:ASC'],
      })
    ).toThrow(/request\.sort/u);
  });

  it('canonicalizes trusted locale and time-zone aliases before request identity is built', () => {
    const trusted = assertHrm007TrustedScope({
      ...HRM007_TEST_SCOPE,
      locale: 'EN-us',
      timeZone: 'US/Pacific',
    });

    expect(trusted.locale).toBe('en-US');
    expect(trusted.timeZone).toBe('America/Los_Angeles');
    expect(createHrm007QueryRequest('IAQ-005', trusted)).toMatchObject({
      locale: 'en-US',
      timeZone: 'America/Los_Angeles',
    });
  });
});
