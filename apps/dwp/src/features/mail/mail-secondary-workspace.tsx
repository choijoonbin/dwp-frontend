import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, RefreshCw, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  decideMailProposal,
  getMailFollowUps,
  getMailProposals,
  getMailThreads,
  searchMailThreads,
  updateMailProposal,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { MailAddressBook } from './mail-address-book';
import { MailPageHeading, MailThreadListItem } from './mail-components';
import { MailDeliveryOperationsWorkspace } from './mail-delivery-operations-workspace';
import { MailFollowUpTracker } from './mail-follow-up-tracker';
import { MailOrganization } from './mail-organization';
import { MailProposalCard, MailProposalReviewDialog } from './mail-proposal-card';
import {
  MailProposalEditButton,
  MailProposalFilterControls,
  MailProposalPayloadEditor,
  mailProposalFiltersFromSearch,
  updateMailProposalFilterSearch,
} from './mail-proposal-workspace-controls';
import { MailSearchControls } from './mail-search-controls';
import {
  MailAccountsPreferencesWorkspace,
  MailTemplatesWorkspace,
} from './mail-secondary-workspace-availability';
import { MailThreadDetailPane } from './mail-thread-detail';
import { getMailSecondaryView } from './mail-secondary-workspace-model';

import type { TFunction } from 'i18next';
import type {
  MailActionProposal,
  MailSearchCriteria,
  MailThreadPage,
  MailTriageLane,
  MailWorkflowState,
} from '@dwp-frontend/shared-utils';
import type { MailSecondaryView } from './mail-secondary-workspace-model';

