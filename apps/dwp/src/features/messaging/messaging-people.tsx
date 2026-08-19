import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus, Search } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  createDirectMessagingConversation,
  searchMessagingPeople,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, GuidedEmptyState, PageCanvas } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MessagingPageHeading, MessagingPersonLine } from './messaging-components';

export function MessagingPeople() {
  const { t } = useTranslation('messaging');
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const query = useQuery({
    queryKey: ['messaging', 'people', debouncedSearch],
    queryFn: () => searchMessagingPeople(debouncedSearch),
    staleTime: 20_000,
    retry: 1,
  });
  const directMutation = useMutation({
    mutationFn: createDirectMessagingConversation,
    onSuccess: (conversation) => {
      navigate(`/messages/direct?conversation=${conversation.conversationId}`);
    },
    onError: () => toast.error(t('people.openError')),
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => window.clearTimeout(timeout);
  }, [search]);

  return (
    <PageCanvas topInset="compact">
      <MessagingPageHeading
        eyebrow={t('people.eyebrow')}
        title={t('people.title')}
        description={t('people.description')}
      />

      <Box sx={{ maxWidth: 920 }}>
        <FormField
          fullWidth
          size="small"
          value={search}
          placeholder={t('people.search')}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} />
                </InputAdornment>
              ),
            },
          }}
        />

        <Box
          sx={{
            mt: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
          }}
        >
          {query.isLoading ? (
            <Stack spacing={1} sx={{ p: 2 }}>
              {[0, 1, 2, 3, 4].map((item) => (
                <Skeleton key={item} variant="rounded" height={56} />
              ))}
            </Stack>
          ) : query.isError ? (
            <Alert severity="error" sx={{ m: 2 }}>
              {t('people.loadError')}
            </Alert>
          ) : query.data?.length ? (
            <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
              {query.data.map((person) => (
                <Box key={person.userId} sx={{ px: 2, py: 1.4 }}>
                  <MessagingPersonLine
                    person={person}
                    action={
                      <ActionButton
                        intent="quiet"
                        size="small"
                        startIcon={<MessageSquarePlus size={15} />}
                        disabled={directMutation.isPending}
                        onClick={() => directMutation.mutate(person.userId)}
                      >
                        {t('people.message')}
                      </ActionButton>
                    }
                  />
                </Box>
              ))}
            </Stack>
          ) : (
            <Box sx={{ minHeight: 340, display: 'grid', placeItems: 'center', p: 2 }}>
              <GuidedEmptyState
                kind={search ? 'no-results' : 'empty'}
                title={t('people.emptyTitle')}
                description={t('people.emptyDescription')}
              />
            </Box>
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {t('people.directoryNote')}
        </Typography>
      </Box>
    </PageCanvas>
  );
}
