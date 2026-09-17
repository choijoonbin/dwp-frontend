import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, ExternalLink, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  downloadWorkplaceExceptionExport,
  getWorkplaceExceptionConsole,
  previewWorkplaceExceptionExport,
  previewWorkplaceExceptionRecovery,
  startWorkplaceExceptionExport,
  startWorkplaceExceptionRecovery,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  EmptyState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading } from './rooms-ui';

import type {
  WorkplaceExceptionItem,
  WorkplaceExceptionExportPreview,
  WorkplaceExceptionRecoveryPreview,
  WorkplaceExceptionSeverity,
  WorkplaceExceptionSource,
} from '@dwp-frontend/shared-utils';

type Filter = 'ALL' | WorkplaceExceptionSeverity | WorkplaceExceptionSource;

const FILTERS: readonly Filter[] = [
  'ALL',
  'CRITICAL',
  'WARNING',
  'ERROR',
  'SAFETY',
  'BOOKING',
  'CONNECTOR',
];

function parseFilter(value: string | null): Filter {
  return FILTERS.includes(value as Filter) ? (value as Filter) : 'ALL';
}

const severityColor = {
  CRITICAL: 'error',
  ERROR: 'error',
  WARNING: 'warning',
} as const;

function download(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'workplace-exceptions.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={750} sx={{ my: 0.5 }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {detail}
      </Typography>
    </Paper>
  );
}

