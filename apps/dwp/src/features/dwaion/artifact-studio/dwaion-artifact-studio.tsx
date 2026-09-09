import { useEffect, useState } from 'react';
import { FilePlus2, PanelLeftOpen, PanelRightOpen, RefreshCw, Users } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  ActionButton,
  DetailInspector,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import { DWAION_ARTIFACT_COPY_KO } from './dwaion-artifact-copy';
import { DwaionArtifactConversationRail } from './dwaion-artifact-conversation-rail';
import { DwaionArtifactCreateDialog } from './dwaion-artifact-create-dialog';
import { DwaionArtifactEditor } from './dwaion-artifact-editor';
import {
  DwaionArtifactExportDialog,
  type DwaionArtifactExportFormat,
} from './dwaion-artifact-export-dialog';
import { DwaionArtifactEvidenceRail } from './dwaion-artifact-evidence-rail';
import { DwaionArtifactVersionDialog } from './dwaion-artifact-version-dialog';
import { artifactExportCapability } from './dwaion-artifact-model';

import type { DwaionArtifactCopy } from './dwaion-artifact-copy';
import type {
  DwaionArtifactDocument,
  DwaionArtifactEvidence,
  DwaionArtifactExportEvidence,
  DwaionArtifactSummary,
  DwaionArtifactType,
  DwaionArtifactVersion,
  DwaionArtifactViewState,
  DwaionDlpPreflight,
} from './dwaion-artifact-model';

