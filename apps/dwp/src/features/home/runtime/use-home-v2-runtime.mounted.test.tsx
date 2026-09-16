// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ConditionalHttpSnapshot,
  HomeV2ReadModel,
  HomeV2ReadResult,
} from '@dwp-frontend/shared-utils';
import type * as SharedUtils from '@dwp-frontend/shared-utils';

const transport = vi.hoisted(() => ({ getHomeV2: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  getHomeV2: transport.getHomeV2,
}));

import { HOME_V2_QUERY_ROOT, useHomeV2Runtime } from './use-home-v2-runtime';

type ProbeInput = Readonly<{
  accessFingerprint: string;
  locale: string;
  tenantId: number;
  userId: number;
}>;

const REQUIRED_VARY =
  'Accept-Language, X-DWP-Tenant-ID, X-DWP-User-ID, X-DWP-Person-Public-ID, X-DWP-Permissions, X-DWP-Roles, X-DWP-Group-Refs, X-DWP-Current-Decision-Revision';

function model(headline: string, changeVersion: string): HomeV2ReadModel {
  return {
    schemaVersion: 2,
    mode: 'CLASSIC',
    view: {
      viewId: 'd1d847f2-0a54-4f50-a157-f57492e626dc',
      revision: 7,
      source: 'USER',
      mode: 'CLASSIC',
      deviceClass: 'DESKTOP_STANDARD',
      composition: { appLayout: null, presentation: 'balanced', widgets: [] },
      deviceOverlay: null,
    },
    shell: {
      headline,
      subheadline: 'Scoped Home receipt',
      contentAlignment: 'LEFT',
      density: 'COMFORTABLE',
      backgroundAssetRoute: null,
      announcements: [],
    },
    appDock: [],
    widgets: [],
    generatedAt: '2026-09-16T00:00:00Z',
    expiresAt: '2026-09-16T00:01:00Z',
    partial: false,
    unavailableSources: [],
    changeVersion,
    registryMode: 'SHADOW',
  };
}

function result(
  snapshot: ConditionalHttpSnapshot<HomeV2ReadModel>,
  runtimeMode: 'ACTIVE' | 'SHADOW' = 'ACTIVE',
  status: 200 | 304 = 200
): HomeV2ReadResult {
  return {
    metadata: {
      cacheControl: 'private, max-age=0, must-revalidate',
      commandsEnabled: false,
      registryAuthoritative: false,
      runtimeMode,
      vary: REQUIRED_VARY,
    },
    notModified: status === 304,
    snapshot,
    status,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

let client: QueryClient;
let host: HTMLDivElement;
let root: Root;
let input: ProbeInput;

function Probe() {
  const runtime = useHomeV2Runtime({
    ...input,
    deviceClass: 'DESKTOP_STANDARD',
    enabled: true,
    locale: input.locale,
    timeZone: 'Asia/Seoul',
  });
  const headline =
    runtime.activation.kind === 'ACTIVE' || runtime.activation.kind === 'SHADOW'
      ? runtime.activation.result.snapshot.data.shell.headline
      : '';
  return createElement('output', {
    'data-activation': runtime.activation.kind,
    'data-headline': headline,
    'data-legacy-enabled': String(runtime.legacyEnabled),
    'data-refresh-failed':
      runtime.activation.kind === 'ACTIVE' || runtime.activation.kind === 'SHADOW'
        ? String(runtime.activation.refreshFailed)
        : 'none',
    'data-status': String(runtime.query.data?.status ?? 'none'),
  });
}

async function render(next: ProbeInput): Promise<void> {
  input = next;
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, createElement(Probe)));
  });
}

function receipt() {
  return host.querySelector('output')!;
}

async function waitFor(assertion: () => void): Promise<void> {
  await act(async () => {
    await vi.waitFor(assertion, { timeout: 3_000 });
  });
}

