// @vitest-environment jsdom

import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { afterEach, describe, expect, it } from 'vitest';

import {
  clearMailRejectedReplyReview,
  clearMailSendAttempt,
  clearMailSendAttemptMemoryForTests,
  clearMailSendAttemptsForTests,
  listMailSendAttempts,
  mailSendCustodyOwner,
  mailGroupSendScope,
  mailReplySendScope,
  mailSendErrorDisposition,
  readMailRejectedReplyReview,
  readMailSendAttempt,
  rememberMailRejectedReplyReview,
  rememberMailSendAttempt,
} from './mail-send-attempt';

describe('mail send attempt custody', () => {
  afterEach(clearMailSendAttemptsForTests);

  it('keeps an unresolved command isolated to its conversation', () => {
    const owner = mailSendCustodyOwner({ identityPlane: 'TENANT', tenantId: 7, userId: 42 });
    const scope = mailReplySendScope(owner, 'thread-1');
    const attempt = {
      intent: { key: 'command-1', fingerprint: '{"body":"Approved"}' },
      payload: { threadId: 'thread-1', body: 'Approved' },
    };

    rememberMailSendAttempt(scope, attempt);

    expect(readMailSendAttempt(scope)).toEqual(attempt);
    expect(readMailSendAttempt(mailReplySendScope(owner, 'thread-2'))).toBeNull();
    clearMailSendAttempt(scope);
    expect(readMailSendAttempt(scope)).toBeNull();
  });

  it('restores the exact unresolved command after in-memory state is lost', () => {
    const owner = mailSendCustodyOwner({ identityPlane: 'TENANT', tenantId: 7, userId: 42 });
    const scope = mailReplySendScope(owner, 'thread-1');
    const attempt = {
      intent: { key: 'command-1', fingerprint: '{"body":"Approved"}' },
      payload: { threadId: 'thread-1', body: 'Approved' },
    };

    rememberMailSendAttempt(scope, attempt);
    clearMailSendAttemptMemoryForTests();

    expect(readMailSendAttempt(scope)).toEqual(attempt);
  });

  it("does not expose another signed-in user's unresolved command", () => {
    const firstOwner = mailSendCustodyOwner({ tenantId: 7, userId: 42 });
    const secondOwner = mailSendCustodyOwner({ tenantId: 7, userId: 43 });
    rememberMailSendAttempt(mailReplySendScope(firstOwner, 'shared-thread'), {
      intent: { key: 'command-1', fingerprint: '{"body":"Private"}' },
      payload: { threadId: 'shared-thread', body: 'Private' },
    });

    expect(readMailSendAttempt(mailReplySendScope(secondOwner, 'shared-thread'))).toBeNull();
  });

  it('keeps a confirmed rejected reply available for review after navigation and reload', () => {
    const owner = mailSendCustodyOwner({ tenantId: 7, userId: 42 });
    const otherOwner = mailSendCustodyOwner({ tenantId: 7, userId: 43 });
    const scope = mailReplySendScope(owner, 'thread-1');
    const review = { threadId: 'thread-1', body: 'Review this rejected reply' };

    rememberMailRejectedReplyReview(scope, review);
    clearMailSendAttemptMemoryForTests();

    expect(readMailRejectedReplyReview(scope)).toEqual(review);
    expect(readMailRejectedReplyReview(mailReplySendScope(otherOwner, 'thread-1'))).toBeNull();
    clearMailRejectedReplyReview(scope);
    expect(readMailRejectedReplyReview(scope)).toBeNull();
  });

  it('lists restored group commands only for their owning user and command kind', () => {
    const firstOwner = mailSendCustodyOwner({ tenantId: 7, userId: 42 });
    const secondOwner = mailSendCustodyOwner({ tenantId: 7, userId: 43 });
    const scope = mailGroupSendScope(firstOwner, 'group-1');
    const attempt = {
      intent: { key: 'command-1', fingerprint: '{"groupId":"group-1"}' },
      payload: { groupId: 'group-1', subject: 'Private launch plan' },
    };

    rememberMailSendAttempt(scope, attempt);
    clearMailSendAttemptMemoryForTests();

    expect(listMailSendAttempts(firstOwner, 'group')).toEqual([{ scope, attempt }]);
    expect(listMailSendAttempts(firstOwner, 'reply')).toEqual([]);
    expect(listMailSendAttempts(secondOwner, 'group')).toEqual([]);
  });

  it('distinguishes a confirmed client rejection from an unknown outcome', () => {
    expect(mailSendErrorDisposition(new HttpError('Conflict', 409))).toBe('REJECTED');
    expect(mailSendErrorDisposition(new HttpError('Forbidden', 403))).toBe('REJECTED');
    expect(mailSendErrorDisposition(new HttpError('Gateway timeout', 504))).toBe('UNCONFIRMED');
    expect(mailSendErrorDisposition(new HttpError('Request timeout', 408))).toBe('UNCONFIRMED');
    expect(mailSendErrorDisposition(new HttpTransportError('NETWORK'))).toBe('UNCONFIRMED');
  });
});
