import { useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  DatabaseZap,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import { DwaionDataClearDialog } from './dwaion-data-clear-dialog';
import { DwaionMemoryControls } from './dwaion-memory-controls';
import {
  deletionCompletionVerified,
  governanceBoundaryState,
} from './dwaion-personal-controls-model';

import { DWAION_PERSONAL_CONTROLS_COPY_KO } from './dwaion-personal-controls-copy';
import { DwaionSourceControls } from './dwaion-source-controls';

import type { DwaionPersonalControlsCopy } from './dwaion-personal-controls-copy';
import type {
  DwaionClearEvidence,
  DwaionClearScope,
  DwaionMemoryDraft,
  DwaionMemoryPreference,
  DwaionMemoryRecord,
  DwaionMemoryState,
  DwaionPersonalControlsViewState,
  DwaionRetentionBoundary,
  DwaionSourcePreference,
} from './dwaion-personal-controls-model';

export function DwaionPersonalAiControls({
  state,
  memoryPreference,
  sourcePreferences,
  memories,
  retention,
  availableClearScopes,
  partialError,
  commandError,
  deletionStatusError,
  busySourceKeys,
  memoryBusy = false,
  clearing = false,
  clearEvidence = [],
  canManage = true,
  canViewMemory = true,
  canViewPrivacy = true,
  canManagePrivacy = false,
  deletionExecutionAvailable = false,
  deletionCompletionClaimAvailable = false,
  auditMetadataMayBeRetained = true,
  onRetry,
  onMemoryPreferenceChange,
  onRuntimePreferenceChange,
  onSourcePreferenceChange,
  onSaveMemory,
  onMemoryStateChange,
  onDeleteMemory,
  onClear,
  copy = DWAION_PERSONAL_CONTROLS_COPY_KO,
  formatTimestamp,
}: {
  state: DwaionPersonalControlsViewState;
  memoryPreference: DwaionMemoryPreference | null;
  sourcePreferences: readonly DwaionSourcePreference[];
  memories: readonly DwaionMemoryRecord[];
  retention: readonly DwaionRetentionBoundary[];
  availableClearScopes: readonly DwaionClearScope[];
  partialError?: string;
  commandError?: 'REVISION_CONFLICT' | 'COMMAND_FAILED';
  deletionStatusError?: string;
  busySourceKeys?: readonly string[];
  memoryBusy?: boolean;
  clearing?: boolean;
  clearEvidence?: readonly DwaionClearEvidence[];
  canManage?: boolean;
  canViewMemory?: boolean;
  canViewPrivacy?: boolean;
  canManagePrivacy?: boolean;
  deletionExecutionAvailable?: boolean;
  deletionCompletionClaimAvailable?: boolean;
  auditMetadataMayBeRetained?: boolean;
  onRetry: () => void;
  onMemoryPreferenceChange: (expectedRevision: number, enabled: boolean) => void;
  onRuntimePreferenceChange: (expectedRevision: number, enabled: boolean) => void;
  onSourcePreferenceChange: (sourceKey: string, expectedRevision: number, enabled: boolean) => void;
  onSaveMemory: (
    memoryId: string | null,
    expectedRevision: number | null,
    draft: DwaionMemoryDraft
  ) => void | Promise<void>;
  onMemoryStateChange: (
    memoryId: string,
    expectedRevision: number,
    state: Exclude<DwaionMemoryState, 'DELETED'>
  ) => void | Promise<void>;
  onDeleteMemory: (memoryId: string, expectedRevision: number) => void | Promise<void>;
  onClear: (scopes: readonly DwaionClearScope[]) => void | Promise<void>;
  copy?: DwaionPersonalControlsCopy;
  formatTimestamp?: (value: string) => string;
}) {
  const [clearOpen, setClearOpen] = useState(false);

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Stack gap={2.25}>
        <Stack
          component="header"
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'flex-start' }}
          justifyContent="space-between"
          gap={2}
          sx={{
            p: { xs: 2, md: 2.5 },
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
            <Typography component="h1" variant="h4">
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
              {copy.description}
            </Typography>
            {state === 'ready' ? (
              <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
                <Chip
                  size="small"
                  color={partialError ? 'warning' : 'success'}
                  variant="outlined"
                  label={partialError ? copy.partialPolicy : copy.livePolicy}
                />
                {canViewMemory ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${copy.savedMemoryCount} · ${memories.length}`}
                  />
                ) : null}
                <Chip
                  size="small"
                  color={deletionExecutionAvailable ? 'info' : 'warning'}
                  variant="outlined"
                  label={
                    deletionExecutionAvailable
                      ? copy.executionRunning
                      : copy.deletionUnavailableBadge
                  }
                />
              </Stack>
            ) : null}
          </Box>
          <ActionButton
            intent="secondary"
            startIcon={<RefreshCw size={16} aria-hidden="true" />}
            onClick={onRetry}
            sx={{ minHeight: 44, flexShrink: 0 }}
          >
            {copy.revalidate}
          </ActionButton>
        </Stack>

        {state === 'ready' ? (
          <Box
            component="nav"
            aria-label={copy.tabsLabel}
            sx={{
              display: 'flex',
              gap: 0.5,
              overflowX: 'auto',
              p: 0.75,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
            }}
          >
            {[
              ['sources', copy.tabs.sources],
              ['memories', copy.tabs.memories],
              ['cleanup', copy.tabs.cleanup],
              ['compliance', copy.tabs.compliance],
            ].map(([target, label], index) => (
              <ButtonBase
                key={target}
                component="a"
                href={`#dwaion-controls-${target}`}
                sx={{
                  minHeight: 36,
                  flexShrink: 0,
                  px: 1.25,
                  borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.25 + 'px',
                  bgcolor: index === 0 ? 'var(--dwp-product-soft)' : 'transparent',
                  color: index === 0 ? 'primary.main' : 'text.secondary',
                  fontSize: 'body2.fontSize',
                  fontWeight: 'fontWeightBold',
                }}
              >
                {index + 1}. {label}
              </ButtonBase>
            ))}
            <Chip
              size="small"
              color={partialError ? 'warning' : 'success'}
              variant="outlined"
              label={partialError ? copy.partialPolicy : copy.livePolicy}
              sx={{ ml: 'auto', alignSelf: 'center', flexShrink: 0 }}
            />
          </Box>
        ) : null}

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
              startIcon={<RefreshCw size={16} />}
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
          <LoadingState label={copy.loading} variant="skeleton" skeletonRows={5} />
        ) : state === 'error' ? (
          <ErrorState title={copy.errorTitle} retryLabel={copy.retry} onRetry={onRetry} />
        ) : state === 'permission-denied' ? (
          <GuidedEmptyState
            kind="permission"
            title={copy.permissionTitle}
            description={copy.permissionDescription}
          />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 320px' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Stack gap={2}>
              {canViewMemory ? (
                <>
                  <Box
                    id="dwaion-controls-sources"
                    sx={{
                      p: { xs: 2, md: 2.5 },
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
                    }}
                  >
                    {sourcePreferences.length ? (
                      <DwaionSourceControls
                        preferences={sourcePreferences}
                        busySourceKeys={busySourceKeys}
                        canManage={canManage}
                        onChange={onSourcePreferenceChange}
                        copy={copy}
                      />
                    ) : (
                      <GuidedEmptyState
                        kind="empty"
                        title={copy.emptyTitle}
                        description={copy.emptyDescription}
                        size="compact"
                        announce={false}
                      />
                    )}
                  </Box>
                  {memoryPreference ? (
                    <Box id="dwaion-controls-memories">
                      <MemoryPreferenceCard
                        preference={memoryPreference}
                        busy={memoryBusy}
                        canManage={canManage}
                        onChange={onMemoryPreferenceChange}
                        onRuntimeChange={onRuntimePreferenceChange}
                        copy={copy}
                      />
                    </Box>
                  ) : null}
                  <Box
                    sx={{
                      p: { xs: 2, md: 2.5 },
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
                    }}
                  >
                    <DwaionMemoryControls
                      memories={memories}
                      busy={memoryBusy}
                      canManage={canManage}
                      memoryEnabled={Boolean(memoryPreference?.enabled)}
                      onSave={onSaveMemory}
                      onStateChange={onMemoryStateChange}
                      onDelete={onDeleteMemory}
                      copy={copy}
                      formatTimestamp={formatTimestamp}
                    />
                  </Box>
                </>
              ) : null}
              <Box id="dwaion-controls-cleanup">
                <DataCleanupPanel
                  available={availableClearScopes.length > 0}
                  canManage={canManage || canManagePrivacy}
                  executionAvailable={deletionExecutionAvailable}
                  completionClaimAvailable={deletionCompletionClaimAvailable}
                  evidence={clearEvidence}
                  onOpen={() => setClearOpen(true)}
                  copy={copy}
                  formatTimestamp={formatTimestamp}
                />
              </Box>
            </Stack>
            <Stack id="dwaion-controls-compliance" gap={2}>
              {memoryPreference ? (
                <GovernanceEvidencePanel preference={memoryPreference} copy={copy} />
              ) : null}
              {canViewPrivacy ? (
                <RetentionBoundaryPanel
                  retention={retention}
                  auditMetadataMayBeRetained={auditMetadataMayBeRetained}
                  copy={copy}
                />
              ) : null}
            </Stack>
          </Box>
        )}
      </Stack>

      <DwaionDataClearDialog
        statusError={deletionStatusError}
        onStatusRetry={onRetry}
        open={clearOpen}
        busy={clearing}
        availableScopes={availableClearScopes}
        evidence={clearEvidence}
        onClose={() => setClearOpen(false)}
        onClear={onClear}
        copy={copy}
        formatTimestamp={formatTimestamp}
      />
    </PageCanvas>
  );
}

