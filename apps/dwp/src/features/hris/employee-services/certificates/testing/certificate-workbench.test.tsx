// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import {
  HRM009_ADAPTER_KIND,
  HRM009_API_CONTRACTS,
  HRM009_DEFAULT_GATE,
  HRM009_FEATURE,
  HRM009_QUERY_CONTRACTS,
  HRM009_REQUEST_CERTIFICATE_ROUTE_CONTRACT,
  HRM009_TEAM_MANAGEMENT_DISPOSITION,
  Hrm009CertificateWorkbench,
  Hrm009OperationsCertificatesSurface,
  Hrm009SelfServiceRequestsSurface,
  assertHrm009CertificateRequest,
  assertHrm009QueryRequest,
  createHrm009QueryRequest,
  selectHrm009Projection,
} from '..';
import {
  HRM009_TEST_AS_OF,
  HRM009_TEST_PERSON_ID,
  HRM009_TEST_SCOPE,
  hrm009ProjectionWire,
  hrm009Receipt,
} from './certificate-fixtures.test-support';

import type { Hrm009QueryAdapter } from '../certificate-api';
import type { Hrm009Projection, Hrm009QueryId, Hrm009TrustedScope } from '../certificate-contract';

const ADMITTED = {
  feature: HRM009_FEATURE,
  enabled: true,
  tenantEnrolled: true,
} as const;

type ComponentFakeEnvironment = Readonly<{
  cssWidth: number;
  colorScheme: 'light' | 'dark';
  forcedColors: boolean;
  reducedMotion: boolean;
}>;

function installComponentFakeEnvironment(environment: ComponentFakeEnvironment) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: environment.cssWidth,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      let matches = true;
      const maximumWidth = /max-width:\s*([\d.]+)px/u.exec(query)?.[1];
      const minimumWidth = /min-width:\s*([\d.]+)px/u.exec(query)?.[1];
      if (maximumWidth) matches = matches && environment.cssWidth <= Number(maximumWidth);
      if (minimumWidth) matches = matches && environment.cssWidth >= Number(minimumWidth);
      if (query.includes('forced-colors')) matches = environment.forcedColors;
      if (query.includes('prefers-reduced-motion')) matches = environment.reducedMotion;
      if (query.includes('prefers-color-scheme')) {
        matches = query.includes(environment.colorScheme);
      }
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
  });
}

function projection(
  queryId: Hrm009QueryId,
  state?: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE'
) {
  return hrm009ProjectionWire(queryId, state) as unknown as Hrm009Projection;
}

