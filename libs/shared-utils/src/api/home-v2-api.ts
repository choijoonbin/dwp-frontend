import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';

import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ConditionalHttpSnapshot } from '../http-conditional';
import type { HomeDeviceClass, HomeDeviceLayoutOverlay } from './home-personalization-api';
import type { HomeExperienceVariant } from './home-experience-api';
import type {
  HomePreferenceLayout,
  HomePresentation,
  HomeWidgetHeight,
  HomeWidgetSize,
} from './home-preference-api';

type GeneratedHomeReadModel = GatewayComponents['schemas']['platform_HomeReadModel'];

export type HomeV2RuntimeMode = 'ACTIVE' | 'SHADOW';
export type HomeV2WidgetState =
  'AVAILABLE' | 'EMPTY' | 'PARTIAL' | 'FORBIDDEN' | 'UNAVAILABLE' | 'STALE';
export type HomeV2BadgeState = 'NOT_REQUESTED' | 'AVAILABLE' | 'UNAVAILABLE' | 'FORBIDDEN';
export type HomeV2RegistryMode = 'STATIC' | 'SHADOW' | 'AUTHORITATIVE';

export type HomeV2Action = Readonly<{
  actionId: string;
  commandKey: string | null;
  expectedResultVersion: string | null;
  kind: 'SOURCE_ROUTE' | 'COMMAND';
  labelKey: string;
  requiresConfirmation: boolean;
  sourceRoute: string | null;
}>;

export type HomeV2Widget = Readonly<{
  actions: readonly HomeV2Action[];
  definitionKey: string;
  definitionManifestHash: string;
  definitionVersion: string;
  governance: Readonly<{
    classification: string;
    owner: string;
    requiredAuthorities: readonly string[];
    retention: string;
    sourceAppResourceKey: string;
    sourceRoute: string;
  }>;
  instanceId: string;
  payload: Readonly<Record<string, unknown>>;
  redactions: readonly string[];
  rendererBindingRevision: string;
  rendererKey: string;
  source: Readonly<{
    expiresAt: string;
    generatedAt: string;
    lastSuccessAt: string | null;
    reasonCode: string | null;
    resultVersion: string | null;
    retryable: boolean;
    sourceKey: string;
  }>;
  state: HomeV2WidgetState;
}>;

export type HomeV2AppEntry = Readonly<{
  appKey: string;
  badge: Readonly<{ total: number; urgent: number; version: string }> | null;
  badgeState: HomeV2BadgeState;
  iconKey: string;
  label: string;
  sourceRoute: string;
}>;

export type HomeV2ReadModel = Readonly<{
  appDock: readonly Readonly<{
    apps: readonly HomeV2AppEntry[];
    groupKey: string;
    label: string;
  }>[];
  changeVersion: string;
  expiresAt: string;
  generatedAt: string;
  mode: HomeExperienceVariant;
  partial: boolean;
  registryMode: HomeV2RegistryMode;
  schemaVersion: 2;
  shell: Readonly<{
    announcements: readonly Readonly<{
      dueAt: string | null;
      id: string;
      kind: string;
      sourceRoute: string;
      title: string;
    }>[];
    backgroundAssetRoute: string | null;
    contentAlignment: string;
    density: string;
    headline: string;
    subheadline: string;
  }>;
  unavailableSources: readonly string[];
  view: Readonly<{
    composition: HomePreferenceLayout<string>;
    deviceClass: HomeDeviceClass;
    deviceOverlay: HomeDeviceLayoutOverlay | null;
    mode: HomeExperienceVariant;
    revision: number;
    source: string;
    viewId: string | null;
  }>;
  widgets: readonly HomeV2Widget[];
}>;

export type HomeV2ResponseMetadata = Readonly<{
  cacheControl: 'private, max-age=0, must-revalidate';
  commandsEnabled: boolean;
  registryAuthoritative: boolean;
  runtimeMode: HomeV2RuntimeMode;
  vary: string;
}>;

