// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { isProductAuthoritySensitiveQuery } from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HRM007_ADAPTER_KIND, HRM007_FEATURE } from './hrm-007-contract';
import {
  HRM007_DEFAULT_GATE,
  Hrm007AppointmentsPage,
  Hrm007PeopleEmploymentPage,
  Hrm007TeamPeopleChangesPage,
  Hrm007Workbench,
} from './hrm-007-workbench';
import { hrm007QueryContract } from './use-hrm-007-workbench';
import {
  HRM007_TEST_CURSOR,
  HRM007_TEST_SCOPE,
  hrm007ProjectionWire,
} from './hrm-007-fixtures.test-support';

import type { Hrm007QueryAdapter } from './hrm-007-api';
import type { Hrm007Projection, Hrm007QueryId, Hrm007TrustedScope } from './hrm-007-contract';
import type { Hrm007WireProjection } from './hrm-007-fixtures.test-support';
import type { Hrm007RuntimeGate, Hrm007WorkbenchProps } from './hrm-007-workbench';

const ADMITTED: Hrm007RuntimeGate = {
  feature: HRM007_FEATURE,
  enabled: true,
  tenantEnrolled: true,
};

function projection(
  queryId: Hrm007QueryId,
  state?: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE'
) {
  const wire = hrm007ProjectionWire(queryId, state);
  return wire as unknown as Hrm007Projection;
}

