// @vitest-environment jsdom
import { Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';

import { useApprovalRequestLifecycleAction } from './use-approval-request-lifecycle-action';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import {
  approvalRequestInformationSnapshot,
  sameApprovalRequestInformationSnapshot,
} from './approval-request-information-snapshot';
import {
  approvalInformationDetail,
  INFORMATION_SOURCE_CHANGES,
} from '../../../../../e2e/support/approval-information-generation-fixtures';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import type { RequestActionCommand } from './approval-request-action-model';

const deps = vi.hoisted(() => ({
  actor: 'original-actor',
  view: 'needs-info',
  ready: true,
  userReady: true,
  ownerStatus: 200,
  detail: undefined as ApprovalRequestDetail | undefined,
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  getApprovalRequestDetail: async () => {
    if (deps.ownerStatus !== 200)
      throw new HttpError('Original owner read failed', deps.ownerStatus);
    return deps.detail!;
  },
}));
vi.mock('./use-approval-governed-mutation', () => ({
  useApprovalGovernedMutation: () => (execute: (execution: unknown) => Promise<unknown>) =>
    execute({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' }),
}));

let root: Root;
let container: HTMLDivElement;
let cache: QueryClient;
let client: ReturnType<typeof useApprovalRequestLifecycleAction>;
let scope: ReturnType<typeof useApprovalManagementCommandScope>;
let pending: { current: RequestActionCommand | undefined };
let wasUnknown = false;
let bodyOpen = true;
let csrfPause: (() => Promise<void>) | undefined;
let postStatus = 503;
let calls: { url: string; init: RequestInit }[];

function Harness() {
  scope = useApprovalManagementCommandScope([deps.actor, 'approvals.work']);
  const unresolved = useRef<RequestActionCommand | undefined>(undefined);
  pending = unresolved;
  const authority = useRef({ ready: deps.ready, requests: [deps.detail!.request] });
  authority.current = { ready: deps.ready, requests: [deps.detail!.request] };
  client = useApprovalRequestLifecycleAction({
    commandScope: scope,
    contextScopeKey: 'original-context',
    wireOwnerKey: deps.view,
    unresolvedResponse: unresolved,
    latestAuthority: authority,
    informationSnapshotIsCurrent: (snapshot) =>
      deps.ready && sameApprovalRequestInformationSnapshot(snapshot, deps.detail),
    userSourceIsReady: () => deps.userReady,
    onSuccess: async () => {
      unresolved.current = undefined;
      wasUnknown = false;
    },
    onError: (error, command) => {
      const unknown =
        unresolved.current === command &&
        (wasUnknown || (error instanceof HttpError && error.status >= 500));
      if (!unknown) unresolved.current = undefined;
      wasUnknown = unknown;
    },
    onSettled: () => undefined,
  });
  return bodyOpen ? <div data-testid="conditional-document" /> : null;
}
const render = () =>
  act(() =>
    root.render(
      <QueryClientProvider client={cache}>
        <Harness />
      </QueryClientProvider>
    )
  );
const capture = (): RequestActionCommand =>
  scope.capture({
    action: { kind: 'respond', request: { ...deps.detail!.request } },
    responseMessage: '\uacb0\uc7ac \ubcf4\uc644 original',
    responsePayload: { ...deps.detail!.payload, costCenter: 'confirmed-center' },
    schemaHash: deps.detail!.formSchemaSha256 ?? undefined,
    idempotencyKey: 'information:original',
    informationSnapshot: approvalRequestInformationSnapshot(deps.detail!),
  });
const mutate = (command: RequestActionCommand) =>
  act(async () => {
    await client.mutateAsync(command).catch(() => undefined);
  });
const actualPosts = () => calls.filter((call) => call.url.endsWith('/information-response'));
const decode = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

describe('actual lifecycle action + private original wire + real API/CSRF transport', () => {
  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('crypto', webcrypto);
    deps.actor = 'original-actor';
    deps.view = 'needs-info';
    deps.ready = true;
    deps.userReady = true;
    deps.ownerStatus = 200;
    deps.detail = await approvalInformationDetail();
    csrfPause = undefined;
    postStatus = 503;
    bodyOpen = true;
    wasUnknown = false;
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ url, init });
        if (url.includes('/csrf')) {
          await csrfPause?.();
          return new Response(
            JSON.stringify({
              status: 'SUCCESS',
              data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' },
            })
          );
        }
        if (postStatus !== 200)
          return new Response(
            JSON.stringify({ status: 'ERROR', message: 'Lost original response' }),
            { status: postStatus }
          );
        return new Response(
          JSON.stringify({
            status: 'SUCCESS',
            data: { ...deps.detail!.request, status: 'IN_REVIEW', version: 4 },
          })
        );
      })
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    resetCsrfToken();
    await render();
  });
  afterEach(async () => {
    await act(() => root.unmount());
    cache.clear();
    container.remove();
    resetCsrfToken();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('retains the exact immutable Blob UTF8 bytes, original key and source generation after actual UNKNOWN', async () => {
    const original = capture();
    await mutate(original);
    expect(client.readOriginalInformationWire(original)).toBeDefined();
    const post = actualPosts()[0];
    expect(post.init.body).toBeInstanceOf(Blob);
    expect(Array.from(new Uint8Array(await (post.init.body as Blob).arrayBuffer()))).toEqual(
      Array.from(decode(client.readOriginalInformationWire(original)!))
    );
    expect((post.init.headers as Record<string, string>)['Idempotency-Key']).toBe(
      original.input.idempotencyKey
    );
    expect(
      JSON.parse(new TextDecoder().decode(decode(client.readOriginalInformationWire(original)!)))
    ).toMatchObject({
      message: original.input.responseMessage,
      sourceGeneration: 1,
      expectedVersion: 3,
      payload: { costCenter: 'confirmed-center' },
    });
    expect(pending.current).toBe(original);
  });

  it('purges a view transition original without blocking a new same-identity response capture', async () => {
    const original = capture();
    await mutate(original);
    expect(client.readOriginalInformationWire(original)).toBeDefined();
    deps.view = 'submitted';
    await render();
    deps.view = 'needs-info';
    await render();
    expect(client.readOriginalInformationWire(original)).toBeUndefined();
    pending.current = undefined;
    wasUnknown = false;
    const next = capture();
    Object.assign(next.input, { idempotencyKey: 'information:new-original' });
    await mutate(next);
    expect(client.readOriginalInformationWire(next)).toBeDefined();
    expect(client.readOriginalInformationWire(original)).toBeUndefined();
    expect(actualPosts()).toHaveLength(2);
    expect(pending.current).toBe(next);
  });

  it.each([403, 503])(
    'keeps private UNKNOWN through conditional close and owner %s then uses the same wire only after qualified recovery',
    async (status) => {
      const original = capture();
      await mutate(original);
      const bytes = client.readOriginalInformationWire(original);
      bodyOpen = false;
      await render();
      expect(container.textContent).toBe('');
      deps.ownerStatus = status;
      await mutate(original);
      expect(actualPosts()).toHaveLength(1);
      expect(client.readOriginalInformationWire(original)).toBe(bytes);
      deps.ownerStatus = 200;
      bodyOpen = true;
      await render();
      postStatus = 200;
      await mutate(original);
      expect(actualPosts()).toHaveLength(2);
      expect(
        Array.from(new Uint8Array(await (actualPosts()[1].init.body as Blob).arrayBuffer()))
      ).toEqual(Array.from(decode(bytes!)));
      expect(client.readOriginalInformationWire(original)).toBeUndefined();
    }
  );

  it('does not recompute and accept a new draft body under an UNKNOWN original key', async () => {
    const original = capture();
    await mutate(original);
    const bytes = client.readOriginalInformationWire(original);
    Object.assign(original.input.responsePayload, { costCenter: 'different-center' });
    await mutate(original);
    expect(actualPosts()).toHaveLength(1);
    expect(client.readOriginalInformationWire(original)).toBe(bytes);
    expect(pending.current).toBe(original);
  });

  it('purges on actor A→B→A and never dispatches the old original command', async () => {
    const original = capture();
    await mutate(original);
    deps.actor = 'other-actor';
    await render();
    expect(client.readOriginalInformationWire(original)).toBeUndefined();
    deps.actor = 'original-actor';
    await render();
    await mutate(original);
    expect(actualPosts()).toHaveLength(1);
    expect(client.readOriginalInformationWire(original)).toBeUndefined();
  });

  it('checks current source after real deferred CSRF and sends POST 0 without UNKNOWN when the original round fails', async () => {
    const original = capture();
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
    const operation = mutate(original);
    await waiting;
    deps.ready = false;
    release();
    await operation;
    expect(actualPosts()).toHaveLength(0);
    expect(pending.current).toBeUndefined();
    expect(client.readOriginalInformationWire(original)).toBeUndefined();
  });

  it('a pre-capture oversized wire rejection sends HTTP 0 and never fabricates UNKNOWN', async () => {
    const original = capture();
    Object.assign(original.input, { responseMessage: 'a'.repeat(262145) });
    await mutate(original);
    expect(calls).toHaveLength(0);
    expect(pending.current).toBeUndefined();
    expect(client.readOriginalInformationWire(original)).toBeUndefined();
  });

  it('closes an owner view ABA during real deferred CSRF with zero old response writes', async () => {
    const original = capture();
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
    let operation!: Promise<unknown>;
    await act(async () => {
      operation = client.mutateAsync(original).catch(() => undefined);
      await waiting;
    });
    deps.view = 'submitted';
    await render();
    deps.view = 'needs-info';
    await render();
    await act(async () => {
      release();
      await operation;
    });
    expect(actualPosts()).toHaveLength(0);
    expect(client.readOriginalInformationWire(original)).toBeUndefined();
    expect(pending.current).toBeUndefined();
    expect(wasUnknown).toBe(false);
  });

  it.each(INFORMATION_SOURCE_CHANGES)(
    'retains original bytes but sends POST 0 on changed $key without healing the round',
    async ({ change }) => {
      const original = capture();
      await mutate(original);
      const bytes = client.readOriginalInformationWire(original);
      deps.detail = change(deps.detail!);
      await render();
      await mutate(original);
      expect(actualPosts()).toHaveLength(1);
      expect(client.readOriginalInformationWire(original)).toBe(bytes);
      expect(pending.current).toBe(original);
    }
  );

  it('purges captured bytes and disables a retained accessor when the stable owner actually unmounts', async () => {
    const original = capture();
    await mutate(original);
    const read = client.readOriginalInformationWire;
    expect(read(original)).toBeDefined();
    await act(() => root.unmount());
    expect(read(original)).toBeUndefined();
    root = createRoot(container);
  });
});
