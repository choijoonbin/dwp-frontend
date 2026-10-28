/// <reference types="node" />
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import type * as DesignSystem from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';

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
  HrisPayTaxSocialInsuranceWorkbench,
  MISSING_TAX_PRODUCER_COMPONENT,
  MISSING_TAX_PRODUCER_ERROR,
  SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY,
  SOCIAL_INSURANCE_ENTRY_QUERY,
  SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY,
  STATUTORY_INSURANCE_FEATURE,
  STATUTORY_INSURANCE_RESPONSIVE_CONTRACT,
  parseSocialInsuranceProjection,
  statutoryInsurancePrimaryLayoutAtViewport,
} from '../../statutory-insurance';

import type {
  SocialInsuranceOwnerBinding,
  StatutoryInsuranceDataSource,
  StatutoryInsuranceTrustedAdmission,
} from '../../statutory-insurance';

const AC = Object.freeze(
  Array.from({ length: 12 }, (_, index) => `PAY005-AC-${String(index + 1).padStart(2, '0')}`)
);

const ids = Object.freeze({
  workerResult: '55555555-5555-0000-0000-555555555555',
  secondWorkerResult: '55555555-5555-0000-0000-555555555556',
  correlation: '66666666-6666-0000-0000-666666666666',
});
const CONTEXT_KEY = `psc-${'5'.repeat(64)}`;
const CONTEXT_SCOPE = 'tenant:tenant-a/legal-entity:seoul/pay-group:monthly';
const DECISION_REVISION = 'authorization-revision-57';

type ProjectionState = 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';

function queryState(
  state: ProjectionState,
  viewCount: number,
  omittedCount = 0,
  freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE' = state === 'UNAVAILABLE'
    ? 'UNAVAILABLE'
    : 'CURRENT'
) {
  return {
    state,
    scopeDecisionRevision: 'population-scope-revision-57',
    freshness,
    nextCursor: null,
    fieldDecisionSummary: { viewCount, maskedCount: 0, omittedCount },
    partialFailures:
      state === 'PARTIAL'
        ? [
            {
              componentKey: MISSING_TAX_PRODUCER_COMPONENT,
              errorCode: MISSING_TAX_PRODUCER_ERROR,
              correlationId: ids.correlation,
              retryable: true,
            },
          ]
        : [],
    correlationId: ids.correlation,
    cachePolicy: {
      authorizationDecisionRevision: DECISION_REVISION,
      invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
      maxAgeSeconds: 30,
    },
  };
}

