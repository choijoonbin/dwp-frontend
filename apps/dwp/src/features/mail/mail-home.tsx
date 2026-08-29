import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MailPlus, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  decideMailProposal,
  getMailHome,
  getMailOrganization,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MailPageHeading, MailProposalCard, MailThreadListItem } from './mail-components';
import { MailAutomationRhythm, MailDailyFlow } from './mail-home-journey';

import type { MailActionProposal } from '@dwp-frontend/shared-utils';

export function MailHome() {
  const { t } = useTranslation('mail');
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [proposalToAccept, setProposalToAccept] = useState<MailActionProposal | null>(null);
  const query = useQuery({
    queryKey: ['mail', 'home'],
    queryFn: getMailHome,
    staleTime: 30_000,
    retry: 1,
  });
  const organizationQuery = useQuery({
    queryKey: ['mail', 'organization'],
    queryFn: getMailOrganization,
    staleTime: 30_000,
    retry: 1,
  });
  const proposalMutation = useMutation({
    mutationFn: ({
      proposal,
      decision,
    }: {
      proposal: MailActionProposal;
      decision: 'ACCEPT' | 'DISMISS';
    }) => decideMailProposal(proposal.proposalId, decision, proposal.version),
    onSuccess: async (proposal, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      setProposalToAccept(null);
      if (variables.decision === 'ACCEPT') {
        toast.success(t('proposal.accepted'));
        if (proposal.targetRoute) navigate(proposal.targetRoute);
      } else {
        toast.success(t('proposal.dismissed'));
      }
    },
    onError: () => toast.error(t('proposal.error')),
  });
  const data = query.data;
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.greetingMorning');
    if (hour < 18) return t('home.greetingAfternoon');
    return t('home.greetingEvening');
  }, [t]);

  return (
    <PageCanvas>
      <MailPageHeading
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
              aria-label={t('actions.refresh')}
              startIcon={<RefreshCw size={17} />}
              onClick={() => query.refetch()}
            >
              {t('actions.refresh')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<MailPlus size={17} />}
              onClick={() => navigate('/mail/inbox?compose=open')}
            >
              {t('actions.compose')}
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
          <MailDailyFlow metrics={data.metrics} onNavigate={navigate} />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.5fr) minmax(340px, 1fr)' },
              gap: 3,
              alignItems: 'start',
            }}
          >
            <Box component="section" aria-labelledby="mail-focus-title" sx={{ minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={1.25}>
                <Box>
                  <Typography id="mail-focus-title" component="h2" variant="h6" fontWeight={800}>
                    {t('home.focus.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    {t('home.focus.description')}
                  </Typography>
                </Box>
                <ActionButton
                  intent="quiet"
                  size="small"
                  endIcon={<ArrowRight size={15} />}
                  onClick={() => navigate('/mail/inbox')}
                >
                  {t('home.focus.openInbox')}
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
                {data.focusQueue.length ? (
                  data.focusQueue.map((thread) => (
                    <MailThreadListItem
                      key={thread.threadId}
                      thread={thread}
                      onSelect={() => navigate(`/mail/inbox?thread=${thread.threadId}`)}
                    />
                  ))
                ) : (
                  <GuidedEmptyState
                    kind="empty"
                    title={t('home.focus.emptyTitle')}
                    description={t('home.focus.emptyDescription')}
                  />
                )}
              </Box>
            </Box>

            <Box component="section" aria-labelledby="mail-assistant-title" sx={{ minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={1.25}>
                <Box>
                  <Typography
                    id="mail-assistant-title"
                    component="h2"
                    variant="h6"
                    fontWeight={800}
                  >
                    {t('home.assistant.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    {t('home.assistant.description')}
                  </Typography>
                </Box>
                <ShieldCheck size={19} color="var(--dwp-product-accent)" />
              </Stack>
              <Stack spacing={1.25}>
                {data.proposals.length ? (
                  data.proposals.map((proposal) => (
                    <MailProposalCard
                      key={proposal.proposalId}
                      proposal={proposal}
                      busy={proposalMutation.isPending}
                      onAccept={() => setProposalToAccept(proposal)}
                      onDismiss={() => proposalMutation.mutate({ proposal, decision: 'DISMISS' })}
                    />
                  ))
                ) : (
                  <GuidedEmptyState
                    kind="empty"
                    title={t('home.assistant.emptyTitle')}
                    description={t('home.assistant.emptyDescription')}
                  />
                )}
              </Stack>
            </Box>
          </Box>

          {data.sharedInboxes.length > 0 && (
            <Box component="section" aria-labelledby="mail-shared-title">
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
                spacing={1}
                sx={{ mb: 1.25 }}
              >
                <Box>
                  <Typography id="mail-shared-title" component="h2" variant="h6" fontWeight={800}>
                    {t('home.shared.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    {t('home.shared.description')}
                  </Typography>
                </Box>
                <ActionButton
                  intent="quiet"
                  size="small"
                  endIcon={<ArrowRight size={15} />}
                  onClick={() => navigate('/mail/shared')}
                >
                  {t('home.shared.openInbox')}
                </ActionButton>
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  overflow: 'hidden',
                }}
              >
                {data.sharedInboxes.map((inbox, index) => (
                  <Box key={inbox.sharedInboxId} sx={{ p: 2.25, minWidth: 0 }}>
                    {index > 0 && <Divider sx={{ display: { md: 'none' }, mb: 2.25 }} />}
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <UsersRound size={20} color="var(--dwp-product-accent)" />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography fontWeight={800}>{inbox.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {inbox.address}
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 1.25 }}>
                          <Typography variant="body2">
                            {t('home.shared.open', { count: inbox.openCount })}
                          </Typography>
                          <Typography
                            variant="body2"
                            color={inbox.overdueCount ? 'error.main' : 'text.secondary'}
                          >
                            {t('home.shared.overdue', { count: inbox.overdueCount })}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {organizationQuery.isError ? (
            <Alert
              severity="warning"
              action={
                <ActionButton intent="quiet" onClick={() => organizationQuery.refetch()}>
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('home.automation.loadError')}
            </Alert>
          ) : organizationQuery.isLoading ? (
            <Skeleton variant="rounded" height={132} />
          ) : (
            <MailAutomationRhythm
              organization={organizationQuery.data}
              onOpen={() => navigate('/mail/organization')}
            />
          )}
        </Stack>
      ) : null}

      <ConfirmDialog
        open={Boolean(proposalToAccept)}
        title={proposalToAccept?.title ?? t('proposal.confirmTitle')}
        description={t('proposal.confirmDescription', {
          summary: proposalToAccept?.summary ?? '',
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('proposal.confirm')}
        confirmingLabel={t('proposal.confirming')}
        busy={proposalMutation.isPending}
        onClose={() => setProposalToAccept(null)}
        onConfirm={() => {
          if (proposalToAccept) {
            proposalMutation.mutate({ proposal: proposalToAccept, decision: 'ACCEPT' });
          }
        }}
      />
    </PageCanvas>
  );
}
