import { alpha } from '@mui/material/styles';

import type {
  MessagingConversation,
  MessagingConversationDisplayPreference,
  MessagingDisplayTheme,
} from '@dwp-frontend/shared-utils';
import type { Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';

const CONVERSATIONAL_TYPES = new Set(['DIRECT', 'GROUP']);

export const MESSAGING_DISPLAY_QUERY_KEY = ['messaging', 'display-preference'] as const;

export function messagingConversationDisplayQueryKey(conversationId: string) {
  return ['messaging', 'conversation-display-preference', conversationId] as const;
}

export function defaultMessagingConversationDisplayPreference(
  conversation: MessagingConversation
): MessagingConversationDisplayPreference {
  const structured = ['ANNOUNCEMENT', 'INCIDENT', 'MEETING'].includes(
    conversation.conversationType
  );
  return {
    conversationId: conversation.conversationId,
    layoutMode: 'INHERIT',
    density: 'INHERIT',
    theme: 'INHERIT',
    effectiveLayoutMode:
      !structured && CONVERSATIONAL_TYPES.has(conversation.conversationType)
        ? 'CONVERSATIONAL'
        : 'COLLABORATIVE',
    effectiveDensity: 'COMFORTABLE',
    effectiveTheme: 'DEFAULT',
    showAvatars: true,
    timestampMode: 'SMART',
    messagePreview: true,
    policyLocked: structured || conversation.dataClassification === 'RESTRICTED',
    policyReason:
      conversation.dataClassification === 'RESTRICTED'
        ? 'RESTRICTED_CONVERSATION'
        : structured
          ? 'STRUCTURED_CONVERSATION'
          : null,
    version: 0,
  };
}

export function messagingTimelineSurfaceSx(
  themeKey: MessagingDisplayTheme,
  theme: Theme
): SystemStyleObject<Theme> {
  const dark = theme.palette.mode === 'dark';
  const canvas = {
    DEFAULT: theme.palette.background.paper,
    MIST: alpha(theme.palette.info.main, dark ? 0.1 : 0.055),
    SAGE: alpha(theme.palette.success.main, dark ? 0.09 : 0.05),
    ROSE: alpha(theme.palette.error.main, dark ? 0.075 : 0.035),
  }[themeKey];
  return {
    bgcolor: canvas,
    '--msg-other-surface': dark
      ? alpha(theme.palette.common.white, 0.075)
      : alpha(theme.palette.common.white, 0.92),
    '--msg-mine-surface': alpha(theme.palette.primary.main, dark ? 0.24 : 0.11),
    '--msg-reaction-surface': alpha(theme.palette.primary.main, dark ? 0.2 : 0.075),
  };
}

export function isMessagingTimestampVisible(
  mode: MessagingConversationDisplayPreference['timestampMode'],
  groupedWithPrevious: boolean
) {
  return mode === 'ALWAYS' || !groupedWithPrevious;
}
