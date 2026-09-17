import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  GuidedEmptyState,
  foundationTokens,
  InlineFeedback,
  LiveStatus,
  LoadingState,
  LocalErrorState,
  PageCanvas,
  ResourcePageHeader,
} from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  analyzeDwaionProposals,
  clearDwaionProposalInbox,
  createDwaionProposalHandoff,
  decideDwaionProposal,
  getDwaionProposalHandoffDraft,
  getDwaionProposalAnalysisPreference,
  getDwaionProposalHandoff,
  getDwaionProposals,
  saveDwaionProposalHandoffDraft,
  updateDwaionProposalAnalysisPreference,
  useToast,
  newDwaionCommandAttempt,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { useDwaionProposalSelection } from './use-dwaion-proposal-selection';
import { DwaionProposalDetail } from './dwaion-proposal-detail';
import {
  DwaionProposalFilterBar,
  DwaionProposalMetrics,
  DwaionProposalPreview,
} from './dwaion-proposal-inbox-panels';
import { DwaionProposalList } from './dwaion-proposal-list';
import { DwaionProposalControls } from './dwaion-proposal-controls';
import {
  DwaionProposalContextStrip,
  DwaionProposalMobileToolbar,
} from './dwaion-proposal-mobile-toolbar';

import type {
  DwaionProposal,
  DwaionProposalAnalysisReceipt,
  DwaionProposalDecision,
  DwaionProposalInboxView,
} from '@dwp-frontend/shared-utils';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';
import { DwaionProposalActionReview } from './dwaion-proposal-action-review';
import { createDwaionProposalTargetState } from './dwaion-proposal-handoff-navigation';

import type {
  DwaionCommandAttempt,
  DwaionProposalHandoff,
  DwaionProposalHandoffDraft,
} from '@dwp-frontend/shared-utils';

const PAGE_SIZE = 50;
const ANALYSIS_PREFERENCE_QUERY_KEY = ['dwaion', 'proposal-analysis-preference'] as const;

