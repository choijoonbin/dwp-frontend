import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  FileSearch,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { ActionButton, InlineFeedback, FormField, LoadingState } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  HRIS_OPERATION_MODULES,
  HRIS_OPERATION_PUBLIC_STATES,
  HRIS_OPERATION_SEVERITIES,
  hrisOperationReceiptId,
  hrisOperationSummary,
} from '../model/hris-operations-contract';

import type { HrisReceiptProjection } from '../../../explorer/work-explorer-contract';
import type {
  HrisOperationalExceptionDetail,
  HrisOperationalExceptionPage,
  HrisOperationsEntry,
  HrisOperationsQueryState,
} from '../model/hris-operations-contract';
import type { HrisOperationsWorkspaceLoadState } from '../hooks/use-hris-operations-workspace';

export type HrisOperationsWorkspaceCopy = Readonly<{
  title: string;
  description: string;
  unavailableTitle: string;
  unavailableDescription: string;
  permissionTitle: string;
  permissionDescription: string;
}>;

export const HRIS_OPERATIONS_DEFAULT_COPY: HrisOperationsWorkspaceCopy = Object.freeze({
  title: 'HRIS operations exceptions',
  description:
    'Inspect tenant-safe owner exceptions, redacted evidence and the exact owning workspace.',
  unavailableTitle: 'Operations projection is unavailable',
  unavailableDescription:
    'The owner projection could not be confirmed. No cached exception detail or recovery action is shown.',
  permissionTitle: 'Operations exceptions are not available',
  permissionDescription:
    'This session does not have the required tenant, package, purpose or object scope.',
});

export type HrisOperationsWorkspaceViewProps = Readonly<{
  loadState: HrisOperationsWorkspaceLoadState;
  entry?: HrisOperationsEntry;
  page?: HrisOperationalExceptionPage;
  selectedId: string | null;
  detail?: HrisOperationalExceptionDetail;
  detailLoading: boolean;
  detailDenied: boolean;
  detailUnavailable: boolean;
  receipt?: HrisReceiptProjection;
  receiptId: string | null;
  receiptLoading: boolean;
  receiptDenied: boolean;
  receiptUnavailable: boolean;
  queryState: HrisOperationsQueryState;
  pageIndex: number;
  canPrevious: boolean;
  canNext: boolean;
  updateQueryState: (patch: Partial<HrisOperationsQueryState>) => void;
  select: (exceptionPublicId: string) => void;
  inspectReceipt: (receiptId: string) => void;
  previous: () => void;
  next: () => void;
  refresh: () => Promise<unknown> | void;
  copy?: HrisOperationsWorkspaceCopy;
}>;

function timestamp(value: string | null | undefined, unavailable: string): string {
  if (!value) return unavailable;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? formatDate(date, { dateStyle: 'medium', timeStyle: 'short' })
    : unavailable;
}

function severityColor(severity: HrisOperationalExceptionDetail['severity']) {
  if (severity === 'CRITICAL') return 'error' as const;
  if (severity === 'HIGH' || severity === 'WARNING') return 'warning' as const;
  return 'info' as const;
}

function stateColor(state: HrisOperationalExceptionDetail['state']) {
  if (state === 'RESOLVED') return 'success' as const;
  return state === 'ACKNOWLEDGED' ? ('info' as const) : ('warning' as const);
}

function StateNotice({
  state,
  copy,
}: Readonly<{
  state: Extract<HrisOperationsWorkspaceLoadState, 'PERMISSION' | 'UNAVAILABLE'>;
  copy: HrisOperationsWorkspaceCopy;
}>) {
  const permission = state === 'PERMISSION';
  return (
    <InlineFeedback
      severity={permission ? 'error' : 'warning'}
      title={permission ? copy.permissionTitle : copy.unavailableTitle}
    >
      {permission ? copy.permissionDescription : copy.unavailableDescription}
    </InlineFeedback>
  );
}

