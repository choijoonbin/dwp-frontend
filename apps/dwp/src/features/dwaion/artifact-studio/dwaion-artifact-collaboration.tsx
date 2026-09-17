import { useMemo, useState } from 'react';
import { AlertCircle, ShieldCheck, Users } from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { ActionButton, LoadingState } from '@dwp-frontend/design-system';
import type {
  DwaionTeamArtifactCapabilities,
  DwaionTeamArtifactAccessRequest,
  DwaionTeamArtifactConflictResolution,
  DwaionTeamArtifactMemberRequest,
  DwaionTeamArtifactPreflight,
  DwaionTeamArtifactReviewDecision,
  DwaionTeamArtifactReviewStage,
  DwaionTeamArtifactShare,
  DwaionTeamArtifactSharePermission,
  DwaionTeamArtifactWorkspace,
  DwaionTeamArtifactRemediationAction,
  DwaionTeamArtifactRemediationReceipt,
} from '@dwp-frontend/shared-utils';

import type { DwaionArtifactDocument } from './dwaion-artifact-model';
import { DWAION_ARTIFACT_COLLABORATION_COPY as COPY } from './dwaion-artifact-collaboration-copy';
import { DwaionArtifactCollaborationRecovery } from './dwaion-artifact-collaboration-recovery';
import {
  ConflictActions,
  GovernanceReview,
  PreflightResult,
  ShareRow,
  WorkspaceSummary,
} from './dwaion-artifact-collaboration-views';

type CollaborationProps = {
  document: DwaionArtifactDocument;
  capabilities: DwaionTeamArtifactCapabilities | null;
  workspace: DwaionTeamArtifactWorkspace | null;
  preflight: DwaionTeamArtifactPreflight | null;
  latestShare: DwaionTeamArtifactShare | null;
  accessRequest: DwaionTeamArtifactAccessRequest | null;
  remediationReceipt: DwaionTeamArtifactRemediationReceipt | null;
  loading: boolean;
  busy: boolean;
  error: unknown;
  canEdit: boolean;
  canPublish: boolean;
  currentSubjectId: string | null;
  locale: 'ko' | 'en';
  onRetry: () => void;
  onRunPreflight: (input: {
    teamId: string;
    members: DwaionTeamArtifactMemberRequest[];
    excludeInaccessibleSources: boolean;
  }) => Promise<unknown>;
  onCreateWorkspace: (input: { teamId: string }) => Promise<unknown>;
  onUpdateMembers: () => Promise<unknown>;
  onSyncEdit: () => Promise<unknown>;
  onResolveConflict: (resolution: DwaionTeamArtifactConflictResolution) => Promise<unknown>;
  onCreateShare: (input: {
    permission: DwaionTeamArtifactSharePermission;
    expiresAt: string;
  }) => Promise<unknown>;
  onRevokeShare: (shareId: string) => Promise<unknown>;
  onRequestAccess: () => Promise<unknown>;
  onDecideReviewStage: (input: {
    stage: DwaionTeamArtifactReviewStage;
    decision: DwaionTeamArtifactReviewDecision;
  }) => Promise<unknown>;
  onSaveExplanation: (explanation: string) => Promise<unknown>;
  onSavePrivateDraft: () => Promise<unknown>;
  onResubmit: (input: {
    teamId: string;
    members: DwaionTeamArtifactMemberRequest[];
    excludeInaccessibleSources: boolean;
    permission: DwaionTeamArtifactSharePermission;
    expiresAt: string;
  }) => Promise<unknown>;
  onRemediate: (action: DwaionTeamArtifactRemediationAction) => Promise<unknown>;
};

