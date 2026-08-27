import type { MessagingMember } from '@dwp-frontend/shared-utils';

export type MessagingMentionDraft = {
  token: string;
  userIds: number[];
};

export type MessagingMentionQuery = {
  start: number;
  end: number;
  query: string;
};

export type MessagingMentionOption = {
  key: string;
  token: string;
  label: string;
  detail: string;
  presenceState?: MessagingMember['presenceState'];
  userIds: number[];
  all: boolean;
};

export function resolveMessagingMentionQuery(
  value: string,
  caret: number
): MessagingMentionQuery | null {
  const beforeCaret = value.slice(0, Math.max(0, caret));
  const match = beforeCaret.match(/(?:^|\s)@([^\s@]*)$/u);
  if (!match || match.index === undefined) return null;
  const prefixLength = match[0].startsWith('@') ? 0 : 1;
  const start = match.index + prefixLength;
  return { start, end: caret, query: match[1] ?? '' };
}

export function replaceMessagingComposerRange(
  value: string,
  start: number,
  end: number,
  replacement: string
) {
  const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  return { value: nextValue, caret: start + replacement.length };
}

export function pruneMessagingMentions(
  value: string,
  mentions: MessagingMentionDraft[]
): MessagingMentionDraft[] {
  return mentions.filter((mention) => value.includes(mention.token));
}

export function messagingMentionUserIds(mentions: MessagingMentionDraft[]): number[] {
  return [...new Set(mentions.flatMap((mention) => mention.userIds))];
}

export function buildMessagingMentionOptions(input: {
  members: MessagingMember[];
  currentUserId?: number;
  allowMentionAll: boolean;
  query: string;
  allLabel: string;
  allToken: string;
}): MessagingMentionOption[] {
  const normalizedQuery = input.query.trim().toLocaleLowerCase();
  const members = input.members.filter((member) => member.userId !== input.currentUserId);
  const options: MessagingMentionOption[] = members
    .filter((member) => {
      if (!normalizedQuery) return true;
      return [member.displayName, member.emailAddress, member.jobTitle, member.organizationName]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery));
    })
    .slice(0, 8)
    .map((member) => ({
      key: String(member.userId),
      token: `@${member.displayName}`,
      label: member.displayName,
      detail: [member.jobTitle, member.organizationName].filter(Boolean).join(' · '),
      presenceState: member.presenceState,
      userIds: [member.userId],
      all: false,
    }));
  const allMatches =
    !normalizedQuery || input.allLabel.toLocaleLowerCase().includes(normalizedQuery);
  if (input.allowMentionAll && members.length > 2 && allMatches) {
    options.unshift({
      key: 'all',
      token: input.allToken,
      label: input.allLabel,
      detail: `${members.length}`,
      userIds: members.map((member) => member.userId),
      all: true,
    });
  }
  return options;
}