export type HomeV2ReadResult = Readonly<{
  metadata: HomeV2ResponseMetadata;
  notModified: boolean;
  snapshot: ConditionalHttpSnapshot<HomeV2ReadModel>;
  status: 200 | 304;
}>;

export type HomeV2ReadInput = Readonly<{
  deviceClass: HomeDeviceClass;
  mode?: HomeExperienceVariant;
  signal?: AbortSignal;
  timeZone: string;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const BADGE_VERSION_PATTERN = /^(?:0|[1-9]\d{0,39})$/u;
const OFFSET_TIMESTAMP_PATTERN = /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const HOME_MODES = new Set<HomeExperienceVariant>(['CLASSIC', 'FLOW_V1']);
const HOME_APP_DOCK_GROUP_KEYS = [
  'WORK_START',
  'COLLABORATION',
  'PEOPLE_SERVICES',
  'SYSTEM_CONTROL',
] as const;
const HOME_APP_DOCK_GROUP_ORDER = new Map(
  HOME_APP_DOCK_GROUP_KEYS.map((groupKey, index) => [groupKey, index] as const)
);
const HOME_APP_DOCK_GROUP_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/u;
const HOME_DEVICES = new Set<HomeDeviceClass>([
  'DESKTOP_WIDE',
  'DESKTOP_STANDARD',
  'MOBILE_STANDARD',
  'MOBILE_COMPACT',
]);
const WIDGET_STATES = new Set<HomeV2WidgetState>([
  'AVAILABLE',
  'EMPTY',
  'PARTIAL',
  'FORBIDDEN',
  'UNAVAILABLE',
  'STALE',
]);
const BADGE_STATES = new Set<HomeV2BadgeState>([
  'NOT_REQUESTED',
  'AVAILABLE',
  'UNAVAILABLE',
  'FORBIDDEN',
]);
const REGISTRY_MODES = new Set<HomeV2RegistryMode>(['STATIC', 'SHADOW', 'AUTHORITATIVE']);
const HOME_V2_VARY_TOKENS = new Set([
  'accept-language',
  'x-dwp-tenant-id',
  'x-dwp-user-id',
  'x-dwp-person-public-id',
  'x-dwp-permissions',
  'x-dwp-roles',
  'x-dwp-group-refs',
  'x-dwp-current-decision-revision',
]);
const HOME_PRESENTATIONS = new Set<HomePresentation>(['balanced', 'expressive', 'focused']);
const HOME_WIDGET_SIZES = new Set<HomeWidgetSize>([
  'fifth',
  'quarter',
  'compact',
  'medium',
  'large',
  'full',
]);
const HOME_WIDGET_HEIGHTS = new Set<HomeWidgetHeight>(['short', 'standard', 'tall', 'expanded']);

function invalid(path: string): never {
  throw new HttpError(`Home v2 response is invalid at ${path}.`, 502);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path);
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, nullable = false): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > 1000) invalid(path);
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(path);
  return value;
}

function count(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid(path);
  return value;
}

function timestamp(value: unknown, path: string, nullable = false): string | null {
  const candidate = string(value, path, nullable);
  if (candidate === null) return null;
  if (!OFFSET_TIMESTAMP_PATTERN.test(candidate) || !Number.isFinite(Date.parse(candidate))) {
    invalid(path);
  }
  return candidate;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value) || value.length > 500) invalid(path);
  return value;
}

function strings(value: unknown, path: string): string[] {
  return array(value, path).map((item, index) => string(item, `${path}[${index}]`) as string);
}

function enumValue<T extends string>(value: unknown, values: ReadonlySet<T>, path: string): T {
  if (typeof value !== 'string' || !values.has(value as T)) invalid(path);
  return value as T;
}

function optionalNullableString(record: Record<string, unknown>, key: string, path: string) {
  return record[key] === undefined ? null : string(record[key], `${path}.${key}`, true);
}

function internalRoute(value: unknown, path: string, nullable = false): string | null {
  const route = string(value, path, nullable);
  if (route === null) return null;
  if (
    !route.startsWith('/') ||
    route.startsWith('//') ||
    [...route].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return character === '\\' || code <= 31 || code === 127;
    })
  ) {
    invalid(path);
  }
  return route;
}

