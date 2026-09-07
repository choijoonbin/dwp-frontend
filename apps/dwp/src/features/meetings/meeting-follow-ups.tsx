import { Fragment, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCheck, ClipboardList, RefreshCw } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  FormField,
  InlineFeedback,
  LoadingState,
  OperationalKpiStrip,
  PageCanvas,
  SelectField,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { getWorkAssignments } from '@dwp-frontend/shared-utils/api/work-assignment-api';
import type { WorkAssignmentScope } from '@dwp-frontend/shared-utils/api/work-assignment-contracts';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { MeetingFollowUpsDetail } from './meeting-follow-ups-detail';
import {
  checkedFollowUpPage,
  filterFollowUpPage,
  FOLLOW_UP_PAGE_SIZE,
  type FollowUpTab,
} from './meeting-follow-ups-model';
import { followUpAccessDenied } from './meeting-follow-ups-state';
import { MeetingFollowUpCandidates } from './meeting-follow-up-candidates';

export function MeetingFollowUps() {
  const { user, isAuthenticated } = useAuth();
  const identity = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
  ]);
  return (
    <FollowUpsWorkspace
      key={identity}
      identity={identity}
      actorId={user?.userId ?? 0}
      authenticated={isAuthenticated && Boolean(user)}
    />
  );
}

function FollowUpsWorkspace({
  identity,
  actorId,
  authenticated,
}: {
  identity: string;
  actorId: number;
  authenticated: boolean;
}) {
  const { t } = useTranslation('meetings');
  const theme = useTheme();
  const compactTabs = useMediaQuery(theme.breakpoints.down('sm'));
  const [tab, setTab] = useState<FollowUpTab>('ASSIGNED_TO_ME');
  const [page, setPage] = useState(0);
  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Stack gap={1} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <CheckCheck size={24} aria-hidden="true" />
          <Typography component="h1" variant="h3">
            {t('followUps.title')}
          </Typography>
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: { xs: tab === 'CANDIDATES' ? 'none' : 'block', sm: 'block' } }}
        >
          {t('followUps.description')}
        </Typography>
      </Stack>
      <Tabs
        value={tab}
        onChange={(_, value: FollowUpTab) => {
          setPage(0);
          setTab(value);
        }}
        variant={compactTabs ? 'fullWidth' : 'scrollable'}
        scrollButtons={compactTabs ? false : 'auto'}
        allowScrollButtonsMobile={!compactTabs}
        aria-label={t('followUps.scopeLabel')}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          mb: 2,
          '& .MuiTabs-scrollButtons': { width: 40 },
          '& .MuiTab-root': {
            minHeight: 48,
            minWidth: { xs: 0, sm: 'max-content' },
            px: { xs: 0.5, sm: 2 },
            typography: { xs: 'caption', sm: 'button' },
            whiteSpace: { xs: 'normal', sm: 'nowrap' },
          },
        }}
      >
        {(['ASSIGNED_TO_ME', 'ASSIGNED_BY_ME', 'CANDIDATES'] as const).map((value) => (
          <Tab
            key={value}
            id={'follow-up-tab-' + value}
            aria-controls="follow-up-panel"
            value={value}
            label={t('followUps.tabs.' + value)}
          />
        ))}
      </Tabs>
      <Box role="tabpanel" id="follow-up-panel" aria-labelledby={'follow-up-tab-' + tab}>
        {!authenticated ? (
          <InlineFeedback severity="warning" title={t('followUps.accessTitle')}>
            {t('followUps.accessHint')}
          </InlineFeedback>
        ) : tab === 'CANDIDATES' ? (
          <MeetingFollowUpCandidates identity={identity} actorId={actorId} />
        ) : (
          <FollowUpsPage
            key={JSON.stringify([identity, tab, page])}
            scopeKey={JSON.stringify([identity, tab, page])}
            actorId={actorId}
            scope={tab}
            page={page}
            onPage={setPage}
          />
        )}
      </Box>
    </PageCanvas>
  );
}

