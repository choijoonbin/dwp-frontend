import { useEffect, useMemo, useState } from 'react';
import { GitBranch, GitMerge, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton } from '@dwp-frontend/design-system';

import { defaultRoutineMergeSelections, routineConflictGroups } from './dwaion-routine-model';

import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type {
  DwaionRoutine,
  DwaionRoutineChangeKey,
  DwaionRoutineDraft,
  DwaionRoutineMergeSelections,
} from './dwaion-routine-model';

export type DwaionRoutineRecoveryStrategy = 'FORK' | 'SERVER' | 'MERGE';

export type DwaionRoutineConflictSnapshot = {
  routineId: string;
  baseRevision: number;
  baseDraft: DwaionRoutineDraft;
  localDraft: DwaionRoutineDraft;
  serverRoutine: DwaionRoutine | null;
  serverDraft: DwaionRoutineDraft | null;
  loading: boolean;
  loadError: boolean;
};

export type DwaionRoutineConflictReceipt = {
  strategy: DwaionRoutineRecoveryStrategy;
  routineId: string;
  revision: number;
  commandId: string;
  integrityFingerprint: string;
  createdAt: string;
};

export type DwaionRoutineConflictFailure = {
  message: string;
  serverRoutine: DwaionRoutine | null;
};

const EMPTY_SELECTIONS: DwaionRoutineMergeSelections = {
  IDENTITY: 'SERVER',
  TRIGGER: 'SERVER',
  SOURCES: 'SERVER',
  DELIVERY_AND_CONSENT: 'SERVER',
  BUDGET_AND_RECOVERY: 'SERVER',
};