function MemoryPreferenceCard({
  preference,
  busy,
  canManage,
  onChange,
  onRuntimeChange,
  copy,
}: {
  preference: DwaionMemoryPreference;
  busy: boolean;
  canManage: boolean;
  onChange: (expectedRevision: number, enabled: boolean) => void;
  onRuntimeChange: (expectedRevision: number, enabled: boolean) => void;
  copy: DwaionPersonalControlsCopy;
}) {
  return (
    <Box
      component="section"
      aria-labelledby="dwaion-memory-preference-title"
      sx={{
        p: { xs: 2, sm: 2.5 },
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" justifyContent="space-between" gap={2} alignItems="flex-start">
        <Stack direction="row" gap={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'var(--dwp-product-soft)',
              color: 'primary.main',
            }}
          >
            <BrainCircuit size={19} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
              <Typography id="dwaion-memory-preference-title" component="h2" variant="h6">
                {copy.memoryPreferenceTitle}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color={preference.effective ? 'success' : 'default'}
                label={preference.effective ? copy.memoryEffective : copy.memoryNotEffective}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, maxWidth: 760 }}>
              {copy.memoryPreferenceDescription}
            </Typography>
          </Box>
        </Stack>
      </Stack>
      <Divider sx={{ my: 2 }} />
      <Stack gap={1.75}>
        <PreferenceSwitchRow
          title={copy.memoryStorageTitle}
          description={copy.memoryStorageDescription}
          stateLabel={copy.memoryPreferenceStates[preference.state]}
          checked={preference.enabled}
          disabled={!canManage || busy || !preference.storageAvailable}
          onChange={(enabled) => onChange(preference.revision, enabled)}
        />
        <PreferenceSwitchRow
          title={copy.runtimePreferenceTitle}
          description={copy.runtimePreferenceDescription}
          stateLabel={copy.memoryPreferenceStates[preference.runtimeState]}
          checked={preference.runtimeEnabled}
          disabled={
            !canManage || busy || !preference.runtimeApplicationAvailable || !preference.enabled
          }
          onChange={(enabled) => onRuntimeChange(preference.revision, enabled)}
        />
      </Stack>
      {!preference.enabled ? (
        <InlineFeedback severity="info" sx={{ mt: 1.5 }}>
          {copy.runtimeRequiresStorage}
        </InlineFeedback>
      ) : null}
      {!preference.runtimeApplicationAvailable ? (
        <InlineFeedback severity="info" sx={{ mt: 1.5 }}>
          {copy.runtimeUnavailable}
        </InlineFeedback>
      ) : null}
    </Box>
  );
}

