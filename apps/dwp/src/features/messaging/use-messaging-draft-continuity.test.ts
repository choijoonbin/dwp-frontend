import { describe, expect, it } from 'vitest';

import {
  messagingMentionPersonPublicIds,
  restoreMessagingMentionDrafts,
} from './use-messaging-draft-continuity';

import type { MessagingMember } from '@dwp-frontend/shared-utils';

const members = [
  {
    userId: 2,
    personPublicId: '018f2f67-02c7-7f21-9c11-9a7b67519b2d',
    displayName: 'Kim',
  },
  {
    userId: 3,
    personPublicId: '018f2f67-02c7-7f21-9c11-9a7b67519b2e',
    displayName: 'Lee',
  },
].map(
  (member) =>
    ({
      ...member,
      emailAddress: `${member.displayName.toLowerCase()}@example.com`,
      presenceState: 'UNKNOWN',
      memberRole: 'MEMBER',
      membershipSource: 'DIRECT',
      notificationLevel: 'DEFAULT',
      favorite: false,
      pinned: false,
    }) as MessagingMember
);

describe('messaging server draft continuity', () => {
  it('restores structured individual mentions only when their token remains in the body', () => {
    expect(
      restoreMessagingMentionDrafts(
        'Hello @Kim',
        members.map((member) => member.personPublicId!),
        members
      )
    ).toEqual([{ token: '@Kim', userIds: [2] }]);
  });

  it('restores one mass mention with the complete structured recipient set', () => {
    expect(
      restoreMessagingMentionDrafts(
        '@everyone please review',
        members.map((member) => member.personPublicId!),
        members
      )
    ).toEqual([{ token: '@everyone', userIds: [2, 3] }]);
  });

  it('restores a one-recipient mass mention without exposing its numeric id remotely', () => {
    expect(
      restoreMessagingMentionDrafts('@all please review', [members[0]!.personPublicId!], members)
    ).toEqual([{ token: '@all', userIds: [2] }]);
  });

  it('maps local numeric mention state to sorted public identities and fails closed if missing', () => {
    expect(
      messagingMentionPersonPublicIds(
        [
          { token: '@Lee', userIds: [3] },
          { token: '@Kim', userIds: [2] },
        ],
        members
      )
    ).toEqual(members.map((member) => member.personPublicId).sort());
    expect(
      messagingMentionPersonPublicIds([{ token: '@Unknown', userIds: [999] }], members)
    ).toBeNull();
  });
});