function LoadingWorkspace() {
  const { t } = useTranslation('hcm');
  return (
    <Stack gap={2} aria-label={t('administration.operations.loading.exceptions')} aria-busy="true">
      <LoadingState
        embedded
        variant="skeleton"
        label={t('administration.operations.loading.summary')}
        skeletonRows={1}
        skeletonHeight={112}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' },
          gap: 2,
          minWidth: 0,
        }}
      >
        <LoadingState
          embedded
          variant="skeleton"
          label={t('administration.operations.loading.workspace')}
          skeletonRows={1}
          skeletonHeight={340}
        />
        <LoadingState
          embedded
          variant="skeleton"
          label={t('administration.operations.loading.workspace')}
          skeletonRows={1}
          skeletonHeight={340}
        />
      </Box>
    </Stack>
  );
}

function ProjectionNotice({ entry }: Readonly<{ entry: HrisOperationsEntry }>) {
  const { t } = useTranslation('hcm');
  if (entry.projectionState === 'PARTIAL') {
    return (
      <InlineFeedback
        severity="warning"
        title={t('administration.operations.projection.partialTitle')}
      >
        {t('administration.operations.projection.partialDescription')}
      </InlineFeedback>
    );
  }
  if (entry.projectionState === 'STALE') {
    return (
      <InlineFeedback
        severity="warning"
        title={t('administration.operations.projection.staleTitle')}
      >
        {t('administration.operations.projection.staleDescription', {
          refreshedAt: timestamp(
            entry.lastSuccessfulRefreshAt,
            t('administration.operations.notAvailable')
          ),
        })}
      </InlineFeedback>
    );
  }
  return null;
}

function SummaryPanel({ entry }: Readonly<{ entry: HrisOperationsEntry }>) {
  const { t } = useTranslation('hcm');
  const metrics = [
    [t('administration.operations.summary.open'), entry.counts.open],
    [t('administration.operations.summary.acknowledged'), entry.counts.acknowledged],
    [t('administration.operations.summary.resolved'), entry.counts.resolved],
    [t('administration.operations.summary.highImpact'), entry.counts.highImpact],
  ] as const;
  return (
    <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
      <Stack gap={1.5} minWidth={0}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1}
        >
          <Box minWidth={0}>
            <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
              {t('administration.operations.summary.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {t('administration.operations.summary.meta', {
                count: entry.counts.total,
                asOf: timestamp(entry.asOf, t('administration.operations.notAvailable')),
              })}
            </Typography>
          </Box>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
            {entry.sources.map((source) => (
              <Chip
                key={source.ownerModule}
                size="small"
                variant="outlined"
                color={
                  source.state === 'AVAILABLE'
                    ? 'success'
                    : source.state === 'STALE'
                      ? 'warning'
                      : 'error'
                }
                label={`${source.ownerModule}: ${source.state}`}
                title={source.reasonCode}
              />
            ))}
          </Stack>
        </Stack>
        <Divider />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(4, minmax(0, 1fr))',
            },
            gap: 1,
            minWidth: 0,
          }}
        >
          {metrics.map(([label, value]) => (
            <Box key={label} sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight="fontWeightBold">
                {value}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Stack>
    </Paper>
  );
}

function Filters({
  queryState,
  onChange,
}: Readonly<{
  queryState: HrisOperationsQueryState;
  onChange: (patch: Partial<HrisOperationsQueryState>) => void;
}>) {
  const { t } = useTranslation('hcm');
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} minWidth={0}>
      <FormField
        fullWidth={false}
        select
        size="small"
        label={t('administration.operations.filters.ownerModule')}
        value={queryState.ownerModule}
        onChange={(event) =>
          onChange({
            ownerModule: event.target.value as HrisOperationsQueryState['ownerModule'],
            focus: null,
          })
        }
        sx={{ minWidth: { sm: 145 } }}
      >
        <MenuItem value="ALL">{t('administration.operations.filters.allModules')}</MenuItem>
        {HRIS_OPERATION_MODULES.map((module) => (
          <MenuItem key={module} value={module}>
            {module}
          </MenuItem>
        ))}
      </FormField>
      <FormField
        fullWidth={false}
        select
        size="small"
        label={t('administration.operations.filters.severity')}
        value={queryState.severity}
        onChange={(event) =>
          onChange({
            severity: event.target.value as HrisOperationsQueryState['severity'],
            focus: null,
          })
        }
        sx={{ minWidth: { sm: 145 } }}
      >
        <MenuItem value="ALL">{t('administration.operations.filters.allSeverities')}</MenuItem>
        {HRIS_OPERATION_SEVERITIES.map((severity) => (
          <MenuItem key={severity} value={severity}>
            {severity}
          </MenuItem>
        ))}
      </FormField>
      <FormField
        fullWidth={false}
        select
        size="small"
        label={t('administration.operations.filters.ownerState')}
        value={queryState.state}
        onChange={(event) =>
          onChange({
            state: event.target.value as HrisOperationsQueryState['state'],
            focus: null,
          })
        }
        sx={{ minWidth: { sm: 155 } }}
      >
        <MenuItem value="ALL">{t('administration.operations.filters.allStates')}</MenuItem>
        {HRIS_OPERATION_PUBLIC_STATES.map((state) => (
          <MenuItem key={state} value={state}>
            {state}
          </MenuItem>
        ))}
      </FormField>
    </Stack>
  );
}

