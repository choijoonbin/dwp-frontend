import { useState } from 'react';
import { Activity, Download, FileClock, RotateCcw, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  ActionButton,
  ConfirmDialog,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';

import type {
  DwaionRoutineHealth,
  DwaionRoutineRollbackReceipt,
  DwaionRoutineVersionSnapshot,
} from '@dwp-frontend/shared-utils';
import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type { DwaionRoutine } from './dwaion-routine-model';

export function DwaionRoutineEvidencePanel({
  routine,
  versions,
  health,
  rollbackReceipt,
  loading,
  error,
  busy,
  canManage,
  copy,
  formatTimestamp,
  onRetry,
  onRollback,
  onDownloadTelemetry,
}: {
  routine: DwaionRoutine;
  versions: readonly DwaionRoutineVersionSnapshot[];
  health?: DwaionRoutineHealth;
  rollbackReceipt?: DwaionRoutineRollbackReceipt | null;
  loading: boolean;
  error: boolean;
  busy: boolean;
  canManage: boolean;
  copy: DwaionRoutineCopy;
  formatTimestamp: (value: string) => string;
  onRetry: () => void;
  onRollback: (version: DwaionRoutineVersionSnapshot) => void;
  onDownloadTelemetry: () => void;
}) {
  const [rollbackTarget, setRollbackTarget] = useState<DwaionRoutineVersionSnapshot | null>(null);

  return (
    <Box
      component="section"
      aria-labelledby="routine-server-evidence-title"
      sx={{ mt: 1.25, p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1.5 }}
    >
      <Stack direction="row" gap={0.75} alignItems="center">
        <ShieldCheck size={16} aria-hidden="true" />
        <Typography id="routine-server-evidence-title" component="h3" variant="subtitle2">
          {copy.serverEvidenceTitle}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
        {copy.serverEvidenceDescription}
      </Typography>

      {loading ? (
        <LoadingState embedded label={copy.evidenceLoading} variant="skeleton" skeletonRows={2} />
      ) : error ? (
        <InlineFeedback
          severity="warning"
          action={
            <ActionButton intent="quiet" onClick={onRetry}>
              {copy.retry}
            </ActionButton>
          }
          sx={{ mt: 1 }}
        >
          {copy.evidenceFailed}
        </InlineFeedback>
      ) : (
        <Stack gap={1.25} sx={{ mt: 1 }}>
          {health ? (
            <RoutineHealthEvidence health={health} copy={copy} formatTimestamp={formatTimestamp} />
          ) : null}
          <Box>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <FileClock size={16} aria-hidden="true" />
              <Typography variant="subtitle2">{copy.versionHistoryTitle}</Typography>
            </Stack>
            {versions.length ? (
              <Stack component="ol" gap={0.75} sx={{ p: 0, m: 0, mt: 0.75, listStyle: 'none' }}>
                {versions.slice(0, 6).map((version) => (
                  <Box
                    component="li"
                    key={`${version.commandId}:${version.revision}`}
                    sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      gap={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight="fontWeightBold">
                          {copy.revisionPrefix}
                          {version.revision} · {version.commandType}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ overflowWrap: 'anywhere' }}
                        >
                          {formatTimestamp(version.createdAt)} ·{' '}
                          {version.integrityFingerprint.slice(0, 12)}…
                        </Typography>
                      </Box>
                      {version.revision < routine.revision ? (
                        <ActionButton
                          intent="quiet"
                          startIcon={<RotateCcw size={15} aria-hidden="true" />}
                          disabled={!canManage || busy}
                          onClick={() => setRollbackTarget(version)}
                          sx={{ minHeight: 44, flexShrink: 0 }}
                        >
                          {copy.rollbackVersion}
                        </ActionButton>
                      ) : (
                        <Chip size="small" color="success" label={copy.current} />
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {copy.noVersionHistory}
              </Typography>
            )}
          </Box>

          {rollbackReceipt ? (
            <InlineFeedback severity="success">
              <Typography variant="body2" fontWeight="fontWeightBold">
                {copy.rollbackReceipt} · {copy.revisionPrefix}
                {rollbackReceipt.createdRevision}
              </Typography>
              <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                {rollbackReceipt.integrityFingerprint}
              </Typography>
            </InlineFeedback>
          ) : null}

          <ActionButton
            intent="secondary"
            fullWidth
            startIcon={<Download size={16} aria-hidden="true" />}
            disabled={busy}
            onClick={onDownloadTelemetry}
            sx={{ minHeight: 44 }}
          >
            {copy.jsonlDownload}
          </ActionButton>
        </Stack>
      )}

      <ConfirmDialog
        open={Boolean(rollbackTarget)}
        title={copy.rollbackTitle}
        description={copy.rollbackDescription}
        cancelLabel={copy.cancel}
        confirmLabel={copy.confirm}
        busy={busy}
        onClose={() => setRollbackTarget(null)}
        onConfirm={() => {
          if (!rollbackTarget) return;
          onRollback(rollbackTarget);
          setRollbackTarget(null);
        }}
      />
    </Box>
  );
}

function RoutineHealthEvidence({
  health,
  copy,
  formatTimestamp,
}: {
  health: DwaionRoutineHealth;
  copy: DwaionRoutineCopy;
  formatTimestamp: (value: string) => string;
}) {
  return (
    <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Activity size={16} aria-hidden="true" />
        <Typography variant="subtitle2">{copy.healthCheck}</Typography>
        <Chip
          size="small"
          color={
            health.state === 'HEALTHY'
              ? 'success'
              : health.state === 'DEGRADED'
                ? 'warning'
                : 'error'
          }
          label={copy.healthState[health.state]}
          sx={{ ml: 'auto' }}
        />
      </Stack>
      <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
        <Chip
          size="small"
          variant="outlined"
          label={`${copy.workerState}: ${health.workerAvailable ? copy.configured : copy.notConfigured}`}
        />
        <Chip
          size="small"
          variant="outlined"
          label={`${copy.scheduleState}: ${health.scheduleCurrent ? copy.current : copy.stale}`}
        />
        <Chip
          size="small"
          variant="outlined"
          label={`${copy.consentState}: ${health.allConsentsEnabled ? copy.current : copy.stale}`}
        />
      </Stack>
      {health.recoveryHints?.length ? (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.75 }}>
          {health.recoveryHints.join(' · ')}
        </Typography>
      ) : null}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {formatTimestamp(health.checkedAt)}
      </Typography>
    </Box>
  );
}