function optionalNullableRoute(record: Record<string, unknown>, key: string, path: string) {
  return record[key] === undefined ? null : internalRoute(record[key], `${path}.${key}`, true);
}

function parseLayout(value: unknown): HomePreferenceLayout<string> {
  const layout = object(value, 'data.view.composition');
  const widgets = array(layout.widgets, 'data.view.composition.widgets').map((item, index) => {
    const widget = object(item, `data.view.composition.widgets[${index}]`);
    return {
      widgetKey: string(widget.widgetKey, `data.view.composition.widgets[${index}].widgetKey`)!,
      visible: boolean(widget.visible, `data.view.composition.widgets[${index}].visible`),
      size:
        widget.size === undefined || widget.size === null
          ? null
          : enumValue(
              widget.size,
              HOME_WIDGET_SIZES,
              `data.view.composition.widgets[${index}].size`
            ),
      height:
        widget.height === undefined || widget.height === null
          ? null
          : enumValue(
              widget.height,
              HOME_WIDGET_HEIGHTS,
              `data.view.composition.widgets[${index}].height`
            ),
    };
  });
  if (new Set(widgets.map((widget) => widget.widgetKey)).size !== widgets.length) {
    invalid('data.view.composition.widgets');
  }
  return {
    appLayout: layout.appLayout ?? null,
    presentation:
      layout.presentation === undefined || layout.presentation === null
        ? null
        : enumValue(layout.presentation, HOME_PRESENTATIONS, 'data.view.composition.presentation'),
    widgets,
  };
}

function parseDeviceOverlay(value: unknown): HomeDeviceLayoutOverlay | null {
  if (value === undefined || value === null) return null;
  const overlay = object(value, 'data.view.deviceOverlay');
  const sizes = object(overlay.widgetSizes, 'data.view.deviceOverlay.widgetSizes');
  const widgetOrder = strings(overlay.widgetOrder, 'data.view.deviceOverlay.widgetOrder');
  if (new Set(widgetOrder).size !== widgetOrder.length) {
    invalid('data.view.deviceOverlay.widgetOrder');
  }
  return {
    density: enumValue(
      overlay.density,
      new Set<HomeDeviceLayoutOverlay['density']>(['comfortable', 'compact']),
      'data.view.deviceOverlay.density'
    ),
    widgetOrder,
    widgetSizes: Object.fromEntries(
      Object.entries(sizes).map(([key, value]) => [
        key,
        enumValue(value, HOME_WIDGET_SIZES, `data.view.deviceOverlay.widgetSizes.${key}`),
      ])
    ),
  };
}

function parseAction(value: unknown, index: number): HomeV2Action {
  const path = `data.widgets.actions[${index}]`;
  const action = object(value, path);
  const kind = enumValue(
    action.kind,
    new Set(['SOURCE_ROUTE', 'COMMAND'] as const),
    `${path}.kind`
  );
  const commandKey = optionalNullableString(action, 'commandKey', path);
  const expectedResultVersion = optionalNullableString(action, 'expectedResultVersion', path);
  const sourceRoute = internalRoute(action.sourceRoute, `${path}.sourceRoute`, true);
  if (
    kind !== 'SOURCE_ROUTE' ||
    commandKey !== null ||
    expectedResultVersion !== null ||
    !sourceRoute
  ) {
    invalid(path);
  }
  return {
    actionId: string(action.actionId, `${path}.actionId`)!,
    commandKey,
    expectedResultVersion,
    kind,
    labelKey: string(action.labelKey, `${path}.labelKey`)!,
    requiresConfirmation: boolean(action.requiresConfirmation, `${path}.requiresConfirmation`),
    sourceRoute,
  };
}