function ExceptionList({
  page,
  selectedId,
  pageIndex,
  canPrevious,
  canNext,
  onSelect,
  onPrevious,
  onNext,
}: Readonly<{
  page: HrisOperationalExceptionPage;
  selectedId: string | null;
  pageIndex: number;
  canPrevious: boolean;
  canNext: boolean;
  onSelect: (id: string) => void;
  onPrevious: () => void;
  onNext: () => void;
}>) {
  const { t } = useTranslation('hcm');
  return (
    <Paper component="section" variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
      <Stack gap={0} minWidth={0}>
        <Box sx={{ p: 1.5 }}>
          <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
            {t('administration.operations.list.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('administration.operations.list.page', { page: pageIndex + 1 })}
          </Typography>
        </Box>
        <Divider />
        {page.items.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <InlineFeedback severity="info" title={t('administration.operations.list.emptyTitle')}>
              {t('administration.operations.list.emptyDescription')}
            </InlineFeedback>
          </Box>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, minWidth: 0 }}>
            {page.items.map((item) => {
              const selected = item.exceptionPublicId === selectedId;
              return (
                <Box component="li" key={item.exceptionPublicId} sx={{ minWidth: 0 }}>
                  <ButtonBase
                    onClick={() => onSelect(item.exceptionPublicId)}
                    aria-current={selected ? 'true' : undefined}
                    sx={{
                      width: '100%',
                      display: 'block',
                      textAlign: 'left',
                      p: 1.5,
                      borderBottom: 1,
                      borderColor: 'divider',
                      bgcolor: selected ? 'action.selected' : 'transparent',
                      '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: -3,
                      },
                    }}
                  >
                    <Stack gap={0.75} minWidth={0}>
                      <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={item.ownerModule} />
                        <Chip
                          size="small"
                          variant="outlined"
                          color={severityColor(item.severity)}
                          label={item.severity}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          color={stateColor(item.state)}
                          label={item.state}
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        fontWeight="fontWeightBold"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {hrisOperationSummary(item)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {t('administration.operations.list.lastObserved', {
                          observedAt: timestamp(
                            item.lastObservedAt,
                            t('administration.operations.notAvailable')
                          ),
                          count: item.occurrenceCount,
                        })}
                      </Typography>
                    </Stack>
                  </ButtonBase>
                </Box>
              );
            })}
          </Box>
        )}
        <Stack direction="row" justifyContent="space-between" gap={1} sx={{ p: 1.25 }}>
          <ActionButton
            intent="quiet"
            size="small"
            disabled={!canPrevious}
            onClick={onPrevious}
            startIcon={<ArrowLeft size={15} aria-hidden="true" />}
          >
            {t('administration.operations.pagination.previous')}
          </ActionButton>
          <ActionButton
            intent="quiet"
            size="small"
            disabled={!canNext}
            onClick={onNext}
            endIcon={<ArrowRight size={15} aria-hidden="true" />}
          >
            {t('administration.operations.pagination.next')}
          </ActionButton>
        </Stack>
      </Stack>
    </Paper>
  );
}

