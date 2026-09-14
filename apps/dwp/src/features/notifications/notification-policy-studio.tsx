import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BellRing,
  Building2,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createNotificationIdempotencyKey,
  createNotificationTenantPolicyDraft,
  getNotificationTenantPolicies,
  previewNotificationTenantPolicy,
  publishNotificationTenantPolicy,
  rejectNotificationTenantPolicyDraft,
  withdrawNotificationTenantPolicyDraft,
  type NotificationChannel,
  type NotificationPolicyChannelRule,
  type TenantNotificationPolicy,
  type TenantNotificationPolicyChangeInput,
  type TenantNotificationPolicyPreview,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { useAuth, usePermissions, useToast } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FormDialog,
  FormField,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { notificationQueryKeys } from './integration-contract';
import { NotificationDraftDecisionDialog } from './notification-draft-decision-dialog';
import { NotificationPolicyComparison } from './notification-governance-comparison';
import {
  DEFAULT_NOTIFICATION_POLICY_SIMULATION,
  NotificationPolicySimulationControls,
  NotificationPolicySimulationResult,
} from './notification-policy-simulation';
import { NotificationResponsiveCatalog } from './notification-responsive-catalog';
import { NotificationPolicyChannels as PolicyChannels } from './notification-policy-channels';

const POLICY_CHANNELS: readonly NotificationChannel[] = [
  'IN_APP',
  'EMAIL',
  'WEB_PUSH',
  'MOBILE_PUSH',
  'TEAMS',
  'SLACK',
];

const DEFAULT_CHANNELS: NotificationPolicyChannelRule[] = POLICY_CHANNELS.map((channel) => ({
  channel,
  enabled: channel === 'IN_APP',
  defaultMode: 'IMMEDIATE',
  userOverridable: channel === 'IN_APP',
  maxPerWindow: channel === 'IN_APP' ? 100 : null,
}));

function editableChannels(policy: TenantNotificationPolicy): NotificationPolicyChannelRule[] {
  const indexed = new Map(policy.channels.map((channel) => [channel.channel, channel]));
  return DEFAULT_CHANNELS.map((fallback) => ({ ...fallback, ...indexed.get(fallback.channel) }));
}

function sourceTone(source: TenantNotificationPolicy['source']): 'default' | 'info' {
  return source === 'PROVIDER_POLICY' ? 'info' : 'default';
}

function PolicyListItem({
  policy,
  selected,
  onSelect,
}: {
  policy: TenantNotificationPolicy;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <ButtonBase
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        width: 1,
        px: 1.75,
        py: 1.25,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 1,
        textAlign: 'left',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : undefined,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box minWidth={0}>
        <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
          {policy.scopeLabel}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', overflowWrap: 'anywhere' }}
        >
          {policy.scopeType} · {policy.scopeKey}
        </Typography>
        <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
          <Chip
            size="small"
            variant="outlined"
            color={sourceTone(policy.source)}
            label={t(`admin.policies.source.${policy.source}`)}
          />
          {policy.mandatory && (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={t('admin.policies.mandatory')}
            />
          )}
        </Stack>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t('admin.policies.versionLabel', { version: policy.version })}
      </Typography>
    </ButtonBase>
  );
}

