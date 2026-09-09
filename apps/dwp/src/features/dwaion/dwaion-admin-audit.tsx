import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  Download,
  FileClock,
  LockKeyhole,
  Pencil,
  ScrollText,
  Search,
  ShieldCheck,
  Tags,
} from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  FormDialog,
  FormField,
  foundationTokens,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
  PageCanvas,
  SelectField,
  SignalMetric,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  bootstrapDwaionRetentionPolicy,
  exportDwaionGovernanceAudit,
  getDwaionRetentionPolicy,
  HttpError,
  listDwaionGovernanceAudit,
  updateDwaionRetentionPolicy,
  type BootstrapDwaionRetentionPolicyRequest,
  type DwaionGovernanceAuditEvent,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import type { GridPaginationModel } from '@mui/x-data-grid';
import { DwaionAdminPageHeader } from './dwaion-admin-ui';
import { DwaionAdminRegistry, useAdminRegistryCopy } from './dwaion-admin-registry';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'ALL' },
  ...(['SOURCE', 'ACTION', 'SAFETY', 'EVALUATION', 'RETENTION'] as const).map((value) => ({
    value,
    label: value,
  })),
] as const;

type RetentionBootstrapEditor = BootstrapDwaionRetentionPolicyRequest;

export function DwaionAdminAudit() {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = useAdminRegistryCopy();
  const queryClient = useQueryClient();
  const governRetentionUpdate = useDwaionGovernedMutation(
    'route.dwaion.management.retention-update.action'
  );
  const governRetentionBootstrap = useDwaionGovernedMutation(
    'route.dwaion.management.retention-bootstrap.action'
  );
  const { hasPermission } = usePermissions();
  const canViewRetention = hasPermission('ADMIN.DWAION_RETENTION', 'VIEW');
  const canUpdateRetention = hasPermission('ADMIN.DWAION_RETENTION', 'UPDATE');
  const canManageRetention = hasPermission('ADMIN.DWAION_RETENTION', 'MANAGE');
  const canViewAudit = hasPermission('ADMIN.DWAION_AUDIT', 'VIEW');
  const canExport = hasPermission('ADMIN.DWAION_AUDIT', 'EXPORT');
  const [params, setParams] = useSearchParams();
  const desktopInspector = useMediaQuery(useTheme().breakpoints.up('md'));
  const retentionEditorRef = useRef<HTMLDivElement | null>(null);
  const [category, setCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [queryText, setQueryText] = useState('');
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [exportScope, setExportScope] = useState<{
    limit: number | null;
    truncated: boolean | null;
  } | null>(null);
  const [retentionDays, setRetentionDays] = useState(90);
  const [legalHold, setLegalHold] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [retentionSaved, setRetentionSaved] = useState(false);
  const [bootstrap, setBootstrap] = useState<RetentionBootstrapEditor | null>(null);

  const auditQuery = useQuery({
    queryKey: ['dwaion', 'admin', 'audit', category, queryText, pagination],
    queryFn: () =>
      listDwaionGovernanceAudit({
        category: category === 'ALL' ? undefined : category,
        query: queryText,
        page: pagination.page,
        size: pagination.pageSize,
      }),
    enabled: canViewAudit,
    staleTime: 15_000,
  });
  const retentionQuery = useQuery({
    queryKey: ['dwaion', 'admin', 'retention'],
    queryFn: getDwaionRetentionPolicy,
    enabled: canViewRetention,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!retentionQuery.data) return;
    setRetentionDays(retentionQuery.data.retentionDays);
    setLegalHold(retentionQuery.data.legalHold);
  }, [retentionQuery.data]);

  const firstAuditId = auditQuery.data?.content[0]?.eventId;
  useEffect(() => {
    if (!desktopInspector || !firstAuditId || params.has('entry')) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('entry', firstAuditId);
        return next;
      },
      { replace: true, preventScrollReset: true }
    );
  }, [desktopInspector, firstAuditId, params, setParams]);

  const daysDirty = Boolean(
    retentionQuery.data && retentionDays !== retentionQuery.data.retentionDays
  );
  const holdDirty = Boolean(retentionQuery.data && legalHold !== retentionQuery.data.legalHold);
  const allowedDirty = (daysDirty && canUpdateRetention) || (holdDirty && canManageRetention);
  const retentionValidationError = useMemo(() => {
    if (retentionDays < 30 || retentionDays > 3650) return t('dwaionAdmin.retention.daysError');
    if (allowedDirty && changeReason.trim().length < 10)
      return t('dwaionAdmin.retention.reasonError');
    return null;
  }, [allowedDirty, changeReason, retentionDays, t]);
  const retentionUninitialized =
    retentionQuery.error instanceof HttpError &&
    (retentionQuery.error.status === 404 || retentionQuery.error.status === 409);

  const retentionMutation = useMutation({
    mutationFn: () =>
      governRetentionUpdate((authority) =>
        updateDwaionRetentionPolicy(
          {
            ...(daysDirty && canUpdateRetention ? { retentionDays } : {}),
            ...(holdDirty && canManageRetention ? { legalHold } : {}),
            expectedVersion: retentionQuery.data!.policyVersion,
            changeReason: changeReason.trim(),
          },
          authority
        )
      ),
    onSuccess: async (policy) => {
      queryClient.setQueryData(['dwaion', 'admin', 'retention'], policy);
      setRetentionDays(policy.retentionDays);
      setLegalHold(policy.legalHold);
      setChangeReason('');
      setRetentionSaved(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'audit'] }),
      ]);
    },
  });
  const bootstrapMutation = useMutation({
    mutationFn: (request: BootstrapDwaionRetentionPolicyRequest) =>
      governRetentionBootstrap((authority) => bootstrapDwaionRetentionPolicy(request, authority)),
    onSuccess: async (policy) => {
      queryClient.setQueryData(['dwaion', 'admin', 'retention'], policy);
      setRetentionDays(policy.retentionDays);
      setLegalHold(policy.legalHold);
      setBootstrap(null);
      setRetentionSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'overview'] });
    },
  });

  const exportAudit = async () => {
    setExporting(true);
    setExportFailed(false);
    setExportScope(null);
    try {
      const result = await exportDwaionGovernanceAudit({
        category: category === 'ALL' ? undefined : category,
        query: queryText,
      });
      setExportScope({ limit: result.limit, truncated: result.truncated });
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'dwaion-governance-audit.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  const auditRows = auditQuery.data?.content ?? [];
  const categoryCount = new Set(auditRows.map((item) => item.category)).size;
  const retentionPolicy = retentionQuery.data;

  return (
    <PageCanvas topInset="compact">
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.audit.eyebrow')}
        title={t('dwaionAdmin.audit.title')}
        description={t('dwaionAdmin.audit.description')}
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="stretch">
            {canExport && (
              <ActionButton
                intent="secondary"
                startIcon={<Download size={16} />}
                loading={exporting}
                onClick={() => void exportAudit()}
              >
                {t('dwaionAdmin.audit.export')}
              </ActionButton>
            )}
            {retentionPolicy && (canUpdateRetention || canManageRetention) ? (
              <ActionButton
                intent="primary"
                startIcon={<CalendarClock size={16} />}
                onClick={() => {
                  retentionEditorRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                  retentionEditorRef.current?.focus({ preventScroll: true });
                }}
              >
                {t('dwaionAdmin.audit.manageRetention')}
              </ActionButton>
            ) : retentionUninitialized && canManageRetention ? (
              <ActionButton
                intent="primary"
                startIcon={<LockKeyhole size={16} />}
                onClick={() =>
                  setBootstrap({
                    idempotencyKey: crypto.randomUUID(),
                    expectedExistingCount: 0,
                    retentionDays: 90,
                    legalHold: false,
                    changeReason: '',
                  })
                }
              >
                {t('dwaionAdmin.retention.initialize')}
              </ActionButton>
            ) : undefined}
          </Stack>
        }
      />

      {exportScope && (
        <InlineFeedback severity={exportScope.truncated ? 'warning' : 'info'} sx={{ mt: 2 }}>
          {copy.exported}{' '}
          {exportScope.limit == null || exportScope.truncated == null
            ? copy.exportUnknown
            : `${copy.exportLimit}: ${exportScope.limit}.`}{' '}
          {exportScope.truncated && copy.truncated}
        </InlineFeedback>
      )}
      {exportFailed && (
        <InlineFeedback severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.audit.exportError')}
        </InlineFeedback>
      )}
      {retentionSaved && (
        <InlineFeedback severity="success" sx={{ mt: 2 }}>
          {t('dwaionAdmin.retention.saved')}
        </InlineFeedback>
      )}
      <InlineFeedback severity="info" sx={{ mt: 2 }}>
        {t('dwaionAdmin.audit.contractNotice')}
      </InlineFeedback>

      <Box
        component="section"
        aria-label={t('dwaionAdmin.audit.summaryLabel')}
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <SignalMetric
          label={t('dwaionAdmin.audit.summary.records')}
          value={canViewAudit && auditQuery.data ? String(auditQuery.data.totalElements) : '—'}
          detail={t('dwaionAdmin.audit.summary.recordsDetail')}
          icon={<ScrollText size={18} />}
        />
        <SignalMetric
          label={t('dwaionAdmin.audit.summary.categories')}
          value={canViewAudit && auditQuery.data ? String(categoryCount) : '—'}
          detail={t('dwaionAdmin.audit.summary.categoriesDetail')}
          icon={<Tags size={18} />}
          tone="info"
        />
        <SignalMetric
          label={t('dwaionAdmin.audit.summary.retention')}
          value={retentionPolicy ? String(retentionPolicy.retentionDays) : '—'}
          detail={t('dwaionAdmin.audit.summary.retentionDetail')}
          icon={<FileClock size={18} />}
          tone="warning"
        />
        <SignalMetric
          label={t('dwaionAdmin.audit.summary.legalHold')}
          value={
            retentionPolicy
              ? retentionPolicy.legalHold
                ? t('dwaionAdmin.shared.enabled')
                : t('dwaionAdmin.shared.disabled')
              : '—'
          }
          detail={t('dwaionAdmin.audit.summary.legalHoldDetail')}
          icon={<ShieldCheck size={18} />}
          tone={retentionPolicy?.legalHold ? 'error' : 'success'}
        />
      </Box>

      <Box
        component="section"
        sx={{
          mt: 2,
          p: { xs: 1.5, md: 2 },
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.surface + 'px',
          minWidth: 0,
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1}
        >
          <Box>
            <Typography component="h2" variant="h6">
              {t('dwaionAdmin.audit.registryTitle')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('dwaionAdmin.audit.registryScope')}
            </Typography>
          </Box>
          <Chip label={t('dwaionAdmin.audit.serverPaged')} size="small" variant="outlined" />
        </Stack>

        {!canViewAudit ? (
          <InlineFeedback severity="info" sx={{ mt: 2 }}>
            {t('dwaionAdmin.audit.noViewAccess')}
          </InlineFeedback>
        ) : (
          <>
            <Stack
              component="form"
              sx={{
                mt: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 220px auto' },
                gap: 1.25,
                alignItems: 'start',
              }}
              onSubmit={(event) => {
                event.preventDefault();
                setPagination((value) => ({ ...value, page: 0 }));
                setQueryText(search.trim());
                setExportScope(null);
              }}
            >
              <FormField
                label={t('dwaionAdmin.audit.searchLabel')}
                placeholder={t('dwaionAdmin.audit.searchPlaceholder')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <SelectField
                label={t('dwaionAdmin.audit.categoryLabel')}
                value={category}
                options={CATEGORY_OPTIONS}
                onValueChange={(value) => {
                  if (value) {
                    setCategory(String(value));
                    setExportScope(null);
                    setPagination((current) => ({ ...current, page: 0 }));
                  }
                }}
              />
              <ActionButton
                type="submit"
                intent="secondary"
                startIcon={<Search size={16} />}
                sx={{ mt: { md: 3 } }}
              >
                {t('dwaionAdmin.audit.search')}
              </ActionButton>
            </Stack>

            {auditQuery.isError ? (
              <Box sx={{ mt: 2 }}>
                <ErrorState
                  size="page"
                  title={t('dwaionAdmin.audit.error')}
                  description={t('dwaionAdmin.audit.unavailableDescription')}
                  retryLabel={t('dwaionAdmin.shared.retry')}
                  retrying={auditQuery.isFetching}
                  onRetry={() => void auditQuery.refetch()}
                />
              </Box>
            ) : auditQuery.isLoading ? (
              <LoadingState label={copy.loading} variant="skeleton" size="page" />
            ) : (
              <DwaionAdminRegistry
                filterable={false}
                label={t('dwaionAdmin.audit.tableLabel')}
                notice={t('dwaionAdmin.audit.listNotice')}
                items={auditRows.map((row) => auditRegistryItem(row, t, locale))}
              />
            )}

            <Stack
              direction="row"
              gap={1}
              alignItems="center"
              justifyContent="space-between"
              sx={{ mt: 2 }}
            >
              <ActionButton
                intent="quiet"
                disabled={pagination.page === 0 || auditQuery.isFetching}
                onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
              >
                {copy.previous}
              </ActionButton>
              <Typography variant="caption">
                {pagination.page + 1} / {Math.max(auditQuery.data?.totalPages ?? 1, 1)}
              </Typography>
              <ActionButton
                intent="quiet"
                disabled={
                  pagination.page + 1 >= (auditQuery.data?.totalPages ?? 0) || auditQuery.isFetching
                }
                onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
              >
                {copy.next}
              </ActionButton>
            </Stack>
          </>
        )}
      </Box>

      <Box
        ref={retentionEditorRef}
        tabIndex={-1}
        component="section"
        aria-labelledby="dwaion-retention-policy-title"
        sx={{
          mt: 2,
          p: { xs: 1.5, md: 2 },
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.surface + 'px',
          scrollMarginTop: 80,
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
          '& .MuiFormHelperText-root.Mui-disabled': { color: 'text.secondary' },
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1}
        >
          <Box>
            <Typography id="dwaion-retention-policy-title" component="h2" variant="h6">
              {t('dwaionAdmin.retention.policyTitle')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('dwaionAdmin.retention.policyDescription')}
            </Typography>
          </Box>
          {retentionPolicy && (
            <Chip
              label={t('dwaionAdmin.retention.version', {
                version: retentionPolicy.policyVersion,
              })}
              size="small"
              variant="outlined"
            />
          )}
        </Stack>

        {!canViewRetention ? (
          <InlineFeedback severity="info" sx={{ mt: 2 }}>
            {t('dwaionAdmin.retention.noViewAccess')}
          </InlineFeedback>
        ) : retentionQuery.isLoading ? (
          <LoadingState label={t('dwaionAdmin.retention.loading')} variant="skeleton" size="page" />
        ) : retentionQuery.isError || !retentionPolicy ? (
          <Box sx={{ mt: 2 }}>
            <ErrorState
              title={
                retentionUninitialized
                  ? t('dwaionAdmin.retention.notInitialized')
                  : t('dwaionAdmin.retention.loadError')
              }
              description={
                retentionUninitialized
                  ? t('dwaionAdmin.retention.notInitializedDescription')
                  : t('dwaionAdmin.retention.unavailableDescription')
              }
              retryLabel={t('dwaionAdmin.shared.retry')}
              retrying={retentionQuery.isFetching}
              onRetry={() => void retentionQuery.refetch()}
              size="page"
            />
          </Box>
        ) : (
          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(280px, 1fr)' },
              gap: 3,
              alignItems: 'start',
            }}
          >
            <Stack spacing={2}>
              {retentionMutation.isError && (
                <InlineFeedback severity="error">
                  {t('dwaionAdmin.retention.saveError')}
                </InlineFeedback>
              )}
              <FormField
                type="number"
                label={t('dwaionAdmin.retention.daysLabel')}
                value={String(retentionDays)}
                onChange={(event) => setRetentionDays(Number(event.target.value))}
                disabled={!canUpdateRetention}
                inputProps={{ min: 30, max: 3650 }}
                supportingText={t('dwaionAdmin.retention.daysHelp')}
                sx={{
                  maxWidth: 360,
                  '& .MuiFormHelperText-root.Mui-disabled': {
                    color: 'text.secondary !important',
                  },
                }}
              />
              <Box sx={{ borderBlock: 1, borderColor: 'divider', py: 1.5 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={legalHold}
                      disabled={!canManageRetention}
                      onChange={(event) => setLegalHold(event.target.checked)}
                    />
                  }
                  label={t('dwaionAdmin.retention.legalHoldLabel')}
                />
                <Typography variant="caption" color="text.secondary" component="p" sx={{ pl: 4 }}>
                  {t('dwaionAdmin.retention.legalHoldHelp')}
                </Typography>
              </Box>
              <FormField
                label={t('dwaionAdmin.retention.reasonLabel')}
                value={changeReason}
                onChange={(event) => setChangeReason(event.target.value)}
                disabled={!allowedDirty}
                multiline
                minRows={3}
                inputProps={{ maxLength: 500 }}
                supportingText={t('dwaionAdmin.retention.reasonHelp')}
                errorMessage={allowedDirty ? retentionValidationError : null}
                sx={{
                  '& .MuiFormHelperText-root.Mui-disabled': {
                    color: 'text.secondary !important',
                  },
                }}
              />
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', sm: 'center' }}
                gap={1}
              >
                <Typography variant="caption" color="text.secondary">
                  {t('dwaionAdmin.retention.updatedAt', {
                    date: formatDate(
                      retentionPolicy.updatedAt,
                      { dateStyle: 'medium', timeStyle: 'short' },
                      locale
                    ),
                  })}
                </Typography>
                {allowedDirty && (
                  <ActionButton
                    intent="primary"
                    startIcon={<Pencil size={16} />}
                    disabled={Boolean(retentionValidationError)}
                    loading={retentionMutation.isPending}
                    loadingLabel={t('dwaionAdmin.retention.saving')}
                    onClick={() => retentionMutation.mutate()}
                  >
                    {t('dwaionAdmin.retention.save')}
                  </ActionButton>
                )}
              </Stack>
            </Stack>
            <Box component="section" aria-labelledby="retention-evidence-title">
              <Typography id="retention-evidence-title" component="h3" variant="subtitle2">
                {t('dwaionAdmin.retention.evidenceTitle')}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
                {t('dwaionAdmin.retention.evidenceDescription')}
              </Typography>
              <EvidenceValue
                label={t('dwaionAdmin.retention.daysLabel')}
                value={String(retentionPolicy.retentionDays)}
              />
              <EvidenceValue
                label={t('dwaionAdmin.retention.legalHoldState')}
                value={
                  retentionPolicy.legalHold
                    ? t('dwaionAdmin.shared.enabled')
                    : t('dwaionAdmin.shared.disabled')
                }
              />
              {(['destructionSchedule', 'storageProof', 'holdScope', 'policyDiff'] as const).map(
                (key) => (
                  <EvidenceValue
                    key={key}
                    label={t(`dwaionAdmin.retention.unsupported.${key}`)}
                    value={t('dwaionAdmin.retention.notProvided')}
                    muted
                  />
                )
              )}
            </Box>
          </Box>
        )}
      </Box>

      <FormDialog
        open={Boolean(bootstrap)}
        title={t('dwaionAdmin.retention.initializeTitle')}
        description={t('dwaionAdmin.retention.initializeDescription')}
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        submitLabel={t('dwaionAdmin.retention.initialize')}
        submittingLabel={t('dwaionAdmin.retention.saving')}
        busy={bootstrapMutation.isPending}
        submitDisabled={!bootstrap || bootstrap.changeReason.trim().length < 10}
        onClose={() => setBootstrap(null)}
        onSubmit={() => {
          if (bootstrap) bootstrapMutation.mutate(bootstrap);
        }}
      >
        <Stack spacing={2}>
          {bootstrapMutation.isError && (
            <LocalErrorState title={t('dwaionAdmin.retention.saveError')} size="compact" />
          )}
          <InlineFeedback severity="warning">
            {t('dwaionAdmin.retention.initializeBoundary')}
          </InlineFeedback>
          <FormField
            label={t('dwaionAdmin.retention.reasonLabel')}
            value={bootstrap?.changeReason ?? ''}
            multiline
            minRows={3}
            onChange={(event) =>
              setBootstrap((current) =>
                current ? { ...current, changeReason: event.target.value } : current
              )
            }
            errorMessage={
              bootstrap?.changeReason && bootstrap.changeReason.trim().length < 10
                ? t('dwaionAdmin.retention.reasonError')
                : undefined
            }
          />
        </Stack>
      </FormDialog>
    </PageCanvas>
  );
}

function auditRegistryItem(
  row: DwaionGovernanceAuditEvent,
  t: ReturnType<typeof useTranslation<'work'>>['t'],
  locale: 'en' | 'ko'
) {
  const occurredAt = formatDate(
    row.createdAt,
    { dateStyle: 'medium', timeStyle: 'medium' },
    locale
  );
  return {
    id: row.eventId,
    title: row.eventType,
    description: row.changeReason,
    state: row.category,
    fields: [
      [t('dwaionAdmin.audit.columns.target'), `${row.targetType} · ${row.targetKey}`],
      [t('dwaionAdmin.audit.columns.actor'), row.actorUserId],
      [t('dwaionAdmin.audit.columns.time'), occurredAt],
      [t('dwaionAdmin.audit.columns.reason'), row.changeReason || '—'],
      [t('dwaionAdmin.audit.columns.correlation'), row.correlationId],
    ] as Array<[string, string | number]>,
    detail: <AuditContractBoundary />,
  };
}

function AuditContractBoundary() {
  const { t } = useTranslation('work');
  return (
    <Box component="section" aria-labelledby="audit-contract-boundary-title">
      <Typography id="audit-contract-boundary-title" component="h3" variant="subtitle2">
        {t('dwaionAdmin.audit.evidenceTitle')}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
        {t('dwaionAdmin.audit.evidenceDescription')}
      </Typography>
      {(['diff', 'signature', 'network', 'retentionDisposition'] as const).map((key) => (
        <EvidenceValue
          key={key}
          label={t(`dwaionAdmin.audit.unsupported.${key}`)}
          value={t('dwaionAdmin.audit.notProvided')}
          muted
        />
      ))}
    </Box>
  );
}

function EvidenceValue({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      gap={0.5}
      sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography variant="body2">{label}</Typography>
      <Typography variant="caption" color={muted ? 'text.secondary' : 'text.primary'}>
        {value}
      </Typography>
    </Stack>
  );
}