function adapter(result: Hrm007Projection = projection('IAQ-005')): Hrm007QueryAdapter {
  return Object.freeze({
    kind: HRM007_ADAPTER_KIND,
    query: vi.fn<Hrm007QueryAdapter['query']>().mockResolvedValue(result),
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
let client: QueryClient;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

async function renderWorkbench(
  props: Hrm007WorkbenchProps,
  entry = '/hr/team/people-changes?tab=overview&asOf=2026-10-17T00:00:00Z'
) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Hrm007Workbench {...props} />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
}

async function shown(text: string) {
  await act(async () => {
    await vi.waitFor(() => expect(document.body.textContent).toContain(text));
  });
}

function button(label: string) {
  const match = [...document.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return match;
}

describe('HRM-007 governed workbench runtime', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('forced-colors') || query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it.each([
    { enabled: false, tenantEnrolled: true },
    { enabled: true, tenantEnrolled: false },
    { enabled: false, tenantEnrolled: false },
  ])('keeps default/OFF/unenrolled runtime at zero calls: %o', async (gateState) => {
    const source = adapter();
    await renderWorkbench({
      queryId: 'IAQ-005',
      gate: { feature: HRM007_FEATURE, ...gateState },
      scope: HRM007_TEST_SCOPE,
      adapter: source,
      onDelegateAction: vi.fn(),
    });
    expect(document.querySelector('[data-runtime-state="disabled"]')).not.toBeNull();
    expect(source.query).not.toHaveBeenCalled();
    expect(document.querySelector('button:not([disabled])')).toBeNull();
  });

  it('keeps the frozen product default OFF with empty enrollment semantics', () => {
    expect(HRM007_DEFAULT_GATE).toEqual({
      feature: 'HRIS_HRM_APPOINTMENT_WORKBENCH',
      enabled: false,
      tenantEnrolled: false,
    });
    expect(Object.isFrozen(HRM007_DEFAULT_GATE)).toBe(true);
  });

  it('registers HRM-007 cache for central authority revocation and purges the snapshot', async () => {
    const source = adapter(projection('IAQ-005'));
    await renderWorkbench({
      queryId: 'IAQ-005',
      gate: ADMITTED,
      scope: HRM007_TEST_SCOPE,
      adapter: source,
    });
    await shown('Employment details change');

    const contract = hrm007QueryContract(source, 'IAQ-005', HRM007_TEST_SCOPE);
    expect(contract.queryKey.slice(0, 10)).toEqual([
      'product-surface-sensitive',
      HRM007_TEST_SCOPE.tenantId,
      HRM007_TEST_SCOPE.actorId,
      HRM007_TEST_SCOPE.accessMode,
      'hcm',
      'hcm.team',
      HRM007_TEST_SCOPE.contextScopeKey,
      HRM007_TEST_SCOPE.decisionRevision,
      'hris',
      'hrm-007',
    ]);
    expect(contract.meta).toEqual({
      accessSensitive: true,
      tenantId: HRM007_TEST_SCOPE.tenantId,
      actorId: HRM007_TEST_SCOPE.actorId,
      accessMode: HRM007_TEST_SCOPE.accessMode,
      productId: 'hcm',
      surfaceId: 'hcm.team',
      contextScopeKey: HRM007_TEST_SCOPE.contextScopeKey,
      decisionRevision: HRM007_TEST_SCOPE.decisionRevision,
    });
    const cached = client.getQueryCache().find({ queryKey: contract.queryKey, exact: true });
    expect(cached?.meta).toEqual(contract.meta);
    expect(
      cached &&
        isProductAuthoritySensitiveQuery(cached, {
          tenantId: HRM007_TEST_SCOPE.tenantId,
          actorId: HRM007_TEST_SCOPE.actorId,
          accessMode: HRM007_TEST_SCOPE.accessMode,
        })
    ).toBe(true);

    await act(async () => {
      client.removeQueries({
        predicate: (query) =>
          isProductAuthoritySensitiveQuery(query, {
            tenantId: HRM007_TEST_SCOPE.tenantId,
            actorId: HRM007_TEST_SCOPE.actorId,
            accessMode: HRM007_TEST_SCOPE.accessMode,
          }),
      });
    });
    expect(
      client.getQueryCache().find({ queryKey: contract.queryKey, exact: true })
    ).toBeUndefined();
  });

  it.each([
    undefined,
    { feature: HRM007_FEATURE, enabled: false, tenantEnrolled: true },
    { feature: HRM007_FEATURE, enabled: true, tenantEnrolled: false },
  ] as const)(
    'does not let a trusted admission bypass an inactive rollout gate: %o',
    async (gate) => {
      const source = adapter();
      await renderWorkbench({
        queryId: 'IAQ-005',
        ...(gate ? { gate } : {}),
        admission: {
          kind: 'TRUSTED_PRODUCT_SURFACE_PAGE',
          feature: HRM007_FEATURE,
          queryId: 'IAQ-005',
          ...HRM007_TEST_SCOPE,
        },
        adapter: source,
      });
      expect(document.querySelector('[data-runtime-state="disabled"]')).not.toBeNull();
      expect(source.query).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['IAQ-005', 'PEOPLE_CHANGES', 'Team people changes'],
    ['IAQ-007', 'APPOINTMENTS', 'HR appointments'],
    ['IAQ-013', 'PEOPLE_EMPLOYMENT', 'People and employment configuration'],
  ] as const)(
    'renders the %s page/variant through the sealed adapter',
    async (queryId, variant, title) => {
      const source = adapter(projection(queryId));
      await renderWorkbench({ queryId, gate: ADMITTED, scope: HRM007_TEST_SCOPE, adapter: source });
      await shown(title);
      const workspace = document.querySelector('[data-testid="hrm-007-workbench"]');
      expect(workspace?.getAttribute('data-query-id')).toBe(queryId);
      expect(workspace?.getAttribute('data-variant')).toBe(variant);
      expect(workspace?.getAttribute('data-runtime-state')).toBe('complete');
      expect(source.query).toHaveBeenCalledOnce();
      expect(source.query).toHaveBeenCalledWith(
        queryId,
        expect.objectContaining({ limit: 100, sort: ['itemPublicId:ASC'] }),
        HRM007_TEST_SCOPE.contextScopeKey,
        expect.any(AbortSignal)
      );
    }
  );

  it('renders distinct loading, empty, partial, unavailable, and denied states', async () => {
    const pending = deferred<Hrm007Projection>();
    const loadingSource = adapter();
    vi.mocked(loadingSource.query).mockReturnValueOnce(pending.promise);
    await renderWorkbench({
      queryId: 'IAQ-005',
      gate: ADMITTED,
      scope: HRM007_TEST_SCOPE,
      adapter: loadingSource,
    });
    expect(document.querySelector('[data-runtime-state="loading"]')).not.toBeNull();
    pending.resolve(projection('IAQ-005', 'EMPTY'));
    await shown('No disclosed people changes');
    expect(document.querySelector('[data-runtime-state="empty"]')).not.toBeNull();

    const partialSource = adapter(projection('IAQ-007', 'PARTIAL'));
    await renderWorkbench({
      queryId: 'IAQ-007',
      gate: ADMITTED,
      scope: HRM007_TEST_SCOPE,
      adapter: partialSource,
    });
    await shown('Some governed data is unavailable');
    expect(document.querySelector('[data-runtime-state="partial"]')).not.toBeNull();

    const unavailableSource = adapter(projection('IAQ-013', 'UNAVAILABLE'));
    await renderWorkbench({
      queryId: 'IAQ-013',
      gate: ADMITTED,
      scope: HRM007_TEST_SCOPE,
      adapter: unavailableSource,
    });
    await shown('The owner returned no disclosable data');
    expect(document.querySelector('[data-runtime-state="unavailable"]')).not.toBeNull();

    const deniedSource = adapter();
    vi.mocked(deniedSource.query).mockRejectedValue(new HttpError('hidden', 403));
    await renderWorkbench({
      queryId: 'IAQ-005',
      gate: ADMITTED,
      scope: HRM007_TEST_SCOPE,
      adapter: deniedSource,
    });
    await shown('The current access context cannot disclose this workbench');
    expect(document.body.textContent).not.toContain('hidden');
    expect(document.querySelector('[data-runtime-state="denied"]')).not.toBeNull();
  });

  it.each([400, 401, 403, 404, 409])(
    'conceals and purges cached objects and actions after HTTP %s',
    async (status) => {
      const source = adapter(projection('IAQ-005'));
      const delegate = vi.fn();
      const queryKey = hrm007QueryContract(source, 'IAQ-005', HRM007_TEST_SCOPE).queryKey;
      await renderWorkbench({
        queryId: 'IAQ-005',
        gate: ADMITTED,
        scope: HRM007_TEST_SCOPE,
        adapter: source,
        onDelegateAction: delegate,
      });
      await shown('Employment details change');
      expect(button('Create Employee Change Request').disabled).toBe(false);

      vi.mocked(source.query).mockRejectedValueOnce(new HttpError('not disclosed', status));
      await act(async () => button('Refresh').click());
      await shown('The current access context cannot disclose this workbench');
      expect(document.body.textContent).not.toContain('Employment details change');
      expect(document.body.textContent).not.toContain('Create Employee Change Request');
      expect(delegate).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(client.getQueryData(queryKey)).toBeUndefined());
    }
  );

  it.each([
    [
      'malformed field contract',
      (wire: Hrm007WireProjection) => {
        wire.items[0]!.fieldGroups.FOREIGN_FIELD = { decision: 'VIEW', value: {} };
      },
    ],
    [
      'authorization revision mismatch',
      (wire: Hrm007WireProjection) => {
        wire.queryState.cachePolicy.authorizationDecisionRevision = 'decision:hrm-007:999';
      },
    ],
  ] as const)('conceals and purges cached objects after a local %s', async (_label, corrupt) => {
    const source = adapter(projection('IAQ-005'));
    const delegate = vi.fn();
    const queryKey = hrm007QueryContract(source, 'IAQ-005', HRM007_TEST_SCOPE).queryKey;
    await renderWorkbench({
      queryId: 'IAQ-005',
      gate: ADMITTED,
      scope: HRM007_TEST_SCOPE,
      adapter: source,
      onDelegateAction: delegate,
    });
    await shown('Employment details change');
    expect(button('Create Employee Change Request').disabled).toBe(false);

    const malformed = hrm007ProjectionWire('IAQ-005');
    corrupt(malformed);
    vi.mocked(source.query).mockResolvedValueOnce(malformed as unknown as Hrm007Projection);
    await act(async () => button('Refresh').click());
    await shown('The current access context cannot disclose this workbench');
    expect(document.body.textContent).not.toContain('Employment details change');
    expect(document.body.textContent).not.toContain('Create Employee Change Request');
    expect(delegate).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(client.getQueryData(queryKey)).toBeUndefined());
  });

  it.each([
    ['HTTP 429', () => new HttpError('rate limited', 429)],
    ['HTTP 503', () => new HttpError('owner unavailable', 503)],
    ['network failure', () => new HttpTransportError('NETWORK')],
  ] as const)(
    'retains cached data after %s only under an explicit stale warning with no enabled action',
    async (_label, failure) => {
      const source = adapter(projection('IAQ-005'));
      const delegate = vi.fn();
      const queryKey = hrm007QueryContract(source, 'IAQ-005', HRM007_TEST_SCOPE).queryKey;
      await renderWorkbench({
        queryId: 'IAQ-005',
        gate: ADMITTED,
        scope: HRM007_TEST_SCOPE,
        adapter: source,
        onDelegateAction: delegate,
      });
      await shown('Employment details change');
      vi.mocked(source.query).mockRejectedValueOnce(failure());
      await act(async () => button('Refresh').click());
      await shown('The disclosed snapshot is stale');
      expect(document.body.textContent).toContain('Employment details change');
      expect(button('Create Employee Change Request').disabled).toBe(true);
      expect(document.querySelector('[data-runtime-state="stale"]')).not.toBeNull();
      expect(client.getQueryData(queryKey)).toBeDefined();
    }
  );

  it('does not retain cached data for an unclassified local failure', async () => {
    const source = adapter(projection('IAQ-005'));
    const queryKey = hrm007QueryContract(source, 'IAQ-005', HRM007_TEST_SCOPE).queryKey;
    await renderWorkbench({
      queryId: 'IAQ-005',
      gate: ADMITTED,
      scope: HRM007_TEST_SCOPE,
      adapter: source,
    });
    await shown('Employment details change');
    vi.mocked(source.query).mockRejectedValueOnce(new Error('unexpected local failure'));
    await act(async () => button('Refresh').click());
    await shown('Owner data could not be loaded');
    expect(document.body.textContent).not.toContain('Employment details change');
    expect(document.querySelector('[data-runtime-state="stale"]')).toBeNull();
    await vi.waitFor(() => expect(client.getQueryData(queryKey)).toBeUndefined());
    await act(async () => button('Retry').click());
    await shown('Employment details change');
  });

  it('fences delegated actions synchronously while refresh is in flight or terminally failed', async () => {
    const source = adapter(projection('IAQ-005'));
    const delegate = vi.fn();
    await renderWorkbench({
      queryId: 'IAQ-005',
      gate: ADMITTED,
      scope: HRM007_TEST_SCOPE,
      adapter: source,
      onDelegateAction: delegate,
    });
    await shown('Employment details change');
    expect(button('Create Employee Change Request').disabled).toBe(false);

    const pending = deferred<Hrm007Projection>();
    vi.mocked(source.query).mockReturnValueOnce(pending.promise);
    await act(async () => {
      button('Refresh').click();
      button('Create Employee Change Request').click();
    });
    expect(delegate).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(button('Create Employee Change Request').disabled).toBe(true));
    button('Create Employee Change Request').click();
    expect(delegate).not.toHaveBeenCalled();

    pending.resolve(projection('IAQ-005'));
    await vi.waitFor(() => expect(button('Create Employee Change Request').disabled).toBe(false));

    const pendingNext = deferred<Hrm007Projection>();
    vi.mocked(source.query).mockReturnValueOnce(pendingNext.promise);
    await act(async () => {
      button('Next').click();
      button('Create Employee Change Request').click();
    });
    expect(delegate).not.toHaveBeenCalled();
    pendingNext.resolve(projection('IAQ-005'));
    await shown('Employment details change');
    await vi.waitFor(() => expect(button('Create Employee Change Request').disabled).toBe(false));

    const actionBeforeTerminalRender = button('Create Employee Change Request');
    let attemptedAtTerminalState = false;
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (
        attemptedAtTerminalState ||
        event.query.state.status !== 'error' ||
        event.query.state.fetchStatus !== 'idle'
      ) {
        return;
      }
      attemptedAtTerminalState = true;
      actionBeforeTerminalRender.click();
    });
    vi.mocked(source.query).mockRejectedValueOnce(new HttpError('not disclosed', 403));
    await act(async () => button('Refresh').click());
    unsubscribe();
    expect(attemptedAtTerminalState).toBe(true);
    await shown('The current access context cannot disclose this workbench');
    expect(delegate).not.toHaveBeenCalled();
  });

  it('isolates cached data when the adapter instance changes', async () => {
    const first = adapter(projection('IAQ-005'));
    await renderWorkbench({
      queryId: 'IAQ-005',
      gate: ADMITTED,
      scope: HRM007_TEST_SCOPE,
      adapter: first,
    });
    await shown('Employment details change');

    const pending = deferred<Hrm007Projection>();
    const second = adapter();
    vi.mocked(second.query).mockReturnValue(pending.promise);
    await renderWorkbench({
      queryId: 'IAQ-005',
      gate: ADMITTED,
      scope: HRM007_TEST_SCOPE,
      adapter: second,
    });
    expect(document.querySelector('[data-runtime-state="loading"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Employment details change');
    const secondProjection = projection('IAQ-005') as Hrm007Projection & {
      items: { title: string }[];
    };
    secondProjection.items[0]!.title = 'Second adapter result';
    pending.resolve(secondProjection);
    await shown('Second adapter result');
  });

  it('isolates cached data when trusted scope or decision revision changes', async () => {
    const source = adapter(projection('IAQ-007'));
    await renderWorkbench({
      queryId: 'IAQ-007',
      gate: ADMITTED,
      scope: HRM007_TEST_SCOPE,
      adapter: source,
    });
    await shown('People Operations appointment');

    const pending = deferred<Hrm007Projection>();
    vi.mocked(source.query).mockReturnValueOnce(pending.promise);
    const changedScope: Hrm007TrustedScope = {
      ...HRM007_TEST_SCOPE,
      contextScopeKey: 'scope:tenant-two:hrm-007',
      decisionRevision: 'decision:hrm-007:52',
    };
    await renderWorkbench({
      queryId: 'IAQ-007',
      gate: ADMITTED,
      scope: changedScope,
      adapter: source,
    });
    expect(document.querySelector('[data-runtime-state="loading"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('People Operations appointment');
    const next = hrm007ProjectionWire('IAQ-007');
    next.items[0]!.title = 'Tenant two appointment';
    next.queryState.cachePolicy.authorizationDecisionRevision = changedScope.decisionRevision;
    pending.resolve(next as unknown as Hrm007Projection);
    await shown('Tenant two appointment');
    expect(source.query).toHaveBeenLastCalledWith(
      'IAQ-007',
      expect.any(Object),
      changedScope.contextScopeKey,
      expect.any(AbortSignal)
    );
  });

  it.each(['queryId', 'scope', 'decisionRevision', 'options', 'adapter'] as const)(
    'never requests an old page cursor after %s identity changes',
    async (change) => {
      const source = adapter(projection('IAQ-005'));
      const base: Hrm007WorkbenchProps = {
        queryId: 'IAQ-005',
        gate: ADMITTED,
        scope: HRM007_TEST_SCOPE,
        adapter: source,
      };
      await renderWorkbench(base);
      await shown('Employment details change');

      await act(async () => button('Next').click());
      await act(async () => {
        await vi.waitFor(() => expect(source.query).toHaveBeenCalledTimes(2));
      });
      expect(vi.mocked(source.query).mock.calls[1]![1].cursor).toBe(HRM007_TEST_CURSOR);

      let target = source;
      let changed: Hrm007WorkbenchProps = base;
      if (change === 'queryId') changed = { ...base, queryId: 'IAQ-007' };
      if (change === 'scope') {
        changed = {
          ...base,
          scope: { ...HRM007_TEST_SCOPE, contextScopeKey: 'scope:tenant-two:hrm-007' },
        };
      }
      if (change === 'decisionRevision') {
        changed = {
          ...base,
          scope: { ...HRM007_TEST_SCOPE, decisionRevision: 'decision:hrm-007:52' },
        };
      }
      if (change === 'options') {
        changed = { ...base, options: { asOf: '2026-10-18T00:00:00Z' } };
      }
      if (change === 'adapter') {
        target = adapter();
        changed = { ...base, adapter: target };
      }

      const pending = deferred<Hrm007Projection>();
      vi.mocked(target.query).mockReset().mockReturnValue(pending.promise);
      await renderWorkbench(changed);

      const calls = vi.mocked(target.query).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]![0]).toBe(changed.queryId);
      expect(calls[0]![1].cursor).toBeNull();
      expect(calls[0]![2]).toBe(changed.scope!.contextScopeKey);
    }
  );

  it('preserves only authority selectors and IAQ-specific filter/sort URL state when selection updates focus', async () => {
    const wire = hrm007ProjectionWire('IAQ-005');
    const second = structuredClone(wire.items[0]!);
    second.itemPublicId = 'people-change:1002';
    second.title = 'Second governed change';
    second.deepLink.resourcePublicId = 'people-change:1002';
    wire.items.push(second);
    wire.queryState.fieldDecisionSummary.viewCount = 6;
    const source = adapter(wire as unknown as Hrm007Projection);
    await renderWorkbench(
      { queryId: 'IAQ-005', gate: ADMITTED, scope: HRM007_TEST_SCOPE, adapter: source },
      '/hr/team/people-changes?tab=other&scope=scope%3Ahcm%2Fnon-default&navigationScope=LEGAL_ENTITY&legalEntityPublicId=6d07e952-2f5f-4dc1-8be7-6d7e210d23af&asOf=2026-10-17T00%3A00%3A00Z&sort=approvalStatus%3ADESC&sort=itemPublicId%3AASC&filter%5BapprovalStatus%5D%5Bcodes%5D=APPROVED&filter%5BapprovalStatus%5D%5Bcodes%5D=PENDING&filter%5BapprovalStatus%5D%5BminimumRevision%5D=2&filter%5Bappointment%5D%5BstartFrom%5D=2026-10-17T00%3A00%3A00Z&cursor=abcdefghijklmnop&tenantId=forbidden&decisionRevision=forbidden&focus=people-change%3A1001&unsafe=drop'
    );
    await shown('Second governed change');
    const detailLink = [...document.querySelectorAll('a')].find((candidate) =>
      candidate.textContent?.includes('Open governed detail')
    );
    const detailSearch = new URL(detailLink?.getAttribute('href') ?? '', 'https://dwp.invalid')
      .searchParams;
    expect(detailSearch.get('tab')).toBe('overview');
    expect(detailSearch.get('scope')).toBe('scope:hcm/non-default');
    expect(detailSearch.get('navigationScope')).toBe('LEGAL_ENTITY');
    expect(detailSearch.get('legalEntityPublicId')).toBe('6d07e952-2f5f-4dc1-8be7-6d7e210d23af');
    expect(detailSearch.get('asOf')).toBe('2026-10-17T00:00:00Z');
    expect(detailSearch.getAll('sort')).toEqual(['approvalStatus:DESC', 'itemPublicId:ASC']);
    expect(detailSearch.getAll('filter[approvalStatus][codes]')).toEqual(['APPROVED', 'PENDING']);
    expect(detailSearch.get('filter[approvalStatus][minimumRevision]')).toBe('2');
    expect(detailSearch.get('filter[appointment][startFrom]')).toBeNull();
    expect(detailSearch.get('cursor')).toBeNull();
    expect(detailSearch.get('tenantId')).toBeNull();
    expect(detailSearch.get('decisionRevision')).toBeNull();
    expect(detailSearch.get('unsafe')).toBeNull();
    const selection = button('Second governed change');
    expect(selection.getAttribute('aria-pressed')).toBe('false');
    await act(async () => selection.click());
    const location = document.querySelector('[data-testid="location"]')?.textContent ?? '';
    const selectedSearch = new URLSearchParams(location);
    expect(selectedSearch.get('tab')).toBe('overview');
    expect(selectedSearch.get('focus')).toBe('people-change:1002');
    expect(selectedSearch.get('scope')).toBe('scope:hcm/non-default');
    expect(selectedSearch.get('navigationScope')).toBe('LEGAL_ENTITY');
    expect(selectedSearch.get('legalEntityPublicId')).toBe('6d07e952-2f5f-4dc1-8be7-6d7e210d23af');
    expect(selectedSearch.getAll('sort')).toEqual(['approvalStatus:DESC', 'itemPublicId:ASC']);
    expect(selectedSearch.getAll('filter[approvalStatus][codes]')).toEqual(['APPROVED', 'PENDING']);
    expect(selectedSearch.get('filter[appointment][startFrom]')).toBeNull();
    expect(selectedSearch.get('cursor')).toBeNull();
    expect(selectedSearch.get('unsafe')).toBeNull();
    expect(selection.getAttribute('aria-pressed')).toBe('true');
  });

  it('exports all three page wrappers without mounting central routes', async () => {
    const wrappers = [
      <Hrm007TeamPeopleChangesPage key="team" />,
      <Hrm007AppointmentsPage key="appointments" />,
      <Hrm007PeopleEmploymentPage key="settings" />,
    ];
    await act(async () => {
      root.render(
        <MemoryRouter>
          <div>{wrappers}</div>
        </MemoryRouter>
      );
    });
    expect(document.querySelectorAll('[data-runtime-state="disabled"]')).toHaveLength(3);
  });
});
