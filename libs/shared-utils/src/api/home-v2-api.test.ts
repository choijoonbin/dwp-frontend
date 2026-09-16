import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import { getHomeV2, parseHomeV2ReadModel, parseHomeV2ResponseMetadata } from './home-v2-api';

function responseFixture(): Record<string, unknown> {
  return {
    status: 'SUCCESS',
    message: 'ok',
    data: {
      schemaVersion: 2,
      mode: 'CLASSIC',
      view: {
        viewId: 'd1d847f2-0a54-4f50-a157-f57492e626dc',
        revision: 7,
        source: 'USER',
        mode: 'CLASSIC',
        deviceClass: 'DESKTOP_STANDARD',
        composition: {
          appLayout: null,
          presentation: 'balanced',
          widgets: [{ widgetKey: 'approval.focus-queue', visible: true, size: 'medium' }],
        },
        deviceOverlay: {
          widgetOrder: ['approval.focus-queue'],
          widgetSizes: { 'approval.focus-queue': 'medium' },
          density: 'comfortable',
        },
      },
      shell: {
        headline: '오늘의 업무',
        subheadline: '우선순위를 확인하세요.',
        contentAlignment: 'LEFT',
        density: 'COMFORTABLE',
        backgroundAssetRoute: null,
        announcements: [
          {
            id: 'security-training',
            kind: 'REQUIRED',
            title: '보안 교육',
            dueAt: '2026-09-17T00:00:00Z',
            sourceRoute: '/communications',
          },
        ],
      },
      appDock: [
        {
          groupKey: 'work',
          label: '업무 시작',
          apps: [
            {
              appKey: 'dwp-approvals',
              label: '결재',
              iconKey: 'approvals',
              sourceRoute: '/approvals/home',
              badgeState: 'AVAILABLE',
              badge: { total: 4, urgent: 1, version: 'counter-3' },
            },
          ],
        },
      ],
      widgets: [
        {
          instanceId: '16bbf7d4-d654-477a-93cd-18cb8ec48a2a',
          definitionKey: 'approval.focus-queue',
          definitionVersion: '1.0.0',
          definitionManifestHash: 'a'.repeat(64),
          rendererBindingRevision: 'a'.repeat(64),
          rendererKey: 'home.approval.focus-queue',
          state: 'AVAILABLE',
          source: {
            sourceKey: 'APPROVAL_HOME',
            generatedAt: '2026-09-16T00:00:00Z',
            expiresAt: '2026-09-16T00:01:00Z',
            lastSuccessAt: '2026-09-16T00:00:00Z',
            reasonCode: null,
            retryable: false,
            resultVersion: 'approval-12',
          },
          payload: { pendingCount: 4, dueTodayCount: 1, overdueCount: 0, items: [] },
          actions: [
            {
              actionId: 'open-source',
              commandKey: null,
              expectedResultVersion: null,
              kind: 'SOURCE_ROUTE',
              labelKey: 'home.openApprovals',
              requiresConfirmation: false,
              sourceRoute: '/approvals/home',
            },
          ],
          redactions: [],
          governance: {
            owner: 'approval',
            sourceAppResourceKey: 'APP.APPROVALS',
            requiredAuthorities: ['APP.APPROVALS:VIEW'],
            classification: 'INTERNAL',
            retention: 'SESSION',
            sourceRoute: '/approvals/home',
          },
        },
      ],
      generatedAt: '2026-09-16T00:00:00Z',
      expiresAt: '2026-09-16T00:01:00Z',
      partial: false,
      unavailableSources: [],
      changeVersion: 'home-change-8',
      registryMode: 'SHADOW',
    },
  };
}

function responseHeaders(mode: 'ACTIVE' | 'SHADOW' = 'ACTIVE'): Headers {
  return new Headers({
    'Cache-Control': 'private, max-age=0, must-revalidate',
    Vary: 'Accept-Language, X-DWP-Tenant-ID, X-DWP-User-ID, X-DWP-Person-Public-ID, X-DWP-Permissions, X-DWP-Roles, X-DWP-Group-Refs, X-DWP-Current-Decision-Revision',
    'X-DWP-Home-Commands-Enabled': 'false',
    'X-DWP-Home-Runtime-Mode': mode,
    'X-DWP-Widget-Registry-Authoritative': 'true',
  });
}

function setFixturePath(
  root: Record<string, unknown>,
  path: readonly (string | number)[],
  value: unknown
): void {
  let cursor: unknown = root;
  for (const segment of path.slice(0, -1)) {
    cursor =
      typeof segment === 'number'
        ? (cursor as unknown[])[segment]
        : (cursor as Record<string, unknown>)[segment];
  }
  const final = path.at(-1)!;
  if (typeof final === 'number') (cursor as unknown[])[final] = value;
  else (cursor as Record<string, unknown>)[final] = value;
}

