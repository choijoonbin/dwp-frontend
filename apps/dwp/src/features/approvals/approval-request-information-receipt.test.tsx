// @vitest-environment jsdom
import { Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateProductSurfaceAccess, HttpError } from '@dwp-frontend/shared-utils';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';
import { approvalInformationWireBody } from '@dwp-frontend/shared-utils/api/approval-information-wire-body';
import { ApprovalRequestInformationReceipt } from './approval-request-information-receipt';
import { ApprovalRequestInformationWire } from './approval-request-information-wire';
import { approvalRequestInformationSnapshot } from './approval-request-information-snapshot';
import { approvalInformationDetail } from '../../../../../e2e/support/approval-information-generation-fixtures';
import { approvalInformationReceiptFixture } from '../../../../../e2e/support/approval-information-receipt-fixtures';

import type { RequestActionCommand } from './approval-request-action-model';
import type { ProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

const deps = vi.hoisted(() => ({
  fixture: undefined as ReturnType<typeof approvalInformationReceiptFixture> | undefined,
  installed: true,
  actorId: '2',
  status: 'ready',
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useAuth: () => ({ user: { tenantId: 1, userId: deps.actorId } }),
  useProductSurfaceAuthority: () => ({
    status: deps.status,
    snapshot: deps.fixture?.source.snapshot,
    evaluateProduct: evaluateProductSurfaceAccess,
  }),
}));
vi.mock('../../components/allowed-product-surface-context', () => ({
  useOptionalAllowedProductSurface: () => ({
    context: deps.fixture?.evaluation.context,
    scope: deps.fixture?.evaluation.scope,
  }),
}));
vi.mock('../../routes/product-surface-authorization.generated', () => ({
  get PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS() {
    // Unit-only projection: browser activation still requires the genuine exported registry.
    return deps.installed ? (deps.fixture?.source.projections ?? []) : [];
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({
    children,
    onClick,
    disabled,
    loading,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => (
    <button disabled={disabled || loading} onClick={onClick}>
      {children}
    </button>
  ),
  InlineFeedback: ({
    children,
    action,
  }: {
    children: React.ReactNode;
    action?: React.ReactNode;
  }) => (
    <div role="status">
      {children}
      {action}
    </div>
  ),
}));

const envelope = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ status: status === 200 ? 'SUCCESS' : 'ERROR', data }), { status });

describe('actual receipt component + current owner cache + private wire + DATA/CSRF adapters', () => {
  let root: Root;
  let container: HTMLDivElement;
  let cache: QueryClient;
  let wire: ApprovalRequestInformationWire;
  let original: RequestActionCommand;
  let detail: Awaited<ReturnType<typeof approvalInformationDetail>>;
  let requestScope: ProductSurfaceRequestScope;
  let sourceReady: boolean;
  let originalCurrent: boolean;
  let status: number;
  let returnedReceipt: unknown;
  let calls: { url: string; init: RequestInit }[];
  let csrfHook: (() => void | Promise<void>) | undefined;
  let expireBeforeReceiptCsrf: boolean;
  let confirmed: ReturnType<typeof vi.fn<(command: RequestActionCommand) => void>>;
  const receipts = () => calls.filter((call) => call.url.includes('/receipt?'));
  const ownerKey = () => [
    'approvals',
    ...requestScope.cacheKey,
    'information-receipt-owner',
    original.input.action.request.requestId,
  ];
  const render = () =>
    act(() =>
      root.render(
        <QueryClientProvider client={cache}>
          <ApprovalRequestInformationReceipt
            command={original}
            requestScope={requestScope}
            sourceIsCurrent={() => sourceReady}
            originalWire={(command) => wire.read(command)}
            isOriginal={(command) =>
              originalCurrent && command === original && deps.actorId === '2'
            }
            onConfirmed={confirmed}
          />
        </QueryClientProvider>
      )
    );
  const button = (key: string) =>
    Array.from(container.querySelectorAll('button')).find((item) => item.textContent === key);
  const clickLookup = async () => {
    await vi.waitFor(() =>
      expect(button('requests.amendment.receiptLookup')?.disabled).toBe(false)
    );
    await act(async () => {
      button('requests.amendment.receiptLookup')!.click();
    });
  };

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('crypto', webcrypto);
    deps.fixture = approvalInformationReceiptFixture();
    deps.installed = true;
    deps.actorId = '2';
    deps.status = 'ready';
    detail = await approvalInformationDetail();
    original = {
      scopeIdentity: 'original-private-owner',
      scopeEpoch: 0,
      input: {
        action: { kind: 'respond', request: { ...detail.request } },
        responseMessage: 'Original reply',
        responsePayload: { ...detail.payload },
        schemaHash: detail.formSchemaSha256 ?? undefined,
        idempotencyKey: 'reply:original',
        informationSnapshot: approvalRequestInformationSnapshot(detail),
      },
    };
    wire = new ApprovalRequestInformationWire();
    wire.configure(original);
    approvalInformationWireBody(
      {
        message: 'Original reply',
        payload: original.input.responsePayload,
        expectedVersion: 3,
        sourceGeneration: 1,
      },
      (bytes) => wire.capture(original, bytes)
    );
    detail = {
      ...detail,
      request: { ...detail.request, status: 'APPROVED', version: 12 },
      informationGeneration: 4,
      informationRound: null,
      payload: { summary: 'Latest saved content', costCenter: 'latest-center' },
    };
    returnedReceipt = {
      status: 'COMPLETED',
      roundId: original.input.informationSnapshot!.roundId,
      generation: 2,
      requestVersion: 8,
      payloadRevision: 3,
      payloadSha256: 'a'.repeat(64),
      materialChange: true,
    };
    sourceReady = true;
    originalCurrent = true;
    status = 200;
    calls = [];
    csrfHook = undefined;
    expireBeforeReceiptCsrf = false;
    requestScope = {
      governed: true,
      ready: true,
      contextScopeKey: 'opaque-self',
      cacheKey: ['1', '2', 'NORMAL', 'approvals', 'approvals.work', 'opaque-self'],
      queryMeta: {
        accessSensitive: true,
        tenantId: '1',
        actorId: '2',
        accessMode: 'NORMAL',
        productId: 'approvals',
        surfaceId: 'approvals.work',
        contextScopeKey: 'opaque-self',
        decisionRevision: `psr-${'a'.repeat(64)}`,
      },
    };
    confirmed = vi.fn((command: RequestActionCommand) => {
      originalCurrent = false;
      wire.clear(command);
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ url, init });
        if (url.includes('/csrf')) {
          await csrfHook?.();
          return envelope({ token: 'csrf', headerName: 'X-XSRF-TOKEN' });
        }
        if (url.includes('/product-surface-access/evaluate')) {
          if (expireBeforeReceiptCsrf) resetCsrfToken();
          return envelope(deps.fixture!.evaluation);
        }
        if (url.includes('/receipt?')) return envelope(returnedReceipt, status);
        return envelope(detail);
      })
    );
    resetCsrfToken();
    cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await render();
  });
  afterEach(async () => {
    await act(() => root.unmount());
    cache.clear();
    container.remove();
    wire.purge();
    resetCsrfToken();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('confirms a historical original reply while the current request is terminal and newer, without overwriting its payload', async () => {
    const currentPayload = structuredClone(detail.payload);
    const originalBytes = wire.read(original);
    await clickLookup();
    await vi.waitFor(() =>
      expect(container.textContent).toContain('requests.amendment.receiptCompleted')
    );
    expect(receipts()).toHaveLength(1);
    expect(wire.read(original)).toBe(originalBytes);
    expect(detail.payload).toEqual(currentPayload);
    expect(confirmed).not.toHaveBeenCalled();
    await act(() => button('actions.close')!.click());
    expect(confirmed).toHaveBeenCalledExactlyOnceWith(original);
    expect(wire.read(original)).toBeUndefined();
    expect(calls.filter((call) => call.url.includes('/information-response'))).toHaveLength(0);
  });

  it.each([403, 503])(
    'closes cached owner %s before the observer rerenders with receipt POST0',
    async (failure) => {
      await vi.waitFor(() =>
        expect(button('requests.amendment.receiptLookup')?.disabled).toBe(false)
      );
      await act(async () => {
        cache
          .getQueryCache()
          .find({ queryKey: ownerKey() })!
          .setState({
            status: 'error',
            error: new HttpError('Owner source failed', failure),
            fetchStatus: 'idle',
          });
        button('requests.amendment.receiptLookup')!.click();
      });
      expect(receipts()).toHaveLength(0);
      expect(calls.filter((call) => call.url.includes('/evaluate'))).toHaveLength(0);
      expect(wire.read(original)).toBeDefined();
    }
  );

  it.each([403, 503])(
    'blocks actual deferred receipt CSRF after owner %s while keeping original private bytes',
    async (failure) => {
      expireBeforeReceiptCsrf = true;
      let reached!: () => void;
      const waiting = new Promise<void>((resolve) => {
        reached = resolve;
      });
      let release!: () => void;
      csrfHook = () => {
        if (calls.some((call) => call.url.includes('/evaluate'))) {
          reached();
          return new Promise<void>((resolve) => {
            release = resolve;
          });
        }
      };
      await clickLookup();
      await waiting;
      await act(async () => {
        cache
          .getQueryCache()
          .find({ queryKey: ownerKey() })!
          .setState({
            status: 'error',
            error: new HttpError('Owner source failed', failure),
            fetchStatus: 'idle',
          });
        release();
      });
      await vi.waitFor(() =>
        expect(container.textContent).toContain('requests.amendment.receiptUnavailable')
      );
      expect(receipts()).toHaveLength(0);
      expect(wire.read(original)).toBeDefined();
      expect(confirmed).not.toHaveBeenCalled();
    }
  );

  it.each([403, 503, 'PENDING', 'partial'])(
    'does not heal UNKNOWN from %s lookup and can explicitly retry the same DATA wire',
    async (failure) => {
      if (typeof failure === 'number') status = failure;
      else returnedReceipt = { status: failure === 'PENDING' ? 'PENDING' : 'COMPLETED' };
      const originalBytes = wire.read(original);
      await clickLookup();
      await vi.waitFor(() =>
        expect(container.textContent).toContain('requests.amendment.receiptReadError')
      );
      expect(wire.read(original)).toBe(originalBytes);
      expect(originalCurrent).toBe(true);
      expect(confirmed).not.toHaveBeenCalled();
      expect(receipts()).toHaveLength(1);
      status = 200;
      returnedReceipt = {
        status: 'COMPLETED',
        roundId: original.input.informationSnapshot!.roundId,
        generation: 2,
        requestVersion: 8,
        payloadRevision: 3,
        payloadSha256: 'a'.repeat(64),
        materialChange: true,
      };
      await clickLookup();
      await vi.waitFor(() =>
        expect(container.textContent).toContain('requests.amendment.receiptCompleted')
      );
      expect(receipts()).toHaveLength(2);
      expect(
        receipts().map(({ init }) => JSON.parse(String(init.body)).originalBodyBase64)
      ).toEqual([originalBytes, originalBytes]);
      expect(originalCurrent).toBe(true);
    }
  );

  it('denies confirmation after actor/authority drift even when the success button is still rendered', async () => {
    await clickLookup();
    await vi.waitFor(() => expect(button('actions.close')).toBeDefined());
    sourceReady = false;
    await act(() => button('actions.close')!.click());
    expect(confirmed).not.toHaveBeenCalled();
    expect(wire.read(original)).toBeDefined();
    deps.actorId = 'other';
    await render();
    expect(container.textContent).not.toContain('requests.amendment.receiptCompleted');
  });

  it('checks fresh proof expiry synchronously before closing a confirmed original', async () => {
    await clickLookup();
    await vi.waitFor(() => expect(button('actions.close')).toBeDefined());
    deps.fixture!.source.snapshot!.clockOffsetMs += 120000;
    await act(() => button('actions.close')!.click());
    expect(confirmed).not.toHaveBeenCalled();
    expect(wire.read(original)).toBeDefined();
  });

  it('an uninstalled profile is not activated by the component or any cached owner source', async () => {
    deps.installed = false;
    calls = [];
    await render();
    expect(container.textContent).toBe('');
    expect(calls).toHaveLength(0);
    expect(wire.read(original)).toBeDefined();
  });
});
