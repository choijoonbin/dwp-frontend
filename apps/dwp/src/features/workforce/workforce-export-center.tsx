import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Ban,
  CheckCircle2,
  Clock3,
  FileLock2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  cancelWorkforceExportRequest,
  createWorkforceExportRequest,
  retryWorkforceExportRequest,
  useAuth,
  usePermissions,
  useToast,
  type WorkforceExportAttempt,
  type CreateWorkforceExportRequest,
  type WorkforceExportDataset,
  type WorkforceExportDatasetKey,
  type WorkforceExportRequest,
  type WorkforceExportState,
} from '@dwp-frontend/shared-utils';
import { formatDate, formatNumber, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  DetailInspector,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  GuidedEmptyState,
  OperationalKpiStrip,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import { useProductSurfaceCapabilityAccess } from '../../components/product-surface-capability-access';
import {
  ProductSurfaceHighRiskCommandDialog,
  productSurfaceHighRiskCommand,
  useProductSurfaceHighRiskCommand,
} from '../../components/product-surface-high-risk-command';
import { useProductActionMutation } from '../../components/use-product-action-mutation';
import { workforceExportActionAccess } from './workforce-export-action-access';
import { useWorkforceExportReads } from './use-workforce-export-reads';

import type { GridColDef } from '@mui/x-data-grid';

const ACTIVE_STATES: WorkforceExportState[] = [
  'QUEUED',
  'RUNNING',
  'RETRY_WAIT',
  'CANCEL_REQUESTED',
];
const CANCELLABLE_STATES: WorkforceExportState[] = [
  'BLOCKED_PENDING_APPROVAL',
  'QUEUED',
  'RUNNING',
  'RETRY_WAIT',
];

type Decision = 'cancel' | 'retry';

function stateColor(
  state: WorkforceExportState
): 'default' | 'info' | 'success' | 'warning' | 'error' {
  if (state === 'COMPLETED') return 'success';
  if (state === 'FAILED') return 'error';
  if (state === 'BLOCKED_PENDING_APPROVAL' || state === 'RETRY_WAIT') return 'warning';
  if (state === 'QUEUED' || state === 'RUNNING' || state === 'CANCEL_REQUESTED') return 'info';
  return 'default';
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ py: 1.25 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="div"
        variant="body2"
        sx={{ mt: 0.35, minWidth: 0, overflowWrap: 'anywhere' }}
      >
        {children}
      </Typography>
    </Box>
  );
}

function datasetLabel(
  t: ReturnType<typeof useTranslation<'workforce'>>['t'],
  dataset: WorkforceExportDataset | WorkforceExportRequest
): string {
  return t(`exports.datasets.${dataset.datasetKey}.name`, {
    defaultValue: 'name' in dataset ? dataset.name : dataset.datasetKey,
  });
}

function RequestDialog({
  open,
  busy,
  executionEnabled,
  defaultRecipient,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  executionEnabled: boolean;
  defaultRecipient: string;
  onClose: () => void;
  onSubmit: (recipient: string, purpose: string, sourceReference: string) => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [purpose, setPurpose] = useState('');
  const [sourceReference, setSourceReference] = useState('');

  return (
    <FormDialog
      open={open}
      title={t('exports.request.title')}
      description={t(
        executionEnabled ? 'exports.request.description' : 'exports.request.blockedDescription'
      )}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t(executionEnabled ? 'exports.actions.submit' : 'exports.actions.recordBlocked')}
      submittingLabel={t('exports.actions.submitting')}
      submitDisabled={
        recipient.trim().length < 3 ||
        purpose.trim().length < 10 ||
        sourceReference.trim().length < 3
      }
      busy={busy}
      onClose={onClose}
      onSubmit={() => onSubmit(recipient.trim(), purpose.trim(), sourceReference.trim())}
    >
      <Stack gap={2}>
        <FormField
          autoFocus
          required
          label={t('exports.fields.recipient')}
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          supportingText={t('exports.request.recipientHelp')}
          slotProps={{ htmlInput: { maxLength: 320 } }}
        />
        <FormField
          required
          multiline
          minRows={4}
          label={t('exports.fields.purpose')}
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          supportingText={t('exports.request.purposeHelp')}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
        <FormField
          required
          label={t('exports.fields.sourceReference')}
          value={sourceReference}
          onChange={(event) => setSourceReference(event.target.value)}
          supportingText={t('exports.request.sourceHelp')}
          slotProps={{ htmlInput: { maxLength: 240 } }}
        />
      </Stack>
    </FormDialog>
  );
}

