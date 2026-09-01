import { isFlowAdaptiveTemplateEligible } from './flow-home-preference';

import type { HomeAudienceProfile, HomePresentation } from '@dwp-frontend/shared-utils';
import type { FlowHomeSectionKey, FlowHomeSectionPreference } from './flow-home-preference';

export const FLOW_HOME_MEDIUM_MIN_WIDTH = 900;
export const FLOW_HOME_DESKTOP_MIN_WIDTH = 1200;
export const FLOW_HOME_WIDE_MIN_WIDTH = 1800;
export const FLOW_HOME_WIDE_COMPOSITION = {
  columns: 60,
  actionColumns: 35,
  firstColumns: 25,
  supportColumns: 20,
  label: '7-5/4-4-4',
} as const;

export type FlowHomeReadTemplate =
  'personalized' | 'editing' | 'single-column' | 'standard' | 'adaptive-medium' | 'adaptive-wide';

export type FlowHomeReadLayout = Readonly<{
  template: FlowHomeReadTemplate;
  adaptiveEligible: boolean;
  adaptiveApplied: boolean;
  firstSectionKey: FlowHomeSectionKey | null;
  supportSectionKeys: readonly FlowHomeSectionKey[];
}>;

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
  presentation,
  editing,
  largeText,
  mobilePreview,
  mediumViewport,
  wideViewport,
}: ResolveFlowHomeReadLayoutInput): FlowHomeReadLayout {
  const adaptiveEligible = isFlowAdaptiveTemplateEligible(sections, audience);
  const purposeSections = sections.filter((section) => section.widgetKey !== 'action-queue');
  const firstSectionKey = adaptiveEligible ? (purposeSections[0]?.widgetKey ?? null) : null;
  const supportSectionKeys = adaptiveEligible
    ? purposeSections.slice(1).map((section) => section.widgetKey)
    : [];

  if (editing) {
    return {
      template: 'editing',
      adaptiveEligible,
      adaptiveApplied: false,
      firstSectionKey,
      supportSectionKeys,
    };
  }
  if (largeText || mobilePreview) {
    return {
      template: 'single-column',
      adaptiveEligible,
      adaptiveApplied: false,
      firstSectionKey,
      supportSectionKeys,
    };
  }
  if (adaptiveEligible && presentation === 'expressive' && wideViewport) {
    return {
      template: 'adaptive-wide',
      adaptiveEligible: true,
      adaptiveApplied: true,
      firstSectionKey,
      supportSectionKeys,
    };
  }
  if (adaptiveEligible && mediumViewport) {
    return {
      template: 'adaptive-medium',
      adaptiveEligible: true,
      adaptiveApplied: true,
      firstSectionKey,
      supportSectionKeys,
    };
  }
  return {
    template: adaptiveEligible ? 'standard' : 'personalized',
    adaptiveEligible,
    adaptiveApplied: false,
    firstSectionKey,
    supportSectionKeys,
  };
}

/**
 * Wide support cards default to one representative item, while the primary
 * work and first role section may use four. An explicit saved item limit always
 * wins within the renderer's bounded four-item budget.
 */
export function resolveFlowHomeReadItemLimit({
  template,
  sectionKey,
  firstSectionKey,
  configuredItemLimit,
}: ResolveFlowHomeReadItemLimitInput): number {
  const adaptiveWide = template === 'adaptive-wide';
  const primary =
    sectionKey === 'action' || sectionKey === 'action-queue' || sectionKey === firstSectionKey;
  const fallback = adaptiveWide ? (primary ? 4 : 1) : 3;
  const requested = typeof configuredItemLimit === 'number' ? configuredItemLimit : fallback;
  return Math.min(4, Math.max(1, Math.trunc(requested)));
}
