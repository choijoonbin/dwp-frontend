import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Eye, RefreshCw, Snowflake } from 'lucide-react';
import {
  ActionButton,
  GlyphSurface,
  InlineFeedback,
  LiveStatus,
  OperationalContextBar,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { HrisQueryBoundary } from '../../shared';
import { getPerformanceReviewOperationsCopy } from './performance-review-operations-copy';
import { PERFORMANCE_REVIEW_OPERATIONS_ROUTE } from './performance-review-operations-contract';
import {
  useHrisPerformanceReviewOperationsRequestScope,
  usePerformanceReviewOperationsRuntime,
} from './use-performance-review-operations';

import type { PerformancePopulationPreview } from '../model/performance-cycle-contract';
import type {
  PerformancePopulationFreezeReceipt,
  PerformancePopulationFreezeResult,
} from './population-freeze-contract';
import type { PerformanceReviewOperationsDataSource } from './performance-review-operations-api';
import type { PerformanceReviewOperationsCopy } from './performance-review-operations-copy';
import type {
  PerformanceFieldDecision,
  PerformanceReviewOperationItem,
  PerformanceReviewOperationsProjection,
} from './performance-review-operations-contract';
import type { PerformanceReviewOperationsCommandExecutors } from './use-performance-review-operations';

export type PerformanceReviewOperationsWorkspaceViewProps = Readonly<{
  copy: PerformanceReviewOperationsCopy;
  locale: string;
  timeZone: string;
  projection: PerformanceReviewOperationsProjection | undefined;
  selectedItem: PerformanceReviewOperationItem | null;
  preview: PerformancePopulationPreview | null;
  previewConfirmedByProjection: boolean;
  freezeResult: PerformancePopulationFreezeResult | null;
  receipt: PerformancePopulationFreezeReceipt | null;
  commandError: Error | null;
  commandBusy: boolean;
  previewExecutorConnected: boolean;
  freezeExecutorConnected: boolean;
  freezeRetryPending: boolean;
  loading: boolean;
  fetching: boolean;
  error: unknown;
  pageIndex: number;
  canNext: boolean;
  canPrevious: boolean;
  onSelect: (itemPublicId: string) => void;
  onRefresh: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onPreview: () => void;
  onFreeze: (reason: string) => void;
  onRetryFreeze: () => void;
}>;

export type HrisPerformanceReviewOperationsWorkspaceProps = Readonly<{
  dataSource?: PerformanceReviewOperationsDataSource;
  commandExecutors: PerformanceReviewOperationsCommandExecutors;
  focusResourcePublicId?: string | null;
  onFocusResourcePublicIdChange?: (resourcePublicId: string | null) => void;
}>;

function fieldText<T extends { code?: string; label?: string }>(
  field: PerformanceFieldDecision<T> | undefined,
  masked: string
): string {
  if (!field || field.decision === 'MASK') return masked;
  return field.value.label ?? field.value.code ?? masked;
}

function formatInstant(value: string | null, locale: string, timeZone: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

function hasAction(item: PerformanceReviewOperationItem, key: string): boolean {
  return item.availableActions.some((action) => action.actionKey === key);
}

function OperationList({
  copy,
  projection,
  selectedItem,
  onSelect,
  navigationLocked,
}: Pick<
  PerformanceReviewOperationsWorkspaceViewProps,
  'copy' | 'projection' | 'selectedItem' | 'onSelect'
> & { navigationLocked: boolean }) {
  if (!projection || projection.items.length === 0) {
    return (
      <Paper component="section" variant="outlined" sx={{ p: 2, minWidth: 0 }}>
        <Typography component="h3" variant="subtitle1">
          {copy.emptyTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {copy.emptyDescription}
        </Typography>
      </Paper>
    );
  }
  return (
    <Paper component="section" variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
      <Typography component="h3" variant="subtitle1" sx={{ px: 0.5, mb: 1 }}>
        {copy.listTitle}
      </Typography>
      <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {projection.items.map((item) => {
          const selected = item.itemPublicId === selectedItem?.itemPublicId;
          return (
            <Box component="li" key={item.itemPublicId} sx={{ '& + &': { mt: 0.75 } }}>
              <Box
                component="button"
                type="button"
                aria-pressed={selected}
                disabled={navigationLocked}
                onClick={() => onSelect(item.itemPublicId)}
                sx={{
                  width: '100%',
                  minHeight: 48,
                  p: 1.25,
                  border: 1,
                  borderColor: selected ? 'primary.main' : 'divider',
                  borderRadius: 1.5,
                  bgcolor: selected ? 'action.selected' : 'background.paper',
                  color: 'text.primary',
                  textAlign: 'left',
                  cursor: 'pointer',
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                }}
              >
                <Typography component="span" variant="body2" fontWeight={700} display="block">
                  {item.title}
                </Typography>
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {item.statusCode.replaceAll('_', ' ')}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <Box minWidth={0}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

function OperationDetail({
  copy,
  locale,
  timeZone,
  item,
  preview,
  previewConfirmedByProjection,
  commandBusy,
  previewExecutorConnected,
  freezeExecutorConnected,
  freezeRetryPending,
  onPreview,
  onOpenFreeze,
}: Readonly<{
  copy: PerformanceReviewOperationsCopy;
  locale: string;
  timeZone: string;
  item: PerformanceReviewOperationItem;
  preview: PerformancePopulationPreview | null;
  previewConfirmedByProjection: boolean;
  commandBusy: boolean;
  previewExecutorConnected: boolean;
  freezeExecutorConnected: boolean;
  freezeRetryPending: boolean;
  onPreview: () => void;
  onOpenFreeze: () => void;
}>) {
  const assignment = item.fieldGroups.REVIEW_ASSIGNMENT;
  const queue = item.fieldGroups.WORK_QUEUE;
  const due = item.fieldGroups.DUE_STATUS;
  return (
    <Paper component="section" variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }}>
        <GlyphSurface size={40} variant="soft">
          <ClipboardCheck size={20} aria-hidden="true" />
        </GlyphSurface>
        <Box minWidth={0} flex={1}>
          <Typography component="h3" variant="subtitle1">
            {copy.detailTitle}
          </Typography>
          <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
            {item.title}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {item.statusCode.replaceAll('_', ' ')}
        </Typography>
      </Stack>
      <Divider sx={{ my: 2 }} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <DetailValue label={copy.assignment} value={fieldText(assignment, copy.masked)} />
        <DetailValue label={copy.dueStatus} value={fieldText(due, copy.masked)} />
        <DetailValue
          label={copy.openCount}
          value={queue?.decision === 'VIEW' ? String(queue.value.openCount) : copy.masked}
        />
        <DetailValue
          label={copy.oldestAt}
          value={
            queue?.decision === 'VIEW'
              ? formatInstant(queue.value.oldestAt, locale, timeZone)
              : copy.masked
          }
        />
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 2 }}>
        {hasAction(item, 'hris.action.per.preview-population') && (
          <ActionButton
            intent="secondary"
            loading={commandBusy}
            disabled={!previewExecutorConnected || freezeRetryPending}
            startIcon={<Eye size={16} aria-hidden="true" />}
            onClick={onPreview}
          >
            {copy.preview}
          </ActionButton>
        )}
        {hasAction(item, 'hris.action.per.freeze-population') && (
          <ActionButton
            intent="primary"
            disabled={
              !freezeExecutorConnected ||
              !preview ||
              !previewConfirmedByProjection ||
              commandBusy ||
              freezeRetryPending
            }
            startIcon={<Snowflake size={16} aria-hidden="true" />}
            onClick={onOpenFreeze}
          >
            {copy.freeze}
          </ActionButton>
        )}
      </Stack>
      {preview && (
        <Box
          component="section"
          aria-label={copy.previewEvidence}
          sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5 }}
        >
          <Typography component="h4" variant="subtitle2">
            {copy.previewEvidence}
          </Typography>
          <Box
            sx={{
              mt: 1,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            <DetailValue label={copy.participantCount} value={String(preview.participantCount)} />
            <DetailValue
              label={copy.reviewerCount}
              value={String(preview.reviewerAssignmentCount)}
            />
            <DetailValue
              label={copy.snapshotRevision}
              value={String(preview.workforceSnapshotRevision)}
            />
          </Box>
        </Box>
      )}
    </Paper>
  );
}

export function PerformanceReviewOperationsWorkspaceView({
  copy,
  locale,
  timeZone,
  projection,
  selectedItem,
  preview,
  previewConfirmedByProjection,
  freezeResult,
  receipt,
  commandError,
  commandBusy,
  previewExecutorConnected,
  freezeExecutorConnected,
  freezeRetryPending,
  loading,
  fetching,
  error,
  pageIndex,
  canNext,
  canPrevious,
  onSelect,
  onRefresh,
  onNext,
  onPrevious,
  onPreview,
  onFreeze,
  onRetryFreeze,
}: PerformanceReviewOperationsWorkspaceViewProps) {
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const closeFreeze = () => {
    setFreezeOpen(false);
    setReason('');
    setConfirmed(false);
  };
  const state = projection?.queryState;
  return (
    <Stack
      gap={2}
      data-testid="performance-review-operations-workspace"
      data-route={PERFORMANCE_REVIEW_OPERATIONS_ROUTE}
      data-scope="performance-review-operations"
    >
      <Paper component="header" variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }}>
          <GlyphSurface size={42} variant="soft">
            <Snowflake size={21} aria-hidden="true" />
          </GlyphSurface>
          <Box minWidth={0}>
            <Typography variant="overline" color="text.secondary">
              {copy.eyebrow}
            </Typography>
            <Typography component="h2" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {copy.description}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <OperationalContextBar
        label={copy.title}
        items={[
          { label: 'IAQ-021', value: state?.scopeDecisionRevision ?? copy.unavailable },
          { label: copy.listTitle, value: String(projection?.items.length ?? 0) },
        ]}
        status={
          <LiveStatus
            state={state?.freshness === 'STALE' ? 'stale' : error ? 'degraded' : 'live'}
            label={state?.freshness === 'CURRENT' ? copy.connected : copy.unavailable}
            refreshLabel={copy.refresh}
            refreshing={fetching}
            onRefresh={onRefresh}
          />
        }
      />

      {(!previewExecutorConnected || !freezeExecutorConnected) && (
        <InlineFeedback severity="info" title={copy.integrationTitle}>
          {copy.integrationDescription}
        </InlineFeedback>
      )}
      {state?.state === 'PARTIAL' && (
        <InlineFeedback severity="warning" title={copy.partialTitle}>
          {copy.partialDescription}
        </InlineFeedback>
      )}
      {state?.state === 'UNAVAILABLE' && (
        <InlineFeedback severity="warning" title={copy.unavailableTitle}>
          {copy.unavailableDescription}
        </InlineFeedback>
      )}
      {state?.freshness === 'STALE' && (
        <InlineFeedback severity="warning" title={copy.staleTitle}>
          {copy.partialDescription}
        </InlineFeedback>
      )}
      {commandError && (
        <InlineFeedback
          severity="error"
          title={copy.commandFailed}
          action={
            freezeRetryPending && freezeExecutorConnected ? (
              <ActionButton
                size="small"
                intent="secondary"
                loading={commandBusy}
                onClick={onRetryFreeze}
              >
                {copy.reconcile}
              </ActionButton>
            ) : undefined
          }
        >
          {copy.commandFailed}
        </InlineFeedback>
      )}
      {receipt && ['ACCEPTED', 'RUNNING', 'RESULT_UNKNOWN'].includes(receipt.state) && (
        <InlineFeedback
          severity="warning"
          title={copy.resultUnknownTitle}
          action={
            <ActionButton
              size="small"
              intent="secondary"
              loading={commandBusy}
              onClick={onRetryFreeze}
            >
              {copy.reconcile}
            </ActionButton>
          }
        >
          {copy.resultUnknownDescription}
        </InlineFeedback>
      )}
      {freezeResult?.freeze && freezeResult.receipt.state === 'SUCCEEDED' && (
        <InlineFeedback severity="success" title={copy.frozenTitle}>
          {copy.frozenDescription} {copy.frozenAt}:{' '}
          {formatInstant(freezeResult.freeze.frozenAt, locale, timeZone)}
        </InlineFeedback>
      )}

      <HrisQueryBoundary loading={loading} error={error} retrying={fetching} onRetry={onRefresh}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(280px, 360px) minmax(0, 1fr)',
            },
            alignItems: 'start',
            gap: 2,
            minWidth: 0,
          }}
        >
          <OperationList
            copy={copy}
            projection={projection}
            selectedItem={selectedItem}
            onSelect={onSelect}
            navigationLocked={freezeRetryPending || commandBusy}
          />
          {selectedItem && (
            <OperationDetail
              copy={copy}
              locale={locale}
              timeZone={timeZone}
              item={selectedItem}
              preview={preview}
              previewConfirmedByProjection={previewConfirmedByProjection}
              commandBusy={commandBusy}
              previewExecutorConnected={previewExecutorConnected}
              freezeExecutorConnected={freezeExecutorConnected}
              freezeRetryPending={freezeRetryPending}
              onPreview={onPreview}
              onOpenFreeze={() => setFreezeOpen(true)}
            />
          )}
        </Box>
      </HrisQueryBoundary>

      <Stack direction="row" gap={1} justifyContent="flex-end" alignItems="center">
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
          {pageIndex + 1}
        </Typography>
        <ActionButton
          intent="quiet"
          disabled={!canPrevious || fetching || freezeRetryPending || commandBusy}
          onClick={onPrevious}
        >
          {copy.previous}
        </ActionButton>
        <ActionButton
          intent="quiet"
          disabled={!canNext || fetching || freezeRetryPending || commandBusy}
          onClick={onNext}
        >
          {copy.next}
        </ActionButton>
        <ActionButton
          intent="secondary"
          loading={fetching}
          disabled={freezeRetryPending || commandBusy}
          startIcon={<RefreshCw size={16} aria-hidden="true" />}
          onClick={onRefresh}
        >
          {copy.refresh}
        </ActionButton>
      </Stack>

      <Dialog
        open={freezeOpen}
        onClose={commandBusy ? undefined : closeFreeze}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{copy.freezeTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {copy.freezeDescription}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label={copy.reason}
            helperText={copy.reasonHelp}
            value={reason}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            onChange={(event) => setReason(event.target.value)}
          />
          <FormControlLabel
            sx={{ mt: 1, alignItems: 'flex-start' }}
            control={
              <Checkbox
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
            }
            label={copy.immutableConfirmation}
          />
        </DialogContent>
        <DialogActions>
          <ActionButton intent="quiet" disabled={commandBusy} onClick={closeFreeze}>
            {copy.cancel}
          </ActionButton>
          <ActionButton
            intent="primary"
            loading={commandBusy}
            disabled={!confirmed || reason.trim().length < 10}
            startIcon={<Snowflake size={16} aria-hidden="true" />}
            onClick={() => {
              onFreeze(reason);
              closeFreeze();
            }}
          >
            {copy.freeze}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export function HrisPerformanceReviewOperationsWorkspace({
  dataSource,
  commandExecutors,
  focusResourcePublicId,
  onFocusResourcePublicIdChange,
}: HrisPerformanceReviewOperationsWorkspaceProps) {
  const { i18n } = useTranslation('hcm');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestScope = useHrisPerformanceReviewOperationsRequestScope();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const copy = getPerformanceReviewOperationsCopy(locale);
  const controlledFocus = focusResourcePublicId !== undefined;
  const focus = controlledFocus ? focusResourcePublicId : searchParams.get('focus');
  const setFocus = (resourcePublicId: string | null) => {
    onFocusResourcePublicIdChange?.(resourcePublicId);
    if (controlledFocus) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (resourcePublicId) next.set('focus', resourcePublicId);
      else next.delete('focus');
      return next;
    });
  };
  const runtime = usePerformanceReviewOperationsRuntime({
    requestScope,
    locale,
    timeZone,
    dataSource,
    commandExecutors,
    focusResourcePublicId: focus,
    onFocusResourcePublicIdChange: setFocus,
  });
  return (
    <PerformanceReviewOperationsWorkspaceView
      key={JSON.stringify(requestScope.cacheKey)}
      copy={copy}
      locale={locale}
      timeZone={timeZone}
      {...runtime}
      onSelect={runtime.selectItem}
      onRefresh={runtime.refresh}
      onNext={runtime.nextPage}
      onPrevious={runtime.previousPage}
      onPreview={() => void runtime.previewSelected()}
      onFreeze={(reason) => void runtime.freezeSelected(reason)}
      onRetryFreeze={() => void runtime.reconcileFreeze()}
    />
  );
}

export default HrisPerformanceReviewOperationsWorkspace;
