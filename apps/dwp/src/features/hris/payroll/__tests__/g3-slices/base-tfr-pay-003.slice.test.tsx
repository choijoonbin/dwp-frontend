/// <reference types="node" />
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DesignSystem from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const transport = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: transport,
}));

// Domain assertions drive the scalar picker contract; DS tests cover section editing.
vi.mock('@dwp-frontend/design-system', async (importOriginal) => {
  const actual = await importOriginal<typeof DesignSystem>();
  return {
    ...actual,
    DatePickerField: ({
      id,
      label,
      value,
      onValueChange,
      disabled,
      required,
      size,
      fullWidth,
      errorMessage,
      supportingText,
    }: Parameters<typeof actual.DatePickerField>[0]) => (
      <actual.FormField
        id={id}
        label={label}
        type="date"
        value={value ?? ''}
        onChange={(event) => onValueChange(event.target.value || null)}
        disabled={disabled}
        required={required}
        size={size}
        fullWidth={fullWidth}
        errorMessage={errorMessage}
        supportingText={supportingText}
      />
    ),
  };
});

import {
  COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY,
  CountryPackActivationOutcomeUnknownError,
  HrisPayTaxSocialInsuranceWorkbench,
  HrisStatutoryConfigurationWorkbench,
  MISSING_TAX_PRODUCER_COMPONENT,
  MISSING_TAX_PRODUCER_ERROR,
  SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY,
  SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY,
  STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY,
  STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY,
  STATUTORY_INSURANCE_DEFAULT_ROLLOUT,
  STATUTORY_INSURANCE_FEATURE,
  STATUTORY_INSURANCE_RESPONSIVE_CONTRACT,
  activateCountryPack,
  parsePayrollCommandReceipt,
  parseSocialInsuranceProjection,
  parseStatutoryConfigurationProjection,
  queryStatutoryConfiguration,
  statutoryConfigurationItemIsSafeToActivate,
  statutoryInsurancePrimaryLayoutAtViewport,
  validateCountryPackActivationCommand,
  validateSocialInsuranceQuery,
  validateStatutoryConfigurationQuery,
} from '../../statutory-insurance';

import type {
  CountryPackActivationAuthority,
  CountryPackActivationCommandBinding,
  CountryPackActivationCommandExecutor,
  CountryPackActivationCommand,
  SocialInsuranceOwnerBinding,
  StatutoryConfigurationOwnerBinding,
  StatutoryInsuranceDataSource,
  StatutoryInsuranceTrustedAdmission,
} from '../../statutory-insurance';

const AC = Object.freeze(
  Array.from({ length: 14 }, (_, index) => `PAY003-AC${String(index + 1).padStart(2, '0')}`)
);

const ids = Object.freeze({
  pack: 'aaaaaaaa-aaaa-0000-0000-aaaaaaaaaaaa',
  workerResult: 'bbbbbbbb-bbbb-0000-0000-bbbbbbbbbbbb',
  query: 'cccccccc-cccc-0000-0000-cccccccccccc',
  failure: 'cccccccc-cccc-0000-0000-cccccccccccc',
  idempotency: 'dddddddd-dddd-0000-0000-dddddddddddd',
  commandCorrelation: 'eeeeeeee-eeee-0000-0000-eeeeeeeeeeee',
  approval: 'ffffffff-ffff-0000-0000-ffffffffffff',
  receipt: '11111111-1111-0000-0000-111111111111',
  subject: '22222222-2222-0000-0000-222222222222',
});

const DECISION_REVISION = 'authorization-revision-54';
const SCOPE_DECISION_REVISION = 'population-scope-revision-12';
const CONTEXT_KEY = `psc-${'a'.repeat(64)}`;
const CONTEXT_SCOPE = 'tenant:tenant-a/legal-entity:seoul/pay-group:monthly';
const NEXT_CURSOR = 'eyJvZmZzZXQiOjF9YWJj';

