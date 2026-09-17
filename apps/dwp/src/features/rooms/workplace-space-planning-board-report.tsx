import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Download, FileChartColumn, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import {
  createWorkplaceIdempotencyKey,
  downloadWorkplacePlanningBoardReport,
  executeWorkplacePlanningBoardReport,
  getWorkplacePlanningBoardReportReceipt,
  previewWorkplacePlanningBoardReport,
  resolveIdempotentMutationIntent,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { SupportedLocale } from '@dwp-frontend/shared-i18n';
import type {
  IdempotentMutationIntent,
  WorkplacePlanningReportFormat,
  WorkplacePlanningReportPreview,
  WorkplacePlanningReportReceipt,
} from '@dwp-frontend/shared-utils';
import type { WorkplacePlanningScenario } from '@dwp-frontend/shared-utils/api/workplace-planning-contract';

const REVISION = /^psr-[0-9a-f]{64}$/u;

function save(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

function errorKey(error: Error | null) {
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 403) return 'workplace.spacePlanning.boardReport.errors.denied';
  if (status === 409) return 'workplace.spacePlanning.boardReport.errors.conflict';
  if (status === 503) return 'workplace.spacePlanning.boardReport.errors.unavailable';
  return 'workplace.spacePlanning.boardReport.errors.default';
}

function bytes(value: number, locale: SupportedLocale) {
  if (value < 1024) return `${formatNumber(value, undefined, locale)} B`;
  return `${formatNumber(value / 1024, { maximumFractionDigits: 1 }, locale)} KB`;
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0, p: 1.25, bgcolor: 'action.hover', borderRadius: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={750} mt={0.25} sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

export function WorkplaceSpacePlanningBoardReport({
  scenario,
  siteId,
  canExport,
  elevated,
  decisionRevision,
  locale,
  timeZone,
}: {
  scenario: WorkplacePlanningScenario;
  siteId: string;
  canExport: boolean;
  elevated: boolean;
  decisionRevision: string;
  locale: SupportedLocale;
  timeZone: string;
}) {
  const { t } = useTranslation('rooms');
  const [format, setFormat] = useState<WorkplacePlanningReportFormat>('PDF');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<WorkplacePlanningReportPreview | null>(null);
  const [receipt, setReceipt] = useState<WorkplacePlanningReportReceipt | null>(null);
  const [, setClock] = useState(() => Date.now());
  const previewIntent = useRef<IdempotentMutationIntent | null>(null);
  const executeIntent = useRef<IdempotentMutationIntent | null>(null);
  const verifiedRevision = REVISION.test(decisionRevision);

  useEffect(() => {
    setPreview(null);
    setReceipt(null);
    setConfirmed(false);
    setReason('');
    previewIntent.current = null;
    executeIntent.current = null;
  }, [scenario.scenarioId, scenario.version, siteId]);

  useEffect(() => {
    const instants = [preview?.expiresAt, receipt?.expiresAt]
      .filter((value): value is string => Boolean(value))
      .map(Date.parse)
      .filter((value) => value > Date.now());
    if (!instants.length) return;
    const timeout = window.setTimeout(
      () => setClock(Date.now()),
      Math.min(...instants) - Date.now() + 50
    );
    return () => window.clearTimeout(timeout);
  }, [preview?.expiresAt, receipt?.expiresAt]);

  const sourceCurrent = Boolean(
    scenario.activePreview && Date.parse(scenario.activePreview.expiresAt) > Date.now()
  );
  const previewCurrent = Boolean(
    preview &&
    preview.scenarioId === scenario.scenarioId &&
    preview.scenarioVersion === scenario.version &&
    preview.siteId === siteId &&
    Date.parse(preview.expiresAt) > Date.now()
  );
  const receiptCurrent = Boolean(
    receipt &&
    receipt.scenarioId === scenario.scenarioId &&
    receipt.scenarioVersion === scenario.version &&
    receipt.siteId === siteId &&
    receipt.state === 'SUCCEEDED' &&
    receipt.contentHref &&
    Date.parse(receipt.expiresAt) > Date.now()
  );

  const previewMutation = useMutation({
    mutationFn: (value: {
      idempotencyKey: string;
      reason: string;
      format: WorkplacePlanningReportFormat;
    }) =>
      previewWorkplacePlanningBoardReport(
        siteId,
        {
          scenarioId: scenario.scenarioId,
          expectedScenarioVersion: scenario.version,
          format: value.format,
          reason: value.reason,
        },
        { idempotencyKey: value.idempotencyKey }
      ),
    retry: false,
    onSuccess: (value) => {
      previewIntent.current = null;
      executeIntent.current = null;
      setPreview(value);
      setReceipt(null);
      setConfirmed(false);
    },
  });
  const executeMutation = useMutation({
    mutationFn: (value: { idempotencyKey: string; preview: WorkplacePlanningReportPreview }) =>
      executeWorkplacePlanningBoardReport(
        siteId,
        {
          previewId: value.preview.previewId,
          expectedPreviewVersion: value.preview.previewVersion,
          expectedScenarioVersion: value.preview.scenarioVersion,
          confirmationToken: value.preview.confirmationToken,
          reason,
          explicitConfirmation: true,
        },
        {
          idempotencyKey: value.idempotencyKey,
          activeAccessMode: 'ELEVATED',
          decisionRevision,
        }
      ),
    retry: false,
    onSuccess: (value) => {
      executeIntent.current = null;
      setReceipt(value);
      setConfirmed(false);
    },
  });
  const receiptMutation = useMutation({
    mutationFn: (commandId: string) => getWorkplacePlanningBoardReportReceipt(siteId, commandId),
    retry: false,
    onSuccess: setReceipt,
  });
  const downloadMutation = useMutation({
    mutationFn: (value: WorkplacePlanningReportReceipt) =>
      downloadWorkplacePlanningBoardReport(value, {
        activeAccessMode: 'ELEVATED',
        decisionRevision,
      }),
    retry: false,
    onSuccess: (blob) => {
      if (receipt) save(blob, receipt.fileName);
    },
  });

  const pending =
    previewMutation.isPending ||
    executeMutation.isPending ||
    receiptMutation.isPending ||
    downloadMutation.isPending;
  const error =
    previewMutation.error ??
    executeMutation.error ??
    receiptMutation.error ??
    downloadMutation.error;

  const runPreview = () => {
    if (!canExport || !sourceCurrent || pending || !reason.trim()) return;
    const intent = resolveIdempotentMutationIntent(
      previewIntent.current,
      { scenarioId: scenario.scenarioId, version: scenario.version, format, reason: reason.trim() },
      () => createWorkplaceIdempotencyKey('space-planning-board-report-preview')
    );
    previewIntent.current = intent;
    previewMutation.mutate({ idempotencyKey: intent.key, reason: reason.trim(), format });
  };

  const runExecute = () => {
    if (!preview || !previewCurrent || !confirmed || !elevated || !verifiedRevision || pending) {
      return;
    }
    const intent = resolveIdempotentMutationIntent(
      executeIntent.current,
      {
        previewId: preview.previewId,
        previewVersion: preview.previewVersion,
        scenarioVersion: preview.scenarioVersion,
        confirmationToken: preview.confirmationToken,
        reason: reason.trim(),
      },
      () => createWorkplaceIdempotencyKey('space-planning-board-report-execute')
    );
    executeIntent.current = intent;
    executeMutation.mutate({ idempotencyKey: intent.key, preview });
  };

  return (
    <Paper
      variant="outlined"
      data-testid="space-planning-board-report"
      sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2.5 }}
    >
      <Stack gap={1.75}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
          <Stack direction="row" gap={1} alignItems="flex-start">
            <FileChartColumn size={20} aria-hidden />
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>
                {t('workplace.spacePlanning.boardReport.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workplace.spacePlanning.boardReport.description')}
              </Typography>
            </Box>
          </Stack>
          <Chip
            size="small"
            color={canExport ? 'primary' : 'default'}
            label={t(
              canExport
                ? 'workplace.spacePlanning.boardReport.permissionReady'
                : 'workplace.spacePlanning.boardReport.permissionMissing'
            )}
          />
        </Stack>

        {!canExport ? (
          <InlineFeedback severity="warning">
            {t('workplace.spacePlanning.boardReport.errors.denied')}
          </InlineFeedback>
        ) : !sourceCurrent ? (
          <InlineFeedback severity="warning">
            {t('workplace.spacePlanning.boardReport.sourceExpired')}
          </InlineFeedback>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(160px, .4fr) 1fr' },
            gap: 1.25,
          }}
        >
          <SelectField<WorkplacePlanningReportFormat>
            label={t('workplace.spacePlanning.boardReport.format')}
            value={format}
            disabled={!canExport || pending}
            options={[
              { value: 'PDF', label: t('workplace.spacePlanning.boardReport.formats.PDF') },
              { value: 'XLSX', label: t('workplace.spacePlanning.boardReport.formats.XLSX') },
            ]}
            onValueChange={(value) => {
              if (!value) return;
              setFormat(value);
              setPreview(null);
              setReceipt(null);
              setConfirmed(false);
            }}
          />
          <FormField
            label={t('workplace.spacePlanning.boardReport.reason')}
            value={reason}
            disabled={!canExport || pending}
            inputProps={{ maxLength: 500 }}
            supportingText={t('workplace.spacePlanning.boardReport.reasonHint')}
            onChange={(event) => {
              setReason(event.target.value);
              setPreview(null);
              setReceipt(null);
              setConfirmed(false);
            }}
          />
        </Box>
        <ActionButton
          intent="secondary"
          startIcon={<RefreshCw size={16} />}
          disabled={!canExport || !sourceCurrent || !reason.trim() || pending}
          loading={previewMutation.isPending}
          onClick={runPreview}
        >
          {t('workplace.spacePlanning.boardReport.preview')}
        </ActionButton>

        {preview ? (
          <Stack gap={1.25} data-testid="space-planning-board-report-preview">
            {!previewCurrent ? (
              <InlineFeedback severity="warning">
                {t('workplace.spacePlanning.boardReport.previewExpired')}
              </InlineFeedback>
            ) : null}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, 1fr)' },
                gap: 1,
              }}
            >
              <Metric
                label={t('workplace.spacePlanning.boardReport.metrics.capacity')}
                value={`${formatNumber(preview.snapshot.currentCapacity, undefined, locale)} → ${formatNumber(preview.snapshot.proposedCapacity, undefined, locale)}`}
              />
              <Metric
                label={t('workplace.spacePlanning.boardReport.metrics.rooms')}
                value={`${formatNumber(preview.snapshot.currentRoomCapacity, undefined, locale)} → ${formatNumber(preview.snapshot.proposedRoomCapacity, undefined, locale)}`}
              />
              <Metric
                label={t('workplace.spacePlanning.boardReport.metrics.bookings')}
                value={
                  preview.snapshot.impactedBookingCount === null
                    ? '—'
                    : formatNumber(preview.snapshot.impactedBookingCount, undefined, locale)
                }
              />
              <Metric
                label={t('workplace.spacePlanning.boardReport.metrics.expires')}
                value={formatDate(
                  preview.expiresAt,
                  { dateStyle: 'medium', timeStyle: 'short', timeZone },
                  locale
                )}
              />
            </Box>
            <InlineFeedback severity="info" icon={<ShieldCheck size={17} />}>
              {t('workplace.spacePlanning.boardReport.aggregateOnly')}
            </InlineFeedback>
            {!elevated || !verifiedRevision ? (
              <InlineFeedback severity="warning">
                {t('workplace.spacePlanning.boardReport.stepUpRequired')}
              </InlineFeedback>
            ) : null}
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmed}
                  disabled={!previewCurrent || pending}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
              }
              label={t('workplace.spacePlanning.boardReport.confirm')}
            />
            <ActionButton
              intent="primary"
              startIcon={<FileChartColumn size={16} />}
              disabled={!previewCurrent || !confirmed || !elevated || !verifiedRevision || pending}
              loading={executeMutation.isPending}
              onClick={runExecute}
            >
              {t('workplace.spacePlanning.boardReport.create')}
            </ActionButton>
          </Stack>
        ) : null}

        {receipt ? (
          <Stack
            gap={1.25}
            data-testid="space-planning-board-report-receipt"
            sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}
          >
            <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
              <CheckCircle2 size={18} aria-hidden />
              <Typography variant="subtitle2" fontWeight={800}>
                {t('workplace.spacePlanning.boardReport.receiptTitle')}
              </Typography>
              <Chip
                size="small"
                color={receipt.state === 'SUCCEEDED' ? 'success' : 'warning'}
                label={receipt.state}
              />
            </Stack>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {receipt.fileName} · {bytes(receipt.byteSize, locale)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {t('workplace.spacePlanning.boardReport.receiptEvidence', {
                hash: receipt.contentSha256.slice(0, 12),
                version: receipt.commandVersion,
              })}
            </Typography>
            {receipt.idempotentReplay ? (
              <Typography variant="caption" color="info.main">
                {t('workplace.spacePlanning.boardReport.idempotentReplay')}
              </Typography>
            ) : null}
            {!receiptCurrent ? (
              <InlineFeedback severity="warning">
                {t(
                  receipt.state === 'RESULT_UNKNOWN'
                    ? 'workplace.spacePlanning.boardReport.resultUnknown'
                    : 'workplace.spacePlanning.boardReport.contentExpired'
                )}
              </InlineFeedback>
            ) : null}
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <ActionButton
                intent="secondary"
                startIcon={<RefreshCw size={16} />}
                disabled={receiptMutation.isPending || pending}
                loading={receiptMutation.isPending}
                onClick={() => receiptMutation.mutate(receipt.commandId)}
              >
                {t('workplace.spacePlanning.boardReport.refreshReceipt')}
              </ActionButton>
              <ActionButton
                intent="primary"
                startIcon={<Download size={16} />}
                disabled={!receiptCurrent || !elevated || !verifiedRevision || pending}
                loading={downloadMutation.isPending}
                onClick={() => downloadMutation.mutate(receipt)}
              >
                {t('workplace.spacePlanning.boardReport.download')}
              </ActionButton>
            </Stack>
          </Stack>
        ) : null}

        {error ? <InlineFeedback severity="error">{t(errorKey(error))}</InlineFeedback> : null}
      </Stack>
    </Paper>
  );
}