export function DwaionArtifactCollaboration(props: CollaborationProps) {
  const { locale, capabilities, workspace, preflight } = props;
  const text = COPY[locale];
  const [teamId, setTeamId] = useState('');
  const [memberLines, setMemberLines] = useState('');
  const [excludeInaccessibleSources, setExcludeInaccessibleSources] = useState(false);
  const [permission, setPermission] = useState<DwaionTeamArtifactSharePermission>('COMMENT');
  const [expiry, setExpiry] = useState(() => tomorrowLocal());
  const memberParse = useMemo(() => parseMembers(memberLines), [memberLines]);
  const available = capabilities?.providerState === 'AVAILABLE';
  const canPreflight = Boolean(
    available &&
    capabilities?.aclPreflightAvailable &&
    props.canEdit &&
    UUID.test(teamId) &&
    memberParse.members.length > 0 &&
    !memberParse.error
  );
  const preflightUsable = Boolean(
    preflight &&
    ['READY', 'PARTIAL'].includes(preflight.state) &&
    Date.parse(preflight.expiresAt) > Date.now()
  );

  if (props.loading) return <LoadingState label={text.loading} variant="skeleton" />;

  return (
    <Box
      component="section"
      aria-labelledby="artifact-collaboration-title"
      data-testid="dwaion-artifact-collaboration"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        p: { xs: 1.5, md: 2 },
      }}
    >
      <Stack gap={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          gap={1}
        >
          <Box>
            <Stack direction="row" gap={0.75} alignItems="center">
              <Users size={18} aria-hidden="true" />
              <Typography id="artifact-collaboration-title" variant="subtitle1" fontWeight={700}>
                {text.title}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {text.description}
            </Typography>
          </Box>
          <Chip
            size="small"
            color={available ? 'success' : 'warning'}
            icon={
              available ? (
                <ShieldCheck size={14} aria-hidden="true" />
              ) : (
                <AlertCircle size={14} aria-hidden="true" />
              )
            }
            label={available ? text.available : text.unavailable}
          />
        </Stack>

        {!available ? (
          <Alert
            severity="warning"
            action={
              <ActionButton intent="quiet" onClick={props.onRetry} sx={{ minHeight: 44 }}>
                {text.retry}
              </ActionButton>
            }
          >
            {capabilities?.recoveryHint ?? text.providerRecovery}
          </Alert>
        ) : null}
        {props.error ? (
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={props.onRetry} sx={{ minHeight: 44 }}>
                {text.retry}
              </ActionButton>
            }
          >
            {text.error}
          </Alert>
        ) : null}

        {!workspace ? (
          <Stack gap={1.25}>
            <Typography variant="subtitle2">{text.preflightTitle}</Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, .8fr) minmax(0, 1.2fr)' },
                gap: 1,
              }}
            >
              <TextField
                label={text.teamId}
                value={teamId}
                onChange={(event) => setTeamId(event.target.value.trim())}
                error={teamId.length > 0 && !UUID.test(teamId)}
                helperText={teamId.length > 0 && !UUID.test(teamId) ? text.invalidTeam : ' '}
                disabled={!available || props.busy}
                size="small"
              />
              <TextField
                id="team-members"
                label={text.members}
                value={memberLines}
                onChange={(event) => setMemberLines(event.target.value)}
                placeholder={text.membersPlaceholder}
                helperText={memberParse.error ?? text.membersHelp}
                error={Boolean(memberParse.error)}
                disabled={!available || props.busy}
                multiline
                minRows={2}
                size="small"
              />
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={excludeInaccessibleSources}
                  onChange={(_, checked) => setExcludeInaccessibleSources(checked)}
                  disabled={!available || props.busy}
                />
              }
              label={text.excludeSources}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <ActionButton
                intent="secondary"
                disabled={!canPreflight || props.busy}
                onClick={() =>
                  void props
                    .onRunPreflight({
                      teamId,
                      members: memberParse.members,
                      excludeInaccessibleSources,
                    })
                    .catch(() => undefined)
                }
                sx={{ minHeight: 44 }}
              >
                {text.runPreflight}
              </ActionButton>
              <ActionButton
                intent="primary"
                disabled={!preflightUsable || !props.canPublish || props.busy}
                onClick={() =>
                  void props
                    .onCreateWorkspace({ teamId: preflight?.teamId ?? teamId })
                    .catch(() => undefined)
                }
                sx={{ minHeight: 44 }}
              >
                {text.createWorkspace}
              </ActionButton>
            </Stack>
            {preflight ? (
              <PreflightResult
                preflight={preflight}
                locale={locale}
                accessRequest={props.accessRequest}
                accessRequestAvailable={Boolean(capabilities?.accessRequestAvailable)}
                busy={props.busy}
                onRequestAccess={props.onRequestAccess}
                onExclude={() => setExcludeInaccessibleSources(true)}
                onRemoveDenied={() => {
                  const denied = new Set(
                    preflight.members
                      .filter((member) => !member.allowed)
                      .map((member) => member.subjectId)
                  );
                  setMemberLines((current) =>
                    current
                      .split('\n')
                      .filter((line) => !denied.has(line.split(',')[0]?.trim() ?? ''))
                      .join('\n')
                  );
                  document.querySelector<HTMLInputElement>('#team-members')?.focus();
                }}
              />
            ) : null}
          </Stack>
        ) : (
          <Stack gap={2}>
            <WorkspaceSummary workspace={workspace} locale={locale} />
            <GovernanceReview
              workspace={workspace}
              currentSubjectId={props.currentSubjectId}
              busy={props.busy}
              locale={locale}
              onDecide={props.onDecideReviewStage}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <ActionButton
                intent="secondary"
                disabled={!props.canEdit || props.busy || workspace.state !== 'ACTIVE'}
                onClick={() => void props.onSyncEdit().catch(() => undefined)}
                sx={{ minHeight: 44 }}
              >
                {text.syncDocument}
              </ActionButton>
              <ActionButton
                intent="quiet"
                disabled={!preflightUsable || !props.canPublish || props.busy}
                onClick={() => void props.onUpdateMembers().catch(() => undefined)}
                sx={{ minHeight: 44 }}
              >
                {text.applyMembers}
              </ActionButton>
            </Stack>
            {workspace.openConflict ? (
              <ConflictActions
                conflict={workspace.openConflict}
                busy={props.busy}
                enabled={Boolean(capabilities?.conflictResolutionAvailable && props.canEdit)}
                locale={locale}
                onResolve={props.onResolveConflict}
                onRefresh={props.onRetry}
              />
            ) : null}
            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {text.shareTitle}
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} gap={1} alignItems={{ md: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="artifact-share-permission">{text.permission}</InputLabel>
                  <Select
                    labelId="artifact-share-permission"
                    label={text.permission}
                    value={permission}
                    onChange={(event) =>
                      setPermission(event.target.value as DwaionTeamArtifactSharePermission)
                    }
                    disabled={props.busy}
                  >
                    <MenuItem value="VIEW">{text.permissions.VIEW}</MenuItem>
                    <MenuItem value="COMMENT">{text.permissions.COMMENT}</MenuItem>
                    <MenuItem value="EDIT">{text.permissions.EDIT}</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  type="datetime-local"
                  label={text.expiry}
                  value={expiry}
                  onChange={(event) => setExpiry(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  size="small"
                  disabled={props.busy}
                />
                <ActionButton
                  intent="primary"
                  disabled={
                    !preflightUsable ||
                    !capabilities?.internalSharingAvailable ||
                    !props.canPublish ||
                    props.busy ||
                    Date.parse(expiry) <= Date.now()
                  }
                  onClick={() =>
                    void props
                      .onCreateShare({
                        permission,
                        expiresAt: new Date(expiry).toISOString(),
                      })
                      .catch(() => undefined)
                  }
                  sx={{ minHeight: 44 }}
                >
                  {text.createShare}
                </ActionButton>
              </Stack>
              <Stack gap={0.75} sx={{ mt: 1.25 }}>
                {workspace.shares.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {text.noShares}
                  </Typography>
                ) : (
                  workspace.shares.map((share) => (
                    <ShareRow
                      key={share.shareId}
                      share={share}
                      busy={props.busy}
                      canRevoke={Boolean(
                        props.canPublish && capabilities?.shareRevocationAvailable
                      )}
                      locale={locale}
                      onRevoke={props.onRevokeShare}
                    />
                  ))
                )}
              </Stack>
              {props.latestShare ? (
                <Typography
                  data-testid="artifact-share-receipt"
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}
                >
                  {props.latestShare.state === 'REVOKED'
                    ? text.revocationReceipt
                    : text.shareReceipt}
                  {': '}
                  {props.latestShare.revocationReceiptSha256 ?? props.latestShare.receiptSha256}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        )}

        <DwaionArtifactCollaborationRecovery
          capabilities={capabilities}
          locale={locale}
          canEdit={props.canEdit}
          canResubmit={Boolean(canPreflight && props.canPublish && Date.parse(expiry) > Date.now())}
          busy={props.busy}
          receipt={props.remediationReceipt}
          canNotifyReview={Boolean(
            workspace?.reviewStages.some((stage) => stage.state === 'PENDING')
          )}
          onSaveExplanation={props.onSaveExplanation}
          onSavePrivateDraft={props.onSavePrivateDraft}
          onResubmit={() =>
            props.onResubmit({
              teamId,
              members: memberParse.members,
              excludeInaccessibleSources,
              permission,
              expiresAt: new Date(expiry).toISOString(),
            })
          }
          onRemediate={props.onRemediate}
        />
      </Stack>
    </Box>
  );
}

function parseMembers(value: string): {
  members: DwaionTeamArtifactMemberRequest[];
  error: string | null;
} {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 100) return { members: [], error: 'Maximum 100 members.' };
  const members: DwaionTeamArtifactMemberRequest[] = [];
  for (const line of lines) {
    const [subjectId, rawRole, ...extra] = line.split(',').map((part) => part.trim());
    const role = rawRole?.toUpperCase();
    if (
      !subjectId ||
      !SUBJECT.test(subjectId) ||
      extra.length > 0 ||
      !['OWNER', 'EDITOR', 'REVIEWER', 'VIEWER'].includes(role)
    )
      return { members: [], error: `Invalid member line: ${line}` };
    members.push({ subjectId, role: role as DwaionTeamArtifactMemberRequest['role'] });
  }
  if (new Set(members.map((member) => member.subjectId)).size !== members.length)
    return { members: [], error: 'Duplicate members are not allowed.' };
  return { members, error: null };
}

function tomorrowLocal() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SUBJECT = /^[A-Za-z0-9][A-Za-z0-9@._:-]{0,159}$/u;