function FollowUpsPage({
  scopeKey,
  actorId,
  scope,
  page,
  onPage,
}: {
  scopeKey: string;
  actorId: number;
  scope: WorkAssignmentScope;
  page: number;
  onPage: (page: number) => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  const client = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [selected, setSelected] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const queryKey = ['meetings', 'follow-ups', scopeKey, 'list'] as const;
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      checkedFollowUpPage(
        await getWorkAssignments({ scope, page, size: FOLLOW_UP_PAGE_SIZE }),
        actorId,
        scope,
        page
      ),
    enabled: !revoked,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const revoke = useCallback(() => {
    setRevoked(true);
    setSelected(null);
    setSearch('');
    client.removeQueries({ queryKey: ['meetings', 'follow-ups', scopeKey] });
  }, [client, scopeKey]);
  useEffect(() => {
    if (followUpAccessDenied(query.error)) revoke();
  }, [query.error, revoke]);
  useEffect(
    () => () => {
      client.removeQueries({ queryKey: ['meetings', 'follow-ups', scopeKey] });
    },
    [client, scopeKey]
  );
  const changed = useCallback(() => {
    void client.invalidateQueries({ queryKey: ['meetings', 'follow-ups', scopeKey, 'list'] });
  }, [client, scopeKey]);
  const refresh = () => {
    setRevoked(false);
    void query.refetch();
  };
  if (revoked || followUpAccessDenied(query.error))
    return (
      <ErrorState
        title={t('followUps.accessTitle')}
        description={t('followUps.accessHint')}
        retryLabel={t('actions.retry')}
        onRetry={refresh}
      />
    );
  if (query.isError)
    return (
      <ErrorState
        title={t('followUps.loadError')}
        description={t('followUps.loadErrorHint')}
        retryLabel={t('actions.retry')}
        onRetry={refresh}
      />
    );
  if (!query.data)
    return <LoadingState label={t('followUps.loading')} variant="skeleton" skeletonRows={5} />;
  const items = filterFollowUpPage(query.data.items, search, filter);
  const activeOnPage = query.data.items.filter(
    ({ workState }) => workState !== 'COMPLETED' && workState !== 'CANCELLED'
  ).length;
  const urgentOnPage = query.data.items.filter(
    ({ priority }) => priority === 'HIGH' || priority === 'URGENT'
  ).length;
  const detail = selected ? (
    <MeetingFollowUpsDetail
      key={selected}
      assignmentId={selected}
      actorId={actorId}
      scopeKey={scopeKey}
      onAccessDenied={revoke}
      onChanged={changed}
      onClose={() => setSelected(null)}
    />
  ) : null;
  return (
    <Stack gap={2} data-testid="meeting-follow-ups">
      <OperationalKpiStrip
        ariaLabel={t('followUps.summaryLabel')}
        items={[
          {
            key: 'scope-total',
            label: t('followUps.metrics.scopeTotal'),
            value: query.data.totalElements,
            detail: t('followUps.metrics.authoritativeScope'),
          },
          {
            key: 'page-visible',
            label: t('followUps.metrics.pageVisible'),
            value: query.data.items.length,
            detail: t('followUps.metrics.currentPage'),
            tone: 'info',
          },
          {
            key: 'page-active',
            label: t('followUps.metrics.pageActive'),
            value: activeOnPage,
            detail: t('followUps.metrics.currentPage'),
            tone: 'success',
          },
          {
            key: 'page-urgent',
            label: t('followUps.metrics.pageUrgent'),
            value: urgentOnPage,
            detail: t('followUps.metrics.currentPage'),
            tone: urgentOnPage ? 'critical' : 'neutral',
          },
        ]}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr) 44px',
            sm: 'minmax(0, 1fr) minmax(200px, 240px) 44px',
          },
          gap: 1.5,
          alignItems: 'center',
        }}
      >
        <FormField
          label={t('followUps.searchPage')}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setSelected(null);
          }}
          size="small"
          fullWidth
          sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
        />
        <SelectField
          label={t('followUps.filterPage')}
          value={filter}
          options={(['ALL', 'ACTIVE', 'COMPLETED'] as const).map((value) => ({
            value,
            label: t('followUps.filters.' + value),
          }))}
          onValueChange={(value) => {
            setFilter(value || 'ALL');
            setSelected(null);
          }}
          size="small"
          sx={{ minWidth: { sm: 200 }, maxWidth: { sm: 240 } }}
        />
        <ActionIconButton label={t('actions.refresh')} loading={query.isFetching} onClick={refresh}>
          <RefreshCw size={18} aria-hidden="true" />
        </ActionIconButton>
      </Box>
      <Stack direction="row" flexWrap="wrap" justifyContent="space-between" gap={1}>
        <Typography variant="body2" color="text.secondary">
          {t('followUps.scopeTotal', { count: query.data.totalElements })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('followUps.pageOnlyHint')}
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 7fr) minmax(0, 5fr)' },
          alignItems: 'start',
          gap: 2,
        }}
      >
        <Stack gap={1.5}>
          {!items.length ? (
            <Box
              sx={{
                py: 5,
                px: 2,
                textAlign: 'center',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                borderRadius: foundationTokens.radius.surface + 'px',
              }}
            >
              <Typography component="h2" variant="subtitle1">
                {t(query.data.items.length ? 'followUps.noMatches' : 'followUps.emptyTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t(query.data.items.length ? 'followUps.noMatchesHint' : 'followUps.emptyHint')}
              </Typography>
            </Box>
          ) : (
            items.map((task) => (
              <Fragment key={task.assignmentId}>
                <ActionButton
                  intent="quiet"
                  fullWidth
                  aria-label={t('followUps.inspectTask', { title: task.title })}
                  aria-expanded={selected === task.assignmentId}
                  data-testid={'follow-up-row-' + task.assignmentId}
                  onClick={() =>
                    setSelected(selected === task.assignmentId ? null : task.assignmentId)
                  }
                  sx={{
                    p: 2,
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    bgcolor:
                      selected === task.assignmentId ? 'action.selected' : 'background.paper',
                    border: 1,
                    borderColor: selected === task.assignmentId ? 'primary.main' : 'divider',
                    borderRadius: foundationTokens.radius.surface + 'px',
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                  }}
                >
                  <Stack component="span" gap={1} sx={{ width: '100%', minWidth: 0 }}>
                    <Stack component="span" direction="row" flexWrap="wrap" gap={0.75}>
                      <Chip
                        component="span"
                        size="small"
                        label={t('followUps.assignmentStates.' + task.assignmentState)}
                      />
                      <Chip
                        component="span"
                        size="small"
                        label={t('followUps.workStates.' + task.workState)}
                      />
                      {task.priority !== 'NORMAL' && (
                        <Chip
                          component="span"
                          size="small"
                          label={t('followUps.priorities.' + task.priority)}
                        />
                      )}
                    </Stack>
                    <Typography component="span" variant="subtitle1">
                      {task.title}
                    </Typography>
                    <Typography component="span" variant="body2" color="text.secondary">
                      {task.description || t('followUps.noDescription')}
                    </Typography>
                    <Stack
                      component="span"
                      direction="row"
                      flexWrap="wrap"
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Typography component="span" variant="caption" color="text.secondary">
                        {t('followUps.sourceStates.NOT_REQUESTED')}
                      </Typography>
                      <Typography component="span" variant="caption" color="text.secondary">
                        {task.dueAt && Number.isFinite(Date.parse(task.dueAt))
                          ? formatDate(
                              task.dueAt,
                              { dateStyle: 'medium' },
                              resolveSupportedLocale(i18n.language)
                            )
                          : t('followUps.noDue')}
                      </Typography>
                    </Stack>
                  </Stack>
                </ActionButton>
                {!desktop && selected === task.assignmentId && detail}
              </Fragment>
            ))
          )}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ pt: 1 }}
          >
            <ActionButton
              intent="quiet"
              startIcon={<ArrowLeft size={16} aria-hidden="true" />}
              disabled={page === 0 || query.isFetching}
              onClick={() => onPage(page - 1)}
              sx={{ minHeight: 44 }}
            >
              {t('followUps.previous')}
            </ActionButton>
            <Typography variant="caption" color="text.secondary">
              {t('followUps.pageNumber', { page: page + 1 })}
            </Typography>
            <ActionButton
              intent="quiet"
              endIcon={<ArrowRight size={16} aria-hidden="true" />}
              disabled={!query.data.hasMore || query.isFetching || page >= 10_000}
              onClick={() => onPage(page + 1)}
              sx={{ minHeight: 44 }}
            >
              {t('followUps.next')}
            </ActionButton>
          </Stack>
        </Stack>
        {desktop && (
          <Box sx={{ position: 'sticky', top: 24, minWidth: 0 }}>
            {detail || (
              <Box
                sx={{
                  p: 3,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: foundationTokens.radius.surface + 'px',
                }}
              >
                <FileSelectionHint />
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Stack>
  );
}

function FileSelectionHint() {
  const { t } = useTranslation('meetings');
  return (
    <Stack gap={1.5}>
      <ClipboardList size={28} aria-hidden="true" />
      <Typography component="h2" variant="subtitle1">
        {t('followUps.selectTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('followUps.selectHint')}
      </Typography>
    </Stack>
  );
}