type ThreadListState = {
  data?: MailThreadPage;
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

function translated(t: TFunction, key: string, fallback: string) {
  return t(key, { defaultValue: fallback });
}

export function MailSecondaryWorkspace({ view }: { view: MailSecondaryView }) {
  switch (view) {
    case 'search':
      return <MailSearchWorkspace />;
    case 'follow-up':
      return <MailFollowUpWorkspace />;
    case 'delivery':
      return <MailDeliveryOperationsWorkspace />;
    case 'shared':
      return <MailSharedWorkspace />;
    case 'contacts':
    case 'groups':
      return <MailAddressBook />;
    case 'folders':
    case 'rules':
      return <MailOrganization />;
    case 'actions':
      return <MailActionCenterWorkspace />;
    case 'templates':
      return <MailTemplatesWorkspace />;
    case 'accounts':
      return <MailAccountsPreferencesWorkspace />;
  }
}

function MailSearchWorkspace() {
  const { t } = useTranslation('mail');
  const descriptor = getMailSecondaryView('search');
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftQuery, setDraftQuery] = useState(() => searchParams.get('query') ?? '');
  const queryText = searchParams.get('query')?.trim() ?? '';
  const workflowState = validWorkflowState(searchParams.get('state'));
  const lane = validTriageLane(searchParams.get('lane'));
  const criteria: MailSearchCriteria = {
    query: queryText || undefined,
    accountId: searchParams.get('accountId') || undefined,
    scope:
      searchParams.get('scope') === 'PERSONAL' || searchParams.get('scope') === 'SHARED'
        ? (searchParams.get('scope') as 'PERSONAL' | 'SHARED')
        : undefined,
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    unread: searchParams.get('unread') === 'true' || undefined,
    hasAttachment: searchParams.get('hasAttachment') === 'true' || undefined,
    state: workflowState ?? undefined,
    lane: lane ?? undefined,
  };
  const hasCriteria = Object.values(criteria).some((value) => value !== undefined && value !== '');
  const selectedId = searchParams.get('threadId');
  const query = useQuery({
    queryKey: ['mail', 'secondary', 'search', criteria],
    queryFn: () =>
      searchMailThreads({
        ...criteria,
        pageSize: 50,
      }),
    enabled: hasCriteria,
    staleTime: 20_000,
    retry: 1,
  });

  const updateSearch = (updates: Record<string, string | null>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (!('threadId' in updates)) next.delete('threadId');
      return next;
    });
  };

  return (
    <PageCanvas topInset="compact">
      <MailPageHeading
        eyebrow={translated(t, 'secondary.search.eyebrow', 'Mail search')}
        title={translated(t, descriptor.titleKey, descriptor.titleFallback)}
        description={translated(t, descriptor.descriptionKey, descriptor.descriptionFallback)}
      />
      <Box
        component="form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          updateSearch({ query: draftQuery.trim() || null });
        }}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
          gap: 1,
          mt: 2,
        }}
      >
        <FormField
          fullWidth
          type="search"
          value={draftQuery}
          label={t('home.searchLabel')}
          placeholder={t('home.searchPlaceholder')}
          onChange={(event) => setDraftQuery(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} aria-hidden />
                </InputAdornment>
              ),
            },
          }}
        />
        <ActionButton intent="primary" type="submit" startIcon={<Search size={16} />}>
          {t('home.searchAction')}
        </ActionButton>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
        <SelectField<string>
          size="small"
          label={translated(t, 'secondary.search.state', 'Message state')}
          value={workflowState ?? ''}
          options={[
            { value: '', label: translated(t, 'secondary.search.allStates', 'All states') },
            { value: 'OPEN', label: translated(t, 'secondary.search.open', 'Open') },
            { value: 'SNOOZED', label: t('home.metrics.snoozed') },
            { value: 'DONE', label: translated(t, 'secondary.search.done', 'Done') },
          ]}
          onValueChange={(value) => updateSearch({ state: value || null })}
        />
        <SelectField<string>
          size="small"
          label={translated(t, 'secondary.search.lane', 'Work queue')}
          value={lane ?? ''}
          options={[
            { value: '', label: translated(t, 'secondary.search.allQueues', 'All queues') },
            { value: 'PRIORITY', label: translated(t, 'secondary.search.priority', 'Priority') },
            { value: 'NEEDS_REPLY', label: t('home.metrics.needsReply') },
            { value: 'ASSIGNED', label: translated(t, 'secondary.search.assigned', 'Assigned') },
          ]}
          onValueChange={(value) => updateSearch({ lane: value || null })}
        />
      </Stack>

      <MailSearchControls criteria={criteria} onUpdate={updateSearch} />

      {!hasCriteria ? (
        <GuidedEmptyState
          kind="empty"
          title={translated(t, 'secondary.search.startTitle', 'Search your mail')}
          description={translated(
            t,
            'secondary.search.startDescription',
            'Enter a sender, subject, or phrase to find messages you can access.'
          )}
        />
      ) : (
        <MailListDetailWorkspace
          query={query}
          selectedId={selectedId}
          emptyTitle={translated(t, 'secondary.search.emptyTitle', 'No messages matched')}
          emptyDescription={translated(
            t,
            'secondary.search.emptyDescription',
            'Try a different phrase or remove a filter.'
          )}
          onSelect={(threadId) => updateSearch({ threadId })}
          onBack={() => updateSearch({ threadId: null })}
        />
      )}
    </PageCanvas>
  );
}

