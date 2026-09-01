import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash, MessageSquareText, UserRound } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createDirectMessagingConversation,
  searchMessaging,
  useToast,
} from '@dwp-frontend/shared-utils';
import { CommandPaletteDialog } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ReactNode } from 'react';

export function MessagingSearchPalette({
  open,
  onClose,
  onOpenConversation,
}: {
  open: boolean;
  onClose: () => void;
  onOpenConversation: (conversationId: string) => void;
}) {
  const { t } = useTranslation('messaging');
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const search = useQuery({
    queryKey: ['messaging', 'search', debouncedQuery],
    queryFn: () => searchMessaging({ query: debouncedQuery, limit: 30 }),
    enabled: open && debouncedQuery.length >= 2,
    staleTime: 15_000,
    retry: 1,
  });
  const directMutation = useMutation({
    mutationFn: createDirectMessagingConversation,
    onSuccess: (conversation) => {
      onOpenConversation(conversation.conversationId);
      onClose();
    },
    onError: () => toast.error(t('people.openError')),
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 240);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
    }
  }, [open]);

  const results = search.data?.results;
  const resultCount = search.data?.total ?? 0;

  return (
    <CommandPaletteDialog
      open={open}
      label={t('search.title')}
      placeholder={t('search.placeholder')}
      query={query}
      onQueryChange={setQuery}
      onClose={onClose}
    >
      <List disablePadding sx={{ py: 0.75, maxHeight: 480, overflowY: 'auto' }}>
        {query.trim().length < 2 ? (
          <PaletteStatus>{t('search.minimum')}</PaletteStatus>
        ) : search.isFetching && !results ? (
          <Stack
            direction="row"
            spacing={1.2}
            alignItems="center"
            role="status"
            sx={{ px: 2, py: 3 }}
          >
            <CircularProgress size={18} aria-hidden="true" />
            <Typography variant="body2" color="text.secondary">
              {t('search.loading')}
            </Typography>
          </Stack>
        ) : search.isError ? (
          <PaletteStatus>{t('search.error')}</PaletteStatus>
        ) : resultCount === 0 ? (
          <PaletteStatus>{t('search.empty')}</PaletteStatus>
        ) : (
          <>
            {results?.conversations.length ? (
              <ResultSection label={t('search.groups.conversations')}>
                {results.conversations.map((result) => (
                  <ResultRow
                    key={`conversation:${result.conversationId}`}
                    icon={<Hash size={18} />}
                    primary={result.name}
                    secondary={result.snippet}
                    onClick={() => {
                      onOpenConversation(result.conversationId);
                      onClose();
                    }}
                  />
                ))}
              </ResultSection>
            ) : null}
            {results?.messages.length ? (
              <ResultSection label={t('search.groups.messages')}>
                {results.messages.map((result) => (
                  <ResultRow
                    key={`message:${result.messageId}`}
                    icon={<MessageSquareText size={18} />}
                    primary={`${result.senderName} · ${result.conversationName ?? t('conversation.untitled')}`}
                    secondary={result.snippet}
                    onClick={() => {
                      onOpenConversation(result.conversationId);
                      onClose();
                    }}
                  />
                ))}
              </ResultSection>
            ) : null}
            {results?.people.length ? (
              <ResultSection label={t('search.groups.people')}>
                {results.people.map((result) => (
                  <ResultRow
                    key={`person:${result.userId}`}
                    icon={<UserRound size={18} />}
                    primary={result.displayName}
                    secondary={[result.jobTitle, result.organizationName, result.emailAddress]
                      .filter(Boolean)
                      .join(' · ')}
                    disabled={directMutation.isPending}
                    onClick={() => directMutation.mutate(result.userId)}
                  />
                ))}
              </ResultSection>
            ) : null}
          </>
        )}
      </List>
    </CommandPaletteDialog>
  );
}

function ResultSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <ListSubheader component="div" disableSticky sx={{ lineHeight: '34px', fontWeight: 800 }}>
        {label}
      </ListSubheader>
      <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {children}
      </Box>
    </Box>
  );
}

function ResultRow({
  icon,
  primary,
  secondary,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  primary: string;
  secondary?: string | null;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <ListItemButton
      component="li"
      disabled={disabled}
      onClick={onClick}
      sx={{ minHeight: 54, mx: 0.75, borderRadius: 1 }}
    >
      <ListItemIcon sx={{ minWidth: 38, color: 'text.secondary' }}>{icon}</ListItemIcon>
      <ListItemText
        primary={primary}
        secondary={secondary}
        primaryTypographyProps={{ variant: 'body2', fontWeight: 750, noWrap: true }}
        secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
      />
    </ListItemButton>
  );
}

function PaletteStatus({ children }: { children: ReactNode }) {
  return (
    <Typography color="text.secondary" variant="body2" sx={{ px: 2, py: 3 }}>
      {children}
    </Typography>
  );
}