function queryState(
  state: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE',
  viewCount: number,
  omittedCount = 0
) {
  return {
    state,
    scopeDecisionRevision: SCOPE_DECISION_REVISION,
    freshness: state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CURRENT',
    nextCursor: state === 'COMPLETE' ? NEXT_CURSOR : null,
    fieldDecisionSummary: { viewCount, maskedCount: 0, omittedCount },
    partialFailures:
      state === 'PARTIAL'
        ? [
            {
              componentKey: MISSING_TAX_PRODUCER_COMPONENT,
              errorCode: MISSING_TAX_PRODUCER_ERROR,
              correlationId: ids.failure,
              retryable: true,
            },
          ]
        : [],
    correlationId: ids.query,
    cachePolicy: {
      authorizationDecisionRevision: DECISION_REVISION,
      invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
      maxAgeSeconds: 30,
    },
  };
}

function settingsWire(
  options: { state?: 'COMPLETE' | 'EMPTY' | 'UNAVAILABLE'; action?: boolean } = {}
) {
  const state = options.state ?? 'COMPLETE';
  const hasItem = state === 'COMPLETE';
  return {
    projectionVersion: '2',
    asOf: '2026-10-19T05:00:00Z',
    variantKey: 'STATUTORY',
    queryState: queryState(state, hasItem ? 3 : 0),
    items: hasItem
      ? [
          {
            itemPublicId: ids.pack,
            title: '대한민국 사회보험 공식 패키지 / Republic of Korea social insurance pack',
            statusCode: 'APPROVED',
            fieldGroups: {
              COUNTRY_PACK_METADATA: {
                decision: 'VIEW',
                value: { key: 'kr.social-insurance', version: '2026.10', digest: 'a'.repeat(64) },
              },
              STATUTORY_RULE: {
                decision: 'VIEW',
                value: {
                  policyKey: 'kr.social-insurance',
                  revision: 12,
                  effectiveFrom: '2026-11-01',
                  effectiveTo: null,
                  status: 'APPROVED',
                },
              },
              ACTIVATION_STATUS: {
                decision: 'VIEW',
                value: { code: 'APPROVED', revision: 7 },
              },
            },
            deepLink: { route: '/hr/settings/statutory', resourcePublicId: ids.pack },
            availableActions:
              options.action === false
                ? []
                : [
                    {
                      actionKey: 'hris.action.pay.country.pack.activate',
                      method: 'POST',
                      targetResourceType: 'COUNTRY_PACK',
                      targetResourcePublicId: ids.pack,
                      resolvedHref: `/api/payroll/v1/country-packs/${ids.pack}/activate`,
                      idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
                      stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
                    },
                  ],
          },
        ]
      : [],
  };
}

function socialWire(amount = '825000.0000') {
  return {
    projectionVersion: '1',
    asOf: '2026-10-19T05:00:00Z',
    variantKey: 'TAX_SOCIAL_INSURANCE',
    queryState: queryState('PARTIAL', 2),
    items: [
      {
        itemPublicId: ids.workerResult,
        title: 'Worker payroll result',
        statusCode: 'CALCULATED',
        fieldGroups: {
          SOCIAL_INSURANCE: { decision: 'VIEW', value: { amount, currency: 'KRW' } },
          POLICY_VERSION: {
            decision: 'VIEW',
            value: {
              policyKey: 'kr.social-insurance',
              revision: 12,
              effectiveFrom: '2026-11-01',
              effectiveTo: null,
              status: 'ACTIVE',
            },
          },
        },
        deepLink: {
          route: '/hr/operations/payroll/tax-social-insurance',
          resourcePublicId: ids.workerResult,
        },
        availableActions: [],
      },
    ],
  };
}

function command(): CountryPackActivationCommand {
  return {
    packId: ids.pack,
    expectedActivationRevision: 7,
    idempotencyKey: ids.idempotency,
    correlationId: ids.commandCorrelation,
    request: {
      officialReferenceSet: 'MOEL-2026-11',
      effectiveDate: '2026-11-01',
      goldenPackDigest: 'b'.repeat(64),
      statutoryApprovalReceiptId: ids.approval,
    },
  };
}

function receipt(aggregateVersion = 8) {
  return {
    receiptId: ids.receipt,
    commandType: 'COUNTRY_PACK_ACTIVATE',
    originatingAction: 'PAY_COUNTRY_PACK_ACTIVATE',
    subjectPrincipalPublicId: ids.subject,
    populationScopeDigest: 'c'.repeat(64),
    fieldPolicyRevision: 54,
    purposeCode: 'STATUTORY_CONFIGURATION',
    authorizationRevision: 54,
    status: 'SUCCEEDED',
    correlationId: ids.commandCorrelation,
    requestDigest: 'd'.repeat(64),
    createdAt: '2026-10-19T05:01:00Z',
    aggregateVersion,
    resultRef: `country-pack:${ids.pack}:activation:8`,
  };
}

