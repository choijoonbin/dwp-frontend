import { Bot, Building2, CalendarCheck2, LibraryBig, MessageSquareText } from 'lucide-react';

import { HOME_WIDGET_REGISTRY, reconcileHomeWidgets } from '../features/home/home-widget-registry';

import type {
  EffectiveWidgetCatalog,
  EffectiveWidgetCatalogItem,
  HomeView,
  HomeWidgetHeight,
  HomeWidgetKey,
  HomeWidgetSize,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { AriaAttributes, ComponentType } from 'react';

type StudioIcon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  'aria-hidden'?: AriaAttributes['aria-hidden'];
}>;

export type StudioCatalogKind = 'native' | 'projection';

export type StudioCatalogItem = Readonly<{
  key: string;
  catalogId: string;
  kind: StudioCatalogKind;
  owner: string;
  source: string;
  permission: string;
  supportedWidths: string;
  dataBudget: string;
  targetRegion: string;
  icon: StudioIcon;
  effectiveState?: EffectiveWidgetCatalogItem['effectiveState'];
  reasonCodes?: EffectiveWidgetCatalogItem['reasonCodes'];
  translatedLabel?: boolean;
  canAdd?: boolean;
  canHide?: boolean;
  canMove?: boolean;
  registryItem?: EffectiveWidgetCatalogItem;
}>;

export const HOME_STUDIO_INSTANCE_CAP = 30;

const nativeMetadata: Readonly<
  Record<HomeWidgetKey, Omit<StudioCatalogItem, 'key' | 'catalogId' | 'kind'>>
> = {
  'command-rail': {
    owner: 'DWP Work',
    source: 'home.contributions.action',
    permission: 'APP.WORK:VIEW',
    supportedWidths: '38% / 34% / 28%',
    dataBudget: '30 s freshness · 24 KB',
    targetRegion: 'Priority canvas · lead',
    icon: HOME_WIDGET_REGISTRY[0]!.icon,
  },
  schedule: {
    owner: 'DWP Calendar',
    source: 'home.contributions.timeline',
    permission: 'APP.CALENDAR:VIEW',
    supportedWidths: '38% / 34%',
    dataBudget: '60 s freshness · 16 KB',
    targetRegion: 'Schedule · lead/support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'schedule')!.icon,
  },
  'daily-brief': {
    owner: 'DWP Home',
    source: 'home.recommendations',
    permission: 'HOME:VIEW',
    supportedWidths: '38% / 34% / 28%',
    dataBudget: '5 min freshness · 20 KB',
    targetRegion: 'Brief · support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'daily-brief')!.icon,
  },
  focus: {
    owner: 'DWP Services',
    source: 'home.requests',
    permission: 'APP.EMPLOYEE_SERVICES:VIEW',
    supportedWidths: '34% / 28%',
    dataBudget: '5 min freshness · 12 KB',
    targetRegion: 'Requests · support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'focus')!.icon,
  },
  activity: {
    owner: 'DWP Activity',
    source: 'home.activity',
    permission: 'APP.ACTIVITY:VIEW',
    supportedWidths: '38% / 34%',
    dataBudget: '2 min freshness · 24 KB',
    targetRegion: 'Activity · lead/support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'activity')!.icon,
  },
  'focus-balance': {
    owner: 'DWP Calendar',
    source: 'calendar.focus-insight',
    permission: 'APP.CALENDAR:VIEW',
    supportedWidths: '34% / 28%',
    dataBudget: '5 min freshness · 8 KB',
    targetRegion: 'Insight · support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'focus-balance')!.icon,
  },
  'meeting-load': {
    owner: 'DWP Calendar',
    source: 'calendar.meeting-load',
    permission: 'APP.CALENDAR:VIEW',
    supportedWidths: '34% / 28%',
    dataBudget: '5 min freshness · 8 KB',
    targetRegion: 'Insight · support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'meeting-load')!.icon,
  },
};

function nativeCatalogItem(key: HomeWidgetKey, catalogId: string): StudioCatalogItem {
  return {
    key,
    catalogId,
    kind: 'native',
    translatedLabel: true,
    canAdd: true,
    canHide: true,
    canMove: true,
    ...nativeMetadata[key],
  };
}

