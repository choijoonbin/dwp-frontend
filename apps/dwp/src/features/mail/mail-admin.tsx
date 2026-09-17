import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Cable,
  Clock3,
  Pencil,
  RefreshCw,
  Settings2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMailAdminOverview,
  updateMailConnection,
  updateMailPolicy,
  updateMailSharedInbox,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  FormDialog,
  FormField,
  GuidedEmptyState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { MailPageHeading } from './mail-components';
import { resolveMailAdminCommandKey } from './mail-admin-command-key';
import {
  buildMailConnectionReadiness,
  canSetMailConnectionState,
} from './mail-admin-operations-model';

import type {
  MailConnection,
  MailConnectionState,
  MailSharedInbox,
  MailTenantPolicy,
} from '@dwp-frontend/shared-utils';

const MAIL_CONNECTION_ACTIVATION_BLOCKED = 'MAIL_CONNECTION_ACTIVATION_BLOCKED';

function useMailAdmin() {
  return useQuery({
    queryKey: ['mail', 'admin'],
    queryFn: getMailAdminOverview,
    staleTime: 30_000,
    retry: 1,
  });
}

function MailAdminFrame({
  eyebrow,
  title,
  description,
  children,
  onBack,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  onBack?: () => void;
}) {
  const { t } = useTranslation('mail');
  const query = useMailAdmin();
  return (
    <PageCanvas>
      <MailPageHeading
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <Stack direction="row" spacing={1}>
            {onBack ? (
              <ActionButton intent="quiet" startIcon={<ArrowLeft size={17} />} onClick={onBack}>
                {t('actions.back')}
              </ActionButton>
            ) : null}
            <ActionButton
              intent="quiet"
              startIcon={<RefreshCw size={17} />}
              onClick={() => query.refetch()}
            >
              {t('actions.refresh')}
            </ActionButton>
          </Stack>
        }
      />
      {query.isError && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {t('admin.loadError')}
        </Alert>
      )}
      {query.isLoading ? (
        <Stack spacing={2} sx={{ mt: 3 }}>
          <Skeleton variant="rounded" height={140} />
          <Skeleton variant="rounded" height={360} />
        </Stack>
      ) : query.data ? (
        <Box sx={{ mt: 3 }}>{children}</Box>
      ) : null}
    </PageCanvas>
  );
}