function parseWidget(value: unknown, index: number): HomeV2Widget {
  const path = `data.widgets[${index}]`;
  const widget = object(value, path);
  const governance = object(widget.governance, `${path}.governance`);
  const source = object(widget.source, `${path}.source`);
  const instanceId = string(widget.instanceId, `${path}.instanceId`)!;
  if (!UUID_PATTERN.test(instanceId)) invalid(`${path}.instanceId`);
  return {
    actions: array(widget.actions, `${path}.actions`).map(parseAction),
    definitionKey: string(widget.definitionKey, `${path}.definitionKey`)!,
    definitionManifestHash: string(
      widget.definitionManifestHash,
      `${path}.definitionManifestHash`
    )!,
    definitionVersion: string(widget.definitionVersion, `${path}.definitionVersion`)!,
    governance: {
      classification: string(governance.classification, `${path}.governance.classification`)!,
      owner: string(governance.owner, `${path}.governance.owner`)!,
      requiredAuthorities: strings(
        governance.requiredAuthorities,
        `${path}.governance.requiredAuthorities`
      ),
      retention: string(governance.retention, `${path}.governance.retention`)!,
      sourceAppResourceKey: string(
        governance.sourceAppResourceKey,
        `${path}.governance.sourceAppResourceKey`
      )!,
      sourceRoute: internalRoute(governance.sourceRoute, `${path}.governance.sourceRoute`)!,
    },
    instanceId,
    payload: object(widget.payload, `${path}.payload`),
    redactions: strings(widget.redactions, `${path}.redactions`),
    rendererBindingRevision: string(
      widget.rendererBindingRevision,
      `${path}.rendererBindingRevision`
    )!,
    rendererKey: string(widget.rendererKey, `${path}.rendererKey`)!,
    source: {
      expiresAt: timestamp(source.expiresAt, `${path}.source.expiresAt`)!,
      generatedAt: timestamp(source.generatedAt, `${path}.source.generatedAt`)!,
      lastSuccessAt: timestamp(source.lastSuccessAt, `${path}.source.lastSuccessAt`, true),
      reasonCode: optionalNullableString(source, 'reasonCode', `${path}.source`),
      resultVersion: optionalNullableString(source, 'resultVersion', `${path}.source`),
      retryable: boolean(source.retryable, `${path}.source.retryable`),
      sourceKey: string(source.sourceKey, `${path}.source.sourceKey`)!,
    },
    state: enumValue(widget.state, WIDGET_STATES, `${path}.state`),
  };
}

function parseApp(value: unknown, path: string): HomeV2AppEntry {
  const app = object(value, path);
  const badgeState = enumValue(app.badgeState, BADGE_STATES, `${path}.badgeState`);
  let badge: HomeV2AppEntry['badge'] = null;
  if (app.badge !== undefined && app.badge !== null) {
    const rawBadge = object(app.badge, `${path}.badge`);
    badge = {
      total: count(rawBadge.total, `${path}.badge.total`),
      urgent: count(rawBadge.urgent, `${path}.badge.urgent`),
      version: string(rawBadge.version, `${path}.badge.version`)!,
    };
    if (
      badge.urgent > badge.total ||
      badgeState !== 'AVAILABLE' ||
      !BADGE_VERSION_PATTERN.test(badge.version)
    )
      invalid(`${path}.badge`);
  } else if (badgeState === 'AVAILABLE') {
    invalid(`${path}.badge`);
  }
  return {
    appKey: string(app.appKey, `${path}.appKey`)!,
    badge,
    badgeState,
    iconKey: string(app.iconKey, `${path}.iconKey`)!,
    label: string(app.label, `${path}.label`)!,
    sourceRoute: internalRoute(app.sourceRoute, `${path}.sourceRoute`)!,
  };
}

