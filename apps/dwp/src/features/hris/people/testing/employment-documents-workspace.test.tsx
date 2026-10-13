// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EmploymentDocumentsRuntime,
  type EmploymentDocumentsReader,
} from '../pages/employment-documents-workspace';

import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import type { EmploymentDocumentsWorkbench } from '../api/employment-workbench-api';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

const scope: ProductSurfaceRequestScope = {
  governed: true,
  ready: true,
  contextScopeKey: 'scope:hris/self',
  cacheKey: ['tenant-1', 'actor-9', 'SELF', 'hcm.personal', 'scope:hris/self', '38'],
  queryMeta: {
    accessSensitive: true,
    tenantId: 'tenant-1',
    actorId: 'actor-9',
    accessMode: 'SELF',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    contextScopeKey: 'scope:hris/self',
    decisionRevision: '38',
  },
};

const workbench: EmploymentDocumentsWorkbench = {
  asOf: '2026-10-13T00:00:00Z',
  documents: [
    {
      workerPublicId: '10000000-0000-4000-8000-000000000001',
      relationshipPublicId: '10000000-0000-4000-8000-000000000002',
      assignmentPublicId: '10000000-0000-4000-8000-000000000003',
      relationshipType: 'EMPLOYEE',
      validFrom: '2024-03-04',
      validToExclusive: null,
      status: 'ACTIVE',
      revision: 7,
    },
  ],
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

async function renderRuntime(
  reader: EmploymentDocumentsReader,
  requestScope: ProductSurfaceRequestScope = scope
) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <EmploymentDocumentsRuntime requestScope={requestScope} reader={reader} />
      </QueryClientProvider>
    );
  });
}

async function shown(text: string) {
  await act(async () => {
    await vi.waitFor(() => expect(document.body.textContent).toContain(text));
  });
}

async function clickButton(name: string) {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === name
  );
  if (!button) throw new Error(`Missing button: ${name}`);
  await act(async () => button.click());
}

describe('HRM-008 employment documents workspace', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
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

  it('waits for the exact self-service scope and renders a real loading state', async () => {
    const pending = deferred<EmploymentDocumentsWorkbench>();
    const reader = vi.fn<EmploymentDocumentsReader>().mockReturnValue(pending.promise);
    await renderRuntime(reader, {
      ...scope,
      ready: false,
      contextScopeKey: undefined,
      cacheKey: ['tenant-1', 'actor-9', 'SELF', 'hcm.personal', '', '38'],
      queryMeta: { ...scope.queryMeta, contextScopeKey: undefined },
    });

    expect(reader).not.toHaveBeenCalled();
    expect(document.querySelector('[data-query-state="loading"]')).not.toBeNull();

    await renderRuntime(reader);
    expect(reader).toHaveBeenCalledWith('scope:hris/self', undefined, expect.any(AbortSignal));
    expect(document.querySelector('[data-query-state="loading"]')).not.toBeNull();

    pending.resolve(workbench);
    await shown('EMPLOYEE');
  });

  it('makes the employee question, primary refresh action and records accessible at 320px', async () => {
    const reader = vi.fn<EmploymentDocumentsReader>().mockResolvedValue(workbench);
    await renderRuntime(reader);
    await shown('Employment document 1: EMPLOYEE');

    expect(document.querySelector('h1')?.textContent).toBe('My employment documents');
    expect(document.body.textContent).toContain(
      'Which employment relationships and assignments are effective for me now?'
    );
    expect(
      document.querySelector('button[aria-label="Refresh employment documents"]')
    ).not.toBeNull();
    expect(document.querySelectorAll('ul > li')).toHaveLength(1);
    expect(document.querySelector('li[aria-labelledby]')).not.toBeNull();
    expect(document.body.textContent).toContain('Assignment status: ACTIVE');
    expect(document.body.textContent).toContain('Record revision7');
  });

  it('distinguishes empty, permission and unavailable results without synthetic records', async () => {
    const empty = vi
      .fn<EmploymentDocumentsReader>()
      .mockResolvedValue({ asOf: workbench.asOf, documents: [] });
    await renderRuntime(empty);
    await shown('No employment documents are available');
    expect(document.querySelectorAll('ul > li')).toHaveLength(0);

    client.clear();
    const denied = vi
      .fn<EmploymentDocumentsReader>()
      .mockRejectedValue(new HttpError('not disclosed', 403, { traceId: 'trace-403' }));
    await renderRuntime(denied, {
      ...scope,
      cacheKey: [
        scope.cacheKey[0],
        scope.cacheKey[1],
        scope.cacheKey[2],
        scope.cacheKey[3],
        scope.cacheKey[4],
        '39',
      ],
    });
    await act(async () => {
      await vi.waitFor(() =>
        expect(document.querySelector('[data-query-state="permission"]')).not.toBeNull()
      );
    });
    expect(document.body.textContent).not.toContain('10000000-0000-4000-8000-000000000003');

    client.clear();
    const unavailable = vi
      .fn<EmploymentDocumentsReader>()
      .mockRejectedValue(new HttpError('owner unavailable', 503));
    await renderRuntime(unavailable, {
      ...scope,
      cacheKey: [
        scope.cacheKey[0],
        scope.cacheKey[1],
        scope.cacheKey[2],
        scope.cacheKey[3],
        scope.cacheKey[4],
        '40',
      ],
    });
    await act(async () => {
      await vi.waitFor(() =>
        expect(document.querySelector('[data-query-state="unavailable"]')).not.toBeNull()
      );
    });
  });

  it('keeps the last successful records visible when a refresh becomes partial', async () => {
    const reader = vi
      .fn<EmploymentDocumentsReader>()
      .mockResolvedValueOnce(workbench)
      .mockRejectedValueOnce(new HttpError('refresh unavailable', 503));
    await renderRuntime(reader);
    await shown('Employment document 1: EMPLOYEE');

    await clickButton('Refresh employment documents');
    await shown('The latest refresh is unavailable');

    expect(document.querySelector('[data-state="partial"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Employment document 1: EMPLOYEE');
    expect(reader).toHaveBeenCalledTimes(2);
  });
});
