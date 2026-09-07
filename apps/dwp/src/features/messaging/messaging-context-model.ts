import type { MessagingMember, MessagingMessage } from '@dwp-frontend/shared-utils';

export function buildMessagingContext(messages: MessagingMessage[], members: MessagingMember[]) {
  const roots = messages
    .filter((message) => !message.replyToMessageId && !message.deletedAt)
    .sort((left, right) =>
      left.sequence !== undefined && right.sequence !== undefined
        ? left.sequence - right.sequence
        : Date.parse(left.createdAt) - Date.parse(right.createdAt)
    );
  const activeMembers = members.filter((member) =>
    ['AVAILABLE', 'BUSY', 'FOCUS'].includes(member.presenceState ?? '')
  );
  return {
    recentMessages: roots.slice(-3),
    activeThreads: roots
      .filter((message) => (message.replyCount ?? 0) > 0)
      .slice(-3)
      .reverse(),
    replyTotal: roots.reduce((total, message) => total + (message.replyCount ?? 0), 0),
    activeCount: activeMembers.length,
    members: [...activeMembers, ...members.filter((member) => !activeMembers.includes(member))],
  };
}