function MailFollowUpWorkspace() {
  const { t } = useTranslation('mail');
  const descriptor = getMailSecondaryView('follow-up');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedBucket = searchParams.get('bucket');
  const bucket =
    requestedBucket === 'snoozed' || requestedBucket === 'waiting' ? requestedBucket : 'reply';
  const selectedId = searchParams.get('threadId');
  const needsReply = useQuery({
    queryKey: ['mail', 'secondary', 'follow-up', 'reply'],
    queryFn: () => getMailThreads({ lane: 'NEEDS_REPLY', state: 'OPEN', pageSize: 50 }),
    staleTime: 20_000,
    retry: 1,
  });
  const snoozed = useQuery({
    queryKey: ['mail', 'secondary', 'follow-up', 'snoozed'],
    queryFn: () => getMailThreads({ state: 'SNOOZED', pageSize: 50 }),
    staleTime: 20_000,
    retry: 1,
  });
  const waiting = useQuery({
    queryKey: ['mail', 'follow-ups'],
    queryFn: () => getMailFollowUps({}),
    staleTime: 20_000,
    retry: 1,
  });
  const activeQuery = bucket === 'reply' ? needsReply : snoozed;
  const setLocation = (nextBucket: string, threadId?: string | null) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('bucket', nextBucket);
      if (threadId) next.set('threadId', threadId);
      else next.delete('threadId');
      return next;
    });
  };

  return (
    <PageCanvas topInset="compact">
      <MailPageHeading
        eyebrow={translated(t, 'secondary.followUp.eyebrow', 'Response planning')}
        title={translated(t, descriptor.titleKey, descriptor.titleFallback)}
        description={translated(t, descriptor.descriptionKey, descriptor.descriptionFallback)}
        actions={
          <ActionIconButton
            label={t('actions.refresh')}
            onClick={() =>
              void Promise.all([needsReply.refetch(), snoozed.refetch(), waiting.refetch()])
            }
          >
            <RefreshCw size={17} />
          </ActionIconButton>
        }
      />
      <Tabs
        value={bucket}
        onChange={(_event, value: string) =>
          setLocation(value, value === 'waiting' ? selectedId : null)
        }
        aria-label={translated(t, 'secondary.followUp.tabsLabel', 'Follow-up queues')}
        sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          value="reply"
          label={`${t('home.metrics.needsReply')} (${needsReply.data?.total ?? 0})`}
        />
        <Tab value="snoozed" label={`${t('home.metrics.snoozed')} (${snoozed.data?.total ?? 0})`} />
        <Tab
          value="waiting"
          label={`${translated(t, 'secondary.followUp.waitingTab', 'Waiting for reply')} (${waiting.data?.filter((item) => item.status === 'WAITING' || item.status === 'OVERDUE').length ?? 0})`}
        />
      </Tabs>
      {bucket === 'waiting' ? (
        <MailFollowUpTracker
          suggestedThreadId={selectedId}
          onOpenThread={(threadId) => setLocation('reply', threadId)}
        />
      ) : (
        <MailListDetailWorkspace
          query={activeQuery}
          selectedId={selectedId}
          emptyTitle={translated(t, 'secondary.followUp.emptyTitle', 'Nothing needs follow-up')}
          emptyDescription={translated(
            t,
            'secondary.followUp.emptyDescription',
            'Messages will appear here when a reply is needed or a reminder becomes active.'
          )}
          onSelect={(threadId) => setLocation(bucket, threadId)}
          onBack={() => setLocation(bucket)}
        />
      )}
    </PageCanvas>
  );
}

function MailSharedWorkspace() {
  const { t } = useTranslation('mail');
  const descriptor = getMailSecondaryView('shared');
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('threadId');
  const query = useQuery({
    queryKey: ['mail', 'secondary', 'shared'],
    queryFn: () => getMailThreads({ sharedOnly: true, state: 'OPEN', pageSize: 50 }),
    staleTime: 15_000,
    retry: 1,
  });

  return (
    <PageCanvas topInset="compact">
      <MailPageHeading
        eyebrow={translated(t, 'secondary.shared.eyebrow', 'Team mail')}
        title={translated(t, descriptor.titleKey, descriptor.titleFallback)}
        description={translated(t, descriptor.descriptionKey, descriptor.descriptionFallback)}
        actions={
          <ActionIconButton label={t('actions.refresh')} onClick={() => void query.refetch()}>
            <RefreshCw size={17} />
          </ActionIconButton>
        }
      />
      <MailListDetailWorkspace
        query={query}
        selectedId={selectedId}
        emptyTitle={translated(t, 'secondary.shared.emptyTitle', 'No shared messages need action')}
        emptyDescription={translated(
          t,
          'secondary.shared.emptyDescription',
          'New conversations assigned to your team will appear here.'
        )}
        onSelect={(threadId) => setSearchParams({ threadId })}
        onBack={() => setSearchParams({})}
      />
    </PageCanvas>
  );
}

