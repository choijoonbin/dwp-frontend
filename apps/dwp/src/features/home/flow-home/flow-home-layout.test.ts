import { describe, expect, it } from 'vitest';

import { defaultHomeWidgets } from '../home-widget-registry';
import { deriveFlowHomeSections } from './flow-home-preference';
import {
  FLOW_HOME_DESKTOP_MIN_WIDTH,
  FLOW_HOME_REFERENCE_PLACEMENT,
  FLOW_HOME_WIDE_COMPOSITION,
  FLOW_HOME_WIDE_MIN_WIDTH,
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
  it('keeps the default semantic order while activating the reference desktop composition', () => {
    const sections = sectionsFor();
    const before = structuredClone(sections);
    expect(sections.map((section) => section.widgetKey)).toEqual([
      'action-queue',
      'today',
      'response-hub',
      'request-tracker',
      'role-pulse',
      'focus-balance',
      'meeting-load',
    ]);
    expect(resolve({ sections })).toEqual({
      template: 'adaptive-wide',
      adaptiveEligible: true,
      adaptiveApplied: true,
      firstSectionKey: 'today',
      supportSectionKeys: ['response-hub', 'request-tracker', 'role-pulse'],
      insightSectionKeys: ['focus-balance', 'meeting-load'],
    });

    expect(sections).toEqual(before);
    expect(resolve({ wideViewport: false }).template).toBe('standard');
  });

  it.each(['focused', 'balanced', 'expressive'] as const)(
    'uses the reference desktop composition for an eligible %s presentation',
    (presentation) => {
      expect(FLOW_HOME_WIDE_MIN_WIDTH).toBe(1200);
      expect(FLOW_HOME_WIDE_MIN_WIDTH).toBe(FLOW_HOME_DESKTOP_MIN_WIDTH);
      expect(resolve({ presentation })).toMatchObject({
        template: 'adaptive-wide',
        adaptiveEligible: true,
        adaptiveApplied: true,
      });
    }
  );

  it('maps seven widgets into the reference 8+4 main and sidebar hierarchy', () => {
    expect(FLOW_HOME_WIDE_COMPOSITION).toEqual({
      columns: 60,
      actionColumns: 40,
      firstColumns: 20,
      supportColumns: 20,
      insightColumns: 20,
      label: '8-4/4-4-4/8-4',
    });
    expect(FLOW_HOME_REFERENCE_PLACEMENT).toEqual({
      'action-queue': { gridColumn: '1 / span 40', row: 1 },
      'role-pulse': { gridColumn: '41 / span 20', row: 1 },
      today: { gridColumn: '1 / span 20', row: 2 },
      'response-hub': { gridColumn: '21 / span 20', row: 2 },
      'focus-balance': { gridColumn: '41 / span 20', row: 2 },
      'request-tracker': { gridColumn: '1 / span 40', row: 3 },
      'meeting-load': { gridColumn: '41 / span 20', row: 3 },
    });
    expect(Object.keys(FLOW_HOME_REFERENCE_PLACEMENT).sort()).toEqual(
      sectionsFor()
        .map((section) => section.widgetKey)
        .sort()
    );
  });

  it.each([1, 2, 3])('fills reference row %s without overlaps or orphan columns', (row) => {
    const occupiedColumns = Object.values(FLOW_HOME_REFERENCE_PLACEMENT)
      .filter((placement) => placement.row === row)
      .flatMap(({ gridColumn }) => {
        const [start, span] = gridColumn.split(' / span ').map(Number);
        return Array.from({ length: span! }, (_, index) => start! + index);
      })
      .sort((left, right) => left - right);

    expect(occupiedColumns).toEqual(
      Array.from({ length: FLOW_HOME_WIDE_COMPOSITION.columns }, (_, index) => index + 1)
    );
  });

  it('uses the role-specific first section without changing semantic order', () => {
    const sections = sectionsFor('OPERATOR');
    const before = structuredClone(sections);
    const layout = resolve({ sections, audience: 'OPERATOR' });

    expect(layout.firstSectionKey).toBe('role-pulse');
    expect(layout.supportSectionKeys).toEqual(['today', 'response-hub', 'request-tracker']);
    expect(layout.insightSectionKeys).toEqual(['meeting-load', 'focus-balance']);
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
    expect(resolve({ sections: reordered })).toMatchObject({
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
    const heightOnly = sectionsFor().map((section) =>
      section.widgetKey === 'action-queue'
        ? { ...section, height: 'short' as const }
        : section.widgetKey === 'role-pulse'
          ? { ...section, height: 'tall' as const }
          : section
    );
    const savedHeights = structuredClone(heightOnly);
    const hidden = sectionsFor().map((section) =>
      section.widgetKey === 'action-queue' ? { ...section, visible: false } : section
    );
    const resized = sectionsFor().map((section) =>
      section.widgetKey === 'action-queue' ? { ...section, size: 'full' as const } : section
    );

    expect(resolve({ sections: heightOnly }).template).toBe('adaptive-wide');
    expect(heightOnly).toEqual(savedHeights);
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
    ).toBe(3);
    expect(
      resolveFlowHomeReadItemLimit({
        template: 'adaptive-wide',
        sectionKey: 'response-hub',
        firstSectionKey: 'today',
      })
    ).toBe(3);
    expect(
      resolveFlowHomeReadItemLimit({
        template: 'adaptive-wide',
        sectionKey: 'response-hub',
        firstSectionKey: 'today',
        configuredItemLimit: 1,
      })
    ).toBe(1);
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
