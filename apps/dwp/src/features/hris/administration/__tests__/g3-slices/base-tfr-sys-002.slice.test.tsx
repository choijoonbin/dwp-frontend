// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', async () => {
  const { hcmTestUseTranslation } = await import('../../../../../test-utils/hcm-i18n-test-stub');
  return { useTranslation: hcmTestUseTranslation };
});

vi.mock('../../../../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => ({
    governed: true,
    ready: true,
    contextScopeKey: 'opaque-management-config-scope',
    cacheKey: [
      'tenant-1',
      'actor-1',
      'NORMAL',
      'hcm.management',
      'opaque-management-config-scope',
      'decision-1',
    ],
    queryMeta: {
      accessSensitive: true,
      tenantId: 'tenant-1',
      actorId: 'actor-1',
      accessMode: 'NORMAL',
      productId: 'hcm',
      surfaceId: 'hcm.management',
      contextScopeKey: 'opaque-management-config-scope',
      decisionRevision: 'decision-1',
    },
  }),
}));

import type { HrisOperationsDataSource } from '../../operations/api/hris-operations-api';
import {
  HRIS_OPERATIONS_DEFAULT_COPY,
  HrisOperationsWorkspaceView,
  type HrisOperationsWorkspaceViewProps,
} from '../../operations/components/hris-operations-workspace-view';
import {
  HRIS_OPERATIONS_RUNTIME_STATE,
  HrisOperationsWorkspace,
} from '../../operations/pages/hris-operations-workspace';
import { hrisOperationsRuntimeAdmitted } from '../../operations/hooks/use-hris-operations-workspace';
import { HRIS_OPERATIONS_FEATURE } from '../../operations/model/hris-operations-contract';
import {
  EXCEPTION_ID,
  RECEIPT_ID,
  emptyOperationsEntry,
  exceptionDetail,
  exceptionPage,
  operationsEntry,
} from '../../operations/testing/hris-operations-fixtures.test-support';

function viewProps(
  overrides: Partial<HrisOperationsWorkspaceViewProps> = {}
): HrisOperationsWorkspaceViewProps {
  return {
    loadState: 'READY',
    entry: operationsEntry(),
    page: exceptionPage(),
    selectedId: EXCEPTION_ID,
    detail: exceptionDetail(),
    detailLoading: false,
    detailDenied: false,
    detailUnavailable: false,
    receipt: undefined,
    receiptId: null,
    receiptLoading: false,
    receiptDenied: false,
    receiptUnavailable: false,
    queryState: {
      tab: 'overview',
      focus: EXCEPTION_ID,
      ownerModule: 'SYS',
      severity: 'HIGH',
      state: 'OPEN',
    },
    pageIndex: 0,
    canPrevious: false,
    canNext: false,
    updateQueryState: vi.fn(),
    select: vi.fn(),
    inspectReceipt: vi.fn(),
    previous: vi.fn(),
    next: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  };
}

function dataSource(): HrisOperationsDataSource {
  return {
    entry: vi.fn().mockRejectedValue(new Error('must not run')),
    exceptions: vi.fn().mockRejectedValue(new Error('must not run')),
    detail: vi.fn().mockRejectedValue(new Error('must not run')),
    receipt: vi.fn().mockRejectedValue(new Error('must not run')),
  };
}

