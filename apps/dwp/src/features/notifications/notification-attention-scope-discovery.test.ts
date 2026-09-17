import { describe, expect, it } from 'vitest';

import {
  actorScopeChoices,
  appTypeScopeChoices,
  attentionScopeKeyIsCanonical,
  attentionScheduleIsValid,
  preferredAttentionEffect,
  recentContextScopeChoices,
  recentThreadScopeChoices,
} from './notification-attention-scope-discovery';

import type { NotificationInboxPage } from '@dwp-frontend/shared-utils/api/notification-api';

describe('notification attention scope discovery', () => {
  it('builds canonical app/type keys from the effective user settings catalog', () => {
    const choices = appTypeScopeChoices({
      globalChannels: {},
      generatedAt: '2026-09-17T00:00:00Z',
      partial: false,
      unavailableSources: [],
      message: null,
      apps: [
        {
          appKey: 'messaging',
          appName: 'Space Messenger',
          types: [
            {
              typeKey: 'MESSAGE_MENTION',
              typeName: 'Mention',
              mode: {
                effectiveValue: 'IMMEDIATE',
                source: 'SYSTEM_DEFAULT',
                managed: false,
                exceptionAllowed: true,
              },
              channels: {},
              mandatory: false,
              quietHoursBypass: false,
            },
          ],
        },
      ],
    });

    expect(choices).toEqual([
      expect.objectContaining({
        kind: 'APP_TYPE',
        key: 'messaging:MESSAGE_MENTION',
        label: 'Space Messenger / Mention',
      }),
    ]);
  });

  it('deduplicates recent thread keys without exposing notification content as identifiers', () => {
    const page: NotificationInboxPage = {
      items: [
        {
          notificationId: 'n-1',
          threadKey: 'conversation:alpha',
          threadCount: 2,
          source: { appKey: 'messaging', appName: 'Space Messenger' },
          typeKey: 'MESSAGE',
          title: 'Design review',
          priority: 'NORMAL',
          reason: { kind: 'DIRECT', label: 'Direct' },
          receivedAt: '2026-09-17T00:00:00Z',
          lastActivityAt: '2026-09-17T00:00:00Z',
          actionable: false,
          sensitive: false,
          actions: [],
          version: '1',
        },
        {
          notificationId: 'n-2',
          threadKey: 'conversation:alpha',
          threadCount: 1,
          source: { appKey: 'messaging', appName: 'Space Messenger' },
          typeKey: 'MESSAGE',
          title: 'Older title',
          priority: 'NORMAL',
          reason: { kind: 'DIRECT', label: 'Direct' },
          receivedAt: '2026-09-16T00:00:00Z',
          lastActivityAt: '2026-09-16T00:00:00Z',
          actionable: false,
          sensitive: false,
          actions: [],
          version: '1',
        },
      ],
      hasMore: false,
      changeVersion: '1',
      partial: false,
      unavailableSources: [],
      message: null,
    };

    expect(recentThreadScopeChoices(page)).toEqual([
      {
        kind: 'THREAD',
        key: 'conversation:alpha',
        label: 'Design review',
        detail: 'Space Messenger',
      },
    ]);
  });

  it('uses the same canonical actor reference emitted by messaging notification producers', () => {
    expect(
      actorScopeChoices([
        {
          userId: 42,
          personPublicId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          emailAddress: 'lee@example.com',
          displayName: 'Lee',
          jobTitle: 'Designer',
          organizationName: 'Product',
          presenceState: 'AVAILABLE',
        },
      ])
    ).toEqual([
      {
        kind: 'ACTOR',
        key: 'user:42',
        label: 'Lee',
        detail: 'Designer · Product · lee@example.com',
      },
    ]);
  });

  it('maps only canonical recent resource and topic contexts without inventing labels', () => {
    expect(
      recentContextScopeChoices([
        {
          scopeKind: 'RESOURCE',
          contextKind: 'PROJECT',
          scopeKey: 'project:alpha',
          displayLabel: 'Project Alpha',
          lastSeenAt: '2026-09-17T00:00:00Z',
        },
        {
          scopeKind: 'RESOURCE',
          contextKind: 'WORK_ITEM',
          scopeKey: 'project:alpha',
          displayLabel: 'Duplicate',
          lastSeenAt: '2026-09-16T00:00:00Z',
        },
        {
          scopeKind: 'TOPIC_TOKEN',
          contextKind: 'TOPIC',
          scopeKey: 'Security.Posture',
          displayLabel: 'Invalid topic',
          lastSeenAt: '2026-09-17T00:00:00Z',
        },
        {
          scopeKind: 'TOPIC_TOKEN',
          contextKind: 'TOPIC',
          scopeKey: 'security.posture',
          displayLabel: '',
          lastSeenAt: '2026-09-17T00:00:00Z',
        },
      ])
    ).toEqual([
      {
        kind: 'RESOURCE',
        key: 'project:alpha',
        label: 'Project Alpha',
        detail: 'PROJECT · project:alpha',
      },
      {
        kind: 'TOPIC_TOKEN',
        key: 'security.posture',
        label: 'security.posture',
        detail: 'TOPIC',
      },
    ]);
  });

  it('selects safe defaults and rejects inverted schedules', () => {
    expect(preferredAttentionEffect('ACTOR')).toBe('PRIORITIZE');
    expect(preferredAttentionEffect('APP_TYPE')).toBe('MUTE');
    expect(preferredAttentionEffect('TOPIC_TOKEN')).toBe('FOLLOW');
    expect(attentionScopeKeyIsCanonical('APP_TYPE', 'messaging:MESSAGE_MENTION')).toBe(true);
    expect(attentionScopeKeyIsCanonical('TOPIC_TOKEN', 'security.posture')).toBe(true);
    expect(attentionScopeKeyIsCanonical('TOPIC_TOKEN', ' Security.Posture ')).toBe(false);
    expect(attentionScheduleIsValid('2026-09-17T09:00:00Z', '2026-09-17T10:00:00Z')).toBe(true);
    expect(attentionScheduleIsValid('2026-09-17T10:00:00Z', '2026-09-17T09:00:00Z')).toBe(false);
  });
});
