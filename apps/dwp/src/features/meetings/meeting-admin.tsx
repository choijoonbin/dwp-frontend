import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ConfirmDialog,
  ErrorState,
  FormField,
  InlineFeedback,
  LoadingState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import { HttpError, useAuth, usePermissions, useToast } from '@dwp-frontend/shared-utils';
import {
  getVideoMeetingAdminPolicy,
  updateVideoMeetingAdminPolicy,
  type VideoMeetingAdminPolicy,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import {
  hasMeetingAdminPolicyErrors,
  MEETING_RECORDING_POLICIES,
  validateMeetingAdminPolicy,
} from './meeting-admin-model';
import { AdminPageHeading, adminInset } from './meeting-admin-presentation';
import {
  MeetingPolicyMobileNavigation,
  MeetingPolicyMobileSections,
} from './meeting-admin-policy-mobile-sections';
import {
  MeetingAdminPolicyBoundaries,
  MeetingAdminPolicyContext,
  MeetingAdminPolicyDesignSections,
  MeetingAdminPolicyImpact,
  MeetingAdminPolicySection,
} from './meeting-admin-policy-layout';

const POLICY_CHANGE_LABELS = {
  meetingsEnabled: 'admin.policy.meetingsEnabled',
  waitingRoomRequired: 'admin.policy.waitingRoom',
  requireAuthenticatedInternalUsers: 'admin.policy.authenticatedInternal',
  participantChatAllowed: 'admin.policy.chat',
  reactionsAllowed: 'admin.policy.reactions',
  screenShareAllowed: 'admin.policy.screenShare',
  recordingPolicy: 'admin.policy.recording',
  retentionDays: 'admin.policy.retention',
  chatRetentionDays: 'admin.policy.chatRetention',
  artifactRetentionDays: 'admin.policy.artifactRetention',
  maximumParticipants: 'admin.policy.maximumParticipants',
} as const satisfies Partial<Record<keyof VideoMeetingAdminPolicy, string>>;

type PolicyChangeKey = keyof typeof POLICY_CHANGE_LABELS;
type PolicyChangePatch = Partial<Pick<VideoMeetingAdminPolicy, PolicyChangeKey>>;
type PolicyConflict = {
  baseVersion: number;
  changedFields: readonly PolicyChangeKey[];
  patch: PolicyChangePatch;
  latestVersion: number | null;
};

function meetingAdminIdentityScope(
  isAuthenticated: boolean,
  user: { identityPlane?: unknown; tenantId?: unknown; userId?: unknown } | null | undefined
) {
  return JSON.stringify([
    isAuthenticated,
    user?.identityPlane ?? null,
    user?.tenantId ?? null,
    user?.userId ?? null,
  ]);
}

function meetingAdminQueryMeta() {
  return { accessSensitive: true } as const;
}

function changedPolicyFields(
  draft: VideoMeetingAdminPolicy | null,
  persisted: VideoMeetingAdminPolicy | undefined
): PolicyChangeKey[] {
  if (!draft || !persisted) return [];
  return (Object.keys(POLICY_CHANGE_LABELS) as PolicyChangeKey[]).filter(
    (key) => draft[key] !== persisted[key]
  );
}

function policyPatch(
  draft: VideoMeetingAdminPolicy,
  changedFields: readonly PolicyChangeKey[]
): PolicyChangePatch {
  return Object.fromEntries(changedFields.map((key) => [key, draft[key]])) as PolicyChangePatch;
}

export { MeetingAdminOperations } from './meeting-admin-operations';

export function MeetingAdminPolicies() {
  const { user, isAuthenticated } = useAuth();
  const identityScope = meetingAdminIdentityScope(isAuthenticated, user);
  const activeIdentityScope = useRef(identityScope);
  activeIdentityScope.current = identityScope;
  return (
    <MeetingAdminPoliciesWorkspace
      key={identityScope}
      identityScope={identityScope}
      isCurrentScope={() => activeIdentityScope.current === identityScope}
    />
  );
}

function MeetingAdminPoliciesWorkspace({
  identityScope,
  isCurrentScope,
}: {
  identityScope: string;
  isCurrentScope: () => boolean;
}) {
  const { t } = useTranslation('meetings');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.MEETINGS', 'MANAGE');
  const query = useQuery({
    queryKey: ['meetings', 'admin', 'policy', identityScope],
    queryFn: getVideoMeetingAdminPolicy,
    staleTime: 30_000,
    retry: 1,
    gcTime: 0,
    meta: meetingAdminQueryMeta(),
  });
  const [form, setForm] = useState<VideoMeetingAdminPolicy | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [conflict, setConflict] = useState<PolicyConflict | null>(null);
  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);
  const validation = form ? validateMeetingAdminPolicy(form) : null;
  const chatRetentionError =
    validation?.chatRetention === 'RANGE'
      ? t('admin.policy.chatRetentionRangeError')
      : validation?.chatRetention === 'EXCEEDS_MEETING_RETENTION'
        ? t('admin.policy.chatRetentionMeetingError')
        : undefined;
  const artifactRetentionError = validation?.artifactRetention
    ? t('admin.policy.artifactRetentionMeetingError')
    : undefined;
  const persistedPolicy = query.data;
  const changedFields = changedPolicyFields(form, persistedPolicy);
  const groupChanged = (...keys: PolicyChangeKey[]) =>
    keys.some((key) => changedFields.includes(key));
  const refreshLatestPolicy = async () => {
    const result = await query.refetch();
    if (!isCurrentScope() || !result.isSuccess || !result.data) return;
    setForm(result.data);
    setConflict((current) =>
      current ? { ...current, latestVersion: result.data.version } : current
    );
  };
  const mutation = useMutation({
    mutationFn: ({ policy }: { policy: VideoMeetingAdminPolicy; conflict: PolicyConflict }) =>
      updateVideoMeetingAdminPolicy(policy),
    onSuccess: async (policy) => {
      if (!isCurrentScope()) return;
      setConfirmationOpen(false);
      setConflict(null);
      setForm(policy);
      queryClient.setQueryData(['meetings', 'admin', 'policy', identityScope], policy);
      await queryClient.invalidateQueries({
        queryKey: ['meetings', 'admin', 'overview', identityScope],
      });
      toast.success(t('admin.policy.saved'));
    },
    onError: (error, submission) => {
      if (!isCurrentScope()) return;
      if (error instanceof HttpError && error.status === 409) {
        setConfirmationOpen(false);
        setConflict(submission.conflict);
        void refreshLatestPolicy();
        return;
      }
      toast.error(t('admin.policy.saveError'));
    },
  });
  const editorDisabled = !canManage || Boolean(conflict);

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <AdminPageHeading
        eyebrow={t('admin.eyebrow')}
        title={t('admin.policy.title')}
        description={t('admin.policy.description')}
        actions={
          <ActionButton
            intent="primary"
            loading={mutation.isPending}
            loadingLabel={t('actions.saving')}
            disabled={
              editorDisabled ||
              !form ||
              changedFields.length === 0 ||
              Boolean(validation && hasMeetingAdminPolicyErrors(validation))
            }
            onClick={() => setConfirmationOpen(true)}
          >
            {t('actions.save')}
          </ActionButton>
        }
      />

      {form && <MeetingAdminPolicyContext version={persistedPolicy?.version ?? form.version} />}

      {conflict && (
        <Box data-testid="meeting-admin-policy-conflict" sx={{ mb: 2 }}>
          <InlineFeedback severity="warning" title={t('admin.policy.conflictTitle')}>
            <Stack gap={1.25}>
              <Typography variant="body2">
                {conflict.latestVersion === null
                  ? t('admin.policy.conflictRefreshing', {
                      version: conflict.baseVersion,
                      count: conflict.changedFields.length,
                    })
                  : t('admin.policy.conflictDescription', {
                      version: conflict.baseVersion,
                      latestVersion: conflict.latestVersion,
                      count: conflict.changedFields.length,
                    })}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                <ActionButton
                  intent="primary"
                  size="small"
                  disabled={!persistedPolicy || conflict.latestVersion === null}
                  onClick={() => {
                    if (!persistedPolicy || conflict.latestVersion === null) return;
                    setForm({
                      ...persistedPolicy,
                      ...conflict.patch,
                      version: persistedPolicy.version,
                    });
                    setConflict(null);
                  }}
                >
                  {t('admin.policy.conflictReapply')}
                </ActionButton>
                <ActionButton
                  intent="quiet"
                  size="small"
                  onClick={() => {
                    if (persistedPolicy) setForm(persistedPolicy);
                    setConflict(null);
                  }}
                >
                  {t('admin.policy.conflictDiscard')}
                </ActionButton>
              </Stack>
            </Stack>
          </InlineFeedback>
        </Box>
      )}

      {query.isError ? (
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => (conflict ? refreshLatestPolicy() : query.refetch())}
        />
      ) : query.isLoading || !form ? (
        <LoadingState label={t('admin.policy.loading')} variant="skeleton" skeletonRows={6} />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 8fr) minmax(300px, 4fr)' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <MeetingPolicyMobileSections
            recordingPolicy={form.recordingPolicy}
            retentionDays={form.retentionDays}
          >
            <Stack gap={2} sx={{ minWidth: 0 }}>
              <MeetingPolicyMobileNavigation />
              <MeetingAdminPolicySection
                number="01"
                title={t('admin.policy.accessTitle')}
                forceOpen={groupChanged(
                  'meetingsEnabled',
                  'waitingRoomRequired',
                  'requireAuthenticatedInternalUsers'
                )}
              >
                <PolicySwitch
                  label={t('admin.policy.meetingsEnabled')}
                  hint={t('admin.policy.meetingsEnabledHint')}
                  checked={form.meetingsEnabled}
                  disabled={editorDisabled}
                  onChange={(checked) => setForm({ ...form, meetingsEnabled: checked })}
                />
                <PolicySwitch
                  label={t('admin.policy.waitingRoom')}
                  hint={t('admin.policy.waitingRoomHint')}
                  checked={form.waitingRoomRequired}
                  disabled={editorDisabled}
                  onChange={(checked) => setForm({ ...form, waitingRoomRequired: checked })}
                />
                <PolicySwitch
                  label={t('admin.policy.authenticatedInternal')}
                  hint={t('admin.policy.authenticatedInternalHint')}
                  checked={form.requireAuthenticatedInternalUsers}
                  disabled={editorDisabled}
                  onChange={(checked) =>
                    setForm({ ...form, requireAuthenticatedInternalUsers: checked })
                  }
                />
                <MeetingAdminPolicyDesignSections kind="access" />
              </MeetingAdminPolicySection>

              <MeetingAdminPolicySection
                number="02"
                title={t('admin.policy.captureTitle')}
                forceOpen={groupChanged('recordingPolicy')}
              >
                <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                  <SelectField<VideoMeetingAdminPolicy['recordingPolicy']>
                    label={t('admin.policy.recording')}
                    value={form.recordingPolicy}
                    options={MEETING_RECORDING_POLICIES.map((policy) => ({
                      value: policy,
                      label: t(`admin.intelligence.recordingPolicies.${policy}`),
                    }))}
                    supportingText={
                      form.recordingPolicy === 'ADMIN_REQUIRED'
                        ? t('admin.policy.recordingAdminRequiredHint')
                        : form.recordingConfigured
                          ? t('admin.policy.recordingHostOptInHint')
                          : t('admin.policy.recordingUnavailable')
                    }
                    slotProps={{
                      formHelperText: {
                        sx: { '&.Mui-disabled': { color: 'text.secondary', opacity: 1 } },
                      },
                    }}
                    disabled={editorDisabled || !form.recordingConfigured}
                    onValueChange={(recordingPolicy) => {
                      if (recordingPolicy) setForm({ ...form, recordingPolicy });
                    }}
                  />
                </Box>
                <PolicySwitch
                  label={t('admin.policy.aiNotes')}
                  hint={t(
                    form.aiNotesConfigured
                      ? 'admin.intelligence.capabilities.aiNotes.description'
                      : 'admin.policy.aiNotesUnavailable'
                  )}
                  checked={form.aiNotesConfigured}
                  disabled
                  onChange={() => undefined}
                />
                <MeetingAdminPolicyDesignSections kind="capture" />
              </MeetingAdminPolicySection>

              <MeetingAdminPolicyDesignSections kind="ai" />

              {form.recordingPolicy !== 'NEVER' && (
                <Alert severity="warning" icon={<ShieldCheck size={19} />}>
                  {t(
                    form.recordingPolicy === 'ADMIN_REQUIRED'
                      ? 'admin.policy.recordingAdminRequiredWarning'
                      : 'admin.policy.recordingHostOptInWarning'
                  )}
                </Alert>
              )}

              <MeetingAdminPolicySection
                number="04"
                title={t('admin.policy.retentionTitle')}
                forceOpen={
                  groupChanged('retentionDays', 'chatRetentionDays', 'artifactRetentionDays') ||
                  Boolean(chatRetentionError || artifactRetentionError)
                }
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                    gap: 2,
                    p: 2,
                  }}
                >
                  <FormField
                    type="number"
                    label={t('admin.policy.retention')}
                    value={form.retentionDays}
                    disabled={editorDisabled}
                    slotProps={{ htmlInput: { min: 30, max: 3650 } }}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        retentionDays: Math.max(30, Math.min(3650, Number(event.target.value))),
                      })
                    }
                  />
                  <FormField
                    type="number"
                    label={t('admin.policy.chatRetention')}
                    value={form.chatRetentionDays}
                    disabled={editorDisabled}
                    supportingText={t('admin.policy.chatRetentionHint', {
                      meetingRetentionDays: form.retentionDays,
                    })}
                    errorMessage={chatRetentionError}
                    slotProps={{ htmlInput: { min: 0, max: 365, step: 1 } }}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        chatRetentionDays: Number(event.target.value),
                      })
                    }
                  />
                  <FormField
                    type="number"
                    label={t('admin.policy.artifactRetention')}
                    value={form.artifactRetentionDays}
                    disabled={editorDisabled}
                    errorMessage={artifactRetentionError}
                    slotProps={{ htmlInput: { min: 1, max: 3650 } }}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        artifactRetentionDays: Math.max(
                          1,
                          Math.min(3650, Number(event.target.value))
                        ),
                      })
                    }
                  />
                </Box>
                <MeetingAdminPolicyDesignSections kind="legalHold" />
              </MeetingAdminPolicySection>

              <MeetingAdminPolicyDesignSections kind="templates" />

              <MeetingAdminPolicySection
                number="06"
                defaultExpanded={false}
                title={t('admin.policy.contentTitle')}
                forceOpen={groupChanged(
                  'participantChatAllowed',
                  'reactionsAllowed',
                  'screenShareAllowed'
                )}
              >
                <PolicySwitch
                  label={t('admin.policy.chat')}
                  hint={t('admin.policy.chatHint')}
                  checked={form.participantChatAllowed}
                  disabled={editorDisabled}
                  onChange={(checked) => setForm({ ...form, participantChatAllowed: checked })}
                />
                <PolicySwitch
                  label={t('admin.policy.reactions')}
                  hint={t('admin.policy.reactionsHint')}
                  checked={form.reactionsAllowed}
                  disabled={editorDisabled}
                  onChange={(checked) => setForm({ ...form, reactionsAllowed: checked })}
                />
                <PolicySwitch
                  label={t('admin.policy.screenShare')}
                  hint={t('admin.policy.screenShareHint')}
                  checked={form.screenShareAllowed}
                  disabled={editorDisabled}
                  onChange={(checked) => setForm({ ...form, screenShareAllowed: checked })}
                />
              </MeetingAdminPolicySection>
              <MeetingAdminPolicySection
                number="07"
                defaultExpanded={false}
                title={t('admin.policy.capacityTitle')}
                forceOpen={groupChanged('maximumParticipants')}
              >
                <Box sx={{ p: 2 }}>
                  <FormField
                    type="number"
                    label={t('admin.policy.maximumParticipants')}
                    value={form.maximumParticipants}
                    disabled={editorDisabled}
                    slotProps={{ htmlInput: { min: 2, max: 1000 } }}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        maximumParticipants: Math.max(
                          2,
                          Math.min(1000, Number(event.target.value))
                        ),
                      })
                    }
                  />
                </Box>
              </MeetingAdminPolicySection>
            </Stack>
          </MeetingPolicyMobileSections>

          <Stack gap={2}>
            <MeetingAdminPolicyImpact
              version={persistedPolicy?.version ?? form.version}
              changedCount={changedFields.length}
            />
            <MeetingAdminPolicyBoundaries canManage={canManage} />
          </Stack>
        </Box>
      )}
      {form && (
        <Box
          data-testid="meeting-admin-policy-savebar"
          sx={{
            position: 'sticky',
            bottom: 0,
            mt: 2.5,
            py: 1.5,
            bgcolor: 'background.default',
            zIndex: 2,
            display: { xs: 'block', md: 'none' },
          }}
        >
          <ActionButton
            fullWidth
            intent="primary"
            loading={mutation.isPending}
            loadingLabel={t('actions.saving')}
            disabled={
              editorDisabled ||
              changedFields.length === 0 ||
              Boolean(validation && hasMeetingAdminPolicyErrors(validation))
            }
            onClick={() => setConfirmationOpen(true)}
          >
            {t('admin.design.savePolicy')}
          </ActionButton>
        </Box>
      )}
      <ConfirmDialog
        open={confirmationOpen}
        title={t('admin.policy.confirmTitle')}
        description={t('admin.policy.confirmDescription', {
          version: query.data?.version ?? form?.version ?? 0,
          count: changedFields.length,
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('actions.save')}
        confirmingLabel={t('actions.saving')}
        busy={mutation.isPending}
        details={
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {changedFields.map((key) => (
              <Typography key={key} component="li" variant="body2">
                {t(POLICY_CHANGE_LABELS[key])}
              </Typography>
            ))}
          </Box>
        }
        onClose={() => setConfirmationOpen(false)}
        onConfirm={() => {
          if (!form || !persistedPolicy || changedFields.length === 0) return;
          mutation.mutate({
            policy: form,
            conflict: {
              baseVersion: form.version,
              changedFields,
              patch: policyPatch(form, changedFields),
              latestVersion: null,
            },
          });
        }}
      />
    </PageCanvas>
  );
}

function PolicySwitch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const labelId = useId();
  const hintId = useId();
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={2}
      sx={(theme) => ({ ...adminInset(theme), px: 1.5, py: 1.25, mb: 1 })}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography id={labelId} variant="body2" fontWeight={700}>
          {label}
        </Typography>
        <Typography id={hintId} variant="caption" color="text.secondary">
          {hint}
        </Typography>
      </Box>
      <Switch
        sx={{ flexShrink: 0 }}
        checked={checked}
        disabled={disabled}
        slotProps={{ input: { 'aria-labelledby': labelId, 'aria-describedby': hintId } }}
        onChange={(_, value) => onChange(value)}
      />
    </Stack>
  );
}