export function DwaionRoutineConflictWorkbench({
  conflict,
  receipt,
  failure,
  busy,
  copy,
  formatTimestamp = (value) => value,
  onResolve,
  onReload,
  onDismiss,
}: {
  conflict: DwaionRoutineConflictSnapshot | null;
  receipt: DwaionRoutineConflictReceipt | null;
  failure: DwaionRoutineConflictFailure | null;
  busy: boolean;
  copy: DwaionRoutineCopy;
  formatTimestamp?: (value: string) => string;
  onResolve: (
    strategy: DwaionRoutineRecoveryStrategy,
    selections: DwaionRoutineMergeSelections
  ) => void;
  onReload: () => void;
  onDismiss: () => void;
}) {
  const [strategy, setStrategy] = useState<DwaionRoutineRecoveryStrategy>('FORK');
  const [selections, setSelections] = useState<DwaionRoutineMergeSelections>(EMPTY_SELECTIONS);
  const comparisonKey = conflict
    ? `${conflict.routineId}:${conflict.baseRevision}:${conflict.serverRoutine?.revision ?? 'loading'}`
    : 'none';
  const groups = useMemo(
    () =>
      conflict?.serverDraft
        ? routineConflictGroups(conflict.baseDraft, conflict.localDraft, conflict.serverDraft)
        : [],
    [conflict]
  );

  useEffect(() => {
    setStrategy('FORK');
    setSelections(
      conflict?.serverDraft
        ? defaultRoutineMergeSelections(
            conflict.baseDraft,
            conflict.localDraft,
            conflict.serverDraft
          )
        : EMPTY_SELECTIONS
    );
  }, [comparisonKey, conflict]);

  if (!conflict && !receipt) return null;

  return (
    <Stack gap={1.5} data-testid="dwaion-routine-conflict-workbench">
      {conflict ? (
        <Box
          role="alert"
          sx={{
            border: 1,
            borderColor: 'error.main',
            borderRadius: 2,
            bgcolor: 'background.paper',
            color: 'text.primary',
            p: { xs: 1.5, md: 2 },
            overflow: 'hidden',
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5}>
            <Stack direction="row" gap={1.25} sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  bgcolor: 'error.dark',
                  color: 'error.contrastText',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={22} aria-hidden="true" />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 0.5 }}>
                  <Chip size="small" color="error" label={copy.conflictHttpStatus} />
                  <Chip size="small" label={copy.conflictPolicyBlocked} />
                  <Chip size="small" label={copy.conflictSafeMode} />
                </Stack>
                <Typography component="h2" variant="h6" color="error.main">
                  {copy.conflictTitle}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: 'inherit' }}>
                  {copy.conflictDescription}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.75, display: 'block', overflowWrap: 'anywhere' }}
                >
                  {copy.conflictRoutineId}: {conflict.routineId} · {copy.conflictBase}{' '}
                  {copy.conflictRevision} {conflict.baseRevision}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>
      ) : null}

      {conflict ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 2fr) minmax(320px, 1fr)' },
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          <Stack gap={1.5} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
                p: { xs: 1.5, md: 2 },
              }}
            >
              <Typography component="h3" variant="subtitle1">
                {copy.conflictCompareTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {copy.conflictWorkbenchDescription}
              </Typography>
              {conflict.loading ? (
                <Stack direction="row" gap={1} alignItems="center" sx={{ py: 3 }} role="status">
                  <CircularProgress size={20} />
                  <Typography variant="body2">{copy.conflictLoadingServer}</Typography>
                </Stack>
              ) : conflict.serverDraft && conflict.serverRoutine ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1,
                    mt: 1.5,
                  }}
                >
                  <RevisionCard
                    label={copy.conflictLocal}
                    revision={conflict.baseRevision}
                    draft={conflict.localDraft}
                    copy={copy}
                    accent="primary.main"
                  />
                  <RevisionCard
                    label={copy.conflictServer}
                    revision={conflict.serverRoutine.revision}
                    draft={conflict.serverDraft}
                    copy={copy}
                    accent="error.main"
                  />
                </Box>
              ) : (
                <Alert
                  severity="error"
                  action={
                    <ActionButton
                      intent="quiet"
                      size="small"
                      startIcon={<RefreshCw size={15} aria-hidden="true" />}
                      onClick={onReload}
                    >
                      {copy.conflictReload}
                    </ActionButton>
                  }
                  sx={{ mt: 1.5 }}
                >
                  {copy.conflictFetchFailed}
                </Alert>
              )}
            </Box>

            {strategy === 'MERGE' && conflict.serverDraft ? (
              <Box
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  p: { xs: 1.5, md: 2 },
                }}
              >
                <Stack direction="row" gap={1} alignItems="center">
                  <GitMerge size={19} aria-hidden="true" />
                  <Typography component="h3" variant="subtitle1">
                    {copy.conflictMergeInspector}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                  {copy.conflictMergeHelp}
                </Typography>
                <Stack gap={1}>
                  {groups.map((group) => (
                    <Box
                      component="fieldset"
                      key={group.key}
                      sx={{ m: 0, p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1.5 }}
                    >
                      <Stack
                        component="legend"
                        direction={{ xs: 'column', sm: 'row' }}
                        alignItems={{ sm: 'center' }}
                        gap={0.75}
                        sx={{ px: 0.5 }}
                      >
                        <Typography component="span" variant="subtitle2">
                          {copy.changeLabels[group.key]}
                        </Typography>
                        <Chip
                          size="small"
                          color={group.status === 'CONFLICT' ? 'warning' : 'default'}
                          label={copy.conflictGroupStatus[group.status]}
                        />
                      </Stack>
                      <RadioGroup
                        row
                        name={`routine-merge-${group.key}`}
                        value={selections[group.key]}
                        onChange={(event) =>
                          setSelections((current) => ({
                            ...current,
                            [group.key]: event.target.value as 'LOCAL' | 'SERVER',
                          }))
                        }
                        sx={{ mt: 0.5, gap: { xs: 0, sm: 1 } }}
                      >
                        <FormControlLabel
                          value="LOCAL"
                          control={<Radio />}
                          label={copy.conflictUseLocal}
                          sx={{ minHeight: 44 }}
                        />
                        <FormControlLabel
                          value="SERVER"
                          control={<Radio />}
                          label={copy.conflictUseServer}
                          sx={{ minHeight: 44 }}
                        />
                      </RadioGroup>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', overflowWrap: 'anywhere' }}
                      >
                        {draftGroupSummary(
                          group.key,
                          selections[group.key] === 'LOCAL'
                            ? conflict.localDraft
                            : conflict.serverDraft!,
                          copy
                        )}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}
          </Stack>

          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.paper',
              p: { xs: 1.5, md: 2 },
              position: { lg: 'sticky' },
              top: { lg: 88 },
              minWidth: 0,
            }}
          >
            <Stack direction="row" gap={1} alignItems="center">
              <GitBranch size={19} aria-hidden="true" />
              <Typography component="h3" variant="subtitle1">
                {copy.conflictWorkbenchTitle}
              </Typography>
              <Chip size="small" label={copy.conflictThreeWayDiff} sx={{ ml: 'auto' }} />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {copy.conflictStrategyTitle}
            </Typography>
            <RadioGroup
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as DwaionRoutineRecoveryStrategy)}
              sx={{ mt: 1 }}
            >
              <StrategyOption
                value="FORK"
                label={copy.forkVersion}
                description={copy.conflictForkDescription}
                badge={copy.conflictRecommended}
              />
              <StrategyOption
                value="SERVER"
                label={copy.discardAndRefresh}
                description={copy.conflictServerDescription}
              />
              <StrategyOption
                value="MERGE"
                label={copy.semanticMerge}
                description={copy.conflictMergeDescription}
              />
            </RadioGroup>

            {failure ? (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                <Typography variant="subtitle2">{copy.conflictRecoveryFailed}</Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {failure.message}
                </Typography>
                {failure.serverRoutine ? (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2">{copy.conflictPartialTitle}</Typography>
                    <Typography variant="body2">{copy.conflictPartialDescription}</Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                      {copy.conflictCurrentServerState}: {failure.serverRoutine.routineId} ·{' '}
                      {copy.conflictRevision} {failure.serverRoutine.revision} ·{' '}
                      {copy.status[failure.serverRoutine.status]}
                    </Typography>
                  </Box>
                ) : null}
              </Alert>
            ) : null}

            <Stack gap={0.75} sx={{ mt: 1.5 }}>
              <ActionButton
                intent="primary"
                loading={busy}
                loadingLabel={copy.conflictResolving}
                disabled={!conflict.serverDraft || conflict.loading || conflict.loadError}
                startIcon={<ShieldCheck size={17} aria-hidden="true" />}
                onClick={() => onResolve(strategy, selections)}
                fullWidth
                sx={{ minHeight: 44 }}
              >
                {copy.conflictResolve}
              </ActionButton>
              <ActionButton
                intent="quiet"
                disabled={busy}
                onClick={onDismiss}
                fullWidth
                sx={{ minHeight: 44 }}
              >
                {copy.conflictCancel}
              </ActionButton>
            </Stack>
          </Box>
        </Box>
      ) : null}

      {receipt ? (
        <Box
          role="status"
          data-testid="dwaion-routine-conflict-receipt"
          sx={{
            border: 1,
            borderColor: 'success.main',
            borderRadius: 2,
            bgcolor: 'background.paper',
            p: { xs: 1.5, md: 2 },
          }}
        >
          <Stack direction="row" gap={1} alignItems="center">
            <ShieldCheck size={20} aria-hidden="true" />
            <Typography component="h2" variant="subtitle1">
              {copy.conflictReceiptTitle}
            </Typography>
            <Chip
              size="small"
              color="success"
              label={copy.conflictReceiptStrategies[receipt.strategy]}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {copy.conflictReceiptDescription}
          </Typography>
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1,
              m: 0,
              mt: 1.5,
            }}
          >
            <ReceiptField
              label={copy.conflictReceiptStrategy}
              value={copy.conflictReceiptStrategies[receipt.strategy]}
            />
            <ReceiptField label={copy.conflictReceiptRoutine} value={receipt.routineId} />
            <ReceiptField label={copy.conflictRevision} value={String(receipt.revision)} />
            <ReceiptField
              label={copy.conflictReceiptCreatedAt}
              value={formatTimestamp(receipt.createdAt)}
            />
            <ReceiptField label={copy.conflictReceiptCommand} value={receipt.commandId} />
            <ReceiptField
              label={copy.conflictReceiptFingerprint}
              value={receipt.integrityFingerprint}
            />
          </Box>
        </Box>
      ) : null}
    </Stack>
  );
}