function adapter(result: Hrm009Projection = projection('IAQ-003')): Hrm009QueryAdapter {
  return Object.freeze({
    kind: HRM009_ADAPTER_KIND,
    query: vi.fn<Hrm009QueryAdapter['query']>().mockResolvedValue(result),
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

let root: Root;
let host: HTMLDivElement;

function button(label: string): HTMLButtonElement {
  const match = [...document.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return match;
}

async function shown(text: string) {
  await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
  await act(async () => {
    await vi.waitFor(() => expect(document.body.textContent).toContain(text));
  });
}

async function renderWorkbench(
  queryId: Hrm009QueryId,
  source: Hrm009QueryAdapter,
  props: Partial<React.ComponentProps<typeof Hrm009CertificateWorkbench>> = {}
) {
  await act(async () => {
    root.render(
      <Hrm009CertificateWorkbench
        queryId={queryId}
        gate={ADMITTED}
        scope={HRM009_TEST_SCOPE}
        adapter={source}
        {...props}
      />
    );
  });
}

describe('HRM-009 Stage-A sealed contracts', () => {
  it('pins the two GET projections and one single-route POST command', () => {
    expect(HRM009_API_CONTRACTS).toEqual([
      expect.objectContaining({
        bindingId: 'IAQ-003',
        method: 'GET',
        browserPath: '/api/people/v1/hris/workbench/self-service/requests',
        ownerPath: '/v1/hris/workbench/self-service/requests',
      }),
      expect.objectContaining({
        bindingId: 'IAQ-010',
        method: 'GET',
        browserPath: '/api/people/v1/hris/workbench/operations/certificates/documents',
        ownerPath: '/v1/hris/workbench/operations/certificates/documents',
      }),
      expect.objectContaining({
        bindingId: 'PEP-HRM-012',
        operationId: 'requestCertificate',
        method: 'POST',
        browserPath: '/api/people/v1/hris/certificates',
        ownerPath: '/v1/hris/certificates',
        successStatus: 202,
        routeContractKey: HRM009_REQUEST_CERTIFICATE_ROUTE_CONTRACT,
      }),
    ]);
    expect(HRM009_API_CONTRACTS).toHaveLength(3);
  });

  it('identifies each primary user, operational question, primary action, and archetype', () => {
    expect(HRM009_QUERY_CONTRACTS['IAQ-003'].framing).toEqual({
      primaryUser: 'Employee',
      operationalQuestion:
        'Which governed HR requests can I review, and can I request a certificate now?',
      primaryAction: 'Request certificate',
      archetype: 'list-detail',
    });
    expect(HRM009_QUERY_CONTRACTS['IAQ-010'].framing).toEqual({
      primaryUser: 'HR operations certificate issuer',
      operationalQuestion:
        'Which certificate metadata in my authorized population needs an issuance decision?',
      primaryAction: 'Issue certificate request',
      archetype: 'focus-form',
    });
  });

  it.each(['IAQ-003', 'IAQ-010'] as const)(
    'accepts the exact metadata-only %s projection',
    (queryId) => {
      const result = selectHrm009Projection(queryId, hrm009ProjectionWire(queryId));
      expect(result.variantKey).toBe(HRM009_QUERY_CONTRACTS[queryId].variantKey);
      expect(result.queryState.state).toBe('COMPLETE');
    }
  );

  it('enforces asymmetric certificate and document digest shapes', () => {
    const certificateDigest = hrm009ProjectionWire('IAQ-010');
    const certificateMetadata = certificateDigest.items[0]!.fieldGroups.CERTIFICATE_METADATA as {
      value: { digest: string | null };
    };
    certificateMetadata.value.digest = 'a'.repeat(64);
    expect(() => selectHrm009Projection('IAQ-010', certificateDigest)).toThrow(
      'items[0].fieldGroups.CERTIFICATE_METADATA.value.digest'
    );

    const missingDocumentDigest = hrm009ProjectionWire('IAQ-010');
    const documentMetadata = missingDocumentDigest.items[0]!.fieldGroups.DOCUMENT_METADATA as {
      value: { digest: string | null };
    };
    documentMetadata.value.digest = null;
    expect(() => selectHrm009Projection('IAQ-010', missingDocumentDigest)).toThrow(
      'items[0].fieldGroups.DOCUMENT_METADATA.value.digest'
    );

    const uppercaseDocumentDigest = hrm009ProjectionWire('IAQ-010');
    const uppercaseMetadata = uppercaseDocumentDigest.items[0]!.fieldGroups.DOCUMENT_METADATA as {
      value: { digest: string | null };
    };
    uppercaseMetadata.value.digest = 'A'.repeat(64);
    expect(() => selectHrm009Projection('IAQ-010', uppercaseDocumentDigest)).toThrow(
      'items[0].fieldGroups.DOCUMENT_METADATA.value.digest'
    );
  });

  it('rejects additive fields, cross-query actions, cardinality violations, and bad summaries', () => {
    const additive = hrm009ProjectionWire('IAQ-010');
    Object.assign(additive.items[0]!, { downloadUrl: 'https://example.invalid/raw' });
    expect(() => selectHrm009Projection('IAQ-010', additive)).toThrow();

    const crossQuery = hrm009ProjectionWire('IAQ-010');
    crossQuery.items[0]!.availableActions = [
      hrm009ProjectionWire('IAQ-003').items[0]!.availableActions[0]!,
    ];
    expect(() => selectHrm009Projection('IAQ-010', crossQuery)).toThrow();

    const emptyWithItem = hrm009ProjectionWire('IAQ-003', 'EMPTY');
    emptyWithItem.items = hrm009ProjectionWire('IAQ-003').items;
    expect(() => selectHrm009Projection('IAQ-003', emptyWithItem)).toThrow();

    const summaryMismatch = hrm009ProjectionWire('IAQ-003');
    summaryMismatch.queryState.fieldDecisionSummary.viewCount = 99;
    expect(() => selectHrm009Projection('IAQ-003', summaryMismatch)).toThrow();
  });

  it('accepts sealed query options and independent deep-link and state boundaries', () => {
    expect(HRM009_QUERY_CONTRACTS['IAQ-003'].filterKinds).toEqual({
      requestSummary: 'AGGREGATE',
      requestStatus: 'STATUS',
      commandReceipt: 'RECEIPT',
      effectiveOn: 'DATE',
    });
    expect(HRM009_QUERY_CONTRACTS['IAQ-010'].filterKinds).toEqual({
      certificateMetadata: 'METADATA',
      documentMetadata: 'METADATA',
      effectiveOn: 'DATE',
    });

    const request = createHrm009QueryRequest('IAQ-003', HRM009_TEST_SCOPE, {
      limit: 25,
      filter: {
        requestSummary: { minimumItemCount: 1, maximumItemCount: 5 },
        requestStatus: { codes: ['RUNNING'], minimumRevision: 2 },
        commandReceipt: {
          receiptIds: ['receipt:1001'],
          states: ['ACCEPTED'],
        },
        effectiveOn: '2026-10-18',
      },
      sort: ['requestStatus:ASC', 'commandReceipt:DESC', 'itemPublicId:ASC'],
      asOf: HRM009_TEST_AS_OF,
      cursor: 'abcdefghijklmnop',
    });
    expect(assertHrm009QueryRequest('IAQ-003', request)).toEqual(request);
    expect(request.limit).toBe(25);

    const independentDeepLink = hrm009ProjectionWire('IAQ-003');
    independentDeepLink.items[0]!.deepLink.resourcePublicId = 'request:independent-resource';
    expect(selectHrm009Projection('IAQ-003', independentDeepLink).items[0]?.deepLink).toEqual(
      expect.objectContaining({ resourcePublicId: 'request:independent-resource' })
    );

    const completeEmptyStale = hrm009ProjectionWire('IAQ-003', 'EMPTY');
    completeEmptyStale.queryState.state = 'COMPLETE';
    completeEmptyStale.queryState.freshness = 'STALE';
    completeEmptyStale.queryState.nextCursor = 'abcdefghijklmnop';
    expect(selectHrm009Projection('IAQ-003', completeEmptyStale).queryState.state).toBe('COMPLETE');

    const emptyStaleWithCursor = hrm009ProjectionWire('IAQ-010', 'EMPTY');
    emptyStaleWithCursor.queryState.freshness = 'STALE';
    emptyStaleWithCursor.queryState.nextCursor = 'abcdefghijklmnop';
    expect(selectHrm009Projection('IAQ-010', emptyStaleWithCursor).queryState.state).toBe('EMPTY');
  });

  it('accepts 128-character IAQ-010 metadata filter versions and rejects 129 characters', () => {
    expect(
      createHrm009QueryRequest('IAQ-010', HRM009_TEST_SCOPE, {
        filter: { certificateMetadata: { versions: ['v'.repeat(128)] } },
      }).filter
    ).toEqual({ certificateMetadata: { versions: ['v'.repeat(128)] } });

    expect(() =>
      createHrm009QueryRequest('IAQ-010', HRM009_TEST_SCOPE, {
        filter: { certificateMetadata: { versions: ['v'.repeat(129)] } },
      })
    ).toThrow('request.filter.certificateMetadata.versions[0]');
  });

  it('pins fixed page size, stable sort, trusted scope, and sealed request fields', () => {
    expect(createHrm009QueryRequest('IAQ-003', HRM009_TEST_SCOPE)).toEqual({
      limit: 100,
      filter: {},
      sort: ['itemPublicId:ASC'],
      locale: 'en-US',
      timeZone: 'Asia/Seoul',
      correlationId: HRM009_TEST_SCOPE.correlationId,
    });
    const request = {
      personPublicId: HRM009_TEST_PERSON_ID,
      certificateType: 'EMPLOYMENT_CERTIFICATE',
      purposeCode: 'EMPLOYEE_SELF_SERVICE',
      locale: 'en-US',
      asOf: HRM009_TEST_AS_OF,
    } as const;
    expect(assertHrm009CertificateRequest(request)).toEqual(request);
    expect(() =>
      assertHrm009CertificateRequest({ ...request, purposeCode: 'TEAM_MANAGEMENT' })
    ).toThrow();
    expect(() => assertHrm009CertificateRequest({ ...request, mode: 'self' })).toThrow();
    expect(HRM009_TEAM_MANAGEMENT_DISPOSITION).toBe('DENY_DEFER_NO_PROFILE_NO_FALLBACK');
  });
});

describe('HRM-009 Stage-A read-only component surfaces', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    installComponentFakeEnvironment({
      cssWidth: 1280,
      colorScheme: 'light',
      forcedColors: true,
      reducedMotion: true,
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    undefined,
    { feature: HRM009_FEATURE, enabled: false, tenantEnrolled: true },
    { feature: HRM009_FEATURE, enabled: true, tenantEnrolled: false },
  ] as const)(
    'keeps absent/OFF/unenrolled state at zero query and command calls: %o',
    async (gate) => {
      const source = adapter();
      const delegate = vi.fn();
      await act(async () => {
        root.render(
          <Hrm009SelfServiceRequestsSurface
            {...(gate ? { gate } : {})}
            scope={HRM009_TEST_SCOPE}
            adapter={source}
            onRequestCertificate={delegate}
          />
        );
      });
      expect(document.querySelector('[data-runtime-state="disabled"]')).not.toBeNull();
      expect(source.query).not.toHaveBeenCalled();
      expect(delegate).not.toHaveBeenCalled();
      expect(HRM009_DEFAULT_GATE).toEqual({
        feature: HRM009_FEATURE,
        enabled: false,
        tenantEnrolled: false,
      });
      expect(Object.isFrozen(HRM009_DEFAULT_GATE)).toBe(true);
    }
  );

  it.each([
    ['IAQ-003', Hrm009SelfServiceRequestsSurface, 'My HR requests and certificates', 'list-detail'],
    ['IAQ-010', Hrm009OperationsCertificatesSurface, 'Certificates and documents', 'focus-form'],
  ] as const)(
    'renders the %s surface with its work framing and long-label-safe metadata',
    async (queryId, Surface, title, archetype) => {
      const source = adapter(projection(queryId));
      await act(async () => {
        root.render(
          <Surface
            gate={ADMITTED}
            scope={HRM009_TEST_SCOPE}
            adapter={source}
            defaultPersonPublicId={HRM009_TEST_PERSON_ID}
          />
        );
      });
      await shown(title);
      expect(document.body.textContent).toContain(`Archetype: ${archetype}`);
      expect(document.body.textContent).toMatch(/[가-힣]/u);
      expect(document.querySelector('[data-runtime-state="complete"]')).not.toBeNull();
      expect(source.query).toHaveBeenCalledOnce();
      expect(source.query).toHaveBeenCalledWith(
        queryId,
        expect.objectContaining({ limit: 100, sort: ['itemPublicId:ASC'] }),
        HRM009_TEST_SCOPE.contextScopeKey,
        expect.any(AbortSignal)
      );
      expect(document.body.textContent).not.toContain('a'.repeat(64));
    }
  );

  it('deduplicates StrictMode and equal trusted-scope clones while refetching a changed primitive', async () => {
    vi.useFakeTimers();
    const source = adapter(projection('IAQ-003'));
    const renderScope = async (scope: Hrm009TrustedScope) => {
      await act(async () => {
        root.render(
          <StrictMode>
            <Hrm009CertificateWorkbench
              queryId="IAQ-003"
              gate={ADMITTED}
              scope={scope}
              adapter={source}
            />
          </StrictMode>
        );
      });
    };

    await renderScope(HRM009_TEST_SCOPE);
    expect(source.query).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(source.query).toHaveBeenCalledOnce();
    vi.useRealTimers();
    await shown('My HR requests and certificates');

    await renderScope({ ...HRM009_TEST_SCOPE });
    await act(async () => Promise.resolve());
    expect(source.query).toHaveBeenCalledOnce();

    await renderScope({ ...HRM009_TEST_SCOPE, locale: 'ko' });
    await vi.waitFor(() => expect(source.query).toHaveBeenCalledTimes(2));
    expect(source.query).toHaveBeenLastCalledWith(
      'IAQ-003',
      expect.objectContaining({ locale: 'ko' }),
      HRM009_TEST_SCOPE.contextScopeKey,
      expect.any(AbortSignal)
    );
  });

  it('dispatches exactly one owner transport for refresh, next, and previous while retaining the first asOf snapshot', async () => {
    const source = adapter(projection('IAQ-003'));
    const settleOwnerTransport = async (expectedCallCount: number) => {
      await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
      await act(async () => {
        await vi.waitFor(() => {
          expect(source.query).toHaveBeenCalledTimes(expectedCallCount);
          expect(button('Refresh').disabled).toBe(false);
        });
      });
      await act(async () => Promise.resolve());
      expect(source.query).toHaveBeenCalledTimes(expectedCallCount);
    };

    await act(async () => {
      root.render(
        <StrictMode>
          <Hrm009CertificateWorkbench
            queryId="IAQ-003"
            gate={ADMITTED}
            scope={HRM009_TEST_SCOPE}
            adapter={source}
          />
        </StrictMode>
      );
    });
    await settleOwnerTransport(1);

    await act(async () => button('Refresh').click());
    await settleOwnerTransport(2);

    expect(button('Next').disabled).toBe(false);
    await act(async () => button('Next').click());
    await settleOwnerTransport(3);

    expect(button('Previous').disabled).toBe(false);
    await act(async () => button('Previous').click());
    await settleOwnerTransport(4);

    expect(source.query).toHaveBeenNthCalledWith(
      1,
      'IAQ-003',
      expect.objectContaining({ cursor: null, asOf: null }),
      HRM009_TEST_SCOPE.contextScopeKey,
      expect.any(AbortSignal)
    );
    expect(source.query).toHaveBeenNthCalledWith(
      2,
      'IAQ-003',
      expect.objectContaining({ cursor: null, asOf: HRM009_TEST_AS_OF }),
      HRM009_TEST_SCOPE.contextScopeKey,
      expect.any(AbortSignal)
    );
    expect(source.query).toHaveBeenNthCalledWith(
      3,
      'IAQ-003',
      expect.objectContaining({ cursor: 'abcdefghijklmnop', asOf: HRM009_TEST_AS_OF }),
      HRM009_TEST_SCOPE.contextScopeKey,
      expect.any(AbortSignal)
    );
    expect(source.query).toHaveBeenNthCalledWith(
      4,
      'IAQ-003',
      expect.objectContaining({ cursor: null, asOf: HRM009_TEST_AS_OF }),
      HRM009_TEST_SCOPE.contextScopeKey,
      expect.any(AbortSignal)
    );
  });

  it('aborts a superseded semantic scope and ignores its late owner projection', async () => {
    const superseded = deferred<Hrm009Projection>();
    const source = adapter();
    vi.mocked(source.query)
      .mockReset()
      .mockReturnValueOnce(superseded.promise)
      .mockResolvedValueOnce(projection('IAQ-003'));
    const renderScope = async (scope: Hrm009TrustedScope) => {
      await act(async () => {
        root.render(
          <StrictMode>
            <Hrm009CertificateWorkbench
              queryId="IAQ-003"
              gate={ADMITTED}
              scope={scope}
              adapter={source}
            />
          </StrictMode>
        );
      });
    };

    await renderScope(HRM009_TEST_SCOPE);
    await vi.waitFor(() => expect(source.query).toHaveBeenCalledOnce());
    const supersededSignal = vi.mocked(source.query).mock.calls[0]?.[3];

    await renderScope({ ...HRM009_TEST_SCOPE, locale: 'ko' });
    await vi.waitFor(() => expect(source.query).toHaveBeenCalledTimes(2));
    await shown('My HR requests and certificates');
    expect(supersededSignal?.aborted).toBe(true);

    await act(async () => {
      superseded.resolve(projection('IAQ-003', 'UNAVAILABLE'));
      await superseded.promise;
    });
    expect(document.querySelector('[data-runtime-state="complete"]')).not.toBeNull();
    expect(document.querySelector('[data-runtime-state="unavailable"]')).toBeNull();
    expect(source.query).toHaveBeenCalledTimes(2);
  });

  it('renders IAQ-010 as a single focus-form composition without the IAQ-003 work list', async () => {
    const source = adapter(projection('IAQ-010'));
    await renderWorkbench('IAQ-010', source, {
      defaultPersonPublicId: HRM009_TEST_PERSON_ID,
      onRequestCertificate: vi.fn(),
    });
    await shown('Certificate issuance focus');

    const workbench = document.querySelector<HTMLElement>(
      '[data-testid="hrm-009-certificate-workbench"]'
    );
    expect(workbench?.dataset.pageArchetype).toBe('focus-form');
    expect(document.querySelector('[data-testid="hrm-009-operations-focus-form"]')).not.toBeNull();
    expect(document.querySelector('[data-archetype-composition="focus-form"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="hrm-009-work-list"]')).toBeNull();
    expect(document.querySelector('[data-testid="hrm-009-work-detail"]')).toBeNull();
    expect(document.querySelectorAll('form')).toHaveLength(1);
  });

  it.each([
    ['1440px light', 1440, 1, 'light', false, false, 'IAQ-003', 'COMPLETE'],
    ['1280px dark', 1280, 1, 'dark', false, false, 'IAQ-010', 'COMPLETE'],
    ['390px high contrast', 390, 1, 'light', true, false, 'IAQ-003', 'COMPLETE'],
    ['320px reduced motion partial', 320, 1, 'dark', false, true, 'IAQ-010', 'PARTIAL'],
    ['1440px at 200% zoom', 1440, 2, 'dark', true, true, 'IAQ-003', 'COMPLETE'],
    ['1280px at 200% zoom', 1280, 2, 'light', false, true, 'IAQ-010', 'COMPLETE'],
  ] as const)(
    'provides component-fake viewport, preference, long-label, and partial-state DOM evidence: %s',
    async (
      label,
      physicalWidth,
      zoom,
      colorScheme,
      forcedColors,
      reducedMotion,
      queryId,
      state
    ) => {
      const cssWidth = physicalWidth / zoom;
      installComponentFakeEnvironment({ cssWidth, colorScheme, forcedColors, reducedMotion });
      host.style.width = `${cssWidth}px`;
      host.dataset.physicalWidth = String(physicalWidth);
      host.dataset.zoomPercent = String(zoom * 100);
      const wire = hrm009ProjectionWire(queryId, state);
      const longLabel = Array.from(
        { length: 4 },
        () =>
          `장문 증명서 발급 검토 ${label} Long governed certificate issuance metadata requiring careful review`
      ).join(' · ');
      wire.items[0]!.title = longLabel;
      const source = adapter(wire as unknown as Hrm009Projection);
      const delegate = vi.fn().mockResolvedValue(hrm009Receipt());

      await act(async () => {
        root.render(
          <ThemeProvider theme={createTheme({ palette: { mode: colorScheme } })}>
            <Hrm009CertificateWorkbench
              queryId={queryId}
              gate={ADMITTED}
              scope={HRM009_TEST_SCOPE}
              adapter={source}
              defaultPersonPublicId={HRM009_TEST_PERSON_ID}
              onRequestCertificate={delegate}
            />
          </ThemeProvider>
        );
      });
      await shown(longLabel);

      const workbench = document.querySelector<HTMLElement>(
        '[data-testid="hrm-009-certificate-workbench"]'
      );
      expect(workbench).not.toBeNull();
      expect(host.style.width).toBe(`${cssWidth}px`);
      expect(host.dataset.physicalWidth).toBe(String(physicalWidth));
      expect(host.dataset.zoomPercent).toBe(String(zoom * 100));
      expect(workbench?.dataset.layoutDensity).toBe(cssWidth < 600 ? 'compact' : 'fluid');
      expect(workbench?.dataset.colorScheme).toBe(colorScheme);
      expect(workbench?.dataset.forcedColors).toBe(forcedColors ? 'active' : 'inactive');
      expect(workbench?.dataset.reducedMotion).toBe(reducedMotion ? 'active' : 'inactive');
      expect(window.matchMedia).toHaveBeenCalledWith('(forced-colors: active)');
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      expect(workbench?.dataset.pageArchetype).toBe(
        queryId === 'IAQ-003' ? 'list-detail' : 'focus-form'
      );
      expect(document.body.textContent).toContain('장문 증명서 발급 검토');
      expect(document.body.textContent).toContain('Long governed certificate issuance metadata');
      expect(document.querySelectorAll('form')).toHaveLength(1);

      const longLabelElement = [...document.querySelectorAll<HTMLElement>('h2, h3, span')].find(
        (candidate) => candidate.textContent === longLabel
      );
      expect(longLabelElement).toBeDefined();
      expect(window.getComputedStyle(longLabelElement!).overflowWrap).toBe('anywhere');

      if (queryId === 'IAQ-003') {
        expect(document.querySelector('[data-archetype-composition="list-detail"]')).not.toBeNull();
        expect(document.querySelector('[data-testid="hrm-009-work-list"]')).not.toBeNull();
      } else {
        expect(document.querySelector('[data-archetype-composition="focus-form"]')).not.toBeNull();
        expect(document.querySelector('[data-testid="hrm-009-work-list"]')).toBeNull();
      }
      if (state === 'PARTIAL') {
        expect(document.body.textContent).toContain('Some governed metadata is unavailable');
        expect(button('Review and send request').disabled).toBe(true);
      } else {
        expect(button('Review and send request').disabled).toBe(false);
      }
    }
  );

  it('supports keyboard-only focus and semantic submit in the IAQ-010 focus-form fake', async () => {
    installComponentFakeEnvironment({
      cssWidth: 320,
      colorScheme: 'dark',
      forcedColors: true,
      reducedMotion: true,
    });
    host.style.width = '320px';
    const delegate = vi.fn().mockResolvedValue(hrm009Receipt());
    const source = adapter(projection('IAQ-010'));
    await act(async () => {
      root.render(
        <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
          <Hrm009OperationsCertificatesSurface
            gate={ADMITTED}
            scope={HRM009_TEST_SCOPE}
            adapter={source}
            defaultPersonPublicId={HRM009_TEST_PERSON_ID}
            onRequestCertificate={delegate}
          />
        </ThemeProvider>
      );
    });
    await shown('Certificate issuance focus');

    const focusSelector = document.querySelector<HTMLElement>('[role="combobox"]');
    expect(focusSelector).not.toBeNull();
    focusSelector?.focus();
    expect(document.activeElement).toBe(focusSelector);

    const submit = button('Review and send request');
    expect(submit.type).toBe('submit');
    expect(submit.tabIndex).toBeGreaterThanOrEqual(0);
    submit.focus();
    expect(document.activeElement).toBe(submit);
    await act(async () => {
      submit.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
      submit.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await shown('Certificate command receipt accepted');
    expect(delegate).toHaveBeenCalledOnce();
    expect(delegate).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceQueryId: 'IAQ-010',
        request: expect.objectContaining({ purposeCode: 'HR_OPERATIONS' }),
      })
    );
  });

  it('renders loading, empty, partial, unavailable, and opaque denied states', async () => {
    const pending = deferred<Hrm009Projection>();
    const source = adapter();
    vi.mocked(source.query).mockReturnValueOnce(pending.promise);
    await renderWorkbench('IAQ-003', source);
    expect(document.querySelector('[data-runtime-state="loading"]')).not.toBeNull();
    await act(async () => {
      pending.resolve(projection('IAQ-003', 'EMPTY'));
      await pending.promise;
    });
    await shown('No disclosed requests');
    expect(document.querySelector('[data-runtime-state="empty"]')).not.toBeNull();

    const partialSource = adapter(projection('IAQ-010', 'PARTIAL'));
    await renderWorkbench('IAQ-010', partialSource);
    await shown('Some governed metadata is unavailable');
    expect(document.querySelector('[data-runtime-state="partial"]')).not.toBeNull();
    expect(button('Review and send request').disabled).toBe(true);

    const unavailableSource = adapter(projection('IAQ-010', 'UNAVAILABLE'));
    await renderWorkbench('IAQ-010', unavailableSource);
    await shown('returned no disclosable metadata');
    expect(document.querySelector('[data-runtime-state="unavailable"]')).not.toBeNull();

    const deniedSource = adapter();
    vi.mocked(deniedSource.query).mockRejectedValue(new HttpError('secret owner detail', 403));
    await renderWorkbench('IAQ-003', deniedSource);
    await shown('current access context cannot disclose');
    expect(document.body.textContent).not.toContain('secret owner detail');
    expect(document.querySelector('[data-runtime-state="denied"]')).not.toBeNull();
  });

  it('discloses the central Stage-A limit and keeps every request control disabled without a delegate', async () => {
    const source = adapter(projection('IAQ-003'));
    await renderWorkbench('IAQ-003', source, {
      initialFocusPublicId: 'request:1001',
      defaultPersonPublicId: HRM009_TEST_PERSON_ID,
    });
    await shown('Stage-A is read only');

    const exactLimitation =
      'Download, revoke, verification, expiry, access-audit, and download-audit are not supported in this stage.';
    expect(document.body.textContent).toContain('Certificate submission is disabled.');
    expect(document.body.textContent).toContain(exactLimitation);
    expect(document.body.textContent).toContain(
      'The command delegate is intentionally withheld for this read-only Stage-A mount.'
    );
    const reviewButton = button('Review and send request');
    expect(reviewButton.disabled).toBe(true);
    expect(document.querySelectorAll('form input:not(:disabled)')).toHaveLength(0);
    expect(document.querySelectorAll('form button:not(:disabled)')).toHaveLength(0);
    const unsupportedControl = /download|revoke|verification|expiry|access-audit|download-audit/iu;
    expect(
      [...document.querySelectorAll('button, a')].filter((control) =>
        unsupportedControl.test(control.textContent ?? '')
      )
    ).toHaveLength(0);
    expect(
      [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].filter((link) =>
        unsupportedControl.test(link.getAttribute('href') ?? '')
      )
    ).toHaveLength(0);
    expect(document.querySelectorAll('button[formaction]')).toHaveLength(0);
    expect(source.query).toHaveBeenCalledOnce();
    expect(source.query).toHaveBeenCalledWith(
      'IAQ-003',
      expect.any(Object),
      HRM009_TEST_SCOPE.contextScopeKey,
      expect.any(AbortSignal)
    );
    const admittedOwnerGetCount = vi.mocked(source.query).mock.calls.length;
    await act(async () => reviewButton.click());
    expect(vi.mocked(source.query).mock.calls.slice(admittedOwnerGetCount)).toHaveLength(0);
  });

  it('retains a failed refresh only as stale metadata and synchronously fences the command', async () => {
    const source = adapter(projection('IAQ-003'));
    const delegate = vi.fn();
    await renderWorkbench('IAQ-003', source, {
      defaultPersonPublicId: HRM009_TEST_PERSON_ID,
      onRequestCertificate: delegate,
    });
    await shown('My HR requests and certificates');
    vi.mocked(source.query).mockRejectedValueOnce(new HttpError('owner unavailable', 503));
    await act(async () => {
      button('Refresh').click();
      document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true }));
    });
    expect(delegate).not.toHaveBeenCalled();
    await shown('The disclosed metadata is stale');
    expect(document.querySelector('[data-runtime-state="stale"]')).not.toBeNull();
    expect(button('Review and send request').disabled).toBe(true);
  });

  it.each([
    ['IAQ-003', 'EMPLOYEE_SELF_SERVICE'],
    ['IAQ-010', 'HR_OPERATIONS'],
  ] as const)(
    'delegates one exact %s request without a caller-selected authority branch',
    async (queryId, purposeCode) => {
      const source = adapter(projection(queryId));
      const delegate = vi.fn().mockResolvedValue(hrm009Receipt());
      await renderWorkbench(queryId, source, {
        defaultPersonPublicId: HRM009_TEST_PERSON_ID,
        onRequestCertificate: delegate,
      });
      await shown(HRM009_QUERY_CONTRACTS[queryId].framing.primaryAction);
      await act(async () => {
        document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true }));
      });
      await shown('Certificate command receipt accepted');
      expect(delegate).toHaveBeenCalledOnce();
      expect(delegate).toHaveBeenCalledWith({
        sourceQueryId: queryId,
        sourceItemPublicId: queryId === 'IAQ-003' ? 'request:1001' : 'certificate:1001',
        request: {
          personPublicId: HRM009_TEST_PERSON_ID,
          certificateType: 'EMPLOYMENT_CERTIFICATE',
          purposeCode,
          locale: 'en-US',
          asOf: HRM009_TEST_AS_OF,
        },
      });
      expect(document.body.textContent).not.toContain('TEAM_MANAGEMENT');
    }
  );
});