export function DwaionArtifactStudio({
  state,
  selectionAccessDenied = false,
  selectionMissing = false,
  artifacts,
  document,
  evidence,
  versions,
  preflight,
  exportReceipt,
  partialError,
  commandError,
  canCreate,
  canEdit,
  canPublish,
  canExport,
  createBusy = false,
  preflightBusy = false,
  publishBusy = false,
  exportBusy = false,
  onRetry,
  onCreate,
  onSelect,
  onDraftChange,
  onLoadVersion,
  onRunPreflight,
  onPublish,
  onExport,
  copy = DWAION_ARTIFACT_COPY_KO,
  formatTimestamp,
}: {
  state: DwaionArtifactViewState;
  selectionAccessDenied?: boolean;
  selectionMissing?: boolean;
  artifacts: readonly DwaionArtifactSummary[];
  document: DwaionArtifactDocument | null;
  evidence: readonly DwaionArtifactEvidence[];
  versions: readonly DwaionArtifactVersion[];
  preflight: DwaionDlpPreflight | null;
  exportReceipt?: DwaionArtifactExportEvidence | null;
  partialError?: string;
  commandError?: 'REVISION_CONFLICT' | 'COMMAND_FAILED';
  canCreate: boolean;
  canEdit: boolean;
  canPublish: boolean;
  canExport: boolean;
  createBusy?: boolean;
  preflightBusy?: boolean;
  publishBusy?: boolean;
  exportBusy?: boolean;
  onRetry: () => void;
  onCreate: (input: {
    artifactType: DwaionArtifactType;
    title: string;
    body: string;
  }) => Promise<void>;
  onSelect: (artifactId: string) => void;
  onDraftChange: (
    artifactId: string,
    expectedRevision: number,
    content: { title: string; body: string }
  ) => void;
  onLoadVersion: (versionNumber: number) => Promise<DwaionArtifactVersion>;
  onRunPreflight: (artifact: DwaionArtifactDocument) => void;
  onPublish: (artifact: DwaionArtifactDocument, preflight: DwaionDlpPreflight) => void;
  onExport: (
    artifact: DwaionArtifactDocument,
    preflight: DwaionDlpPreflight,
    format: DwaionArtifactExportFormat
  ) => Promise<void>;
  copy?: DwaionArtifactCopy;
  formatTimestamp?: (value: string) => string;
}) {
  const compact = useMediaQuery('(max-width:1199.95px)', { noSsr: true });
  const [artifactRailOpen, setArtifactRailOpen] = useState(false);
  const [evidenceRailOpen, setEvidenceRailOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [, refreshExpiry] = useState(Date.now);
  const expiresAt = preflight?.expiresAt;
  useEffect(() => {
    let timer: number | undefined;
    const refresh = () => {
      refreshExpiry(Date.now());
      const delay = Date.parse(expiresAt ?? '') - Date.now();
      if (delay > 0) timer = window.setTimeout(refresh, Math.min(delay + 1, 2_147_483_647));
    };
    refresh();
    return () => window.clearTimeout(timer);
  }, [expiresAt]);
  const exportAllowed = Boolean(
    document &&
    artifactExportCapability({
      artifact: document,
      preflight,
      permitted: canExport,
    }).allowed
  );

  const rail = (
    <Stack gap={2}>
      <Box
        sx={{
          p: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" gap={0.75} alignItems="center">
          <Users size={17} aria-hidden="true" />
          <Typography variant="subtitle2">{copy.collaborationTitle}</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {document?.capabilities.collaborativeEditingAvailable
            ? copy.collaborationAvailable
            : copy.collaborationUnavailable}
        </Typography>
      </Box>
      <Box
        sx={{
          p: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
          bgcolor: 'background.paper',
        }}
      >
        <DwaionArtifactConversationRail
          artifacts={artifacts}
          selectedId={document?.artifactId}
          canCreate={canCreate}
          onCreate={() => setCreateOpen(true)}
          onSelect={(artifact) => {
            onSelect(artifact.artifactId);
            setArtifactRailOpen(false);
          }}
          copy={copy}
          formatTimestamp={formatTimestamp}
        />
      </Box>
    </Stack>
  );
  const evidenceRail = (
    <DwaionArtifactEvidenceRail
      evidence={evidence}
      preflight={preflight}
      capabilities={document?.capabilities ?? null}
      copy={copy}
      formatTimestamp={formatTimestamp}
    />
  );

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Stack gap={2}>
        <Stack
          component="header"
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'flex-start' }}
          justifyContent="space-between"
          gap={2}
          sx={{
            p: { xs: 1.75, md: 2 },
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="primary.main">
              {copy.eyebrow}
            </Typography>
            <Typography component="h1" variant="h5">
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
              {copy.description}
            </Typography>
            {document ? (
              <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={`${copy.versionPrefix}${document.currentVersionNumber || 0}`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${copy.contractLabel} · ${copy.autosave[document.autosaveState]}`}
                />
                <Chip
                  size="small"
                  color={preflight?.outcome === 'PASS' ? 'success' : 'default'}
                  variant="outlined"
                  label={
                    preflight
                      ? `${copy.dlpGate} · ${copy.preflightStates[preflight.outcome]}`
                      : copy.dlpNotRun
                  }
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${copy.sources} · ${evidence.length}`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${copy.versions} · ${versions.length}`}
                />
              </Stack>
            ) : null}
          </Box>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {compact ? (
              <>
                <ActionButton
                  intent="quiet"
                  startIcon={<PanelLeftOpen size={17} aria-hidden="true" />}
                  onClick={() => setArtifactRailOpen(true)}
                  sx={{ minHeight: 44 }}
                >
                  {copy.openArtifacts}
                </ActionButton>
                <ActionButton
                  intent="quiet"
                  startIcon={<PanelRightOpen size={17} aria-hidden="true" />}
                  onClick={() => setEvidenceRailOpen(true)}
                  sx={{ minHeight: 44 }}
                >
                  {copy.openEvidence}
                </ActionButton>
              </>
            ) : null}
            <ActionButton
              intent="primary"
              startIcon={<FilePlus2 size={17} aria-hidden="true" />}
              disabled={!canCreate}
              onClick={() => setCreateOpen(true)}
              sx={{ minHeight: 44 }}
            >
              {copy.create}
            </ActionButton>
          </Stack>
        </Stack>

        {partialError ? (
          <Stack
            role="status"
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            gap={1}
            sx={{ borderBlock: 1, borderColor: 'warning.main', py: 1.25 }}
          >
            <Typography variant="body2">{partialError || copy.partial}</Typography>
            <ActionButton
              intent="quiet"
              startIcon={<RefreshCw size={16} aria-hidden="true" />}
              onClick={onRetry}
              sx={{ minHeight: 44 }}
            >
              {copy.retry}
            </ActionButton>
          </Stack>
        ) : null}
        {commandError ? (
          <Typography role="alert" color="error.main" variant="body2">
            {commandError === 'REVISION_CONFLICT' ? copy.revisionConflict : copy.commandFailed}
          </Typography>
        ) : null}

        {state === 'loading' ? (
          <LoadingState label={copy.loading} variant="skeleton" skeletonHeights={[64, 360, 80]} />
        ) : state === 'error' ? (
          <ErrorState title={copy.errorTitle} retryLabel={copy.retry} onRetry={onRetry} />
        ) : state === 'permission-denied' ? (
          <GuidedEmptyState
            kind="permission"
            title={copy.permissionTitle}
            description={copy.permissionDescription}
          />
        ) : artifacts.length === 0 ? (
          <GuidedEmptyState
            kind="first-use"
            title={copy.emptyTitle}
            description={copy.emptyDescription}
            actionLabel={canCreate ? copy.create : undefined}
            onAction={canCreate ? () => setCreateOpen(true) : undefined}
          />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: '250px minmax(0, 1fr) 300px',
              },
              minWidth: 0,
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            {!compact ? <Box sx={{ minWidth: 0, position: 'sticky', top: 16 }}>{rail}</Box> : null}
            <Box
              sx={{
                p: { xs: 1.5, sm: 1.75 },
                minWidth: 0,
                border: 1,
                borderColor: 'divider',
                borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
                bgcolor: 'background.paper',
              }}
            >
              {selectionAccessDenied ? (
                <GuidedEmptyState
                  kind="permission"
                  title={selectionMissing ? copy.selectionUnavailableTitle : copy.permissionTitle}
                  description={
                    selectionMissing
                      ? copy.selectionUnavailableDescription
                      : copy.permissionDescription
                  }
                />
              ) : document ? (
                <DwaionArtifactEditor
                  artifact={document}
                  preflight={preflight}
                  exportReceipt={exportReceipt}
                  canEdit={canEdit}
                  canPublish={canPublish}
                  canExport={canExport}
                  preflightBusy={preflightBusy}
                  publishBusy={publishBusy}
                  exportBusy={exportBusy}
                  onDraftChange={onDraftChange}
                  onOpenVersions={() => setVersionsOpen(true)}
                  onRunPreflight={onRunPreflight}
                  onPublish={onPublish}
                  onExport={() => setExportOpen(true)}
                  copy={copy}
                  formatTimestamp={formatTimestamp}
                />
              ) : (
                <GuidedEmptyState
                  kind="empty"
                  title={copy.artifacts}
                  description={copy.emptyDescription}
                  announce={false}
                />
              )}
            </Box>
            {!compact ? (
              <Box sx={{ minWidth: 0, position: 'sticky', top: 16 }}>{evidenceRail}</Box>
            ) : null}
          </Box>
        )}
      </Stack>

      {compact ? (
        <>
          <DetailInspector
            open={artifactRailOpen}
            variant="drawer"
            title={copy.artifacts}
            closeLabel={copy.close}
            onClose={() => setArtifactRailOpen(false)}
            width={420}
          >
            {rail}
          </DetailInspector>
          <DetailInspector
            open={evidenceRailOpen}
            variant="drawer"
            title={copy.sources}
            closeLabel={copy.close}
            onClose={() => setEvidenceRailOpen(false)}
            width={420}
          >
            {evidenceRail}
          </DetailInspector>
        </>
      ) : null}

      <DwaionArtifactCreateDialog
        open={createOpen}
        busy={createBusy}
        onClose={() => setCreateOpen(false)}
        onCreate={async (input) => {
          await onCreate(input);
          setCreateOpen(false);
        }}
        copy={copy}
      />
      {document ? (
        <>
          <DwaionArtifactVersionDialog
            key={document.artifactId}
            open={versionsOpen}
            versions={versions}
            onLoadVersion={onLoadVersion}
            onClose={() => setVersionsOpen(false)}
            copy={copy}
            formatTimestamp={formatTimestamp}
          />
          <DwaionArtifactExportDialog
            open={exportOpen && exportAllowed}
            busy={exportBusy}
            onClose={() => setExportOpen(false)}
            onRequest={async (format) => {
              if (
                !preflight ||
                !artifactExportCapability({
                  artifact: document,
                  preflight,
                  permitted: canExport,
                }).allowed
              )
                return;
              await onExport(document, preflight, format);
              setExportOpen(false);
            }}
            copy={copy}
          />
        </>
      ) : null}
    </PageCanvas>
  );
}
