import { describe, expect, it } from 'vitest';

import {
  buildMessagingMentionOptions,
  messagingMentionUserIds,
  pruneMessagingMentions,
  replaceMessagingComposerRange,
  resolveMessagingMentionQuery,
} from './messaging-composer-model';

import type { MessagingMember } from '@dwp-frontend/shared-utils';

function member(
  userId: number,
  displayName: string,
  role: MessagingMember['memberRole'] = 'MEMBER'
) {
  return {
    userId,
    displayName,
    emailAddress: `${displayName.toLocaleLowerCase()}@example.com`,
    jobTitle: userId === 2 ? 'Product Designer' : 'Engineer',
    organizationName: 'Digital Workplace',
    presenceState: 'AVAILABLE',
    memberRole: role,
    membershipSource: 'DIRECT',
    notificationLevel: 'DEFAULT',
    favorite: false,
    pinned: false,
  } satisfies MessagingMember;
}

describe('messaging composer model', () => {
  it('finds an active mention query without treating an email address as a mention', () => {
    expect(resolveMessagingMentionQuery('확인은 @김민', 8)).toEqual({
      start: 4,
      end: 8,
      query: '김민',
    });
    expect(resolveMessagingMentionQuery('mail user@example.com', 21)).toBeNull();
  });

  it('replaces the active range and keeps the caret after the inserted token', () => {
    expect(replaceMessagingComposerRange('안녕하세요 @김', 6, 8, '@김민서 ')).toEqual({
      value: '안녕하세요 @김민서 ',
      caret: 11,
    });
  });

  it('prunes deleted mention tokens and deduplicates recipient ids', () => {
    const mentions = [
      { token: '@김민서', userIds: [2] },
      { token: '@모두', userIds: [2, 3] },
    ];
    const retained = pruneMessagingMentions('@모두 확인', mentions);
    expect(retained).toEqual([{ token: '@모두', userIds: [2, 3] }]);
    expect(messagingMentionUserIds(retained)).toEqual([2, 3]);
  });

  it('keeps mentions in formatted prose and excludes protected code and link labels', () => {
    const mentions = [{ token: '@Kim', userIds: [2] }];
    expect(pruneMessagingMentions('**@Kim**', mentions)).toEqual(mentions);
    expect(pruneMessagingMentions('`@Kim`', mentions)).toEqual([]);
    expect(pruneMessagingMentions('```\n@Kim\n```', mentions)).toEqual([]);
    expect(pruneMessagingMentions('[@Kim](https://example.com)', mentions)).toEqual([]);
    expect(pruneMessagingMentions('`@Kim` @Kimberly person@Kim', mentions)).toEqual([]);
    expect(resolveMessagingMentionQuery('**@Ki', 5)).toMatchObject({ start: 2, query: 'Ki' });
    expect(resolveMessagingMentionQuery('`@Ki', 4)).toBeNull();
    expect(resolveMessagingMentionQuery('```\n@Ki', 7)).toBeNull();
  });

  it('searches member context and exposes mass mention only to moderators', () => {
    const members = [
      member(1, 'Owner', 'OWNER'),
      member(2, 'Kim'),
      member(3, 'Lee'),
      member(4, 'Park'),
    ];
    expect(
      buildMessagingMentionOptions({
        members,
        currentUserId: 1,
        allowMentionAll: false,
        query: 'designer',
        allLabel: '모든 구성원',
        allToken: '@모두',
      }).map((option) => option.label)
    ).toEqual(['Kim']);
    const options = buildMessagingMentionOptions({
      members,
      currentUserId: 1,
      allowMentionAll: true,
      query: '',
      allLabel: '모든 구성원',
      allToken: '@모두',
    });
    expect(options[0]).toMatchObject({ token: '@모두', userIds: [2, 3, 4], all: true });
  });
});
