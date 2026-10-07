// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultRegionalPreference,
  HttpError,
  writeRegionalPreference,
} from '@dwp-frontend/shared-utils';

import { HrisPayrollWorkspace, buildPayrollSelfServiceModel, getHrisPayrollWorkspace } from '..';

import type { HrPayStatement, HrPayWorkspace } from '@dwp-frontend/shared-utils';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

const scopeRuntime = vi.hoisted(() => ({
  current: null as ProductSurfaceRequestScope | null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('../api/payroll-api', () => ({ getHrisPayrollWorkspace: vi.fn() }));

vi.mock('../../../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => scopeRuntime.current,
}));

function requestScope({
  tenantId = 'tenant-a',
  actorId = 'actor-a',
  accessMode = 'NORMAL',
  contextScopeKey = 'scope-personal-a',
  decisionRevision = 'revision-a',
  ready = true,
}: Partial<{
  tenantId: string;
  actorId: string;
  accessMode: string;
  contextScopeKey: string;
  decisionRevision: string;
  ready: boolean;
}> = {}): ProductSurfaceRequestScope {
  return {
    governed: true,
    ready,
    ...(ready ? { contextScopeKey } : {}),
    cacheKey: [
      tenantId,
      actorId,
      accessMode,
      'hcm.personal',
      ready ? contextScopeKey : '',
      decisionRevision,
    ],
    queryMeta: {
      accessSensitive: true,
      tenantId,
      actorId,
      accessMode,
      productId: 'hcm',
      surfaceId: 'hcm.personal',
      ...(ready ? { contextScopeKey } : {}),
      decisionRevision,
    },
  };
}

function statement(overrides: Partial<HrPayStatement> = {}): HrPayStatement {
  return {
    statementId: 'statement-1',
    periodLabel: 'August 2026',
    availabilityState: 'AVAILABLE',
    publishedAt: '2026-08-25T00:00:00Z',
    downloadable: true,
    ...overrides,
  };
}

function workspace(overrides: Partial<HrPayWorkspace> = {}): HrPayWorkspace {
  return {
    employee: {
      personId: 'person-1',
      displayName: 'Kim DWP',
      directReportCount: 0,
    },
    nextCycle: {
      payCycleId: 'cycle-1',
      name: 'September payroll',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      payDate: '2026-09-25',
      status: 'OPEN',
      timeValidated: true,
      absenceValidated: false,
      sourceConfirmed: true,
      dataOrigin: 'SOURCE',
    },
    statements: [statement()],
    monetaryDataRedacted: true,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

let host: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

async function renderWorkspace(
  onDownloadStatement?: (statementId: string) => void | Promise<void>
) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <HrisPayrollWorkspace onDownloadStatement={onDownloadStatement} />
      </QueryClientProvider>
    )
  );
  await settle();
}

