const REACTION_VALUES = new Set(['👍', '👏', '🎉', '❤️']);
const MAX_PAYLOAD_BYTES = 1_024;
const MAX_METADATA_LENGTH = 2_048;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export type MeetingReactionInteraction = {
  type: 'REACTION';
  id: string;
  emoji: string;
  senderName: string;
  sentAt: number;
};

type MeetingReactionSender = {
  identity: string;
  name?: string;
  metadata?: string;
  permissions?: { canPublishData?: boolean } | null;
};

type AuthorizeMeetingReactionInput = {
  payload: Uint8Array;
  sender?: MeetingReactionSender;
  meetingId: string;
  receiverAllowsReactions: boolean;
  now?: number;
};

export type AuthorizedMeetingReaction = {
  id: string;
  emoji: string;
  senderName: string;
  sentAt: number;
};

function authorizedSender(
  sender: MeetingReactionSender | undefined,
  meetingId: string
): MeetingReactionSender | null {
  if (
    !sender ||
    !sender.identity ||
    sender.identity.length > 256 ||
    sender.permissions?.canPublishData !== true ||
    !sender.metadata ||
    sender.metadata.length > MAX_METADATA_LENGTH
  ) {
    return null;
  }
  try {
    const metadata = JSON.parse(sender.metadata) as Record<string, unknown>;
    return metadata.meetingId === meetingId && metadata.reactionsAllowed === true ? sender : null;
  } catch {
    return null;
  }
}

export function authorizeReceivedMeetingReaction({
  payload,
  sender,
  meetingId,
  receiverAllowsReactions,
  now = Date.now(),
}: AuthorizeMeetingReactionInput): AuthorizedMeetingReaction | null {
  if (!receiverAllowsReactions || payload.byteLength > MAX_PAYLOAD_BYTES) return null;
  const authorized = authorizedSender(sender, meetingId);
  if (!authorized) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
    if (
      value.type !== 'REACTION' ||
      typeof value.id !== 'string' ||
      !value.id.trim() ||
      value.id.length > 80 ||
      typeof value.emoji !== 'string' ||
      !REACTION_VALUES.has(value.emoji) ||
      typeof value.senderName !== 'string' ||
      value.senderName.length > 100 ||
      typeof value.sentAt !== 'number' ||
      !Number.isFinite(value.sentAt) ||
      Math.abs(now - value.sentAt) > MAX_CLOCK_SKEW_MS
    ) {
      return null;
    }
    return {
      id: value.id,
      emoji: value.emoji,
      senderName: authorized.name || authorized.identity,
      sentAt: value.sentAt,
    };
  } catch {
    return null;
  }
}
