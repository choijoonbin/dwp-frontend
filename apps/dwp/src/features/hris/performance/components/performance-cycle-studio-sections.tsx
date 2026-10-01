import { FileCheck2, Pencil, Plus, RefreshCw, Send, Users } from 'lucide-react';
import {
  ActionButton,
  EmptyState,
  foundationTokens,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { HrisDomainSection, HrisStatusChip } from '../../shared';

import type { PerformanceCommandFailure } from '../model/performance-cycle-command';
import type {
  PerformanceCommandReceipt,
  PerformanceCycleCollection,
  PerformanceCycleDetail,
  PerformancePopulationPreview,
  PerformancePopulationPreviewState,
} from '../model/performance-cycle-contract';
import type { PerformanceCycleCopy } from '../model/performance-cycle-copy';

function formatInstant(value: string | null, locale: string): string {
  if (!value) return '';
  return formatDate(
    value,
    { dateStyle: 'medium', timeStyle: 'short' },
    resolveSupportedLocale(locale)
  );
}

function OpaqueReference({ children }: { children: string | null }) {
  return (
    <Typography
      component="span"
      variant="caption"
      sx={{ fontFamily: foundationTokens.font.mono, overflowWrap: 'anywhere' }}
    >
      {children ?? '—'}
    </Typography>
  );
}

export function PerformanceCycleList({
  copy,
  collection,
  selectedCycleId,
  canCreate,
  onSelect,
  onCreate,
}: {
  copy: PerformanceCycleCopy;
  collection: PerformanceCycleCollection;
  selectedCycleId: string | null;
  canCreate: boolean;
  onSelect: (cycleId: string) => void;
  onCreate: () => void;
}) {
  return (
    <HrisDomainSection
      title={copy.cycles}
      description={copy.cyclesDescription}
      action={
        <ActionButton
          size="small"
          intent="secondary"
          disabled={!canCreate}
          startIcon={<Plus size={15} aria-hidden="true" />}
          onClick={onCreate}
        >
          {copy.create}
        </ActionButton>
      }
    >
      {collection.cycles.length ? (
        <List disablePadding aria-label={copy.selectCycle}>
          {collection.cycles.map((cycle, index) => (
            <Box key={cycle.cycleId}>
              {index > 0 && <Divider />}
              <ListItemButton
                selected={cycle.cycleId === selectedCycleId}
                onClick={() => onSelect(cycle.cycleId)}
                sx={{ alignItems: 'flex-start', gap: 1, py: 1.25 }}
              >
                <ListItemText
                  primary={cycle.displayName}
                  secondary={`${cycle.cycleKey} · ${copy.version} ${cycle.activeVersionNo ?? '—'}`}
                  slotProps={{
                    primary: { sx: { overflowWrap: 'anywhere', fontWeight: 'fontWeightBold' } },
                    secondary: { sx: { overflowWrap: 'anywhere' } },
                  }}
                />
                <HrisStatusChip status={cycle.lifecycleState} />
              </ListItemButton>
            </Box>
          ))}
        </List>
      ) : (
        <EmptyState
          size="compact"
          title={copy.noCycles}
          description={copy.noCyclesDescription}
          actionLabel={canCreate ? copy.createDraft : undefined}
          onAction={canCreate ? onCreate : undefined}
        />
      )}
    </HrisDomainSection>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box minWidth={0}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography
        component="div"
        variant="body2"
        fontWeight="fontWeightBold"
        sx={{ overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export function PerformanceCycleDetailPanel({
  copy,
  locale,
  detail,
  busy,
  canEdit,
  canValidate,
  canPreview,
  canPublish,
  onEdit,
  onValidate,
  onPreview,
  onPublish,
}: {
  copy: PerformanceCycleCopy;
  locale: string;
  detail: PerformanceCycleDetail;
  busy: boolean;
  canEdit: boolean;
  canValidate: boolean;
  canPreview: boolean;
  canPublish: boolean;
  onEdit: () => void;
  onValidate: () => void;
  onPreview: () => void;
  onPublish: () => void;
}) {
  const successor = detail.lifecycleState === 'PUBLISHED';
  return (
    <HrisDomainSection
      title={copy.detail}
      description={copy.detailDescription}
      action={<HrisStatusChip status={detail.lifecycleState} />}
    >
      <Stack gap={2} sx={{ p: 2, minWidth: 0 }}>
        <Box>
          <Typography component="h3" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
            {detail.displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {detail.cycleKey}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          <Fact
            label={copy.version}
            value={`${detail.version.versionNo} · ${detail.version.versionState}`}
          />
          <Fact label={copy.revision} value={String(detail.aggregateVersion)} />
          <Fact
            label={copy.period}
            value={`${formatInstant(detail.version.effectiveFrom, locale)} — ${
              detail.version.effectiveTo
                ? formatInstant(detail.version.effectiveTo, locale)
                : copy.openEnded
            }`}
          />
          <Fact
            label={copy.authoredBy}
            value={<OpaqueReference>{String(detail.version.authoredBy)}</OpaqueReference>}
          />
          <Fact
            label={copy.publishedBy}
            value={
              detail.version.publishedBy ? (
                <OpaqueReference>{String(detail.version.publishedBy)}</OpaqueReference>
              ) : (
                copy.notPublished
              )
            }
          />
          <Fact label={copy.stages} value={String(detail.version.stages.length)} />
        </Box>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <ActionButton
            size="small"
            intent="secondary"
            disabled={!canEdit || busy}
            startIcon={<Pencil size={15} aria-hidden="true" />}
            onClick={onEdit}
          >
            {successor ? copy.createSuccessor : copy.edit}
          </ActionButton>
          <ActionButton
            size="small"
            intent="secondary"
            disabled={!canValidate || busy}
            startIcon={<FileCheck2 size={15} aria-hidden="true" />}
            onClick={onValidate}
          >
            {copy.validate}
          </ActionButton>
          <ActionButton
            size="small"
            intent="secondary"
            disabled={!canPreview || busy}
            startIcon={<Users size={15} aria-hidden="true" />}
            onClick={onPreview}
          >
            {copy.preview}
          </ActionButton>
          <ActionButton
            size="small"
            intent="primary"
            disabled={!canPublish || busy}
            startIcon={<Send size={15} aria-hidden="true" />}
            onClick={onPublish}
          >
            {copy.publish}
          </ActionButton>
        </Stack>
      </Stack>
    </HrisDomainSection>
  );
}

export function PerformancePopulationPreviewPanel({
  copy,
  locale,
  preview,
  state,
}: {
  copy: PerformanceCycleCopy;
  locale: string;
  preview: PerformancePopulationPreview | null;
  state: PerformancePopulationPreviewState | null;
}) {
  return (
    <HrisDomainSection
      title={copy.participantPreview}
      description={copy.participantPreviewDescription}
    >
      {!preview ? (
        <EmptyState size="compact" title={copy.noPreview} description={copy.noPreviewDescription} />
      ) : (
        <Stack gap={1.5} sx={{ p: 2, minWidth: 0 }}>
          {state === 'STALE' && (
            <InlineFeedback severity="warning" title={copy.stalePreviewTitle}>
              {copy.stalePreviewDescription}
            </InlineFeedback>
          )}
          {state === 'RESULT_UNKNOWN' && (
            <InlineFeedback severity="warning" title={copy.unknownPreviewTitle}>
              {copy.unknownPreviewDescription}
            </InlineFeedback>
          )}
          <Stack direction="row" gap={1} flexWrap="wrap" aria-label={copy.participantPreview}>
            <Chip
              size="small"
              variant="outlined"
              label={`${copy.participantCount}: ${preview.participantCount}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${copy.reviewerCount}: ${preview.reviewerAssignmentCount}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${copy.snapshotRevision}: ${preview.workforceSnapshotRevision}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${copy.expires}: ${preview.expiresAt ? formatInstant(preview.expiresAt, locale) : '—'}`}
            />
          </Stack>
          <Paper
            variant="outlined"
            tabIndex={0}
            aria-label={copy.participantPreview}
            sx={{ overflowX: 'auto', maxWidth: '100%' }}
          >
            <Table size="small" sx={{ minWidth: 1360 }}>
              <TableHead>
                <TableRow>
                  <TableCell>{copy.participantRef}</TableCell>
                  <TableCell>{copy.assignmentRef}</TableCell>
                  <TableCell>{copy.status}</TableCell>
                  <TableCell>{copy.organizationRef}</TableCell>
                  <TableCell>{copy.reviewerRef}</TableCell>
                  <TableCell>{copy.jobProfileRef}</TableCell>
                  <TableCell>{copy.gradeRef}</TableCell>
                  <TableCell>{copy.eligibility}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.members.map((member) => (
                  <TableRow key={`${member.participantRef}:${member.primaryAssignmentRef}`}>
                    <TableCell>
                      <OpaqueReference>{member.participantRef}</OpaqueReference>
                    </TableCell>
                    <TableCell>
                      <OpaqueReference>{member.primaryAssignmentRef}</OpaqueReference>
                    </TableCell>
                    <TableCell>{member.workforceStatus}</TableCell>
                    <TableCell>
                      <OpaqueReference>{member.organizationRef}</OpaqueReference>
                    </TableCell>
                    <TableCell>
                      <OpaqueReference>{member.reviewerAssignmentRef}</OpaqueReference>
                    </TableCell>
                    <TableCell>
                      <OpaqueReference>{member.jobProfileRef}</OpaqueReference>
                    </TableCell>
                    <TableCell>
                      <OpaqueReference>{member.gradeRef}</OpaqueReference>
                    </TableCell>
                    <TableCell>{member.eligibilityCode}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      )}
    </HrisDomainSection>
  );
}

export function PerformanceCommandNotice({
  copy,
  failure,
  receipt,
  receiptError,
  busy,
  onCheckReceipt,
  onRetryExact,
  onLoadLatest,
}: {
  copy: PerformanceCycleCopy;
  failure: PerformanceCommandFailure | null;
  receipt: PerformanceCommandReceipt | null;
  receiptError: unknown;
  busy: boolean;
  onCheckReceipt: () => void;
  onRetryExact: () => void;
  onLoadLatest: () => void;
}) {
  if (!failure) return null;
  if (failure.kind === 'CONFLICT') {
    return (
      <InlineFeedback
        severity="warning"
        title={copy.conflictTitle}
        action={
          <ActionButton size="small" intent="quiet" onClick={onLoadLatest}>
            {copy.loadLatest}
          </ActionButton>
        }
      >
        {copy.conflictDescription}
      </InlineFeedback>
    );
  }
  if (failure.kind === 'FORBIDDEN' || failure.kind === 'UNAUTHENTICATED') {
    return (
      <InlineFeedback severity="error" title={copy.permissionTitle}>
        {copy.permissionDescription}
      </InlineFeedback>
    );
  }
  if (failure.kind === 'RESULT_UNKNOWN') {
    return (
      <InlineFeedback
        severity="warning"
        title={copy.commandUnknownTitle}
        action={
          failure.receiptId ? (
            <ActionButton
              size="small"
              intent="quiet"
              loading={busy}
              startIcon={<RefreshCw size={14} aria-hidden="true" />}
              onClick={onCheckReceipt}
            >
              {copy.checkReceipt}
            </ActionButton>
          ) : (
            <ActionButton size="small" intent="quiet" loading={busy} onClick={onRetryExact}>
              {copy.retryExact}
            </ActionButton>
          )
        }
      >
        {copy.commandUnknownDescription}
        {receipt && ` ${receipt.state}.`}
        {receiptError ? ` ${copy.partialDescription}` : null}
      </InlineFeedback>
    );
  }
  return (
    <InlineFeedback severity="error" title={copy.rejectedTitle}>
      {copy.rejectedDescription}
    </InlineFeedback>
  );
}
