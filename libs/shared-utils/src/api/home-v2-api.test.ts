import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import {
  getHomeV2,
  isSafeHomeInternalRoute,
  parseHomeV2ReadModel,
  parseHomeV2ResponseMetadata,
} from './home-v2-api';

function responseFixture(
  runtimeState: 'SHADOW_COMPARE' | 'READ_ONLY_ACTIVE' | 'COMMAND_CANARY' = 'READ_ONLY_ACTIVE'
): Record<string, unknown> {
  const commandsEnabled = runtimeState === 'COMMAND_CANARY';
  return {
    status: 'SUCCESS',
    message: 'ok',
    data: {
      schemaVersion: 3,
      mode: 'CLASSIC',
      runtime: {
        state: runtimeState,
        homeMode: 'CLASSIC',
        rolloutRing: runtimeState === 'SHADOW_COMPARE' ? 'CONTROL' : 'INTERNAL',
        rolloutRevision: 'home-wave6-r1',
        commandsEnabled,
        registryAuthoritative: false,
        expiresAt: '2026-09-16T01:00:00Z',
      },
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
          groupKey: 'WORK_START',
          label: '업무 시작',
          apps: [
            {
              appKey: 'dwp-approvals',
              label: '결재',
              iconKey: 'approvals',
              sourceRoute: '/approvals/home',
              badgeState: 'AVAILABLE',
              badge: { total: 4, urgent: 1, version: '3' },
            },
          ],
        },
        { groupKey: 'COLLABORATION', label: '소통과 협업', apps: [] },
        { groupKey: 'PEOPLE_SERVICES', label: '구성원과 서비스', apps: [] },
        { groupKey: 'SYSTEM_CONTROL', label: '시스템과 통제', apps: [] },
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
              labelKey: 'home.action.openSource',
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

function responseHeaders(mode: 'ACTIVE' | 'SHADOW' = 'ACTIVE', etag = '"home-change-8"'): Headers {
  return new Headers({
    'Cache-Control': 'private, max-age=0, must-revalidate',
    ETag: etag,
    Vary: 'Accept-Language, X-DWP-Tenant-ID, X-DWP-User-ID, X-DWP-Person-Public-ID, X-DWP-Permissions, X-DWP-Roles, X-DWP-Group-Refs, X-DWP-Current-Decision-Revision, X-DWP-Current-Revalidate-At, X-DWP-Home-Runtime-State, X-DWP-Home-Rollout-Ring, X-DWP-Home-Rollout-Revision',
    'X-DWP-Home-Commands-Enabled': 'false',
    'X-DWP-Decision-Revision': 'home-route-decision-r1',
    'X-DWP-Home-Runtime-Mode': mode,
    'X-DWP-Home-Runtime-State': mode === 'ACTIVE' ? 'READ_ONLY_ACTIVE' : 'SHADOW_COMPARE',
    'X-DWP-Home-Rollout-Ring': mode === 'ACTIVE' ? 'INTERNAL' : 'CONTROL',
    'X-DWP-Home-Rollout-Revision': 'home-wave6-r1',
    'X-DWP-Widget-Registry-Authoritative': 'false',
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

  it.each([
    '//admin',
    '///admin',
    '/work/./admin',
    '/work/../admin',
    '/work/.%2e/admin',
    '/work/%2E%2E/admin',
    '/work/%2fadmin',
    '/work/%5cadmin',
    '/work/%252e%252e/admin',
    '/work/%2',
    '/work?item=1?next=2',
    '/work#admin',
    '/work/%00admin',
    '/work/%C3%A9',
  ])('rejects non-canonical internal route %s', (route) => {
    expect(isSafeHomeInternalRoute(route)).toBe(false);
  });

  it.each([
    '/',
    '/work',
    '/work/queue?item=PERSONAL_TASK%3A123%3A',
    '/approvals/home?filter=due-today&owner=me',
  ])('accepts canonical internal route %s', (route) => {
    expect(isSafeHomeInternalRoute(route)).toBe(true);
  });

  it('strictly normalizes the canonical response envelope', () => {
    const model = parseHomeV2ReadModel(responseFixture());

    expect(model).toMatchObject({
      schemaVersion: 3,
      mode: 'CLASSIC',
      changeVersion: 'home-change-8',
      view: { deviceClass: 'DESKTOP_STANDARD', revision: 7 },
      widgets: [{ definitionKey: 'approval.focus-queue', state: 'AVAILABLE' }],
    });
    expect(model.appDock.map((group) => group.groupKey)).toEqual([
      'WORK_START',
      'COLLABORATION',
      'PEOPLE_SERVICES',
      'SYSTEM_CONTROL',
    ]);
    expect(model.appDock[0].apps[0]).toMatchObject({
      appKey: 'dwp-approvals',
      badge: { total: 4, urgent: 1 },
    });
  });

  it.each([
    ['schema version', ['data', 'schemaVersion'], 1],
    ['mode mismatch', ['data', 'view', 'mode'], 'FLOW_V1'],
    ['unsafe badge count', ['data', 'appDock', 0, 'apps', 0, 'badge', 'urgent'], 5],
    ['invalid badge version', ['data', 'appDock', 0, 'apps', 0, 'badge', 'version'], 'counter-3'],
    ['invalid timestamp', ['data', 'generatedAt'], 'today'],
    ['timestamp without offset', ['data', 'generatedAt'], '2026-09-16T00:00:00'],
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
    ['command action', ['data', 'widgets', 0, 'actions', 0, 'kind'], 'COMMAND'],
    ['source action command key', ['data', 'widgets', 0, 'actions', 0, 'commandKey'], 'approve'],
    [
      'external source action route',
      ['data', 'widgets', 0, 'actions', 0, 'sourceRoute'],
      'https://example.test',
    ],
    [
      'dot-segment source action route',
      ['data', 'widgets', 0, 'actions', 0, 'sourceRoute'],
      '/work/../admin',
    ],
    ['protocol-relative app route', ['data', 'appDock', 0, 'apps', 0, 'sourceRoute'], '//evil'],
    [
      'backslash announcement route',
      ['data', 'shell', 'announcements', 0, 'sourceRoute'],
      '/\\evil',
    ],
    [
      'control governance route',
      ['data', 'widgets', 0, 'governance', 'sourceRoute'],
      '/admin\u0000',
    ],
    [
      'external background route',
      ['data', 'shell', 'backgroundAssetRoute'],
      'https://example.test',
    ],
  ] as const)('rejects %s in the Wave 4 read-only model', (_label, path, value) => {
    const fixture = responseFixture();
    setFixturePath(fixture, path, value);
    expect(() => parseHomeV2ReadModel(fixture)).toThrow('Home v2 response is invalid');
  });

  it('admits a structurally exact command only in command canary data', () => {
    const fixture = responseFixture('COMMAND_CANARY');
    const widget = (
      (fixture.data as Record<string, unknown>).widgets as Record<string, unknown>[]
    )[0]!;
    widget.definitionKey = 'core.workspace.daily-brief';
    widget.definitionVersion = '1.0.0';
    widget.actions = [
      {
        actionId: 'dismiss-recommendation',
        commandKey: 'home.recommendation.dismiss',
        expectedResultVersion: 'approval-12',
        kind: 'COMMAND',
        labelKey: 'home.action.dismissRecommendation',
        requiresConfirmation: true,
        sourceRoute: null,
      },
    ];

    expect(parseHomeV2ReadModel(fixture).widgets[0]?.actions[0]).toMatchObject({
      actionId: 'dismiss-recommendation',
      kind: 'COMMAND',
    });

    setFixturePath(fixture, ['data', 'runtime', 'state'], 'READ_ONLY_ACTIVE');
    setFixturePath(fixture, ['data', 'runtime', 'commandsEnabled'], false);
    expect(() => parseHomeV2ReadModel(fixture)).toThrow('data.widgets.actions');
  });

  it('rejects a structurally valid command outside the exact owner allowlist', () => {
    const fixture = responseFixture('COMMAND_CANARY');
    const widget = (
      (fixture.data as Record<string, unknown>).widgets as Record<string, unknown>[]
    )[0]!;
    widget.actions = [
      {
        actionId: 'delete-recommendation',
        commandKey: 'home.recommendation.delete',
        expectedResultVersion: 'approval-12',
        kind: 'COMMAND',
        labelKey: 'home.action.deleteRecommendation',
        requiresConfirmation: true,
        sourceRoute: null,
      },
    ];

    expect(() => parseHomeV2ReadModel(fixture)).toThrow('data.widgets.actions');
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
    groups[1].apps = structuredClone(groups[0].apps);
    expect(() => parseHomeV2ReadModel(fixture)).toThrow('Home v2 response is invalid');
  });

  it('rejects duplicate widget definitions even when their instance IDs differ', () => {
    const fixture = responseFixture();
    const widgets = (fixture.data as Record<string, unknown>).widgets as Array<
      Record<string, unknown>
    >;
    widgets.push({
      ...structuredClone(widgets[0]),
      instanceId: '1a0fc323-b622-4af4-a0fd-9cf7462f8eb5',
    });

    expect(() => parseHomeV2ReadModel(fixture)).toThrow('data.widgets[1].definitionKey');
  });

  it('accepts canonical ordered subsets and isolated tenant extension groups', () => {
    const fixture = responseFixture();
    const groups = (fixture.data as Record<string, unknown>).appDock as unknown[];
    groups.splice(1, 2);
    groups.splice(1, 0, { groupKey: 'TENANT_TOOLS', label: 'Tenant tools', apps: [] });

    expect(parseHomeV2ReadModel(fixture).appDock.map((group) => group.groupKey)).toEqual([
      'WORK_START',
      'TENANT_TOOLS',
      'SYSTEM_CONTROL',
    ]);
  });

  it.each([
    [
      'reordered',
      (groups: unknown[]) => {
        [groups[1], groups[2]] = [groups[2], groups[1]];
      },
    ],
    [
      'unsafe extension',
      (groups: unknown[]) => {
        (groups[2] as Record<string, unknown>).groupKey = 'unknown-group';
      },
    ],
    ['empty', (groups: unknown[]) => groups.splice(0)],
    [
      'more than eight groups',
      (groups: unknown[]) => {
        for (let index = 0; index < 5; index += 1) {
          groups.push({ groupKey: `TENANT_${index}`, label: `Tenant ${index}`, apps: [] });
        }
      },
    ],
  ])('rejects a %s canonical appDock group set', (_label, mutate) => {
    const fixture = responseFixture();
    const groups = (fixture.data as Record<string, unknown>).appDock as unknown[];
    mutate(groups);
    expect(() => parseHomeV2ReadModel(fixture)).toThrow('Home v2 response is invalid');
  });

  it('requires the complete privacy and rollout header contract', () => {
    expect(parseHomeV2ResponseMetadata(responseHeaders('SHADOW'))).toEqual({
      actionAuthority: 'DISABLED',
      cacheControl: 'private, max-age=0, must-revalidate',
      commandsEnabled: false,
      decisionRevision: 'home-route-decision-r1',
      registryAuthoritative: false,
      renderAuthority: 'LEGACY',
      rolloutRing: 'CONTROL',
      rolloutRevision: 'home-wave6-r1',
      runtimeMode: 'SHADOW',
      runtimeState: 'SHADOW_COMPARE',
      vary: 'Accept-Language, X-DWP-Tenant-ID, X-DWP-User-ID, X-DWP-Person-Public-ID, X-DWP-Permissions, X-DWP-Roles, X-DWP-Group-Refs, X-DWP-Current-Decision-Revision, X-DWP-Current-Revalidate-At, X-DWP-Home-Runtime-State, X-DWP-Home-Rollout-Ring, X-DWP-Home-Rollout-Revision',
    });

    const missingRuntime = responseHeaders();
    missingRuntime.delete('X-DWP-Home-Runtime-Mode');
    expect(() => parseHomeV2ResponseMetadata(missingRuntime)).toThrow(
      'headers.X-DWP-Home-Runtime-Mode'
    );

    const incompleteVary = responseHeaders();
    incompleteVary.set('Vary', 'Accept-Language, X-DWP-Tenant-ID');
    expect(() => parseHomeV2ResponseMetadata(incompleteVary)).toThrow('headers.Vary');

    const commandsEnabled = responseHeaders();
    commandsEnabled.set('X-DWP-Home-Commands-Enabled', 'true');
    expect(() => parseHomeV2ResponseMetadata(commandsEnabled)).toThrow(
      'headers.X-DWP-Home-Commands-Enabled'
    );

    const authoritativeRegistry = responseHeaders();
    authoritativeRegistry.set('X-DWP-Widget-Registry-Authoritative', 'true');
    expect(parseHomeV2ResponseMetadata(authoritativeRegistry).registryAuthoritative).toBe(true);

    const disabledRuntime = responseHeaders();
    disabledRuntime.set('X-DWP-Home-Runtime-Mode', 'DISABLED');
    expect(() => parseHomeV2ResponseMetadata(disabledRuntime)).toThrow(
      'headers.X-DWP-Home-Runtime-Mode'
    );

    const missingState = responseHeaders();
    missingState.delete('X-DWP-Home-Runtime-State');
    expect(() => parseHomeV2ResponseMetadata(missingState)).toThrow(
      'headers.X-DWP-Home-Runtime-State'
    );

    const missingDecisionRevision = responseHeaders();
    missingDecisionRevision.delete('X-DWP-Decision-Revision');
    expect(() => parseHomeV2ResponseMetadata(missingDecisionRevision)).toThrow(
      'headers.X-DWP-Decision-Revision'
    );

    for (const name of ['X-DWP-Home-Rollout-Ring', 'X-DWP-Home-Rollout-Revision']) {
      const missing = responseHeaders();
      missing.delete(name);
      expect(() => parseHomeV2ResponseMetadata(missing)).toThrow(`headers.${name}`);
    }

    const malformedRevision = responseHeaders();
    malformedRevision.set('X-DWP-Home-Rollout-Revision', 'tenant secret/revision');
    expect(() => parseHomeV2ResponseMetadata(malformedRevision)).toThrow(
      'headers.X-DWP-Home-Rollout-Revision'
    );

    const normalizedStateDrift = responseHeaders();
    normalizedStateDrift.set('X-DWP-Home-Runtime-State', 'read_only_active');
    expect(() => parseHomeV2ResponseMetadata(normalizedStateDrift)).toThrow(
      'headers.X-DWP-Home-Runtime-State'
    );

    const commandCanary = responseHeaders();
    commandCanary.set('X-DWP-Home-Runtime-State', 'COMMAND_CANARY');
    commandCanary.set('X-DWP-Home-Commands-Enabled', 'true');
    expect(parseHomeV2ResponseMetadata(commandCanary)).toMatchObject({
      actionAuthority: 'EXACT_ALLOWLIST',
      runtimeState: 'COMMAND_CANARY',
    });
  });

  it('owns the conditional snapshot at the caller and sends the canonical query', async () => {
    const model = parseHomeV2ReadModel(responseFixture());
    const previous = { data: model, etag: '"home-change-7"' };
    const getConditional = vi.spyOn(axiosInstance, 'getConditional').mockResolvedValue({
      headers: responseHeaders('ACTIVE', '"home-change-7"'),
      snapshot: previous,
      status: 304,
      notModified: true,
    });

    const result = await getHomeV2(
      {
        deviceClass: 'DESKTOP_STANDARD',
        mode: 'CLASSIC',
        timeZone: 'Asia/Seoul',
      },
      previous
    );

    expect(getConditional).toHaveBeenCalledWith(
      '/api/platform/v2/home?deviceClass=DESKTOP_STANDARD&timeZone=Asia%2FSeoul&mode=CLASSIC',
      previous,
      expect.objectContaining({ timeoutMs: 10_000 })
    );
    expect(getConditional.mock.calls[0]?.[2]?.contextScopeKey).toBeUndefined();
    expect(result).toMatchObject({
      status: 304,
      notModified: true,
      metadata: { runtimeMode: 'ACTIVE' },
    });
    expect(result.snapshot.data).toBe(model);
  });

  it('rejects a 304 when rollout authority changed without a decision-bound ETag', async () => {
    const model = parseHomeV2ReadModel(responseFixture());
    const previous = { data: model, etag: '"home-change-8"' };
    const headers = responseHeaders('ACTIVE', previous.etag);
    headers.set('X-DWP-Home-Runtime-State', 'COMMAND_CANARY');
    headers.set('X-DWP-Home-Commands-Enabled', 'true');
    vi.spyOn(axiosInstance, 'getConditional').mockResolvedValue({
      headers,
      snapshot: previous,
      status: 304,
      notModified: true,
    });

    await expect(
      getHomeV2({ deviceClass: 'DESKTOP_STANDARD', timeZone: 'Asia/Seoul' }, previous)
    ).rejects.toThrow('data.runtime');
  });

  it('parses a fresh 200 before storing the privacy-bound snapshot', async () => {
    vi.spyOn(axiosInstance, 'getConditional').mockResolvedValue({
      headers: responseHeaders('SHADOW'),
      snapshot: { data: responseFixture('SHADOW_COMPARE'), etag: '"home-change-8"' },
      status: 200,
      notModified: false,
    });

    const result = await getHomeV2({
      deviceClass: 'DESKTOP_STANDARD',
      timeZone: 'Asia/Seoul',
    });

    expect(result.snapshot).toEqual({
      data: expect.objectContaining({ schemaVersion: 3 }),
      etag: '"home-change-8"',
    });
    expect(result.metadata.runtimeMode).toBe('SHADOW');
  });

  it.each([
    ['body runtime', ['data', 'runtime', 'rolloutRevision'], 'different-revision'],
    ['registry body/header authority', ['data', 'registryMode'], 'AUTHORITATIVE'],
  ] as const)('rejects a fresh response with a %s mismatch', async (_label, path, value) => {
    const fixture = responseFixture();
    setFixturePath(fixture, path, value);
    vi.spyOn(axiosInstance, 'getConditional').mockResolvedValue({
      headers: responseHeaders(),
      snapshot: { data: fixture, etag: '"home-change-8"' },
      status: 200,
      notModified: false,
    });

    await expect(
      getHomeV2({ deviceClass: 'DESKTOP_STANDARD', timeZone: 'Asia/Seoul' })
    ).rejects.toThrow('Home v2 response is invalid');
  });

  it.each(['200', '304'] as const)('rejects a %s response with a stripped ETag', async (status) => {
    const parsed = parseHomeV2ReadModel(responseFixture());
    const previous = { data: parsed, etag: '"home-change-8"' };
    const headers = responseHeaders();
    headers.delete('ETag');
    vi.spyOn(axiosInstance, 'getConditional').mockResolvedValue({
      headers,
      snapshot: status === '200' ? { data: responseFixture(), etag: '"home-change-8"' } : previous,
      status: status === '200' ? 200 : 304,
      notModified: status === '304',
    });

    await expect(
      getHomeV2(
        { deviceClass: 'DESKTOP_STANDARD', timeZone: 'Asia/Seoul' },
        status === '304' ? previous : undefined
      )
    ).rejects.toThrow('headers.ETag');
  });

  it('rejects a fresh response for a different requested device or mode', async () => {
    const getConditional = vi.spyOn(axiosInstance, 'getConditional').mockResolvedValue({
      headers: responseHeaders(),
      snapshot: { data: responseFixture(), etag: '"home-change-8"' },
      status: 200,
      notModified: false,
    });

    await expect(
      getHomeV2({ deviceClass: 'MOBILE_STANDARD', timeZone: 'Asia/Seoul' })
    ).rejects.toThrow('data.view.deviceClass');
    await expect(
      getHomeV2({ deviceClass: 'DESKTOP_STANDARD', mode: 'FLOW_V1', timeZone: 'Asia/Seoul' })
    ).rejects.toThrow('data.mode');
    expect(getConditional).toHaveBeenCalledTimes(2);
  });

  it('rejects a cross-variant previous snapshot before sending its ETag', async () => {
    const previous = {
      data: parseHomeV2ReadModel(responseFixture()),
      etag: '"home-change-8"',
    };
    const getConditional = vi.spyOn(axiosInstance, 'getConditional');

    await expect(
      getHomeV2({ deviceClass: 'MOBILE_STANDARD', timeZone: 'Asia/Seoul' }, previous)
    ).rejects.toThrow('data.view.deviceClass');
    await expect(
      getHomeV2(
        { deviceClass: 'DESKTOP_STANDARD', mode: 'FLOW_V1', timeZone: 'Asia/Seoul' },
        previous
      )
    ).rejects.toThrow('data.mode');
    expect(getConditional).not.toHaveBeenCalled();
  });
});
