import { describe, expect, it } from 'vitest';

import { defaultHomeWidgets } from '../home-widget-registry';
import { deriveFlowHomeSections } from './flow-home-preference';
import {
  FLOW_HOME_WIDE_COMPOSITION,
  resolveFlowHomeReadItemLimit,
  resolveFlowHomeReadLayout,
} from './flow-home-layout';

function sectionsFor(audience: 'MEMBER' | 'OPERATOR' = 'MEMBER') {
  return deriveFlowHomeSections(defaultHomeWidgets(undefined, audience), false);
}

function resolve(overrides: Partial<Parameters<typeof resolveFlowHomeReadLayout>[0]> = {}) {
  return resolveFlowHomeReadLayout({
    sections: sectionsFor(),
    audience: 'MEMBER',
    presentation: 'expressive',
    editing: false,
    largeText: false,
    mobilePreview: false,
    mediumViewport: false,
    wideViewport: true,
    ...overrides,
  });
}

describe('Flow Home read layout', () => {
  it('activates the wide support stack only for an eligible expressive read view', () => {
    expect(sectionsFor().map((section) => section.widgetKey)).toEqual([
      'action-queue',
      'today',
      'response-hub',
      'request-tracker',
      'role-pulse',
    ]);
    expect(resolve()).toEqual({
      template: 'adaptive-wide',
      adaptiveEligible: true,
      adaptiveApplied: true,
      firstSectionKey: 'today',
      supportSectionKeys: ['response-hub', 'request-tracker', 'role-pulse'],
    });

    expect(resolve({ presentation: 'balanced' }).template).toBe('standard');
    expect(resolve({ wideViewport: false }).template).toBe('standard');
  });

  it('fills the wide canvas as a stable 7+5 primary tier and 4+4+4 support tier', () => {
    expect(FLOW_HOME_WIDE_COMPOSITION.actionColumns + FLOW_HOME_WIDE_COMPOSITION.firstColumns).toBe(
      FLOW_HOME_WIDE_COMPOSITION.columns
    );
    expect(FLOW_HOME_WIDE_COMPOSITION.supportColumns * 3).toBe(FLOW_HOME_WIDE_COMPOSITION.columns);
    expect(FLOW_HOME_WIDE_COMPOSITION.label).toBe('7-5/4-4-4');
  });

  it('uses the role-specific first section without changing semantic order', () => {
    const sections = sectionsFor('OPERATOR');
    const before = structuredClone(sections);
    const layout = resolve({ sections, audience: 'OPERATOR' });

    expect(layout.firstSectionKey).toBe('role-pulse');
    expect(layout.supportSectionKeys).toEqual(['today', 'response-hub', 'request-tracker']);
    expect(sections).toEqual(before);
  });

  it('uses the two-column medium template only for an untouched default', () => {
    expect(resolve({ wideViewport: false, mediumViewport: true }).template).toBe('adaptive-medium');

    const reordered = sectionsFor();
    [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
    const layout = resolve({
      sections: reordered,
      wideViewport: false,
      mediumViewport: true,
    });
    expect(layout).toMatchObject({
      template: 'personalized',
      adaptiveEligible: false,
      adaptiveApplied: false,
    });
  });

  it('never applies an adaptive template while editing, reflowing large text, or previewing mobile', () => {
    expect(resolve({ editing: true }).template).toBe('editing');
    expect(resolve({ largeText: true }).template).toBe('single-column');
    expect(resolve({ mobilePreview: true }).template).toBe('single-column');
  });

  it('keeps a saved height eligible but rejects visibility and width changes', () => {
    const heightOnly = sectionsFor().map((section) => ({
      ...section,
      height: section.widgetKey === 'action-queue' ? ('short' as const) : ('tall' as const),
    }));
    const hidden = sectionsFor().map((section) =>
      section.widgetKey === 'action-queue' ? { ...section, visible: false } : section
    );
    const resized = sectionsFor().map((section) =>
      section.widgetKey === 'action-queue' ? { ...section, size: 'full' as const } : section
    );

    expect(resolve({ sections: heightOnly }).template).toBe('adaptive-wide');
    expect(resolve({ sections: hidden }).template).toBe('personalized');
    expect(resolve({ sections: resized }).template).toBe('personalized');
  });

  it('uses read-only wide budgets while preserving an explicit configured item limit', () => {
    expect(
      resolveFlowHomeReadItemLimit({
        template: 'adaptive-wide',
        sectionKey: 'action-queue',
        firstSectionKey: 'today',
      })
    ).toBe(4);
    expect(
      resolveFlowHomeReadItemLimit({
        template: 'adaptive-wide',
        sectionKey: 'today',
        firstSectionKey: 'today',
      })
    ).toBe(4);
    expect(
      resolveFlowHomeReadItemLimit({
        template: 'adaptive-wide',
        sectionKey: 'response-hub',
        firstSectionKey: 'today',
      })
    ).toBe(1);
    expect(
      resolveFlowHomeReadItemLimit({
        template: 'adaptive-wide',
        sectionKey: 'response-hub',
        firstSectionKey: 'today',
        configuredItemLimit: 3,
      })
    ).toBe(3);
    expect(
      resolveFlowHomeReadItemLimit({
        template: 'standard',
        sectionKey: 'response-hub',
        firstSectionKey: 'today',
      })
    ).toBe(3);
    expect(
      resolveFlowHomeReadItemLimit({
        template: 'adaptive-wide',
        sectionKey: 'response-hub',
        firstSectionKey: 'today',
        configuredItemLimit: 20,
      })
    ).toBe(4);
  });
});