function governance(
  overrides: Record<string, unknown> = {}
): ProductSurfaceGovernedMutationAuthority {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: DECISION_REVISION,
    contextKey: CONTEXT_KEY,
    contextScopeKey: CONTEXT_SCOPE,
    objectVersion: 7,
    idempotencyKey: ids.idempotency,
    stepUp: {
      challenge: 'signed-statutory-step-up-proof',
      challengeId: 'statutory-step-up-54',
      decisionRevision: DECISION_REVISION,
      expiresAt: '2099-01-01T00:00:00Z',
    },
    ...overrides,
  } as ProductSurfaceGovernedMutationAuthority;
}

function authority(
  overrides: Partial<CountryPackActivationAuthority> = {}
): CountryPackActivationAuthority {
  return {
    routeContractKey: COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY,
    governance: governance(),
    contextKey: CONTEXT_KEY,
    contextScopeKey: CONTEXT_SCOPE,
    decisionRevision: DECISION_REVISION,
    idempotencyKey: ids.idempotency,
    correlationId: ids.commandCorrelation,
    expectedObjectVersion: 7,
    ...overrides,
  };
}

const rollout = Object.freeze({
  feature: STATUTORY_INSURANCE_FEATURE,
  enabled: true,
  enrolledTenantIds: Object.freeze(['tenant-a']),
});

function admission(
  pageRouteContractKey:
    | typeof STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY
    | typeof SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY
): StatutoryInsuranceTrustedAdmission {
  return {
    kind: 'TRUSTED_PRODUCT_SURFACE_PAGE',
    feature: STATUTORY_INSURANCE_FEATURE,
    pageRouteContractKey,
    tenantId: 'tenant-a',
    contextKey: CONTEXT_KEY,
    contextScopeKey: CONTEXT_SCOPE,
    decisionRevision: DECISION_REVISION,
  };
}

function settingsBinding(
  read: StatutoryInsuranceDataSource['statutoryConfiguration'],
  execute: CountryPackActivationCommandExecutor
): StatutoryConfigurationOwnerBinding {
  return {
    page: { routeContractKey: STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY },
    data: {
      contractId: 'IAQ-026',
      routeContractKey: STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY,
      read,
    },
    activate: {
      contractId: 'PEP-PAY-028',
      routeContractKey: COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY,
      execute,
    },
  };
}

function operationsBinding(
  read: StatutoryInsuranceDataSource['socialInsurance']
): SocialInsuranceOwnerBinding {
  return {
    page: { routeContractKey: SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY },
    data: {
      contractId: 'IAQ-048',
      routeContractKey: SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY,
      read,
    },
  };
}

function button(label: string) {
  const result = [...document.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!(result instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return result;
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  });
}