export function MailAdminConnections({ onBack }: { onBack?: () => void } = {}) {
  const { t } = useTranslation('mail');
  const query = useMailAdmin();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.MAIL', 'CONNECTION_MANAGE');
  const commandKeys = useRef(new Map<string, string>());
  const activeCommandScope = useRef<string | null>(null);
  const [editing, setEditing] = useState<MailConnection | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [mailDomain, setMailDomain] = useState('');
  const [credentialRef, setCredentialRef] = useState('');
  const [state, setState] = useState<MailConnectionState>('CONFIGURATION_REQUIRED');
  const [readinessNow, setReadinessNow] = useState(() => Date.now());
  const descriptor = query.data?.providerCatalog.find(
    (provider) => provider.providerType === editing?.providerType
  );
  const editingReadiness = useMemo(
    () =>
      editing && query.data
        ? (buildMailConnectionReadiness(query.data, readinessNow).find(
            (candidate) => candidate.connection.connectionId === editing.connectionId
          ) ?? null)
        : null,
    [editing, query.data, readinessNow]
  );
  const requestedStateAllowed = canSetMailConnectionState(state, editingReadiness);
  const mutation = useMutation({
    mutationFn: async () => {
      const executionReadiness =
        editing && query.data
          ? (buildMailConnectionReadiness(query.data, Date.now()).find(
              (candidate) => candidate.connection.connectionId === editing.connectionId
            ) ?? null)
          : null;
      if (!editing || !canSetMailConnectionState(state, executionReadiness)) {
        throw new Error(MAIL_CONNECTION_ACTIVATION_BLOCKED);
      }
      const input = {
        displayName: displayName.trim(),
        mailDomain: mailDomain.trim() || null,
        credentialRef: credentialRef.trim() || null,
        state,
        version: editing.version,
      };
      const scope = `connection:${editing.connectionId}:${JSON.stringify(input)}`;
      activeCommandScope.current = scope;
      return updateMailConnection(editing.connectionId, input, {
        idempotencyKey: resolveMailAdminCommandKey(commandKeys.current, scope),
      });
    },
    onSuccess: async () => {
      if (activeCommandScope.current) commandKeys.current.delete(activeCommandScope.current);
      activeCommandScope.current = null;
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['mail', 'admin'] });
      toast.success(t('admin.connections.saved'));
    },
    onError: (error) =>
      toast.error(
        error instanceof Error && error.message === MAIL_CONNECTION_ACTIVATION_BLOCKED
          ? t('admin.connections.activationBlocked')
          : t('admin.connections.saveError')
      ),
  });

  useEffect(() => {
    if (!editing) return;
    setDisplayName(editing.displayName);
    setMailDomain(editing.mailDomain ?? '');
    setCredentialRef('');
    setState(editing.state);
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const updateReadinessClock = () => setReadinessNow(Date.now());
    updateReadinessClock();
    const interval = window.setInterval(updateReadinessClock, 15_000);
    return () => window.clearInterval(interval);
  }, [editing]);

  return (
    <MailAdminFrame
      eyebrow={t('admin.connections.eyebrow')}
      title={t('admin.connections.title')}
      description={t('admin.connections.description')}
      onBack={onBack}
    >
      {query.data && (
        <Box
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}
        >
          {query.data.connections.map((connection, index) => (
            <Box key={connection.connectionId}>
              {index > 0 && <Divider />}
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                sx={{ p: 2.25 }}
              >
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 1,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'var(--dwp-product-soft)',
                    color: 'var(--dwp-product-accent)',
                  }}
                >
                  <Cable size={20} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                    <Typography fontWeight={800}>{connection.displayName}</Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={connection.state === 'ACTIVE' ? 'success' : 'default'}
                      label={t(`connection.state.${connection.state}`)}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                    {t(`provider.${connection.providerType}`)} · {connection.authenticationMode}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {connection.capabilities
                      .map((value) => t(`capability.${value}`, { defaultValue: value }))
                      .join(' · ')}
                  </Typography>
                  {(() => {
                    const runtime = query.data.providerCatalog.find(
                      (provider) => provider.providerType === connection.providerType
                    );
                    return runtime ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        color={runtime.runtimeState === 'AVAILABLE' ? 'success' : 'warning'}
                        label={t(`connection.runtime.${runtime.runtimeState}`)}
                        sx={{ mt: 0.75 }}
                      />
                    ) : null;
                  })()}
                </Box>
                <ActionButton
                  intent="secondary"
                  disabled={!canManage}
                  onClick={() => {
                    setReadinessNow(Date.now());
                    setEditing(connection);
                  }}
                >
                  {t('admin.connections.configure')}
                </ActionButton>
              </Stack>
            </Box>
          ))}
        </Box>
      )}

      <FormDialog
        open={Boolean(editing)}
        title={t('admin.connections.dialogTitle')}
        description={t('admin.connections.dialogDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        submittingLabel={t('actions.saving')}
        busy={mutation.isPending}
        submitDisabled={!displayName.trim() || !requestedStateAllowed}
        onClose={() => setEditing(null)}
        onSubmit={() => mutation.mutate()}
      >
        <Stack spacing={2}>
          <FormField
            required
            label={t('admin.connections.displayName')}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <FormField
            label={t('admin.connections.domain')}
            value={mailDomain}
            placeholder={t('admin.connections.domainPlaceholder')}
            onChange={(event) => setMailDomain(event.target.value)}
          />
          <FormField
            label={t('admin.connections.credentialRef')}
            value={credentialRef}
            autoComplete="off"
            supportingText={t('admin.connections.credentialRefHelp')}
            onChange={(event) => setCredentialRef(event.target.value)}
          />
          <SelectField<MailConnectionState>
            label={t('admin.connections.state')}
            value={state}
            options={[
              {
                value: 'CONFIGURATION_REQUIRED',
                label: t('connection.state.CONFIGURATION_REQUIRED'),
              },
              {
                value: 'ACTIVE',
                label: t('connection.state.ACTIVE'),
                disabled: editingReadiness?.activationAllowed !== true,
              },
              { value: 'SUSPENDED', label: t('connection.state.SUSPENDED') },
            ]}
            onValueChange={(value) => value && setState(value)}
          />
          {editingReadiness && (
            <Alert severity={editingReadiness.activationAllowed ? 'success' : 'warning'}>
              {editingReadiness.activationAllowed
                ? t('admin.connections.activationReady', {
                    version: descriptor?.adapterVersion ?? '',
                  })
                : t('admin.connections.activationBlocked')}
            </Alert>
          )}
        </Stack>
      </FormDialog>
    </MailAdminFrame>
  );
}

