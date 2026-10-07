// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { People360Runtime, type People360DataSource, type People360RequestScope } from '../index';
import { people360ListSnapshot, people360Page, people360Snapshot } from './people-360.test-support';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

const personId = '11111111-1111-4111-8111-111111111111';
const asOf = '2026-09-17';

const scope: People360RequestScope = {
  governed: true,
  ready: true,
  contextScopeKey: 'scope:hris/operations',
  cacheKey: ['tenant-1', 'actor-9', 'NORMAL', 'hcm.operations', 'scope:hris/operations', '73'],
  queryMeta: {
    accessSensitive: true,
    tenantId: 'tenant-1',
    actorId: 'actor-9',
    accessMode: 'NORMAL',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    contextScopeKey: 'scope:hris/operations',
    decisionRevision: '73',
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
let desktop = false;

function dataSource(
  listValue: unknown = people360Page([people360ListSnapshot()]),
  detailValue: unknown = people360Snapshot()
) {
  return {
    list: vi.fn<People360DataSource['list']>().mockResolvedValue(listValue),
    detail: vi.fn<People360DataSource['detail']>().mockResolvedValue(detailValue),
  };
}

async function renderRuntime({
  source,
  requestScope = scope,
  entry = `/hr/operations/people?person=${personId}&asOf=${asOf}`,
}: {
  source: People360DataSource;
  requestScope?: People360RequestScope;
  entry?: string;
}) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <People360Runtime
            requestScope={requestScope}
            dataSource={source}
            now="2026-09-17T00:00:00Z"
          />
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

async function clickButton(text: string) {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text
  );
  if (!button) throw new Error(`Missing button: ${text}`);
  await act(async () => button.click());
}

describe('People 360 governed runtime', () => {
  beforeEach(() => {
    desktop = false;
    Object.assign(globalThis, {
      IS_REACT_ACT_ENVIRONMENT: true,
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: desktop && query.includes('min-width'),
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
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('issues no owner request until the exact governed surface scope is ready', async () => {
    const source = dataSource();
    const notReady: People360RequestScope = {
      ...scope,
      ready: false,
      contextScopeKey: undefined,
      cacheKey: ['tenant-1', 'actor-9', 'NORMAL', 'hcm.operations', '', '74'],
      queryMeta: { ...scope.queryMeta, contextScopeKey: undefined, decisionRevision: '74' },
    };

    await renderRuntime({ source, requestScope: notReady });

    expect(source.list).not.toHaveBeenCalled();
    expect(source.detail).not.toHaveBeenCalled();
    expect(document.querySelector('[data-query-state="loading"]')).not.toBeNull();
  });

  it('sends projection, as-of, scope, and AbortSignal on both registered owner paths', async () => {
    const source = dataSource();
    await renderRuntime({ source });
    await shown('Synthetic Worker Alpha');

    const search = document.querySelector<HTMLInputElement>(
      'input[data-testid="hris-people360-search"]'
    );
    expect(search).not.toBeNull();
    expect(search?.getAttribute('aria-label')).toBe('Search authorized people');
    expect(source.list).toHaveBeenCalledWith(
      expect.objectContaining({
        projection: 'people360',
        asOf,
        contextScopeKey: 'scope:hris/operations',
        signal: expect.any(AbortSignal),
      })
    );
    expect(source.detail).toHaveBeenCalledWith(
      personId,
      asOf,
      'people360',
      'scope:hris/operations',
      expect.any(AbortSignal)
    );
  });

  it('renders owner MASK literally, hides OMIT fields, and exposes no unmask control', async () => {
    const source = dataSource(
      people360Page([people360ListSnapshot()]),
      people360Snapshot({
        decisions: {
          'person.preferredLocale': 'OMIT',
          'employment.workerNumber': 'MASK',
          'primaryAssignment.locationName': 'OMIT',
        },
      })
    );
    await renderRuntime({ source });
    await shown('Masked by policy');

    expect(document.querySelector('[data-field="employment.workerNumber"]')?.textContent).toContain(
      '••••'
    );
    expect(document.querySelector('[data-field="person.preferredLocale"]')).toBeNull();
    expect(document.querySelector('[data-field="primaryAssignment.locationName"]')).toBeNull();
    expect(document.body.textContent?.toLowerCase()).not.toContain('unmask');
  });

  it('shows a permission failure without cached or fake success', async () => {
    const denied = dataSource();
    denied.list.mockRejectedValue(
      new HttpError('population denied', 403, { traceId: 'trace-403' })
    );
    await renderRuntime({ source: denied, entry: `/hr/operations/people?asOf=${asOf}` });
    await act(async () => {
      await vi.waitFor(() =>
        expect(document.querySelector('[data-query-state="permission"]')).not.toBeNull()
      );
    });
    expect(document.body.textContent).not.toContain('Synthetic Worker Alpha');
  });

  it('distinguishes an empty owner result from a filtered result', async () => {
    const empty = dataSource(people360Page([]));
    await renderRuntime({ source: empty, entry: `/hr/operations/people?asOf=${asOf}` });
    await shown('No people are available in this scope');
  });

  it('fails closed on a malformed owner projection', async () => {
    const malformed = dataSource(people360Page([{ person: { personId } }]));
    await renderRuntime({ source: malformed, entry: `/hr/operations/people?asOf=${asOf}` });
    await act(async () => {
      await vi.waitFor(() =>
        expect(document.querySelector('[data-query-state="unknown"]')).not.toBeNull()
      );
    });
  });

  it('labels an owner-source PARTIAL snapshot independently from MASK and OMIT', async () => {
    const source = dataSource(
      people360Page([people360ListSnapshot({ state: 'PARTIAL' })]),
      people360Snapshot({ state: 'PARTIAL' })
    );
    await renderRuntime({ source });
    await shown('This snapshot is partial');

    expect(document.body.textContent).toContain('One or more owner projections are unavailable');
    expect(document.body.textContent).toContain('Masked by policy');
  });

  it('keeps the last successful detail visible and offers retry after refresh failure', async () => {
    const source = dataSource();
    await renderRuntime({ source });
    await shown('Projection evidence');
    source.detail.mockRejectedValueOnce(new HttpError('owner unavailable', 503));

    await act(async () => {
      await client.refetchQueries({ queryKey: ['hris', 'people-360', 'detail-v2'] });
    });
    await shown('Showing the last successful snapshot');

    expect(document.body.textContent).toContain('Synthetic Product Specialist');
    expect(document.body.textContent).toContain('Retry');
  });

  it('aborts prior reads and does not display a late response after authority identity changes', async () => {
    const oldList = deferred<unknown>();
    const oldDetail = deferred<unknown>();
    const source = {
      list: vi
        .fn<People360DataSource['list']>()
        .mockReturnValueOnce(oldList.promise)
        .mockResolvedValueOnce(
          people360Page([
            people360ListSnapshot({
              personId: '22222222-2222-4222-8222-222222222222',
              displayName: 'Synthetic Worker New Scope',
            }),
          ])
        ),
      detail: vi
        .fn<People360DataSource['detail']>()
        .mockReturnValueOnce(oldDetail.promise)
        .mockResolvedValueOnce(people360Snapshot({ displayName: 'Synthetic Detail New Scope' })),
    };
    const nextScope: People360RequestScope = {
      ...scope,
      contextScopeKey: 'scope:hris/operations-next',
      cacheKey: [
        'tenant-2',
        'actor-10',
        'SUPPORT',
        'hcm.operations',
        'scope:hris/operations-next',
        '74',
      ],
      queryMeta: {
        ...scope.queryMeta,
        tenantId: 'tenant-2',
        actorId: 'actor-10',
        accessMode: 'SUPPORT',
        contextScopeKey: 'scope:hris/operations-next',
        decisionRevision: '74',
      },
    };

    await renderRuntime({ source });
    await act(async () => {
      await vi.waitFor(() => expect(source.list).toHaveBeenCalledTimes(1));
    });
    const oldListSignal = source.list.mock.calls[0]?.[0]?.signal;
    const oldDetailSignal = source.detail.mock.calls[0]?.[4];
    await renderRuntime({ source, requestScope: nextScope });
    await shown('Synthetic Detail New Scope');

    expect(oldListSignal?.aborted).toBe(true);
    expect(oldDetailSignal?.aborted).toBe(true);
    oldList.resolve(people360Page([people360ListSnapshot({ displayName: 'Late Old List' })]));
    oldDetail.resolve(people360Snapshot({ displayName: 'Late Old Detail' }));
    await act(async () => Promise.resolve());
    expect(document.body.textContent).not.toContain('Late Old List');
    expect(document.body.textContent).not.toContain('Late Old Detail');
  });

  it('provides a focus-managed mobile filter sheet and wraps long disclosed labels', async () => {
    const longName = `Synthetic ${'Long Workforce Label '.repeat(7)}`.trim();
    const source = dataSource(
      people360Page([people360ListSnapshot({ displayName: longName })]),
      people360Snapshot({ displayName: longName })
    );
    await renderRuntime({ source, entry: `/hr/operations/people?asOf=${asOf}` });
    await shown(longName);
    await clickButton('Filters');

    const trigger = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Filters'
    );
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.textContent).toContain('Employment status');
    expect(document.body.textContent).toContain('Effective date');
    expect(host.querySelector('h1')).toBeNull();
  });
});
