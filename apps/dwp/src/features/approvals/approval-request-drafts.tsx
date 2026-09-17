import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FilePlus2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
  ProgressMeter,
  SelectField,
} from '@dwp-frontend/design-system';
import { getApprovalRequestDetail, searchApprovalRequests } from '@dwp-frontend/shared-utils';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { ApprovalDraftMigrationDialog } from './approval-draft-migration-dialog';
import { ApprovalRequestRevisionHistory } from './approval-request-revision-history';
import { missingApprovalRequestFields } from './approval-request-model';
import { useApprovalDraftMigration } from './use-approval-draft-migration';
import { useApprovalRequestFormEvaluation } from './use-approval-request-form-evaluation';
import { useApprovalRequestDraftCommand } from './use-approval-request-draft-command';
import { useApprovalRequestDraftBackup } from './use-approval-request-draft-backup';
import { useApprovalRequestRevisionHistory } from './use-approval-request-revision-history';
import { ApprovalSurface, StatusChip } from './approval-ui';
import { useApprovalExperience } from './use-approval-experience';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { approvalRequestDraftListState } from './approval-request-draft-list-state';

import type { ApprovalSearchFilters } from '@dwp-frontend/shared-utils';

export function ApprovalRequestDrafts() {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const navigate = useNavigate();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [params, setParams] = useSearchParams();
  const deleted = params.get('draftView') === 'trash';
  const { canViewRequests, canUpdateRequests } = useApprovalExperience();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const identity = JSON.stringify(requestScope.cacheKey);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<NonNullable<ApprovalSearchFilters['sort']>>('NEWEST');
  const [selectedId, setSelectedId] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    setSelectedId(undefined);
    setPreviewOpen(false);
    setSearch('');
    setQuery('');
    setPage(0);
  }, [identity, deleted]);
  useEffect(() => {
    if (search.trim() === query) return;
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, query]);
  const filters = useMemo(() => ({ query, page, size: 20, sort }), [query, page, sort]);
  const view = deleted ? 'DELETED' : 'DRAFTS';
  const pendingFilter = search.trim() !== query;
  const list = useQuery({
    queryKey: ['approvals', ...requestScope.cacheKey, 'requests', 'search', view, filters],
    queryFn: ({ signal }) =>
      searchApprovalRequests(view, filters, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    retry: false,
    staleTime: 0,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
  const listState = approvalRequestDraftListState({
    ready: requestScope.ready,
    pendingFilter,
    fetching: list.isFetching,
    error: list.isError,
    items: list.data?.items,
  });
  const rows = listState.rows;
  const selected = rows.find((request) => request.requestId === selectedId) ?? rows[0];
  const detail = useQuery({
    queryKey: [
      'approvals',
      ...requestScope.cacheKey,
      'requests',
      'draft-preview',
      selected?.requestId,
      selected?.version,
    ],
    queryFn: ({ signal }) =>
      getApprovalRequestDetail(selected!.requestId, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready && !deleted && Boolean(selected),
    meta: requestScope.queryMeta,
    retry: false,
    staleTime: 0,
  });
  const visibleDetail =
    !deleted &&
    !detail.isFetching &&
    !detail.isError &&
    detail.data?.request.requestId === selected?.requestId &&
    detail.data?.request.version === selected?.version &&
    detail.data?.request.status === 'DRAFT'
      ? detail.data
      : undefined;
  const backup = useApprovalRequestDraftBackup({
    cacheKey: requestScope.cacheKey,
    contextScopeKey: requestScope.contextScopeKey,
    ready:
      requestScope.ready &&
      canViewRequests &&
      !deleted &&
      !pendingFilter &&
      !list.isFetching &&
      !list.isError,
    request: selected,
    detail: visibleDetail,
  });
  const formEvaluation = useApprovalRequestFormEvaluation({
    schema: visibleDetail?.formSchema,
    values: visibleDetail?.payload ?? {},
    summary: visibleDetail?.request.summary ?? '',
    enabled: requestScope.ready && Boolean(visibleDetail),
  });
  const history = useApprovalRequestRevisionHistory({
    request: selected,
    enabled: requestScope.ready && !pendingFilter && !list.isFetching && !list.isError,
  });
  const commands = useApprovalRequestDraftCommand({
    cacheKey: requestScope.cacheKey,
    contextScopeKey: requestScope.contextScopeKey,
    ready:
      requestScope.ready &&
      canUpdateRequests &&
      !pendingFilter &&
      history.ready &&
      !list.isFetching &&
      !list.isError &&
      (deleted || Boolean(visibleDetail)),
    reloadCurrent: async (request) => {
      const result = await searchApprovalRequests(view, filters, requestScope.contextScopeKey);
      return result.items.find((current) => current.requestId === request.requestId);
    },
  });
  const migration = useApprovalDraftMigration({
    cacheKey: requestScope.cacheKey,
    contextScopeKey: requestScope.contextScopeKey,
    ready:
      requestScope.ready &&
      canUpdateRequests &&
      !deleted &&
      !pendingFilter &&
      !list.isFetching &&
      !list.isError,
    request: selected,
    detail: visibleDetail,
    onCreated: (draftId) => navigate(`/approvals/requests/new?draft=${draftId}`),
  });
  const sourceReady = listState.sourceReady && commands.problem !== 'DENIED';
  const navigationLocked =
    commands.pending ||
    commands.unresolved ||
    commands.problem === 'UNKNOWN' ||
    backup.pending ||
    migration.locked ||
    Boolean(migration.candidate);
  const refresh = async () => {
    const results = await Promise.all([
      list.refetch(),
      !deleted && selected ? detail.refetch() : undefined,
      selected ? history.revisions.refetch() : undefined,
    ]);
    if (results.some((result) => result?.isError)) return;
    await commands.refresh();
  };
  useEffect(() => {
    if (!selected && !listState.busy) setPreviewOpen(false);
  }, [selected, listState.busy]);
  const fields = formEvaluation.legacyFields.filter((field) => field.required);
  const missing =
    formEvaluation.kind === 'TYPED'
      ? formEvaluation.missing
      : missingApprovalRequestFields(fields, {
          ...formEvaluation.legacyValues,
          summary: visibleDetail?.request.summary ?? '',
        });
  const total = formEvaluation.kind === 'TYPED' ? formEvaluation.required.length : fields.length;
  const completed = Math.max(0, total - missing.length);

  const preview = selected && (
    <Stack gap={2} sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary">
            {selected.requestNumber}
          </Typography>
          <Typography component="h2" variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>
            {selected.title.trim() || t('requests.autosave.untitled')}
          </Typography>
        </Box>
        {deleted ? (
          <Typography variant="caption" color="warning.dark">
            {t('requests.drafts.trash')}
          </Typography>
        ) : (
          <StatusChip status="DRAFT" />
        )}
      </Stack>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {selected.summary}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {korean ? selected.workflowNameKo : selected.workflowNameEn}
      </Typography>
      <Typography variant="caption">
        {t('requests.autosave.saved', { version: selected.version })}
      </Typography>
      {sourceReady && !commands.problem && (canViewRequests || canUpdateRequests) && (
        <Stack gap={1}>
          {deleted ? (
            canUpdateRequests && (
              <ActionButton
                intent="primary"
                startIcon={<RotateCcw size={16} />}
                disabled={!history.ready || commands.pending}
                onClick={() => commands.open('restore', selected)}
              >
                {t('requests.autosave.restore')}
              </ActionButton>
            )
          ) : (
            <>
              {canUpdateRequests && (
                <ActionButton
                  intent="primary"
                  startIcon={<Pencil size={16} />}
                  disabled={
                    !visibleDetail ||
                    !formEvaluation.schemaReady ||
                    !formEvaluation.draftValid ||
                    !history.ready ||
                    commands.pending
                  }
                  onClick={() => navigate(`/approvals/requests/new?draft=${selected.requestId}`)}
                >
                  {t('actions.edit')}
                </ActionButton>
              )}
              {canViewRequests && (
                <ActionButton
                  intent="quiet"
                  startIcon={<Download size={16} />}
                  disabled={!backup.ready || commands.pending}
                  onClick={backup.download}
                >
                  {backup.pending
                    ? t('requests.drafts.backupPreparing')
                    : t('requests.drafts.backup')}
                </ActionButton>
              )}
              {canUpdateRequests && (
                <ActionButton
                  intent="quiet"
                  startIcon={<RefreshCw size={16} />}
                  disabled={!visibleDetail || !history.ready || commands.pending}
                  onClick={migration.open}
                >
                  {t('requests.drafts.migrationAction')}
                </ActionButton>
              )}
              {canUpdateRequests && (
                <>
                  <ActionButton
                    intent="danger"
                    startIcon={<Trash2 size={16} />}
                    disabled={!visibleDetail || !history.ready || commands.pending}
                    onClick={() => commands.open('delete', selected)}
                  >
                    {t('requests.autosave.delete')}
                  </ActionButton>
                  <Typography variant="caption" color="text.secondary">
                    {t('requests.drafts.discardLifecycleNotice')}
                  </Typography>
                </>
              )}
            </>
          )}
        </Stack>
      )}
      {deleted && (
        <InlineFeedback severity="info">{t('requests.drafts.trashRetentionNotice')}</InlineFeedback>
      )}
      {backup.problem && (
        <InlineFeedback
          severity={backup.problem === 'STALE' ? 'warning' : 'error'}
          action={
            <ActionButton intent="quiet" onClick={() => void refresh().catch(() => undefined)}>
              {t('actions.refresh')}
            </ActionButton>
          }
        >
          {t(`requests.drafts.backup${backup.problem}`)}
        </InlineFeedback>
      )}
      {!deleted &&
        (detail.isFetching ? (
          <LoadingState label={t('common:labels.loading')} embedded />
        ) : detail.isError ? (
          <InlineFeedback
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={() => void detail.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('requests.draftLoadError')}
          </InlineFeedback>
        ) : (
          visibleDetail && (
            <>
              {formEvaluation.problemKey && (
                <InlineFeedback severity="warning">{t(formEvaluation.problemKey)}</InlineFeedback>
              )}
              <Box
                component="dl"
                sx={{ m: 0, display: 'grid', gap: 1, bgcolor: 'action.hover', p: 1.5 }}
              >
                <Typography component="dt" variant="caption" color="text.secondary">
                  {t('requests.fields.form')}
                </Typography>
                <Typography
                  component="dd"
                  variant="caption"
                  sx={{ m: 0, overflowWrap: 'anywhere' }}
                >
                  {visibleDetail.formId}
                </Typography>
                <Typography component="dt" variant="caption" color="text.secondary">
                  {t('requests.columns.workflow')}
                </Typography>
                <Typography
                  component="dd"
                  variant="caption"
                  sx={{ m: 0, overflowWrap: 'anywhere' }}
                >
                  {visibleDetail.workflowId}
                </Typography>
              </Box>
              {total > 0 && (
                <ProgressMeter
                  value={Math.round((completed / total) * 100)}
                  label={t('requests.drafts.fieldCompletion', { completed, total })}
                  valueLabel={`${completed}/${total}`}
                  size="compact"
                />
              )}
            </>
          )
        ))}
      <ApprovalRequestRevisionHistory
        history={history}
        onRecover={
          sourceReady &&
          !deleted &&
          visibleDetail &&
          canUpdateRequests &&
          !commands.problem &&
          !commands.pending
            ? (revision) => commands.open('recover', selected, revision)
            : undefined
        }
      />
    </Stack>
  );
  return (
    <ApprovalSurface
      title={t('requests.views.drafts.title')}
      meta={t('requests.views.drafts.meta', { count: list.data?.totalElements ?? 0 })}
      action={
        <ActionButton
          intent="primary"
          startIcon={<FilePlus2 size={16} />}
          disabled={navigationLocked}
          onClick={() => navigate('/approvals/requests/new')}
        >
          {t('pages.new.title')}
        </ActionButton>
      }
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'auto minmax(0,1fr) 180px' },
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={deleted ? 'trash' : 'active'}
          onChange={(_, value: string) => {
            if (navigationLocked) return;
            setParams((current) => {
              const next = new URLSearchParams(current);
              if (value === 'trash') next.set('draftView', 'trash');
              else next.delete('draftView');
              return next;
            });
          }}
          aria-label={t('requests.views.drafts.title')}
          variant="scrollable"
        >
          <Tab value="active" label={t('requests.drafts.active')} disabled={navigationLocked} />
          <Tab value="trash" label={t('requests.drafts.trash')} disabled={navigationLocked} />
        </Tabs>
        <FormField
          label={t('requests.drafts.search')}
          value={search}
          disabled={navigationLocked}
          onChange={(event) => setSearch(event.target.value)}
          inputProps={{ maxLength: 200 }}
          sx={{ minWidth: 0 }}
        />
        <SelectField
          label={t('requests.drafts.sort')}
          value={sort}
          disabled={navigationLocked}
          options={(['NEWEST', 'OLDEST'] as const).map((value) => ({
            value,
            label: t(value === 'NEWEST' ? 'requests.drafts.newest' : 'requests.drafts.oldest'),
          }))}
          onValueChange={(value) => {
            if (value === 'NEWEST' || value === 'OLDEST') {
              setSort(value);
              setPage(0);
            }
          }}
        />
      </Box>
      {list.isError || commands.problem === 'DENIED' ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => void refresh().catch(() => undefined)}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('requests.loadError')}
        </InlineFeedback>
      ) : listState.initialLoading ? (
        <LoadingState label={t('common:labels.loading')} embedded size="page" />
      ) : !rows.length ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 4 }}>
          {t(query ? 'requests.drafts.noResults' : 'requests.empty')}
        </Typography>
      ) : (
        <Box
          aria-busy={listState.busy}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,1.15fr) minmax(0,.85fr)' },
            minHeight: 520,
          }}
        >
          <Box sx={{ borderRight: { lg: 1 }, borderColor: 'divider' }}>
            <List disablePadding aria-label={t('requests.columns.request')}>
              {rows.map((request) => (
                <ListItem key={request.requestId} disablePadding>
                  <ListItemButton
                    disabled={navigationLocked}
                    selected={selected?.requestId === request.requestId}
                    onClick={() => {
                      if (navigationLocked) return;
                      setSelectedId(request.requestId);
                      if (mobile) setPreviewOpen(true);
                    }}
                    sx={{ minHeight: 96, px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Stack gap={1} width="100%" minWidth={0}>
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography variant="caption" color="text.secondary">
                          {request.requestNumber}
                        </Typography>
                        <Typography variant="caption">
                          {t('requests.autosave.saved', { version: request.version })}
                        </Typography>
                      </Stack>
                      <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                        {request.title.trim() || t('requests.autosave.untitled')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {korean ? request.workflowNameKo : request.workflowNameEn}
                      </Typography>
                    </Stack>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
            <Stack
              direction="row"
              justifyContent="flex-end"
              alignItems="center"
              gap={1}
              sx={{ p: 1.5 }}
            >
              <Typography variant="caption">
                {t('requests.drafts.page', { page: page + 1, total: list.data?.totalPages ?? 1 })}
              </Typography>
              <ActionIconButton
                label={t('common:actions.previous')}
                disabled={page === 0 || navigationLocked}
                onClick={() => setPage(page - 1)}
              >
                <ArrowLeft size={16} />
              </ActionIconButton>
              <ActionIconButton
                label={t('common:actions.next')}
                disabled={!list.data?.hasNext || navigationLocked}
                onClick={() => setPage(page + 1)}
              >
                <ArrowRight size={16} />
              </ActionIconButton>
            </Stack>
          </Box>
          <Box component="aside" sx={{ display: { xs: 'none', lg: 'block' }, minWidth: 0 }}>
            {preview}
          </Box>
        </Box>
      )}
      <Drawer
        anchor="right"
        open={mobile && previewOpen}
        onClose={() => {
          if (!navigationLocked) setPreviewOpen(false);
        }}
        PaperProps={{
          role: 'dialog',
          'aria-modal': true,
          'aria-label': t('requests.detail.title'),
          sx: { width: '100%', maxWidth: '100vw' },
        }}
      >
        <Stack
          direction="row"
          justifyContent="flex-end"
          sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          <ActionIconButton
            label={t('actions.cancel')}
            disabled={navigationLocked}
            onClick={() => setPreviewOpen(false)}
          >
            <X size={18} />
          </ActionIconButton>
        </Stack>
        {preview}
      </Drawer>
      <FormDialog
        open={Boolean(commands.action)}
        title={t(`requests.drafts.${commands.action?.kind ?? 'delete'}Title`)}
        description={t(`requests.drafts.${commands.action?.kind ?? 'delete'}Description`)}
        cancelLabel={t('actions.cancel')}
        submitLabel={t(
          commands.action?.kind === 'recover'
            ? 'requests.drafts.recover'
            : commands.action?.kind === 'restore'
              ? 'requests.autosave.restore'
              : 'requests.autosave.delete'
        )}
        submitIntent={commands.action?.kind === 'delete' ? 'danger' : 'primary'}
        busy={commands.pending}
        submitDisabled={Boolean(commands.problem) || !commands.action?.reason.trim()}
        onClose={commands.close}
        onSubmit={commands.submit}
      >
        <Stack gap={2}>
          <Typography variant="subtitle2">
            {commands.action?.request.title.trim() || t('requests.autosave.untitled')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {commands.action?.request.requestNumber}
          </Typography>
          {commands.problem && (
            <InlineFeedback
              severity={commands.problem === 'CONFLICT' ? 'warning' : 'error'}
              action={
                <ActionButton
                  intent="quiet"
                  disabled={commands.pending}
                  onClick={() => {
                    if (commands.problem === 'UNKNOWN') commands.reconcile();
                    else void refresh().catch(() => undefined);
                  }}
                >
                  {t(
                    commands.problem === 'UNKNOWN'
                      ? 'requests.autosave.reconcile'
                      : 'actions.refresh'
                  )}
                </ActionButton>
              }
            >
              {t(
                commands.problem === 'UNKNOWN'
                  ? 'requests.drafts.commandUnknown'
                  : 'requests.drafts.commandError'
              )}
            </InlineFeedback>
          )}
          <FormField
            label={t('requests.drafts.reason')}
            required
            multiline
            minRows={3}
            value={commands.action?.reason ?? ''}
            disabled={navigationLocked}
            onChange={(event) => commands.setReason(event.target.value)}
            inputProps={{ maxLength: 2000 }}
          />
        </Stack>
      </FormDialog>
      <ApprovalDraftMigrationDialog controller={migration} />
    </ApprovalSurface>
  );
}
