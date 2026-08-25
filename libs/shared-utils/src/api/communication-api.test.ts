import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCommunicationFeed } from './communication-api';

const generatedAt = '2026-08-24T09:00:00Z';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function criticalStory(communicationId: number) {
  return {
    communicationId,
    title: 'Urgent security update',
    summary: 'Review this update now.',
    body: 'Details',
    severity: 'CRITICAL',
    contentType: 'ANNOUNCEMENT',
    categoryKey: 'SECURITY',
    publisherName: 'Security Office',
    featured: false,
    pinned: false,
    acknowledgementRequired: false,
    dismissible: false,
    readingMinutes: 2,
    sourceLocale: 'en',
    publishedAt: generatedAt,
    readerState: {
      unread: true,
      saved: false,
      acknowledged: false,
      dismissed: false,
    },
    reactions: { counts: {}, viewerReaction: null, total: 0 },
  };
}

describe('communication API boundary', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves authoritative actionable counts and the action-first detail slice', async () => {
    const critical = criticalStory(99);
    const feed = {
      featured: null,
      items: Array.from({ length: 8 }, (_, index) => ({
        ...criticalStory(index + 1),
        severity: 'INFO',
      })),
      actionableItems: [critical],
      summary: {
        total: 10,
        unread: 10,
        required: 0,
        saved: 0,
        criticalUnread: 1,
        actionable: 1,
      },
      generatedAt,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(feed));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCommunicationFeed({ scope: 'for-you', size: 8 })).resolves.toEqual(feed);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/communications?scope=for-you&size=8'
    );
  });
});
