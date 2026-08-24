import { describe, expect, it } from 'vitest';

import { PILOT_AUTHORIZATION_FIXTURES } from './pilot-authorization-fixtures.generated';
import {
  selectPilotAuthorizationContextCase,
  selectPilotAuthorizationNegativeCase,
  selectPilotAuthorizationTestCase,
  toPilotAccessStateFixture,
  toPilotE2ESessionFixture,
  toPilotMenuFixture,
  toPilotRouteFixture,
} from './pilot-authorization-fixture-adapter';

describe('pilot authorization fixture adapter', () => {
  it('selects the same canonical case by test and fixture identifiers', () => {
    const byTest = selectPilotAuthorizationTestCase({ testId: 'PS-A002' });
    const byFixture = selectPilotAuthorizationTestCase({ fixtureId: 'FX-A-DESIGNER' });

    expect(byTest).toBe(byFixture);
    expect(byTest.composition).toEqual(['AP_WORK_MEMBER', 'AP_DESIGN_DRAFT']);
    expect(byTest.expected).toBe('DESIGN_DRAFT_ONLY');
  });

  it('projects only canonical source records without deriving allow or grants', () => {
    const projection = toPilotRouteFixture({ testId: 'PS-A002' });

    expect(projection.projectionKind).toBe('ROUTE');
    expect(projection.composition).toEqual([
      expect.objectContaining({ source: 'COMPONENT', reference: 'AP_WORK_MEMBER' }),
      expect.objectContaining({ source: 'COMPONENT', reference: 'AP_DESIGN_DRAFT' }),
    ]);
    expect(projection).not.toHaveProperty('allowed');
    expect(projection).not.toHaveProperty('grants');
    expect(projection).not.toHaveProperty('routeGrants');
    expect(projection).not.toHaveProperty('permissions');
    expect(projection.expectedOutcome).toBe('DESIGN_DRAFT_ONLY');
  });

  it('preserves the exact registry gate required by each wave and guard case', () => {
    const expected = [
      ['PS-C001', 1, 'bc34f47b0ad783d27aa7979f25f75e2fdf29506a12a23c0088f94837abad0b67'],
      ['PS-A002', 2, '5b634a35472ef98ecdd5ca9efe7a716020d8f3ae0d8f5025d76bbf072692c12c'],
      ['PS-H001', 3, 'f90c4e3a734204a4619ae77d3476ebc7cc802c43ed8574fcf4f3fc85def67a8e'],
      ['PS-G004', 2, '5b634a35472ef98ecdd5ca9efe7a716020d8f3ae0d8f5025d76bbf072692c12c'],
      ['PS-G013', 3, 'f90c4e3a734204a4619ae77d3476ebc7cc802c43ed8574fcf4f3fc85def67a8e'],
    ] as const;

    for (const [testId, version, sha256] of expected) {
      expect(toPilotRouteFixture({ testId }).registryRef).toEqual({
        bundleKey: 'product-surfaces',
        version,
        sha256,
      });
    }
  });

  it('keeps contract-test overrides explicit', () => {
    const projection = toPilotAccessStateFixture({ testId: 'PS-G006' });

    expect(projection.testRegistryOverrideRef).toBe('test.management-and-app.v1');
  });

  it('keeps CASE directives opaque instead of evaluating them', () => {
    const projection = toPilotAccessStateFixture({ testId: 'PS-G008' });

    expect(projection.composition).toContainEqual({
      source: 'CASE_DIRECTIVE',
      reference: 'CASE:RESPONSIBILITY_ONLY_RS_SERVICES',
    });
  });

  it('uses the same source selection for every frontend test projection', () => {
    const selector = { testId: 'PS-C001' };
    const projections = [
      toPilotMenuFixture(selector),
      toPilotRouteFixture(selector),
      toPilotAccessStateFixture(selector),
      toPilotE2ESessionFixture(selector),
    ];

    expect(projections.map((projection) => projection.projectionKind)).toEqual([
      'MENU',
      'ROUTE',
      'ACCESS_STATE',
      'E2E_SESSION',
    ]);
    expect(projections.map((projection) => projection.testCase)).toEqual([
      projections[0]?.testCase,
      projections[0]?.testCase,
      projections[0]?.testCase,
      projections[0]?.testCase,
    ]);
    expect(
      projections.every(
        (projection) => projection.fixedClock === PILOT_AUTHORIZATION_FIXTURES.fixedClock
      )
    ).toBe(true);
  });

  it('exposes negative and context cases without interpreting their outcomes', () => {
    expect(selectPilotAuthorizationNegativeCase('FX-N-MANAGE-ONLY').expected).toBe(
      'DENY_ALL_V2_MUTATIONS'
    );
    expect(selectPilotAuthorizationContextCase('FX-C-SOURCE-REVISION').expected).toBe(
      'NEW_COMPOSITE_REVISION_AND_OLD_MUTATION_409'
    );
  });

  it('fails closed for an unknown or ambiguous selector', () => {
    expect(() => selectPilotAuthorizationTestCase({ testId: 'PS-A999' })).toThrow(
      /resolved 0 records/
    );
    expect(() =>
      selectPilotAuthorizationTestCase(
        { fixtureId: 'FX-DUPLICATE' },
        {
          ...PILOT_AUTHORIZATION_FIXTURES,
          testCases: [
            { ...PILOT_AUTHORIZATION_FIXTURES.testCases[0], fixtureId: 'FX-DUPLICATE' },
            { ...PILOT_AUTHORIZATION_FIXTURES.testCases[1], fixtureId: 'FX-DUPLICATE' },
          ],
        }
      )
    ).toThrow(/resolved 2 records/);
  });
});