function ReceiptPanel({
  receipt,
  loading,
  denied,
  unavailable,
}: Readonly<{
  receipt?: HrisReceiptProjection;
  loading: boolean;
  denied: boolean;
  unavailable: boolean;
}>) {
  const { t } = useTranslation('hcm');
  if (loading)
    return (
      <LoadingState
        embedded
        variant="skeleton"
        label={t('administration.operations.receipt.loading')}
        skeletonRows={1}
        skeletonHeight={92}
      />
    );
  if (denied) {
    return (
      <InlineFeedback severity="error" title={t('administration.operations.receipt.deniedTitle')}>
        {t('administration.operations.receipt.deniedDescription')}
      </InlineFeedback>
    );
  }
  if (unavailable) {
    return (
      <InlineFeedback
        severity="warning"
        title={t('administration.operations.receipt.unavailableTitle')}
      >
        {t('administration.operations.receipt.unavailableDescription')}
      </InlineFeedback>
    );
  }
  if (!receipt) return null;
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 0 }} data-testid="hris-operations-receipt">
      <Stack gap={0.5} minWidth={0}>
        <Typography variant="overline">
          {t('administration.operations.receipt.title', { profile: receipt.profile })}
        </Typography>
        <Typography variant="body2" fontWeight="fontWeightBold" sx={{ overflowWrap: 'anywhere' }}>
          {receipt.receipt.commandType}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {receipt.receipt.status} ·{' '}
          {timestamp(receipt.receipt.createdAt, t('administration.operations.notAvailable'))} ·{' '}
          {receipt.receipt.receiptId}
        </Typography>
      </Stack>
    </Paper>
  );
}

