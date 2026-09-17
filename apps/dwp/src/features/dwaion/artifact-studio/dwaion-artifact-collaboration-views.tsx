import { CheckCircle2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import type {
  DwaionTeamArtifactConflictResolution,
  DwaionTeamArtifactAccessRequest,
  DwaionTeamArtifactConflict,
  DwaionTeamArtifactPreflight,
  DwaionTeamArtifactReviewDecision,
  DwaionTeamArtifactReviewStage,
  DwaionTeamArtifactShare,
  DwaionTeamArtifactWorkspace,
} from '@dwp-frontend/shared-utils';

import { DWAION_ARTIFACT_COLLABORATION_COPY as COPY } from './dwaion-artifact-collaboration-copy';

export function PreflightResult({
  preflight,
  locale,
  onExclude,
  onRemoveDenied,
  accessRequest,
  accessRequestAvailable,
  busy,
  onRequestAccess,
}: {
  preflight: DwaionTeamArtifactPreflight;
  locale: 'ko' | 'en';
  onExclude: () => void;
  onRemoveDenied: () => void;
  accessRequest: DwaionTeamArtifactAccessRequest | null;
  accessRequestAvailable: boolean;
  busy: boolean;
  onRequestAccess: () => Promise<unknown>;
}) {
  const { t } = useTranslation('work');
  const text = COPY[locale];
  const denied = preflight.members.filter((member) => !member.allowed);
  return (
    <Alert severity={preflight.state === 'READY' ? 'success' : 'warning'}>
      <Typography variant="subtitle2">
        {text.preflightStates[preflight.state]} · {text.allowedSources}{' '}
        {preflight.allowedSourceCount} · {text.excludedSources} {preflight.excludedSourceCount}
      </Typography>
      {denied.map((member) => (
        <Typography key={member.subjectId} variant="body2">
          {member.subjectId} · {member.reasonCode}
        </Typography>
      ))}
      {preflight.state === 'PERMISSION_DENIED' ? (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.5} sx={{ mt: 1 }}>
            <ActionButton intent="quiet" onClick={onRemoveDenied} sx={{ minHeight: 44 }}>
              {text.removeDenied}
            </ActionButton>
            <ActionButton intent="quiet" onClick={onExclude} sx={{ minHeight: 44 }}>
              {text.excludeAndRetry}
            </ActionButton>
            <ActionButton
              intent="quiet"
              disabled={!accessRequestAvailable || busy || Boolean(accessRequest)}
              title={!accessRequestAvailable ? text.accessRequestUnavailable : undefined}
              onClick={() => void onRequestAccess().catch(() => undefined)}
              sx={{ minHeight: 44 }}
            >
              {text.requestAccess}
            </ActionButton>
          </Stack>
          {accessRequest ? (
            <Typography
              data-testid="artifact-access-request-evidence"
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', overflowWrap: 'anywhere' }}
            >
              {text.accessRequestSubmitted} · {accessRequest.state}{' '}
              {t('dwaionOperational.artifact.checksumSeparator')}{' '}
              {accessRequest.submissionEvidenceSha256}
            </Typography>
          ) : !accessRequestAvailable ? (
            <Typography variant="caption" color="text.secondary">
              {text.accessRequestUnavailable}
            </Typography>
          ) : null}
        </>
      ) : null}
    </Alert>
  );
}