export function parseHomeV2ReadModel(value: unknown): HomeV2ReadModel {
  const envelope = object(value, 'response');
  const data = object(envelope.data, 'data') as GeneratedHomeReadModel & Record<string, unknown>;
  const schemaVersion = count(data.schemaVersion, 'data.schemaVersion');
  if (schemaVersion !== 2) invalid('data.schemaVersion');
  const mode = enumValue(data.mode, HOME_MODES, 'data.mode');
  const view = object(data.view, 'data.view');
  const viewMode = enumValue(view.mode, HOME_MODES, 'data.view.mode');
  if (viewMode !== mode) invalid('data.view.mode');
  const shell = object(data.shell, 'data.shell');
  const groupKeys = new Set<string>();
  const appKeys = new Set<string>();
  const rawAppDock = array(data.appDock, 'data.appDock');
  if (rawAppDock.length < 1 || rawAppDock.length > 8) {
    invalid('data.appDock');
  }
  let previousCanonicalGroupOrder = -1;
  const appDock = rawAppDock.map((item, index) => {
    const path = `data.appDock[${index}]`;
    const group = object(item, path);
    const groupKey = string(group.groupKey, `${path}.groupKey`)!;
    const groupOrder = HOME_APP_DOCK_GROUP_ORDER.get(
      groupKey as (typeof HOME_APP_DOCK_GROUP_KEYS)[number]
    );
    if (!HOME_APP_DOCK_GROUP_KEY_PATTERN.test(groupKey)) invalid(`${path}.groupKey`);
    if (groupOrder !== undefined) {
      if (groupOrder <= previousCanonicalGroupOrder) invalid(`${path}.groupKey`);
      previousCanonicalGroupOrder = groupOrder;
    }
    if (groupKeys.has(groupKey)) invalid(`${path}.groupKey`);
    groupKeys.add(groupKey);
    return {
      apps: array(group.apps, `${path}.apps`).map((app, appIndex) => {
        const parsed = parseApp(app, `${path}.apps[${appIndex}]`);
        if (appKeys.has(parsed.appKey)) invalid(`${path}.apps[${appIndex}].appKey`);
        appKeys.add(parsed.appKey);
        return parsed;
      }),
      groupKey,
      label: string(group.label, `${path}.label`)!,
    };
  });
  const instanceIds = new Set<string>();
  const definitionKeys = new Set<string>();
  const widgets = array(data.widgets, 'data.widgets').map((item, index) => {
    const parsed = parseWidget(item, index);
    if (instanceIds.has(parsed.instanceId)) invalid(`data.widgets[${index}].instanceId`);
    if (definitionKeys.has(parsed.definitionKey)) invalid(`data.widgets[${index}].definitionKey`);
    instanceIds.add(parsed.instanceId);
    definitionKeys.add(parsed.definitionKey);
    return parsed;
  });
  return {
    appDock,
    changeVersion: string(data.changeVersion, 'data.changeVersion')!,
    expiresAt: timestamp(data.expiresAt, 'data.expiresAt')!,
    generatedAt: timestamp(data.generatedAt, 'data.generatedAt')!,
    mode,
    partial: boolean(data.partial, 'data.partial'),
    registryMode: (() => {
      const registryMode = enumValue(data.registryMode, REGISTRY_MODES, 'data.registryMode');
      if (registryMode !== 'SHADOW') invalid('data.registryMode');
      return registryMode;
    })(),
    schemaVersion: 2,
    shell: {
      announcements: array(shell.announcements, 'data.shell.announcements').map((item, index) => {
        const path = `data.shell.announcements[${index}]`;
        const announcement = object(item, path);
        return {
          dueAt: timestamp(announcement.dueAt, `${path}.dueAt`, true),
          id: string(announcement.id, `${path}.id`)!,
          kind: string(announcement.kind, `${path}.kind`)!,
          sourceRoute: internalRoute(announcement.sourceRoute, `${path}.sourceRoute`)!,
          title: string(announcement.title, `${path}.title`)!,
        };
      }),
      backgroundAssetRoute: optionalNullableRoute(shell, 'backgroundAssetRoute', 'data.shell'),
      contentAlignment: string(shell.contentAlignment, 'data.shell.contentAlignment')!,
      density: string(shell.density, 'data.shell.density')!,
      headline: string(shell.headline, 'data.shell.headline')!,
      subheadline: string(shell.subheadline, 'data.shell.subheadline')!,
    },
    unavailableSources: strings(data.unavailableSources, 'data.unavailableSources'),
    view: {
      composition: parseLayout(view.composition),
      deviceClass: enumValue(view.deviceClass, HOME_DEVICES, 'data.view.deviceClass'),
      deviceOverlay: parseDeviceOverlay(view.deviceOverlay),
      mode: viewMode,
      revision: count(view.revision, 'data.view.revision'),
      source: string(view.source, 'data.view.source')!,
      viewId:
        view.viewId === undefined || view.viewId === null
          ? null
          : string(view.viewId, 'data.view.viewId')!,
    },
    widgets,
  };
}