function PolicyDetail({
  policy,
  canManage,
  hasDraft,
  draft,
  onEdit,
}: {
  policy: TenantNotificationPolicy;
  canManage: boolean;
  hasDraft: boolean;
  draft?: TenantNotificationPolicy;
  onEdit: () => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Box component="section" sx={{ p: { xs: 1.5, md: 2 }, minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        gap={1.5}
      >
        <Box minWidth={0}>
          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
            <Chip size="small" variant="outlined" label={policy.scopeType} />
            <Chip
              size="small"
              variant="outlined"
              color={sourceTone(policy.source)}
              label={t(`admin.policies.source.${policy.source}`)}
            />
          </Stack>
          <Typography component="h2" variant="h6" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
            {policy.scopeLabel}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.35, overflowWrap: 'anywhere' }}
          >
            {policy.scopeKey}
          </Typography>
        </Box>
        {canManage && (
          <ActionButton
            intent="secondary"
            startIcon={<PencilLine size={17} />}
            onClick={onEdit}
            disabled={hasDraft}
          >
            {hasDraft ? t('admin.policies.draftExists') : t('admin.policies.proposeChange')}
          </ActionButton>
        )}
      </Stack>

      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {[
          [
            t('admin.policies.fields.mandatory'),
            t(`admin.policies.${policy.mandatory ? 'yes' : 'no'}`),
          ],
          [
            t('admin.policies.fields.quietHours'),
            t(`admin.policies.${policy.quietHoursBypass ? 'bypass' : 'respectQuietHours'}`),
          ],
          [t('admin.policies.fields.digest'), t(`admin.policies.digest.${policy.digestMode}`)],
        ].map(([label, value]) => (
          <Box
            key={label}
            sx={{
              minWidth: 0,
              py: 1,
              pr: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
              overflowWrap: 'anywhere',
            }}
          >
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" variant="body2" fontWeight={700} sx={{ m: 0, mt: 0.35 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      {draft && (
        <Box sx={{ mt: 2, borderLeft: 3, borderColor: 'warning.main', pl: 1.5 }}>
          <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center" sx={{ mb: 1 }}>
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={t('admin.policies.draft')}
            />
            <Typography variant="caption" color="text.secondary">
              {t('admin.policies.versionLabel', { version: draft.version })}
            </Typography>
          </Stack>
          <NotificationPolicyComparison current={policy} proposed={draft} />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, overflowWrap: 'anywhere' }}
          >
            {draft.changeReason}
          </Typography>
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
            {t('admin.policies.independentApprovalRequired')}
          </Typography>
        </Box>
      )}
      {!draft && (
        <>
          <Typography component="h3" variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
            {t('admin.policies.channelsTitle')}
          </Typography>
          <PolicyChannels channels={policy.channels} />
        </>
      )}

      {policy.source === 'PROVIDER_POLICY' && (
        <Alert severity="info" icon={<Building2 size={18} />} sx={{ mt: 2 }}>
          {t('admin.policies.providerInheritance')}
        </Alert>
      )}
    </Box>
  );
}