export function WorkspaceSummary({
  workspace,
  locale,
}: {
  workspace: DwaionTeamArtifactWorkspace;
  locale: 'ko' | 'en';
}) {
  const { t } = useTranslation('work');
  const text = COPY[locale];
  return (
    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      <Box>
        <Stack direction="row" gap={0.75} alignItems="center">
          <CheckCircle2 size={16} color="green" aria-hidden="true" />
          <Typography variant="subtitle2">
            {text.workspaceActive} {t('dwaionOperational.artifact.revisionSeparator')}
            {workspace.revision}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {t('dwaionOperational.artifact.checksumPrefix')} {workspace.contentSha256}
        </Typography>
      </Box>
      <Box>
        <Typography variant="subtitle2">
          {text.authorizedMembers} · {workspace.members.filter((member) => member.allowed).length}
        </Typography>
        <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
          {workspace.members.map((member) => (
            <Chip
              key={member.subjectId}
              size="small"
              color={member.allowed ? 'default' : 'error'}
              label={`${member.subjectId} · ${member.role}`}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

export function GovernanceReview({
  workspace,
  currentSubjectId,
  busy,
  locale,
  onDecide,
}: {
  workspace: DwaionTeamArtifactWorkspace;
  currentSubjectId: string | null;
  busy: boolean;
  locale: 'ko' | 'en';
  onDecide: (input: {
    stage: DwaionTeamArtifactReviewStage;
    decision: DwaionTeamArtifactReviewDecision;
  }) => Promise<unknown>;
}) {
  const text = COPY[locale];
  const assignedPending = workspace.reviewStages.some(
    (stage) => stage.state === 'PENDING' && stage.assigneeSubjectId === currentSubjectId
  );
  return (
    <Stack gap={1.5} data-testid="artifact-governance-review">
      <Box>
        <Typography variant="subtitle2">{text.reviewWorkflowTitle}</Typography>
        <Typography variant="caption" color="text.secondary">
          {text.reviewWorkflowHelp}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {text.reviewSla}:{' '}
          {workspace.reviewSlaDueAt
            ? formatDate(
                workspace.reviewSlaDueAt,
                { dateStyle: 'medium', timeStyle: 'short' },
                locale
              )
            : text.reviewSlaUnavailable}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        {workspace.reviewStages.map((stage) => {
          const mine = stage.state === 'PENDING' && stage.assigneeSubjectId === currentSubjectId;
          return (
            <Box
              key={stage.stageId}
              sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1.5, minWidth: 0 }}
            >
              <Stack direction="row" justifyContent="space-between" gap={0.5}>
                <Typography variant="subtitle2">{text.reviewStages[stage.stageKey]}</Typography>
                <Chip
                  size="small"
                  color={
                    stage.state === 'APPROVED'
                      ? 'success'
                      : stage.state === 'REJECTED'
                        ? 'error'
                        : 'default'
                  }
                  label={text.reviewStates[stage.state]}
                />
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {`${stage.assigneeSubjectId ?? '—'} · r${stage.revision}`}
              </Typography>
              {stage.evidenceFingerprint ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', overflowWrap: 'anywhere' }}
                >
                  {text.evidenceFingerprint}: {stage.evidenceFingerprint}
                </Typography>
              ) : null}
              {mine ? (
                <Stack direction="row" gap={0.5} sx={{ mt: 1 }}>
                  <ActionButton
                    intent="primary"
                    disabled={busy}
                    onClick={() =>
                      void onDecide({ stage, decision: 'APPROVE' }).catch(() => undefined)
                    }
                    sx={{ minHeight: 44 }}
                  >
                    {text.approveReview}
                  </ActionButton>
                  <ActionButton
                    intent="danger"
                    disabled={busy}
                    onClick={() =>
                      void onDecide({ stage, decision: 'REJECT' }).catch(() => undefined)
                    }
                    sx={{ minHeight: 44 }}
                  >
                    {text.rejectReview}
                  </ActionButton>
                </Stack>
              ) : null}
            </Box>
          );
        })}
      </Box>
      {!assignedPending ? (
        <Typography variant="caption" color="text.secondary">
          {text.reviewDecisionUnavailable}
        </Typography>
      ) : null}
      <Box>
        <Typography variant="subtitle2">{text.governanceTitle}</Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 0.75,
            mt: 0.75,
          }}
        >
          {workspace.governanceGates.map((gate) => (
            <Box key={gate.key} sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between" gap={0.5}>
                <Typography variant="body2" fontWeight={700}>
                  {text.governanceGates[gate.key]}
                </Typography>
                <Chip
                  size="small"
                  color={
                    gate.state === 'PASS'
                      ? 'success'
                      : gate.state === 'BLOCKED'
                        ? 'error'
                        : 'warning'
                  }
                  label={text.governanceStates[gate.state]}
                />
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', overflowWrap: 'anywhere' }}
              >
                {gate.detailCode}
                {gate.evidenceReference ? ` · ${gate.evidenceReference}` : ''}
              </Typography>
              {gate.evidenceFingerprint ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', overflowWrap: 'anywhere' }}
                >
                  {gate.evidenceFingerprint}
                </Typography>
              ) : null}
            </Box>
          ))}
        </Box>
      </Box>
      <Alert
        severity={workspace.signatureEvidence.capability.available ? 'success' : 'info'}
        sx={{
          minWidth: 0,
          '& .MuiAlert-message': {
            minWidth: 0,
            overflow: 'visible',
            overflowWrap: 'anywhere',
          },
        }}
      >
        <Typography variant="subtitle2">{text.wormEvidenceTitle}</Typography>
        {workspace.signatureEvidence.capability.available ? (
          <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
            {workspace.signatureEvidence.provider} ·{' '}
            {workspace.signatureEvidence.keyReferenceFingerprint} ·{' '}
            {workspace.signatureEvidence.signedAt}
          </Typography>
        ) : (
          <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
            {workspace.signatureEvidence.capability.reasonCode} ·{' '}
            {workspace.signatureEvidence.capability.recoveryHint ?? text.wormEvidenceUnavailable}
          </Typography>
        )}
      </Alert>
    </Stack>
  );
}