function MailActionCenterWorkspace() {
  const { t } = useTranslation('mail');
  const descriptor = getMailSecondaryView('actions');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = mailProposalFiltersFromSearch(searchParams);
  const [proposalToAccept, setProposalToAccept] = useState<MailActionProposal | null>(null);
  const [proposalToEdit, setProposalToEdit] = useState<MailActionProposal | null>(null);
  const query = useQuery({
    queryKey: ['mail', 'proposals', filters],
    queryFn: () => getMailProposals(filters),
    staleTime: 20_000,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: ({
      proposal,
      decision,
    }: {
      proposal: MailActionProposal;
      decision: 'ACCEPT' | 'DISMISS';
    }) => decideMailProposal(proposal.proposalId, decision, proposal.version),
    onSuccess: async (proposal, variables) => {
      setProposalToAccept(null);
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      if (variables.decision === 'ACCEPT') {
        toast.success(t('proposal.accepted'));
        if (proposal.targetRoute) navigate(proposal.targetRoute);
      } else {
        toast.success(t('proposal.dismissed'));
      }
    },
    onError: () => toast.error(t('proposal.error')),
  });
  const update = useMutation({
    mutationFn: ({
      proposal,
      proposedPayload,
    }: {
      proposal: MailActionProposal;
      proposedPayload: Record<string, unknown>;
    }) =>
      updateMailProposal(proposal.proposalId, {
        proposedPayload,
        version: proposal.version,
      }),
    onSuccess: async (proposal) => {
      setProposalToEdit(null);
      queryClient.setQueryData<MailActionProposal[]>(['mail', 'proposals', filters], (current) =>
        current?.map((item) => (item.proposalId === proposal.proposalId ? proposal : item))
      );
      await queryClient.invalidateQueries({ queryKey: ['mail', 'proposals'] });
      toast.success(t('proposal.payloadEditor.saved', { defaultValue: 'Proposal details saved.' }));
    },
    onError: () => toast.error(t('proposal.payloadEditor.error')),
  });

  return (
    <PageCanvas topInset="compact">
      <MailPageHeading
        eyebrow={translated(t, 'secondary.actions.eyebrow', 'Review queue')}
        title={translated(t, descriptor.titleKey, descriptor.titleFallback)}
        description={translated(t, descriptor.descriptionKey, descriptor.descriptionFallback)}
        actions={
          <ActionIconButton label={t('actions.refresh')} onClick={() => void query.refetch()}>
            <RefreshCw size={17} />
          </ActionIconButton>
        }
      />
      <Alert severity="info" icon={<Bot size={18} />} sx={{ mt: 2 }}>
        {translated(
          t,
          'secondary.actions.ownerNotice',
          'Accepting a proposal opens the responsible app for final review. It does not complete the action here.'
        )}
      </Alert>
      <MailProposalFilterControls
        value={filters}
        disabled={query.isFetching}
        onChange={(value) => setSearchParams(updateMailProposalFilterSearch(searchParams, value))}
      />
      {query.isLoading ? (
        <Stack spacing={1.25} sx={{ mt: 2 }}>
          <Skeleton variant="rounded" height={164} />
          <Skeleton variant="rounded" height={164} />
        </Stack>
      ) : query.isError ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('home.loadError')}
        </Alert>
      ) : query.data?.length ? (
        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {query.data.map((proposal) => (
            <Stack key={proposal.proposalId} spacing={0.5} alignItems="flex-end">
              <MailProposalCard
                proposal={proposal}
                busy={mutation.isPending || proposal.status !== 'PROPOSED'}
                onAccept={() => setProposalToAccept(proposal)}
                onDismiss={() => mutation.mutate({ proposal, decision: 'DISMISS' })}
              />
              <MailProposalEditButton
                proposal={proposal}
                disabled={mutation.isPending || update.isPending}
                onEdit={setProposalToEdit}
              />
            </Stack>
          ))}
        </Stack>
      ) : (
        <GuidedEmptyState
          kind="empty"
          title={t('home.assistant.emptyTitle')}
          description={t('home.assistant.emptyDescription')}
        />
      )}
      <MailProposalReviewDialog
        proposal={proposalToAccept}
        busy={mutation.isPending}
        onClose={() => setProposalToAccept(null)}
        onConfirm={() => {
          if (proposalToAccept) {
            mutation.mutate({ proposal: proposalToAccept, decision: 'ACCEPT' });
          }
        }}
      />
      <MailProposalPayloadEditor
        proposal={proposalToEdit}
        busy={update.isPending}
        error={update.isError}
        onClose={() => {
          setProposalToEdit(null);
          update.reset();
        }}
        onSave={(proposedPayload) => {
          if (proposalToEdit) update.mutate({ proposal: proposalToEdit, proposedPayload });
        }}
      />
    </PageCanvas>
  );
}

