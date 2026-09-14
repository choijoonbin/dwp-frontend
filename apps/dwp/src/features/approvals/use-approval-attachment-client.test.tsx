// @vitest-environment jsdom
import { File as NodeFile, Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';

import { useApprovalAttachmentClient } from './use-approval-attachment-client';
import { ApprovalRequestLifecycle } from './approval-request-lifecycle';
import {
  attachmentSource,
  attachmentDetail,
  attachmentUpload,
  attachmentItem,
  ATTACHMENT_BYTES,
  ATTACHMENT_FILE_NAME,
  ATTACHMENT_SHA,
  ATTACHMENT_GRANT_ID,
} from '../../../../../e2e/support/approval-attachment-fixtures';

import type { ApprovalAttachmentClient } from './use-approval-attachment-client';
import type { ComponentProps } from 'react';
import type { ApprovalRequestListPanel } from './approval-request-list-panel';
import type { ApprovalRequestLifecycleInspector } from './approval-request-lifecycle-inspector';
import type { ApprovalRequestDetailDrawer } from './approval-request-detail-drawer';

const dependencies = vi.hoisted(() => ({ installed: true, actor: 'original-actor' }));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  usePermissions: () => ({ hasPermission: () => true, permissions: [] }),
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('./use-approval-experience', () => ({
  useApprovalExperience: () => ({ canUpdateRequests: true }),
}));
vi.mock('./use-approval-governed-mutation', () => ({
  isProductSurfaceOperationCancelledError: () => false,
  useApprovalGovernedMutation: () => (execute: (execution: unknown) => Promise<unknown>) =>
    execute({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' }),
}));
vi.mock('./approval-request-search-controls', () => ({
  ApprovalRequestSearchControls: () => null,
}));
vi.mock('./approval-request-list-panel', () => ({
  ApprovalRequestListPanel: ({
    requests,
    onOpenDetails,
  }: ComponentProps<typeof ApprovalRequestListPanel>) => (
    <button onClick={() => onOpenDetails(requests[0])}>Open attachment viewer</button>
  ),
}));
vi.mock('./approval-request-lifecycle-inspector', () => ({
  ApprovalRequestLifecycleInspector: ({
    attachments,
  }: ComponentProps<typeof ApprovalRequestLifecycleInspector>) => {
    client = attachments;
    return <div data-testid="stable-inspector" />;
  },
}));
vi.mock('./approval-request-detail-drawer', () => ({
  ApprovalRequestDetailDrawer: ({
    requestId,
    attachments,
    onClose,
  }: ComponentProps<typeof ApprovalRequestDetailDrawer>) => {
    client = attachments;
    return requestId ? <button onClick={onClose}>Close attachment viewer</button> : null;
  },
}));
vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => ({
    ready: true,
    governed: false,
    cacheKey: ['tenant', dependencies.actor, 'NORMAL', 'approvals.work', '', 'revision'],
    queryMeta: { accessSensitive: true },
  }),
}));
vi.mock('../../components/use-product-surface-governed-mutation', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useProductSurfaceGovernedMutation: () => (execute: (execution: unknown) => Promise<unknown>) =>
    execute({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' }),
}));
vi.mock('../../routes/product-surface-authorization.generated', async () => {
  const { APPROVAL_ATTACHMENT_ACTION_CONTRACTS } =
    await import('@dwp-frontend/shared-utils/api/approval-attachment-action-contracts');
  const action = APPROVAL_ATTACHMENT_ACTION_CONTRACTS.map((contract) => ({
    routeContractKey: contract.routeContractKey,
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeKind: 'ACTION',
    gatewayBindings: [{ method: contract.method, path: contract.path }],
  }));
  const data = [
    ['request-attachments', '/requests/{requestId}/attachments'],
    ['task-attachments', '/tasks/{taskId}/attachments'],
    ['attachment-upload', '/attachment-uploads/{uploadId}'],
    ['attachment-download-content', '/attachment-downloads/{grantId}/content'],
  ].map(([key, path]) => ({
    routeContractKey: `route.approvals.work.${key}.data`,
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeKind: 'DATA',
    gatewayBindings: [{ method: 'GET', path: `/api/approvals/v1${path}` }],
  }));
  return {
    get PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS() {
      return dependencies.installed ? [...action, ...data] : [];
    },
  };
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ status: 'SUCCESS', data }), { status });
let root: Root;
let container: HTMLDivElement;
let cache: QueryClient;
let client: ApprovalAttachmentClient;
let ready = true;
let task = false;
let taskContentAllowed = true;
let serverSource = attachmentSource();
let upload = attachmentUpload();
let sourceStatus = 200;
let contentStatus = 200;
let listStatus = 200;
let multiFile = false;
let multiUploads: Map<string, { upload: ReturnType<typeof attachmentUpload>; fileName: string }>;
let csrfPause: (() => Promise<void>) | undefined;
let writes: { url: string; init: RequestInit }[];
let fetch: ReturnType<typeof vi.fn>;