describe('Home v2 read contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('strictly normalizes the canonical response envelope', () => {
    const model = parseHomeV2ReadModel(responseFixture());

    expect(model).toMatchObject({
      schemaVersion: 2,
      mode: 'CLASSIC',
      changeVersion: 'home-change-8',
      view: { deviceClass: 'DESKTOP_STANDARD', revision: 7 },
      appDock: [{ apps: [{ appKey: 'dwp-approvals', badge: { total: 4, urgent: 1 } }] }],
      widgets: [{ definitionKey: 'approval.focus-queue', state: 'AVAILABLE' }],
    });
  });

  it.each([
    ['schema version', ['data', 'schemaVersion'], 1],
    ['mode mismatch', ['data', 'view', 'mode'], 'FLOW_V1'],
    ['unsafe badge count', ['data', 'appDock', 0, 'apps', 0, 'badge', 'urgent'], 5],
    ['invalid timestamp', ['data', 'generatedAt'], 'today'],
    ['invalid widget identifier', ['data', 'widgets', 0, 'instanceId'], 'not-a-uuid'],
    ['unknown registry mode', ['data', 'registryMode'], 'EXPERIMENTAL'],
    [
      'unknown device widget size',
      ['data', 'view', 'deviceOverlay', 'widgetSizes', 'approval.focus-queue'],
      'oversized',
    ],
  ] as const)('rejects %s drift instead of rendering untrusted data', (_label, path, value) => {
    const fixture = responseFixture();
    setFixturePath(fixture, path, value);
    expect(() => parseHomeV2ReadModel(fixture)).toThrow('Home v2 response is invalid');
  });

  it.each([
    ['group key', ['data', 'appDock']],
    ['widget instance key', ['data', 'widgets']],
  ] as const)('rejects a duplicate %s', (_label, path) => {
    const fixture = responseFixture();
    const data = (fixture.data ?? {}) as Record<string, unknown>;
    const collection =
      path[1] === 'appDock' ? (data.appDock as unknown[]) : (data.widgets as unknown[]);
    collection.push(structuredClone(collection[0]));
    expect(() => parseHomeV2ReadModel(fixture)).toThrow('Home v2 response is invalid');
  });

  it('rejects duplicate app keys across otherwise distinct groups', () => {
    const fixture = responseFixture();
    const data = fixture.data as Record<string, unknown>;
    const groups = data.appDock as Array<Record<string, unknown>>;
    const duplicate = structuredClone(groups[0]);
    duplicate.groupKey = 'connect';
    groups.push(duplicate);
    expect(() => parseHomeV2ReadModel(fixture)).toThrow('Home v2 response is invalid');
  });

  it('requires the complete privacy and rollout header contract', () => {
    expect(parseHomeV2ResponseMetadata(responseHeaders('SHADOW'))).toEqual({
      cacheControl: 'private, max-age=0, must-revalidate',
      commandsEnabled: false,
      registryAuthoritative: true,
      runtimeMode: 'SHADOW',
      vary: 'Accept-Language, X-DWP-Tenant-ID, X-DWP-User-ID, X-DWP-Person-Public-ID, X-DWP-Permissions, X-DWP-Roles, X-DWP-Group-Refs, X-DWP-Current-Decision-Revision',
    });

    const missingRuntime = responseHeaders();
    missingRuntime.delete('X-DWP-Home-Runtime-Mode');
    expect(() => parseHomeV2ResponseMetadata(missingRuntime)).toThrow(
      'headers.X-DWP-Home-Runtime-Mode'
    );

    const incompleteVary = responseHeaders();
    incompleteVary.set('Vary', 'Accept-Language, X-DWP-Tenant-ID');
    expect(() => parseHomeV2ResponseMetadata(incompleteVary)).toThrow('headers.Vary');
  });

  it('owns the conditional snapshot at the caller and sends the canonical query', async () => {
    const model = parseHomeV2ReadModel(responseFixture());
    const previous = { data: model, etag: '"home-change-7"' };
    const getConditional = vi.spyOn(axiosInstance, 'getConditional').mockResolvedValue({
      headers: responseHeaders(),
      snapshot: previous,
      status: 304,
      notModified: true,
    });

    const result = await getHomeV2(
      {
        deviceClass: 'DESKTOP_STANDARD',
        mode: 'CLASSIC',
        timeZone: 'Asia/Seoul',
        contextScopeKey: 'opaque-scope',
      },
      previous
    );

    expect(getConditional).toHaveBeenCalledWith(
      '/api/platform/v2/home?deviceClass=DESKTOP_STANDARD&timeZone=Asia%2FSeoul&mode=CLASSIC',
      previous,
      expect.objectContaining({ contextScopeKey: 'opaque-scope', timeoutMs: 10_000 })
    );
    expect(result).toMatchObject({
      status: 304,
      notModified: true,
      metadata: { runtimeMode: 'ACTIVE' },
    });
    expect(result.snapshot.data).toBe(model);
  });

  it('parses a fresh 200 before storing the privacy-bound snapshot', async () => {
    const payload = responseFixture();
    vi.spyOn(axiosInstance, 'getConditional').mockResolvedValue({
      headers: responseHeaders('SHADOW'),
      snapshot: { data: payload, etag: '"home-change-8"' },
      status: 200,
      notModified: false,
    });

    const result = await getHomeV2({
      deviceClass: 'MOBILE_STANDARD',
      timeZone: 'Asia/Seoul',
    });

    expect(result.snapshot).toEqual({
      data: expect.objectContaining({ schemaVersion: 2 }),
      etag: '"home-change-8"',
    });
    expect(result.metadata.runtimeMode).toBe('SHADOW');
  });
});