export function WorkplaceExceptionConsole() {
  const { t, i18n } = useTranslation('rooms');
  const navigate = useNavigate();
  const capabilities = useRoomsCapabilities();
  const authority = useProductSurfaceAuthority();
  const locale = i18n.resolvedLanguage === 'ko' ? 'ko' : 'en';
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<WorkplaceExceptionRecoveryPreview | null>(null);
  const [blockedRecovery, setBlockedRecovery] = useState<readonly string[]>([]);
  const [exportPurpose, setExportPurpose] = useState('');
  const [exportPreview, setExportPreview] = useState<WorkplaceExceptionExportPreview | null>(null);
  const [recoveryReceipt, setRecoveryReceipt] = useState<string | null>(null);
  const [exportReceipt, setExportReceipt] = useState<string | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState<readonly string[]>([]);
  const [batchReviewOpen, setBatchReviewOpen] = useState(false);
  const filter = parseFilter(params.get('filter'));
  const selectedId = params.get('exception');

  const query = useQuery({
    queryKey: ['workplace', 'admin', 'exception-console'],
    queryFn: getWorkplaceExceptionConsole,
    retry: false,
    refetchInterval: 10_000,
  });
  const items = useMemo(
    () =>
      (query.data?.exceptions ?? []).filter(
        (item) => filter === 'ALL' || item.severity === filter || item.source === filter
      ),
    [filter, query.data?.exceptions]
  );
  const selected =
    query.data?.exceptions.find((item) => item.exceptionId === selectedId) ?? items[0] ?? null;
  const selectedBatchItems = (query.data?.exceptions ?? []).filter((item) =>
    selectedBatchIds.includes(item.exceptionId)
  );

  const select = (item: WorkplaceExceptionItem) => {
    const next = new URLSearchParams(params);
    next.set('exception', item.exceptionId);
    setParams(next, { replace: true });
    setPreview(null);
    setRecoveryReceipt(null);
  };
  const previewMutation = useMutation({
    mutationFn: (item: WorkplaceExceptionItem) => {
      const to = new Date();
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      return previewWorkplaceExceptionRecovery(
        item.exceptionId,
        { from: from.toISOString(), to: to.toISOString(), maximumRecords: 10_000 },
        {
          idempotencyKey: `workplace:exception-preview:${crypto.randomUUID()}`,
          activeAccessMode: 'ELEVATED',
        }
      );
    },
    onSuccess: (value) => {
      if (value.replay.eligible) {
        setBlockedRecovery([]);
        setPreview(value);
      } else {
        setPreview(null);
        setBlockedRecovery(value.replay.limitations);
      }
    },
  });
  const recoverMutation = useMutation({
    mutationFn: (value: WorkplaceExceptionRecoveryPreview) =>
      startWorkplaceExceptionRecovery(
        value.exceptionId,
        {
          previewId: value.replay.previewId,
          configurationVersion: value.replay.configurationVersion,
          runtimeVersion: value.replay.runtimeVersion,
          reason: reason.trim(),
          explicitConfirmation: true,
        },
        {
          idempotencyKey: `workplace:exception-recovery:${crypto.randomUUID()}`,
          activeAccessMode: 'ELEVATED',
        }
      ),
    onSuccess: (value) => {
      setRecoveryReceipt(value.recovery.receipt.commandId);
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'admin', 'exception-console'] });
    },
  });
  const exportPreviewMutation = useMutation({
    mutationFn: () =>
      previewWorkplaceExceptionExport(exportPurpose, {
        idempotencyKey: `workplace:exception-export-preview:${crypto.randomUUID()}`,
        activeAccessMode: 'ELEVATED',
      }),
    onSuccess: setExportPreview,
  });
  const exportMutation = useMutation({
    mutationFn: async (value: WorkplaceExceptionExportPreview) => {
      const receipt = await startWorkplaceExceptionExport(
        { previewId: value.previewId, reason: exportPurpose, explicitConfirmation: true },
        {
          idempotencyKey: `workplace:exception-export:${crypto.randomUUID()}`,
          activeAccessMode: 'ELEVATED',
        }
      );
      return {
        receipt,
        content: await downloadWorkplaceExceptionExport(receipt.commandId, {
          activeAccessMode: 'ELEVATED',
        }),
      };
    },
    onSuccess: ({ receipt: exportReceipt, content }) => {
      download(content);
      setExportPreview(null);
      setExportReceipt(exportReceipt.commandId);
    },
  });

  const openOwner = (item: WorkplaceExceptionItem) => {
    if (item.actionHref) navigate(item.actionHref);
    else if (item.action === 'REPLAY_CONNECTOR' && capabilities.canManageWorkplaceAdmin && elevated)
      previewMutation.mutate(item);
  };
  const toggleBatchSelection = (item: WorkplaceExceptionItem) => {
    setSelectedBatchIds((current) =>
      current.includes(item.exceptionId)
        ? current.filter((value) => value !== item.exceptionId)
        : [...current, item.exceptionId]
    );
    setBatchReviewOpen(false);
  };

  if (query.isLoading)
    return (
      <PageCanvas>
        <Stack minHeight={320} alignItems="center" justifyContent="center">
          <CircularProgress aria-label={t('screen22.loading')} />
        </Stack>
      </PageCanvas>
    );

  return (
    <PageCanvas data-testid="workplace-exception-console">
      <RoomsPageHeading
        eyebrow={t('screen22.eyebrow')}
        title={t('screen22.title')}
        description={t('screen22.description')}
      />
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1} justifyContent="space-between">
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Chip color={query.isFetching ? 'warning' : 'success'} label={t('screen22.live')} />
          <Typography variant="caption" color="text.secondary">
            {query.data
              ? t('screen22.refreshed', {
                  value: formatDate(
                    query.data.generatedAt,
                    {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                    },
                    locale
                  ),
                })
              : null}
          </Typography>
        </Stack>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <ActionButton
            intent="secondary"
            startIcon={<RefreshCw size={16} />}
            onClick={() => void query.refetch()}
          >
            {t('screen22.refreshRulesEvidence')}
          </ActionButton>
          <TextField
            size="small"
            label={t('screen22.exportPurpose')}
            value={exportPurpose}
            onChange={(event) => setExportPurpose(event.target.value)}
            inputProps={{ maxLength: 500 }}
          />
          <ActionButton
            intent="secondary"
            startIcon={<Download size={16} />}
            disabled={
              !capabilities.canManageWorkplaceAdmin ||
              !elevated ||
              !exportPurpose.trim() ||
              exportPreviewMutation.isPending
            }
            loading={exportPreviewMutation.isPending}
            onClick={() => exportPreviewMutation.mutate()}
          >
            {t('screen22.export')}
          </ActionButton>
          {query.data?.externalTelemetryUrl ? (
            <ActionButton
              intent="secondary"
              startIcon={<ExternalLink size={16} />}
              onClick={() =>
                window.open(query.data?.externalTelemetryUrl ?? '', '_blank', 'noopener,noreferrer')
              }
            >
              {t('screen22.telemetry')}
            </ActionButton>
          ) : null}
        </Stack>
      </Stack>

      {query.isError ? (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => void query.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('screen22.loadError')}
        </Alert>
      ) : null}
      {capabilities.canManageWorkplaceAdmin && !elevated ? (
        <Alert severity="info">{t('screen22.stepUpRequired')}</Alert>
      ) : null}
      {blockedRecovery.length ? (
        <Alert severity="warning">
          {t('screen22.recoveryBlocked', { value: blockedRecovery.join(', ') })}
        </Alert>
      ) : null}
      {exportPreviewMutation.isError || exportMutation.isError ? (
        <Alert severity="error">{t('screen22.exportError')}</Alert>
      ) : null}
      {exportReceipt ? (
        <Alert severity="success">{t('screen22.exportReceipt', { receipt: exportReceipt })}</Alert>
      ) : null}

      {query.data ? (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <Metric
              label={t('screen22.metrics.active')}
              value={String(query.data.summary.active)}
              detail={t('screen22.metrics.severity', {
                critical: query.data.summary.critical,
                warning: query.data.summary.warning,
              })}
            />
            <Metric
              label={t('screen22.metrics.sla')}
              value={
                query.data.summary.slaCompliancePercent === null
                  ? t('screen22.unknown')
                  : `${query.data.summary.slaCompliancePercent}%`
              }
              detail={t('screen22.metrics.slaDetail')}
            />
            <Metric
              label={t('screen22.metrics.conflicts')}
              value={String(query.data.summary.concurrencyConflicts24h)}
              detail={
                query.data.summary.automaticRecoveryPercent === null
                  ? t('screen22.metrics.noRecoveryEvidence')
                  : t('screen22.metrics.recovery', {
                      value: query.data.summary.automaticRecoveryPercent,
                    })
              }
            />
            <Metric
              label={t('screen22.metrics.dlq')}
              value={String(query.data.summary.deadLetterQueueDepth)}
              detail={t('screen22.metrics.dlqDetail')}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'minmax(0, 7fr) minmax(320px, 5fr)',
              },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6">{t('screen22.stream')}</Typography>
                <Box sx={{ mt: 1.5, maxWidth: 260 }}>
                  <SelectField
                    label={t('screen22.filter')}
                    value={filter}
                    options={FILTERS.map((value) => ({
                      value,
                      label: t(`screen22.filters.${value}`),
                    }))}
                    onValueChange={(value) => {
                      const next = new URLSearchParams(params);
                      next.set('filter', value);
                      next.delete('exception');
                      setParams(next, { replace: true });
                    }}
                  />
                </Box>
              </Box>
              {items.length === 0 ? (
                <EmptyState
                  title={t('screen22.empty')}
                  description={t('screen22.emptyDescription')}
                />
              ) : (
                <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
                  {items.map((item) => (
                    <Box
                      key={item.exceptionId}
                      sx={{
                        bgcolor:
                          selected?.exceptionId === item.exceptionId
                            ? 'action.selected'
                            : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Stack direction="row" alignItems="stretch">
                        <Checkbox
                          checked={selectedBatchIds.includes(item.exceptionId)}
                          onChange={() => toggleBatchSelection(item)}
                          slotProps={{
                            input: {
                              'aria-label': t('screen22.selectForBatch', { title: item.title }),
                            },
                          }}
                          sx={{ alignSelf: 'flex-start', mt: 1 }}
                        />
                        <Box
                          component="button"
                          type="button"
                          onClick={() => select(item)}
                          aria-pressed={selected?.exceptionId === item.exceptionId}
                          sx={{
                            appearance: 'none',
                            border: 0,
                            bgcolor: 'transparent',
                            color: 'text.primary',
                            textAlign: 'left',
                            width: '100%',
                            p: 2,
                            pl: 0.5,
                            cursor: 'pointer',
                            '&:focus-visible': {
                              outline: '3px solid',
                              outlineColor: 'primary.main',
                            },
                          }}
                        >
                          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                            <Chip
                              size="small"
                              color={severityColor[item.severity]}
                              label={item.severity}
                            />
                            <Typography variant="caption" fontFamily="monospace">
                              {item.exceptionId}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ ml: 'auto' }}
                            >
                              {formatDate(
                                item.detectedAt,
                                {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                },
                                locale
                              )}
                            </Typography>
                          </Stack>
                          <Typography fontWeight={700} sx={{ mt: 1 }}>
                            {item.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {item.impact}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, position: { lg: 'sticky' }, top: { lg: 16 } }}>
              <Stack direction="row" gap={1} alignItems="center">
                <ShieldAlert size={20} />
                <Typography variant="h6">{t('screen22.inspector')}</Typography>
              </Stack>
              {selected ? (
                <Stack gap={2} sx={{ mt: 2 }}>
                  <Box>
                    <Chip
                      size="small"
                      color={severityColor[selected.severity]}
                      label={selected.severity}
                    />
                    <Typography variant="h6" sx={{ mt: 1 }}>
                      {selected.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selected.impact}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="overline">{t('screen22.rootCause')}</Typography>
                    <Typography variant="body2" fontFamily="monospace">
                      {selected.code}
                    </Typography>
                    <Stack component="ul" sx={{ pl: 2.5, mb: 0 }}>
                      {selected.evidence.map((value) => (
                        <Typography component="li" variant="body2" key={value}>
                          {value}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                  {selected.action === 'REPLAY_CONNECTOR' ? (
                    <TextField
                      label={t('screen22.reason')}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      multiline
                      minRows={2}
                      inputProps={{ maxLength: 500 }}
                      required
                    />
                  ) : null}
                  <ActionButton
                    intent={selected.action === 'REPLAY_CONNECTOR' ? 'primary' : 'secondary'}
                    startIcon={
                      selected.action === 'REPLAY_CONNECTOR' ? (
                        <RotateCcw size={16} />
                      ) : (
                        <ExternalLink size={16} />
                      )
                    }
                    disabled={
                      selected.action === 'REPLAY_CONNECTOR' &&
                      (!capabilities.canManageWorkplaceAdmin || !elevated || !reason.trim())
                    }
                    loading={previewMutation.isPending}
                    onClick={() => openOwner(selected)}
                  >
                    {selected.action === 'REPLAY_CONNECTOR'
                      ? t('screen22.previewRecovery')
                      : t('screen22.openOwner')}
                  </ActionButton>
                  {recoveryReceipt ? (
                    <Alert severity="success">
                      {t('screen22.receipt', { receipt: recoveryReceipt })}
                    </Alert>
                  ) : null}
                  {previewMutation.isError || recoverMutation.isError ? (
                    <Alert severity="error">{t('screen22.commandError')}</Alert>
                  ) : null}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {t('screen22.selectIncident')}
                </Typography>
              )}
            </Paper>
          </Box>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              position: { xs: 'sticky', md: 'static' },
              bottom: { xs: 8, md: 'auto' },
              zIndex: 2,
            }}
          >
            <Stack gap={1.5}>
              <ActionButton
                intent="primary"
                disabled={selectedBatchItems.length === 0}
                onClick={() => setBatchReviewOpen(true)}
              >
                {t('screen22.reviewSelectedOwners', { count: selectedBatchItems.length })}
              </ActionButton>
              {batchReviewOpen ? (
                <Stack gap={1} data-testid="workplace-exception-batch-owner-actions">
                  <Alert severity="info">{t('screen22.batchRecoveryBoundary')}</Alert>
                  {selectedBatchItems.map((item) => (
                    <Stack
                      key={item.exceptionId}
                      direction={{ xs: 'column', sm: 'row' }}
                      gap={1}
                      alignItems={{ sm: 'center' }}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t(`screen22.batchReason.${item.source}`)}
                        </Typography>
                      </Box>
                      <ActionButton
                        intent="secondary"
                        onClick={() => {
                          if (item.actionHref) navigate(item.actionHref);
                          else {
                            select(item);
                            setBatchReviewOpen(false);
                          }
                        }}
                      >
                        {item.actionHref ? t('screen22.openOwner') : t('screen22.reviewRecovery')}
                      </ActionButton>
                    </Stack>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6">{t('screen22.guardrails')}</Typography>
            </Box>
            <TableContainer tabIndex={0} aria-label={t('screen22.guardrailTable')}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('screen22.columns.rule')}</TableCell>
                    <TableCell>{t('screen22.columns.scope')}</TableCell>
                    <TableCell>{t('screen22.columns.threshold')}</TableCell>
                    <TableCell>{t('screen22.columns.observed')}</TableCell>
                    <TableCell>{t('screen22.columns.status')}</TableCell>
                    <TableCell>{t('screen22.columns.enforcement')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {query.data.guardrails.map((rule) => (
                    <TableRow key={rule.code}>
                      <TableCell>{rule.name}</TableCell>
                      <TableCell>{rule.scope}</TableCell>
                      <TableCell>{rule.threshold}</TableCell>
                      <TableCell>{rule.observedValue}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={
                            rule.status === 'HEALTHY'
                              ? 'success'
                              : rule.status === 'BREACHED'
                                ? 'error'
                                : 'warning'
                          }
                          label={t(`screen22.guardrailStatus.${rule.status}`)}
                        />
                      </TableCell>
                      <TableCell>{rule.enforcement}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(preview)}
        title={t('screen22.confirmTitle')}
        description={preview?.impactSummary ?? ''}
        details={
          preview ? (
            <Stack gap={0.5}>
              <Typography variant="body2">
                {t('screen22.previewCount', { value: preview.replay.estimatedRecords })}
              </Typography>
              {preview.replay.limitations.map((value) => (
                <Alert severity="warning" key={value}>
                  {value}
                </Alert>
              ))}
            </Stack>
          ) : undefined
        }
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('screen22.confirmRecovery')}
        confirmingLabel={t('screen22.recovering')}
        busy={recoverMutation.isPending}
        intent="danger"
        onClose={() => setPreview(null)}
        onConfirm={() => {
          if (preview?.replay.eligible && reason.trim()) recoverMutation.mutate(preview);
        }}
      />
      <ConfirmDialog
        open={Boolean(exportPreview)}
        title={t('screen22.exportConfirmTitle')}
        description={t('screen22.exportConfirmDescription', {
          count: exportPreview?.rowCount ?? 0,
        })}
        details={
          exportPreview ? (
            <Stack gap={0.5}>
              <Typography variant="body2">{exportPreview.purpose}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('screen22.exportExpires', {
                  value: formatDate(
                    exportPreview.expiresAt,
                    {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                    },
                    locale
                  ),
                })}
              </Typography>
            </Stack>
          ) : undefined
        }
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('screen22.exportConfirm')}
        confirmingLabel={t('screen22.exporting')}
        busy={exportMutation.isPending}
        intent="danger"
        onClose={() => setExportPreview(null)}
        onConfirm={() => {
          if (exportPreview && elevated) exportMutation.mutate(exportPreview);
        }}
      />
    </PageCanvas>
  );
}
