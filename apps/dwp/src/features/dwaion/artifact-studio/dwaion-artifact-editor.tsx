import { Download, Files, FileSearch2, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton, FormField, InlineFeedback } from '@dwp-frontend/design-system';

import { DWAION_ARTIFACT_COPY_KO } from './dwaion-artifact-copy';
import { artifactExportCapability, artifactPublishCapability } from './dwaion-artifact-model';

import type { DwaionArtifactCopy } from './dwaion-artifact-copy';
import type {
  DwaionArtifactDocument,
  DwaionArtifactExportEvidence,
  DwaionDlpPreflight,
} from './dwaion-artifact-model';

export function DwaionArtifactEditor({
  artifact,
  preflight,
  exportReceipt,
  canEdit,
  canPublish,
  canExport,
  preflightBusy = false,
  publishBusy = false,
  exportBusy = false,
  onDraftChange,
  onOpenVersions,
  onRunPreflight,
  onPublish,
  onExport,
  copy = DWAION_ARTIFACT_COPY_KO,
  formatTimestamp = (value) => value,
}: {
  artifact: DwaionArtifactDocument;
  preflight: DwaionDlpPreflight | null;
  exportReceipt?: DwaionArtifactExportEvidence | null;
  canEdit: boolean;
  canPublish: boolean;
  canExport: boolean;
  preflightBusy?: boolean;
  publishBusy?: boolean;
  exportBusy?: boolean;
  onDraftChange: (
    artifactId: string,
    expectedRevision: number,
    content: { title: string; body: string }
  ) => void;
  onOpenVersions: () => void;
  onRunPreflight: (artifact: DwaionArtifactDocument) => void;
  onPublish: (artifact: DwaionArtifactDocument, preflight: DwaionDlpPreflight) => void;
  onExport: (artifact: DwaionArtifactDocument, preflight: DwaionDlpPreflight) => void;
  copy?: DwaionArtifactCopy;
  formatTimestamp?: (value: string) => string;
}) {
  const publish = artifactPublishCapability({
    artifact,
    preflight,
    permitted: canPublish,
  });
  const exportState = artifactExportCapability({
    artifact,
    preflight,
    permitted: canExport,
  });
  const saved = ['IDLE', 'SAVED'].includes(artifact.autosaveState);

  return (
    <Box component="section" aria-labelledby="dwaion-artifact-editor-heading" sx={{ minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'flex-start' }}
        justifyContent="space-between"
        gap={2}
        sx={{ pb: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            id="dwaion-artifact-editor-heading"
            component="h2"
            variant="h5"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {artifact.title}
          </Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center" sx={{ mt: 0.75 }}>
            <Chip
              size="small"
              variant="outlined"
              label={copy.artifactTypes[artifact.artifactType]}
            />
            <Chip
              size="small"
              variant="outlined"
              color={artifact.state === 'PUBLISHED' ? 'success' : 'default'}
              label={copy.artifactStates[artifact.state]}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${copy.revisionPrefix}${artifact.revision}`}
            />
            <Chip
              size="small"
              color={
                artifact.autosaveState === 'FAILED' || artifact.autosaveState === 'CONFLICT'
                  ? 'warning'
                  : 'default'
              }
              label={copy.autosave[artifact.autosaveState]}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {copy.updatedAt}
            {copy.labelSeparator} {formatTimestamp(artifact.lastSavedAt ?? artifact.updatedAt)}{' '}
            {copy.separator} {copy.currentVersion}
            {copy.labelSeparator} {copy.versionPrefix}
            {artifact.currentVersionNumber || 0}
          </Typography>
        </Box>
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          <ActionButton
            intent="quiet"
            startIcon={<Files size={16} aria-hidden="true" />}
            onClick={onOpenVersions}
            sx={{ minHeight: 44 }}
          >
            {copy.versions}
          </ActionButton>
          <ActionButton
            intent="secondary"
            startIcon={<FileSearch2 size={16} aria-hidden="true" />}
            loading={preflightBusy}
            loadingLabel={copy.preflightRunning}
            disabled={
              !canEdit ||
              !saved ||
              !artifact.capabilities.immutableVersionsAvailable ||
              !artifact.capabilities.deterministicPreflightAvailable
            }
            onClick={() => onRunPreflight(artifact)}
            sx={{ minHeight: 44 }}
          >
            {copy.preflightRun}
          </ActionButton>
          <ActionButton
            intent="secondary"
            startIcon={<ShieldCheck size={16} aria-hidden="true" />}
            loading={publishBusy}
            loadingLabel={copy.publishing}
            disabled={!publish.allowed}
            onClick={() => {
              if (preflight && publish.allowed) onPublish(artifact, preflight);
            }}
            sx={{ minHeight: 44 }}
          >
            {copy.publish}
          </ActionButton>
          <ActionButton
            intent="primary"
            startIcon={<Download size={16} aria-hidden="true" />}
            loading={exportBusy}
            loadingLabel={copy.exportRequesting}
            disabled={!exportState.allowed}
            onClick={() => {
              if (preflight && exportState.allowed) onExport(artifact, preflight);
            }}
            sx={{ minHeight: 44 }}
          >
            {copy.exportRequest}
          </ActionButton>
        </Stack>
      </Stack>

      <InlineFeedback severity="info" sx={{ mt: 1.5 }}>
        <Typography variant="body2">{copy.publishHelp}</Typography>
        <Typography variant="caption" color="text.secondary">
          {copy.recipientSharingUnavailable} {copy.exportHelp}
        </Typography>
      </InlineFeedback>

      {!publish.allowed && artifact.state !== 'PUBLISHED' ? (
        <Typography
          role="status"
          variant="caption"
          color="warning.main"
          sx={{ display: 'block', py: 1 }}
        >
          {copy.releaseBlocked[publish.reason]}
        </Typography>
      ) : null}
      {artifact.autosaveState === 'CONFLICT' ? (
        <Typography role="alert" variant="body2" color="error.main" sx={{ py: 1 }}>
          {copy.conflictHelp}
        </Typography>
      ) : null}
      {preflight ? (
        <Box
          sx={{
            mt: 1,
            p: 1.5,
            borderBlock: 1,
            borderColor: preflight.outcome === 'PASS' ? 'success.main' : 'warning.main',
          }}
        >
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Typography variant="subtitle2">{copy.preflight}</Typography>
            <Chip
              size="small"
              variant="outlined"
              color={preflight.outcome === 'PASS' ? 'success' : 'warning'}
              label={copy.preflightStates[preflight.outcome]}
            />
            <Typography variant="caption" color="text.secondary">
              {formatTimestamp(preflight.evaluatedAt)} {copy.separator} {copy.versionPrefix}
              {preflight.versionNumber}
            </Typography>
          </Stack>
          {preflight.findings.length ? (
            <Box component="ul" sx={{ my: 0.75, pl: 2.5 }}>
              {preflight.findings.map((finding) => (
                <Typography
                  component="li"
                  variant="caption"
                  color="warning.main"
                  key={`${finding.code}:${finding.field}`}
                >
                  {finding.code} ({finding.field})
                </Typography>
              ))}
            </Box>
          ) : null}
        </Box>
      ) : null}
      {exportReceipt ? (
        <InlineFeedback severity="success" sx={{ mt: 1.25 }}>
          <Typography variant="body2" fontWeight="fontWeightBold">
            {copy.exportReceipt}
          </Typography>
          <Typography variant="caption">
            {copy.exportReceiptDetail.replace(
              '{{format}}',
              copy.exportFormats[exportReceipt.exportFormat]
            )}{' '}
            {copy.separator} {exportReceipt.exportJobId}
          </Typography>
        </InlineFeedback>
      ) : null}

      <Stack gap={1.5} sx={{ mt: 1.5 }}>
        <FormField
          label={copy.editorTitle}
          value={artifact.title}
          required
          disabled={!canEdit}
          onChange={(event) =>
            onDraftChange(artifact.artifactId, artifact.revision, {
              title: event.target.value,
              body: artifact.body,
            })
          }
        />
        <FormField
          label={copy.editorLabel}
          value={artifact.body}
          multiline
          minRows={18}
          fullWidth
          required
          disabled={!canEdit}
          onChange={(event) =>
            onDraftChange(artifact.artifactId, artifact.revision, {
              title: artifact.title,
              body: event.target.value,
            })
          }
        />
      </Stack>
    </Box>
  );
}
