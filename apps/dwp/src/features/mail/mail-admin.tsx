import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cable,
  CheckCircle2,
  Clock3,
  Database,
  Pencil,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
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

import { MailMetric, MailPageHeading } from './mail-components';

import type {
  MailConnection,
  MailConnectionState,
  MailSharedInbox,
  MailTenantPolicy,
} from '@dwp-frontend/shared-utils';

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
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
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
          <ActionButton
            intent="quiet"
            startIcon={<RefreshCw size={17} />}
            onClick={() => query.refetch()}
          >
            {t('actions.refresh')}
          </ActionButton>
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

export function MailAdminOverview() {
  const { t } = useTranslation('mail');
  const query = useMailAdmin();
  const data = query.data;
  return (
    <MailAdminFrame
      eyebrow={t('admin.overview.eyebrow')}
      title={t('admin.overview.title')}
      description={t('admin.overview.description')}
    >
      {data && (
        <Stack spacing={3}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr 1fr',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              overflow: 'hidden',
              '& > *:not(:last-child)': { borderRight: 1, borderColor: 'divider' },
            }}
          >
            <MailMetric
              label={t('admin.metrics.accounts')}
              value={data.personalAccounts}
              detail={t('admin.metrics.accountsDetail')}
              tone="#176B63"
            />
            <MailMetric
              label={t('admin.metrics.connections')}
              value={data.activeConnections}
              detail={t('admin.metrics.connectionsDetail')}
              tone="#5267A8"
            />
            <MailMetric
              label={t('admin.metrics.shared')}
              value={data.openSharedThreads}
              detail={t('admin.metrics.sharedDetail')}
              tone="#B66A0A"
            />
            <MailMetric
              label={t('admin.metrics.proposals')}
              value={data.pendingAiProposals}
              detail={t('admin.metrics.proposalsDetail')}
              tone="#A73549"
            />
            <MailMetric
              label={t('admin.metrics.delivery')}
              value={data.queuedDeliveries}
              detail={t('admin.metrics.deliveryDetail')}
              tone="#5267A8"
            />
            <MailMetric
              label={t('admin.metrics.failedDelivery')}
              value={data.failedDeliveries}
              detail={t('admin.metrics.failedDeliveryDetail')}
              tone={data.failedDeliveries ? '#A73549' : '#17805F'}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.25fr) minmax(340px, 1fr)' },
              gap: 3,
            }}
          >
            <Box component="section">
              <Typography component="h2" variant="h6" fontWeight={800}>
                {t('admin.overview.connectionHealth')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, mb: 1.25 }}>
                {t('admin.overview.connectionHealthDescription')}
              </Typography>
              <Box
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                }}
              >
                {data.connections.map((connection, index) => (
                  <Box key={connection.connectionId}>
                    {index > 0 && <Divider />}
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2 }}>
                      <Cable size={19} color="var(--dwp-product-accent)" />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography fontWeight={750}>{connection.displayName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t(`provider.${connection.providerType}`)} ·{' '}
                          {connection.authenticationMode}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={connection.state === 'ACTIVE' ? 'success' : 'default'}
                        label={t(`connection.state.${connection.state}`)}
                      />
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box component="section">
              <Typography component="h2" variant="h6" fontWeight={800}>
                {t('admin.overview.controlPosture')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, mb: 1.25 }}>
                {t('admin.overview.controlPostureDescription')}
              </Typography>
              <Box
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                }}
              >
                {[
                  {
                    icon: ShieldCheck,
                    label: t('admin.overview.externalBanner'),
                    active: data.policy.externalSenderBanner,
                  },
                  {
                    icon: Database,
                    label: t('admin.overview.retention', { count: data.policy.retentionDays }),
                    active: true,
                  },
                  {
                    icon: Sparkles,
                    label: t('admin.overview.aiApproval'),
                    active: data.policy.aiAssistanceEnabled && !data.policy.aiAutoExecuteEnabled,
                  },
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <Box key={item.label}>
                      {index > 0 && <Divider />}
                      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 2 }}>
                        <Icon size={18} />
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {item.label}
                        </Typography>
                        <CheckCircle2 size={17} color={item.active ? '#17805F' : '#8A94A3'} />
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Stack>
      )}
    </MailAdminFrame>
  );
}

