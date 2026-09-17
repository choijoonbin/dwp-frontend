import { describe, expect, it } from 'vitest';

import { mergeNotificationContextCatalog } from './use-notification-context-catalog';

describe('mergeNotificationContextCatalog', () => {
  it('merges selected, loaded and recipient-owned discovered targets without duplicates', () => {
    expect(
      mergeNotificationContextCatalog(
        [{ kind: 'THREAD', key: 'thread:42', label: 'Loaded thread' }],
        [
          { kind: 'ACTOR', key: 'user:7', label: 'Kim' },
          { kind: 'RESOURCE', key: 'project:renewal', label: 'project:renewal' },
        ],
        [
          {
            scopeKind: 'RESOURCE',
            contextKind: 'PROJECT',
            scopeKey: 'project:renewal',
            displayLabel: 'Renewal project',
            lastSeenAt: '2026-09-17T00:00:00Z',
          },
        ],
        [
          {
            scopeKind: 'TOPIC_TOKEN',
            contextKind: 'TOPIC',
            scopeKey: 'security',
            displayLabel: 'Security',
            lastSeenAt: '2026-09-17T00:00:00Z',
          },
        ]
      )
    ).toEqual([
      { kind: 'ACTOR', key: 'user:7', label: 'Kim' },
      { kind: 'RESOURCE', key: 'project:renewal', label: 'Renewal project' },
      { kind: 'THREAD', key: 'thread:42', label: 'Loaded thread' },
      { kind: 'TOPIC_TOKEN', key: 'security', label: 'Security' },
    ]);
  });
});
