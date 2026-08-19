import { ArrowLeft, Hash, MessageSquarePlus, Users, Video } from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ClassificationChip } from './messaging-components';
import { MessagingConnectionIndicator } from './messaging-connection-indicator';
import { MessagingConversationSettings } from './messaging-conversation-settings';

import type { MessagingConversationDetail, MessagingMember } from '@dwp-frontend/shared-utils';
import type { MessagingConnectionState } from './use-messaging-realtime';

type MessagingConversationHeaderProps = {
  detail: MessagingConversationDetail;
  currentMember?: MessagingMember;
  connectionState: MessagingConnectionState;
  labels: {
    back: string;
    members: string;
    meeting: string;
  };
  onBack: () => void;
  onOpenMembers: () => void;
  onOpenMeeting: () => void;
};

export function MessagingConversationHeader({
  detail,
  currentMember,
  connectionState,
  labels,
  onBack,
  onOpenMembers,
  onOpenMeeting,
}: MessagingConversationHeaderProps) {
  const { conversation } = detail;
  const membersCanBeManaged = ['GROUP', 'CHANNEL'].includes(conversation.conversationType);

  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      flexWrap={{ xs: 'wrap', sm: 'nowrap' }}
      useFlexGap
      sx={{ px: { xs: 1.25, sm: 2 }, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
    >
      <ActionIconButton
        label={labels.back}
        onClick={onBack}
        sx={{ display: { lg: 'none' }, flexShrink: 0 }}
      >
        <ArrowLeft size={18} />
      </ActionIconButton>
      <Box sx={{ minWidth: 160, flex: '1 1 260px' }}>
        <Stack direction="row" spacing={0.9} alignItems="center" sx={{ minWidth: 0 }}>
          {conversation.visibility === 'SPACE' ? (
            <Hash size={18} aria-hidden="true" />
          ) : (
            <MessageSquarePlus size={18} aria-hidden="true" />
          )}
          <Typography component="h2" variant="h6" fontWeight={850} noWrap>
            {conversation.name}
          </Typography>
          <ClassificationChip classification={conversation.dataClassification} />
        </Stack>
        {conversation.topic ? (
          <Typography variant="caption" color="text.secondary" noWrap>
            {conversation.topic}
          </Typography>
        ) : null}
      </Box>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
        <MessagingConnectionIndicator state={connectionState} />
        <MessagingConversationSettings conversation={conversation} currentMember={currentMember} />
        {membersCanBeManaged ? (
          <ActionIconButton label={labels.members} onClick={onOpenMembers}>
            <Users size={17} />
          </ActionIconButton>
        ) : null}
        <ActionButton
          intent="quiet"
          startIcon={<Video size={16} />}
          onClick={onOpenMeeting}
          sx={{ display: { xs: 'none', sm: 'inline-flex' }, whiteSpace: 'nowrap' }}
        >
          {labels.meeting}
        </ActionButton>
        <ActionIconButton
          label={labels.meeting}
          onClick={onOpenMeeting}
          sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
        >
          <Video size={17} />
        </ActionIconButton>
      </Stack>
    </Stack>
  );
}