export function ConflictActions({
  conflict,
  busy,
  enabled,
  locale,
  onResolve,
  onRefresh,
}: {
  conflict: DwaionTeamArtifactConflict;
  busy: boolean;
  enabled: boolean;
  locale: 'ko' | 'en';
  onResolve: (resolution: DwaionTeamArtifactConflictResolution) => Promise<unknown>;
  onRefresh: () => void;
}) {
  const text = COPY[locale];
  const actions: DwaionTeamArtifactConflictResolution[] = [
    'USE_LOCAL',
    'USE_SERVER',
    'MERGE',
    'STASH',
    'ROLLBACK',
  ];
  return (
    <Alert severity="warning">
      <Typography variant="subtitle2">{text.conflictTitle}</Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 1,
          mt: 1,
        }}
      >
        <ConflictVersion
          label={text.localVersion}
          title={conflict.localContent.title}
          body={conflict.localContent.body}
          sha256={conflict.localSha256}
        />
        <ConflictVersion
          label={`${text.serverVersion} · r${conflict.serverRevision}`}
          title={conflict.serverContent.title}
          body={conflict.serverContent.body}
          sha256={conflict.serverSha256}
        />
      </Box>
      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
        {actions.map((action) => (
          <ActionButton
            key={action}
            intent={action === 'MERGE' ? 'primary' : 'quiet'}
            disabled={!enabled || busy}
            onClick={() => void onResolve(action).catch(() => undefined)}
            sx={{ minHeight: 44 }}
          >
            {text.conflicts[action]}
          </ActionButton>
        ))}
        <ActionButton
          intent="quiet"
          startIcon={<RefreshCw size={15} aria-hidden="true" />}
          disabled={busy}
          onClick={onRefresh}
          sx={{ minHeight: 44 }}
        >
          {text.loadLatest}
        </ActionButton>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {text.readOnlyFallback}
      </Typography>
    </Alert>
  );
}

function ConflictVersion({
  label,
  title,
  body,
  sha256,
}: {
  label: string;
  title: string;
  body: string;
  sha256: string;
}) {
  const { t } = useTranslation('work');
  return (
    <Box sx={{ p: 1, bgcolor: 'background.paper', borderRadius: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
        {title}
      </Typography>
      <Typography
        variant="body2"
        sx={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto', overflowWrap: 'anywhere' }}
      >
        {body}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
        {t('dwaionOperational.artifact.checksumPrefix')} {sha256}
      </Typography>
    </Box>
  );
}

export function ShareRow({
  share,
  busy,
  canRevoke,
  locale,
  onRevoke,
}: {
  share: DwaionTeamArtifactShare;
  busy: boolean;
  canRevoke: boolean;
  locale: 'ko' | 'en';
  onRevoke: (shareId: string) => Promise<unknown>;
}) {
  const text = COPY[locale];
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ sm: 'center' }}
      gap={0.5}
      sx={{ p: 1, borderRadius: 1, bgcolor: 'action.hover' }}
    >
      <Typography variant="body2">
        {text.permissions[share.permission]} · {share.memberCount} · {share.state} ·{' '}
        {formatDate(share.expiresAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
      </Typography>
      {share.state === 'ACTIVE' ? (
        <ActionButton
          intent="danger"
          disabled={!canRevoke || busy}
          onClick={() => void onRevoke(share.shareId).catch(() => undefined)}
          sx={{ minHeight: 44 }}
        >
          {text.revoke}
        </ActionButton>
      ) : null}
    </Stack>
  );
}
