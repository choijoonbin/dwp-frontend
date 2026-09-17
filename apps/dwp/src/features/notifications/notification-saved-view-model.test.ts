import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NOTIFICATION_CENTER_PRESENTATION,
  migrateNotificationSavedViewConfiguration,
  notificationSavedViewConfiguration,
  notificationSavedViewConfigurationIdentity,
  orderNotificationSavedViews,
  parseNotificationSavedViewConfiguration,
  reorderNotificationPersonalSavedViews,
  selectedNotificationBuiltInViewId,
} from './notification-saved-view-model';

import type { GovernedSavedView } from '@dwp-frontend/shared-utils';

describe('notification saved views', () => {
  it('round-trips a canonical center scope without transient selection state', () => {
    const scope = {
      view: 'ALL' as const,
      query: '  renewal  ',
      appKey: 'approvals',
      priority: 'HIGH' as const,
      readState: 'UNREAD' as const,
      reason: 'DIRECT' as const,
      attentionEffect: 'PRIORITIZE' as const,
      includedTypes: [],
      contextFilters: [],
    };

    const configuration = notificationSavedViewConfiguration(scope, {
      ...DEFAULT_NOTIFICATION_CENTER_PRESENTATION,
      density: 'DENSE',
      grouping: 'SOURCE',
    });

    expect(configuration).toMatchObject({
      contract: 'dwp.notifications.center.saved-view',
      version: 5,
      contextMatch: 'ALL_KINDS_ANY_VALUE',
      presentation: {
        density: 'DENSE',
        grouping: 'SOURCE',
        icon: 'BELL',
        color: 'BLUE',
        displayOrder: 0,
      },
    });
    expect(parseNotificationSavedViewConfiguration(configuration)).toEqual({
      scope: {
        ...scope,
        query: 'renewal',
      },
      presentation: {
        density: 'DENSE',
        grouping: 'SOURCE',
        icon: 'BELL',
        color: 'BLUE',
        displayOrder: 0,
      },
    });
  });

  it('reads v1 views with current defaults while retaining the established mention scope rules', () => {
    expect(
      parseNotificationSavedViewConfiguration({
        contract: 'dwp.notifications.center.saved-view',
        version: 1,
        scope: {
          view: 'MENTIONS',
          query: '',
          appKey: '',
          priority: 'ALL',
          readState: 'UNREAD',
          reason: 'ROLE',
        },
      })
    ).toEqual({
      scope: {
        view: 'MENTIONS',
        query: '',
        appKey: '',
        priority: 'ALL',
        readState: 'UNREAD',
        reason: 'ALL',
        attentionEffect: 'ALL',
        includedTypes: [],
        contextFilters: [],
      },
      presentation: DEFAULT_NOTIFICATION_CENTER_PRESENTATION,
    });
  });

  it('migrates v1 configurations without discarding legacy extensions', () => {
    const legacy = {
      contract: 'dwp.notifications.center.saved-view',
      version: 1,
      scope: {
        view: 'ALL',
        query: 'renewal',
        appKey: 'approvals',
        priority: 'HIGH',
        readState: 'UNREAD',
        reason: 'DIRECT',
        legacyFacet: { owner: 'finance' },
      },
      clientExtension: { revision: 7 },
    };

    expect(migrateNotificationSavedViewConfiguration(legacy)).toEqual({
      ...legacy,
      version: 5,
      presentation: DEFAULT_NOTIFICATION_CENTER_PRESENTATION,
      contextMatch: 'ALL_KINDS_ANY_VALUE',
      contextFilters: [],
      includedTypes: [],
    });
  });

  it('migrates v2 exact contexts into the fixed multi-context match contract', () => {
    const migrated = migrateNotificationSavedViewConfiguration({
      contract: 'dwp.notifications.center.saved-view',
      version: 2,
      scope: {
        view: 'ALL',
        query: '',
        appKey: '',
        priority: 'ALL',
        readState: 'ALL',
        reason: 'ALL',
      },
      presentation: { density: 'DENSE', grouping: 'CONTEXT' },
      contextFilters: [{ kind: 'THREAD', key: 'thread:42', label: 'Release' }],
    });

    expect(migrated).toMatchObject({
      version: 5,
      contextMatch: 'ALL_KINDS_ANY_VALUE',
      contextFilters: [{ kind: 'THREAD', key: 'thread:42', label: 'Release' }],
    });
  });

  it('round-trips deterministic multi-context OR-within-kind and AND-across-kinds filters', () => {
    const configuration = notificationSavedViewConfiguration({
      view: 'ALL',
      query: '',
      appKey: 'messaging',
      priority: 'ALL',
      readState: 'UNREAD',
      reason: 'ALL',
      attentionEffect: 'ALL',
      includedTypes: ['ASSIGNED', 'DIRECT'],
      contextFilters: [
        { kind: 'THREAD', key: 'conversation:design-systems', label: 'Design systems' },
        { kind: 'ACTOR', key: 'user:42', label: 'Kim' },
        { kind: 'ACTOR', key: 'user:84', label: 'Lee' },
        { kind: 'RESOURCE', key: 'project:renewal', label: 'Renewal' },
      ],
    });

    expect(configuration.contextMatch).toBe('ALL_KINDS_ANY_VALUE');
    expect(configuration.includedTypes).toEqual(['DIRECT', 'ASSIGNED']);
    expect(configuration.contextFilters).toEqual([
      { kind: 'ACTOR', key: 'user:42', label: 'Kim' },
      { kind: 'ACTOR', key: 'user:84', label: 'Lee' },
      {
        kind: 'THREAD',
        key: 'conversation:design-systems',
        label: 'Design systems',
      },
      { kind: 'RESOURCE', key: 'project:renewal', label: 'Renewal' },
    ]);
    expect(parseNotificationSavedViewConfiguration(configuration)?.scope.contextFilters).toEqual(
      configuration.contextFilters
    );
  });

  it('identifies the same saved query when only resolved context labels differ', () => {
    const base = {
      view: 'ALL' as const,
      query: '',
      appKey: '',
      priority: 'ALL' as const,
      readState: 'ALL' as const,
      reason: 'ALL' as const,
      attentionEffect: 'ALL' as const,
      includedTypes: [],
    };
    const labeled = notificationSavedViewConfiguration({
      ...base,
      contextFilters: [{ kind: 'RESOURCE', key: 'project:renewal', label: 'Renewal' }],
    });
    const routeRestored = notificationSavedViewConfiguration({
      ...base,
      contextFilters: [{ kind: 'RESOURCE', key: 'project:renewal', label: '' }],
    });

    expect(notificationSavedViewConfigurationIdentity(labeled)).toBe(
      notificationSavedViewConfigurationIdentity(routeRestored)
    );
  });

  it('fails closed for foreign, oversized, or malformed configurations', () => {
    expect(
      parseNotificationSavedViewConfiguration({ contract: 'mail.saved-view', version: 1 })
    ).toBeNull();
    expect(
      parseNotificationSavedViewConfiguration({
        contract: 'dwp.notifications.center.saved-view',
        version: 3,
        scope: {
          view: 'ALL',
          query: 'x'.repeat(201),
          appKey: '',
          priority: 'ALL',
          readState: 'ALL',
          reason: 'ALL',
        },
        presentation: { density: 'DETAILED', grouping: 'NONE' },
        contextMatch: 'ALL_KINDS_ANY_VALUE',
        contextFilters: [],
      })
    ).toBeNull();
    expect(
      parseNotificationSavedViewConfiguration({
        contract: 'dwp.notifications.center.saved-view',
        version: 3,
        scope: {
          view: 'ALL',
          query: '',
          appKey: '',
          priority: 'ALL',
          readState: 'ALL',
          reason: 'ALL',
        },
        presentation: { density: 'COMFORTABLE', grouping: 'NONE' },
        contextMatch: 'ALL_KINDS_ANY_VALUE',
        contextFilters: [],
      })
    ).toBeNull();
    const base = notificationSavedViewConfiguration({
      view: 'ALL',
      query: '',
      appKey: '',
      priority: 'ALL',
      readState: 'ALL',
      reason: 'ALL',
      attentionEffect: 'ALL',
      includedTypes: [],
      contextFilters: [],
    });
    expect(
      parseNotificationSavedViewConfiguration({
        ...base,
        contextFilters: [{ kind: 'ACTOR', key: ' user:42', label: 'Kim' }],
      })
    ).toBeNull();
    expect(
      parseNotificationSavedViewConfiguration({
        ...base,
        contextFilters: Array.from({ length: 6 }, (_, index) => ({
          kind: 'THREAD',
          key: `thread:${index}`,
          label: '',
        })),
      })
    ).toBeNull();
    expect(
      parseNotificationSavedViewConfiguration({
        ...base,
        contextFilters: [
          { kind: 'THREAD', key: 'thread:1', label: '' },
          { kind: 'THREAD', key: 'thread:1', label: '' },
        ],
      })
    ).toBeNull();
    expect(
      parseNotificationSavedViewConfiguration({
        ...base,
        includedTypes: ['DIRECT', 'DIRECT'],
      })
    ).toBeNull();
    expect(
      parseNotificationSavedViewConfiguration({
        ...base,
        presentation: { ...DEFAULT_NOTIFICATION_CENTER_PRESENTATION, color: 'BLACK' },
      })
    ).toBeNull();
    expect(
      parseNotificationSavedViewConfiguration({
        ...base,
        scope: { ...(base.scope as Record<string, unknown>), attentionEffect: 'VIP_ACTOR' },
      })
    ).toBeNull();
  });

  it('recognizes only the canonical built-in scopes', () => {
    expect(
      selectedNotificationBuiltInViewId({
        view: 'PRIORITY',
        query: '',
        appKey: '',
        priority: 'ALL',
        readState: 'ALL',
        reason: 'ALL',
        attentionEffect: 'ALL',
        includedTypes: [],
        contextFilters: [],
      })
    ).toBe('notification-priority');
    expect(
      selectedNotificationBuiltInViewId({
        view: 'ALL',
        query: '',
        appKey: '',
        priority: 'ALL',
        readState: 'UNREAD',
        reason: 'ALL',
        attentionEffect: 'ALL',
        includedTypes: [],
        contextFilters: [],
      })
    ).toBe('notification-unread');
    expect(
      selectedNotificationBuiltInViewId(
        {
          view: 'PRIORITY',
          query: '',
          appKey: '',
          priority: 'ALL',
          readState: 'ALL',
          reason: 'ALL',
          attentionEffect: 'ALL',
          includedTypes: [],
          contextFilters: [],
        },
        { ...DEFAULT_NOTIFICATION_CENTER_PRESENTATION, density: 'DENSE' }
      )
    ).toBeNull();
    expect(
      selectedNotificationBuiltInViewId({
        view: 'ALL',
        query: '',
        appKey: '',
        priority: 'ALL',
        readState: 'UNREAD',
        reason: 'ALL',
        attentionEffect: 'ALL',
        includedTypes: ['DIRECT'],
        contextFilters: [],
      })
    ).toBeNull();
  });

  it('orders pinned personal views and produces deterministic optimistic reorder payloads', () => {
    const savedView = (id: string, favorite: boolean, displayOrder: number): GovernedSavedView => ({
      savedViewId: id,
      surfaceKey: 'notifications.work',
      name: id,
      scope: 'PERSONAL',
      lifecycleState: 'ACTIVE',
      editable: true,
      favorite,
      defaultView: false,
      configuration: notificationSavedViewConfiguration(
        { ...EMPTY_SCOPE, query: id },
        { ...DEFAULT_NOTIFICATION_CENTER_PRESENTATION, displayOrder }
      ),
      version: 1,
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:00:00Z',
    });
    const views = [
      savedView('third', false, 1),
      savedView('first', true, 0),
      savedView('second', false, 0),
    ];

    expect(orderNotificationSavedViews(views).map((view) => view.savedViewId)).toEqual([
      'first',
      'second',
      'third',
    ]);
    const updates = reorderNotificationPersonalSavedViews(views, 'third', -1);
    expect(
      orderNotificationSavedViews(
        views.map((view) => ({
          ...view,
          configuration:
            updates.find((update) => update.view.savedViewId === view.savedViewId)?.configuration ??
            view.configuration,
        }))
      )
        .filter((view) => !view.favorite)
        .map((view) => view.savedViewId)
    ).toEqual(['third', 'second']);
  });
});

const EMPTY_SCOPE = {
  view: 'ALL' as const,
  query: '',
  appKey: '',
  priority: 'ALL' as const,
  readState: 'ALL' as const,
  reason: 'ALL' as const,
  attentionEffect: 'ALL' as const,
  includedTypes: [],
  contextFilters: [],
};
