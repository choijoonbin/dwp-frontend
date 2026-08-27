import { describe, expect, it } from 'vitest';

import { HOME_WIDGET_KEYS, defaultHomeWidgets } from './home-widget-registry';
import {
  filterHomeGalleryItems,
  homeGalleryActionableCount,
  homeGalleryRestorableCount,
  matchesHomeGallerySearch,
  resolveHomeAppGalleryItems,
  resolveHomeWidgetLifecycleGalleryState,
  resolveHomeWidgetGalleryItems,
} from './home-item-gallery-model';

import type {
  HomeAppDefinition,
  LaunchpadLayout,
} from '../../components/workspace-composer/app-launchpad-model';

const APPS: readonly HomeAppDefinition[] = [
  {
    id: 'work',
    name: 'Work',
    shortName: 'Work',
    description: 'Tasks',
    groupId: 'work',
    route: '/work',
    iconKey: 'work',
    tone: '#000',
    resourceKey: 'APP.WORK',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    shortName: 'Calendar',
    description: 'Schedule',
    groupId: 'connect',
    route: '/calendar',
    iconKey: 'calendar',
    tone: '#000',
    resourceKey: 'APP.CALENDAR',
  },
  {
    id: 'activity',
    name: 'Activity',
    shortName: 'Activity',
    description: 'Events',
    groupId: 'work',
    route: '/activity',
    iconKey: 'activity',
    tone: '#000',
    resourceKey: 'APP.ACTIVITY',
  },
];

const LAYOUT: LaunchpadLayout = {
  version: 1,
  groups: { work: ['work'], connect: [] },
  folders: {},
  hiddenAppIds: ['calendar'],
};

describe('home item gallery model', () => {
  it('blocks unsafe lifecycle states from discovery and restore', () => {
    expect(resolveHomeWidgetLifecycleGalleryState('ACTIVE', null)).toBe('ADD');
    expect(resolveHomeWidgetLifecycleGalleryState('ACTIVE', false)).toBe('RESTORE');
    expect(resolveHomeWidgetLifecycleGalleryState('DEPRECATED', null)).toBeNull();
    expect(resolveHomeWidgetLifecycleGalleryState('DEPRECATED', false)).toBe('LOCKED');
    expect(resolveHomeWidgetLifecycleGalleryState('DEPRECATED', true)).toBe('ADDED');
    expect(resolveHomeWidgetLifecycleGalleryState('BLOCKED', true)).toBeNull();
  });

  it('distinguishes added, restore, and newly addable apps', () => {
    const items = resolveHomeAppGalleryItems(APPS, LAYOUT);

    expect(items.map(({ app, state }) => [app.id, state])).toEqual([
      ['work', 'ADDED'],
      ['calendar', 'RESTORE'],
      ['activity', 'ADD'],
    ]);
  });

  it('keeps entitled widgets discoverable and excludes the managed Flow command rail', () => {
    const preferences = defaultHomeWidgets(HOME_WIDGET_KEYS).map((preference) =>
      preference.widgetKey === 'schedule' ? { ...preference, visible: false } : preference
    );
    const items = resolveHomeWidgetGalleryItems(HOME_WIDGET_KEYS, preferences, APPS, true);

    expect(items.map(({ widget, state }) => [widget.key, state])).toEqual([
      ['daily-brief', 'ADDED'],
      ['focus', 'ADDED'],
      ['schedule', 'RESTORE'],
      ['activity', 'ADDED'],
    ]);
  });

  it('does not disclose a widget whose owning app is not entitled', () => {
    const items = resolveHomeWidgetGalleryItems(
      HOME_WIDGET_KEYS,
      defaultHomeWidgets(HOME_WIDGET_KEYS),
      APPS.filter((app) => app.resourceKey !== 'APP.CALENDAR'),
      false
    );

    expect(items.map((item) => item.widget.key)).not.toContain('schedule');
  });

  it('marks a registered definition without a placement as addable', () => {
    const items = resolveHomeWidgetGalleryItems(['schedule'], [], APPS, false);

    expect(items).toHaveLength(1);
    expect(items[0]?.state).toBe('ADD');
  });

  it('filters the library by view, type, and actionable status', () => {
    const items = [
      ...resolveHomeAppGalleryItems(APPS, LAYOUT),
      ...resolveHomeWidgetGalleryItems(
        HOME_WIDGET_KEYS,
        defaultHomeWidgets(HOME_WIDGET_KEYS),
        APPS,
        false
      ),
    ];

    expect(
      filterHomeGalleryItems(items, { view: 'HIDDEN', kind: 'ALL', status: 'ALL' }).map(
        (item) => item.id
      )
    ).toEqual(['app:calendar']);
    expect(
      filterHomeGalleryItems(items, {
        view: 'LIBRARY',
        kind: 'APP',
        status: 'ACTIONABLE',
      }).map((item) => item.id)
    ).toEqual(['app:calendar', 'app:activity']);
    expect(homeGalleryActionableCount(items)).toBe(2);
    expect(homeGalleryRestorableCount(items)).toBe(1);
  });

  it('normalizes unicode, whitespace, and case for localized search', () => {
    expect(matchesHomeGallerySearch('  CALENDAR  ', ['Team calendar', '일정'])).toBe(true);
    expect(matchesHomeGallerySearch('일정', ['일정 관리'])).toBe(true);
    expect(matchesHomeGallerySearch('people', ['Calendar', '일정'])).toBe(false);
  });
});