describe('HrisPayrollWorkspace runtime states', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    scopeRuntime.current = requestScope();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
    window.localStorage.clear();
  });

  it('uses the scoped pay query and renders a complete loading state', async () => {
    vi.mocked(getHrisPayrollWorkspace).mockReturnValue(deferred<HrPayWorkspace>().promise);

    await renderWorkspace();

    expect(getHrisPayrollWorkspace).toHaveBeenCalledTimes(1);
    expect(getHrisPayrollWorkspace).toHaveBeenCalledWith(
      'scope-personal-a',
      expect.any(AbortSignal)
    );
    expect(host.querySelector('[data-query-state="loading"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="hris-payroll-workspace"]')).toBeNull();
  });

  it('does not issue a personal-pay request until the governed scope is ready', async () => {
    scopeRuntime.current = requestScope({ ready: false });

    await renderWorkspace();

    expect(getHrisPayrollWorkspace).not.toHaveBeenCalled();
    expect(host.querySelector('[data-query-state="loading"]')).not.toBeNull();
    expect(host.textContent).not.toContain('September payroll');
  });

  it('rekeys on the full authority scope and never revives an old deferred response', async () => {
    const oldResponse = deferred<HrPayWorkspace>();
    const nextResponse = deferred<HrPayWorkspace>();
    let oldSignal: AbortSignal | undefined;
    let nextSignal: AbortSignal | undefined;
    vi.mocked(getHrisPayrollWorkspace).mockImplementation((contextScopeKey, signal) => {
      if (contextScopeKey === 'scope-personal-a') {
        oldSignal = signal;
        return oldResponse.promise;
      }
      nextSignal = signal;
      return nextResponse.promise;
    });

    await renderWorkspace();
    const oldScope = scopeRuntime.current!;
    expect(
      queryClient.getQueryCache().find({
        queryKey: ['hcm', 'pay', ...oldScope.cacheKey],
      })?.meta
    ).toEqual(oldScope.queryMeta);

    scopeRuntime.current = requestScope({
      tenantId: 'tenant-b',
      actorId: 'actor-b',
      accessMode: 'ELEVATED',
      contextScopeKey: 'scope-personal-b',
      decisionRevision: 'revision-b',
    });
    await renderWorkspace();

    expect(oldSignal?.aborted).toBe(true);
    expect(nextSignal).toBeInstanceOf(AbortSignal);
    expect(getHrisPayrollWorkspace).toHaveBeenNthCalledWith(2, 'scope-personal-b', nextSignal);
    expect(host.textContent).not.toContain('Old tenant payroll');

    await act(async () =>
      oldResponse.resolve(
        workspace({
          nextCycle: { ...workspace().nextCycle!, name: 'Old tenant payroll' },
        })
      )
    );
    await settle();
    expect(host.textContent).not.toContain('Old tenant payroll');
    expect(host.querySelector('[data-query-state="loading"]')).not.toBeNull();

    await act(async () =>
      nextResponse.resolve(
        workspace({
          nextCycle: { ...workspace().nextCycle!, name: 'New tenant payroll' },
        })
      )
    );
    await settle();

    expect(host.textContent).toContain('New tenant payroll');
    expect(host.textContent).not.toContain('Old tenant payroll');
    expect(
      queryClient.getQueryCache().find({
        queryKey: ['hcm', 'pay', ...scopeRuntime.current!.cacheKey],
      })?.meta
    ).toEqual(scopeRuntime.current!.queryMeta);
  });

  it('renders permission and generic error states without retaining payroll data', async () => {
    vi.mocked(getHrisPayrollWorkspace).mockRejectedValue(new HttpError('Denied', 403));
    await renderWorkspace();
    expect(host.querySelector('[data-query-state="permission"]')).not.toBeNull();
    expect(host.textContent).not.toContain('September payroll');

    vi.mocked(getHrisPayrollWorkspace).mockRejectedValue(new Error('Unavailable'));
    await act(async () => {
      await queryClient.resetQueries({ queryKey: ['hcm', 'pay'] });
    });
    await settle();
    expect(host.querySelector('[data-query-state="unknown"]')).not.toBeNull();
    expect(host.textContent).not.toContain('September payroll');
  });

  it('renders the empty state when the source supplies no cycle and no statements', async () => {
    vi.mocked(getHrisPayrollWorkspace).mockResolvedValue(
      workspace({ nextCycle: null, statements: [], monetaryDataRedacted: true })
    );

    await renderWorkspace();

    expect(host.textContent).toContain('domains.pay.emptyTitle');
    expect(host.textContent).toContain('Read-only payroll source view');
    expect(host.textContent).toContain('NONE');
  });

  it('shows reference provenance, redaction and the non-operational boundary', async () => {
    vi.mocked(getHrisPayrollWorkspace).mockResolvedValue(
      workspace({
        nextCycle: {
          ...workspace().nextCycle!,
          dataOrigin: 'REFERENCE',
          sourceConfirmed: false,
        },
        monetaryDataRedacted: true,
      })
    );

    await renderWorkspace();

    expect(host.textContent).toContain('domains.reference.title');
    expect(host.textContent).toContain('REFERENCE');
    expect(host.textContent).toContain('Monetary data redacted by source');
    expect(host.textContent).toContain(
      'This page does not calculate payroll, confirm payroll results, or initiate payment.'
    );
  });

  it('keeps a civil pay date unchanged while localizing a publication instant', async () => {
    writeRegionalPreference({
      ...defaultRegionalPreference,
      timeZone: 'America/Los_Angeles',
      dateFormat: 'iso',
    });
    vi.mocked(getHrisPayrollWorkspace).mockResolvedValue(workspace());

    await renderWorkspace();

    expect(host.textContent).toContain('2026-09-25');
    expect(host.textContent).not.toContain('2026-09-24');
    expect(host.textContent).toContain('2026-08-24');
  });

  it('never renders an open or download action for an unavailable statement', async () => {
    const download = vi.fn();
    vi.mocked(getHrisPayrollWorkspace).mockResolvedValue(
      workspace({
        statements: [statement({ availabilityState: 'WITHHELD', downloadable: true })],
      })
    );

    await renderWorkspace(download);

    expect(host.textContent).toContain('WITHHELD');
    expect(host.textContent).toContain('Not downloadable');
    expect(host.querySelector('button[aria-label*="August 2026"]')).toBeNull();
    expect(download).not.toHaveBeenCalled();
  });

  it('does not render a dead action when secure download wiring is absent', async () => {
    vi.mocked(getHrisPayrollWorkspace).mockResolvedValue(workspace());

    await renderWorkspace();

    expect(host.textContent).toContain('Downloadable');
    expect(host.textContent).toContain('secure download is not connected here yet');
    expect(host.querySelector('button[aria-label*="August 2026"]')).toBeNull();
  });

  it('offers an available statement only when a real download handler is supplied', async () => {
    const download = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getHrisPayrollWorkspace).mockResolvedValue(workspace());

    await renderWorkspace(download);
    const button = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Download pay statement for August 2026"]'
    );
    expect(button).not.toBeNull();

    await act(async () => button!.click());
    await settle();

    expect(download).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledWith('statement-1');
  });

  it('reports a secure-download failure without claiming success or changing source data', async () => {
    const download = vi.fn().mockRejectedValue(new Error('Source unavailable'));
    vi.mocked(getHrisPayrollWorkspace).mockResolvedValue(workspace());

    await renderWorkspace(download);
    const button = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Download pay statement for August 2026"]'
    );
    await act(async () => button!.click());
    await settle();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'The secure statement could not be opened. Nothing was changed.'
    );
    expect(host.textContent).toContain('August 2026');
  });

  it('clears previous authority download state even when the next scope has a fresh cache entry', async () => {
    const download = vi.fn().mockRejectedValue(new Error('Previous authority download denied'));
    vi.mocked(getHrisPayrollWorkspace).mockResolvedValue(workspace());
    await renderWorkspace(download);
    const button = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Download pay statement for August 2026"]'
    );
    await act(async () => button!.click());
    await settle();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();

    scopeRuntime.current = requestScope({
      tenantId: 'tenant-b',
      actorId: 'actor-b',
      contextScopeKey: 'scope-personal-b',
      decisionRevision: 'revision-b',
    });
    queryClient.setQueryData(
      ['hcm', 'pay', ...scopeRuntime.current.cacheKey],
      buildPayrollSelfServiceModel(workspace())
    );
    await renderWorkspace(download);

    expect(host.querySelector('[data-testid="hris-payroll-workspace"]')).not.toBeNull();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(download).toHaveBeenCalledOnce();
    expect(getHrisPayrollWorkspace).toHaveBeenCalledOnce();
  });

  it('fails closed on malformed downloadable source flags instead of offering an action', async () => {
    const download = vi.fn();
    vi.mocked(getHrisPayrollWorkspace).mockResolvedValue(
      workspace({
        statements: [{ ...statement(), downloadable: 'false' }],
      } as unknown as Partial<HrPayWorkspace>)
    );
    await renderWorkspace(download);
    expect(host.querySelector('[data-query-state="unknown"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="hris-payroll-workspace"]')).toBeNull();
    expect(host.querySelector('button[aria-label*="August 2026"]')).toBeNull();
    expect(download).not.toHaveBeenCalled();
  });

  it('keeps concurrent statements independently busy and retains each failure', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const download = vi.fn((id: string) => (id === 'statement-1' ? first.promise : second.promise));
    vi.mocked(getHrisPayrollWorkspace).mockResolvedValue(
      workspace({
        statements: [
          statement(),
          statement({ statementId: 'statement-2', periodLabel: 'July 2026' }),
        ],
      })
    );
    await renderWorkspace(download);
    const firstButton = host.querySelector<HTMLButtonElement>('button[aria-label*="August 2026"]')!;
    const secondButton = host.querySelector<HTMLButtonElement>('button[aria-label*="July 2026"]')!;
    await act(async () => firstButton.click());
    await act(async () => secondButton.click());
    expect(firstButton.disabled).toBe(true);
    expect(secondButton.disabled).toBe(true);
    await act(async () => first.reject(new Error('First source unavailable')));
    await settle();
    expect(firstButton.disabled).toBe(false);
    expect(secondButton.disabled).toBe(true);
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1);
    await act(async () => second.reject(new Error('Second source unavailable')));
    await settle();
    expect(secondButton.disabled).toBe(false);
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(2);
    expect(download.mock.calls).toEqual([['statement-1'], ['statement-2']]);
  });

  it('guards synchronous repeat clicks on one statement before state commits', async () => {
    const pending = deferred<void>();
    const download = vi.fn(() => pending.promise);
    vi.mocked(getHrisPayrollWorkspace).mockResolvedValue(workspace());
    await renderWorkspace(download);
    const button = host.querySelector<HTMLButtonElement>('button[aria-label*="August 2026"]')!;
    await act(async () => {
      button.click();
      button.click();
    });
    expect(download).toHaveBeenCalledOnce();
    await act(async () => pending.resolve());
    await settle();
    expect(button.disabled).toBe(false);
  });

  it('does not apply late callback failures to a remounted authority', async () => {
    const pending = deferred<void>();
    const download = vi.fn(() => pending.promise);
    vi.mocked(getHrisPayrollWorkspace).mockResolvedValue(workspace());
    await renderWorkspace(download);
    await act(async () =>
      host.querySelector<HTMLButtonElement>('button[aria-label*="August 2026"]')!.click()
    );
    scopeRuntime.current = requestScope({ decisionRevision: 'revision-b' });
    queryClient.setQueryData(
      ['hcm', 'pay', ...scopeRuntime.current.cacheKey],
      buildPayrollSelfServiceModel(workspace())
    );
    await renderWorkspace(download);
    await act(async () => pending.reject(new Error('Stale callback failed')));
    await settle();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(
      host.querySelector<HTMLButtonElement>('button[aria-label*="August 2026"]')!.disabled
    ).toBe(false);
  });
});
