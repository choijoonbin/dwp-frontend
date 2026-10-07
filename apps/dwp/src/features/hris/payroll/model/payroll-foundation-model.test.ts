import { describe, expect, it } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  PAYROLL_FOUNDATION_CONTRACT,
  classifyFoundationCommandFailure,
  effectiveFoundationAccess,
  foundationDefinitionFromDraft,
  foundationDraftFromConfiguration,
  foundationPublishBlockers,
  selectFoundationCommandResult,
  selectFoundationConfiguration,
  selectFoundationWorkspace,
  validateFoundationDraft,
} from './payroll-foundation-model';
import {
  foundationWire,
  mutationWire,
  workspaceWire,
} from '../testing/payroll-foundation-fixtures.test-support';

describe('payroll foundation canonical wire projection', () => {
  it('projects the backend-shaped multi-currency configuration without float conversion', () => {
    const model = selectFoundationConfiguration(foundationWire());

    expect(model).toMatchObject({
      id: '10000000-0000-4000-8000-000000000001',
      version: 3,
      status: 'SIMULATED',
      authorId: 101,
      publisherId: null,
      simulation: { successful: true, configurationVersion: 3 },
      access: { canPublish: true },
      freshness: { state: 'LIVE' },
    });
    expect(model.definition.payrollGroup.currencies).toEqual(['XTS', 'XUA']);
    expect(model.definition.roundingPolicies.XUA.increment).toBe('0.0001');
    expect(typeof model.definition.roundingPolicies.XUA.increment).toBe('string');
    expect(model.definition.effectivePeriod.endsOn).toBeNull();
    expect(model.definition.legalEntity.countryPack.version).toBe(2);
    expect(model.definition.dependencies[0]?.version).toBe(7);
  });

  it.each([
    ['configuration.version', () => foundationWire({ version: '3' })],
    [
      'countryPack.version',
      () => {
        const value = foundationWire();
        value.definition.legalEntity.countryPack.version = '2' as unknown as number;
        return value;
      },
    ],
    [
      'dependency.version',
      () => {
        const value = foundationWire();
        value.definition.dependencies[0]!.version = '7' as unknown as number;
        return value;
      },
    ],
    [
      'rounding increment number',
      () => {
        const value = foundationWire();
        value.definition.roundingPolicies.XTS.increment = 0.01 as unknown as string;
        return value;
      },
    ],
  ])('rejects non-canonical %s', (_label, fixture) => {
    expect(() => selectFoundationConfiguration(fixture())).toThrow(
      /Invalid payroll foundation source/
    );
  });

  it('rejects overlapping periods and incomplete multi-currency rounding maps', () => {
    const overlap = foundationWire();
    overlap.definition.payCalendar.periods[1]!.startsOn = '2026-10-15';
    expect(() => selectFoundationConfiguration(overlap)).toThrow(/payCalendar\.periods/);

    const missingPolicy = foundationWire();
    Reflect.deleteProperty(missingPolicy.definition.roundingPolicies, 'XUA');
    expect(() => selectFoundationConfiguration(missingPolicy)).toThrow(/roundingPolicies/);
  });

  it.each([
    [
      'non-UUID identifiers',
      () => {
        const value = foundationWire();
        Reflect.set(value.definition.legalEntity, 'id', 'not-a-uuid');
        return value;
      },
    ],
    [
      'unsupported codes',
      () => {
        const value = foundationWire();
        value.definition.payrollGroup.code = 'GROUP WITH SPACES';
        return value;
      },
    ],
    [
      'non-ISO currencies',
      () => {
        const value = foundationWire();
        value.definition.payrollGroup.currencies[0] = 'ABC';
        return value;
      },
    ],
    [
      'non-UUID receipt identifiers',
      () => mutationWire({ receipt: { ...mutationWire().receipt, commandId: 'command-1' } }),
    ],
  ])('rejects %s at the owner response boundary', (_label, fixture) => {
    const value = fixture();
    expect(() =>
      'receipt' in value
        ? selectFoundationCommandResult(value)
        : selectFoundationConfiguration(value)
    ).toThrow(/Invalid payroll foundation source/);
  });

  it('accepts an authorized empty workspace and escalates partial owner failures', () => {
    const empty = selectFoundationWorkspace(
      workspaceWire({ configurations: [], access: { ...foundationWire().access, canCreate: true } })
    );
    expect(empty.configurations).toEqual([]);
    expect(empty.access.canCreate).toBe(true);

    const partial = selectFoundationWorkspace(
      workspaceWire({ partialFailures: [{ source: 'POLICY_OWNER', code: 'SOURCE_UNAVAILABLE' }] })
    );
    expect(partial.freshness).toBe('PARTIAL');
    expect(partial.configurations).toHaveLength(1);
  });

  it('maps durable MutationResult receipt fields exactly', () => {
    expect(selectFoundationCommandResult(mutationWire())).toMatchObject({
      receipt: {
        commandType: 'SIMULATE',
        status: 'SUCCEEDED',
        resultVersion: 3,
        reversalOfCommandId: null,
        completedAt: '2026-09-17T02:00:01Z',
      },
      configuration: { version: 3, status: 'SIMULATED' },
    });
  });
});