export const HOME_STUDIO_CATALOG: readonly StudioCatalogItem[] = [
  nativeCatalogItem('schedule', 'meetings.next-prep'),
  {
    catalogId: 'meetings.decisions',
    key: 'meetings-prep-decisions',
    kind: 'projection',
    owner: 'DWP Meetings',
    source: 'meetings.decisions',
    permission: 'APP.MEETINGS:VIEW',
    supportedWidths: '38% / 34%',
    dataBudget: 'Preview only · provider required',
    targetRegion: 'Meeting preparation · lead',
    icon: CalendarCheck2,
  },
  {
    catalogId: 'space.feed',
    key: 'space-change-feed',
    kind: 'projection',
    owner: 'DWP Space',
    source: 'space.change-feed',
    permission: 'APP.SPACES:VIEW',
    supportedWidths: '38% / 34%',
    dataBudget: 'Preview only · provider required',
    targetRegion: 'Collaboration feed · lead',
    icon: MessageSquareText,
  },
  {
    catalogId: 'dwai.artifacts',
    key: 'dwaion-artifact',
    kind: 'projection',
    owner: 'DWAI·ON',
    source: 'dwaion.artifact',
    permission: 'APP.DWAION_ARTIFACTS:VIEW',
    supportedWidths: '34% / 28%',
    dataBudget: 'Preview only · provider required',
    targetRegion: 'AI continuation · support',
    icon: Bot,
  },
  {
    catalogId: 'workplace.status',
    key: 'workplace-booking',
    kind: 'projection',
    owner: 'DWP Workplace',
    source: 'workplace.booking',
    permission: 'APP.WORKPLACE:VIEW',
    supportedWidths: '34% / 28%',
    dataBudget: 'Preview only · provider required',
    targetRegion: 'Workplace status · support',
    icon: Building2,
  },
  {
    catalogId: 'hr.learning',
    key: 'learning-progress',
    kind: 'projection',
    owner: 'DWP People',
    source: 'hr.edu',
    permission: 'APP.HCM:VIEW',
    supportedWidths: '34% / 28%',
    dataBudget: 'Preview only · provider required',
    targetRegion: 'Learning progress · support',
    icon: HOME_WIDGET_REGISTRY.find(({ key }) => key === 'focus')!.icon,
  },
  nativeCatalogItem('focus', 'services.requests'),
  nativeCatalogItem('daily-brief', 'security.bulletin'),
  nativeCatalogItem('command-rail', 'home.priority-queue'),
  nativeCatalogItem('activity', 'home.role-activity'),
  nativeCatalogItem('focus-balance', 'calendar.focus-balance'),
  nativeCatalogItem('meeting-load', 'calendar.meeting-load'),
] as const;

const SAFE_FALLBACK_CATALOG: readonly StudioCatalogItem[] = HOME_STUDIO_CATALOG.map((item) => ({
  ...item,
  canAdd: false,
  canHide: false,
  canMove: false,
  effectiveState: 'DENY',
  reasonCodes: ['TEMPORARILY_UNAVAILABLE'],
}));

export function isNativeWidgetKey(value: string | null): value is HomeWidgetKey {
  return Boolean(value && HOME_WIDGET_REGISTRY.some(({ key }) => key === value));
}

function registryCatalogItem(
  item: EffectiveWidgetCatalogItem,
  legacyPlacementWrite: boolean,
  instanceV6Write: boolean
): StudioCatalogItem {
  const available = item.effectiveState === 'AVAILABLE' && Boolean(item.resolvedVersionId);
  if (isNativeWidgetKey(item.legacyWidgetKey)) {
    return {
      ...nativeCatalogItem(item.legacyWidgetKey, item.definitionKey),
      effectiveState: item.effectiveState,
      reasonCodes: item.reasonCodes,
      canAdd: available && legacyPlacementWrite && item.placementCapabilities.canAdd,
      canHide: item.placementCapabilities.canHide,
      canMove: item.placementCapabilities.canMove,
      permission: item.reasonCodes.join(', ') || item.effectiveState,
    };
  }
  return {
    key: item.definitionKey,
    catalogId: item.definitionKey,
    kind: 'projection',
    owner: item.definitionKey.split('.').slice(0, 2).join('.') || 'REGISTRY',
    source: item.semanticVersion ?? item.resolvedVersionId ?? 'UNRESOLVED',
    permission: item.reasonCodes.join(', ') || item.effectiveState,
    supportedWidths: item.placementCapabilities.canResize ? 'RESIZABLE' : 'FIXED',
    dataBudget: 'SERVER_EFFECTIVE_CATALOG',
    targetRegion: item.effectiveState,
    icon: LibraryBig,
    effectiveState: item.effectiveState,
    reasonCodes: item.reasonCodes,
    translatedLabel: false,
    canAdd: available && instanceV6Write && item.placementCapabilities.canAdd,
    canHide: instanceV6Write && item.placementCapabilities.canHide,
    canMove: instanceV6Write && item.placementCapabilities.canMove,
    registryItem: item,
  };
}

