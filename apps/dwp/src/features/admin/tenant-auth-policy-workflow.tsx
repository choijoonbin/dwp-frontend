import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, FilePenLine, Send, ShieldCheck, Upload, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTenantAuthPolicyChange,
  decideTenantAuthPolicyChange,
  getAuthPolicy,
  getIdentityProviders,
  listTenantAuthPolicyChanges,
  publishTenantAuthPolicyChange,
  submitTenantAuthPolicyChange,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  TenantAuthPolicyDraft,
  TenantSettingChangeSet,
} from '@dwp-frontend/shared-utils';

type Decision = 'APPROVE' | 'REJECT';

function lifecycleTone(
  state: TenantSettingChangeSet['lifecycleState']
): 'default' | 'info' | 'warning' | 'success' | 'error' {
  if (state === 'PUBLISHED') return 'success';
  if (state === 'REJECTED' || state === 'SUPERSEDED') return 'error';
  if (state === 'APPROVED') return 'info';
  if (state === 'IN_REVIEW') return 'warning';
  return 'default';
}

export function TenantAuthPolicyWorkflow() {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draftOpen, setDraftOpen] = useState(false);
  const [decision, setDecision] = useState<{
    change: TenantSettingChangeSet;
    decision: Decision;
  } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const current = useQuery({
    queryKey: ['admin', 'tenant-settings', 'auth-policy', 'current'],
    queryFn: async () => (await getAuthPolicy()).data,
  });
  const providers = useQuery({
    queryKey: ['admin', 'tenant-settings', 'auth-policy', 'providers'],
    queryFn: async () => (await getIdentityProviders()).data.filter((provider) => provider.enabled),
  });
  const changes = useQuery({
    queryKey: ['admin', 'tenant-settings', 'auth-policy', 'changes'],
    queryFn: listTenantAuthPolicyChanges,
    retry: false,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenant-settings', 'auth-policy'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings-overview', 'auth-policy'] }),
    ]);
  };
  const command = useMutation({
    mutationFn: async (action: () => Promise<TenantSettingChangeSet>) => action(),
    onSuccess: async () => {
      await refresh();
      toast.success(t('settingsHome.authPolicyWorkflow.saved'));
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : t('settingsHome.authPolicyWorkflow.error')
      ),
  });
  const latest = changes.data ?? [];
  const currentActor = auth.user?.userId;

  return (
    <Box component="section" aria-labelledby="tenant-auth-policy-workflow-title">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
      >
        <Box>
          <Typography id="tenant-auth-policy-workflow-title" component="h2" variant="h6">
            {t('settingsHome.authPolicyWorkflow.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('settingsHome.authPolicyWorkflow.description')}
          </Typography>
        </Box>
        <ActionButton
          intent="primary"
          size="small"
          startIcon={<FilePenLine size={16} aria-hidden="true" />}
          disabled={!current.data || Boolean(latest.find((change) => ['DRAFT', 'IN_REVIEW', 'APPROVED'].includes(change.lifecycleState)))}
          onClick={() => setDraftOpen(true)}
        >
          {t('settingsHome.authPolicyWorkflow.create')}
        </ActionButton>
      </Stack>

      <InlineFeedback severity="info" sx={{ mt: 1.25 }}>
        {t('settingsHome.authPolicyWorkflow.boundary')}
      </InlineFeedback>
      {changes.isLoading && <Skeleton variant="rounded" height={128} sx={{ mt: 1.25 }} />}
      {changes.isError && (
        <InlineFeedback severity="error" sx={{ mt: 1.25 }}>
          {t('settingsHome.authPolicyWorkflow.error')}
        </InlineFeedback>
      )}
      {!changes.isLoading && !changes.isError && latest.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {t('settingsHome.authPolicyWorkflow.empty')}
        </Typography>
      )}
      <Stack gap={1} sx={{ mt: 1.25 }}>
        {latest.slice(0, 5).map((change) => {
          const canReview = change.lifecycleState === 'IN_REVIEW' && currentActor !== change.requestedBy;
          return (
            <Box
              key={change.changeSetId}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                gap={1}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle2">{change.justification}</Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={lifecycleTone(change.lifecycleState)}
                      label={t(
                        `settingsHome.authPolicyWorkflow.states.${change.lifecycleState}`
                      )}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t('settingsHome.authPolicyWorkflow.impact', {
                        confidence: change.impact.confidence,
                        count: change.impact.populationCount ?? '—',
                      })}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {t('settingsHome.authPolicyWorkflow.meta', {
                      requester: change.requestedBy,
                      date: formatDate(change.createdAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                      version: change.version,
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t('settingsHome.authPolicyWorkflow.coverage', {
                      coverage: change.impact.coverage,
                    })}
                  </Typography>
                </Box>
                <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                  {change.lifecycleState === 'DRAFT' && (
                    <ActionButton
                      size="small"
                      startIcon={<Send size={15} aria-hidden="true" />}
                      loading={command.isPending}
                      onClick={() => command.mutate(() => submitTenantAuthPolicyChange(change))}
                    >
                      {t('settingsHome.authPolicyWorkflow.submit')}
                    </ActionButton>
                  )}
                  {canReview && (
                    <>
                      <ActionButton
                        size="small"
                        startIcon={<Check size={15} aria-hidden="true" />}
                        onClick={() => {
                          setDecisionReason('');
                          setDecision({ change, decision: 'APPROVE' });
                        }}
                      >
                        {t('settingsHome.authPolicyWorkflow.approve')}
                      </ActionButton>
                      <ActionButton
                        size="small"
                        intent="danger"
                        startIcon={<X size={15} aria-hidden="true" />}
                        onClick={() => {
                          setDecisionReason('');
                          setDecision({ change, decision: 'REJECT' });
                        }}
                      >
                        {t('settingsHome.authPolicyWorkflow.reject')}
                      </ActionButton>
                    </>
                  )}
                  {change.lifecycleState === 'APPROVED' && (
                    <ActionButton
                      size="small"
                      intent="primary"
                      startIcon={<Upload size={15} aria-hidden="true" />}
                      loading={command.isPending}
                      onClick={() => command.mutate(() => publishTenantAuthPolicyChange(change))}
                    >
                      {t('settingsHome.authPolicyWorkflow.publish')}
                    </ActionButton>
                  )}
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <AuthPolicyDraftDialog
        open={draftOpen}
        current={current.data ?? null}
        providerKeys={providers.data?.map((provider) => provider.providerKey) ?? []}
        busy={command.isPending}
        onClose={() => setDraftOpen(false)}
        onCreate={async (request) => {
          await command.mutateAsync(() => createTenantAuthPolicyChange(request));
          setDraftOpen(false);
        }}
      />
      <FormDialog
        open={Boolean(decision)}
        title={t(`settingsHome.authPolicyWorkflow.decision.${decision?.decision ?? 'APPROVE'}`)}
        cancelLabel={t('common.cancel')}
        submitLabel={t('common.confirm')}
        busy={command.isPending}
        submitDisabled={decisionReason.trim().length < 10}
        onClose={() => setDecision(null)}
        onSubmit={async () => {
          if (!decision) return;
          await command.mutateAsync(() =>
            decideTenantAuthPolicyChange(decision.change, decision.decision, decisionReason.trim())
          );
          setDecision(null);
        }}
      >
        <FormField
          required
          multiline
          minRows={3}
          label={t('settingsHome.authPolicyWorkflow.decisionReason')}
          value={decisionReason}
          onChange={(event) => setDecisionReason(event.target.value)}
        />
      </FormDialog>
    </Box>
  );
}

function AuthPolicyDraftDialog({
  open,
  current,
  providerKeys,
  busy,
  onClose,
  onCreate,
}: Readonly<{
  open: boolean;
  current: TenantAuthPolicyDraft | null;
  providerKeys: string[];
  busy: boolean;
  onClose: () => void;
  onCreate: (request: { policy: TenantAuthPolicyDraft; justification: string }) => Promise<void>;
}>) {
  const { t } = useTranslation('admin');
  const initial = useMemo<TenantAuthPolicyDraft>(
    () =>
      current ?? {
        defaultLoginType: 'LOCAL',
        allowedLoginTypes: ['LOCAL'],
        localLoginEnabled: true,
        ssoLoginEnabled: false,
        ssoProviderKey: null,
        requireMfa: false,
      },
    [current]
  );
  const [policy, setPolicy] = useState<TenantAuthPolicyDraft>(initial);
  const [justification, setJustification] = useState('');
  const setLogin = (type: 'LOCAL' | 'SSO', enabled: boolean) => {
    const allowed = new Set(policy.allowedLoginTypes);
    if (enabled) allowed.add(type);
    else allowed.delete(type);
    setPolicy((value) => ({
      ...value,
      allowedLoginTypes: Array.from(allowed),
      localLoginEnabled: type === 'LOCAL' ? enabled : value.localLoginEnabled,
      ssoLoginEnabled: type === 'SSO' ? enabled : value.ssoLoginEnabled,
      ssoProviderKey: type === 'SSO' && !enabled ? null : value.ssoProviderKey,
      defaultLoginType:
        value.defaultLoginType === type && !enabled ? (type === 'LOCAL' ? 'SSO' : 'LOCAL') : value.defaultLoginType,
    }));
  };
  return (
    <FormDialog
      open={open}
      title={t('settingsHome.authPolicyWorkflow.draft.title')}
      description={t('settingsHome.authPolicyWorkflow.draft.description')}
      cancelLabel={t('common.cancel')}
      submitLabel={t('settingsHome.authPolicyWorkflow.draft.create')}
      busy={busy}
      submitDisabled={
        justification.trim().length < 10 ||
        policy.allowedLoginTypes.length === 0 ||
        (policy.ssoLoginEnabled && !policy.ssoProviderKey)
      }
      onClose={onClose}
      onSubmit={() => onCreate({ policy, justification: justification.trim() })}
    >
      <Stack gap={2}>
        <InlineFeedback severity="warning">
          {t('settingsHome.authPolicyWorkflow.draft.warning')}
        </InlineFeedback>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <FormControlLabel
            control={
              <Checkbox
                checked={policy.localLoginEnabled}
                onChange={(event) => setLogin('LOCAL', event.target.checked)}
              />
            }
            label={t('settingsHome.authPolicyWorkflow.draft.local')}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={policy.ssoLoginEnabled}
                onChange={(event) => setLogin('SSO', event.target.checked)}
              />
            }
            label={t('settingsHome.authPolicyWorkflow.draft.sso')}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={policy.requireMfa}
                onChange={(event) =>
                  setPolicy((value) => ({ ...value, requireMfa: event.target.checked }))
                }
              />
            }
            label={t('settingsHome.authPolicyWorkflow.draft.mfa')}
          />
        </Stack>
        <SelectField
          label={t('settingsHome.authPolicyWorkflow.draft.defaultLogin')}
          value={policy.defaultLoginType}
          options={policy.allowedLoginTypes.map((value) => ({ value, label: value }))}
          onValueChange={(value) =>
            setPolicy((policyValue) => ({
              ...policyValue,
              defaultLoginType: value as 'LOCAL' | 'SSO',
            }))
          }
        />
        {policy.ssoLoginEnabled && (
          <SelectField
            required
            label={t('settingsHome.authPolicyWorkflow.draft.provider')}
            value={policy.ssoProviderKey ?? ''}
            options={providerKeys.map((value) => ({ value, label: value }))}
            onValueChange={(value) =>
              setPolicy((policyValue) => ({ ...policyValue, ssoProviderKey: String(value) }))
            }
          />
        )}
        <FormField
          required
          multiline
          minRows={3}
          label={t('settingsHome.authPolicyWorkflow.draft.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}
