import { describe, expect, it } from 'vitest';

import {
  filterMessagingAssets,
  messagingAssetFileSize,
  messagingAssetKindFilter,
} from './messaging-files-model';

import type { MessagingSharedAsset } from '@dwp-frontend/shared-utils';

const items: MessagingSharedAsset[] = [
  {
    id: 'file:1',
    kind: 'FILE',
    conversationId: 'conversation-1',
    conversationName: 'Operations',
    messageId: 'message-1',
    sharedAt: '2026-10-28T00:00:00Z',
    senderName: 'Mina Kim',
    title: 'Incident plan.pdf',
    protectedContent: false,
    attachmentId: 'attachment-1',
    url: null,
    contentType: 'application/pdf',
    sizeBytes: 2048,
  },
  {
    id: 'link:1',
    kind: 'LINK',
    conversationId: 'conversation-2',
    conversationName: 'Product',
    messageId: 'message-2',
    sharedAt: '2026-10-27T00:00:00Z',
    senderName: 'Jun Lee',
    title: 'docs.example.test',
    protectedContent: false,
    attachmentId: null,
    url: 'https://docs.example.test',
    contentType: null,
    sizeBytes: null,
  },
];

describe('messaging files model', () => {
  it('normalizes unsupported URL filters and matches searchable metadata', () => {
    expect(messagingAssetKindFilter('OTHER')).toBe('ALL');
    expect(messagingAssetKindFilter('FILE')).toBe('FILE');
    expect(filterMessagingAssets(items, 'mina', 'ALL')).toEqual([items[0]]);
    expect(filterMessagingAssets(items, 'PRODUCT', 'LINK')).toEqual([items[1]]);
    expect(filterMessagingAssets(items, 'incident', 'LINK')).toEqual([]);
  });

  it('formats governed attachment sizes without inventing link sizes', () => {
    expect(messagingAssetFileSize(null)).toBeNull();
    expect(messagingAssetFileSize(500)).toBe('500 B');
    expect(messagingAssetFileSize(2048)).toBe('2 KB');
    expect(messagingAssetFileSize(1_572_864)).toBe('1.5 MB');
  });
});
