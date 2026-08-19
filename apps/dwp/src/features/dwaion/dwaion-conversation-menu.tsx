import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, MessageSquarePlus, Trash2 } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { deleteDwaionConversation, getDwaionConversations } from '@dwp-frontend/shared-utils';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import ListItemButton from '@mui/material/ListItemButton';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type DwaionConversationMenuProps = {
  currentConversationId?: string | null;
  onSelect: (conversationId: string) => void;
  onNew: () => void;
};

export function DwaionConversationMenu({
  currentConversationId,
  onSelect,
  onNew,
}: DwaionConversationMenuProps) {
  const { t, i18n } = useTranslation('work');
  const queryClient = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const conversations = useQuery({
    queryKey: ['dwaion', 'conversations'],
    queryFn: getDwaionConversations,
    enabled: Boolean(anchor),
    staleTime: 15_000,
  });
  const remove = useMutation({
    mutationFn: deleteDwaionConversation,
    onSuccess: async (_, conversationId) => {
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'conversations'] });
      if (conversationId === currentConversationId) onNew();
    },
  });

  return (
    <>
      <ActionIconButton
        label={t('askPage.history.open')}
        tooltip={t('askPage.history.open')}
        size="small"
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <History size={17} aria-hidden="true" />
      </ActionIconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { width: 340, maxWidth: 'calc(100vw - 24px)', mt: 0.75 } } }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 1.5, py: 1 }}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight={800}>
              {t('askPage.history.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('askPage.history.encrypted')}
            </Typography>
          </Box>
          <ActionIconButton
            label={t('askPage.actions.newQuestion')}
            size="small"
            onClick={() => {
              setAnchor(null);
              onNew();
            }}
          >
            <MessageSquarePlus size={17} aria-hidden="true" />
          </ActionIconButton>
        </Stack>
        <Box sx={{ maxHeight: 360, overflowY: 'auto', borderTop: 1, borderColor: 'divider' }}>
          {conversations.data?.length ? (
            conversations.data.map((conversation) => (
              <ListItemButton
                key={conversation.conversationId}
                selected={conversation.conversationId === currentConversationId}
                onClick={() => {
                  setAnchor(null);
                  onSelect(conversation.conversationId);
                }}
                sx={{ gap: 1, py: 1.1 }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {conversation.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(
                      conversation.lastMessageAt,
                      { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
                      resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
                    )}
                  </Typography>
                </Box>
                <ActionIconButton
                  label={t('askPage.history.delete')}
                  size="small"
                  disabled={remove.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    remove.mutate(conversation.conversationId);
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </ActionIconButton>
              </ListItemButton>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 2 }}>
              {conversations.isLoading ? t('askPage.history.loading') : t('askPage.history.empty')}
            </Typography>
          )}
        </Box>
      </Menu>
    </>
  );
}