export function MailAdminConnections() {
  const { t } = useTranslation('mail');
  const query = useMailAdmin();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.MAIL', 'MANAGE');
  const [editing, setEditing] = useState<MailConnection | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [mailDomain, setMailDomain] = useState('');
  const [credentialRef, setCredentialRef] = useState('');
  const [state, setState] = useState<MailConnectionState>('CONFIGURATION_REQUIRED');
  const descriptor = query.data?.providerCatalog.find(
    (provider) => provider.providerType === editing?.providerType
  );
  const mutation = useMutation({
    mutationFn: () =>
      updateMailConnection(editing!.connectionId, {
        displayName: displayName.trim(),
        mailDomain: mailDomain.trim() || null,
        credentialRef: credentialRef.trim() || null,
        state,
        version: editing!.version,
      }),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['mail', 'admin'] });
      toast.success(t('admin.connections.saved'));
    },
    onError: () => toast.error(t('admin.connections.saveError')),
  });

  useEffect(() => {
    if (!editing) return;
    setDisplayName(editing.displayName);
    setMailDomain(editing.mailDomain ?? '');
    setCredentialRef('');
    setState(editing.state);
  }, [editing]);

  return (
    <MailAdminFrame
      eyebrow={t('admin.connections.eyebrow')}
      title={t('admin.connections.title')}
      description={t('admin.connections.description')}
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
                  onClick={() => setEditing(connection)}
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
        submitDisabled={!displayName.trim()}
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
                disabled: descriptor?.runtimeState !== 'AVAILABLE',
              },
              { value: 'SUSPENDED', label: t('connection.state.SUSPENDED') },
            ]}
            onValueChange={(value) => value && setState(value)}
          />
          {descriptor && (
            <Alert severity={descriptor.runtimeState === 'AVAILABLE' ? 'success' : 'info'}>
              {descriptor.runtimeState === 'AVAILABLE'
                ? t('admin.connections.runtimeAvailable', {
                    version: descriptor.adapterVersion ?? '',
                  })
                : t('admin.connections.runtimeRequired')}
            </Alert>
          )}
        </Stack>
      </FormDialog>
    </MailAdminFrame>
  );
}

export function MailAdminSharedInboxes() {
  const { t } = useTranslation('mail');
  const query = useMailAdmin();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.MAIL', 'MANAGE');
  const [editing, setEditing] = useState<MailSharedInbox | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [serviceTargetMinutes, setServiceTargetMinutes] = useState(240);
  const [lifecycleState, setLifecycleState] = useState<MailSharedInbox['lifecycleState']>('ACTIVE');
  const mutation = useMutation({
    mutationFn: () =>
      updateMailSharedInbox(editing!.sharedInboxId, {
        displayName: displayName.trim(),
        purpose: purpose.trim() || null,
        serviceTargetMinutes,
        lifecycleState,
        version: editing!.version,
      }),
    onSuccess: async () => {
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

export function MailAdminPolicies() {
  const { t } = useTranslation('mail');
  const query = useMailAdmin();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.MAIL', 'MANAGE');
  const [policy, setPolicy] = useState<MailTenantPolicy | null>(null);
  useEffect(() => {
    if (query.data?.policy) setPolicy(query.data.policy);
  }, [query.data?.policy]);
  const mutation = useMutation({
    mutationFn: () =>
      updateMailPolicy({
        externalSenderBanner: policy!.externalSenderBanner,
        blockRemoteImages: policy!.blockRemoteImages,
        allowSharedInboxes: policy!.allowSharedInboxes,
        aiAssistanceEnabled: policy!.aiAssistanceEnabled,
        aiCrossAppActionsEnabled: policy!.aiCrossAppActionsEnabled,
        retentionDays: policy!.retentionDays,
        maximumAttachmentMb: policy!.maximumAttachmentMb,
        version: policy!.version,
      }),
    onSuccess: async () => {
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
                    inputProps={{ 'aria-label': label }}
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