function StrategyOption({
  value,
  label,
  description,
  badge,
}: {
  value: DwaionRoutineRecoveryStrategy;
  label: string;
  description: string;
  badge?: string;
}) {
  return (
    <FormControlLabel
      value={value}
      control={<Radio />}
      sx={{
        alignItems: 'flex-start',
        m: 0,
        mb: 0.75,
        p: 1,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        '& .MuiRadio-root': { pt: 0.25 },
      }}
      label={
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.5}>
            <Typography variant="subtitle2">{label}</Typography>
            {badge ? <Chip size="small" color="primary" label={badge} /> : null}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {description}
          </Typography>
        </Box>
      }
    />
  );
}

function RevisionCard({
  label,
  revision,
  draft,
  copy,
  accent,
}: {
  label: string;
  revision: number;
  draft: DwaionRoutineDraft;
  copy: DwaionRoutineCopy;
  accent: string;
}) {
  return (
    <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'action.hover', minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
        <Typography variant="subtitle2" sx={{ color: accent }}>
          {label}
        </Typography>
        <Chip size="small" label={`${copy.conflictRevision} ${revision}`} />
      </Stack>
      <Typography variant="body2" fontWeight={700} sx={{ mt: 0.75, overflowWrap: 'anywhere' }}>
        {draft.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
        {draft.triggerType} · {draft.sourceKeys.join(', ') || '—'}
      </Typography>
    </Box>
  );
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

function draftGroupSummary(
  key: DwaionRoutineChangeKey,
  draft: DwaionRoutineDraft,
  copy: DwaionRoutineCopy
): string {
  if (key === 'IDENTITY') return `${draft.title} · ${draft.description}`;
  if (key === 'TRIGGER') {
    return draft.triggerType === 'SCHEDULED'
      ? `${draft.triggerType} · ${draft.schedule.cadence} · ${draft.schedule.localTime} · ${draft.schedule.timeZone}`
      : `${draft.triggerType} · ${draft.webhookEventType} · ${draft.webhookEndpointReference || '—'}`;
  }
  if (key === 'SOURCES') {
    return draft.sourceKeys
      .map((source) => copy.sourceLabels[source as keyof typeof copy.sourceLabels] ?? source)
      .join(' · ');
  }
  if (key === 'DELIVERY_AND_CONSENT') {
    return draft.consentKeys.map((consent) => copy.consentLabels[consent]).join(' · ');
  }
  return `${draft.budget.maximumRunsPerMonth} runs/month · ${draft.budget.maximumTokensPerRun} tokens/run · ${draft.retryPolicy.maximumAttempts} retries`;
}