describe('payroll foundation draft and release policy', () => {
  it('keeps an open-ended effective period valid and emits null on the wire', () => {
    const configuration = selectFoundationConfiguration(foundationWire());
    const draft = foundationDraftFromConfiguration(configuration);

    expect(draft.effectiveEndsOn).toBe('');
    expect(validateFoundationDraft(draft)).toEqual({ valid: true, errors: [] });
    expect(foundationDefinitionFromDraft(draft).effectivePeriod.endsOn).toBeNull();
  });

  it('rejects unsafe numeric versions before conversion', () => {
    const draft = foundationDraftFromConfiguration(selectFoundationConfiguration(foundationWire()));
    draft.countryPackVersion = '9007199254740992';
    expect(validateFoundationDraft(draft)).toMatchObject({ valid: false });
    expect(() => foundationDefinitionFromDraft(draft)).toThrow(/draft is invalid/);
  });

  it('rejects overlapping draft periods and non-canonical country-pack digests', () => {
    const draft = foundationDraftFromConfiguration(selectFoundationConfiguration(foundationWire()));
    draft.periods[1]!.startsOn = draft.periods[0]!.endsOn;
    draft.countryPackDigest = 'not-a-sha-256';

    const validation = validateFoundationDraft(draft);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('CALENDAR_PERIODS');
    expect(validation.errors).toContain('COUNTRY_PACK_DIGEST');
  });

  it('rejects draft identifiers, codes, dates and currencies that the owner rejects', () => {
    const draft = foundationDraftFromConfiguration(selectFoundationConfiguration(foundationWire()));
    draft.legalEntityId = 'foo';
    draft.legalEntityCode = 'contains spaces';
    draft.currencies = 'XTS, ABC';
    draft.effectiveStartsOn = '2026-02-30';

    const validation = validateFoundationDraft(draft);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining(['IDENTIFIERS', 'IDENTITY_FIELDS', 'CURRENCIES', 'EFFECTIVE_PERIOD'])
    );
    expect(() => foundationDefinitionFromDraft(draft)).toThrow(/draft is invalid/);
  });

  it('uses only server-projected publish access and current simulation evidence', () => {
    const configuration = selectFoundationConfiguration(foundationWire());
    const workspace = selectFoundationWorkspace(
      workspaceWire({
        access: { ...foundationWire().access, canPublish: true },
      })
    );
    expect(effectiveFoundationAccess(workspace, configuration)).toBe(configuration.access);
    expect(foundationPublishBlockers(configuration, configuration.access)).toEqual([]);

    const denied = selectFoundationConfiguration(
      foundationWire({
        access: {
          ...foundationWire().access,
          canPublish: false,
          publishDenialCode: 'SOD_AUTHOR_CANNOT_PUBLISH',
        },
      })
    );
    expect(foundationPublishBlockers(denied, denied.access)).toContain('SOD_AUTHOR_CANNOT_PUBLISH');

    const stale = selectFoundationConfiguration(
      foundationWire({
        freshness: { state: 'STALE', lastSuccessfulRefreshAt: '2026-09-17T02:00:00Z' },
      })
    );
    expect(foundationPublishBlockers(stale, stale.access)).toContain('DEPENDENCY_STALE');

    const partial = selectFoundationConfiguration(
      foundationWire({
        freshness: { state: 'PARTIAL', lastSuccessfulRefreshAt: '2026-09-17T02:00:00Z' },
      })
    );
    expect(foundationPublishBlockers(partial, partial.access)).toContain('DEPENDENCY_PARTIAL');
  });

  it('classifies conflict, permission and uncertain transport outcomes without assuming success', () => {
    expect(classifyFoundationCommandFailure(new HttpError('changed', 409))).toEqual({
      kind: 'CONFLICT',
      preserveDraft: true,
    });
    expect(classifyFoundationCommandFailure(new HttpError('denied', 403))).toEqual({
      kind: 'PERMISSION',
      preserveDraft: true,
    });
    expect(classifyFoundationCommandFailure(new HttpTransportError('NETWORK'))).toEqual({
      kind: 'RESULT_UNKNOWN',
      preserveDraft: true,
    });
    expect(classifyFoundationCommandFailure(new HttpError('gateway failed', 503))).toEqual({
      kind: 'RESULT_UNKNOWN',
      preserveDraft: true,
    });
  });

  it('pins the bounded slice outside calculation and settlement execution', () => {
    expect(PAYROLL_FOUNDATION_CONTRACT).toMatchObject({
      sliceId: 'BASE-TFR-PAY-007',
      pageArchetype: 'STUDIO',
      calculatesPayroll: false,
      initiatesPayment: false,
      storesBankDetails: false,
      authorPublisherSeparation: 'SERVER_PROJECTED_FAIL_CLOSED',
    });
  });
});
