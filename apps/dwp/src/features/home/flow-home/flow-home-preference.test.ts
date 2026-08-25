import { describe, expect, it } from 'vitest';

import {
  FLOW_HOME_MEMBER_SECTION_ORDER,
  FLOW_HOME_OPERATOR_SECTION_ORDER,
  FLOW_HOME_STORAGE_ALIAS,
  applyFlowHomeSections,
  deriveFlowHomeSections,
  isFlowAdaptiveTemplateEligible,
  isFlowLegacyGeometryMigrationEligible,
  normalizeLegacyFlowHomeSections,
} from './flow-home-preference';
import { defaultHomeWidgets } from '../home-widget-registry';

import type {
  HomeWidgetPreference,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';

const customizedWidgets: HomeWidgetPreference[] = [
  { widgetKey: 'command-rail', visible: false, size: 'large', height: 'short' },
  { widgetKey: 'activity', visible: true, size: 'quarter', height: 'tall' },
  { widgetKey: 'focus', visible: false, size: 'medium', height: 'tall' },
  { widgetKey: 'schedule', visible: true, size: 'quarter', height: 'standard' },
  { widgetKey: 'daily-brief', visible: true, size: 'full', height: 'standard' },
];

describe('Flow Home preference alias migration', () => {
  it('keeps the legacy storage mapping strictly one-to-one', () => {
    expect(FLOW_HOME_STORAGE_ALIAS).toEqual({
      today: 'schedule',
      'response-hub': 'daily-brief',
      'request-tracker': 'focus',
      'role-pulse': 'activity',
    });
    expect(new Set(Object.values(FLOW_HOME_STORAGE_ALIAS)).size).toBe(4);
  });

  it('derives the Member and Manager default DOM from their role-specific storage order', () => {
    for (const profile of ['MEMBER', 'MANAGER'] as const) {
      expect(
        deriveFlowHomeSections(defaultHomeWidgets(undefined, profile), false).map(
          (section) => section.widgetKey
        )
      ).toEqual(FLOW_HOME_MEMBER_SECTION_ORDER);
    }
  });

  it('derives the Operator default DOM with the role pulse first', () => {
    expect(
      deriveFlowHomeSections(defaultHomeWidgets(undefined, 'OPERATOR'), false).map(
        (section) => section.widgetKey
      )
    ).toEqual(FLOW_HOME_OPERATOR_SECTION_ORDER);
  });

  it('preserves customized source order, visibility, size, and height independently', () => {
    const sections = deriveFlowHomeSections(customizedWidgets, true);

    expect(sections).toEqual([
      { widgetKey: 'role-pulse', visible: true, size: 'quarter', height: 'tall' },
      { widgetKey: 'request-tracker', visible: false, size: 'medium', height: 'tall' },
      { widgetKey: 'today', visible: true, size: 'quarter', height: 'standard' },
      { widgetKey: 'response-hub', visible: true, size: 'full', height: 'standard' },
    ]);
  });

  it('accepts both Flow keys and legacy storage keys in device width overlays', () => {
    const source = defaultHomeWidgets(undefined, 'MEMBER');
    const sections = deriveFlowHomeSections(source, false, {
      today: 'medium',
      'daily-brief': 'large',
      'request-tracker': 'large',
      activity: 'medium',
    });

    expect(sections.map(({ widgetKey, size }) => [widgetKey, size])).toEqual([
      ['today', 'medium'],
      ['response-hub', 'large'],
      ['request-tracker', 'large'],
      ['role-pulse', 'medium'],
    ]);
  });

  it('treats role order as presentation and only gates adaptive layout on untouched footprints', () => {
    const member = deriveFlowHomeSections(defaultHomeWidgets(undefined, 'MEMBER'), false);
    const operator = deriveFlowHomeSections(defaultHomeWidgets(undefined, 'OPERATOR'), false);
    const resized = member.map((section) =>
      section.widgetKey === 'today' ? { ...section, size: 'medium' as const } : section
    );
    const hidden = member.map((section) =>
      section.widgetKey === 'role-pulse' ? { ...section, visible: false } : section
    );

    expect(isFlowAdaptiveTemplateEligible(member)).toBe(true);
    expect(isFlowAdaptiveTemplateEligible(operator)).toBe(true);
    expect(isFlowAdaptiveTemplateEligible(resized)).toBe(false);
    expect(isFlowAdaptiveTemplateEligible(hidden)).toBe(false);
  });

  it('normalizes only the complete obsolete Classic geometry signature', () => {
    const legacy = deriveFlowHomeSections(defaultHomeWidgets(undefined, 'OPERATOR'), true);
    const normalized = normalizeLegacyFlowHomeSections(legacy, true);

    expect(
      normalized.map(({ widgetKey, visible, size, height }) => ({
        widgetKey,
        visible,
        size,
        height,
      }))
    ).toEqual([
      { widgetKey: 'role-pulse', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'today', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'response-hub', visible: true, size: 'compact', height: 'standard' },
      { widgetKey: 'request-tracker', visible: true, size: 'compact', height: 'standard' },
    ]);

    const intentionalResize = legacy.map((section) =>
      section.widgetKey === 'request-tracker' ? { ...section, size: 'large' as const } : section
    );
    expect(normalizeLegacyFlowHomeSections(intentionalResize, true)).toEqual(intentionalResize);
  });

  it('requires the explicit v2 release boundary before migrating an obsolete signature', () => {
    const legacy = deriveFlowHomeSections(defaultHomeWidgets(undefined, 'OPERATOR'), true);

    expect(normalizeLegacyFlowHomeSections(legacy)).toEqual(legacy);
    expect(isFlowLegacyGeometryMigrationEligible(5, '2026-08-25T03:00:00.000Z')).toBe(true);
    expect(isFlowLegacyGeometryMigrationEligible(5, '2026-08-25T04:00:00.000Z')).toBe(false);
    expect(isFlowLegacyGeometryMigrationEligible(4, '2026-08-25T03:00:00.000Z')).toBe(false);
  });

  it('round-trips a customized preference idempotently without changing command-rail', () => {
    const migratedOnce = applyFlowHomeSections(
      customizedWidgets,
      deriveFlowHomeSections(customizedWidgets, true)
    );
    const migratedTwice = applyFlowHomeSections(
      migratedOnce,
      deriveFlowHomeSections(migratedOnce, true)
    );

    expect(migratedOnce).toEqual(customizedWidgets);
    expect(migratedTwice).toEqual(migratedOnce);
    expect(migratedTwice[0]).toEqual(customizedWidgets[0]);
  });

  it('renders Classic focus expanded as Flow tall without losing rollback geometry', () => {
    const classicExpanded = customizedWidgets.map((widget) =>
      widget.widgetKey === 'focus' ? { ...widget, height: 'expanded' as const } : widget
    );
    const sections = deriveFlowHomeSections(classicExpanded, true);

    expect(sections.find((section) => section.widgetKey === 'request-tracker')?.height).toBe(
      'tall'
    );

    const unrelatedEdit = sections.map((section) =>
      section.widgetKey === 'today' ? { ...section, visible: false } : section
    );
    const saved = applyFlowHomeSections(classicExpanded, unrelatedEdit);

    expect(saved.find((widget) => widget.widgetKey === 'focus')?.height).toBe('expanded');
    expect(saved.find((widget) => widget.widgetKey === 'schedule')?.visible).toBe(false);
    expect(applyFlowHomeSections(saved, deriveFlowHomeSections(saved, true))).toEqual(saved);
  });

  it('applies visibility and geometry to exactly one legacy alias', () => {
    const sections = deriveFlowHomeSections(customizedWidgets, true).map((section) =>
      section.widgetKey === 'role-pulse'
        ? {
            ...section,
            visible: false,
            size: 'medium' as const,
            height: 'short' as const,
          }
        : section
    );
    const migrated = applyFlowHomeSections(customizedWidgets, sections);

    expect(migrated.find((widget) => widget.widgetKey === 'activity')).toMatchObject({
      visible: false,
      size: 'medium',
      height: 'short',
    });
    expect(migrated.find((widget) => widget.widgetKey === 'focus')).toEqual(
      customizedWidgets.find((widget) => widget.widgetKey === 'focus')
    );
  });

  it('reorders only alias slots and preserves unknown widgets in place', () => {
    const unknownBefore = {
      widgetKey: 'future-insight',
      visible: false,
      size: 'compact' as const,
      height: 'short' as const,
    };
    const unknownAfter = {
      widgetKey: 'future-summary',
      visible: true,
      size: 'full' as const,
      height: 'tall' as const,
    };
    const source: PersonalHomeWidgetPreference<string>[] = [
      customizedWidgets[0]!,
      unknownBefore,
      ...customizedWidgets.slice(1, 3),
      unknownAfter,
      ...customizedWidgets.slice(3),
    ];
    const sections = [...deriveFlowHomeSections(source, true)].reverse();
    const migrated = applyFlowHomeSections(source, sections);

    expect(migrated[0]).toBe(source[0]);
    expect(migrated[1]).toBe(unknownBefore);
    expect(migrated[4]).toBe(unknownAfter);
    expect(migrated.map((widget) => widget.widgetKey)).toEqual([
      'command-rail',
      'future-insight',
      'daily-brief',
      'schedule',
      'future-summary',
      'focus',
      'activity',
    ]);
  });

  it('never deletes aliases when handed a partial section collection', () => {
    const [first] = deriveFlowHomeSections(customizedWidgets, true);
    const migrated = applyFlowHomeSections(customizedWidgets, [first!]);

    expect(migrated.map((widget) => widget.widgetKey)).toEqual(
      customizedWidgets.map((widget) => widget.widgetKey)
    );
  });
});