function item(taxAmount = '0.0000') {
  return {
    itemPublicId: ids.workerResult,
    title:
      '대한민국 월 급여 세금 및 사회보험 결과 / Republic of Korea monthly payroll tax and social-insurance result',
    statusCode: 'CALCULATED',
    fieldGroups: {
      TAX_RESULT: { decision: 'VIEW', value: { amount: taxAmount, currency: 'KRW' } },
      SOCIAL_INSURANCE: {
        decision: 'VIEW',
        value: { amount: '825000.0000', currency: 'KRW' },
      },
      POLICY_VERSION: {
        decision: 'VIEW',
        value: {
          policyKey: 'kr.tax-social-insurance',
          revision: 57,
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
  };
}

function completeWire(taxAmount = '0.0000') {
  return {
    projectionVersion: '1',
    asOf: '2026-10-28T08:00:00Z',
    variantKey: 'TAX_SOCIAL_INSURANCE',
    queryState: queryState('COMPLETE', 3),
    items: [item(taxAmount)],
  };
}

function partialWire() {
  const result = completeWire();
  delete (result.items[0]!.fieldGroups as Partial<(typeof result.items)[0]['fieldGroups']>)
    .TAX_RESULT;
  result.queryState = queryState('PARTIAL', 2, 1);
  return result;
}

function noItemsWire(state: 'EMPTY' | 'UNAVAILABLE') {
  return {
    projectionVersion: '1',
    asOf: '2026-10-28T08:00:00Z',
    variantKey: 'TAX_SOCIAL_INSURANCE',
    queryState: queryState(state, 0),
    items: [],
  };
}

const rollout = Object.freeze({
  feature: STATUTORY_INSURANCE_FEATURE,
  enabled: true,
  enrolledTenantIds: Object.freeze(['tenant-a']),
});

function admission(): StatutoryInsuranceTrustedAdmission {
  return {
    kind: 'TRUSTED_PRODUCT_SURFACE_PAGE',
    feature: STATUTORY_INSURANCE_FEATURE,
    pageRouteContractKey: SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY,
    tenantId: 'tenant-a',
    contextKey: CONTEXT_KEY,
    contextScopeKey: CONTEXT_SCOPE,
    decisionRevision: DECISION_REVISION,
  };
}

function binding(
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

function installEnvironment({
  colorScheme = 'light',
  forcedColors = false,
  reducedMotion = false,
}: {
  colorScheme?: 'light' | 'dark';
  forcedColors?: boolean;
  reducedMotion?: boolean;
} = {}) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('forced-colors')
        ? forcedColors
        : query.includes('prefers-reduced-motion')
          ? reducedMotion
          : query.includes('prefers-color-scheme')
            ? query.includes(colorScheme)
            : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
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

describe('[SLICE:BASE-TFR-PAY-005] typed tax-result contribution', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    installEnvironment();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('seals all twelve criteria and the exact IAQ-048 field order without actions', () => {
    expect(AC).toEqual(
      Array.from({ length: 12 }, (_, index) => `PAY005-AC-${String(index + 1).padStart(2, '0')}`)
    );
    expect(SOCIAL_INSURANCE_ENTRY_QUERY).toMatchObject({
      contractId: 'IAQ-048',
      method: 'GET',
      path: '/api/payroll/v1/workbench/pay-tax-social-insurance',
      fieldGroups: ['TAX_RESULT', 'SOCIAL_INSURANCE', 'POLICY_VERSION'],
    });
    const projection = parseSocialInsuranceProjection(completeWire());
    expect(projection.projectionVersion).toBe('1');
    expect(projection.items[0]!.itemPublicId).toBe(ids.workerResult);
    expect(Object.keys(projection.items[0]!.fieldGroups)).toEqual([
      'TAX_RESULT',
      'SOCIAL_INSURANCE',
      'POLICY_VERSION',
    ]);
    expect(projection.items[0]!.fieldGroups.TAX_RESULT).toEqual({
      decision: 'VIEW',
      value: { amount: '0.0000', currency: 'KRW' },
    });
    expect(projection.items[0]!.availableActions).toEqual([]);
  });

  it('distinguishes a real zero from missing producer data and validates policy omissions', () => {
    expect(parseSocialInsuranceProjection(completeWire('0.0000')).queryState.state).toBe(
      'COMPLETE'
    );
    expect(parseSocialInsuranceProjection(partialWire()).queryState.state).toBe('PARTIAL');

    const mixed = completeWire('125000.0000');
    const socialOnly = structuredClone(mixed.items[0]!);
    socialOnly.itemPublicId = ids.secondWorkerResult;
    socialOnly.deepLink.resourcePublicId = ids.secondWorkerResult;
    delete (socialOnly.fieldGroups as Partial<typeof socialOnly.fieldGroups>).TAX_RESULT;
    mixed.items.push(socialOnly);
    mixed.queryState = queryState('PARTIAL', 5, 1);
    const mixedProjection = parseSocialInsuranceProjection(mixed);
    expect(mixedProjection.items).toHaveLength(2);
    expect(mixedProjection.items[0]!.fieldGroups.TAX_RESULT).toMatchObject({ decision: 'VIEW' });
    expect(mixedProjection.items[1]!.fieldGroups.TAX_RESULT).toBeUndefined();

    const inconsistent = partialWire();
    inconsistent.items[0]!.fieldGroups.TAX_RESULT = {
      decision: 'VIEW',
      value: { amount: '1.0000', currency: 'KRW' },
    };
    inconsistent.queryState.fieldDecisionSummary = {
      viewCount: 3,
      maskedCount: 0,
      omittedCount: 0,
    };
    expect(() => parseSocialInsuranceProjection(inconsistent)).toThrow(/taxProducer/u);

    const policyOmitted = completeWire();
    policyOmitted.items[0]!.fieldGroups.TAX_RESULT = {
      decision: 'MASK',
      value: null,
      maskReason: 'FIELD_POLICY',
      maskedDisplayKey: 'payroll.tax.masked',
    };
    delete (
      policyOmitted.items[0]!.fieldGroups as Partial<(typeof policyOmitted.items)[0]['fieldGroups']>
    ).POLICY_VERSION;
    policyOmitted.queryState.fieldDecisionSummary = {
      viewCount: 1,
      maskedCount: 1,
      omittedCount: 1,
    };
    expect(parseSocialInsuranceProjection(policyOmitted).items[0]!.fieldGroups).toMatchObject({
      TAX_RESULT: { decision: 'MASK' },
      SOCIAL_INSURANCE: { decision: 'VIEW' },
    });
  });

  it('renders the complete list-detail result accessibly and responsively', async () => {
    const read = vi.fn().mockResolvedValue(parseSocialInsuranceProjection(completeWire()));
    act(() => {
      root.render(
        <HrisPayTaxSocialInsuranceWorkbench
          rollout={rollout}
          admission={admission()}
          ownerBinding={binding(read)}
          idFactory={() => ids.correlation}
        />
      );
    });
    const review = button('Review results');
    act(() => review.click());
    await settle();

    const workbench = document.querySelector('[data-testid="pay003-operations-workbench"]');
    expect(workbench?.getAttribute('data-runtime-state')).toBe('complete');
    expect(workbench?.getAttribute('data-slice')).toBe('BASE-TFR-PAY-003');
    expect(workbench?.getAttribute('data-slice-contributors')).toContain('BASE-TFR-PAY-005');
    expect(workbench?.textContent).toContain('Tax result');
    expect(workbench?.textContent).toContain('0.0000 KRW');
    expect(workbench?.textContent).toContain('825000.0000 KRW');
    expect(workbench?.textContent).toContain('kr.tax-social-insurance · 57');
    expect(workbench?.textContent).toContain('대한민국 월 급여 세금 및 사회보험 결과');
    expect(workbench?.textContent).not.toContain('Activate country pack');

    const itemChoice = workbench?.querySelector('[role="button"]');
    expect(itemChoice).toBeInstanceOf(HTMLElement);
    act(() => review.focus());
    expect(document.activeElement).toBe(review);
    act(() => (itemChoice as HTMLElement).focus());
    expect(document.activeElement).toBe(itemChoice);

    expect(STATUTORY_INSURANCE_RESPONSIVE_CONTRACT.verifiedDesktopWidths).toEqual([1440, 1280]);
    expect(STATUTORY_INSURANCE_RESPONSIVE_CONTRACT.verifiedCompactWidths).toEqual([390, 320]);
    for (const width of [1440, 1280]) {
      expect(statutoryInsurancePrimaryLayoutAtViewport(width)).toBe('SPLIT');
      expect(statutoryInsurancePrimaryLayoutAtViewport(width, 200)).toBe('STACKED');
    }
    for (const width of [390, 320]) {
      expect(statutoryInsurancePrimaryLayoutAtViewport(width)).toBe('STACKED');
    }
  });

  it('covers loading, empty, partial, stale, unavailable, and denied result states', async () => {
    let resolve!: (value: ReturnType<typeof parseSocialInsuranceProjection>) => void;
    const pending = new Promise<ReturnType<typeof parseSocialInsuranceProjection>>((done) => {
      resolve = done;
    });
    const read = vi.fn().mockReturnValueOnce(pending);
    act(() => {
      root.render(
        <HrisPayTaxSocialInsuranceWorkbench
          rollout={rollout}
          admission={admission()}
          ownerBinding={binding(read)}
          idFactory={() => ids.correlation}
        />
      );
    });
    act(() => button('Review results').click());
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();

    resolve(parseSocialInsuranceProjection(noItemsWire('EMPTY')));
    await settle();
    expect(document.body.textContent).toContain('No tax or social-insurance results found');

    read.mockResolvedValueOnce(parseSocialInsuranceProjection(partialWire()));
    act(() => button('Review results').click());
    await settle();
    expect(document.body.textContent).toContain('Some payroll result evidence is unavailable');

    const stale = completeWire('125000.0000');
    stale.queryState = queryState('COMPLETE', 3, 0, 'STALE');
    read.mockResolvedValueOnce(parseSocialInsuranceProjection(stale));
    act(() => button('Review results').click());
    await settle();
    expect(document.body.textContent).toContain('Result evidence is stale');

    read.mockRejectedValueOnce(new Error('owner unavailable'));
    act(() => button('Review results').click());
    await settle();
    expect(document.body.textContent).toContain('Tax and social-insurance results unavailable');

    read.mockRejectedValueOnce(new HttpError('opaque', 403));
    act(() => button('Retry review').click());
    await settle();
    expect(document.body.textContent).toContain('current access context cannot disclose');
  });

  it.each([
    ['light', false, false],
    ['dark', false, false],
    ['light', true, false],
    ['dark', false, true],
  ] as const)(
    'renders real %s theme, forced-colors=%s, reduced-motion=%s preference evidence',
    async (colorScheme, forcedColors, reducedMotion) => {
      installEnvironment({ colorScheme, forcedColors, reducedMotion });
      const read = vi.fn().mockResolvedValue(parseSocialInsuranceProjection(completeWire()));
      act(() => {
        root.render(
          <ThemeProvider theme={createTheme({ palette: { mode: colorScheme } })}>
            <HrisPayTaxSocialInsuranceWorkbench
              rollout={rollout}
              admission={admission()}
              ownerBinding={binding(read)}
              idFactory={() => ids.correlation}
            />
          </ThemeProvider>
        );
      });
      act(() => button('Review results').click());
      await settle();

      const workbench = document.querySelector<HTMLElement>(
        '[data-testid="pay003-operations-workbench"]'
      );
      expect(workbench?.dataset.pageArchetype).toBe('list-detail');
      expect(workbench?.dataset.colorScheme).toBe(colorScheme);
      expect(workbench?.dataset.forcedColors).toBe(forcedColors ? 'active' : 'inactive');
      expect(workbench?.dataset.reducedMotion).toBe(reducedMotion ? 'active' : 'inactive');
      expect(window.matchMedia).toHaveBeenCalledWith('(forced-colors: active)');
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      expect(workbench?.textContent).toContain('0.0000 KRW');
    }
  );

  it('makes zero owner calls while the feature is off or the tenant is unenrolled', () => {
    const read = vi.fn();
    act(() => {
      root.render(
        <HrisPayTaxSocialInsuranceWorkbench admission={admission()} ownerBinding={binding(read)} />
      );
    });
    expect(document.body.textContent).toContain('not enabled');
    expect(read).not.toHaveBeenCalled();
  });
});
