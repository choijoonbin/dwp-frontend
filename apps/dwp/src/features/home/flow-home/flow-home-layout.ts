import { isFlowAdaptiveTemplateEligible } from './flow-home-preference';
import { HOME_REFERENCE_GRID_PLACEMENTS } from '../../../components/home-loading-layout-policy';

import type { HomeAudienceProfile, HomePresentation } from '@dwp-frontend/shared-utils';
import type { FlowHomeSectionKey, FlowHomeSectionPreference } from './flow-home-preference';

export const FLOW_HOME_MEDIUM_MIN_WIDTH = 900;
export const FLOW_HOME_DESKTOP_MIN_WIDTH = 1200;
export const FLOW_HOME_WIDE_MIN_WIDTH = 1600;
export const FLOW_HOME_WIDE_COMPOSITION = {
  columns: 100,
  actionColumns: 72,
  firstColumns: 38,
  supportColumns: 34,
  insightColumns: 28,
  label: '38-34-28',
} as const;

/** Reference composition is read-only; personal preferences and DOM order stay untouched. */
export const FLOW_HOME_REFERENCE_PLACEMENT = HOME_REFERENCE_GRID_PLACEMENTS satisfies Record<
  FlowHomeSectionKey,
  { gridColumn: string; row: number }
>;

export const FLOW_HOME_CORE_REFERENCE_PLACEMENT = {
  'action-queue': { gridColumn: '1 / span 38', row: 1 },
  today: { gridColumn: '39 / span 34', row: 1 },
  'response-hub': { gridColumn: '73 / span 28', row: 1 },
  'request-tracker': { gridColumn: '73 / span 28', row: 2 },
} as const satisfies Partial<Record<FlowHomeSectionKey, { gridColumn: string; row: number }>>;

const CALENDAR_INSIGHT_SECTION_KEYS = new Set<FlowHomeSectionKey>([
  'focus-balance',
  'meeting-load',
]);

export type FlowHomeReadTemplate =
  'personalized' | 'editing' | 'single-column' | 'standard' | 'adaptive-medium' | 'adaptive-wide';

export type FlowHomeReadLayout = Readonly<{
  template: FlowHomeReadTemplate;
  adaptiveEligible: boolean;
  adaptiveApplied: boolean;
  adaptiveVariant: 'complete' | 'core' | null;
  firstSectionKey: FlowHomeSectionKey | null;
  supportSectionKeys: readonly FlowHomeSectionKey[];
  insightSectionKeys: readonly FlowHomeSectionKey[];
}>;

const CORE_SECTION_GEOMETRY = [
  ['action-queue', 'large'],
  ['today', 'compact'],
  ['response-hub', 'compact'],
  ['request-tracker', 'compact'],
] as const;

function isFlowCoreAdaptiveTemplateEligible(
  sections: readonly FlowHomeSectionPreference[]
): boolean {
  const visible = sections.filter(({ visible }) => visible);
  return (
    visible.length === CORE_SECTION_GEOMETRY.length &&
    visible.every(
      (section, index) =>
        section.widgetKey === CORE_SECTION_GEOMETRY[index]?.[0] &&
        section.size === CORE_SECTION_GEOMETRY[index]?.[1]
    )
  );
}

type ResolveFlowHomeReadItemLimitInput = Readonly<{
  template: FlowHomeReadTemplate;
  sectionKey: 'action' | FlowHomeSectionKey;
  firstSectionKey: FlowHomeSectionKey | null;
  configuredItemLimit?: unknown;
}>;

type ResolveFlowHomeReadLayoutInput = Readonly<{
  sections: readonly FlowHomeSectionPreference[];
  audience: HomeAudienceProfile;
  presentation: HomePresentation;
  editing: boolean;
  largeText: boolean;
  mobilePreview: boolean;
  mediumViewport: boolean;
  wideViewport: boolean;
}>;

/**
 * Resolves a presentation-only layout. It never returns replacement section
 * preferences, so opening the editor or saving cannot persist adaptive spans.
 */
export function resolveFlowHomeReadLayout({
  sections,
  audience,
  editing,
  largeText,
  mobilePreview,
  mediumViewport,
  wideViewport,
}: ResolveFlowHomeReadLayoutInput): FlowHomeReadLayout {
  const completeAdaptive = isFlowAdaptiveTemplateEligible(sections, audience);
  const coreAdaptive = isFlowCoreAdaptiveTemplateEligible(sections);
  const adaptiveEligible = completeAdaptive || coreAdaptive;
  const adaptiveVariant = coreAdaptive ? 'core' : completeAdaptive ? 'complete' : null;
  const purposeSections = sections.filter(
    (section) => section.visible && section.widgetKey !== 'action-queue'
  );
  const firstSectionKey = adaptiveEligible ? (purposeSections[0]?.widgetKey ?? null) : null;
  const supportSectionKeys = adaptiveEligible
    ? purposeSections
        .slice(1)
        .map((section) => section.widgetKey)
        .filter((sectionKey) => !CALENDAR_INSIGHT_SECTION_KEYS.has(sectionKey))
    : [];
  const insightSectionKeys = adaptiveEligible
    ? purposeSections
        .map((section) => section.widgetKey)
        .filter((sectionKey) => CALENDAR_INSIGHT_SECTION_KEYS.has(sectionKey))
    : [];

  if (editing) {
    return {
      template: 'editing',
      adaptiveEligible,
      adaptiveApplied: false,
      adaptiveVariant,
      firstSectionKey,
      supportSectionKeys,
      insightSectionKeys,
    };
  }
  if (largeText || mobilePreview) {
    return {
      template: 'single-column',
      adaptiveEligible,
      adaptiveApplied: false,
      adaptiveVariant,
      firstSectionKey,
      supportSectionKeys,
      insightSectionKeys,
    };
  }
  if (adaptiveEligible && wideViewport) {
    return {
      template: 'adaptive-wide',
      adaptiveEligible: true,
      adaptiveApplied: true,
      adaptiveVariant,
      firstSectionKey,
      supportSectionKeys,
      insightSectionKeys,
    };
  }
  if (adaptiveEligible && mediumViewport) {
    return {
      template: 'adaptive-medium',
      adaptiveEligible: true,
      adaptiveApplied: true,
      adaptiveVariant,
      firstSectionKey,
      supportSectionKeys,
      insightSectionKeys,
    };
  }
  return {
    template: adaptiveEligible ? 'standard' : 'personalized',
    adaptiveEligible,
    adaptiveApplied: false,
    adaptiveVariant,
    firstSectionKey,
    supportSectionKeys,
    insightSectionKeys,
  };
}

/**
 * The reference uses four compact priority rows and up to three supporting records.
 * An explicit saved item limit always
 * wins within the renderer's bounded four-item budget.
 */
export function resolveFlowHomeReadItemLimit({
  template,
  sectionKey,
  configuredItemLimit,
}: ResolveFlowHomeReadItemLimitInput): number {
  const adaptiveWide = template === 'adaptive-wide';
  const primary = sectionKey === 'action' || sectionKey === 'action-queue';
  const fallback = adaptiveWide && primary ? 4 : 3;
  const requested = typeof configuredItemLimit === 'number' ? configuredItemLimit : fallback;
  return Math.min(4, Math.max(1, Math.trunc(requested)));
}