function MailListDetailWorkspace({
  query,
  selectedId,
  emptyTitle,
  emptyDescription,
  onSelect,
  onBack,
}: {
  query: ThreadListState;
  selectedId: string | null;
  emptyTitle: string;
  emptyDescription: string;
  onSelect: (threadId: string) => void;
  onBack: () => void;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 0.8fr) minmax(0, 1.35fr)' },
        minHeight: 520,
        mt: 2,
        borderBlock: 1,
        borderColor: 'divider',
      }}
    >
      <ThreadListPanel
        query={query}
        selectedId={selectedId}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        hiddenOnMobile={Boolean(selectedId)}
        onSelect={onSelect}
      />
      <Box
        sx={{
          minWidth: 0,
          borderLeft: { md: 1 },
          borderColor: 'divider',
          display: { xs: selectedId ? 'block' : 'none', md: 'block' },
        }}
      >
        <MailThreadDetailPane threadId={selectedId} onBack={onBack} />
      </Box>
    </Box>
  );
}

function ThreadListPanel({
  query,
  selectedId,
  emptyTitle,
  emptyDescription,
  hiddenOnMobile,
  onSelect,
}: {
  query: ThreadListState;
  selectedId: string | null;
  emptyTitle: string;
  emptyDescription: string;
  hiddenOnMobile: boolean;
  onSelect: (threadId: string) => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <Box
      component="section"
      aria-label={translated(t, 'secondary.threadList', 'Message list')}
      sx={{
        minWidth: 0,
        display: { xs: hiddenOnMobile ? 'none' : 'block', md: 'block' },
      }}
    >
      {query.isFetching && !query.isLoading && (
        <Typography
          component="p"
          variant="caption"
          color="text.secondary"
          aria-live="polite"
          sx={{ px: 2, py: 0.75 }}
        >
          {translated(t, 'secondary.refreshing', 'Refreshing messages')}
        </Typography>
      )}
      {query.isLoading ? (
        <LoadingState label={t('common:labels.loading')} variant="skeleton" embedded />
      ) : query.isError ? (
        <Box sx={{ p: 2 }}>
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={() => void query.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {translated(t, 'secondary.loadError', 'Messages could not be loaded.')}
          </Alert>
        </Box>
      ) : query.data?.items.length ? (
        query.data.items.map((thread) => (
          <MailThreadListItem
            key={thread.threadId}
            thread={thread}
            selected={thread.threadId === selectedId}
            onSelect={() => onSelect(thread.threadId)}
          />
        ))
      ) : (
        <GuidedEmptyState kind="empty" title={emptyTitle} description={emptyDescription} />
      )}
    </Box>
  );
}

function validWorkflowState(value: string | null): MailWorkflowState | null {
  return value && ['OPEN', 'DONE', 'SNOOZED'].includes(value) ? (value as MailWorkflowState) : null;
}

function validTriageLane(value: string | null): MailTriageLane | null {
  return value && ['PRIORITY', 'NEEDS_REPLY', 'ASSIGNED'].includes(value)
    ? (value as MailTriageLane)
    : null;
}
