import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import Tabs, { type TabsProps } from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';
import { MeetingFollowUpsSummary } from './meeting-follow-ups-summary';
import { MeetingFollowUpsDetail } from './meeting-follow-ups-detail';
import {
  checkedFollowUpPage,
  filterFollowUpPage,
  FOLLOW_UP_PAGE_SIZE,
  type FollowUpTab,
} from './meeting-follow-ups-model';
import { followUpAccessDenied } from './meeting-follow-ups-state';
import { MeetingFollowUpCandidates } from './meeting-follow-up-candidates';
import { meetingShape } from './meeting-visual-system';
import { meetingFollowUpsNavigation } from './meeting-follow-ups-navigation';

function FollowUpTabs(props: TabsProps) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = root.current?.querySelector<HTMLElement>('.MuiTabs-scroller');
    const selected = scroller?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!scroller || !selected) return;
    const revealSelection = () => {
      const viewport = scroller.getBoundingClientRect();
      const tab = selected.getBoundingClientRect();
      const delta =
        tab.left < viewport.left
          ? tab.left - viewport.left
          : Math.max(0, tab.right - viewport.right);
      // Only move this horizontal strip; preserve page position and keyboard focus.
      if (delta) scroller.scrollBy({ left: delta, behavior: 'instant' });
    };
    revealSelection();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(revealSelection);
    observer.observe(scroller);
    observer.observe(selected);
    return () => observer.disconnect();
  }, [props.value]);
  return <Tabs {...props} ref={root} />;
}

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
  const [params, setParams] = useSearchParams();
  const navigation = meetingFollowUpsNavigation(params);
  const [tab, setTab] = useState<FollowUpTab>(navigation.scope);
  const [page, setPage] = useState(0);
  useEffect(() => {
    setTab(navigation.scope);
    setPage(0);
  }, [navigation.scope]);
  const tabControls = (
    <FollowUpTabs
      value={tab}
      onChange={(_, value: FollowUpTab) => {
        setPage(0);
        setTab(value);
        setParams({ scope: value }, { replace: true });
      }}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      aria-label={t('followUps.scopeLabel')}
      sx={{
        bgcolor: 'action.hover',
        borderRadius: meetingShape.control,
        p: 0.5,
        '& .MuiTabs-indicator': { display: 'none' },
        '& .MuiTab-root.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText' },
        mb: 2,
        '& .MuiTabs-scrollButtons': { width: 40 },
        '& .MuiTab-root': {
          minHeight: 48,
          minWidth: 'max-content',
          borderRadius: meetingShape.inset,
          px: { xs: 1.5, sm: 2 },
          typography: { xs: 'caption', sm: 'button' },
          whiteSpace: 'nowrap',
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
    </FollowUpTabs>
  );
  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Stack gap={1} sx={{ mb: 2.5 }}>
        <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
          {t('designReview.followUps.eyebrow')}
        </Typography>
        <Stack direction="row" alignItems="center" gap={1}>
          <CheckCheck size={24} aria-hidden="true" />
          <Typography component="h1" variant="h3">
            {t('followUps.title')}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 820 }}>
          {t('followUps.description')}
        </Typography>
      </Stack>
      <Box role="tabpanel" id="follow-up-panel" aria-labelledby={'follow-up-tab-' + tab}>
        {!authenticated ? (
          <InlineFeedback severity="warning" title={t('followUps.accessTitle')}>
            {t('followUps.accessHint')}
          </InlineFeedback>
        ) : tab === 'CANDIDATES' ? (
          <>
            {tabControls}
            <MeetingFollowUpCandidates
              identity={identity}
              actorId={actorId}
              requestedCandidate={navigation.candidate}
            />
          </>
        ) : (
          <FollowUpsPage
            key={JSON.stringify([identity, tab, page])}
            scopeKey={JSON.stringify([identity, tab, page])}
            actorId={actorId}
            scope={tab}
            page={page}
            onPage={setPage}
            tabControls={tabControls}
            requestedAssignment={navigation.scope === tab ? navigation.assignment : null}
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
  tabControls,
  requestedAssignment,
}: {
  scopeKey: string;
  actorId: number;
  scope: WorkAssignmentScope;
  page: number;
  onPage: (page: number) => void;
  tabControls: ReactNode;
  requestedAssignment: string | null;
}) {
  const { t, i18n } = useTranslation('meetings');
  const client = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [selected, setSelected] = useState<string | null>(null);
  const appliedNavigation = useRef<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const queryKey = ['meetings', 'follow-ups', scopeKey, 'list'] as const;
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      checkedFollowUpPage(
        await getWorkAssignments({ scope, page, size: FOLLOW_UP_PAGE_SIZE }, signal),
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
  useEffect(() => {
    if (
      !query.isSuccess ||
      query.isFetching ||
      revoked ||
      !requestedAssignment ||
      appliedNavigation.current === requestedAssignment
    )
      return;
    appliedNavigation.current = requestedAssignment;
    // Only the current, authorized collection may nominate an inspector target.
    if (query.data.items.some((item) => item.assignmentId === requestedAssignment))
      setSelected(requestedAssignment);
  }, [query.isSuccess, query.isFetching, query.data, revoked, requestedAssignment]);
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
      <Stack gap={2}>
        {tabControls}
        <ErrorState
          title={t('followUps.accessTitle')}
          description={t('followUps.accessHint')}
          retryLabel={t('actions.retry')}
          onRetry={refresh}
        />
      </Stack>
    );
  if (query.isError)
    return (
      <Stack gap={2}>
        {tabControls}
        <ErrorState
          title={t('followUps.loadError')}
          description={t('followUps.loadErrorHint')}
          retryLabel={t('actions.retry')}
          onRetry={refresh}
        />
      </Stack>
    );
  if (!query.data)
    return (
      <Stack gap={2}>
        {tabControls}
        <LoadingState label={t('followUps.loading')} variant="skeleton" skeletonRows={5} />
      </Stack>
    );
  const items = filterFollowUpPage(query.data.items, search, filter);
  const activeOnPage = query.data.items.filter(
    ({ workState }) => workState !== 'COMPLETED' && workState !== 'CANCELLED'
  ).length;
  const urgentOnPage = query.data.items.filter(
    ({ priority }) => priority === 'HIGH' || priority === 'URGENT'
  ).length;
  const detail =
    selected && query.data.items.some((item) => item.assignmentId === selected) ? (
      <MeetingFollowUpsDetail
        key={selected}
        assignmentId={selected}
        actorId={actorId}
        scopeKey={scopeKey}
        collectionPending={query.isFetching}
        onAccessDenied={revoke}
        onChanged={changed}
        onClose={() => setSelected(null)}
      />
    ) : null;
  return (
    <Stack gap={2} data-testid="meeting-follow-ups">
      <MeetingFollowUpsSummary
        total={query.data.totalElements}
        visible={query.data.items.length}
        active={activeOnPage}
        urgent={urgentOnPage}
      />
      {tabControls}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr) 44px',
            sm: 'minmax(0, 1fr) minmax(200px, 240px) 44px',
          },
          gap: 1.5,
          alignItems: 'center',
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: meetingShape.control,
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
                    bgcolor: 'background.paper',
                    border: selected === task.assignmentId ? 2 : 1,
                    borderColor: selected === task.assignmentId ? 'primary.main' : 'divider',
                    borderLeft: 4,
                    borderLeftColor:
                      task.priority === 'URGENT'
                        ? 'error.main'
                        : task.workState === 'COMPLETED'
                          ? 'success.main'
                          : 'primary.main',
                    boxShadow: selected === task.assignmentId ? 2 : 1,
                    borderRadius: meetingShape.card,
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
                    <Typography
                      component="span"
                      variant="h6"
                      fontWeight="fontWeightBold"
                      sx={{ lineHeight: 'h6.lineHeight' }}
                    >
                      {task.title}
                    </Typography>
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.secondary"
                      sx={(currentTheme) => ({
                        p: 1.5,
                        bgcolor: alpha(currentTheme.palette.primary.main, 0.04),
                        borderRadius: meetingShape.inset,
                        lineHeight: 'body2.lineHeight',
                      })}
                    >
                      {task.description || t('followUps.noDescription')}
                    </Typography>
                    <Stack component="span" direction="row" gap={0.75} alignItems="center">
                      <Box
                        component="span"
                        sx={{
                          width: 24,
                          height: 24,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          borderRadius: '50%',
                          fontSize: 'caption.fontSize',
                        }}
                      >
                        {task.assigneeUserId === actorId ? t('followUps.me') : '#'}
                      </Box>
                      <Typography component="span" variant="caption" color="text.secondary">
                        {t('followUps.assignee')}:{' '}
                        {task.assigneeUserId === actorId
                          ? t('followUps.me')
                          : t('followUps.userReference', { id: task.assigneeUserId })}
                      </Typography>
                    </Stack>
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
                    <Stack
                      component="span"
                      direction="row"
                      alignItems="center"
                      justifyContent="flex-end"
                      gap={0.75}
                      sx={{ color: 'primary.main' }}
                    >
                      <Typography component="span" variant="caption" fontWeight="fontWeightBold">
                        {t(
                          selected === task.assignmentId
                            ? 'followUps.closeDetail'
                            : 'followUps.inspectEvidence'
                        )}
                      </Typography>
                      <ArrowRight
                        size={16}
                        aria-hidden="true"
                        style={{
                          transform: selected === task.assignmentId ? 'rotate(90deg)' : undefined,
                        }}
                      />
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
