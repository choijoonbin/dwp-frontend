import { Activity, CalendarRange, Inbox, ListTodo } from 'lucide-react';

import {
  isWorkspaceHomeWidgetSizeAllowed,
  type HomeAudienceProfile,
  type HomeWidgetHeight,
  type HomeWidgetKey,
  type HomeWidgetSize,
  type PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { WorkspaceWidgetDefinition } from '../../../components/workspace-composer/workspace-composer-model';

export type FlowHomeSectionKey = 'today' | 'response-hub' | 'request-tracker' | 'role-pulse';
export type FlowHomeSectionPreference = PersonalHomeWidgetPreference<FlowHomeSectionKey>;

/**
 * Flow V1 keeps using the versioned Classic storage contract until the API
 * migrates its widget keys. Keep this mapping one-to-one: combining aliases
 * loses independent visibility and geometry during a round trip.
 */
export const FLOW_HOME_STORAGE_ALIAS = {
  today: 'schedule',
  'response-hub': 'daily-brief',
  'request-tracker': 'focus',
  'role-pulse': 'activity',
} as const satisfies Record<FlowHomeSectionKey, HomeWidgetKey>;

const FLOW_HOME_SECTION_BY_STORAGE = new Map<HomeWidgetKey, FlowHomeSectionKey>(
  Object.entries(FLOW_HOME_STORAGE_ALIAS).map(([sectionKey, storageKey]) => [
    storageKey,
    sectionKey as FlowHomeSectionKey,
  ])
);

export const FLOW_HOME_MEMBER_SECTION_ORDER: readonly FlowHomeSectionKey[] = [
  'today',
  'response-hub',
  'request-tracker',
  'role-pulse',
];

export const FLOW_HOME_OPERATOR_SECTION_ORDER: readonly FlowHomeSectionKey[] = [
  'role-pulse',
  'today',
  'response-hub',
  'request-tracker',
];

export const FLOW_HOME_SECTION_REGISTRY: readonly WorkspaceWidgetDefinition<FlowHomeSectionKey>[] =
  [
    {
      key: 'today',
      icon: CalendarRange,
      canHide: true,
      defaultSize: 'compact',
      allowedSizes: ['fifth', 'quarter', 'compact', 'medium'],
      defaultHeight: 'standard',
      allowedHeights: ['short', 'standard', 'tall'],
      surface: 'plain',
    },
    {
      key: 'response-hub',
      icon: Inbox,
      canHide: true,
      // The v6 workspace contract adds compact so the response hub can join
      // the three-purpose second row without a fake full-width viewport.
      defaultSize: 'compact',
      allowedSizes: ['compact', 'large', 'full'],
      defaultHeight: 'standard',
      allowedHeights: ['short', 'standard', 'tall'],
      surface: 'plain',
    },
    {
      key: 'request-tracker',
      icon: ListTodo,
      canHide: true,
      defaultSize: 'compact',
      allowedSizes: ['quarter', 'compact', 'medium', 'large', 'full'],
      defaultHeight: 'standard',
      allowedHeights: ['short', 'standard', 'tall'],
      surface: 'plain',
    },
    {
      key: 'role-pulse',
      icon: Activity,
      canHide: true,
      defaultSize: 'compact',
      allowedSizes: ['fifth', 'quarter', 'compact', 'medium'],
      defaultHeight: 'standard',
      allowedHeights: ['short', 'standard', 'tall'],
      surface: 'plain',
    },
  ];

const flowSectionDefinitions = new Map(
  FLOW_HOME_SECTION_REGISTRY.map((definition) => [definition.key, definition])
);

const defaultFlowSectionSize = Object.fromEntries(
  FLOW_HOME_SECTION_REGISTRY.map((definition) => [definition.key, definition.defaultSize])
) as Record<FlowHomeSectionKey, HomeWidgetSize>;

const defaultFlowSectionHeight = Object.fromEntries(
  FLOW_HOME_SECTION_REGISTRY.map((definition) => [definition.key, definition.defaultHeight])
) as Record<FlowHomeSectionKey, HomeWidgetHeight>;

/**
 * Adaptive read templates are only eligible while the complete role default
 * remains intact. Height is deliberately excluded: it is a saved content-depth
 * preference, not a placement footprint, and must survive an adaptive render.
 */
export function isFlowAdaptiveTemplateEligible(
  sections: readonly FlowHomeSectionPreference[],
  audience: HomeAudienceProfile
): boolean {
  const expectedOrder =
    audience === 'OPERATOR' ? FLOW_HOME_OPERATOR_SECTION_ORDER : FLOW_HOME_MEMBER_SECTION_ORDER;
  if (sections.length !== expectedOrder.length) return false;
  return sections.every((section, index) => {
    return (
      section.widgetKey === expectedOrder[index] &&
      section.visible &&
      section.size === defaultFlowSectionSize[section.widgetKey]
    );
  });
}

const LEGACY_FLOW_GEOMETRY: Readonly<
  Record<
    FlowHomeSectionKey,
    Readonly<{ sizes: readonly HomeWidgetSize[]; heights: readonly HomeWidgetHeight[] }>
  >
> = {
  today: { sizes: ['quarter', 'compact'], heights: ['standard'] },
  'response-hub': { sizes: ['large', 'full'], heights: ['standard'] },
  'request-tracker': { sizes: ['medium'], heights: ['tall'] },
  'role-pulse': { sizes: ['quarter', 'compact'], heights: ['tall'] },
};

/**
 * Explicit release boundary for the obsolete Flow default geometry. A saved
 * layout newer than this boundary is always treated as an intentional choice,
 * even when it happens to match the old footprint signature.
 */
export const FLOW_HOME_GEOMETRY_V2_MIGRATION_CUTOFF = '2026-08-25T03:52:02.000Z';

export function isFlowLegacyGeometryMigrationEligible(
  schemaVersion: number | null | undefined,
  updatedAt: string | null | undefined
): boolean {
  if (schemaVersion !== 5 || !updatedAt) return false;
  const updated = Date.parse(updatedAt);
  return Number.isFinite(updated) && updated < Date.parse(FLOW_HOME_GEOMETRY_V2_MIGRATION_CUTOFF);
}

/**
 * Flow V1 originally inherited Classic's asymmetric default geometry. Those
 * values look like a deliberate customization after the storage alias
 * migration, even though they are only obsolete product defaults. Normalize
 * that complete signature once at render/edit bootstrap so the new 8+4 /
 * 4+4+4 composition is balanced. Order and visibility are intentionally kept,
 * while any genuinely different footprint remains untouched.
 */
export function normalizeLegacyFlowHomeSections(
  sections: readonly FlowHomeSectionPreference[],
  migrationEligible = false
): FlowHomeSectionPreference[] {
  if (!migrationEligible) return [...sections];
  if (sections.length !== FLOW_HOME_SECTION_REGISTRY.length) return [...sections];
  const bySection = new Map(sections.map((section) => [section.widgetKey, section]));
  const legacySignature = FLOW_HOME_SECTION_REGISTRY.every(({ key }) => {
    const section = bySection.get(key);
    const legacy = LEGACY_FLOW_GEOMETRY[key];
    return (
      section !== undefined &&
      legacy.sizes.includes(section.size as HomeWidgetSize) &&
      legacy.heights.includes(section.height as HomeWidgetHeight)
    );
  });
  if (!legacySignature) return [...sections];
  return sections.map((section) => ({
    ...section,
    size: defaultFlowSectionSize[section.widgetKey],
    height: defaultFlowSectionHeight[section.widgetKey],
  }));
}

function byKey(widgets: readonly PersonalHomeWidgetPreference<string>[]) {
  return new Map(widgets.map((widget) => [widget.widgetKey, widget]));
}

function orderedSectionKeys(
  widgets: readonly PersonalHomeWidgetPreference<string>[]
): FlowHomeSectionKey[] {
  const seen = new Set<FlowHomeSectionKey>();
  const ordered: FlowHomeSectionKey[] = [];
  widgets.forEach((widget) => {
    const sectionKey = FLOW_HOME_SECTION_BY_STORAGE.get(widget.widgetKey as HomeWidgetKey);
    if (!sectionKey || seen.has(sectionKey)) return;
    seen.add(sectionKey);
    ordered.push(sectionKey);
  });
  FLOW_HOME_MEMBER_SECTION_ORDER.forEach((sectionKey) => {
    if (!seen.has(sectionKey)) ordered.push(sectionKey);
  });
  return ordered;
}

function flowSectionSize(
  sectionKey: FlowHomeSectionKey,
  sourceSize: string | null | undefined,
  customized: boolean
): HomeWidgetSize {
  if (!customized) return defaultFlowSectionSize[sectionKey];
  const definition = flowSectionDefinitions.get(sectionKey)!;
  return definition.allowedSizes.includes(sourceSize as HomeWidgetSize)
    ? (sourceSize as HomeWidgetSize)
    : definition.defaultSize;
}

function flowSectionHeight(
  sectionKey: FlowHomeSectionKey,
  sourceHeight: string | null | undefined,
  customized: boolean
): HomeWidgetHeight {
  if (!customized) return defaultFlowSectionHeight[sectionKey];
  // Classic `focus=expanded` predates Flow's three meaningful row budgets.
  // Render it as Flow `tall`, while applyFlowHomeSections preserves the source
  // value so an unrelated Flow edit cannot destroy Classic rollback geometry.
  if (sectionKey === 'request-tracker' && sourceHeight === 'expanded') return 'tall';
  const definition = flowSectionDefinitions.get(sectionKey)!;
  return definition.allowedHeights.includes(sourceHeight as HomeWidgetHeight)
    ? (sourceHeight as HomeWidgetHeight)
    : definition.defaultHeight;
}

export function deriveFlowHomeSections(
  widgets: readonly PersonalHomeWidgetPreference<string>[],
  customized: boolean,
  deviceWidgetSizes: Readonly<Record<string, string>> = {}
): FlowHomeSectionPreference[] {
  const source = byKey(widgets);
  const sections = new Map<FlowHomeSectionKey, FlowHomeSectionPreference>();

  FLOW_HOME_MEMBER_SECTION_ORDER.forEach((sectionKey) => {
    const storageKey = FLOW_HOME_STORAGE_ALIAS[sectionKey];
    const storagePreference = source.get(storageKey);
    const overlaySize = deviceWidgetSizes[sectionKey] ?? deviceWidgetSizes[storageKey];
    sections.set(sectionKey, {
      widgetKey: sectionKey,
      visible: storagePreference?.visible !== false,
      size: flowSectionSize(
        sectionKey,
        overlaySize ?? storagePreference?.size,
        customized || overlaySize !== undefined
      ),
      height: flowSectionHeight(sectionKey, storagePreference?.height, customized),
    });
  });

  // defaultHomeWidgets supplies the role-specific storage order. A customized
  // preference supplies the person's order. Mapping the source slots therefore
  // preserves both contracts without a second role argument at every callsite.
  return orderedSectionKeys(widgets).map((sectionKey) => sections.get(sectionKey)!);
}

function withSectionState<Widget extends PersonalHomeWidgetPreference<string>>(
  widget: Widget,
  section: FlowHomeSectionPreference
): Widget {
  const storageKey = widget.widgetKey as HomeWidgetKey;
  const requestedSize = section.size ?? widget.size;
  const size = isWorkspaceHomeWidgetSizeAllowed(storageKey, requestedSize)
    ? requestedSize
    : isWorkspaceHomeWidgetSizeAllowed(storageKey, widget.size)
      ? widget.size
      : undefined;
  const definition = flowSectionDefinitions.get(section.widgetKey)!;
  const requestedHeight = definition.allowedHeights.includes(section.height as HomeWidgetHeight)
    ? (section.height as HomeWidgetHeight)
    : widget.height;
  const height =
    storageKey === 'focus' && widget.height === 'expanded' && requestedHeight === 'tall'
      ? 'expanded'
      : requestedHeight;
  return {
    ...widget,
    visible: section.visible,
    size,
    height,
  };
}

/**
 * Applies Flow preferences back to legacy storage aliases. Non-Flow entries,
 * including command-rail and forward-compatible unknown widgets, stay in their
 * original slots and retain their object state. This also keeps appLayout out
 * of the migration entirely; the caller persists it unchanged alongside this
 * widget array.
 */
export function applyFlowHomeSections<Widget extends PersonalHomeWidgetPreference<string>>(
  base: readonly Widget[],
  sections: readonly FlowHomeSectionPreference[]
): Widget[] {
  const source = byKey(base);
  const emittedStorageKeys = new Set<HomeWidgetKey>();
  const orderedFlowWidgets: Widget[] = [];

  sections.forEach((section) => {
    const storageKey = FLOW_HOME_STORAGE_ALIAS[section.widgetKey];
    if (emittedStorageKeys.has(storageKey)) return;
    const widget = source.get(storageKey) as Widget | undefined;
    if (!widget) return;
    emittedStorageKeys.add(storageKey);
    orderedFlowWidgets.push(withSectionState(widget, section));
  });

  // Malformed or partially upgraded section arrays must never delete a known
  // preference. Preserve any aliases that were not represented by the editor.
  base.forEach((widget) => {
    const storageKey = widget.widgetKey as HomeWidgetKey;
    if (!FLOW_HOME_SECTION_BY_STORAGE.has(storageKey) || emittedStorageKeys.has(storageKey)) return;
    emittedStorageKeys.add(storageKey);
    orderedFlowWidgets.push(widget);
  });

  let flowIndex = 0;
  return base.map((widget) => {
    if (!FLOW_HOME_SECTION_BY_STORAGE.has(widget.widgetKey as HomeWidgetKey)) return widget;
    return orderedFlowWidgets[flowIndex++] ?? widget;
  });
}
