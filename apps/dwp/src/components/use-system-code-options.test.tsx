// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const catalog = vi.hoisted(() => ({ getCodeSet: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils/api/system-code-catalog-api', () => ({
  getSystemCodeSet: catalog.getCodeSet,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: 'en', language: 'en' } }),
}));

import { useSystemCodeOptionsState } from './use-system-code-options';

const fallback = ['ALPHA', 'BETA'] as const;
let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
let result!: ReturnType<typeof useSystemCodeOptionsState<(typeof fallback)[number]>>;

function Harness() {
  result = useSystemCodeOptionsState('TEST.SET', fallback);
  return null;
}

async function renderAndSettle() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    );
  });
  await act(async () => {
    await vi.waitFor(() => expect(result.isPending).toBe(false));
  });
}

describe('system code option compatibility', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    catalog.getCodeSet.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it('marks a successful but incompatible server set as a fallback', async () => {
    catalog.getCodeSet.mockResolvedValue({
      codeSetKey: 'TEST.SET',
      schemaVersion: 1,
      values: [
        { code: 'ALPHA', label: 'Alpha' },
        { code: 'GAMMA', label: 'Gamma' },
      ],
    });

    await renderAndSettle();

    expect(result.isError).toBe(false);
    expect(result.options).toEqual(fallback);
    expect(result.usingFallback).toBe(true);
  });

  it('rejects duplicate server values instead of treating their length as compatible', async () => {
    catalog.getCodeSet.mockResolvedValue({
      codeSetKey: 'TEST.SET',
      schemaVersion: 1,
      values: [
        { code: 'ALPHA', label: 'Alpha' },
        { code: 'ALPHA', label: 'Alpha duplicate' },
      ],
    });

    await renderAndSettle();

    expect(result.options).toEqual(fallback);
    expect(result.usingFallback).toBe(true);
  });

  it('uses an exactly compatible server set without reporting a fallback', async () => {
    catalog.getCodeSet.mockResolvedValue({
      codeSetKey: 'TEST.SET',
      schemaVersion: 1,
      values: [
        { code: 'BETA', label: 'Beta' },
        { code: 'ALPHA', label: 'Alpha' },
      ],
    });

    await renderAndSettle();

    expect(result.options).toEqual(['BETA', 'ALPHA']);
    expect(result.usingFallback).toBe(false);
  });
});