function PreferenceSwitchRow({
  title,
  description,
  stateLabel,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  stateLabel: string;
  checked: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ sm: 'center' }}
      gap={1.25}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
          <Typography variant="subtitle2">{title}</Typography>
          <Chip size="small" variant="outlined" label={stateLabel} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, maxWidth: 760 }}>
          {description}
        </Typography>
      </Box>
      <Switch
        checked={checked}
        disabled={disabled}
        slotProps={{ input: { 'aria-label': `${title}: ${stateLabel}` } }}
        onChange={(_, enabled) => onChange(enabled)}
        sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
      />
    </Stack>
  );
}

function GovernanceEvidencePanel({
  preference,
  copy,
}: {
  preference: DwaionMemoryPreference;
  copy: DwaionPersonalControlsCopy;
}) {
  const facts = [
    [copy.governanceFacts.inference, preference.automaticMemoryInference],
    [copy.governanceFacts.sensitive, preference.sensitiveMemoryAllowed],
    [copy.governanceFacts.credential, preference.backgroundCredentialStorage],
    [copy.governanceFacts.team, preference.teamMemoryAvailable],
    [copy.governanceFacts.external, preference.externalActionWithoutApproval],
  ] as const;
  return (
    <Box
      component="section"
      aria-labelledby="dwaion-governance-evidence-title"
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
      }}
    >
      <Stack direction="row" gap={1} alignItems="flex-start">
        <LockKeyhole size={19} aria-hidden="true" />
        <Box>
          <Typography id="dwaion-governance-evidence-title" component="h2" variant="h6">
            {copy.governanceTitle}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {copy.governanceDescription}
          </Typography>
        </Box>
      </Stack>
      <Stack component="dl" sx={{ m: 0, mt: 1.25 }} gap={0.5}>
        {facts.map(([label, allowed]) => (
          <Stack
            key={label}
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap={1}
            sx={{
              minHeight: 38,
              px: 1,
              bgcolor: 'action.hover',
              borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
            }}
          >
            <Typography component="dt" variant="caption">
              {label}
            </Typography>
            <Chip
              component="dd"
              size="small"
              variant="outlined"
              color={governanceBoundaryState(allowed) === 'BLOCKED' ? 'success' : 'warning'}
              icon={
                governanceBoundaryState(allowed) === 'BLOCKED' ? (
                  <CheckCircle2 size={13} />
                ) : undefined
              }
              label={
                governanceBoundaryState(allowed) === 'UNKNOWN'
                  ? copy.boundaryUnknown
                  : allowed
                    ? copy.allowed
                    : copy.blocked
              }
              sx={{ m: 0 }}
            />
          </Stack>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
        {copy.auditUnavailable}
      </Typography>
    </Box>
  );
}

function DataCleanupPanel({
  available,
  canManage,
  executionAvailable,
  completionClaimAvailable,
  evidence,
  onOpen,
  copy,
  formatTimestamp = (value) => value,
}: {
  available: boolean;
  canManage: boolean;
  executionAvailable: boolean;
  completionClaimAvailable: boolean;
  evidence: readonly DwaionClearEvidence[];
  onOpen: () => void;
  copy: DwaionPersonalControlsCopy;
  formatTimestamp?: (value: string) => string;
}) {
  const latest = [...evidence].reverse()[0];
  return (
    <Box
      component="section"
      aria-labelledby="dwaion-cleanup-title"
      sx={{
        p: { xs: 2, md: 2.5 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Stack direction="row" gap={1.25} alignItems="flex-start">
          <Box
            aria-hidden="true"
            sx={{
              width: 40,
              height: 40,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'var(--dwp-semantic-critical-soft)',
              color: 'error.main',
              borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
            }}
          >
            <DatabaseZap size={19} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography id="dwaion-cleanup-title" component="h2" variant="h6">
              {copy.cleanupTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {copy.cleanupDescription}
            </Typography>
          </Box>
        </Stack>
        <ActionButton
          intent="danger"
          startIcon={<Trash2 size={16} />}
          disabled={!available || !canManage}
          onClick={onOpen}
          sx={{ minHeight: 44, flexShrink: 0 }}
        >
          {copy.clearAction}
        </ActionButton>
      </Stack>
      <InlineFeedback severity="warning" sx={{ mt: 1.5 }}>
        {copy.cleanupBoundary}
      </InlineFeedback>
      <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.25 }}>
        <Chip
          size="small"
          variant="outlined"
          color={executionAvailable ? 'info' : 'warning'}
          label={executionAvailable ? copy.executionRunning : copy.executionUnavailable}
        />
        <Chip
          size="small"
          variant="outlined"
          color={completionClaimAvailable ? 'success' : 'warning'}
          label={
            completionClaimAvailable
              ? copy.completionVerificationAvailable
              : copy.completionUnverified
          }
        />
      </Stack>
      {latest ? (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            mt: 1.5,
            p: 1.25,
            bgcolor: 'action.hover',
            borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
          }}
        >
          <Typography variant="subtitle2">
            {latest.kind === 'PROPOSAL_CLEAR'
              ? `${copy.proposalHidden}: ${latest.hiddenCount}`
              : `${copy.deletionRequested} · ${
                  latest.state === 'COMPLETED' && !deletionCompletionVerified(latest)
                    ? copy.completionUnverified
                    : copy.requestState[latest.state]
                }`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTimestamp(
              latest.kind === 'PROPOSAL_CLEAR' ? latest.completedAt : latest.requestedAt
            )}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

function RetentionBoundaryPanel({
  retention,
  auditMetadataMayBeRetained,
  copy,
}: {
  retention: readonly DwaionRetentionBoundary[];
  auditMetadataMayBeRetained: boolean;
  copy: DwaionPersonalControlsCopy;
}) {
  return (
    <Box
      component="section"
      aria-labelledby="dwaion-retention-title"
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
      }}
    >
      <Stack direction="row" gap={1} alignItems="center">
        <ShieldCheck size={19} aria-hidden="true" />
        <Typography id="dwaion-retention-title" component="h2" variant="h6">
          {copy.retentionTitle}
        </Typography>
      </Stack>
      {retention.length ? (
        <Box component="dl" sx={{ m: 0, mt: 1, borderBlock: 1, borderColor: 'divider' }}>
          {retention.map((item) => (
            <Stack
              key={item.domain}
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              gap={0.75}
              sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}
            >
              <Typography component="dt" variant="body2" fontWeight="fontWeightBold">
                {copy.clearScopes[item.domain]}
              </Typography>
              <Stack component="dd" direction="row" gap={0.75} sx={{ m: 0 }} flexWrap="wrap">
                <Typography variant="caption" color="text.secondary">
                  {copy.retentionDays
                    .replace('{{days}}', String(item.retentionDays))
                    .replace('{{grace}}', String(item.deletionGraceDays))}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  color={item.legalHold ? 'warning' : 'default'}
                  label={item.legalHold ? copy.legalHold : copy.noLegalHold}
                />
              </Stack>
            </Stack>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {copy.privacyUnavailable}
        </Typography>
      )}
      <InlineFeedback severity="info" sx={{ mt: 1.5 }}>
        {auditMetadataMayBeRetained ? copy.cleanupBoundary : copy.auditUnavailable}
      </InlineFeedback>
    </Box>
  );
}
