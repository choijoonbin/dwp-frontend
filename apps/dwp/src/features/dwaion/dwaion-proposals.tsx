import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  GuidedEmptyState,
  LiveStatus,
  LoadingState,
  LocalErrorState,
  OperationalKpiStrip,
  PageCanvas,
  ResourcePageHeader,
} from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { decideDwaionProposal, getDwaionProposals, useToast } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { DwaionProposalDetail } from './dwaion-proposal-detail';
import { DwaionProposalList } from './dwaion-proposal-list';

import type {
  DwaionProposal,
  DwaionProposalDecision,
  DwaionProposalInboxView,
} from '@dwp-frontend/shared-utils';

const PAGE_SIZE = 50;

export function DwaionProposals() {
  const { t, i18n } = useTranslation('work');
  const toast = useToast();
  const queryClient = useQueryClient();
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const [view, setView] = useState<DwaionProposalInboxView>('ACTIVE');
  const [selected, setSelected] = useState<DwaionProposal | null>(null);
  const inbox = useInfiniteQuery({
    queryKey: ['dwaion', 'proposals', view],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => getDwaionProposals(view, PAGE_SIZE, pageParam ?? undefined),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const proposals = useMemo(
    () => inbox.data?.pages.flatMap((page) => page.items) ?? [],
    [inbox.data?.pages]
  );
  const summary = inbox.data?.pages[0]?.summary ?? {
    active: 0,
    highPriority: 0,
    snoozed: 0,
    handled: 0,
  };
  const decision = useMutation({
    mutationFn: ({
      proposal,
      value,
      snoozeUntil,
    }: {
      proposal: DwaionProposal;
      value: DwaionProposalDecision;
      snoozeUntil?: string;
    }) => decideDwaionProposal(proposal.proposalId, value, proposal.revision, snoozeUntil),
    onSuccess: async (receipt, variables) => {
      setSelected(receipt.proposal);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'proposals'] });
      toast.success(t(`dwaionProposals.feedback.${variables.value}`));
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'proposals'] });
      toast.error(t('dwaionProposals.feedback.error'));
    },
  });

  const header = (
    <ResourcePageHeader
      eyebrow={t('dwaionProposals.eyebrow')}
      title={t('dwaionProposals.title')}
      description={t('dwaionProposals.description')}
      scope={
        <Stack direction="row" spacing={0.65} alignItems="center">
          <ShieldCheck size={15} color="var(--dwp-product-secondary)" aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {t('dwaionProposals.policyBoundary')}
          </Typography>
        </Stack>
      }
      status={
        <LiveStatus
          state={inbox.isError ? 'degraded' : inbox.isFetching ? 'syncing' : 'live'}
          label={t(
            inbox.isError ? 'dwaionProposals.status.degraded' : 'dwaionProposals.status.live'
          )}
          refreshLabel={t('dwaionProposals.refresh')}
          refreshing={inbox.isFetching}
          onRefresh={() => void inbox.refetch()}
        />
      }
    />
  );

  if (inbox.isLoading)
    return (
      <PageCanvas>
        {header}
        <LoadingState label={t('dwaionProposals.loading')} variant="skeleton" size="page" />
      </PageCanvas>
    );

  if (inbox.isError)
    return (
      <PageCanvas>
        {header}
        <LocalErrorState
          title={t('dwaionProposals.errorTitle')}
          description={t('dwaionProposals.errorDescription')}
          retryLabel={t('dwaionProposals.refresh')}
          onRetry={() => void inbox.refetch()}
          retrying={inbox.isFetching}
          size="page"
        />
      </PageCanvas>
    );

  return (
    <PageCanvas>
      {header}
      <Box sx={{ mt: 3 }}>
        <OperationalKpiStrip
          ariaLabel={t('dwaionProposals.summaryLabel')}
          items={[
            {
              key: 'active',
              value: summary.active,
              label: t('dwaionProposals.metrics.active'),
              detail: t('dwaionProposals.metrics.activeDetail'),
              tone: 'info',
            },
            {
              key: 'high',
              value: summary.highPriority,
              label: t('dwaionProposals.metrics.highPriority'),
              detail: t('dwaionProposals.metrics.highPriorityDetail'),
              tone: summary.highPriority ? 'warning' : 'neutral',
            },
            {
              key: 'snoozed',
              value: summary.snoozed,
              label: t('dwaionProposals.metrics.snoozed'),
              detail: t('dwaionProposals.metrics.snoozedDetail'),
            },
            {
              key: 'handled',
              value: summary.handled,
              label: t('dwaionProposals.metrics.handled'),
              detail: t('dwaionProposals.metrics.handledDetail'),
              tone: 'success',
            },
          ]}
        />
      </Box>

      <Box component="section" aria-labelledby="dwaion-proposal-list" sx={{ mt: 3.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          gap={1.5}
        >
          <Box>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Inbox size={18} color="var(--dwp-product-accent)" aria-hidden="true" />
              <Typography id="dwaion-proposal-list" component="h2" variant="h6">
                {t('dwaionProposals.listTitle')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {t('dwaionProposals.listDescription')}
            </Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, value: DwaionProposalInboxView | null) => {
              if (value) {
                setView(value);
                setSelected(null);
              }
            }}
            aria-label={t('dwaionProposals.filterLabel')}
          >
            {(['ACTIVE', 'SNOOZED', 'HANDLED'] as const).map((value) => (
              <ToggleButton key={value} value={value}>
                {t(`dwaionProposals.views.${value}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        {proposals.length ? (
          <Box sx={{ mt: 2 }}>
            <DwaionProposalList
              proposals={proposals}
              selectedId={selected?.proposalId}
              locale={locale}
              onSelect={setSelected}
            />
            {inbox.hasNextPage && (
              <Stack alignItems="center" sx={{ mt: 2 }}>
                <ActionButton
                  intent="quiet"
                  loading={inbox.isFetchingNextPage}
                  loadingLabel={t('dwaionProposals.loadingMore')}
                  onClick={() => void inbox.fetchNextPage()}
                >
                  {t('dwaionProposals.loadMore')}
                </ActionButton>
              </Stack>
            )}
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            <GuidedEmptyState
              kind="empty"
              title={t(`dwaionProposals.empty.${view}.title`)}
              description={t(`dwaionProposals.empty.${view}.description`)}
            />
          </Box>
        )}
      </Box>

      <DwaionProposalDetail
        proposal={selected}
        open={Boolean(selected)}
        busy={decision.isPending}
        locale={locale}
        onClose={() => setSelected(null)}
        onAccept={(proposal) => decision.mutate({ proposal, value: 'ACCEPT' })}
        onSnooze={(proposal, snoozeUntil) =>
          decision.mutate({ proposal, value: 'SNOOZE', snoozeUntil })
        }
        onDismiss={(proposal) => decision.mutate({ proposal, value: 'DISMISS' })}
      />
    </PageCanvas>
  );
}