const registryReasonKeys = new Set([
  'NOT_AVAILABLE',
  'DISABLED_BY_ORGANIZATION',
  'APP_ACCESS_REQUIRED',
  'INCOMPATIBLE',
  'TEMPORARILY_UNAVAILABLE',
  'DEPRECATED',
  'AVAILABLE',
  'ALREADY_ADDED',
]);

const registryStateKeys = new Set(['AVAILABLE', 'ALREADY_ADDED', 'DEPRECATED', 'DENY']);

export function homeStudioRegistryReasonKey(reason: string): string {
  return registryReasonKeys.has(reason) ? reason : 'UNKNOWN';
}

export function homeStudioRegistryStateKey(state: string): string {
  return registryStateKeys.has(state) ? state : 'UNKNOWN';
}

export function resolveHomeStudioCatalog(
  effectiveCatalog: EffectiveWidgetCatalog | undefined,
  mode: HomeView['modeKey'] | undefined
): readonly StudioCatalogItem[] {
  if (!effectiveCatalog) return SAFE_FALLBACK_CATALOG;
  const placementContext = mode === 'FLOW_V1' ? 'FLOW_PERSONAL' : 'CLASSIC_PERSONAL';
  const context = effectiveCatalog.contexts.find(
    (candidate) => candidate.placementContext === placementContext
  );
  if (!context?.capabilities.libraryRead) return SAFE_FALLBACK_CATALOG;
  return context.items.map((item) =>
    registryCatalogItem(
      item,
      context.capabilities.legacyPlacementWrite,
      context.capabilities.instanceV6Write
    )
  );
}

const widgetSizes = new Set<HomeWidgetSize>([
  'fifth',
  'quarter',
  'compact',
  'medium',
  'large',
  'full',
]);
const widgetHeights = new Set<HomeWidgetHeight>(['short', 'standard', 'tall', 'expanded']);

function preservedPreference(
  candidate: Record<string, unknown>
): PersonalHomeWidgetPreference<string> | null {
  if (typeof candidate.widgetKey !== 'string' || !candidate.widgetKey) return null;
  return {
    widgetKey: candidate.widgetKey,
    visible: candidate.visible !== false,
    ...(widgetSizes.has(candidate.size as HomeWidgetSize)
      ? { size: candidate.size as HomeWidgetSize }
      : {}),
    ...(widgetHeights.has(candidate.height as HomeWidgetHeight)
      ? { height: candidate.height as HomeWidgetHeight }
      : {}),
  };
}

export function reconcileStudioWidgets(value: unknown): PersonalHomeWidgetPreference<string>[] {
  const native = reconcileHomeWidgets(value);
  const nativeByKey = new Map(native.map((item) => [item.widgetKey, item]));
  const seen = new Set<string>();
  const reconciled: PersonalHomeWidgetPreference<string>[] = [];
  if (Array.isArray(value)) {
    value.forEach((candidate) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return;
      const preserved = preservedPreference(candidate as Record<string, unknown>);
      if (!preserved || seen.has(preserved.widgetKey)) return;
      seen.add(preserved.widgetKey);
      reconciled.push(nativeByKey.get(preserved.widgetKey as HomeWidgetKey) ?? preserved);
    });
  }
  native.forEach((item) => {
    if (!seen.has(item.widgetKey)) reconciled.push(item);
  });
  return reconciled;
}

export function moveStudioWidget<WidgetKey extends string>(
  widgets: readonly PersonalHomeWidgetPreference<WidgetKey>[],
  widgetKey: WidgetKey,
  direction: -1 | 1
): PersonalHomeWidgetPreference<WidgetKey>[] {
  const index = widgets.findIndex((widget) => widget.widgetKey === widgetKey);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= widgets.length) return [...widgets];
  const next = [...widgets];
  const [widget] = next.splice(index, 1);
  if (!widget) return [...widgets];
  next.splice(target, 0, widget);
  return next;
}

export function homeStudioWidgetsEqual(
  left: readonly PersonalHomeWidgetPreference<string>[],
  right: readonly PersonalHomeWidgetPreference<string>[]
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
