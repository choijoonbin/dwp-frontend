import { useRef, useState } from 'react';
import {
  Bold,
  BookmarkPlus,
  CircleHelp,
  Download,
  Files,
  FileSearch2,
  Heading1,
  Heading2,
  List,
  ListChecks,
  ShieldCheck,
  Table2,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton, FormField, InlineFeedback } from '@dwp-frontend/design-system';

import { DwaionArtifactExportStatus } from './dwaion-artifact-export-status';
import { DWAION_ARTIFACT_COPY_KO } from './dwaion-artifact-copy';
import {
  applyDwaionArtifactEditorCommand,
  type DwaionArtifactEditorCommand,
} from './dwaion-artifact-editor-command';
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
  const sourceReferences = artifact.sources.map(
    (source) => `${source.sourceType} ${copy.separator} ${source.reference}`
  );
  const bodyInput = useRef<HTMLTextAreaElement | null>(null);
  const [citationAnchor, setCitationAnchor] = useState<HTMLElement | null>(null);
  const applyEditorCommand = (
    command: DwaionArtifactEditorCommand,
    source?: DwaionArtifactDocument['sources'][number]
  ) => {
    if (!canEdit) return;
    const input = bodyInput.current;
    const result = applyDwaionArtifactEditorCommand(
      artifact.body,
      input?.selectionStart ?? artifact.body.length,
      input?.selectionEnd ?? artifact.body.length,
      command,
      source
    );
    onDraftChange(artifact.artifactId, artifact.revision, {
      title: artifact.title,
      body: result.value,
    });
    globalThis.requestAnimationFrame(() => {
      bodyInput.current?.focus();
      bodyInput.current?.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

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
              if (
                preflight &&
                artifactPublishCapability({
                  artifact,
                  preflight,
                  permitted: canPublish,
                }).allowed
              )
                onPublish(artifact, preflight);
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

      <Box component="section" aria-labelledby="dwaion-artifact-structure-title" sx={{ mt: 1.5 }}>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <ListChecks size={17} aria-hidden="true" />
          <Typography id="dwaion-artifact-structure-title" component="h3" variant="subtitle2">
            {copy.structureTitle}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {copy.structureUnavailable}
        </Typography>
        <Box
          sx={{
            mt: 1,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.35fr) minmax(210px, 0.8fr)' },
            gap: 1,
          }}
        >
          <StructureCard
            title={copy.verifiedFacts}
            value={
              artifact.capabilities.sourceVerificationAvailable
                ? copy.evidenceMapped.replace('{{count}}', String(artifact.sources.length))
                : copy.evidenceUnverified.replace('{{count}}', String(artifact.sources.length))
            }
            tone={artifact.capabilities.sourceVerificationAvailable ? 'success' : 'warning'}
            items={sourceReferences}
            prominent
          />
          <StructureCard title={copy.openRisks} value={copy.riskUnmodeled} tone="warning" />
          <StructureCard title={copy.actionPlan} value={copy.actionUnmodeled} tone="neutral" />
        </Box>
      </Box>

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
        <DwaionArtifactExportStatus
          key={exportReceipt.exportJobId}
          artifactId={artifact.artifactId}
          receipt={exportReceipt}
          permitted={canExport}
          copy={copy}
          onRetry={() => {
            if (preflight && exportState.allowed) onExport(artifact, preflight);
          }}
        />
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
        <Box
          role="toolbar"
          aria-label={copy.editorToolbarLabel}
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 0.5,
            p: 0.75,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1.5,
            bgcolor: 'background.default',
          }}
        >
          {(
            [
              ['HEADING_ONE', copy.formatHeadingOne, <Heading1 key="h1" size={17} />],
              ['HEADING_TWO', copy.formatHeadingTwo, <Heading2 key="h2" size={17} />],
              ['BOLD', copy.formatBold, <Bold key="bold" size={17} />],
              ['BULLET_LIST', copy.formatList, <List key="list" size={17} />],
              ['TABLE', copy.formatTable, <Table2 key="table" size={17} />],
            ] as const
          ).map(([command, label, icon]) => (
            <ActionButton
              key={command}
              intent="quiet"
              size="small"
              aria-label={label}
              title={label}
              disabled={!canEdit}
              onClick={() => applyEditorCommand(command)}
              sx={{ minWidth: 44, minHeight: 44, px: 1 }}
            >
              {icon}
              <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' }, ml: 0.5 }}>
                {label}
              </Box>
            </ActionButton>
          ))}
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<BookmarkPlus size={17} aria-hidden="true" />}
            disabled={!canEdit || artifact.sources.length === 0}
            title={artifact.sources.length === 0 ? copy.citationUnavailable : copy.insertCitation}
            onClick={(event) => setCitationAnchor(event.currentTarget)}
            sx={{ minHeight: 44 }}
          >
            {copy.insertCitation}
          </ActionButton>
          <Menu
            anchorEl={citationAnchor}
            open={Boolean(citationAnchor)}
            onClose={() => setCitationAnchor(null)}
          >
            {artifact.sources.map((source) => (
              <MenuItem
                key={`${source.sourceType}:${source.reference}`}
                onClick={() => {
                  setCitationAnchor(null);
                  applyEditorCommand('CITATION', source);
                }}
                sx={{ minHeight: 44, maxWidth: { xs: 300, sm: 480 }, overflowWrap: 'anywhere' }}
              >
                {source.sourceType} {copy.separator} {source.reference}
              </MenuItem>
            ))}
          </Menu>
        </Box>
        <FormField
          label={copy.editorLabel}
          value={artifact.body}
          multiline
          minRows={8}
          fullWidth
          required
          disabled={!canEdit}
          inputRef={bodyInput}
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

function StructureCard({
  title,
  value,
  tone,
  items = [],
  prominent = false,
}: {
  title: string;
  value: string;
  tone: 'success' | 'warning' | 'neutral';
  items?: readonly string[];
  prominent?: boolean;
}) {
  return (
    <Box
      sx={{
        minHeight: prominent ? 172 : 82,
        p: 1.25,
        gridRow: prominent ? { md: 'span 2' } : undefined,
        bgcolor:
          tone === 'warning' ? 'var(--dwp-semantic-warning-soft)' : 'var(--dwp-product-soft)',
        border: 1,
        borderColor: tone === 'warning' ? 'warning.light' : 'divider',
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
      }}
    >
      <Stack direction="row" gap={0.5} alignItems="center">
        {tone === 'warning' ? (
          <CircleHelp size={15} aria-hidden="true" />
        ) : (
          <ShieldCheck size={15} aria-hidden="true" />
        )}
        <Typography variant="subtitle2">{title}</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {value}
      </Typography>
      {items.length ? (
        <Stack component="ul" gap={0.65} sx={{ p: 0, m: 0, mt: 1.25, listStyle: 'none' }}>
          {items.map((item, index) => (
            <Stack
              component="li"
              key={`${item}:${index}`}
              direction="row"
              alignItems="flex-start"
              gap={0.75}
              sx={{
                p: 0.8,
                bgcolor: 'background.paper',
                borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
              }}
            >
              <FileSearch2 size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                {item}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}