describe('[SLICE:BASE-TFR-PAY-003] statutory insurance contract', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    transport.get.mockReset();
    transport.post.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('tracks all fourteen criteria and remains default-off, zero-enrollment, and unmounted', () => {
    expect(AC).toEqual(
      Array.from({ length: 14 }, (_, index) => `PAY003-AC${String(index + 1).padStart(2, '0')}`)
    );
    expect(STATUTORY_INSURANCE_DEFAULT_ROLLOUT).toEqual({
      feature: STATUTORY_INSURANCE_FEATURE,
      enabled: false,
      enrolledTenantIds: [],
    });
    const payrollIndex = readFileSync(
      join(process.cwd(), 'apps/dwp/src/features/hris/payroll/index.ts'),
      'utf8'
    );
    expect(payrollIndex).not.toContain('statutory-insurance');
  });

  it('makes zero owner calls and fails both direct surfaces closed while off or unenrolled', () => {
    const settingsRead = vi.fn();
    const operationsRead = vi.fn();
    const execute = vi.fn();
    act(() => {
      root.render(
        <>
          <HrisStatutoryConfigurationWorkbench
            admission={admission(STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY)}
            ownerBinding={settingsBinding(settingsRead, execute)}
          />
          <HrisPayTaxSocialInsuranceWorkbench
            rollout={{ ...rollout, enrolledTenantIds: [] }}
            admission={admission(SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY)}
            ownerBinding={operationsBinding(operationsRead)}
          />
        </>
      );
    });
    expect(document.body.textContent).toContain('not enabled');
    expect(settingsRead).not.toHaveBeenCalled();
    expect(operationsRead).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('accepts only a safe IAQ-026 action bound byte-for-byte to the canonical pack item', () => {
    const projection = parseStatutoryConfigurationProjection(settingsWire());
    expect(statutoryConfigurationItemIsSafeToActivate(projection, projection.items[0]!)).toBe(true);

    const mismatch = structuredClone(settingsWire());
    (
      mismatch.items[0]!.availableActions[0]! as { targetResourcePublicId: string }
    ).targetResourcePublicId = ids.workerResult;
    expect(() => parseStatutoryConfigurationProjection(mismatch)).toThrow();

    const repeated = structuredClone(settingsWire());
    repeated.items[0]!.availableActions[0]!.resolvedHref = `/api/payroll/v1/country-packs/${ids.pack}/activate?packId=${ids.pack}`;
    expect(() => parseStatutoryConfigurationProjection(repeated)).toThrow();

    const unsafe = structuredClone(settingsWire());
    unsafe.items[0]!.fieldGroups.ACTIVATION_STATUS.value.code = 'ACTIVE';
    expect(() => parseStatutoryConfigurationProjection(unsafe)).toThrow();

    const duplicates = structuredClone(settingsWire());
    duplicates.items.push(structuredClone(duplicates.items[0]!));
    duplicates.queryState.fieldDecisionSummary.viewCount = 6;
    expect(() => parseStatutoryConfigurationProjection(duplicates)).toThrow(/duplicate/u);
  });

  it('keeps IAQ-048 on workerResultId with two groups, exact missing-tax failure, and no actions', () => {
    const projection = parseSocialInsuranceProjection(socialWire());
    expect(projection.items[0]).toMatchObject({
      itemPublicId: ids.workerResult,
      availableActions: [],
    });
    expect(Object.keys(projection.items[0]!.fieldGroups).sort()).toEqual([
      'POLICY_VERSION',
      'SOCIAL_INSURANCE',
    ]);
    const complete = structuredClone(socialWire());
    complete.queryState = queryState('COMPLETE', 2);
    expect(() => parseSocialInsuranceProjection(complete)).toThrow(/taxProducer/u);
    const action = structuredClone(socialWire());
    (action.items[0]!.availableActions as unknown[]).push(
      structuredClone(settingsWire().items[0]!.availableActions[0]!)
    );
    expect(() => parseSocialInsuranceProjection(action)).toThrow();
    const tax = structuredClone(socialWire()) as ReturnType<typeof socialWire> & {
      items: Array<{ fieldGroups: Record<string, unknown> }>;
    };
    tax.items[0]!.fieldGroups.TAX_RESULT = {
      decision: 'VIEW',
      value: { amount: '1.0000', currency: 'KRW' },
    };
    expect(() => parseSocialInsuranceProjection(tax)).toThrow();
  });

  it('enforces canonical identifiers, PostedMoney NUMERIC(19,4), and positive receipt revisions', () => {
    for (const amount of ['-0', '-1.0000', '1000000000000000.0000', '1.00000', '1e3', '+1']) {
      expect(() => parseSocialInsuranceProjection(socialWire(amount))).toThrow();
    }
    expect(parseSocialInsuranceProjection(socialWire('999999999999999.9999'))).toBeTruthy();
    const upper = structuredClone(settingsWire());
    (upper.items[0]! as { itemPublicId: string }).itemPublicId = ids.pack.toUpperCase();
    expect(() => parseStatutoryConfigurationProjection(upper)).toThrow();
    expect(() => parsePayrollCommandReceipt({ ...receipt(), fieldPolicyRevision: 0 })).toThrow();
    expect(() => parsePayrollCommandReceipt({ ...receipt(), authorizationRevision: 0 })).toThrow();
    const uninstalled = structuredClone(settingsWire());
    uninstalled.items[0]!.fieldGroups.ACTIVATION_STATUS.value!.revision = 0;
    expect(() => parseStatutoryConfigurationProjection(uninstalled)).toThrow();
  });

  it('validates closed queries, stable tiebreaks, bounded filters, cursor, locale, and time zone', () => {
    const valid = validateStatutoryConfigurationQuery({
      limit: 100,
      filter: { countryPackMetadata: { keys: ['kr.social-insurance'] } },
      sort: ['countryPackMetadata:ASC', 'itemPublicId:ASC'],
      locale: 'en-US',
      timeZone: 'Asia/Seoul',
      correlationId: ids.query,
      cursor: NEXT_CURSOR,
    });
    expect(valid.cursor).toBe(NEXT_CURSOR);
    expect(
      validateStatutoryConfigurationQuery({
        ...valid,
        filter: { activationStatus: { minimumRevision: 1 } },
      }).filter.activationStatus
    ).toEqual({ minimumRevision: 1 });
    expect(() =>
      validateStatutoryConfigurationQuery({
        ...valid,
        filter: { activationStatus: { minimumRevision: 0 } },
      })
    ).toThrow();
    expect(() => validateStatutoryConfigurationQuery({ ...valid, tenantId: 'tenant-a' })).toThrow();
    expect(() =>
      validateStatutoryConfigurationQuery({ ...valid, sort: ['countryPackMetadata:ASC'] })
    ).toThrow();
    expect(() =>
      validateStatutoryConfigurationQuery({
        ...valid,
        sort: ['itemPublicId:ASC', 'countryPackMetadata:ASC'],
      })
    ).toThrow();
    expect(
      validateStatutoryConfigurationQuery({
        ...valid,
        sort: ['countryPackMetadata:ASC', 'countryPackMetadata:DESC', 'itemPublicId:ASC'],
      }).sort
    ).toEqual(['countryPackMetadata:ASC', 'countryPackMetadata:DESC', 'itemPublicId:ASC']);
    expect(
      validateStatutoryConfigurationQuery({
        ...valid,
        filter: { countryPackMetadata: { keys: [] } },
      }).filter.countryPackMetadata
    ).toEqual({ keys: [] });
    expect(() =>
      validateStatutoryConfigurationQuery({
        ...valid,
        filter: { countryPackMetadata: { versions: ['2026+10'] } },
      })
    ).toThrow();
    expect(
      validateStatutoryConfigurationQuery({
        ...valid,
        filter: { countryPackMetadata: { keys: ['valid'], versions: ['2026:10'] } },
      }).filter.countryPackMetadata
    ).toEqual({ keys: ['valid'], versions: ['2026:10'] });
    for (const filter of [
      { countryPackMetadata: { keys: ['.valid'] } },
      { countryPackMetadata: { versions: [':version'] } },
      { statutoryRule: { policyKeys: ['-policy'] } },
    ]) {
      expect(() => validateStatutoryConfigurationQuery({ ...valid, filter })).toThrow();
    }
    expect(() => validateStatutoryConfigurationQuery({ ...valid, limit: 101 })).toThrow();
    expect(
      validateSocialInsuranceQuery({
        limit: 100,
        filter: { taxResult: { minimumAmount: '-1.123456' } },
        sort: ['itemPublicId:ASC'],
        locale: 'en-US',
        timeZone: 'UTC',
        correlationId: ids.query,
      }).filter.taxResult
    ).toEqual({ minimumAmount: '-1.123456' });
    expect(
      validateSocialInsuranceQuery({
        limit: 100,
        filter: {},
        sort: ['taxResult:ASC', 'itemPublicId:ASC'],
        locale: 'en-US',
        timeZone: 'UTC',
        correlationId: ids.query,
      }).sort
    ).toEqual(['taxResult:ASC', 'itemPublicId:ASC']);
    expect(() =>
      validateSocialInsuranceQuery({
        limit: 100,
        filter: { socialInsurance: { minimumAmount: '10.0000', maximumAmount: '9.9999' } },
        sort: ['itemPublicId:ASC'],
        locale: 'en-US',
        timeZone: 'UTC',
        correlationId: ids.query,
      })
    ).toThrow();
    for (const group of ['taxResult', 'socialInsurance']) {
      for (const [minimumAmount, maximumAmount] of [
        ['-1.000000', '-1.000001'],
        ['9007199254740993', '9007199254740992'],
      ]) {
        expect(() =>
          validateSocialInsuranceQuery({
            limit: 100,
            filter: { [group]: { minimumAmount, maximumAmount } },
            sort: ['itemPublicId:ASC'],
            locale: 'en-US',
            timeZone: 'UTC',
            correlationId: ids.query,
          })
        ).toThrow();
      }
    }
  });

  it('serializes the accepted nested query wire and replays an opaque next cursor without authority fields', async () => {
    transport.get.mockResolvedValue({ status: 200, data: settingsWire() });
    const base = {
      limit: 100,
      filter: { countryPackMetadata: { keys: ['kr.social-insurance'] } },
      sort: ['countryPackMetadata:ASC', 'itemPublicId:ASC'] as const,
      locale: 'en-US',
      timeZone: 'Asia/Seoul',
      correlationId: ids.query,
    };
    const context = {
      routeContractKey: STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY,
      contextScopeKey: CONTEXT_SCOPE,
      decisionRevision: DECISION_REVISION,
    };
    const firstResponse = await queryStatutoryConfiguration(base, context);
    await queryStatutoryConfiguration({ ...base, cursor: NEXT_CURSOR }, context);
    const [firstUrl, firstConfig] = transport.get.mock.calls[0]!;
    const first = new URL(firstUrl, 'https://dwp.invalid');
    expect(first.pathname).toBe('/api/payroll/v1/workbench/configuration/statutory');
    expect(first.searchParams.getAll('sort')).toEqual([
      'countryPackMetadata:ASC',
      'itemPublicId:ASC',
    ]);
    expect(first.searchParams.getAll('filter[countryPackMetadata][keys]')).toEqual([
      'kr.social-insurance',
    ]);
    expect(first.searchParams.get('tenantId')).toBeNull();
    expect(first.searchParams.get('legalEntityPublicId')).toBeNull();
    expect(firstConfig.contextScopeKey).toBe(CONTEXT_SCOPE);
    expect(firstResponse.queryState.scopeDecisionRevision).toBe(SCOPE_DECISION_REVISION);
    expect(firstResponse.queryState.cachePolicy.authorizationDecisionRevision).toBe(
      DECISION_REVISION
    );
    const second = new URL(transport.get.mock.calls[1]![0], 'https://dwp.invalid');
    expect(second.searchParams.get('cursor')).toBe(NEXT_CURSOR);
  });

  it('dispatches the exact four-field activation with strong CAS and opaque governed context', async () => {
    transport.post.mockResolvedValue({ status: 200, data: receipt() });
    await expect(activateCountryPack(command(), authority())).resolves.toEqual(receipt());
    const [url, body, config] = transport.post.mock.calls[0]!;
    expect(url).toBe(`/api/payroll/v1/country-packs/${ids.pack}/activate`);
    expect(Object.keys(body)).toEqual([
      'officialReferenceSet',
      'effectiveDate',
      'goldenPackDigest',
      'statutoryApprovalReceiptId',
    ]);
    expect(config).toMatchObject({
      contextScopeKey: CONTEXT_SCOPE,
      csrfReplay: 'NEVER',
      headers: {
        'Idempotency-Key': ids.idempotency,
        'If-Match': '"7"',
        'X-Correlation-ID': ids.commandCorrelation,
        'X-Purpose-Code': 'STATUTORY_CONFIGURATION',
        'X-DWP-Expected-Object-Version': '7',
        'X-DWP-Route-Contract-Key': COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY,
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/tenant|legalEntity|payGroup|subject/iu);
  });

  it('fails closed before I/O on body, context, revision, and receipt binding mismatches', async () => {
    const maximumReference = validateCountryPackActivationCommand({
      ...command(),
      request: { ...command().request, officialReferenceSet: 'R'.repeat(240) },
    });
    expect(maximumReference.request.officialReferenceSet).toHaveLength(240);
    expect(() =>
      validateCountryPackActivationCommand({
        ...command(),
        request: { ...command().request, officialReferenceSet: 'R'.repeat(241) },
      })
    ).toThrow();
    expect(() =>
      validateCountryPackActivationCommand({ ...command(), tenantId: 'tenant-a' })
    ).toThrow();
    await expect(
      activateCountryPack(command(), authority({ contextKey: 'psc-other' }))
    ).rejects.toThrow(/authority/u);
    expect(transport.post).not.toHaveBeenCalled();

    transport.post.mockResolvedValue({ status: 200, data: receipt(9) });
    await expect(activateCountryPack(command(), authority())).rejects.toBeInstanceOf(
      CountryPackActivationOutcomeUnknownError
    );
    expect(() =>
      validateCountryPackActivationCommand({
        ...command(),
        expectedActivationRevision: Number.MAX_SAFE_INTEGER,
      })
    ).toThrow();
  });

  it('renders responsive settings and operations workbenches with action only on safe IAQ-026', async () => {
    const settingsRead = vi
      .fn()
      .mockResolvedValue(parseStatutoryConfigurationProjection(settingsWire()));
    const operationsRead = vi.fn().mockResolvedValue(parseSocialInsuranceProjection(socialWire()));
    const executorCalls = vi.fn();
    const executor: CountryPackActivationCommandExecutor = async <T,>(
      execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>,
      binding: CountryPackActivationCommandBinding
    ): Promise<T> => {
      executorCalls(execute, binding);
      return execute(governance());
    };
    act(() => {
      root.render(
        <>
          <HrisStatutoryConfigurationWorkbench
            rollout={rollout}
            admission={admission(STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY)}
            ownerBinding={settingsBinding(settingsRead, executor)}
            idFactory={() => ids.query}
          />
          <HrisPayTaxSocialInsuranceWorkbench
            rollout={rollout}
            admission={admission(SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY)}
            ownerBinding={operationsBinding(operationsRead)}
            idFactory={() => ids.query}
          />
        </>
      );
    });
    act(() => button('Review country packs').click());
    act(() => button('Review results').click());
    await settle();
    expect(settingsRead).toHaveBeenCalledOnce();
    expect(operationsRead).toHaveBeenCalledOnce();
    expect(button('Activate country pack')).not.toBeNull();
    const operations = document.querySelector('[data-testid="pay003-operations-workbench"]');
    expect(operations?.textContent).toContain('Tax producer not yet available');
    expect(operations?.textContent).not.toContain('Activate country pack');
    expect(operations?.textContent).not.toContain(ids.pack);
    expect(document.body.textContent).toContain('대한민국 사회보험 공식 패키지');

    expect(STATUTORY_INSURANCE_RESPONSIVE_CONTRACT.verifiedDesktopWidths).toEqual([1440, 1280]);
    expect(STATUTORY_INSURANCE_RESPONSIVE_CONTRACT.verifiedCompactWidths).toEqual([390, 320]);
    for (const width of STATUTORY_INSURANCE_RESPONSIVE_CONTRACT.verifiedDesktopWidths) {
      expect(statutoryInsurancePrimaryLayoutAtViewport(width)).toBe('SPLIT');
      expect(
        statutoryInsurancePrimaryLayoutAtViewport(
          width,
          STATUTORY_INSURANCE_RESPONSIVE_CONTRACT.verifiedZoomPercent
        )
      ).toBe('STACKED');
    }
    for (const width of STATUTORY_INSURANCE_RESPONSIVE_CONTRACT.verifiedCompactWidths) {
      expect(statutoryInsurancePrimaryLayoutAtViewport(width)).toBe('STACKED');
    }
    for (const testId of ['pay003-settings-primary-grid', 'pay003-operations-primary-grid']) {
      expect(
        document
          .querySelector(`[data-testid="${testId}"]`)
          ?.getAttribute('data-primary-layout-breakpoint')
      ).toBe('1200');
    }

    const settings = document.querySelector('[data-testid="pay003-settings-workbench"]');
    const settingsReview = button('Review country packs');
    const itemChoice = settings?.querySelector('[role="button"]');
    const firstActivationField = settings?.querySelector('input[required]');
    const activation = button('Activate country pack');
    const operationsReview = button('Review results');
    expect(itemChoice).toBeInstanceOf(HTMLElement);
    expect(firstActivationField).toBeInstanceOf(HTMLInputElement);
    const focusOrder = [...document.querySelectorAll('button, [role="button"], input')];
    expect(focusOrder.indexOf(settingsReview)).toBeLessThan(focusOrder.indexOf(itemChoice!));
    expect(focusOrder.indexOf(itemChoice!)).toBeLessThan(focusOrder.indexOf(firstActivationField!));
    expect(focusOrder.indexOf(firstActivationField!)).toBeLessThan(focusOrder.indexOf(activation));
    expect(focusOrder.indexOf(activation)).toBeLessThan(focusOrder.indexOf(operationsReview));
    for (const focusable of [settingsReview, itemChoice!, firstActivationField!, activation]) {
      act(() => (focusable as HTMLElement).focus());
      expect(document.activeElement).toBe(focusable);
    }
  });

  it('renders loading, empty, unavailable with retry, and opaque forbidden states accessibly', async () => {
    let resolve!: (value: ReturnType<typeof parseStatutoryConfigurationProjection>) => void;
    const pending = new Promise<ReturnType<typeof parseStatutoryConfigurationProjection>>(
      (done) => {
        resolve = done;
      }
    );
    const read = vi.fn().mockReturnValueOnce(pending);
    const execute = vi.fn();
    act(() => {
      root.render(
        <HrisStatutoryConfigurationWorkbench
          rollout={rollout}
          admission={admission(STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY)}
          ownerBinding={settingsBinding(read, execute)}
          idFactory={() => ids.query}
        />
      );
    });
    act(() => button('Review country packs').click());
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    resolve(parseStatutoryConfigurationProjection(settingsWire({ state: 'EMPTY' })));
    await settle();
    expect(document.body.textContent).toContain('No country packs found');

    read.mockRejectedValueOnce(new Error('owner unavailable'));
    act(() => button('Review country packs').click());
    await settle();
    expect(button('Retry review')).not.toBeNull();

    read.mockRejectedValueOnce(new HttpError('opaque', 403));
    act(() => button('Review country packs').click());
    await settle();
    expect(document.body.textContent).toContain('current access context cannot disclose');
    expect(execute).not.toHaveBeenCalled();
  });

  it('shows HIGH step-up progress and preserves the exact command for unknown-outcome retry', async () => {
    const settingsRead = vi
      .fn()
      .mockResolvedValue(parseStatutoryConfigurationProjection(settingsWire()));
    let release!: () => void;
    const challenge = new Promise<void>((done) => {
      release = done;
    });
    const executorCalls = vi.fn();
    const executor: CountryPackActivationCommandExecutor = async <T,>(
      execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>,
      binding: CountryPackActivationCommandBinding
    ): Promise<T> => {
      executorCalls(execute, binding);
      await challenge;
      return execute(governance());
    };
    const activate = vi
      .fn()
      .mockRejectedValue(new CountryPackActivationOutcomeUnknownError('lost'));
    const dataSource: StatutoryInsuranceDataSource = {
      statutoryConfiguration: settingsRead,
      socialInsurance: vi.fn(),
      activateCountryPack: activate,
    };
    const generated = [ids.query, ids.idempotency, ids.commandCorrelation];
    act(() => {
      root.render(
        <HrisStatutoryConfigurationWorkbench
          rollout={rollout}
          admission={admission(STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY)}
          ownerBinding={settingsBinding(settingsRead, executor)}
          dataSource={dataSource}
          idFactory={() => generated.shift() ?? ids.commandCorrelation}
        />
      );
    });
    act(() => button('Review country packs').click());
    await settle();
    const values = ['MOEL-2026-11', '2026-11-01', 'b'.repeat(64), ids.approval];
    const form = button('Activate country pack').closest('form');
    expect(form).not.toBeNull();
    const inputs = [...form!.querySelectorAll('input')];
    expect(inputs).toHaveLength(values.length);
    act(() => {
      inputs.forEach((input, index) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, values[index]);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    act(() => button('Activate country pack').click());
    expect(document.body.textContent).toContain('Additional verification required');
    release();
    await settle();
    expect(document.body.textContent).toContain('outcome needs reconciliation');
    expect(activate.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ request: command().request })
    );
    act(() => button('Retry exact command').click());
    await settle();
    expect(executorCalls).toHaveBeenCalledTimes(2);
    expect(activate).toHaveBeenCalledTimes(2);
    expect(activate.mock.calls[1]?.[0]).toEqual(activate.mock.calls[0]?.[0]);
    expect(executorCalls.mock.calls[1]![1]).toEqual(executorCalls.mock.calls[0]![1]);
  });
});
