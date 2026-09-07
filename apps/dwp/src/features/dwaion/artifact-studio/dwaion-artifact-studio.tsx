import { useState } from 'react';
import { FilePlus2, PanelLeftOpen, PanelRightOpen, RefreshCw } from 'lucide-react';

import Box from '@mui/material/Box';
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

  const rail = (
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
  );
  const evidenceRail = <DwaionArtifactEvidenceRail evidence={evidence} copy={copy} />;

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Stack gap={2.5}>
        <Stack
          component="header"
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'flex-start' }}
          justifyContent="space-between"
          gap={2}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="primary.main">
              {copy.eyebrow}
            </Typography>
            <Typography component="h1" variant="h4">
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
              {copy.description}
            </Typography>
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
                lg: '260px minmax(0, 1fr) 300px',
              },
              minWidth: 0,
              borderBlock: 1,
              borderColor: 'divider',
            }}
          >
            {!compact ? <Box sx={{ p: 2, minWidth: 0 }}>{rail}</Box> : null}
            <Box
              sx={{
                p: { xs: 0, sm: 2 },
                py: { xs: 2, sm: 2 },
                minWidth: 0,
                borderInline: { xs: 0, lg: 1 },
                borderColor: 'divider',
              }}
            >
              {document ? (
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
            {!compact ? <Box sx={{ p: 2, minWidth: 0 }}>{evidenceRail}</Box> : null}
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
            open={exportOpen}
            busy={exportBusy}
            onClose={() => setExportOpen(false)}
            onRequest={async (format) => {
              if (!preflight) return;
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