function DecisionDialog({
  request,
  decision,
  busy,
  onClose,
  onSubmit,
}: {
  request: WorkforceExportRequest | null;
  decision: Decision | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  const [reason, setReason] = useState('');
  const retry = decision === 'retry';
  return (
    <FormDialog
      open={Boolean(request && decision)}
      title={t(retry ? 'exports.decision.retryTitle' : 'exports.decision.cancelTitle')}
      description={t(
        retry ? 'exports.decision.retryDescription' : 'exports.decision.cancelDescription'
      )}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t(retry ? 'exports.actions.retry' : 'exports.actions.cancelRequest')}
      submittingLabel={t('exports.actions.saving')}
      submitIntent={retry ? 'primary' : 'danger'}
      submitDisabled={reason.trim().length < 10}
      busy={busy}
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
    >
      <FormField
        autoFocus
        required
        multiline
        minRows={4}
        label={t('exports.fields.decisionReason')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        supportingText={t('exports.decision.reasonHelp')}
        slotProps={{ htmlInput: { maxLength: 1000 } }}
      />
    </FormDialog>
  );
}

function EvidenceInspector({
  request,
  attempts,
  attemptsLoading,
  drawer,
  canRetry,
  onClose,
  onCancel,
  onRetry,
}: {
  request: WorkforceExportRequest;
  attempts: WorkforceExportAttempt[];
  attemptsLoading: boolean;
  drawer: boolean;
  canRetry: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation('workforce');
  const display = useDisplayDictionary();
  const selection = Object.entries(request.selection);

  return (
    <DetailInspector
      open
      variant={drawer ? 'drawer' : 'inline'}
      width={440}
      title={datasetLabel(t, request)}
      subtitle={request.requestId}
      closeLabel={t('common.actions.close')}
      onClose={onClose}
      status={
        <Chip
          size="small"
          variant="outlined"
          color={stateColor(request.lifecycleState)}
          label={display('states', request.lifecycleState)}
        />
      }
    >
      <Stack divider={<Divider flexItem />}>
        <DetailRow label={t('exports.fields.purpose')}>{request.purpose}</DetailRow>
        <DetailRow label={t('exports.fields.recipient')}>{request.recipientReference}</DetailRow>
        <DetailRow label={t('exports.fields.sourceReference')}>{request.sourceReference}</DetailRow>
        <DetailRow label={t('exports.fields.selection')}>
          {selection.length ? (
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {selection.map(([key, value]) => (
                <Chip
                  key={key}
                  size="small"
                  variant="outlined"
                  label={`${t(`exports.selection.${key}`, { defaultValue: key })}: ${value}`}
                />
              ))}
            </Stack>
          ) : (
            t('exports.values.currentScope')
          )}
        </DetailRow>
        <DetailRow label={t('exports.fields.boundary')}>
          <Stack gap={0.5}>
            <Typography variant="body2">
              {request.populationType === 'TENANT'
                ? t('exports.values.tenantScope')
                : t('exports.values.organizationScope', {
                    count: request.organizationIds.length,
                  })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {request.fieldGroups.join(' · ')}
            </Typography>
          </Stack>
        </DetailRow>
        <DetailRow label={t('exports.fields.controls')}>
          {t('exports.values.controls', {
            masking: request.maskingProfile,
            format: request.exportFormat,
          })}
        </DetailRow>
        <DetailRow label={t('exports.fields.watermark')}>
          <Box component="span" sx={{ fontFamily: 'monospace' }}>
            {request.watermarkText}
          </Box>
        </DetailRow>
        <DetailRow label={t('exports.fields.requestEvidence')}>
          <Box component="span" sx={{ fontFamily: 'monospace' }}>
            {t('exports.values.sha256', { value: request.requestSha256 })}
          </Box>
        </DetailRow>
        {request.artifactSha256 && (
          <DetailRow label={t('exports.fields.artifactEvidence')}>
            <Stack gap={0.35}>
              <Box component="span" sx={{ fontFamily: 'monospace' }}>
                {t('exports.values.sha256', { value: request.artifactSha256 })}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('exports.values.artifactSize', {
                  size: formatNumber(request.artifactSizeBytes ?? 0),
                })}
              </Typography>
            </Stack>
          </DetailRow>
        )}
        <DetailRow label={t('exports.fields.retention')}>
          {request.artifactExpiresAt
            ? formatDate(request.artifactExpiresAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : t('exports.values.noArtifact')}
        </DetailRow>
      </Stack>

      <Box sx={{ mt: 2.25 }}>
        <Typography component="h3" variant="subtitle2">
          {t('exports.timeline.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('exports.timeline.summary', {
            attempts: request.attemptCount,
            manualRetries: request.manualRetryCount,
          })}
        </Typography>
        {attemptsLoading ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {t('exports.timeline.loading')}
          </Typography>
        ) : (
          <Stack component="ol" sx={{ p: 0, m: '12px 0 0', listStyle: 'none' }}>
            {attempts.map((attempt) => (
              <Box
                component="li"
                key={attempt.attemptEventId}
                sx={{ py: 1.1, borderTop: 1, borderColor: 'divider' }}
              >
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography variant="body2" fontWeight={700}>
                    {t(`exports.events.${attempt.eventType}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(attempt.occurredAt, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </Typography>
                </Stack>
                {(attempt.failureCode || attempt.redactedFailureMessage) && (
                  <Typography variant="caption" color="text.secondary">
                    {[attempt.failureCode, attempt.redactedFailureMessage]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                )}
              </Box>
            ))}
            {!attempts.length && (
              <Typography component="li" variant="body2" color="text.secondary">
                {t('exports.timeline.empty')}
              </Typography>
            )}
          </Stack>
        )}
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="flex-end"
        gap={1}
        sx={{ mt: 2 }}
      >
        {onCancel && CANCELLABLE_STATES.includes(request.lifecycleState) && (
          <ActionButton intent="danger" startIcon={<XCircle size={16} />} onClick={onCancel}>
            {t('exports.actions.cancelRequest')}
          </ActionButton>
        )}
        {canRetry && (
          <ActionButton intent="primary" startIcon={<RotateCcw size={16} />} onClick={onRetry}>
            {t('exports.actions.retry')}
          </ActionButton>
        )}
      </Stack>
    </DetailInspector>
  );
}

export function WorkforceExportCenter() {
  const { t } = useTranslation('workforce');
  const display = useDisplayDictionary();
  const auth = useAuth();
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [searchParams] = useSearchParams();
  const requestedDataset = searchParams.get('dataset') as WorkforceExportDatasetKey | null;
  const [datasetKey, setDatasetKey] = useState<WorkforceExportDatasetKey>(
    requestedDataset ?? 'WORKFORCE_DIRECTORY'
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestKey, setRequestKey] = useState(() => `workforce-export-${crypto.randomUUID()}`);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const pageDecision = useOptionalAllowedProductSurface();
  const capabilityAccess = useProductSurfaceCapabilityAccess();
  const cancelExport = useProductActionMutation(
    'route.hcm.management.controlled-export-cancel.action'
  );

  const {
    attemptsQuery,
    datasets,
    datasetsQuery,
    effectiveDatasetKey,
    previewQuery,
    requests,
    requestsQuery,
    selected,
    selectedDataset,
    selection,
  } = useWorkforceExportReads({ datasetKey, searchParams, selectedId });
  const actionAccess = workforceExportActionAccess(
    capabilityAccess,
    hasPermission('ADMIN.WORKFORCE_ACCESS', 'MANAGE')
  );
  const canRetry = Boolean(
    selected &&
    actionAccess.retry &&
    selected.lifecycleState === 'FAILED' &&
    selected.executionEnabled &&
    !selected.blockers.length &&
    selected.manualRetryCount < (previewQuery.data?.maximumManualRetries ?? 0)
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workforce', 'exports', 'datasets'] }),
      queryClient.invalidateQueries({ queryKey: ['workforce', 'exports', 'preview'] }),
      queryClient.invalidateQueries({ queryKey: ['workforce', 'exports', 'requests'] }),
      selectedId
        ? queryClient.invalidateQueries({
            queryKey: ['workforce', 'exports', selectedId, 'attempts'],
          })
        : Promise.resolve(),
    ]);
  };

  const createExport = useProductSurfaceHighRiskCommand<WorkforceExportRequest>({
    operation: 'HCM_EXPORT_CREATE',
    execute: (command, authority) => {
      const request = command.payload.command;
      if (!request || typeof request !== 'object' || Array.isArray(request)) {
        throw new Error('The governed export command is invalid.');
      }
      return createWorkforceExportRequest(request as CreateWorkforceExportRequest, authority);
    },
    onSuccess: async (created) => {
      await refresh();
      setRequestOpen(false);
      setSelectedId(created.requestId);
      setRequestKey(`workforce-export-${crypto.randomUUID()}`);
      toast.success(
        t(
          created.lifecycleState === 'BLOCKED_PENDING_APPROVAL'
            ? 'exports.toasts.blockedRecorded'
            : 'exports.toasts.submitted'
        )
      );
    },
  });
  const retryExport = useProductSurfaceHighRiskCommand<WorkforceExportRequest>({
    operation: 'HCM_EXPORT_RETRY',
    execute: (command, authority) =>
      retryWorkforceExportRequest(
        command.targetId,
        command.expectedObjectVersion,
        String(command.payload.reason ?? ''),
        authority
      ),
    onSuccess: async (updated) => {
      await refresh();
      setDecision(null);
      setSelectedId(updated.requestId);
      toast.success(t('exports.toasts.retried'));
    },
  });

  const create = async (recipient: string, purpose: string, sourceReference: string) => {
    if (!selectedDataset || !previewQuery.data) return;
    const population = pageDecision?.scope.key ?? 'LEGACY_COMPATIBILITY';
    const dataset = `${selectedDataset.datasetKey}@v${selectedDataset.version}`;
    const command: CreateWorkforceExportRequest = {
      idempotencyKey: requestKey,
      datasetKey: selectedDataset.datasetKey,
      selection,
      exportFormat: 'CSV',
      recipientReference: recipient,
      purpose,
      sourceReference,
    };
    await createExport.begin(
      productSurfaceHighRiskCommand({
        operation: 'HCM_EXPORT_CREATE',
        commandMethod: 'POST',
        commandPath: '/api/people/v1/workforce/exports',
        targetType: 'EXPORT_DATASET',
        targetId: `${dataset}:${population}`,
        expectedObjectVersion: selectedDataset.version,
        idempotencyKey: requestKey,
        rotateIdempotencyInCommandPayload: true,
        payload: { dataset, population, command },
      })
    );
  };

  const decide = async (reason: string) => {
    if (!selected || !decision) return;
    if (decision === 'retry') {
      await retryExport.begin(
        productSurfaceHighRiskCommand({
          operation: 'HCM_EXPORT_RETRY',
          commandMethod: 'PATCH',
          commandPath: `/api/people/v1/workforce/exports/${encodeURIComponent(selected.requestId)}/retry`,
          targetType: 'EXPORT_REQUEST',
          targetId: selected.requestId,
          expectedObjectVersion: selected.version,
          payload: { version: selected.version, reason },
        })
      );
      return;
    }
    setBusy(true);
    try {
      const updated = await cancelExport((authority) =>
        cancelWorkforceExportRequest(selected.requestId, selected.version, reason, authority)
      );
      await refresh();
      setDecision(null);
      setSelectedId(updated.requestId);
      toast.success(t('exports.toasts.cancelled'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.operationError'));
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<GridColDef<WorkforceExportRequest>[]>(
    () => [
      {
        field: 'datasetKey',
        headerName: t('exports.columns.dataset'),
        minWidth: 210,
        flex: 1,
        valueGetter: (_value, row) => datasetLabel(t, row),
      },
      {
        field: 'lifecycleState',
        headerName: t('exports.columns.state'),
        width: 170,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={stateColor(row.lifecycleState)}
            label={display('states', row.lifecycleState)}
          />
        ),
      },
      {
        field: 'populationType',
        headerName: t('exports.columns.scope'),
        minWidth: 160,
        flex: 0.75,
        valueGetter: (_value, row) =>
          row.populationType === 'TENANT'
            ? t('exports.values.tenantScope')
            : t('exports.values.organizationScope', { count: row.organizationIds.length }),
      },
      {
        field: 'recipientReference',
        headerName: t('exports.columns.recipient'),
        minWidth: 190,
        flex: 0.9,
      },
      {
        field: 'createdAt',
        headerName: t('exports.columns.requestedAt'),
        width: 180,
        valueFormatter: (value) =>
          formatDate(String(value), { dateStyle: 'medium', timeStyle: 'short' }),
      },
    ],
    [display, t]
  );

  if (datasetsQuery.isLoading || requestsQuery.isLoading) {
    return <ManagementPanelLoading label={t('exports.loading')} />;
  }
  if (datasetsQuery.isError || requestsQuery.isError) {
    const error = datasetsQuery.error ?? requestsQuery.error;
    return (
      <ManagementPanelError
        message={error instanceof Error ? error.message : t('common.operationError')}
      />
    );
  }

  const preview = previewQuery.data;
  const blocked = requests.filter(
    (request) => request.lifecycleState === 'BLOCKED_PENDING_APPROVAL'
  ).length;
  const active = requests.filter((request) =>
    ACTIVE_STATES.includes(request.lifecycleState)
  ).length;
  const evidenced = requests.filter((request) =>
    ['COMPLETED', 'EXPIRED'].includes(request.lifecycleState)
  ).length;

  return (
    <>
      <Stack gap={2.5}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(260px, 0.7fr) minmax(0, 1.3fr)' },
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: 'background.paper',
          }}
        >
          <Stack gap={1.5} sx={{ p: 2.25, borderRight: { lg: 1 }, borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <FileLock2 size={19} aria-hidden />
              <Typography component="h2" variant="subtitle1">
                {t('exports.policy.title')}
              </Typography>
            </Stack>
            <SelectField<WorkforceExportDatasetKey>
              label={t('exports.fields.dataset')}
              value={effectiveDatasetKey}
              options={datasets.map((dataset) => ({
                value: dataset.datasetKey,
                label: datasetLabel(t, dataset),
              }))}
              onValueChange={(value) => value && setDatasetKey(value)}
            />
            {selectedDataset && (
              <Typography variant="body2" color="text.secondary">
                {t(`exports.datasets.${selectedDataset.datasetKey}.description`, {
                  defaultValue: selectedDataset.description,
                })}
              </Typography>
            )}
          </Stack>
          <Stack gap={1.5} sx={{ p: 2.25 }}>
            {previewQuery.isLoading ? (
              <ManagementPanelLoading label={t('exports.policy.evaluating')} />
            ) : previewQuery.isError || !preview ? (
              <Alert severity="error">
                {previewQuery.error instanceof Error
                  ? previewQuery.error.message
                  : t('common.operationError')}
              </Alert>
            ) : (
              <>
                <Alert
                  severity={preview.executionEnabled ? 'success' : 'warning'}
                  icon={preview.executionEnabled ? <CheckCircle2 /> : <Ban />}
                >
                  <Typography component="p" variant="subtitle2">
                    {t(
                      preview.executionEnabled
                        ? 'exports.policy.readyTitle'
                        : 'exports.policy.blockedTitle'
                    )}
                  </Typography>
                  <Typography variant="body2">
                    {t(
                      preview.executionEnabled
                        ? 'exports.policy.readyDescription'
                        : 'exports.policy.blockedDescription'
                    )}
                  </Typography>
                </Alert>
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  <Chip
                    size="small"
                    icon={<ShieldCheck size={14} />}
                    label={t('exports.policy.masking', { profile: preview.maskingProfile })}
                  />
                  <Chip
                    size="small"
                    icon={<Clock3 size={14} />}
                    label={t('exports.policy.retention', { hours: preview.artifactTtlHours })}
                  />
                  <Chip
                    size="small"
                    label={
                      preview.populationType === 'TENANT'
                        ? t('exports.values.tenantScope')
                        : t('exports.values.organizationScope', {
                            count: preview.organizationIds.length,
                          })
                    }
                  />
                  {preview.blockers.map((blocker) => (
                    <Chip
                      key={blocker}
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={t(`exports.blockers.${blocker}`, { defaultValue: blocker })}
                    />
                  ))}
                </Stack>
              </>
            )}
            <Stack direction="row" justifyContent="flex-end" gap={1}>
              <ActionIconButton
                label={t('common.actions.refresh')}
                tooltip={t('common.actions.refresh')}
                onClick={() => void refresh()}
              >
                <RefreshCw size={17} />
              </ActionIconButton>
              <ActionButton
                intent="primary"
                startIcon={<FileLock2 size={16} />}
                disabled={!preview || !actionAccess.create}
                onClick={() => setRequestOpen(true)}
              >
                {t('exports.actions.newRequest')}
              </ActionButton>
            </Stack>
          </Stack>
        </Box>

        <OperationalKpiStrip
          ariaLabel={t('exports.kpi.label')}
          items={[
            {
              key: 'requests',
              label: t('exports.kpi.requests'),
              value: formatNumber(requests.length),
              tone: 'info',
            },
            {
              key: 'blocked',
              label: t('exports.kpi.blocked'),
              value: formatNumber(blocked),
              tone: blocked ? 'warning' : 'neutral',
            },
            {
              key: 'active',
              label: t('exports.kpi.active'),
              value: formatNumber(active),
              tone: active ? 'info' : 'neutral',
            },
            {
              key: 'evidence',
              label: t('exports.kpi.evidence'),
              value: formatNumber(evidenced),
              tone: evidenced ? 'success' : 'neutral',
            },
          ]}
        />

        <Box>
          <Stack
            direction="row"
            alignItems="baseline"
            justifyContent="space-between"
            gap={1}
            sx={{ mb: 1.25 }}
          >
            <Box>
              <Typography component="h2" variant="h6">
                {t('exports.queue.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('exports.queue.description')}
              </Typography>
            </Box>
            <Chip
              size="small"
              variant="outlined"
              label={t('exports.queue.count', { count: requests.length })}
            />
          </Stack>
          {requests.length === 0 ? (
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <GuidedEmptyState
                kind="first-use"
                title={t('exports.empty.title')}
                description={t('exports.empty.description')}
              />
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: desktop && selected ? 'minmax(0, 1fr) 440px' : '1fr',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'background.paper',
              }}
            >
              {desktop ? (
                <EnterpriseDataGrid
                  ariaLabel={t('exports.queue.label')}
                  rows={requests}
                  columns={columns}
                  getRowId={(row) => row.requestId}
                  hideFooter={requests.length <= 25}
                  minVisibleRows={5}
                  maxVisibleRows={10}
                  onRowClick={({ row }) => setSelectedId(row.requestId)}
                  sx={{ border: 0, borderRadius: 0 }}
                />
              ) : (
                <Stack
                  component="ol"
                  divider={<Divider flexItem />}
                  sx={{ p: 0, m: 0, listStyle: 'none' }}
                >
                  {requests.map((request) => (
                    <Box component="li" key={request.requestId}>
                      <Box
                        component="button"
                        type="button"
                        onClick={() => setSelectedId(request.requestId)}
                        sx={{
                          width: 1,
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          gap: 1,
                          alignItems: 'center',
                          p: 2,
                          border: 0,
                          bgcolor: 'transparent',
                          color: 'text.primary',
                          textAlign: 'left',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                          '&:focus-visible': {
                            outline: 2,
                            outlineColor: 'primary.main',
                            outlineOffset: -2,
                          },
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2">{datasetLabel(t, request)}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {request.recipientReference} ·{' '}
                            {formatDate(request.createdAt, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          color={stateColor(request.lifecycleState)}
                          label={display('states', request.lifecycleState)}
                        />
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
              {desktop && selected && (
                <Box sx={{ borderLeft: 1, borderColor: 'divider' }}>
                  <EvidenceInspector
                    request={selected}
                    attempts={attemptsQuery.data ?? []}
                    attemptsLoading={attemptsQuery.isLoading}
                    drawer={false}
                    canRetry={canRetry}
                    onClose={() => setSelectedId(null)}
                    onCancel={actionAccess.cancel ? () => setDecision('cancel') : undefined}
                    onRetry={() => setDecision('retry')}
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Stack>

      {!desktop && selected && (
        <EvidenceInspector
          request={selected}
          attempts={attemptsQuery.data ?? []}
          attemptsLoading={attemptsQuery.isLoading}
          drawer
          canRetry={canRetry}
          onClose={() => setSelectedId(null)}
          onCancel={actionAccess.cancel ? () => setDecision('cancel') : undefined}
          onRetry={() => setDecision('retry')}
        />
      )}
      <RequestDialog
        key={`${requestKey}-${requestOpen}`}
        open={requestOpen && actionAccess.create}
        busy={busy || createExport.controller.busy}
        executionEnabled={preview?.executionEnabled ?? false}
        defaultRecipient={auth.user?.email ?? ''}
        onClose={() => setRequestOpen(false)}
        onSubmit={create}
      />
      <DecisionDialog
        key={`${selected?.requestId ?? 'none'}-${decision ?? 'none'}`}
        request={selected}
        decision={decision}
        busy={busy || retryExport.controller.busy}
        onClose={() => setDecision(null)}
        onSubmit={decide}
      />
      <ProductSurfaceHighRiskCommandDialog controller={createExport.controller} />
      <ProductSurfaceHighRiskCommandDialog controller={retryExport.controller} />
    </>
  );
}
