import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Headphones, Search, ArrowRight, Hash, MessageSquareText } from 'lucide-react';
import {
  ActionButton,
  ContentDialog,
  FormField,
  GlyphSurface,
  GuidedEmptyState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha } from '@mui/material/styles';

import { useMessagingMeetingLabels } from './meeting';
import { MessagingMeetingHost } from './messaging-meeting-host';
import { messagingVisualTokens } from './messaging-visual-model';

import type { MessagingConversation } from '@dwp-frontend/shared-utils';
import type { Theme } from '@mui/material/styles';

export function MessagingHomeHuddle({
  conversations,
  userId,
  displayName,
}: {
  conversations: MessagingConversation[];
  userId: number;
  displayName: string;
}) {
  const { t } = useTranslation('messaging');
  const labels = useMessagingMeetingLabels();
  const compact = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MessagingConversation | null>(null);
  const options = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return conversations.filter(
      (item) =>
        item.lifecycleState === 'ACTIVE' &&
        (!query ||
          `${item.name ?? ''} ${item.linkedSpaceName ?? ''}`.toLocaleLowerCase().includes(query))
    );
  }, [conversations, search]);

  return (
    <>
      <Box
        component="section"
        aria-labelledby="messaging-home-huddle-title"
        data-testid="messaging-home-huddle"
        sx={(theme) => ({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 2,
          borderRadius: messagingVisualTokens.radius.surface,
          bgcolor:
            theme.palette.mode === 'dark'
              ? theme.palette.background.paper
              : theme.palette.primary.dark,
          color:
            theme.palette.mode === 'dark'
              ? theme.palette.text.primary
              : theme.palette.primary.contrastText,
          border: 1,
          borderColor: theme.palette.mode === 'dark' ? theme.palette.divider : 'transparent',
        })}
      >
        <Box sx={{ flex: '1 1 230px', minWidth: 0 }}>
          <Stack direction="row" spacing={0.9} alignItems="center">
            <Headphones size={18} aria-hidden="true" />
            <Typography
              id="messaging-home-huddle-title"
              component="h2"
              variant="subtitle1"
              fontWeight="fontWeightBold"
            >
              {t('home.huddle.title')}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.6, lineHeight: 'body2.lineHeight' }}
          >
            {t('home.huddle.description')}
          </Typography>
        </Box>
        <ActionButton
          intent="secondary"
          size="small"
          startIcon={<Headphones size={15} />}
          onClick={() => {
            setSearch('');
            setChoosing(true);
          }}
          sx={(theme) => ({
            flexShrink: 0,
            bgcolor:
              theme.palette.mode === 'dark'
                ? theme.palette.primary.main
                : theme.palette.background.paper,
            color:
              theme.palette.mode === 'dark'
                ? theme.palette.primary.contrastText
                : theme.palette.primary.dark,
            '&:hover': {
              bgcolor:
                theme.palette.mode === 'dark'
                  ? theme.palette.primary.dark
                  : theme.palette.grey[100],
            },
          })}
        >
          {t('home.huddle.choose')}
        </ActionButton>
      </Box>
      <ContentDialog
        open={choosing}
        title={t('home.huddle.chooseTitle')}
        description={t('home.huddle.chooseDescription')}
        closeLabel={t('actions.close')}
        onClose={() => setChoosing(false)}
        fullScreen={compact}
        contentSx={{ px: 2, pb: 2 }}
      >
        <FormField
          fullWidth
          size="small"
          label={t('home.huddle.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            },
          }}
        />
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          {options.length ? (
            options.map((conversation) => (
              <ButtonBase
                key={conversation.conversationId}
                onClick={() => {
                  setChoosing(false);
                  setSelected(conversation);
                }}
                sx={(theme) => ({
                  px: 1.25,
                  py: 1.2,
                  textAlign: 'left',
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                  gap: 1.15,
                  borderRadius: messagingVisualTokens.radius.compact,
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                  '&:focus-visible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: -2,
                  },
                })}
              >
                <GlyphSurface size={32} variant="soft" tone={messagingVisualTokens.tones.channel}>
                  {conversation.visibility === 'SPACE' ? (
                    <Hash size={16} />
                  ) : (
                    <MessageSquareText size={16} />
                  )}
                </GlyphSurface>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight="fontWeightBold"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {conversation.name ?? t('conversation.untitled')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('conversation.members', { count: conversation.memberCount })}
                  </Typography>
                </Box>
                <ArrowRight size={16} aria-hidden="true" />
              </ButtonBase>
            ))
          ) : (
            <GuidedEmptyState
              kind={search ? 'no-results' : 'empty'}
              title={t('home.huddle.emptyTitle')}
              description={t('home.huddle.emptyDescription')}
            />
          )}
        </Stack>
      </ContentDialog>
      {selected && (
        <MessagingMeetingHost
          open
          conversationId={selected.conversationId}
          conversationName={selected.name ?? t('conversation.untitled')}
          displayName={displayName}
          currentUserId={userId}
          canModerateConversation={false}
          labels={labels}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