describe('BASE-TFR-SYS-002 frontend acceptance slice', () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient | undefined;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.history.replaceState(null, '', '/');
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient?.clear();
    queryClient = undefined;
    document.body.replaceChildren();
  });

  async function render(node: React.ReactNode) {
    await act(async () => root.render(node));
  }

  it('is default-off and makes zero IAQ, exception, detail or receipt calls when off or unenrolled', async () => {
    const source = dataSource();
    expect(HRIS_OPERATIONS_RUNTIME_STATE).toBe('OFF');
    const governedScope = {
      feature: HRIS_OPERATIONS_FEATURE,
      featureEnabled: true,
      tenantEnrolled: true,
      governed: true,
      ready: true,
    } as const;
    expect(hrisOperationsRuntimeAdmitted(governedScope)).toBe(true);
    expect(hrisOperationsRuntimeAdmitted({ ...governedScope, featureEnabled: false })).toBe(false);
    expect(hrisOperationsRuntimeAdmitted({ ...governedScope, tenantEnrolled: false })).toBe(false);

    await render(
      <HrisOperationsWorkspace runtimeEnabled={false} tenantEnrolled dataSource={source} />
    );
    expect(host.querySelector('[data-runtime-state="OFF"]')).not.toBeNull();
    expect(host.textContent).toContain('No entry, exception, projection or receipt request');

    await render(
      <HrisOperationsWorkspace runtimeEnabled tenantEnrolled={false} dataSource={source} />
    );
    expect(host.querySelector('[data-tenant-enrolled="false"]')).not.toBeNull();
    expect(source.entry).not.toHaveBeenCalled();
    expect(source.exceptions).not.toHaveBeenCalled();
    expect(source.detail).not.toHaveBeenCalled();
    expect(source.receipt).not.toHaveBeenCalled();
  });

  it('preserves the unscoped IAQ entry while an absent package selection makes zero protected calls', async () => {
    const source: HrisOperationsDataSource = {
      entry: vi.fn().mockResolvedValue(operationsEntry()),
      exceptions: vi.fn().mockRejectedValue(new Error('must not run')),
      detail: vi.fn().mockRejectedValue(new Error('must not run')),
      receipt: vi.fn().mockRejectedValue(new Error('must not run')),
    };
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });

    await render(
      <QueryClientProvider client={queryClient}>
        <HrisOperationsWorkspace runtimeEnabled tenantEnrolled dataSource={source} />
      </QueryClientProvider>
    );

    await vi.waitFor(() => expect(source.entry).toHaveBeenCalledTimes(1));
    expect(source.entry).toHaveBeenCalledWith(
      expect.not.objectContaining({ contextScopeKey: expect.anything() })
    );
    expect(source.exceptions).not.toHaveBeenCalled();
    expect(source.detail).not.toHaveBeenCalled();
    expect(source.receipt).not.toHaveBeenCalled();
  });

  it('uses the injected package scope only for list/detail and keeps entry/receipt unscoped', async () => {
    const packageScope = 'scope-0123456789abcdef0123456789abcdef';
    const nextPackageScope = 'scope-fedcba9876543210fedcba9876543210';
    const source: HrisOperationsDataSource = {
      entry: vi.fn().mockResolvedValue(operationsEntry()),
      exceptions: vi.fn().mockResolvedValue(exceptionPage()),
      detail: vi.fn().mockResolvedValue(exceptionDetail()),
      receipt: vi.fn().mockRejectedValue(new Error('expected receipt fixture miss')),
    };
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });

    await render(
      <QueryClientProvider client={queryClient}>
        <HrisOperationsWorkspace
          runtimeEnabled
          tenantEnrolled
          exceptionContextScopeKey={packageScope}
          dataSource={source}
        />
      </QueryClientProvider>
    );

    await vi.waitFor(() => expect(source.detail).toHaveBeenCalledTimes(1));
    expect(source.entry).toHaveBeenCalledWith(
      expect.not.objectContaining({ contextScopeKey: expect.anything() })
    );
    expect(source.exceptions).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
      expect.objectContaining({ contextScopeKey: packageScope })
    );
    expect(source.detail).toHaveBeenCalledWith(
      EXCEPTION_ID,
      expect.objectContaining({ contextScopeKey: packageScope })
    );

    await vi.waitFor(() =>
      expect(
        [...host.querySelectorAll('button')].some((button) =>
          button.textContent?.includes(`Inspect existing receipt ${RECEIPT_ID}`)
        )
      ).toBe(true)
    );
    const receiptButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(`Inspect existing receipt ${RECEIPT_ID}`)
    )!;
    await act(async () => receiptButton.click());
    await vi.waitFor(() => expect(source.receipt).toHaveBeenCalledTimes(1));
    expect(source.receipt).toHaveBeenCalledWith(
      RECEIPT_ID,
      expect.not.objectContaining({ contextScopeKey: expect.anything() })
    );

    await render(
      <QueryClientProvider client={queryClient}>
        <HrisOperationsWorkspace
          runtimeEnabled
          tenantEnrolled
          exceptionContextScopeKey={nextPackageScope}
          dataSource={source}
        />
      </QueryClientProvider>
    );
    await vi.waitFor(() =>
      expect(source.exceptions).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
        expect.objectContaining({ contextScopeKey: nextPackageScope })
      )
    );
    expect(source.receipt).toHaveBeenCalledTimes(1);
  });

  it('drops a scope-bound cursor before the first request under a new package scope', async () => {
    const firstPackageScope = 'scope-0123456789abcdef0123456789abcdef';
    const nextPackageScope = 'scope-fedcba9876543210fedcba9876543210';
    const boundCursor = 'cursor_1234567890';
    const source: HrisOperationsDataSource = {
      entry: vi.fn().mockResolvedValue(operationsEntry()),
      exceptions: vi.fn().mockResolvedValue({
        ...exceptionPage(true),
        nextCursor: boundCursor,
      }),
      detail: vi.fn().mockRejectedValue(new Error('must not run')),
      receipt: vi.fn().mockRejectedValue(new Error('must not run')),
    };
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });

    await render(
      <QueryClientProvider client={queryClient}>
        <HrisOperationsWorkspace
          runtimeEnabled
          tenantEnrolled
          exceptionContextScopeKey={firstPackageScope}
          dataSource={source}
        />
      </QueryClientProvider>
    );
    await vi.waitFor(() => expect(source.exceptions).toHaveBeenCalledTimes(1));

    await vi.waitFor(() =>
      expect(
        [...host.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Next')
          ?.disabled
      ).toBe(false)
    );
    const nextButton = [...host.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Next'
    )!;
    await act(async () => nextButton.click());
    await vi.waitFor(() => expect(source.exceptions).toHaveBeenCalledTimes(2));
    expect(source.exceptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: boundCursor }),
      expect.objectContaining({ contextScopeKey: firstPackageScope })
    );

    await render(
      <QueryClientProvider client={queryClient}>
        <HrisOperationsWorkspace
          runtimeEnabled
          tenantEnrolled
          exceptionContextScopeKey={nextPackageScope}
          dataSource={source}
        />
      </QueryClientProvider>
    );
    await vi.waitFor(() => expect(source.exceptions).toHaveBeenCalledTimes(3));
    expect(source.exceptions).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ cursor: expect.anything() }),
      expect.objectContaining({ contextScopeKey: nextPackageScope })
    );
    expect(host.textContent).toContain('Stable owner ordering · page 1');
    expect(source.detail).not.toHaveBeenCalled();
    expect(source.receipt).not.toHaveBeenCalled();
  });

  it('keeps entry unscoped while a raw resolver scope makes zero protected calls', async () => {
    const source: HrisOperationsDataSource = {
      entry: vi.fn().mockResolvedValue(operationsEntry()),
      exceptions: vi.fn().mockRejectedValue(new Error('must not run')),
      detail: vi.fn().mockRejectedValue(new Error('must not run')),
      receipt: vi.fn().mockRejectedValue(new Error('must not run')),
    };
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });

    await render(
      <QueryClientProvider client={queryClient}>
        <HrisOperationsWorkspace
          runtimeEnabled
          tenantEnrolled
          exceptionContextScopeKey="APP_RESOURCE_SET:RS_HCM_CONFIG"
          dataSource={source}
        />
      </QueryClientProvider>
    );

    await vi.waitFor(() => expect(source.entry).toHaveBeenCalledTimes(1));
    expect(source.entry).toHaveBeenCalledWith(
      expect.not.objectContaining({ contextScopeKey: expect.anything() })
    );
    expect(source.exceptions).not.toHaveBeenCalled();
    expect(source.detail).not.toHaveBeenCalled();
    expect(source.receipt).not.toHaveBeenCalled();
  });

  it('renders loading, permission and unavailable states without a blank canvas or stale detail', async () => {
    await render(
      <HrisOperationsWorkspaceView
        {...viewProps({
          loadState: 'LOADING',
          entry: undefined,
          page: undefined,
          detail: undefined,
        })}
      />
    );
    expect(host.getAttribute('aria-busy')).not.toBe('true');
    expect(host.textContent).toContain(HRIS_OPERATIONS_DEFAULT_COPY.title);
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();

    await render(
      <HrisOperationsWorkspaceView
        {...viewProps({
          loadState: 'PERMISSION',
          entry: undefined,
          page: undefined,
          detail: undefined,
        })}
      />
    );
    expect(host.textContent).toContain('required tenant, package, purpose or object scope');
    expect(host.textContent).not.toContain(exceptionDetail().code);

    await render(
      <HrisOperationsWorkspaceView
        {...viewProps({
          loadState: 'UNAVAILABLE',
          entry: undefined,
          page: undefined,
          detail: undefined,
        })}
      />
    );
    expect(host.textContent).toContain('No cached exception detail or recovery action is shown');
    expect(host.textContent).not.toContain(exceptionDetail().correlationId!);
  });

  it('renders empty, no-producer, partial, complete and stale states through reachable branches', async () => {
    await render(
      <HrisOperationsWorkspaceView
        {...viewProps({
          entry: operationsEntry(),
          page: exceptionPage(true),
          selectedId: null,
          detail: undefined,
        })}
      />
    );
    expect(host.textContent).toContain('No exceptions in this scope');

    await render(
      <HrisOperationsWorkspaceView
        {...viewProps({
          loadState: 'UNAVAILABLE',
          entry: emptyOperationsEntry(),
          page: undefined,
          selectedId: null,
          detail: undefined,
        })}
      />
    );
    expect(host.textContent).toContain('No live owner producer is onboarded');
    expect(host.textContent).toContain('cross-service producer delivery remains an external gate');

    await render(
      <HrisOperationsWorkspaceView {...viewProps({ entry: operationsEntry('PARTIAL') })} />
    );
    expect(host.textContent).toContain('Some owner projections are unavailable');
    expect(host.querySelector('[data-projection-state="PARTIAL"]')).not.toBeNull();

    await render(<HrisOperationsWorkspaceView {...viewProps()} />);
    expect(host.querySelector('[data-projection-state="COMPLETE"]')).not.toBeNull();
    expect(host.textContent).toContain('Customer and process impact');

    await render(
      <HrisOperationsWorkspaceView {...viewProps({ entry: operationsEntry('STALE') })} />
    );
    expect(host.textContent).toContain('Owner projections are stale');
    expect(host.textContent).toContain('Last successful refresh');
  });

  it('preserves the scoped selection and exposes only exact read/deep-link controls', async () => {
    const select = vi.fn();
    const inspectReceipt = vi.fn();
    await render(
      <HrisOperationsWorkspaceView
        {...viewProps({ select, inspectReceipt })}
        copy={{
          ...HRIS_OPERATIONS_DEFAULT_COPY,
          title:
            '인사 운영 예외 조사 센터 — 권한이 있는 사용자 및 프로세스 영향 범위를 안전하게 검토합니다',
          description:
            'A deliberately long English and Korean operational description remains readable at narrow widths and 200 percent zoom.',
        }}
      />
    );

    expect(
      [...host.querySelectorAll('[role="combobox"]')].map((input) => input.textContent?.trim())
    ).toEqual(['SYS', 'HIGH', 'OPEN']);
    expect(host.querySelector('[aria-current="true"]')).not.toBeNull();
    expect(host.querySelector('a')?.getAttribute('href')).toBe(
      `/hr/settings/reference-data?focus=${EXCEPTION_ID}`
    );

    const selectedButton = host.querySelector('[aria-current="true"]') as HTMLButtonElement;
    selectedButton.focus();
    await act(async () => selectedButton.click());
    expect(document.activeElement).toBe(selectedButton);
    expect(select).toHaveBeenCalledWith(EXCEPTION_ID);

    const receiptButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(`Inspect existing receipt ${RECEIPT_ID}`)
    )!;
    await act(async () => receiptButton.click());
    expect(inspectReceipt).toHaveBeenCalledWith(RECEIPT_ID);

    const commandLabels = [...host.querySelectorAll('button')].map((button) =>
      button.textContent?.trim().toLowerCase()
    );
    expect(commandLabels).not.toEqual(
      expect.arrayContaining(['recover', 'retry', 'resolve', 'suppress', 'automate'])
    );
    expect(host.textContent).toContain('Read and deep-link only');
    expect(host.textContent).not.toContain('stack trace');
  });

  it('keeps a deep-linked selection while an opaque detail denial clears protected content', async () => {
    await render(
      <HrisOperationsWorkspaceView
        {...viewProps({ detail: undefined, detailDenied: true, selectedId: EXCEPTION_ID })}
      />
    );
    expect(host.querySelector('[aria-current="true"]')).not.toBeNull();
    expect(host.textContent).toContain('No cached detail is shown');
    expect(host.textContent).not.toContain(exceptionDetail().correlationId!);
    expect(host.querySelector('a')).toBeNull();
  });
});
