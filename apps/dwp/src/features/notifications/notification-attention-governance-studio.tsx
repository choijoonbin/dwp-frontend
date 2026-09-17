import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  GitPullRequest,
  LockKeyhole,
  RotateCcw,
  Scale,
  ShieldCheck,
  Tags,
  UsersRound,
  XCircle,
} from 'lucide-react';

import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';
import { InlineFeedback } from '@dwp-frontend/design-system/components/inline-feedback/inline-feedback';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system/components/states/state-panels';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import type {
  NotificationAttentionGovernanceDraftInput,
  NotificationAttentionGovernanceRevision,
  NotificationAttentionGovernanceSettings,
  NotificationAttentionGovernanceWorkspace,
} from '@dwp-frontend/shared-utils/api/notification-attention-governance-api';

export type NotificationAttentionGovernanceCopy = {
  title: string;
  description: string;
  liveStatus: string;
  draftStatus: string;
  loading: string;
  loadErrorTitle: string;
  retry: string;
  emptyTitle: string;
  emptyDescription: string;
  ruleLimitsTitle: string;
  ruleLimitsDescription: string;
  maxActiveRules: string;
  maxVipRules: string;
  maxFollowRules: string;
  topicTitle: string;
  topicDescription: string;
  topicInputLabel: string;
  addTopic: string;
  removeTopic: (topic: string) => string;
  policyTitle: string;
  mandatoryPrecedence: string;
  mandatoryPrecedenceDetail: string;
  minimumCohort: string;
  minimumCohortDetail: string;
  independentReviewer: string;
  independentReviewerDetail: string;
  changeReason: string;
  saveDraft: string;
  pipelineTitle: string;
  pipelineDescription: string;
  activeRevision: string;
  noActiveRevision: string;
  draftRevision: string;
  createdBy: (userId: number) => string;
  approvedBy: (userId: number) => string;
  version: (revision: number, version: string) => string;
  stateLabel: (state: NotificationAttentionGovernanceRevision['state']) => string;
  decisionReason: string;
  publish: string;
  reject: string;
  withdraw: string;
  selfApprovalBlocked: string;
  guardrailBlocked: string;
  permissionBlocked: string;
  pendingDraftBlocked: string;
  mutationError: string;
};

type DraftPayload = Omit<NotificationAttentionGovernanceDraftInput, 'idempotencyKey'>;
type DecisionPayload = { expectedVersion: string; reason: string };

export type NotificationAttentionGovernanceStudioProps = {
  workspace?: NotificationAttentionGovernanceWorkspace | null;
  baselineSettings?: NotificationAttentionGovernanceSettings | null;
  status: 'LOADING' | 'READY' | 'ERROR';
  errorMessage?: string;
  actorUserId: number;
  canManage: boolean;
  canApprove: boolean;
  busy?: boolean;
  copy: NotificationAttentionGovernanceCopy;
  onRefresh?: () => void;
  onCreateDraft: (input: DraftPayload) => void | Promise<void>;
  onPublish: (governanceId: string, input: DecisionPayload) => void | Promise<void>;
  onReject: (governanceId: string, input: DecisionPayload) => void | Promise<void>;
  onWithdraw: (governanceId: string, input: DecisionPayload) => void | Promise<void>;
  resolveMutationError?: (error: unknown) => string;
};

const panelSx = {
  minWidth: 0,
  border: 1,
  borderColor: 'divider',
  borderRadius: foundationTokens.radius.surface,
  bgcolor: 'background.paper',
} as const;

function activeSource(
  workspace: NotificationAttentionGovernanceWorkspace | null | undefined,
  baseline: NotificationAttentionGovernanceSettings | null | undefined
): NotificationAttentionGovernanceSettings | null {
  return workspace?.drafts[0]?.settings ?? workspace?.activeRevision?.settings ?? baseline ?? null;
}

function LimitField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <FormField
      type="number"
      size="small"
      label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      slotProps={{ htmlInput: { min: 0, max: 10000, inputMode: 'numeric' } }}
    />
  );
}