function ExceptionDetail({
  selectedId,
  detail,
  loading,
  denied,
  unavailable,
  receipt,
  receiptId,
  receiptLoading,
  receiptDenied,
  receiptUnavailable,
  onInspectReceipt,
}: Readonly<{
  selectedId: string | null;
  detail?: HrisOperationalExceptionDetail;
  loading: boolean;
  denied: boolean;
  unavailable: boolean;
  receipt?: HrisReceiptProjection;
  receiptId: string | null;
  receiptLoading: boolean;
  receiptDenied: boolean;
  receiptUnavailable: boolean;
  onInspectReceipt: (receiptId: string) => void;
}>) {
  const { t } = useTranslation('hcm');
  return (
    <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
      <Stack gap={1.5} minWidth={0}>
        <Stack direction="row" gap={1} alignItems="center">
          <FileSearch size={18} aria-hidden="true" />
          <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
            {t('administration.operations.detail.title')}
          </Typography>
        </Stack>
        <Divider />
        {selectedId === null ? (
          <Typography color="text.secondary">
            {t('administration.operations.detail.select')}
          </Typography>
        ) : loading ? (
          <Stack
            gap={1}
            aria-label={t('administration.operations.detail.loading')}
            aria-busy="true"
          >
            <LoadingState
              embedded
              variant="skeleton"
              label={t('administration.operations.detail.loading')}
              skeletonHeights={[42, 120]}
              skeletonGap={1}
            />
          </Stack>
        ) : denied ? (
          <InlineFeedback
            severity="error"
            title={t('administration.operations.detail.deniedTitle')}
          >
            {t('administration.operations.detail.deniedDescription')}
          </InlineFeedback>
        ) : unavailable ? (
          <InlineFeedback
            severity="warning"
            title={t('administration.operations.detail.unavailableTitle')}
          >
            {t('administration.operations.detail.unavailableDescription')}
          </InlineFeedback>
        ) : detail ? (
          <Stack gap={1.5} minWidth={0} data-testid="hris-operations-exception-detail">
            <Box minWidth={0}>
              <Typography component="h3" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                {hrisOperationSummary(detail)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {t('administration.operations.detail.revision', {
                  module: detail.ownerModule,
                  type: detail.type,
                  revision: detail.sourceRevision,
                })}
              </Typography>
            </Box>
            <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
              <Chip color={severityColor(detail.severity)} label={detail.severity} />
              <Chip color={stateColor(detail.state)} variant="outlined" label={detail.state} />
              <Chip variant="outlined" label={`${detail.occurrenceCount} occurrences`} />
            </Stack>
            <Box
              component="dl"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'max-content minmax(0, 1fr)' },
                columnGap: 2,
                rowGap: 0.75,
                m: 0,
                minWidth: 0,
                '& dt': { color: 'text.secondary' },
                '& dd': { m: 0, overflowWrap: 'anywhere' },
              }}
            >
              <Typography component="dt" variant="body2">
                {t('administration.operations.detail.firstObserved')}
              </Typography>
              <Typography component="dd" variant="body2">
                {timestamp(detail.firstObservedAt, t('administration.operations.notAvailable'))}
              </Typography>
              <Typography component="dt" variant="body2">
                {t('administration.operations.detail.lastObserved')}
              </Typography>
              <Typography component="dd" variant="body2">
                {timestamp(detail.lastObservedAt, t('administration.operations.notAvailable'))}
              </Typography>
              {detail.fieldDecisions.RECOVERY_METADATA === 'VIEW' && detail.correlationId && (
                <>
                  <Typography component="dt" variant="body2">
                    {t('administration.operations.detail.correlation')}
                  </Typography>
                  <Typography component="dd" variant="body2">
                    {detail.correlationId}
                  </Typography>
                </>
              )}
            </Box>
            {detail.fieldDecisions.OWNER_DEEP_LINK === 'VIEW' && detail.ownerDeepLink && (
              <ActionButton
                component="a"
                href={detail.ownerDeepLink}
                intent="secondary"
                endIcon={<ArrowUpRight size={16} aria-hidden="true" />}
                sx={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}
              >
                {t('administration.operations.detail.continueInvestigation')}
              </ActionButton>
            )}
            {detail.fieldDecisions.RECOVERY_METADATA === 'VIEW' &&
              detail.evidenceRefs.length > 0 && (
                <Box minWidth={0}>
                  <Typography component="h3" variant="subtitle2" sx={{ mb: 0.75 }}>
                    {t('administration.operations.detail.evidenceReferences')}
                  </Typography>
                  <Stack component="ul" gap={0.75} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                    {detail.evidenceRefs.map((evidenceRef) => {
                      const candidateReceiptId = hrisOperationReceiptId(evidenceRef);
                      return (
                        <Box component="li" key={evidenceRef} sx={{ minWidth: 0 }}>
                          {candidateReceiptId ? (
                            <ActionButton
                              intent="quiet"
                              size="small"
                              disabled={receiptLoading && receiptId === candidateReceiptId}
                              onClick={() => onInspectReceipt(candidateReceiptId)}
                              sx={{
                                maxWidth: '100%',
                                whiteSpace: 'normal',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {t('administration.operations.detail.inspectReceipt', {
                                receiptId: candidateReceiptId,
                              })}
                            </ActionButton>
                          ) : (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ overflowWrap: 'anywhere' }}
                            >
                              {evidenceRef}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}
            {receiptId && (
              <ReceiptPanel
                receipt={receipt}
                loading={receiptLoading}
                denied={receiptDenied}
                unavailable={receiptUnavailable}
              />
            )}
            <InlineFeedback
              severity="info"
              title={t('administration.operations.detail.readOnlyTitle')}
            >
              {t('administration.operations.detail.readOnlyDescription')}
            </InlineFeedback>
          </Stack>
        ) : (
          <Typography color="text.secondary">
            {t('administration.operations.detail.noAuthorizedDetail')}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

export function HrisOperationsWorkspaceView({
  copy = HRIS_OPERATIONS_DEFAULT_COPY,
  ...props
}: HrisOperationsWorkspaceViewProps) {
  const { t } = useTranslation('hcm');
  const noLiveOwnerProducer =
    props.loadState === 'UNAVAILABLE' &&
    props.entry?.projectionState === 'UNAVAILABLE' &&
    props.entry.counts.total === 0 &&
    props.entry.sources.every((source) => source.state === 'UNAVAILABLE');
  return (
    <Stack
      gap={2}
      data-testid="hris-operations-workspace"
      data-projection-state={props.entry?.projectionState ?? props.loadState}
      sx={{ minWidth: 0, maxWidth: '100%' }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        gap={1.5}
      >
        <Box minWidth={0}>
          <Typography component="h1" variant="h4" sx={{ overflowWrap: 'anywhere' }}>
            {copy.title}
          </Typography>
          <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {copy.description}
          </Typography>
        </Box>
        <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
          <Chip
            icon={<ShieldCheck size={15} />}
            label={t('administration.operations.badges.tenantScoped')}
            variant="outlined"
          />
          <Chip
            label={t('administration.operations.badges.readOnly')}
            color="info"
            variant="outlined"
          />
        </Stack>
      </Stack>

      {noLiveOwnerProducer ? (
        <InlineFeedback severity="info" title={t('administration.operations.producer.emptyTitle')}>
          {t('administration.operations.producer.emptyDescription')}
        </InlineFeedback>
      ) : props.loadState === 'PERMISSION' || props.loadState === 'UNAVAILABLE' ? (
        <StateNotice state={props.loadState} copy={copy} />
      ) : props.loadState === 'LOADING' && (!props.entry || !props.page) ? (
        <LoadingWorkspace />
      ) : props.entry && props.page ? (
        <>
          <ProjectionNotice entry={props.entry} />
          <SummaryPanel entry={props.entry} />
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', lg: 'center' }}
            gap={1}
          >
            <Filters queryState={props.queryState} onChange={props.updateQueryState} />
            <ActionButton
              intent="quiet"
              onClick={() => void props.refresh()}
              startIcon={<RefreshCw size={16} aria-hidden="true" />}
              sx={{ alignSelf: { xs: 'stretch', lg: 'center' } }}
            >
              {t('administration.operations.refresh')}
            </ActionButton>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: 'minmax(260px, 0.9fr) minmax(0, 1.1fr)',
              },
              gap: 2,
              alignItems: 'start',
              minWidth: 0,
            }}
          >
            <ExceptionList
              page={props.page}
              selectedId={props.selectedId}
              pageIndex={props.pageIndex}
              canPrevious={props.canPrevious}
              canNext={props.canNext}
              onSelect={props.select}
              onPrevious={props.previous}
              onNext={props.next}
            />
            <ExceptionDetail
              selectedId={props.selectedId}
              detail={props.detail}
              loading={props.detailLoading}
              denied={props.detailDenied}
              unavailable={props.detailUnavailable}
              receipt={props.receipt}
              receiptId={props.receiptId}
              receiptLoading={props.receiptLoading}
              receiptDenied={props.receiptDenied}
              receiptUnavailable={props.receiptUnavailable}
              onInspectReceipt={props.inspectReceipt}
            />
          </Box>
        </>
      ) : (
        <InlineFeedback
          severity="warning"
          title={t('administration.operations.projection.unavailableTitle')}
        >
          {t('administration.operations.projection.unavailableDescription')}
        </InlineFeedback>
      )}
    </Stack>
  );
}