function parseBooleanHeader(headers: Headers, name: string): boolean {
  const value = headers.get(name)?.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  invalid(`headers.${name}`);
}

export function parseHomeV2ResponseMetadata(headers: Headers | undefined): HomeV2ResponseMetadata {
  if (!headers) invalid('headers');
  const cacheControl = headers.get('Cache-Control')?.trim().toLowerCase();
  if (cacheControl !== 'private, max-age=0, must-revalidate') invalid('headers.Cache-Control');
  const runtimeMode = headers.get('X-DWP-Home-Runtime-Mode')?.trim().toUpperCase();
  if (runtimeMode !== 'ACTIVE' && runtimeMode !== 'SHADOW') {
    invalid('headers.X-DWP-Home-Runtime-Mode');
  }
  const vary = headers.get('Vary')?.trim();
  if (!vary) invalid('headers.Vary');
  const varyTokens = vary.split(',').map((token) => token.trim().toLowerCase());
  if (
    varyTokens.length !== HOME_V2_VARY_TOKENS.size ||
    new Set(varyTokens).size !== HOME_V2_VARY_TOKENS.size ||
    varyTokens.some((token) => !HOME_V2_VARY_TOKENS.has(token))
  ) {
    invalid('headers.Vary');
  }
  const commandsEnabled = parseBooleanHeader(headers, 'X-DWP-Home-Commands-Enabled');
  const registryAuthoritative = parseBooleanHeader(headers, 'X-DWP-Widget-Registry-Authoritative');
  if (commandsEnabled) invalid('headers.X-DWP-Home-Commands-Enabled');
  if (registryAuthoritative) invalid('headers.X-DWP-Widget-Registry-Authoritative');
  return {
    cacheControl,
    commandsEnabled,
    registryAuthoritative,
    runtimeMode,
    vary,
  };
}

function assertRequestedHomeVariant(model: HomeV2ReadModel, input: HomeV2ReadInput): void {
  if (model.view.deviceClass !== input.deviceClass) invalid('data.view.deviceClass');
  if (input.mode && (model.mode !== input.mode || model.view.mode !== input.mode)) {
    invalid('data.mode');
  }
}

export async function getHomeV2(
  input: HomeV2ReadInput,
  previous?: ConditionalHttpSnapshot<HomeV2ReadModel>
): Promise<HomeV2ReadResult> {
  if (previous) assertRequestedHomeVariant(previous.data, input);
  const query = new URLSearchParams({
    deviceClass: input.deviceClass,
    timeZone: input.timeZone,
  });
  if (input.mode) query.set('mode', input.mode);
  const response = await axiosInstance.getConditional<unknown>(
    `/api/platform/v2/home?${query.toString()}`,
    previous as ConditionalHttpSnapshot<unknown> | undefined,
    { signal: input.signal, timeoutMs: 10_000 }
  );
  const responseEtag = response.headers?.get('ETag');
  if (!responseEtag || response.snapshot.etag !== responseEtag) invalid('headers.ETag');
  const model = response.notModified
    ? previous?.data
    : parseHomeV2ReadModel(response.snapshot.data);
  if (!model) invalid('response.304');
  assertRequestedHomeVariant(model, input);
  return {
    metadata: parseHomeV2ResponseMetadata(response.headers),
    notModified: response.notModified,
    snapshot: { data: model, etag: response.snapshot.etag },
    status: response.status,
  };
}