function RevisionSummary({
  revision,
  label,
  copy,
}: {
  revision: NotificationAttentionGovernanceRevision;
  label: string;
  copy: NotificationAttentionGovernanceCopy;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface,
      }}
    >
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle2">{label}</Typography>
        <Chip
          size="small"
          color={revision.state === 'PUBLISHED' ? 'success' : 'info'}
          variant="outlined"
          label={copy.stateLabel(revision.state)}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {copy.version(revision.revisionNumber, revision.version)}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {copy.createdBy(revision.createdBy)}
      </Typography>
      {revision.approvedBy != null && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {copy.approvedBy(revision.approvedBy)}
        </Typography>
      )}
    </Box>
  );
}

export function NotificationAttentionGovernanceStudio({
  workspace,
  baselineSettings,
  status,
  errorMessage,
  actorUserId,
  canManage,
  canApprove,
  busy = false,
  copy,
  onRefresh,
  onCreateDraft,
  onPublish,
  onReject,
  onWithdraw,
  resolveMutationError,
}: NotificationAttentionGovernanceStudioProps) {
  const source = activeSource(workspace, baselineSettings);
  const [settings, setSettings] = useState<NotificationAttentionGovernanceSettings | null>(source);
  const [topicInput, setTopicInput] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [mutationError, setMutationError] = useState<string | null>(null);
  const draft = workspace?.drafts[0] ?? null;
  const editable = canManage && !draft && !busy;

  useEffect(() => setSettings(source), [source]);

  const guardrailsReady = Boolean(
    draft?.settings?.mandatoryPolicyPrecedence && draft.settings.independentReviewerRequired
  );
  const selfApproval = draft?.createdBy === actorUserId;
  const validSettings = useMemo(
    () =>
      settings != null &&
      Number.isInteger(settings.maxActiveUserRules) &&
      settings.maxActiveUserRules >= 1 &&
      settings.maxActiveUserRules <= 500 &&
      settings.maxVipRules >= 0 &&
      settings.maxVipRules <= settings.maxActiveUserRules &&
      settings.maxFollowRules >= 0 &&
      settings.maxFollowRules <= settings.maxActiveUserRules &&
      settings.minimumAnalyticsCohort >= 10 &&
      settings.minimumAnalyticsCohort <= 10000,
    [settings]
  );

  if (status === 'LOADING') return <LoadingState label={copy.loading} variant="skeleton" />;
  if (status === 'ERROR') {
    return (
      <ErrorState
        title={copy.loadErrorTitle}
        description={errorMessage}
        retryLabel={onRefresh ? copy.retry : undefined}
        onRetry={onRefresh}
      />
    );
  }
  if (!settings) {
    return <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />;
  }

  const updateSetting = <K extends keyof NotificationAttentionGovernanceSettings>(
    key: K,
    value: NotificationAttentionGovernanceSettings[K]
  ) => setSettings((current) => (current ? { ...current, [key]: value } : current));

  const addTopic = () => {
    const topic = topicInput.trim();
    if (!topic || settings.approvedTopicAllowlist.includes(topic)) return;
    updateSetting('approvedTopicAllowlist', [...settings.approvedTopicAllowlist, topic]);
    setTopicInput('');
  };

  const execute = async (operation: () => void | Promise<void>) => {
    setMutationError(null);
    try {
      await operation();
    } catch (error) {
      setMutationError(resolveMutationError?.(error) ?? copy.mutationError);
    }
  };

  return (
    <Stack data-testid="notification-attention-governance-studio" gap={2.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={1.5}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Stack direction="row" gap={1} alignItems="center">
            <ShieldCheck size={22} aria-hidden />
            <Typography component="h2" variant="h5">
              {copy.title}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
            {copy.description}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={draft ? 'info' : workspace?.activeRevision ? 'success' : 'default'}
          label={draft ? copy.draftStatus : copy.liveStatus}
        />
      </Stack>

      {mutationError && <InlineFeedback severity="error">{mutationError}</InlineFeedback>}
      {draft && <InlineFeedback severity="info">{copy.pendingDraftBlocked}</InlineFeedback>}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 1.45fr) minmax(320px, 0.75fr)',
          },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Stack gap={2}>
          <Box component="section" aria-labelledby="attention-rule-limits" sx={panelSx}>
            <Stack direction="row" gap={1} alignItems="center" sx={{ px: 2, pt: 2 }}>
              <UsersRound size={18} aria-hidden />
              <Box>
                <Typography
                  id="attention-rule-limits"
                  variant="subtitle1"
                  fontWeight="fontWeightBold"
                >
                  {copy.ruleLimitsTitle}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {copy.ruleLimitsDescription}
                </Typography>
              </Box>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1.5,
                p: 2,
              }}
            >
              <LimitField
                label={copy.maxActiveRules}
                value={settings.maxActiveUserRules}
                disabled={!editable}
                onChange={(value) => updateSetting('maxActiveUserRules', value)}
              />
              <LimitField
                label={copy.maxVipRules}
                value={settings.maxVipRules}
                disabled={!editable}
                onChange={(value) => updateSetting('maxVipRules', value)}
              />
              <LimitField
                label={copy.maxFollowRules}
                value={settings.maxFollowRules}
                disabled={!editable}
                onChange={(value) => updateSetting('maxFollowRules', value)}
              />
            </Box>
          </Box>

          <Box component="section" aria-labelledby="attention-topic-allowlist" sx={panelSx}>
            <Stack direction="row" gap={1} alignItems="center" sx={{ px: 2, pt: 2 }}>
              <Tags size={18} aria-hidden />
              <Box>
                <Typography
                  id="attention-topic-allowlist"
                  variant="subtitle1"
                  fontWeight="fontWeightBold"
                >
                  {copy.topicTitle}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {copy.topicDescription}
                </Typography>
              </Box>
            </Stack>
            <Stack gap={1.5} sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                <FormField
                  fullWidth
                  size="small"
                  label={copy.topicInputLabel}
                  value={topicInput}
                  disabled={!editable}
                  onChange={(event) => setTopicInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addTopic();
                    }
                  }}
                />
                <ActionButton
                  intent="secondary"
                  disabled={!editable || !topicInput.trim()}
                  onClick={addTopic}
                >
                  {copy.addTopic}
                </ActionButton>
              </Stack>
              <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap">
                {settings.approvedTopicAllowlist.map((topic) => (
                  <Chip
                    key={topic}
                    size="small"
                    label={topic}
                    onDelete={
                      editable
                        ? () =>
                            updateSetting(
                              'approvedTopicAllowlist',
                              settings.approvedTopicAllowlist.filter((item) => item !== topic)
                            )
                        : undefined
                    }
                    deleteIcon={editable ? undefined : <span />}
                    aria-label={editable ? copy.removeTopic(topic) : undefined}
                  />
                ))}
              </Stack>
            </Stack>
          </Box>

          <Box component="section" aria-labelledby="attention-policy-guardrails" sx={panelSx}>
            <Stack direction="row" gap={1} alignItems="center" sx={{ px: 2, pt: 2 }}>
              <Scale size={18} aria-hidden />
              <Typography
                id="attention-policy-guardrails"
                variant="subtitle1"
                fontWeight="fontWeightBold"
              >
                {copy.policyTitle}
              </Typography>
            </Stack>
            <Stack divider={<Divider flexItem />} sx={{ p: 2, pt: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.mandatoryPolicyPrecedence}
                    disabled={!editable}
                    onChange={(_, checked) => updateSetting('mandatoryPolicyPrecedence', checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight="fontWeightMedium">
                      {copy.mandatoryPrecedence}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {copy.mandatoryPrecedenceDetail}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', py: 1, mx: 0 }}
              />
              <Box sx={{ py: 1.5 }}>
                <LimitField
                  label={copy.minimumCohort}
                  value={settings.minimumAnalyticsCohort}
                  disabled={!editable}
                  onChange={(value) => updateSetting('minimumAnalyticsCohort', value)}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.75 }}
                >
                  {copy.minimumCohortDetail}
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.independentReviewerRequired}
                    disabled={!editable}
                    onChange={(_, checked) => updateSetting('independentReviewerRequired', checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight="fontWeightMedium">
                      {copy.independentReviewer}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {copy.independentReviewerDetail}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', py: 1, mx: 0 }}
              />
            </Stack>
          </Box>

          {!draft && (
            <Box sx={{ ...panelSx, p: 2 }}>
              <FormField
                fullWidth
                multiline
                minRows={2}
                label={copy.changeReason}
                value={changeReason}
                disabled={!editable}
                onChange={(event) => setChangeReason(event.target.value)}
              />
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
                <ActionButton
                  intent="primary"
                  disabled={!editable || !validSettings || changeReason.trim().length < 10}
                  loading={busy}
                  startIcon={<GitPullRequest size={16} />}
                  onClick={() =>
                    void execute(() =>
                      onCreateDraft({
                        settings,
                        changeReason: changeReason.trim(),
                        expectedVersion: workspace?.changeVersion ?? '0',
                      })
                    )
                  }
                >
                  {copy.saveDraft}
                </ActionButton>
              </Stack>
            </Box>
          )}
        </Stack>

        <Box component="aside" aria-labelledby="attention-governance-pipeline" sx={panelSx}>
          <Stack direction="row" gap={1} alignItems="center" sx={{ p: 2, pb: 1 }}>
            <LockKeyhole size={18} aria-hidden />
            <Box>
              <Typography
                id="attention-governance-pipeline"
                variant="subtitle1"
                fontWeight="fontWeightBold"
              >
                {copy.pipelineTitle}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {copy.pipelineDescription}
              </Typography>
            </Box>
          </Stack>
          <Stack gap={1.25} sx={{ p: 2, pt: 1 }}>
            {workspace?.activeRevision ? (
              <RevisionSummary
                revision={workspace.activeRevision}
                label={copy.activeRevision}
                copy={copy}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                {copy.noActiveRevision}
              </Typography>
            )}
            {draft && <RevisionSummary revision={draft} label={copy.draftRevision} copy={copy} />}
            {draft && (
              <>
                {!guardrailsReady && (
                  <InlineFeedback severity="error">{copy.guardrailBlocked}</InlineFeedback>
                )}
                {selfApproval && (
                  <InlineFeedback severity="warning">{copy.selfApprovalBlocked}</InlineFeedback>
                )}
                {!canApprove && (
                  <InlineFeedback severity="info">{copy.permissionBlocked}</InlineFeedback>
                )}
                <FormField
                  fullWidth
                  multiline
                  minRows={3}
                  label={copy.decisionReason}
                  value={decisionReason}
                  disabled={busy}
                  onChange={(event) => setDecisionReason(event.target.value)}
                />
                <ActionButton
                  intent="primary"
                  disabled={
                    busy ||
                    !canApprove ||
                    selfApproval ||
                    !guardrailsReady ||
                    decisionReason.trim().length < 10
                  }
                  startIcon={<CheckCircle2 size={16} />}
                  onClick={() =>
                    void execute(() =>
                      onPublish(draft.governanceId, {
                        expectedVersion: draft.version,
                        reason: decisionReason.trim(),
                      })
                    )
                  }
                >
                  {copy.publish}
                </ActionButton>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                  <ActionButton
                    fullWidth
                    intent="danger"
                    disabled={
                      busy || !canApprove || selfApproval || decisionReason.trim().length < 10
                    }
                    startIcon={<XCircle size={16} />}
                    onClick={() =>
                      void execute(() =>
                        onReject(draft.governanceId, {
                          expectedVersion: draft.version,
                          reason: decisionReason.trim(),
                        })
                      )
                    }
                  >
                    {copy.reject}
                  </ActionButton>
                  <ActionButton
                    fullWidth
                    intent="secondary"
                    disabled={busy || !canManage || decisionReason.trim().length < 10}
                    startIcon={<RotateCcw size={16} />}
                    onClick={() =>
                      void execute(() =>
                        onWithdraw(draft.governanceId, {
                          expectedVersion: draft.version,
                          reason: decisionReason.trim(),
                        })
                      )
                    }
                  >
                    {copy.withdraw}
                  </ActionButton>
                </Stack>
              </>
            )}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
