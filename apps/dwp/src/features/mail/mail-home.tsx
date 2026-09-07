import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ContactRound,
  ListFilter,
  MailPlus,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  decideMailProposal,
  getMailAddressBook,
  getMailHome,
  getMailOrganization,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  GuidedEmptyState,
  PageCanvas,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { MailPageHeading, MailThreadListItem } from './mail-components';
import { MailDailyFlow } from './mail-home-journey';
import { MailProposalCard, MailProposalReviewDialog } from './mail-proposal-card';

import type { ReactNode } from 'react';
import type {
  MailActionProposal,
  MailAddressBook,
  MailHome as MailHomeData,
  MailOrganization as MailOrganizationData,
} from '@dwp-frontend/shared-utils';

const COMPACT_RADIUS = `${foundationTokens.radius.compact}px`;

const HOME_PROPOSAL_PREVIEW_LIMIT = 3;

export function MailHome() {
  const { t } = useTranslation('mail');
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [proposalToAccept, setProposalToAccept] = useState<MailActionProposal | null>(null);
  const [proposalsExpanded, setProposalsExpanded] = useState(false);
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
  const addressBookQuery = useQuery({
    queryKey: ['mail', 'address-book', 'home-summary'],
    queryFn: () => getMailAddressBook({ pageSize: 1 }),
    staleTime: 60_000,
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
  const visibleProposals = proposalsExpanded
    ? (data?.proposals ?? [])
    : (data?.proposals.slice(0, HOME_PROPOSAL_PREVIEW_LIMIT) ?? []);
  const hiddenProposalCount = Math.max(
    0,
    (data?.proposals.length ?? 0) - HOME_PROPOSAL_PREVIEW_LIMIT
  );
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.greetingMorning');
    if (hour < 18) return t('home.greetingAfternoon');
    return t('home.greetingEvening');
  }, [t]);

  return (
    <PageCanvas topInset="compact">
      <MailPageHeading
        eyebrow={t('home.eyebrow')}
        title={t('home.title', {
          greeting,
          name: auth.user?.displayName ?? t('home.member'),
        })}
        description={t('home.description')}
        actions={
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            width={{ xs: 1, sm: 'auto' }}
          >
            <ActionIconButton label={t('actions.refresh')} onClick={() => void query.refetch()}>
              <RefreshCw size={17} />
            </ActionIconButton>
            <ActionButton
              intent="quiet"
              startIcon={<ContactRound size={17} />}
              onClick={() => navigate('/mail/contacts')}
            >
              {t('home.addressBook.open')}
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

      <Box
        component="form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const queryValue = search.trim();
          navigate(
            queryValue ? `/mail/inbox?query=${encodeURIComponent(queryValue)}` : '/mail/inbox'
          );
        }}
        sx={(theme) => ({
          mt: 2.25,
          maxWidth: 760,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
          gap: 1,
          p: 0.75,
          border: 1,
          borderColor: 'divider',
          borderRadius: COMPACT_RADIUS,
          bgcolor: theme.palette.background.paper,
          boxShadow: 'none',
        })}
      >
        <FormField
          fullWidth
          size="small"
          type="search"
          value={search}
          placeholder={t('home.searchPlaceholder')}
          inputProps={{ 'aria-label': t('home.searchLabel') }}
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
        <ActionButton intent="primary" type="submit" startIcon={<Search size={16} />}>
          {t('home.searchAction')}
        </ActionButton>
      </Box>

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
          <MailDailyFlow
            metrics={data.metrics}
            accounts={data.accounts}
            generatedAt={data.generatedAt}
            onNavigate={navigate}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(340px, 1fr)' },
              gridTemplateAreas: {
                xs: '"focus" "assistant" "tools"',
                lg: '"focus assistant" "tools assistant"',
              },
              gridTemplateRows: { lg: 'min-content auto' },
              gap: 3,
              alignItems: 'start',
            }}
          >
            <Box
              component="section"
              aria-labelledby="mail-focus-title"
              sx={{ minWidth: 0, gridArea: 'focus' }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={1.25}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 3,
                      height: 22,
                      mt: 0.2,
                      borderRadius: COMPACT_RADIUS,
                      bgcolor: 'primary.main',
                    }}
                  />
                  <Box>
                    <Typography
                      id="mail-focus-title"
                      component="h2"
                      variant="h6"
                      fontWeight="fontWeightBold"
                    >
                      {t('home.focus.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      {t('home.focus.description')}
                    </Typography>
                  </Box>
                </Stack>
                <ActionButton
                  intent="quiet"
                  size="small"
                  endIcon={<ArrowRight size={15} />}
                  onClick={() => navigate('/mail/inbox')}
                >
                  {t('home.focus.openInbox')}
                </ActionButton>
              </Stack>
              <Stack spacing={0.9}>
                {data.focusQueue.length ? (
                  data.focusQueue.map((thread) => (
                    <MailThreadListItem
                      key={thread.threadId}
                      thread={thread}
                      compact
                      presentation="focus"
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
              </Stack>
            </Box>

            <Box
              component="section"
              aria-labelledby="mail-assistant-title"
              sx={{ minWidth: 0, gridArea: 'assistant' }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={1.25}>
                <Box>
                  <Typography
                    id="mail-assistant-title"
                    component="h2"
                    variant="h6"
                    fontWeight="fontWeightBold"
                  >
                    {t('home.assistant.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    {t('home.assistant.description')}
                  </Typography>
                  {data.metrics.activeProposals > data.proposals.length && (
                    <Typography variant="caption" color="text.secondary">
                      {t('home.assistant.previewCount', {
                        shown: data.proposals.length,
                        total: data.metrics.activeProposals,
                      })}
                    </Typography>
                  )}
                </Box>
                <ShieldCheck size={19} color="var(--dwp-product-accent)" />
              </Stack>
              <Stack spacing={1.25}>
                {data.proposals.length ? (
                  <>
                    {visibleProposals.map((proposal) => (
                      <MailProposalCard
                        key={proposal.proposalId}
                        proposal={proposal}
                        busy={proposalMutation.isPending}
                        onAccept={() => setProposalToAccept(proposal)}
                        onDismiss={() => proposalMutation.mutate({ proposal, decision: 'DISMISS' })}
                      />
                    ))}
                    {hiddenProposalCount > 0 && (
                      <ActionButton
                        intent="quiet"
                        size="small"
                        endIcon={
                          proposalsExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />
                        }
                        aria-expanded={proposalsExpanded}
                        onClick={() => setProposalsExpanded((expanded) => !expanded)}
                        sx={{ alignSelf: 'center' }}
                      >
                        {proposalsExpanded
                          ? t('home.assistant.showLess')
                          : t('home.assistant.showMore', { count: hiddenProposalCount })}
                      </ActionButton>
                    )}
                  </>
                ) : (
                  <GuidedEmptyState
                    kind="empty"
                    title={t('home.assistant.emptyTitle')}
                    description={t('home.assistant.emptyDescription')}
                  />
                )}
              </Stack>
            </Box>
            <Box sx={{ minWidth: 0, gridArea: 'tools' }}>
              <MailWorkTools
                home={data}
                addressBook={addressBookQuery.data}
                addressBookLoading={addressBookQuery.isLoading}
                addressBookError={addressBookQuery.isError}
                organization={organizationQuery.data}
                organizationLoading={organizationQuery.isLoading}
                organizationError={organizationQuery.isError}
                onNavigate={navigate}
              />
            </Box>
          </Box>
        </Stack>
      ) : null}

      <MailProposalReviewDialog
        proposal={proposalToAccept}
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

function MailWorkTools({
  home,
  addressBook,
  addressBookLoading,
  addressBookError,
  organization,
  organizationLoading,
  organizationError,
  onNavigate,
}: {
  home: MailHomeData;
  addressBook?: MailAddressBook;
  addressBookLoading: boolean;
  addressBookError: boolean;
  organization?: MailOrganizationData;
  organizationLoading: boolean;
  organizationError: boolean;
  onNavigate: (path: string) => void;
}) {
  const { t } = useTranslation('mail');
  const sharedOpen = home.sharedInboxes.reduce((total, inbox) => total + inbox.openCount, 0);
  const sharedOverdue = home.sharedInboxes.reduce((total, inbox) => total + inbox.overdueCount, 0);
  const customFolders =
    organization?.folders.filter((folder) => folder.folderType === 'CUSTOM') ?? [];
  const activeRules = organization?.rules.filter((rule) => rule.enabled) ?? [];
  const latestRun = organization?.recentRuns[0];

  return (
    <Box component="section" aria-labelledby="mail-work-tools-title" sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.25 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 3,
            height: 22,
            mt: 0.2,
            borderRadius: COMPACT_RADIUS,
            bgcolor: 'primary.main',
          }}
        />
        <Box>
          <Typography
            id="mail-work-tools-title"
            component="h2"
            variant="h6"
            fontWeight="fontWeightBold"
          >
            {t('home.tools.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {t('home.tools.description')}
          </Typography>
        </Box>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 1.25,
        }}
      >
        <MailToolCard
          icon={<UsersRound size={19} />}
          tone="success"
          eyebrow={t('home.tools.sharedEyebrow')}
          title={t('home.shared.title')}
          metrics={[
            { label: t('home.tools.mailboxes'), value: home.sharedInboxes.length },
            { label: t('home.tools.open'), value: sharedOpen },
            { label: t('home.tools.overdue'), value: sharedOverdue, alert: sharedOverdue > 0 },
          ]}
          actions={
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={15} />}
              onClick={() => onNavigate('/mail/shared')}
            >
              {t('home.shared.openInbox')}
            </ActionButton>
          }
        />
        <MailToolCard
          icon={<ContactRound size={19} />}
          tone="info"
          eyebrow={t('home.tools.contactsEyebrow')}
          title={t('home.addressBook.title')}
          loading={addressBookLoading}
          error={addressBookError ? t('home.addressBook.unavailable') : undefined}
          metrics={[
            {
              label: t('home.addressBook.contacts'),
              value: addressBook?.summary.contactCount ?? 0,
            },
            {
              label: t('home.addressBook.groups'),
              value: addressBook?.summary.groupCount ?? 0,
            },
          ]}
          actions={
            <>
              <ActionButton
                intent="quiet"
                size="small"
                onClick={() => onNavigate('/mail/contacts')}
              >
                {t('home.addressBook.openContacts')}
              </ActionButton>
              <ActionButton
                intent="primary"
                size="small"
                startIcon={<UsersRound size={15} />}
                onClick={() => onNavigate('/mail/contacts?view=groups')}
              >
                {t('home.addressBook.openGroups')}
              </ActionButton>
            </>
          }
        />
        <MailToolCard
          icon={<ListFilter size={19} />}
          tone="warning"
          eyebrow={t('home.tools.organizeEyebrow')}
          title={t('home.automation.title')}
          loading={organizationLoading}
          error={organizationError ? t('home.automation.loadError') : undefined}
          metrics={[
            { label: t('home.automation.activeRules'), value: activeRules.length },
            { label: t('home.automation.personalFolders'), value: customFolders.length },
            { label: t('home.automation.latestRun'), value: latestRun?.changedCount ?? 0 },
          ]}
          actions={
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={15} />}
              onClick={() => onNavigate('/mail/organization')}
            >
              {t('home.automation.manage')}
            </ActionButton>
          }
        />
      </Box>
    </Box>
  );
}

function MailToolCard({
  icon,
  tone,
  eyebrow,
  title,
  metrics,
  actions,
  loading = false,
  error,
}: {
  icon: ReactNode;
  tone: 'success' | 'info' | 'warning';
  eyebrow: string;
  title: string;
  metrics: Array<{ label: string; value: number; alert?: boolean }>;
  actions: ReactNode;
  loading?: boolean;
  error?: string;
}) {
  const theme = useTheme();
  const palette = theme.palette[tone];
  const accent = theme.palette.mode === 'dark' ? palette.light : palette.dark;
  return (
    <Box
      component="article"
      sx={{
        minWidth: 0,
        p: 1.5,
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) auto' },
        columnGap: 1,
        alignItems: 'center',
        border: 1,
        borderColor: alpha(palette.main, 0.17),
        borderRadius: COMPACT_RADIUS,
        bgcolor: alpha(palette.main, 0.035),
        boxShadow: 'none',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box
          sx={{
            width: 36,
            height: 36,
            display: 'grid',
            placeItems: 'center',
            borderRadius: COMPACT_RADIUS,
            bgcolor: alpha(palette.main, 0.1),
            color: accent,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="p"
            sx={{
              color: accent,
              fontSize: 'caption.fontSize',
              lineHeight: 'body2.lineHeight',
              fontWeight: 'fontWeightBold',
            }}
          >
            {eyebrow}
          </Typography>
          <Typography
            component="h3"
            variant="subtitle2"
            fontWeight="fontWeightBold"
            sx={{ mt: 0.25 }}
          >
            {title}
          </Typography>
        </Box>
      </Stack>
      <Stack
        direction="row"
        spacing={0.5}
        justifyContent="flex-end"
        flexWrap="wrap"
        useFlexGap
        sx={{ mt: { xs: 1, sm: 0 } }}
      >
        {actions}
      </Stack>
      {loading ? (
        <Skeleton variant="rounded" height={43} sx={{ mt: 1.25, gridColumn: '1 / -1' }} />
      ) : !error ? (
        <Box
          sx={{
            mt: 1.25,
            gridColumn: '1 / -1',
            display: 'grid',
            gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))`,
            gap: 1,
          }}
        >
          {metrics.map((metric) => (
            <HomeUtilityMetric key={metric.label} {...metric} />
          ))}
        </Box>
      ) : null}
      {error && (
        <Typography
          role="status"
          variant="caption"
          color="warning.main"
          sx={{ mt: 1, gridColumn: '1 / -1' }}
        >
          {error}
        </Typography>
      )}
    </Box>
  );
}

function HomeUtilityMetric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" fontWeight="fontWeightBold" noWrap>
        {label}
      </Typography>
      <Typography
        variant="h6"
        component="p"
        fontWeight="fontWeightBold"
        color={alert ? 'error.main' : 'text.primary'}
        sx={{ mt: 0.15 }}
      >
        {value}
      </Typography>
    </Box>
  );
}
