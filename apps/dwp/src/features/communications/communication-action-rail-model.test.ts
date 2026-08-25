import { describe, expect, it } from 'vitest';

import {
  buildCommunicationActionRailItems,
  communicationActionIds,
} from './communication-action-rail-model';

import type { CommunicationFeed, CommunicationItem } from '@dwp-frontend/shared-utils';

function story(
  communicationId: number,
  overrides: Partial<CommunicationItem> = {}
): CommunicationItem {
  return {
    communicationId,
    title: `Story ${communicationId}`,
    summary: 'Summary',
    severity: 'INFO',
    contentType: 'ANNOUNCEMENT',
    categoryKey: 'COMPANY',
    publisherName: 'DWP Communications',
    featured: false,
    pinned: false,
    acknowledgementRequired: false,
    dismissible: true,
    readingMinutes: 2,
    sourceLocale: 'en',
    readerState: {
      unread: true,
      saved: false,
      acknowledged: false,
      dismissed: false,
    },
    reactions: { counts: {}, viewerReaction: null, total: 0 },
    ...overrides,
  };
}

function feed(overrides: Partial<CommunicationFeed>): CommunicationFeed {
  return {
    featured: null,
    items: [],
    summary: { total: 0, unread: 0, required: 0, saved: 0 },
    generatedAt: '2026-08-24T09:00:00Z',
    ...overrides,
  };
}

describe('communication action rail model', () => {
  it('deduplicates the action slice and required fallback while retaining server order', () => {
    const critical = story(3, { severity: 'CRITICAL' });
    const required = story(2, { acknowledgementRequired: true, dismissible: false });

    const result = buildCommunicationActionRailItems(
      feed({ actionableItems: [critical, required] }),
      feed({ featured: required, actionableItems: [critical, required] })
    );

    expect(result.map(({ item, kind }) => [item.communicationId, kind])).toEqual([
      [3, 'CRITICAL'],
      [2, 'REQUIRED'],
    ]);
    expect([...communicationActionIds(result)]).toEqual([3, 2]);
  });

  it('uses critical presentation without losing acknowledgement semantics', () => {
    const criticalRequired = story(7, {
      severity: 'CRITICAL',
      acknowledgementRequired: true,
      acknowledgementDueAt: '2026-08-25T09:00:00Z',
      dismissible: false,
    });

    const [result] = buildCommunicationActionRailItems(
      feed({ actionableItems: [criticalRequired] }),
      feed({ items: [criticalRequired] })
    );

    expect(result).toMatchObject({ kind: 'CRITICAL' });
    expect(result?.item.acknowledgementRequired).toBe(true);
    expect(result?.item.acknowledgementDueAt).toBe('2026-08-25T09:00:00Z');
  });

  it('drops dismissed, acknowledged, and already-read non-actionable stories', () => {
    const result = buildCommunicationActionRailItems(
      feed({
        actionableItems: [
          story(1, {
            severity: 'CRITICAL',
            readerState: { unread: false, saved: false, acknowledged: false, dismissed: false },
          }),
          story(2, {
            acknowledgementRequired: true,
            readerState: { unread: false, saved: false, acknowledged: true, dismissed: false },
          }),
          story(3, {
            severity: 'CRITICAL',
            readerState: { unread: true, saved: false, acknowledged: false, dismissed: true },
          }),
        ],
      })
    );

    expect(result).toEqual([]);
  });
});