function Harness() {
  client = useApprovalAttachmentClient({
    owner: serverSource.owner,
    version: task ? 19 : 3,
    ready,
  });
  return <div data-ready={client.ready} data-masked={client.masked} />;
}
const render = () =>
  act(async () => {
    root.render(
      <QueryClientProvider client={cache}>
        <Harness />
      </QueryClientProvider>
    );
  });
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
async function setup(sealed = false, asTask = false) {
  task = asTask;
  serverSource = attachmentSource(sealed, asTask);
  await render();
  for (let i = 0; i < 30 && !client.ready; i++) await flush();
  if (dependencies.installed) {
    expect(client.available).toBe(true);
    expect(client.source.error).toBeNull();
    expect(client.ready).toBe(true);
  }
}
const choose = () =>
  act(() =>
    client.controller.choose(
      new NodeFile([ATTACHMENT_BYTES], ATTACHMENT_FILE_NAME, { type: 'text/plain' }) as File
    )
  );

describe('approval attachment actual hook + transport source fences', () => {
  beforeEach(() => {
    dependencies.installed = true;
    dependencies.actor = 'original-actor';
    ready = true;
    task = false;
    taskContentAllowed = true;
    listStatus = 200;
    multiFile = false;
    multiUploads = new Map();
    sourceStatus = 200;
    contentStatus = 200;
    csrfPause = undefined;
    serverSource = attachmentSource();
    upload = attachmentUpload();
    writes = [];
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:verified-attachment'),
        revokeObjectURL: vi.fn(),
      })
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    fetch = vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input, 'http://localhost');
      if (url.pathname.includes('/csrf')) {
        await csrfPause?.();
        return json({ token: 'csrf', headerName: 'X-XSRF-TOKEN' });
      }
      if (init.method && ['POST', 'PUT'].includes(init.method))
        writes.push({ url: url.pathname, init });
      if (url.pathname.endsWith('/requests/search'))
        return json(
          {
            items: [attachmentDetail().request],
            totalElements: 1,
            totalPages: 1,
            hasNext: false,
            page: 0,
            size: 20,
            evaluatedAt: new Date().toISOString(),
          },
          listStatus
        );
      if (url.pathname.endsWith('/document-tools')) return json(serverSource.tools, sourceStatus);
      if (url.pathname.endsWith('/detail')) return json(attachmentDetail(), sourceStatus);
      if (url.pathname.endsWith('/attachments') && init.method === 'PUT') {
        const input = JSON.parse(init.body as string);
        serverSource = {
          ...serverSource,
          attachments: {
            ...serverSource.attachments,
            manifest: {
              ...serverSource.attachments.manifest,
              selectionVersion: input.expectedSelectionVersion + 1,
              items: input.attachmentIds.map((id: string) => {
                const row = [...multiUploads.values()].find(
                  (entry) => entry.upload.attachmentId === id
                );
                if (!row) throw new Error('Selected server upload is missing');
                return { ...attachmentItem(), attachmentId: id, fileName: row.fileName };
              }),
            },
          },
        };
        return json(serverSource.attachments);
      }
      if (url.pathname.endsWith('/attachments') && init.method !== 'PUT')
        return json(serverSource.attachments, sourceStatus);
      if (url.pathname.endsWith('/attachment-uploads')) {
        if (multiFile) {
          const input = JSON.parse(init.body as string);
          const second = multiUploads.size > 0;
          const next = {
            ...attachmentUpload(),
            ...(second
              ? {
                  uploadId: '66666666-6666-4666-8666-666666666666',
                  attachmentId: '77777777-7777-4777-8777-777777777777',
                }
              : {}),
          };
          multiUploads.set(next.uploadId, { upload: next, fileName: input.fileName });
          return json(next);
        }
        return json(upload);
      }
      if (url.pathname.endsWith('/content') && init.method === 'PUT') {
        if (contentStatus !== 200) return json({}, contentStatus);
        if (multiFile) {
          const row = multiUploads.get(url.pathname.split('/').at(-2)!)!;
          row.upload = { ...row.upload, state: 'QUARANTINED', version: 2, reason: 'AWAITING_SCAN' };
          return json(row.upload);
        }
        upload = { ...upload, state: 'QUARANTINED', version: 2, reason: 'AWAITING_SCAN' };
        return json(upload);
      }
      if (url.pathname.endsWith('/reconcile')) return json(upload);
      if (url.pathname.includes('/attachment-uploads/'))
        return json(
          multiFile ? multiUploads.get(url.pathname.split('/').at(-1)!)!.upload : upload,
          sourceStatus
        );
      if (url.pathname.endsWith('/downloads'))
        return json({
          grantId: ATTACHMENT_GRANT_ID,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          sha256: ATTACHMENT_SHA,
          sizeBytes: ATTACHMENT_BYTES.length,
        });
      if (url.pathname.includes('/attachment-downloads/'))
        return new Response(ATTACHMENT_BYTES, {
          headers: {
            'Content-Length': String(ATTACHMENT_BYTES.length),
            'X-Content-SHA256': ATTACHMENT_SHA,
            'X-Content-Type-Options': 'nosniff',
          },
        });
      if (url.pathname.includes('/tasks/'))
        return json({
          task: { taskId: serverSource.owner.id, version: 19 },
          contentAccess: {
            state: taskContentAllowed ? 'FULL' : 'REDACTED',
            reason: taskContentAllowed
              ? 'CURRENT_AUTHORITY_VERIFIED'
              : 'CURRENT_PERMISSION_REVOKED',
            evaluatedAt: new Date().toISOString(),
          },
          payload: {},
          timeline: [],
        });
      throw new Error(`Unexpected attachment URL ${url}`);
    });
    vi.stubGlobal('fetch', fetch);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(async () => {
    await act(() => root.unmount());
    cache.clear();
    container.remove();
    resetCsrfToken();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('absent installed routes are fail-closed, including all DATA and every mutation, with HTTP 0', async () => {
    dependencies.installed = false;
    await setup();
    expect(client.available).toBe(false);
    expect(client.uploadReady).toBe(false);
    expect(client.downloadReady).toBe(false);
    await client.refresh();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends the actual immutable binary/hash and same original key across reserve and content', async () => {
    await setup();
    await choose();
    await act(() => client.controller.upload());
    expect(writes.map((write) => write.init.method)).toEqual(['POST', 'PUT']);
    const reserveBody = JSON.parse(writes[0].init.body as string);
    expect(reserveBody.sha256).toBe(ATTACHMENT_SHA);
    expect((writes[1].init.headers as Record<string, string>)['Idempotency-Key']).toBe(
      reserveBody.idempotencyKey
    );
    expect(Array.from(new Uint8Array(await (writes[1].init.body as Blob).arrayBuffer()))).toEqual(
      Array.from(ATTACHMENT_BYTES)
    );
    expect(client.state.uploads[0].upload.state).toBe('QUARANTINED');
  });

  it.each(['403', '503', 'payload', 'selection', 'policy', 'actor'] as const)(
    'deferred actual CSRF %s drift prevents reserve POST before observers render',
    async (drift) => {
      await setup();
      await choose();
      let release!: () => void;
      let entered!: () => void;
      const waiting = new Promise<void>((resolve) => {
        entered = resolve;
      });
      csrfPause = () => {
        entered();
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      };
      const operation = act(() => client.controller.upload());
      await waiting;
      if (drift === '403' || drift === '503') {
        const query = cache.getQueryCache().find({ queryKey: client.queryKey })!;
        query.setState({
          status: 'error',
          error: new HttpError('First source failure', Number(drift)),
        });
      } else if (drift === 'actor') {
        dependencies.actor = 'new-actor';
        flushSync(() =>
          root.render(
            <QueryClientProvider client={cache}>
              <Harness />
            </QueryClientProvider>
          )
        );
      } else {
        const changed = {
          ...serverSource,
          attachments: {
            ...serverSource.attachments,
            policyVersion: serverSource.attachments.policyVersion + (drift === 'policy' ? 1 : 0),
            manifest: {
              ...serverSource.attachments.manifest,
              payloadRevision:
                serverSource.attachments.manifest.payloadRevision + (drift === 'payload' ? 1 : 0),
              selectionVersion:
                serverSource.attachments.manifest.selectionVersion +
                (drift === 'selection' ? 1 : 0),
            },
          },
        };
        cache.setQueryData(client.queryKey, changed);
      }
      release();
      await operation;
      await flush();
      expect(writes).toHaveLength(0);
      if (drift !== 'actor') expect(client.state.problem).not.toBe('UNKNOWN');
    }
  );

  it('first 403 masks metadata and blocks writes; 503 preserves original File read-only until explicit fresh recovery', async () => {
    await setup();
    await choose();
    sourceStatus = 503;
    await act(() => client.refresh());
    await flush();
    expect(client.ready).toBe(false);
    expect(client.state.file?.sha256).toBe(ATTACHMENT_SHA);
    sourceStatus = 403;
    await act(() => client.refresh());
    await flush();
    expect(client.masked).toBe(true);
    expect(client.uploadReady).toBe(false);
    sourceStatus = 200;
    await act(() => client.refresh());
    await flush();
    expect(client.ready).toBe(true);
    expect(client.masked).toBe(false);
    expect(client.state.file?.sha256).toBe(ATTACHMENT_SHA);
  });

  it('ambiguous binary PUT never automatically retries/reserves or treats status GET as success', async () => {
    await setup();
    await choose();
    contentStatus = 503;
    await act(() => client.controller.upload());
    expect(client.state.unknownKind).toBe('CONTENT');
    upload = { ...upload, state: 'QUARANTINED', version: 2 };
    await act(() => client.controller.inspect(upload.uploadId));
    expect(client.state.problem).toBe('UNKNOWN');
    await act(() => client.controller.upload());
    await act(() => client.controller.retryOriginal());
    expect(writes).toHaveLength(2);
    await act(() => client.controller.reconcile(upload.uploadId));
    expect(writes.at(-1)?.url).toContain('/reconcile');
    expect(client.controller.unresolved).toBe(false);
    expect(client.state.uploads[0].upload.state).toBe('QUARANTINED');
  });

  it('download uses exact request export owner/CAS/reason and verifies actual bytes before a controlled Blob URL', async () => {
    await setup(true);
    await act(() => client.controller.download(attachmentItem(), 'Review evidence'));
    expect(writes[0].url).toContain(`/requests/${serverSource.owner.id}/attachments/`);
    const body = JSON.parse(writes[0].init.body as string);
    expect(body.expectedVersion).toBe(3);
    expect(body.reason).toBe('Review evidence');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(
      Array.from(
        new Uint8Array(
          await (vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob).arrayBuffer()
        )
      )
    ).toEqual(Array.from(ATTACHMENT_BYTES));
  });

  it('TASK downloads use task owner CAS 19, never request CAS 3, and actual verified bytes', async () => {
    await setup(true, true);
    await act(() => client.controller.download(attachmentItem(), 'Task review'));
    expect(writes).toHaveLength(1);
    expect(writes[0].url).toContain(`/tasks/${serverSource.owner.id}/attachments/`);
    expect(JSON.parse(writes[0].init.body as string)).toMatchObject({ expectedVersion: 19 });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(
      Array.from(
        new Uint8Array(
          await (vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob).arrayBuffer()
        )
      )
    ).toEqual(Array.from(ATTACHMENT_BYTES));
  });

  it('two actual File transfers remain selectable after only the first exact selection acknowledgement advances provenance', async () => {
    await setup();
    multiFile = true;
    await choose();
    await act(() => client.controller.upload());
    await act(() =>
      client.controller.choose(
        new NodeFile([ATTACHMENT_BYTES], 'second-evidence.txt', { type: 'text/plain' }) as File
      )
    );
    await act(() => client.controller.upload());
    expect(writes.map((write) => write.init.method)).toEqual(['POST', 'PUT', 'POST', 'PUT']);
    for (const row of multiUploads.values())
      row.upload = {
        ...row.upload,
        state: 'AVAILABLE',
        version: 3,
        avState: 'AV_CLEAR',
        passiveContentState: 'PASSIVE_ALLOWED',
      };
    for (const id of multiUploads.keys()) await act(() => client.controller.inspect(id));
    const ids = [...multiUploads.values()].map((row) => row.upload.attachmentId);
    await act(() => client.controller.select([ids[0]]));
    await flush();
    expect(client.state.problem).toBeUndefined();
    expect(client.attachments?.manifest.selectionVersion).toBe(1);
    await act(() => client.controller.select(ids));
    await flush();
    expect(writes).toHaveLength(6);
    expect(client.attachments?.manifest.selectionVersion).toBe(2);
    expect(client.attachments?.manifest.items.map((item) => item.fileName)).toEqual([
      ATTACHMENT_FILE_NAME,
      'second-evidence.txt',
    ]);
    expect(JSON.parse(writes[4].init.body as string).expectedSelectionVersion).toBe(0);
    expect(JSON.parse(writes[5].init.body as string).expectedSelectionVersion).toBe(1);
    for (const [reserveIndex, contentIndex] of [
      [0, 1],
      [2, 3],
    ]) {
      const original = JSON.parse(writes[reserveIndex].init.body as string);
      expect((writes[contentIndex].init.headers as Record<string, string>)['Idempotency-Key']).toBe(
        original.idempotencyKey
      );
      expect(
        Array.from(new Uint8Array(await (writes[contentIndex].init.body as Blob).arrayBuffer()))
      ).toEqual(Array.from(ATTACHMENT_BYTES));
    }
  });

  it('fresh TASK content denial masks data and prevents download grant POST even with old allowed tools', async () => {
    await setup(true, true);
    taskContentAllowed = false;
    await act(() => client.controller.download(attachmentItem(), 'Task review'));
    expect(writes).toHaveLength(0);
    expect(client.masked).toBe(true);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it.each([403, 503])(
    'first Drawer detail-view cache %s during real deferred CSRF blocks POST before observer updates',
    async (status) => {
      await setup();
      await choose();
      const scopeKey = ['tenant', dependencies.actor, 'NORMAL', 'approvals.work', '', 'revision'];
      const detailKey = [
        'approvals',
        ...scopeKey,
        'requests',
        'detail-view',
        serverSource.owner.id,
      ];
      cache.setQueryData(detailKey, attachmentDetail());
      let release!: () => void;
      let entered!: () => void;
      const waiting = new Promise<void>((resolve) => {
        entered = resolve;
      });
      csrfPause = () => {
        entered();
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      };
      const operation = act(() => client.controller.upload());
      await waiting;
      cache
        .getQueryCache()
        .find({ queryKey: detailKey })!
        .setState({ status: 'error', error: new HttpError('Current detail failed', status) });
      release();
      await operation;
      expect(writes).toHaveLength(0);
      expect(client.state.file?.sha256).toBe(ATTACHMENT_SHA);
    }
  );

  it('actor change while actual download SHA digest is pending creates no Blob URL', async () => {
    await setup(true, true);
    let release!: () => void;
    let entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return digest(...args);
    });
    const operation = act(() => client.controller.download(attachmentItem(), 'Task review'));
    await waiting;
    dependencies.actor = 'different-actor';
    flushSync(() =>
      root.render(
        <QueryClientProvider client={cache}>
          <Harness />
        </QueryClientProvider>
      )
    );
    release();
    await operation;
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(client.controller.unresolved).toBe(false);
  });

  it.each([403, 503])(
    'actual Lifecycle stable parent retains original UNKNOWN across first list %s, viewer close/reopen and qualified recovery',
    async (status) => {
      const renderLifecycle = () =>
        act(async () => {
          root.render(
            <QueryClientProvider client={cache}>
              <MemoryRouter initialEntries={['/approvals/requests/drafts']}>
                <ApprovalRequestLifecycle view="drafts" />
              </MemoryRouter>
            </QueryClientProvider>
          );
        });
      await renderLifecycle();
      for (let i = 0; i < 30 && !client?.ready; i++) await flush();
      expect(client.ready).toBe(true);
      await choose();
      contentStatus = 503;
      await act(() => client.controller.upload());
      const original = client.controller;
      const originalKey = (writes[0].init.headers as Record<string, string>)['Idempotency-Key'];
      await act(() =>
        Array.from(container.querySelectorAll('button'))
          .find((button) => button.textContent === 'Open attachment viewer')!
          .click()
      );
      await act(() =>
        Array.from(container.querySelectorAll('button'))
          .find((button) => button.textContent === 'Close attachment viewer')!
          .click()
      );
      expect(client.controller).toBe(original);
      expect(client.state.unknownKind).toBe('CONTENT');
      listStatus = status;
      await act(() =>
        cache.refetchQueries({
          predicate: (query) =>
            query.queryKey.includes('requests') && query.queryKey.includes('search'),
        })
      );
      await flush();
      expect(client.controller).toBe(original);
      expect(client.ready).toBe(false);
      expect(client.state.unknownKind).toBe('CONTENT');
      await act(() => client.controller.retryOriginal());
      expect(writes).toHaveLength(2);
      listStatus = 200;
      await act(() =>
        cache.refetchQueries({
          predicate: (query) =>
            query.queryKey.includes('requests') && query.queryKey.includes('search'),
        })
      );
      await flush();
      await act(() => client.refresh());
      await flush();
      expect(client.controller).toBe(original);
      expect(client.ready).toBe(true);
      expect(client.state.problem).toBe('UNKNOWN');
      await act(() =>
        Array.from(container.querySelectorAll('button'))
          .find((button) => button.textContent === 'Open attachment viewer')!
          .click()
      );
      await act(() => client.controller.reconcile(upload.uploadId));
      expect(writes.map((write) => write.init.method)).toEqual(['POST', 'PUT', 'POST']);
      expect(writes[0].init.headers).toHaveProperty('Idempotency-Key', originalKey);
      expect(client.controller.unresolved).toBe(false);
    }
  );
});