export function DwaionProposals() {
  const { t, i18n } = useTranslation('work');
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const governDecision = useDwaionGovernedMutation('route.dwaion.work.proposal-decision.action');
  const governAnalysis = useDwaionGovernedMutation('route.dwaion.work.proposal-analyze.action');
  const governPreference = useDwaionGovernedMutation(
    'route.dwaion.work.proposal-preferences-update.action'
  );
  const governClear = useDwaionGovernedMutation('route.dwaion.work.proposal-clear.action');
  const governHandoff = useDwaionGovernedMutation('route.dwaion.work.proposal-handoff.action');
  const governHandoffDraft = useDwaionGovernedMutation(
    'route.dwaion.work.proposal-handoff-draft.action'
  );
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const view: DwaionProposalInboxView =
    requestedView === 'ACTIVE' || requestedView === 'SNOOZED' || requestedView === 'HANDLED'
      ? requestedView
      : 'ALL';
  const selection = useDwaionProposalSelection(searchParams, setSearchParams);
  const selected = selection.proposal;
  const returnFocusId = useRef<string | null>(null);
  const [analysisReceipt, setAnalysisReceipt] = useState<DwaionProposalAnalysisReceipt | null>(
    null
  );
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [proposalHandoff, setProposalHandoff] = useState<DwaionProposalHandoff | null>(null);
  const [handoffUiError, setHandoffUiError] = useState(false);
  const handoffAttempts = useRef(new Map<string, DwaionCommandAttempt>());
  const handoffDraftAttempts = useRef(new Map<string, DwaionCommandAttempt>());
  const persistedHandoff = useQuery({
    queryKey: ['dwaion', 'proposal-handoff', selected?.proposalId],
    queryFn: ({ signal }) => getDwaionProposalHandoff(selected!.proposalId, signal),
    enabled: selected?.state === 'ACCEPTED' && Boolean(selected.actionKey),
    retry: false,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state && !['COMPLETED', 'FAILED', 'CANCELLED', 'COMPENSATED'].includes(state)
        ? 2_500
        : false;
    },
  });
  const persistedHandoffDraft = useQuery<DwaionProposalHandoffDraft | null>({
    queryKey: ['dwaion', 'proposal-handoff-draft', proposalHandoff?.handoffId],
    queryFn: ({ signal }) => getDwaionProposalHandoffDraft(proposalHandoff!.handoffId, signal),
    enabled:
      Boolean(proposalHandoff?.handoffId) && proposalHandoff?.proposalId === selected?.proposalId,
    retry: false,
  });
  const analysisPreference = useQuery({
    queryKey: ANALYSIS_PREFERENCE_QUERY_KEY,
    queryFn: getDwaionProposalAnalysisPreference,
    staleTime: 15_000,
    retry: 1,
  });
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
  const sourceOptions = useMemo(
    () =>
      [
        ...new Set(
          proposals.flatMap(
            (proposal) => proposal.content.evidence?.map((item) => item.sourceType) ?? []
          )
        ),
      ].sort(),
    [proposals]
  );
  const visibleProposals = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return proposals.filter((proposal) => {
      const searchable = [
        proposal.content.title,
        proposal.content.summary,
        proposal.content.rationale,
        ...(proposal.content.evidence?.map((item) => item.label) ?? []),
      ]
        .join(' ')
        .toLocaleLowerCase();
      return (
        (!term || searchable.includes(term)) &&
        (source === 'ALL' ||
          proposal.content.evidence?.some((item) => item.sourceType === source)) &&
        (priority === 'ALL' || proposal.priority === priority)
      );
    });
  }, [priority, proposals, query, source]);
  const summary = inbox.data?.pages[0]?.summary ?? {
    active: 0,
    highPriority: 0,
    snoozed: 0,
    handled: 0,
  };
  const previewProposal = selection.unavailable ? null : (selected ?? visibleProposals[0] ?? null);
  const handoffMutation = useMutation({
    mutationFn: async (proposal: DwaionProposal) => {
      const current = handoffAttempts.current.get(proposal.proposalId) ?? newDwaionCommandAttempt();
      handoffAttempts.current.set(proposal.proposalId, current);
      return governHandoff((authority) =>
        createDwaionProposalHandoff(
          proposal.proposalId,
          proposal.revision,
          proposal.content.actionInputs ?? {},
          current,
          authority
        )
      );
    },
    onSuccess: (handoff) => {
      setProposalHandoff(handoff);
      setHandoffUiError(false);
      queryClient.setQueryData(['dwaion', 'proposal-handoff', handoff.proposalId], handoff);
    },
    onError: () => {
      setHandoffUiError(true);
      toast.error(t('dwaionProposals.feedback.error'));
    },
  });
  const handoffDraftMutation = useMutation({
    mutationFn: async ({
      proposal,
      handoff,
    }: {
      proposal: DwaionProposal;
      handoff: DwaionProposalHandoff;
    }) => {
      const attemptKey = `${handoff.handoffId}:${handoff.version}`;
      const attempt = handoffDraftAttempts.current.get(attemptKey) ?? newDwaionCommandAttempt();
      handoffDraftAttempts.current.set(attemptKey, attempt);
      const result = await governHandoffDraft((authority) =>
        saveDwaionProposalHandoffDraft(
          handoff.handoffId,
          handoff.version,
          proposal.content.actionInputs ?? {},
          attempt.commandId,
          authority
        )
      );
      handoffDraftAttempts.current.delete(attemptKey);
      return result;
    },
    onSuccess: (draft) => {
      queryClient.setQueryData(['dwaion', 'proposal-handoff-draft', draft.handoffId], draft);
    },
    onError: () => toast.error(t('dwaionProposals.feedback.error')),
  });
  const decision = useMutation({
    mutationFn: ({
      proposal,
      value,
      snoozeUntil,
    }: {
      proposal: DwaionProposal;
      value: DwaionProposalDecision;
      snoozeUntil?: string;
    }) =>
      governDecision((authority) =>
        decideDwaionProposal(proposal.proposalId, value, proposal.revision, snoozeUntil, authority)
      ),
    onSuccess: async (receipt, variables) => {
      selection.receive(receipt.proposal);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'proposals'] });
      toast.success(t(`dwaionProposals.feedback.${variables.value}`));
      if (
        variables.value === 'ACCEPT' &&
        receipt.actionReviewRequired &&
        receipt.proposal.actionKey
      ) {
        handoffMutation.mutate(receipt.proposal);
      }
    },
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dwaion', 'proposals'] }),
        selection.refresh(),
      ]);
      toast.error(t('dwaionProposals.feedback.error'));
    },
  });
  const analysis = useMutation({
    mutationFn: () => governAnalysis((authority) => analyzeDwaionProposals(authority)),
    onSuccess: async (receipt) => {
      setAnalysisReceipt(receipt);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'proposals'] });
      toast.success(t('dwaionProposals.feedback.analyzed', { count: receipt.actionableProposals }));
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ANALYSIS_PREFERENCE_QUERY_KEY });
      toast.error(t('dwaionProposals.feedback.analysisError'));
    },
  });
  const preferenceMutation = useMutation({
    mutationFn: (enabled: boolean) => {
      if (!analysisPreference.data) throw new Error('Proposal analysis preference is unavailable.');
      return governPreference((authority) =>
        updateDwaionProposalAnalysisPreference(
          analysisPreference.data!.revision,
          enabled,
          authority
        )
      );
    },
    onSuccess: (preference) => {
      queryClient.setQueryData(ANALYSIS_PREFERENCE_QUERY_KEY, preference);
      toast.success(
        t(
          preference.proactiveAnalysisEnabled
            ? 'dwaionProposals.feedback.preferenceEnabled'
            : 'dwaionProposals.feedback.preferenceDisabled'
        )
      );
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ANALYSIS_PREFERENCE_QUERY_KEY });
      toast.error(t('dwaionProposals.feedback.preferenceError'));
    },
  });
  const clearInbox = useMutation({
    mutationFn: () => governClear((authority) => clearDwaionProposalInbox(authority)),
    onSuccess: async (receipt) => {
      await selection.clearCached();
      selection.close();
      setAnalysisReceipt(null);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'proposals'] });
      toast.success(t('dwaionProposals.feedback.cleared', { count: receipt.hiddenCount }));
    },
    onError: () => toast.error(t('dwaionProposals.feedback.clearError')),
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
          onRefresh={() => {
            void inbox.refetch();
            void selection.refresh();
          }}
        />
      }
    />
  );

  const closeDetail = () => {
    returnFocusId.current = selected?.proposalId ?? null;
    selection.close();
  };

  useEffect(() => {
    if (selected || !returnFocusId.current) return;
    document
      .querySelector<HTMLElement>(`[data-dwaion-proposal-id="${returnFocusId.current}"]`)
      ?.focus();
    returnFocusId.current = null;
  }, [selected]);

  useEffect(() => {
    if (proposalHandoff && proposalHandoff.proposalId !== selected?.proposalId) {
      setProposalHandoff(null);
      setHandoffUiError(false);
    }
  }, [proposalHandoff, selected?.proposalId]);

  useEffect(() => {
    if (persistedHandoff.data) setProposalHandoff(persistedHandoff.data);
  }, [persistedHandoff.data]);

  if (selected && proposalHandoff && proposalHandoff.proposalId === selected.proposalId) {
    const attempt = handoffAttempts.current.get(selected.proposalId);
    return (
      <PageCanvas topInset="compact">
        <DwaionProposalActionReview
          proposal={selected}
          handoff={proposalHandoff}
          draft={persistedHandoffDraft.data ?? null}
          idempotencyKey={attempt?.idempotencyKey ?? proposalHandoff.handoffId}
          locale={locale}
          busy={handoffMutation.isPending || handoffDraftMutation.isPending}
          error={handoffUiError}
          draftLoading={persistedHandoffDraft.isLoading}
          draftError={persistedHandoffDraft.isError || handoffDraftMutation.isError}
          onRetry={() => handoffMutation.mutate(selected)}
          onRetryDraft={() => void persistedHandoffDraft.refetch()}
          onSaveDraft={() =>
            handoffDraftMutation.mutate({ proposal: selected, handoff: proposalHandoff })
          }
          onBack={() => setProposalHandoff(null)}
          onOpenTarget={() => {
            void createDwaionProposalTargetState(selected, proposalHandoff)
              .then((state) => navigate(proposalHandoff.targetRoute, { state }))
              .catch(() => setHandoffUiError(true));
          }}
        />
      </PageCanvas>
    );
  }

  if (selected)
    return (
      <PageCanvas topInset="compact">
        <DwaionProposalDetail
          proposal={selected}
          open
          busy={decision.isPending || handoffMutation.isPending}
          locale={locale}
          onClose={closeDetail}
          onAccept={(proposal) => decision.mutate({ proposal, value: 'ACCEPT' })}
          onSnooze={(proposal, snoozeUntil) =>
            decision.mutate({ proposal, value: 'SNOOZE', snoozeUntil })
          }
          onDismiss={(proposal) => decision.mutate({ proposal, value: 'DISMISS' })}
          onReviewAction={(proposal) => handoffMutation.mutate(proposal)}
        />
      </PageCanvas>
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
      <DwaionProposalContextStrip />
      <Box
        sx={{
          display: { xs: 'block', md: 'grid' },
          gridTemplateColumns: { md: 'minmax(340px, 0.9fr) minmax(520px, 1.35fr)' },
          alignItems: 'end',
          gap: { md: 3 },
        }}
      >
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>{header}</Box>
        <DwaionProposalMobileToolbar
          reviewCount={summary.active}
          filtersOpen={mobileFiltersOpen}
          onToggleFilters={() => setMobileFiltersOpen((current) => !current)}
        />
        <DwaionProposalControls
          preference={analysisPreference.data}
          preferenceLoading={analysisPreference.isLoading}
          preferenceError={analysisPreference.isError}
          analysisReceipt={analysisReceipt}
          analyzing={analysis.isPending}
          updatingPreference={preferenceMutation.isPending}
          clearing={clearInbox.isPending}
          sourceTypeCount={sourceOptions.length}
          onAnalyze={() => analysis.mutate()}
          onPreferenceChange={(enabled) => preferenceMutation.mutate(enabled)}
          onClear={async () => {
            await clearInbox.mutateAsync();
          }}
        />
      </Box>
      {selection.pending && <LoadingState label={t('dwaionProposals.loading')} />}
      {selection.unavailable && (
        <InlineFeedback
          severity="warning"
          sx={{ mt: 2 }}
          onClose={selection.close}
          closeLabel={t('dwaionProposals.detail.close')}
        >
          {t('dwaionProposals.selectionUnavailable')}
        </InlineFeedback>
      )}
      <DwaionProposalMetrics summary={summary} />

      <Box
        component="section"
        aria-labelledby="dwaion-proposal-list"
        sx={{ mt: { xs: 1.5, md: 2.5 } }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
          gap={1.5}
        >
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
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
                setQuery('');
                setSource('ALL');
                setPriority('ALL');
                setSearchParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.delete('proposal');
                  if (value === 'ALL') next.delete('view');
                  else next.set('view', value);
                  return next;
                });
              }
            }}
            aria-label={t('dwaionProposals.filterLabel')}
            sx={{
              width: { xs: '100%', md: 'auto' },
              overflowX: { xs: 'auto', md: 'visible' },
              justifyContent: { xs: 'flex-start', md: 'center' },
              gap: { xs: 0.75, md: 0 },
              '& .MuiToggleButtonGroup-grouped': {
                flex: { xs: '1 0 auto', md: 'initial' },
                px: { xs: 1.3, md: 1.5 },
                border: { xs: '0 !important', md: undefined },
                borderRadius: {
                  xs: foundationTokens.radius.surface * 125 + 'px !important',
                  md: undefined,
                },
                bgcolor: { xs: 'var(--dwp-product-soft)', md: 'transparent' },
              },
              '& .MuiToggleButton-root': { color: 'text.primary', minHeight: 44 },
              '& .MuiToggleButton-root.Mui-selected': {
                color: { xs: 'primary.contrastText', md: 'text.primary' },
                bgcolor: { xs: 'primary.main', md: 'action.selected' },
                '&:hover': { bgcolor: { xs: 'primary.dark', md: 'action.selected' } },
              },
            }}
          >
            {(['ALL', 'ACTIVE', 'SNOOZED', 'HANDLED'] as const).map((value) => (
              <ToggleButton key={value} value={value}>
                {t(`dwaionProposals.views.${value}`)}
                <Typography
                  component="span"
                  variant="caption"
                  aria-hidden="true"
                  sx={{ ml: 0.65, fontWeight: 'fontWeightBold' }}
                >
                  {value === 'ALL'
                    ? summary.active + summary.snoozed + summary.handled
                    : value === 'ACTIVE'
                      ? summary.active
                      : value === 'SNOOZED'
                        ? summary.snoozed
                        : summary.handled}
                </Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        <DwaionProposalFilterBar
          query={query}
          source={source}
          priority={priority}
          sources={sourceOptions}
          onQueryChange={setQuery}
          onSourceChange={setSource}
          onPriorityChange={setPriority}
          mobileOpen={mobileFiltersOpen}
        />

        <InlineFeedback severity="info" sx={{ display: { xs: 'none', md: 'flex' }, mt: 1.25 }}>
          {t('dwaionProposals.inbox.individualReview')}
        </InlineFeedback>

        <InlineFeedback severity="info" sx={{ display: { xs: 'flex', md: 'none' }, mt: 1.25 }}>
          {t('dwaionProposals.actions.reviewBoundary')}
        </InlineFeedback>

        {proposals.length ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'minmax(0, 1.45fr) minmax(350px, 0.95fr)',
              },
              alignItems: 'start',
              gap: 2,
              mt: 2,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap={1}
                sx={{ display: { xs: 'none', md: 'flex' }, mb: 1 }}
              >
                <Typography variant="subtitle2" color="text.secondary" fontWeight="fontWeightBold">
                  {t('dwaionProposals.inbox.triageCount', { count: visibleProposals.length })}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: { xs: 'none', md: 'block' } }}
                >
                  {t('dwaionProposals.inbox.selectionHint')}
                </Typography>
              </Stack>
              {visibleProposals.length ? (
                <DwaionProposalList
                  proposals={visibleProposals}
                  selectedId={previewProposal?.proposalId}
                  locale={locale}
                  onSelect={selection.select}
                />
              ) : (
                <GuidedEmptyState
                  kind="no-results"
                  title={t('dwaionProposals.inbox.noMatches')}
                  description={t('dwaionProposals.inbox.noMatchesDescription')}
                />
              )}
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
            <Box sx={{ display: { xs: 'none', lg: 'block' }, minWidth: 0 }}>
              <DwaionProposalPreview
                proposal={previewProposal}
                locale={locale}
                onOpen={selection.select}
              />
            </Box>
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

        <Stack
          direction="row"
          alignItems="flex-start"
          gap={1}
          sx={{
            display: { xs: 'flex', md: 'none' },
            mt: 2,
            p: 1.4,
            borderRadius:
              foundationTokens.radius.surface + foundationTokens.radius.compact / 2 + 'px',
            bgcolor: 'var(--dwp-product-soft)',
            color: 'text.secondary',
          }}
        >
          <ShieldCheck size={18} color="var(--dwp-product-secondary)" aria-hidden="true" />
          <Box>
            <Typography variant="body2" fontWeight="fontWeightBold" color="success.dark">
              {t('dwaionProposals.policyBoundary')}
            </Typography>
            <Typography variant="caption">
              {t('dwaionProposals.mobile.sourceStatus', { count: sourceOptions.length })}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </PageCanvas>
  );
}