export function MailAdminSharedInboxes({ onBack }: { onBack?: () => void } = {}) {
  const { t } = useTranslation('mail');
  const query = useMailAdmin();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.MAIL', 'SHARED_INBOX_MANAGE');
  const commandKeys = useRef(new Map<string, string>());
  const activeCommandScope = useRef<string | null>(null);
  const [editing, setEditing] = useState<MailSharedInbox | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [serviceTargetMinutes, setServiceTargetMinutes] = useState(240);
  const [lifecycleState, setLifecycleState] = useState<MailSharedInbox['lifecycleState']>('ACTIVE');
  const mutation = useMutation({
    mutationFn: () => {
      const input = {
        displayName: displayName.trim(),
        purpose: purpose.trim() || null,
        serviceTargetMinutes,
        lifecycleState,
        version: editing!.version,
      };
      const scope = `shared-inbox:${editing!.sharedInboxId}:${JSON.stringify(input)}`;
      activeCommandScope.current = scope;
      return updateMailSharedInbox(editing!.sharedInboxId, input, {
        idempotencyKey: resolveMailAdminCommandKey(commandKeys.current, scope),
      });
    },
    onSuccess: async () => {
      if (activeCommandScope.current) commandKeys.current.delete(activeCommandScope.current);
      activeCommandScope.current = null;
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['mail', 'admin'] });
      toast.success(t('admin.shared.saved'));
    },
    onError: () => toast.error(t('admin.shared.saveError')),
  });

  useEffect(() => {
    if (!editing) return;
    setDisplayName(editing.displayName);
    setPurpose(editing.purpose ?? '');
    setServiceTargetMinutes(editing.serviceTargetMinutes);
    setLifecycleState(editing.lifecycleState);
  }, [editing]);

  return (
    <MailAdminFrame
      eyebrow={t('admin.shared.eyebrow')}
      title={t('admin.shared.title')}
      description={t('admin.shared.description')}
      onBack={onBack}
    >
      {query.data?.sharedInboxes.length ? (
        <Box
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}
        >
          {query.data.sharedInboxes.map((inbox, index) => (
            <Box key={inbox.sharedInboxId}>
              {index > 0 && <Divider />}
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                sx={{ p: 2.25 }}
              >
                <UsersRound size={21} color="var(--dwp-product-accent)" />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={800}>{inbox.displayName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {inbox.address}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {inbox.purpose}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={2.5}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('admin.shared.open')}
                    </Typography>
                    <Typography variant="h6" fontWeight={800}>
                      {inbox.openCount}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('admin.shared.overdue')}
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      color={inbox.overdueCount ? 'error.main' : 'text.primary'}
                    >
                      {inbox.overdueCount}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('admin.shared.target')}
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Clock3 size={14} />
                      <Typography variant="body2" fontWeight={750}>
                        {t('admin.shared.minutes', { count: inbox.serviceTargetMinutes })}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
                <ActionButton
                  intent="secondary"
                  startIcon={<Pencil size={16} />}
                  disabled={!canManage}
                  onClick={() => setEditing(inbox)}
                >
                  {t('admin.shared.configure')}
                </ActionButton>
              </Stack>
            </Box>
          ))}
        </Box>
      ) : (
        <GuidedEmptyState
          kind="first-use"
          title={t('admin.shared.emptyTitle')}
          description={t('admin.shared.emptyDescription')}
        />
      )}

      <FormDialog
        open={Boolean(editing)}
        title={t('admin.shared.dialogTitle')}
        description={t('admin.shared.dialogDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        submittingLabel={t('actions.saving')}
        busy={mutation.isPending}
        submitDisabled={!displayName.trim() || serviceTargetMinutes < 15}
        onClose={() => setEditing(null)}
        onSubmit={() => mutation.mutate()}
      >
        <Stack spacing={2}>
          <FormField
            required
            label={t('admin.shared.displayName')}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <FormField
            multiline
            minRows={3}
            label={t('admin.shared.purpose')}
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          />
          <FormField
            required
            type="number"
            label={t('admin.shared.serviceTarget')}
            value={serviceTargetMinutes}
            inputProps={{ min: 15, max: 10080 }}
            onChange={(event) => setServiceTargetMinutes(Number(event.target.value))}
          />
          <SelectField<MailSharedInbox['lifecycleState']>
            label={t('admin.shared.state')}
            value={lifecycleState}
            options={[
              { value: 'ACTIVE', label: t('admin.shared.stateActive') },
              { value: 'ARCHIVED', label: t('admin.shared.stateArchived') },
            ]}
            onValueChange={(value) => value && setLifecycleState(value)}
          />
        </Stack>
      </FormDialog>
    </MailAdminFrame>
  );
}

