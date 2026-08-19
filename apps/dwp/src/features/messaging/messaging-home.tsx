import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MessageSquarePlus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getMessagingHome, useAuth } from '@dwp-frontend/shared-utils';
import { ActionButton, GuidedEmptyState, PageCanvas } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  MessagingConversationListItem,
  MessagingMetric,
  MessagingPageHeading,
  MessagingPersonLine,
} from './messaging-components';

export function MessagingHome() {
  const { t } = useTranslation('messaging');
  const auth = useAuth();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['messaging', 'home'],
    queryFn: getMessagingHome,
    staleTime: 20_000,
    retry: 1,
  });
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.greetingMorning');
    if (hour < 18) return t('home.greetingAfternoon');
    return t('home.greetingEvening');
  }, [t]);
  const data = query.data;

  return (
    <PageCanvas>
      <MessagingPageHeading
        eyebrow={t('home.eyebrow')}
        title={t('home.title', {
          greeting,
          name: auth.user?.displayName ?? t('home.member'),
        })}
        description={t('home.description')}
        actions={
          <Stack direction="row" spacing={1}>
            <ActionButton
              intent="quiet"
              startIcon={<RefreshCw size={17} />}
              onClick={() => query.refetch()}
            >
              {t('actions.refresh')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<MessageSquarePlus size={17} />}
              onClick={() => navigate('/messages/people')}
            >
              {t('actions.newDirect')}
            </ActionButton>
          </Stack>
        }
      />

      {query.isError && (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => query.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('home.loadError')}
        </Alert>
      )}

      {query.isLoading ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={148} />
          <Skeleton variant="rounded" height={420} />
        </Stack>
      ) : data ? (
        <Stack spacing={3}>
          <Box
            component="section"
            aria-label={t('home.signalSummary')}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(5, minmax(0, 1fr))' },
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              borderRadius: 1,
              overflow: 'hidden',
              '& > *': { borderBottom: { xs: 1, lg: 0 }, borderColor: 'divider' },
              '& > *:not(:last-child)': { borderRight: 1, borderColor: 'divider' },
            }}
          >
            <MessagingMetric
              label={t('home.metrics.unread')}
              value={data.metrics.unreadConversations}
              detail={t('home.metrics.unreadDetail')}
              tone="#2856C7"
            />
            <MessagingMetric
              label={t('home.metrics.mentions')}
              value={data.metrics.mentions}
              detail={t('home.metrics.mentionsDetail')}
              tone="#A73549"
            />
            <MessagingMetric
              label={t('home.metrics.spaces')}
              value={data.metrics.spaceChannels}
              detail={t('home.metrics.spacesDetail')}
              tone="#0F8B8D"
            />
            <MessagingMetric
              label={t('home.metrics.direct')}
              value={data.metrics.directMessages}
              detail={t('home.metrics.directDetail')}
              tone="#6B4BB8"
            />
            <MessagingMetric
              label={t('home.metrics.saved')}
              value={data.metrics.savedItems}
              detail={t('home.metrics.savedDetail')}
              tone="#B66A0A"
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.4fr) minmax(340px, 0.85fr)' },
              gap: 3,
              alignItems: 'start',
            }}
          >
            <Box
              component="section"
              aria-labelledby="messaging-priority-title"
              sx={{ minWidth: 0 }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={1.25}>
                <Box>
                  <Typography
                    id="messaging-priority-title"
                    component="h2"
                    variant="h6"
                    fontWeight={850}
                  >
                    {t('home.priority.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    {t('home.priority.description')}
                  </Typography>
                </Box>
                <ActionButton
                  intent="quiet"
                  size="small"
                  endIcon={<ArrowRight size={15} />}
                  onClick={() => navigate('/messages/inbox')}
                >
                  {t('home.priority.open')}
                </ActionButton>
              </Stack>
              <Box
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  overflow: 'hidden',
                }}
              >
                {data.priority.length ? (
                  data.priority.map((conversation) => (
                    <MessagingConversationListItem
                      key={conversation.conversationId}
                      conversation={conversation}
                      onSelect={() =>
                        navigate(`/messages/inbox?conversation=${conversation.conversationId}`)
                      }
                    />
                  ))
                ) : (
                  <GuidedEmptyState
                    kind="empty"
                    title={t('home.priority.emptyTitle')}
                    description={t('home.priority.emptyDescription')}
                  />
                )}
              </Box>
            </Box>

            <Stack spacing={2.5}>
              <Box component="section" aria-labelledby="messaging-space-title">
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-end"
                  mb={1.25}
                >
                  <Box>
                    <Typography
                      id="messaging-space-title"
                      component="h2"
                      variant="h6"
                      fontWeight={850}
                    >
                      {t('home.spaces.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      {t('home.spaces.description')}
                    </Typography>
                  </Box>
                  <ShieldCheck size={19} color="var(--dwp-product-accent)" />
                </Stack>
                <Box
                  sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
                >
                  {data.spaces.map((conversation) => (
                    <MessagingConversationListItem
                      key={conversation.conversationId}
                      compact
                      conversation={conversation}
                      onSelect={() =>
                        navigate(`/messages/spaces?conversation=${conversation.conversationId}`)
                      }
                    />
                  ))}
                </Box>
              </Box>

              <Box
                component="section"
                aria-labelledby="messaging-people-title"
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  p: 2,
                }}
              >
                <Typography
                  id="messaging-people-title"
                  component="h2"
                  variant="h6"
                  fontWeight={850}
                >
                  {t('home.people.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, mb: 1.5 }}>
                  {t('home.people.description')}
                </Typography>
                <Stack spacing={1.25}>
                  {data.people.slice(0, 5).map((person) => (
                    <MessagingPersonLine key={person.userId} person={person} />
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Stack>
      ) : null}
    </PageCanvas>
  );
}
