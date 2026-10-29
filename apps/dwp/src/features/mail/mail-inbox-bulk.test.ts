import { describe, expect, it } from 'vitest';

import {
  createMailBulkCommandPlan,
  resolveMailBulkCommandPlan,
  summarizeMailBulkResults,
  updateMailThreadPageAfterBulk,
} from './mail-inbox-bulk';

import type { MailThread, MailThreadPage } from '@dwp-frontend/shared-utils';

function thread(threadId: string, overrides: Partial<MailThread> = {}): MailThread {
  return {
    threadId,
    accountId: 'account-1',
    accountName: 'Work',
    folderType: 'INBOX',
    subject: threadId,
    preview: 'Preview',
    participants: [],
    latestMessageAt: '2026-10-28T00:00:00.000Z',
    unread: true,
    starred: false,
    importance: 'NORMAL',
    triageLane: 'PRIORITY',
    workflowState: 'OPEN',
    attachments: false,
    externalSender: false,
    classification: 'INTERNAL',
    messageCount: 1,
    version: 1,
    ...overrides,
  };
}

describe('mail inbox bulk result handling', () => {
  it('keeps failed threads selected after a partial result', () => {
    const result = summarizeMailBulkResults(
      ['thread-1', 'thread-2', 'thread-3'],
      [
        { status: 'fulfilled', value: undefined },
        { status: 'rejected', reason: new Error('version conflict') },
        { status: 'fulfilled', value: undefined },
      ]
    );

    expect(result.succeededIds).toEqual(['thread-1', 'thread-3']);
    expect(result.failedIds).toEqual(['thread-2']);
  });

  it('uses one intent per user action and replays lost-response and partial failures exactly', () => {
    let nextId = 0;
    const createId = () => `id-${++nextId}`;
    const first = resolveMailBulkCommandPlan(
      null,
      'archive',
      'scope-a',
      [thread('thread-1'), thread('thread-2')],
      createId
    );
    const lostResponseReplay = resolveMailBulkCommandPlan(
      first.plan,
      'archive',
      'scope-a',
      [thread('thread-1'), thread('thread-2')],
      createId
    );
    const partialFailureReplay = resolveMailBulkCommandPlan(
      first.plan,
      'archive',
      'scope-a',
      [thread('thread-2', { version: 9 })],
      createId
    );

    expect(first.items.map((item) => item.identity)).toEqual([
      { bulkIntentId: 'id-1', itemIdempotencyKey: 'id-2' },
      { bulkIntentId: 'id-1', itemIdempotencyKey: 'id-3' },
    ]);
    expect(lostResponseReplay.items.map((item) => item.identity)).toEqual(
      first.items.map((item) => item.identity)
    );
    expect(partialFailureReplay.items.map((item) => item.identity)).toEqual([
      { bulkIntentId: 'id-1', itemIdempotencyKey: 'id-3' },
    ]);
    expect(partialFailureReplay.items[0]?.thread.version).toBe(9);
    expect(partialFailureReplay.items[0]?.expectedVersion).toBe(1);
    expect(nextId).toBe(3);

    const changedCommand = createMailBulkCommandPlan(
      'mark-read',
      'scope-a',
      [thread('thread-2')],
      createId
    );
    expect(changedCommand.items[0]?.identity).toEqual({
      bulkIntentId: 'id-4',
      itemIdempotencyKey: 'id-5',
    });
  });

  it('removes successful archives and immediately projects successful field updates', () => {
    const first = thread('thread-1');
    const second = thread('thread-2');
    const page: MailThreadPage = { items: [first, second], total: 2, page: 0, pageSize: 30 };

    expect(updateMailThreadPageAfterBulk(page, 'archive', ['thread-1'], [])).toMatchObject({
      items: [second],
      total: 1,
    });
    expect(
      updateMailThreadPageAfterBulk(
        page,
        'mark-read',
        ['thread-1'],
        [{ ...first, unread: false, version: 2 }]
      )?.items[0]
    ).toMatchObject({ threadId: 'thread-1', unread: false, version: 2 });
  });
});
