import { useState } from 'react';
import { BrainCircuit, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';

import Box from '@mui/material/Box';
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
  busySourceKeys,
  memoryBusy = false,
  clearing = false,
  clearEvidence = [],
  canManage = true,
  canViewMemory = true,
  canManagePrivacy = false,
  onRetry,
  onMemoryPreferenceChange,
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
  busySourceKeys?: readonly string[];
  memoryBusy?: boolean;
  clearing?: boolean;
  clearEvidence?: readonly DwaionClearEvidence[];
  canManage?: boolean;
  canViewMemory?: boolean;
  canManagePrivacy?: boolean;
  onRetry: () => void;
  onMemoryPreferenceChange: (expectedRevision: number, enabled: boolean) => void;
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
    <PageCanvas mode="focus">
      <Stack gap={3}>
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
          <ActionButton
            intent="quiet"
            startIcon={<Trash2 size={17} aria-hidden="true" />}
            disabled={!availableClearScopes.length || (!canManage && !canManagePrivacy)}
            onClick={() => setClearOpen(true)}
            sx={{ minHeight: 44 }}
          >
            {copy.clearAction}
          </ActionButton>
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
          <Stack gap={3}>
            {canViewMemory ? (
              <>
                {memoryPreference ? (
                  <MemoryPreferenceCard
                    preference={memoryPreference}
                    busy={memoryBusy}
                    canManage={canManage}
                    onChange={onMemoryPreferenceChange}
                    copy={copy}
                  />
                ) : null}
                <Divider />
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
                <Divider />
                <DwaionMemoryControls
                  memories={memories}
                  busy={memoryBusy}
                  canManage={canManage}
                  memoryEnabled={Boolean(memoryPreference?.effective)}
                  onSave={onSaveMemory}
                  onStateChange={onMemoryStateChange}
                  onDelete={onDeleteMemory}
                  copy={copy}
                  formatTimestamp={formatTimestamp}
                />
                <Divider />
              </>
            ) : null}
            <RetentionBoundaryPanel retention={retention} copy={copy} />
          </Stack>
        )}
      </Stack>

      <DwaionDataClearDialog
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
  copy,
}: {
  preference: DwaionMemoryPreference;
  busy: boolean;
  canManage: boolean;
  onChange: (expectedRevision: number, enabled: boolean) => void;
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
        <Switch
          checked={preference.enabled}
          disabled={!canManage || busy || !preference.storageAvailable}
          slotProps={{
            input: {
              'aria-label': `${copy.memoryPreferenceTitle}: ${copy.memoryPreferenceStates[preference.state]}`,
            },
          }}
          onChange={(_, enabled) => onChange(preference.revision, enabled)}
        />
      </Stack>
      {!preference.runtimeApplicationAvailable ? (
        <InlineFeedback severity="info" sx={{ mt: 1.5 }}>
          {copy.runtimeUnavailable}
        </InlineFeedback>
      ) : null}
    </Box>
  );
}

function RetentionBoundaryPanel({
  retention,
  copy,
}: {
  retention: readonly DwaionRetentionBoundary[];
  copy: DwaionPersonalControlsCopy;
}) {
  return (
    <Box component="section" aria-labelledby="dwaion-retention-title">
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
    </Box>
  );
}