describe('mounted Home v2 runtime receipt', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    transport.getHomeV2.mockReset();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    input = { accessFingerprint: 'v1:scope-a', locale: 'ko-KR', tenantId: 1, userId: 7 };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it('retains the same-scope snapshot on 304 and keeps the ACTIVE path off legacy fanout', async () => {
    const firstSnapshot = { data: model('Tenant A Home', 'home-a-1'), etag: '"home-a-1"' };
    transport.getHomeV2
      .mockResolvedValueOnce(result(firstSnapshot))
      .mockImplementationOnce(
        async (_request: unknown, previous: ConditionalHttpSnapshot<HomeV2ReadModel>) =>
          result(previous, 'ACTIVE', 304)
      );

    await render(input);
    await waitFor(() => expect(receipt().dataset.activation).toBe('ACTIVE'));
    expect(receipt().dataset).toMatchObject({
      headline: 'Tenant A Home',
      legacyEnabled: 'false',
      status: '200',
    });
    expect(client.getQueryCache().findAll({ queryKey: HOME_V2_QUERY_ROOT })[0]?.meta).toMatchObject(
      {
        accessSensitive: true,
      }
    );

    await act(async () => {
      await client.refetchQueries({ queryKey: HOME_V2_QUERY_ROOT, type: 'active' });
    });
    await waitFor(() => expect(receipt().dataset.status).toBe('304'));

    expect(transport.getHomeV2).toHaveBeenCalledTimes(2);
    expect(transport.getHomeV2.mock.calls[1]?.[1]).toBe(firstSnapshot);
    expect(receipt().dataset).toMatchObject({
      activation: 'ACTIVE',
      headline: 'Tenant A Home',
      legacyEnabled: 'false',
      status: '304',
    });
  });

  it('enables the legacy read path only for a validated SHADOW response', async () => {
    const snapshot = { data: model('Shadow observation', 'home-shadow-1'), etag: '"shadow-1"' };
    transport.getHomeV2.mockResolvedValue(result(snapshot, 'SHADOW'));

    await render(input);
    await waitFor(() => expect(receipt().dataset.activation).toBe('SHADOW'));

    expect(receipt().dataset).toMatchObject({
      activation: 'SHADOW',
      headline: 'Shadow observation',
      legacyEnabled: 'true',
      status: '200',
    });
  });

  it('uses a verified ACTIVE to SHADOW transition as the authorized rollback', async () => {
    const active = { data: model('Active Home', 'home-active-1'), etag: '"active-1"' };
    const shadow = { data: model('Shadow Home', 'home-shadow-2'), etag: '"shadow-2"' };
    transport.getHomeV2
      .mockResolvedValueOnce(result(active))
      .mockResolvedValueOnce(result(shadow, 'SHADOW'));

    await render(input);
    await waitFor(() => expect(receipt().dataset.activation).toBe('ACTIVE'));
    await act(async () => {
      await client.refetchQueries({ queryKey: HOME_V2_QUERY_ROOT, type: 'active' });
    });
    await waitFor(() => expect(receipt().dataset.activation).toBe('SHADOW'));

    expect(receipt().dataset).toMatchObject({
      activation: 'SHADOW',
      headline: 'Shadow Home',
      legacyEnabled: 'true',
    });
  });

  it('preserves verified ACTIVE content and reports a failed background refresh', async () => {
    const snapshot = { data: model('Verified Home', 'home-active-1'), etag: '"active-1"' };
    transport.getHomeV2
      .mockResolvedValueOnce(result(snapshot))
      .mockRejectedValueOnce(new Error('refresh unavailable'));

    await render(input);
    await waitFor(() => expect(receipt().dataset.activation).toBe('ACTIVE'));
    await act(async () => {
      await client.refetchQueries({ queryKey: HOME_V2_QUERY_ROOT, type: 'active' });
    });
    await waitFor(() => expect(receipt().dataset.refreshFailed).toBe('true'));

    expect(receipt().dataset).toMatchObject({
      activation: 'ACTIVE',
      headline: 'Verified Home',
      legacyEnabled: 'false',
    });
  });

  it('drops old data and ETag before issuing a request for a changed access scope', async () => {
    const firstSnapshot = { data: model('Tenant A Home', 'home-a-1'), etag: '"home-a-1"' };
    const second = deferred<HomeV2ReadResult>();
    transport.getHomeV2
      .mockResolvedValueOnce(result(firstSnapshot))
      .mockImplementationOnce(() => second.promise);

    await render(input);
    await waitFor(() => expect(receipt().dataset.headline).toBe('Tenant A Home'));

    await render({ accessFingerprint: 'v1:scope-b', locale: 'ko-KR', tenantId: 2, userId: 9 });
    await waitFor(() => expect(transport.getHomeV2).toHaveBeenCalledTimes(2));
    expect(receipt().dataset).toMatchObject({
      activation: 'PENDING',
      headline: '',
      legacyEnabled: 'false',
      status: 'none',
    });
    expect(transport.getHomeV2.mock.calls[1]?.[1]).toBeUndefined();

    const secondSnapshot = { data: model('Tenant B Home', 'home-b-1'), etag: '"home-b-1"' };
    await act(async () => {
      second.resolve(result(secondSnapshot));
      await second.promise;
    });
    await waitFor(() => expect(receipt().dataset.headline).toBe('Tenant B Home'));
    expect(receipt().dataset.activation).toBe('ACTIVE');
    expect(receipt().dataset.headline).not.toBe('Tenant A Home');
  });

  it('drops old localized data and ETag before requesting a changed locale', async () => {
    const firstSnapshot = { data: model('한국어 홈', 'home-ko-1'), etag: '"home-ko-1"' };
    const english = deferred<HomeV2ReadResult>();
    transport.getHomeV2
      .mockResolvedValueOnce(result(firstSnapshot))
      .mockImplementationOnce(() => english.promise);

    await render(input);
    await waitFor(() => expect(receipt().dataset.headline).toBe('한국어 홈'));
    await render({ ...input, locale: 'en-US' });
    await waitFor(() => expect(transport.getHomeV2).toHaveBeenCalledTimes(2));

    expect(receipt().dataset).toMatchObject({ activation: 'PENDING', headline: '' });
    expect(transport.getHomeV2.mock.calls[1]?.[1]).toBeUndefined();

    const englishSnapshot = { data: model('English Home', 'home-en-1'), etag: '"home-en-1"' };
    await act(async () => {
      english.resolve(result(englishSnapshot));
      await english.promise;
    });
    await waitFor(() => expect(receipt().dataset.headline).toBe('English Home'));
    expect(receipt().dataset.headline).not.toBe('한국어 홈');
  });
});
