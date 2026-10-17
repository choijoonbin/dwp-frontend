// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HrisPayrollFoundationSettingsWorkspace } from '../pages/hris-payroll-foundation-settings-workspace';
import { foundationWire, workspaceWire } from './payroll-foundation-fixtures.test-support';
import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

import type { PayrollFoundationDataSource } from '../api/payroll-foundation-api';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('../../../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: vi.fn(),
}));

vi.mock('../hooks/use-payroll-foundation-settings-command-executors', () => ({
  usePayrollFoundationSettingsCommandExecutors: () => ({
    commandExecutors: {
      create: vi.fn(),
      update: vi.fn(),
      simulate: vi.fn(),
      publish: vi.fn(),
      reverse: vi.fn(),
      reconcile: vi.fn(),
    },
    publishController: {},
    reverseController: {},
  }),
}));

vi.mock('../../../../components/product-surface-high-risk-command', () => ({
  ProductSurfaceHighRiskCommandDialog: () => null,
}));

function requestScope(ready: boolean): ProductSurfaceRequestScope {
  return {
    governed: true,
    ready,
    ...(ready ? { contextScopeKey: 'scope:payroll-settings' } : {}),
    cacheKey: [
      'tenant-synthetic',
      'actor-synthetic',
      'NORMAL',
      'hcm.management',
      ready ? 'scope:payroll-settings' : '',
      'decision-settings-1',
    ],
    queryMeta: {
      accessSensitive: true,
      tenantId: 'tenant-synthetic',
      actorId: 'actor-synthetic',
      accessMode: 'NORMAL',
      productId: 'hcm',
      surfaceId: 'hcm.management',
      ...(ready ? { contextScopeKey: 'scope:payroll-settings' } : {}),
      decisionRevision: 'decision-settings-1',
    },
  };
}

function dataSource(): PayrollFoundationDataSource {
  return {
    list: vi.fn().mockResolvedValue(workspaceWire()),
    get: vi.fn().mockResolvedValue(foundationWire()),
    versions: vi.fn().mockResolvedValue([foundationWire()]),
    create: vi.fn(),
    update: vi.fn(),
    simulate: vi.fn(),
    publish: vi.fn(),
    reverse: vi.fn(),
    receipt: vi.fn(),
    reconcile: vi.fn(),
  };
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  });
}

let host: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

describe('Payroll Foundation settings adapter', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
    vi.restoreAllMocks();
  });

  it('uses hcm.management and waits for an exact governed scope before the first read', async () => {
    const source = dataSource();
    vi.mocked(useProductSurfaceRequestScope).mockReturnValue(requestScope(false));

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <HrisPayrollFoundationSettingsWorkspace dataSource={source} />
        </QueryClientProvider>
      );
    });
    await settle();

    expect(useProductSurfaceRequestScope).toHaveBeenCalledWith({
      productKey: 'hcm',
      surfaceKey: 'hcm.management',
    });
    expect(source.list).not.toHaveBeenCalled();
    expect(host.querySelector('[data-authority-surface="hcm.management"]')).not.toBeNull();

    vi.mocked(useProductSurfaceRequestScope).mockReturnValue(requestScope(true));
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <HrisPayrollFoundationSettingsWorkspace dataSource={source} />
        </QueryClientProvider>
      );
    });
    await settle();
    await settle();

    expect(source.list).toHaveBeenCalledOnce();
    expect(source.list).toHaveBeenCalledWith(
      expect.objectContaining({ contextScopeKey: 'scope:payroll-settings' })
    );
  });
});