export function NotificationPolicyStudio() {
  const { t } = useTranslation('notifications');
  const auth = useAuth();
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [preview, setPreview] = useState<TenantNotificationPolicyPreview | null>(null);
  const [approvalDraft, setApprovalDraft] = useState<TenantNotificationPolicy | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [draftDecision, setDraftDecision] = useState<{
    draft: TenantNotificationPolicy;
    kind: 'withdraw' | 'reject';
  } | null>(null);
  const [draftDecisionReason, setDraftDecisionReason] = useState('');
  const [mandatory, setMandatory] = useState(false);
  const [quietHoursBypass, setQuietHoursBypass] = useState(false);
  const [digestMode, setDigestMode] = useState<'IMMEDIATE' | 'DAILY' | 'WEEKLY'>('IMMEDIATE');
  const [channels, setChannels] = useState<NotificationPolicyChannelRule[]>(DEFAULT_CHANNELS);
  const [changeReason, setChangeReason] = useState('');
  const [simulation, setSimulation] = useState(DEFAULT_NOTIFICATION_POLICY_SIMULATION);

  const canManage = hasPermission('ADMIN.NOTIFICATION_POLICY', 'MANAGE');
  const canApprove = hasPermission('ADMIN.NOTIFICATION_POLICY', 'APPROVE');
  const policies = useQuery({
    queryKey: notificationQueryKeys.adminPolicies(),
    queryFn: ({ signal }) => getNotificationTenantPolicies(signal),
    staleTime: 20_000,
    retry: 1,
  });
  const effective = useMemo(() => policies.data?.effectivePolicies ?? [], [policies.data]);
  const drafts = useMemo(() => policies.data?.drafts ?? [], [policies.data]);
  const selected = useMemo(
    () => effective.find((policy) => policy.policyId === selectedId) ?? effective[0] ?? null,
    [effective, selectedId]
  );
  const selectedHasDraft = Boolean(
    selected &&
    drafts.some(
      (draft) => draft.scopeType === selected.scopeType && draft.scopeKey === selected.scopeKey
    )
  );
  const approvalCurrent = approvalDraft
    ? (effective.find(
        (policy) =>
          policy.scopeType === approvalDraft.scopeType && policy.scopeKey === approvalDraft.scopeKey
      ) ?? null)
    : null;

  useEffect(() => {
    if (!selectedId && effective.length) setSelectedId(effective[0].policyId);
  }, [effective, selectedId]);

  const previewMutation = useMutation({
    mutationFn: (input: TenantNotificationPolicyChangeInput) =>
      previewNotificationTenantPolicy(input),
    onSuccess: (result) => {
      setPreview(result);
      setEditorOpen(false);
    },
    onError: () => toast.error(t('admin.policies.feedback.previewFailed')),
  });
  const draftMutation = useMutation({
    mutationFn: (input: TenantNotificationPolicyChangeInput) =>
      createNotificationTenantPolicyDraft(
        input,
        createNotificationIdempotencyKey('notification-policy-draft')
      ),
    onSuccess: async () => {
      setPreview(null);
      setEditorOpen(false);
      setChangeReason('');
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.adminPolicies() });
      toast.success(t('admin.policies.feedback.draftCreated'));
    },
    onError: () => toast.error(t('admin.policies.feedback.saveFailed')),
  });
  const publishMutation = useMutation({
    mutationFn: ({ draft, reason }: { draft: TenantNotificationPolicy; reason: string }) =>
      publishNotificationTenantPolicy(
        draft.policyId,
        { expectedVersion: draft.version, approvalReason: reason },
        createNotificationIdempotencyKey('notification-policy-publish')
      ),
    onSuccess: async () => {
      setApprovalDraft(null);
      setApprovalReason('');
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.adminPolicies() });
      toast.success(t('admin.policies.feedback.published'));
    },
    onError: () => toast.error(t('admin.policies.feedback.publishFailed')),
  });
  const draftDecisionMutation = useMutation({
    mutationFn: ({
      draft,
      kind,
      reason,
    }: {
      draft: TenantNotificationPolicy;
      kind: 'withdraw' | 'reject';
      reason: string;
    }) =>
      kind === 'withdraw'
        ? withdrawNotificationTenantPolicyDraft(
            draft.policyId,
            { expectedVersion: draft.version, reason },
            createNotificationIdempotencyKey('notification-policy-withdraw')
          )
        : rejectNotificationTenantPolicyDraft(
            draft.policyId,
            { expectedVersion: draft.version, reason },
            createNotificationIdempotencyKey('notification-policy-reject')
          ),
    onSuccess: async (_result, variables) => {
      setDraftDecision(null);
      setDraftDecisionReason('');
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.adminPolicies() });
      toast.success(
        t(`admin.policies.feedback.${variables.kind === 'withdraw' ? 'withdrawn' : 'rejected'}`)
      );
    },
    onError: (_error, variables) =>
      toast.error(
        t(
          `admin.policies.feedback.${variables.kind === 'withdraw' ? 'withdrawFailed' : 'rejectFailed'}`
        )
      ),
  });

  const openEditor = () => {
    if (!selected) return;
    setMandatory(selected.mandatory);
    setQuietHoursBypass(selected.quietHoursBypass);
    setDigestMode(selected.digestMode);
    setChannels(editableChannels(selected));
    setChangeReason('');
    setEditorOpen(true);
  };

  const input = (includeSimulation = false): TenantNotificationPolicyChangeInput | null => {
    if (!selected) return null;
    return {
      scopeType: selected.scopeType,
      scopeKey: selected.scopeKey,
      mandatory,
      quietHoursBypass,
      digestMode,
      channels,
      changeReason: changeReason.trim(),
      expectedVersion: selected.source === 'PROVIDER_POLICY' ? '0' : selected.version,
      simulation: includeSimulation ? simulation : undefined,
    };
  };

  const updateChannel = (
    channelKey: NotificationChannel,
    update: Partial<NotificationPolicyChannelRule>
  ) => {
    setChannels((current) =>
      current.map((channel) =>
        channel.channel === channelKey ? { ...channel, ...update } : channel
      )
    );
  };

  if (policies.isLoading) {
    return <LoadingState label={t('states.loadingPolicies')} variant="skeleton" skeletonRows={8} />;
  }
  if (policies.isError || !policies.data) {
    return (
      <ErrorState
        title={t('states.policiesErrorTitle')}
        description={t('states.policiesErrorDescription')}
        retryLabel={t('actions.retry')}
        onRetry={() => void policies.refetch()}
        retrying={policies.isFetching}
      />
    );
  }
  if (effective.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck size={28} />}
        title={t('admin.policies.emptyTitle')}
        description={t('admin.policies.emptyDescription')}
        size="page"
      />
    );
  }

  return (
    <Stack gap={1.5} data-testid="notification-policy-studio">
      <Alert severity="info" icon={<ShieldCheck size={18} />}>
        {t('admin.policies.governanceNotice')}
      </Alert>

      {drafts.length > 0 && (
        <Box component="section">
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Box>
              <Typography component="h2" variant="subtitle1">
                {t('admin.policies.reviewQueueTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('admin.policies.reviewQueueDescription')}
              </Typography>
            </Box>
            <Chip size="small" variant="outlined" label={drafts.length} />
          </Stack>
          <Box sx={{ mt: 1.25, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
            {drafts.map((draft) => {
              const selfAuthored = draft.createdBy === auth.user?.userId;
              return (
                <Box
                  key={draft.policyId}
                  data-testid={`notification-policy-review-${draft.policyId}`}
                  sx={{
                    minHeight: 70,
                    px: 1.5,
                    py: 1.2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                    gap: 1.25,
                    alignItems: 'center',
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:last-of-type': { borderBottom: 0 },
                  }}
                >
                  <Box minWidth={0}>
                    <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle2">{draft.scopeLabel}</Typography>
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={t('admin.policies.draft')}
                      />
                      {selfAuthored && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('admin.policies.authoredByMe')}
                        />
                      )}
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {draft.changeReason}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('admin.policies.createdVersionLabel', {
                        createdAt: formatDate(draft.createdAt, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }),
                        version: draft.version,
                      })}
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                    {canManage && selfAuthored && (
                      <ActionButton
                        intent="secondary"
                        startIcon={<RotateCcw size={17} />}
                        onClick={() => {
                          setDraftDecision({ draft, kind: 'withdraw' });
                          setDraftDecisionReason('');
                        }}
                      >
                        {t('admin.policies.withdrawDraft')}
                      </ActionButton>
                    )}
                    {canApprove && !selfAuthored && (
                      <ActionButton
                        intent="secondary"
                        startIcon={<XCircle size={17} />}
                        onClick={() => {
                          setDraftDecision({ draft, kind: 'reject' });
                          setDraftDecisionReason('');
                        }}
                      >
                        {t('admin.policies.rejectDraft')}
                      </ActionButton>
                    )}
                    {(canApprove || selfAuthored) && (
                      <ActionButton
                        intent="primary"
                        startIcon={<CheckCircle2 size={17} />}
                        disabled={selfAuthored}
                        onClick={() => setApprovalDraft(draft)}
                      >
                        {selfAuthored
                          ? t('admin.policies.independentApprovalRequired')
                          : t('admin.policies.reviewAndPublish')}
                      </ActionButton>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      <NotificationResponsiveCatalog
        testId="notification-policy-catalog"
        detailOpen={mobileDetailOpen}
        onBack={() => setMobileDetailOpen(false)}
        backLabel={t('admin.backToCatalog')}
        listLabel={t('admin.policies.catalogLabel')}
        detailLabel={t('admin.policies.detailLabel')}
        desktopColumns="minmax(0, .85fr) minmax(0, 2.15fr)"
        listMaxHeight={720}
        list={
          <>
            {effective.map((policy) => (
              <PolicyListItem
                key={policy.policyId}
                policy={policy}
                selected={policy.policyId === selected?.policyId}
                onSelect={() => {
                  setSelectedId(policy.policyId);
                  setMobileDetailOpen(true);
                }}
              />
            ))}
          </>
        }
        detail={
          selected && (
            <PolicyDetail
              policy={selected}
              canManage={canManage}
              hasDraft={selectedHasDraft}
              draft={drafts.find(
                (draft) =>
                  draft.scopeType === selected.scopeType && draft.scopeKey === selected.scopeKey
              )}
              onEdit={openEditor}
            />
          )
        }
      />

      <FormDialog
        open={editorOpen}
        title={t('admin.policies.editorTitle', { scope: selected?.scopeLabel ?? '' })}
        description={t('admin.policies.editorDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('admin.policies.previewImpact')}
        submittingLabel={t('admin.policies.previewing')}
        busy={previewMutation.isPending}
        submitDisabled={changeReason.trim().length < 10}
        onClose={() => setEditorOpen(false)}
        onSubmit={() => {
          const next = input(true);
          if (next) previewMutation.mutate(next);
        }}
        maxWidth="md"
      >
        <Stack gap={2}>
          <Alert severity="warning" icon={<LockKeyhole size={18} />}>
            {t('admin.policies.editorGovernanceNotice')}
          </Alert>
          <NotificationPolicySimulationControls value={simulation} onChange={setSimulation} />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={mandatory}
                  onChange={(event) => {
                    setMandatory(event.target.checked);
                    if (event.target.checked) {
                      updateChannel('IN_APP', {
                        enabled: true,
                        defaultMode: 'IMMEDIATE',
                        userOverridable: false,
                      });
                    }
                  }}
                />
              }
              label={t('admin.policies.fields.mandatory')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={quietHoursBypass}
                  onChange={(event) => setQuietHoursBypass(event.target.checked)}
                />
              }
              label={t('admin.policies.fields.quietHoursBypass')}
            />
            <FormField
              select
              label={t('admin.policies.fields.digest')}
              value={digestMode}
              onChange={(event) =>
                setDigestMode(event.target.value as 'IMMEDIATE' | 'DAILY' | 'WEEKLY')
              }
              sx={{ minWidth: 180 }}
            >
              {(['IMMEDIATE', 'DAILY', 'WEEKLY'] as const).map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`admin.policies.digest.${value}`)}
                </MenuItem>
              ))}
            </FormField>
          </Stack>

          <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
            {channels.map((channel) => {
              const external = channel.channel !== 'IN_APP';
              return (
                <Box
                  key={channel.channel}
                  sx={{
                    py: 1.25,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      md: 'minmax(140px,.8fr) minmax(120px,.7fr) minmax(150px,1fr) minmax(150px,1fr) minmax(120px,.7fr)',
                    },
                    gap: 1.25,
                    alignItems: 'center',
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Stack direction="row" gap={0.75} alignItems="center">
                    <BellRing size={17} />
                    <Typography variant="subtitle2">{t(`channels.${channel.channel}`)}</Typography>
                    {external && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t('admin.policies.certificationRequired')}
                      />
                    )}
                  </Stack>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={channel.enabled}
                        disabled={external || (mandatory && channel.channel === 'IN_APP')}
                        onChange={(event) =>
                          updateChannel(channel.channel, { enabled: event.target.checked })
                        }
                      />
                    }
                    label={t(`admin.policies.${channel.enabled ? 'enabled' : 'disabled'}`)}
                  />
                  <FormField
                    select
                    label={t('admin.policies.columns.defaultMode')}
                    value={channel.defaultMode}
                    disabled={
                      !channel.enabled || external || (mandatory && channel.channel === 'IN_APP')
                    }
                    onChange={(event) =>
                      updateChannel(channel.channel, {
                        defaultMode: event.target.value as 'IMMEDIATE' | 'DIGEST' | 'MUTED',
                      })
                    }
                  >
                    {(['IMMEDIATE', 'DIGEST', 'MUTED'] as const).map((value) => (
                      <MenuItem key={value} value={value}>
                        {t(`admin.policies.mode.${value}`)}
                      </MenuItem>
                    ))}
                  </FormField>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={channel.userOverridable}
                        disabled={
                          !channel.enabled ||
                          external ||
                          (mandatory && channel.channel === 'IN_APP')
                        }
                        onChange={(event) =>
                          updateChannel(channel.channel, {
                            userOverridable: event.target.checked,
                          })
                        }
                      />
                    }
                    label={t('admin.policies.columns.userControl')}
                  />
                  <FormField
                    type="number"
                    label={t('admin.policies.columns.limit')}
                    value={channel.maxPerWindow ?? ''}
                    disabled={!channel.enabled || external}
                    inputProps={{ min: 1, max: 10000 }}
                    onChange={(event) =>
                      updateChannel(channel.channel, {
                        maxPerWindow: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </Box>
              );
            })}
          </Box>
          <FormField
            label={t('admin.policies.fields.changeReason')}
            value={changeReason}
            onChange={(event) => setChangeReason(event.target.value)}
            multiline
            minRows={3}
            required
            supportingText={t('admin.policies.fields.changeReasonHelp')}
          />
        </Stack>
      </FormDialog>

      <FormDialog
        open={Boolean(preview)}
        title={t('admin.policies.previewTitle')}
        description={t('admin.policies.previewDescription')}
        cancelLabel={t('admin.policies.backToEdit')}
        submitLabel={t('admin.policies.createDraft')}
        submittingLabel={t('admin.policies.creatingDraft')}
        busy={draftMutation.isPending}
        onClose={() => {
          setPreview(null);
          setEditorOpen(true);
        }}
        onSubmit={() => {
          const next = input(false);
          if (next) draftMutation.mutate(next);
        }}
        maxWidth="md"
      >
        {preview && (
          <Stack gap={2}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              {[
                [
                  t('admin.policies.impact.types'),
                  formatNumber(preview.affectedTypeCount),
                  ShieldCheck,
                ],
                [
                  t('admin.policies.impact.recipients'),
                  formatNumber(preview.observedRecipients30Days),
                  Building2,
                ],
                [t('admin.policies.impact.version'), `v${preview.proposedPolicy.version}`, Clock3],
              ].map(([label, value, Icon]) => {
                const MetricIcon = Icon as typeof ShieldCheck;
                return (
                  <Box key={String(label)} sx={{ p: 1.5, border: 1, borderColor: 'divider' }}>
                    <MetricIcon size={18} />
                    <Typography variant="h6" sx={{ mt: 0.75 }}>
                      {String(value)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {String(label)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
            {preview.riskFlags.length > 0 && (
              <Alert severity="warning" icon={<TriangleAlert size={18} />}>
                <Typography variant="subtitle2">{t('admin.policies.riskTitle')}</Typography>
                <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
                  {preview.riskFlags.map((flag) => (
                    <Chip
                      key={flag}
                      size="small"
                      variant="outlined"
                      label={t(`admin.policies.risk.${flag}`)}
                    />
                  ))}
                </Stack>
              </Alert>
            )}
            <NotificationPolicyComparison
              current={preview.currentPolicy}
              proposed={preview.proposedPolicy}
            />
            <Alert severity="info" icon={<ShieldCheck size={18} />}>
              <Typography variant="subtitle2">{t('admin.policies.runtimePreviewTitle')}</Typography>
              <Typography variant="body2" sx={{ mt: 0.35 }}>
                {t('admin.policies.runtimePreviewDescription')}
              </Typography>
              <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
                {preview.runtimeChannels.map((channel) => (
                  <Chip
                    key={channel.channel}
                    size="small"
                    variant="outlined"
                    color={channel.defaultDeliveryAdmitted ? 'success' : 'default'}
                    label={t('admin.policies.runtimeChannel', {
                      channel: t(`channels.${channel.channel}`),
                      outcome: t(
                        `admin.policies.${
                          channel.defaultDeliveryAdmitted ? 'runtimeAdmitted' : 'runtimeSuppressed'
                        }`
                      ),
                      mode: t(`admin.policies.runtimeMode.${channel.effectiveMode}`),
                    })}
                  />
                ))}
              </Stack>
            </Alert>
            <NotificationPolicySimulationResult value={preview.simulation} />
            <Alert severity="info">{t('admin.policies.makerCheckerPreview')}</Alert>
          </Stack>
        )}
      </FormDialog>

      <NotificationDraftDecisionDialog
        open={Boolean(draftDecision)}
        title={t(
          draftDecision?.kind === 'reject'
            ? 'admin.policies.rejectTitle'
            : 'admin.policies.withdrawTitle'
        )}
        description={t(
          draftDecision?.kind === 'reject'
            ? 'admin.policies.rejectDescription'
            : 'admin.policies.withdrawDescription'
        )}
        target={t('admin.policies.decisionTarget', {
          scope: draftDecision?.draft.scopeLabel ?? '',
          version: draftDecision?.draft.version ?? '',
        })}
        reasonLabel={t('admin.policies.fields.decisionReason')}
        reasonHelp={t('admin.policies.decisionReasonHelp')}
        reason={draftDecisionReason}
        confirmLabel={t(
          draftDecision?.kind === 'reject'
            ? 'admin.policies.rejectConfirm'
            : 'admin.policies.withdrawConfirm'
        )}
        submittingLabel={t('admin.policies.processingDecision')}
        cancelLabel={t('actions.cancel')}
        busy={draftDecisionMutation.isPending}
        onReasonChange={setDraftDecisionReason}
        onClose={() => {
          setDraftDecision(null);
          setDraftDecisionReason('');
        }}
        onSubmit={() => {
          if (draftDecision) {
            draftDecisionMutation.mutate({
              ...draftDecision,
              reason: draftDecisionReason.trim(),
            });
          }
        }}
      />

      <FormDialog
        open={Boolean(approvalDraft)}
        title={t('admin.policies.approvalTitle', { scope: approvalDraft?.scopeLabel ?? '' })}
        description={t('admin.policies.approvalDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('admin.policies.publish')}
        submittingLabel={t('admin.policies.publishing')}
        busy={publishMutation.isPending}
        submitDisabled={approvalReason.trim().length < 10}
        onClose={() => setApprovalDraft(null)}
        onSubmit={() => {
          if (approvalDraft) {
            publishMutation.mutate({ draft: approvalDraft, reason: approvalReason.trim() });
          }
        }}
        maxWidth="md"
      >
        {approvalDraft && (
          <Stack gap={2}>
            <Alert severity="warning" icon={<ShieldCheck size={18} />}>
              {t('admin.policies.makerCheckerApproval')}
            </Alert>
            <Typography variant="body2">{approvalDraft.changeReason}</Typography>
            <NotificationPolicyComparison current={approvalCurrent} proposed={approvalDraft} />
            <FormField
              label={t('admin.policies.fields.approvalReason')}
              value={approvalReason}
              onChange={(event) => setApprovalReason(event.target.value)}
              multiline
              minRows={3}
              required
              supportingText={t('admin.policies.fields.approvalReasonHelp')}
            />
          </Stack>
        )}
      </FormDialog>
    </Stack>
  );
}