export function MailAdminPolicies({ onBack }: { onBack?: () => void } = {}) {
  const { t } = useTranslation('mail');
  const query = useMailAdmin();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.MAIL', 'POLICY_MANAGE');
  const commandKeys = useRef(new Map<string, string>());
  const activeCommandScope = useRef<string | null>(null);
  const [policy, setPolicy] = useState<MailTenantPolicy | null>(null);
  useEffect(() => {
    if (query.data?.policy) setPolicy(query.data.policy);
  }, [query.data?.policy]);
  const mutation = useMutation({
    mutationFn: () => {
      const input = {
        externalSenderBanner: policy!.externalSenderBanner,
        blockRemoteImages: policy!.blockRemoteImages,
        allowSharedInboxes: policy!.allowSharedInboxes,
        aiAssistanceEnabled: policy!.aiAssistanceEnabled,
        aiCrossAppActionsEnabled: policy!.aiCrossAppActionsEnabled,
        retentionDays: policy!.retentionDays,
        maximumAttachmentMb: policy!.maximumAttachmentMb,
        version: policy!.version,
      };
      const scope = `policy:${JSON.stringify(input)}`;
      activeCommandScope.current = scope;
      return updateMailPolicy(input, {
        idempotencyKey: resolveMailAdminCommandKey(commandKeys.current, scope),
      });
    },
    onSuccess: async () => {
      if (activeCommandScope.current) commandKeys.current.delete(activeCommandScope.current);
      activeCommandScope.current = null;
      await queryClient.invalidateQueries({ queryKey: ['mail', 'admin'] });
      toast.success(t('admin.policies.saved'));
    },
    onError: () => toast.error(t('admin.policies.saveError')),
  });
  const switches = useMemo(
    () =>
      policy
        ? ([
            [
              'externalSenderBanner',
              t('admin.policies.externalBanner'),
              t('admin.policies.externalBannerDescription'),
            ],
            [
              'blockRemoteImages',
              t('admin.policies.remoteImages'),
              t('admin.policies.remoteImagesDescription'),
            ],
            [
              'allowSharedInboxes',
              t('admin.policies.sharedInboxes'),
              t('admin.policies.sharedInboxesDescription'),
            ],
            [
              'aiAssistanceEnabled',
              t('admin.policies.aiAssistance'),
              t('admin.policies.aiAssistanceDescription'),
            ],
            [
              'aiCrossAppActionsEnabled',
              t('admin.policies.crossApp'),
              t('admin.policies.crossAppDescription'),
            ],
          ] as const)
        : [],
    [policy, t]
  );

  return (
    <MailAdminFrame
      eyebrow={t('admin.policies.eyebrow')}
      title={t('admin.policies.title')}
      description={t('admin.policies.description')}
      onBack={onBack}
    >
      {policy && (
        <Stack spacing={2.5}>
          <Box
            sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}
          >
            {switches.map(([key, label, description], index) => (
              <Box key={key}>
                {index > 0 && <Divider />}
                <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 2.25 }}>
                  <Settings2 size={18} color="var(--dwp-product-accent)" />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={750}>
                      {label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {description}
                    </Typography>
                  </Box>
                  <Switch
                    checked={policy[key]}
                    disabled={!canManage}
                    slotProps={{ input: { 'aria-label': label } }}
                    onChange={(_event, checked) => setPolicy({ ...policy, [key]: checked })}
                  />
                </Stack>
              </Box>
            ))}
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            <FormField
              type="number"
              label={t('admin.policies.retentionDays')}
              value={policy.retentionDays}
              disabled={!canManage}
              inputProps={{ min: 30, max: 3650 }}
              onChange={(event) =>
                setPolicy({ ...policy, retentionDays: Number(event.target.value) })
              }
            />
            <FormField
              type="number"
              label={t('admin.policies.attachmentMb')}
              value={policy.maximumAttachmentMb}
              disabled={!canManage}
              inputProps={{ min: 1, max: 150 }}
              onChange={(event) =>
                setPolicy({ ...policy, maximumAttachmentMb: Number(event.target.value) })
              }
            />
          </Box>
          <Alert severity="info" icon={<ShieldCheck size={19} />}>
            {t('admin.policies.humanApproval')}
          </Alert>
          <Stack direction="row" justifyContent="flex-end">
            <ActionButton
              intent="primary"
              disabled={!canManage || mutation.isPending}
              loading={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {t('actions.save')}
            </ActionButton>
          </Stack>
        </Stack>
      )}
    </MailAdminFrame>
  );
}
