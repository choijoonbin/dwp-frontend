import { ArrowLeft, Hash, MessageSquarePlus, PanelRight, Users, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, ActionIconButton, GlyphSurface } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { ClassificationChip, messagingInitials } from './messaging-components';
import { MessagingConnectionIndicator } from './messaging-connection-indicator';
import { MessagingConversationSettings } from './messaging-conversation-settings';
import { messagingVisualTone, messagingVisualTokens } from './messaging-visual-model';

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
  onToggleContext: () => void;
  contextExpanded: boolean;
};

export function MessagingConversationHeader({
  detail,
  currentMember,
  connectionState,
  labels,
  onBack,
  onOpenMembers,
  onOpenMeeting,
  onToggleContext,
  contextExpanded,
}: MessagingConversationHeaderProps) {
  const { t } = useTranslation('messaging');
  const { conversation } = detail;
  const membersCanBeManaged = ['GROUP', 'CHANNEL'].includes(conversation.conversationType);

  return (
    <Stack
      direction="row"
      spacing={{ xs: 0.5, sm: 1.25 }}
      alignItems="center"
      flexWrap="nowrap"
      useFlexGap
      sx={(theme) => ({
        minHeight: { xs: 54, sm: 64 },
        px: { xs: 0.75, sm: 1.5 },
        py: { xs: 0.6, sm: 1 },
        borderBottom: 1,
        borderColor: alpha(theme.palette.primary.main, 0.1),
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.92 : 0.96),
      })}
    >
      <ActionIconButton
        label={labels.back}
        onClick={onBack}
        sx={{ display: { lg: 'none' }, flexShrink: 0 }}
      >
        <ArrowLeft size={18} />
      </ActionIconButton>
      <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
        <Stack direction="row" spacing={0.9} alignItems="center" sx={{ minWidth: 0 }}>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, flexShrink: 0 }}>
            <GlyphSurface
              size={30}
              variant="soft"
              tone={
                conversation.visibility === 'SPACE'
                  ? messagingVisualTokens.tones.channel
                  : messagingVisualTokens.tones.direct
              }
            >
              {conversation.visibility === 'SPACE' ? (
                <Hash size={15} aria-hidden="true" />
              ) : (
                <MessageSquarePlus size={15} aria-hidden="true" />
              )}
            </GlyphSurface>
          </Box>
          <Typography component="h2" variant="subtitle1" fontWeight={850} noWrap>
            {conversation.name}
          </Typography>
        </Stack>
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ mt: 0.2, minWidth: 0, display: { xs: 'none', sm: 'flex' } }}
        >
          {conversation.topic ? (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
              {conversation.topic}
            </Typography>
          ) : null}
          <ClassificationChip classification={conversation.dataClassification} />
        </Stack>
      </Box>
      <Stack
        direction="row"
        spacing={{ xs: 0.1, sm: 0.5 }}
        alignItems="center"
        sx={{ flexShrink: 0 }}
      >
        <AvatarGroup
          max={4}
          aria-label={labels.members}
          sx={{
            display: 'none',
            mr: 0.5,
            '& .MuiAvatar-root': {
              width: 27,
              height: 27,
              fontSize: 'overline.fontSize',
              fontWeight: 'fontWeightBold',
            },
            '@media (min-width: 1600px)': { display: 'flex' },
          }}
        >
          {detail.members.slice(0, 4).map((member) => {
            const tone = messagingVisualTone(member.userId);
            return (
              <Avatar key={member.userId} sx={{ bgcolor: tone.surface, color: tone.foreground }}>
                {messagingInitials(member.displayName)}
              </Avatar>
            );
          })}
        </AvatarGroup>
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <MessagingConnectionIndicator state={connectionState} />
        </Box>
        <MessagingConversationSettings conversation={conversation} currentMember={currentMember} />
        <ActionIconButton
          label={t('context.toggle')}
          aria-expanded={contextExpanded}
          onClick={onToggleContext}
        >
          <PanelRight size={17} />
        </ActionIconButton>
        {membersCanBeManaged ? (
          <ActionIconButton label={labels.members} onClick={onOpenMembers}>
            <Users size={17} />
          </ActionIconButton>
        ) : null}
        <ActionButton
          intent="secondary"
          startIcon={<Video size={16} />}
          onClick={onOpenMeeting}
          sx={(theme) => ({
            display: { xs: 'none', sm: 'inline-flex' },
            whiteSpace: 'nowrap',
            color:
              theme.palette.mode === 'dark'
                ? theme.palette.success.light
                : theme.palette.success.dark,
            borderColor: alpha(theme.palette.success.main, 0.55),
            bgcolor: alpha(theme.palette.success.main, 0.045),
            '&:hover': {
              borderColor: theme.palette.success.main,
              bgcolor: alpha(theme.palette.success.main, 0.1),
            },
          })}
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
