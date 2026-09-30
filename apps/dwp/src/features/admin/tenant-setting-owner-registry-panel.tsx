import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, GitPullRequestArrow, RotateCcw, Settings2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTenantSettingRegistryChange,
  decideTenantSettingRegistryChange,
  listTenantSettingOwners,
  listTenantSettingRegistryChanges,
  publishTenantSettingRegistryChange,
  submitTenantSettingRegistryChange,
  useToast,
  type TenantSettingOwnerDescriptor,
  type TenantSettingRegistryChange,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormDialog, GuidedEmptyState } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  formatTenantSettingValue,
  settingActionLabelKey,
  settingFreshnessLabelKey,
  settingLifecycleLabelKey,
  settingOwnerAdapterLabelKey,
  settingResolutionLabelKey,
  supportsGenericTenantSettingEditor,
} from './tenant-setting-owner-registry-model';

const ownerKey = ['admin', 'tenant-setting-registry', 'owners'] as const;
const changeKey = ['admin', 'tenant-setting-registry', 'changes'] as const;

type Command = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'PUBLISH';

export function TenantSettingOwnerRegistryPanel() {
  const { t } = useTranslation('admin');
  const { t: tAccount } = useTranslation('account');
  const toast = useToast();
  const queryClient = useQueryClient();
  const owners = useQuery({ queryKey: ownerKey, queryFn: listTenantSettingOwners, retry: false });
  const changes = useQuery({
    queryKey: changeKey,
    queryFn: listTenantSettingRegistryChanges,
    retry: false,
  });
  const [createOwner, setCreateOwner] = useState<TenantSettingOwnerDescriptor | null>(null);
  const [desiredState, setDesiredState] = useState<'VALUE' | 'INHERIT'>('VALUE');
  const [value, setValue] = useState('');
  const [justification, setJustification] = useState('');
  const [command, setCommand] = useState<{
    change: TenantSettingRegistryChange;
    action: Command;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ownerKey }),
      queryClient.invalidateQueries({ queryKey: changeKey }),
      queryClient.invalidateQueries({ queryKey: ['account', 'tenant-settings'] }),
    ]);
  };

  const openCreate = (owner: TenantSettingOwnerDescriptor, state: 'VALUE' | 'INHERIT') => {
    if (!supportsGenericTenantSettingEditor(owner)) return;
    setCreateOwner(owner);
    setDesiredState(state);
    setValue(owner.valueType === 'BOOLEAN' ? 'true' : String(owner.defaultValue ?? ''));
    setJustification('');
  };

  const create = async () => {
    if (!createOwner) return;
    setBusy(true);
    try {
      const proposedValue =
        desiredState === 'INHERIT'
          ? undefined
          : createOwner.valueType === 'BOOLEAN'
            ? value === 'true'
            : createOwner.valueType === 'INTEGER'
              ? Number(value)
              : value;
      await createTenantSettingRegistryChange({
        settingKey: createOwner.settingKey,
        desiredState,
        proposedValue,
        justification,
      });
      await refresh();
      setCreateOwner(null);
      toast.success(t('settingRegistry.feedback.draftCreated'));
    } catch {
      toast.error(t('settingRegistry.feedback.commandFailed'));
    } finally {
      setBusy(false);
    }
  };

  const runCommand = async () => {
    if (!command) return;
    setBusy(true);
    try {
      if (command.action === 'SUBMIT') await submitTenantSettingRegistryChange(command.change);
      if (command.action === 'APPROVE' || command.action === 'REJECT') {
        await decideTenantSettingRegistryChange(command.change, command.action, reason);
      }
      if (command.action === 'PUBLISH') await publishTenantSettingRegistryChange(command.change);
      await refresh();
      setCommand(null);
      setReason('');
      toast.success(t('settingRegistry.feedback.commandCompleted'));
    } catch {
      toast.error(t('settingRegistry.feedback.commandFailed'));
    } finally {
      setBusy(false);
    }
  };

  const active = useMemo(
    () =>
      changes.data?.filter(
        (change) => !['REJECTED', 'SUPERSEDED'].includes(change.lifecycleState)
      ) ?? [],
    [changes.data]
  );
  const ownersBySetting = useMemo(
    () => new Map((owners.data ?? []).map((owner) => [owner.settingKey, owner])),
    [owners.data]
  );

  const display = (owner: TenantSettingOwnerDescriptor | undefined, value: unknown): string => {
    return formatTenantSettingValue(owner, value, {
      enabled: t('settingRegistry.values.enabled'),
      disabled: t('settingRegistry.values.disabled'),
      ownerOnly: t('settingRegistry.values.ownerOnly'),
      unavailable: t('settingRegistry.values.unavailable'),
      localLogin: t('settingRegistry.values.login.LOCAL'),
      ssoLogin: t('settingRegistry.values.login.SSO'),
      durationMinutes: (count) => t('settingRegistry.values.durationMinutes', { count }),
    });
  };

  return (
    <Box component="section" aria-labelledby="tenant-setting-registry-title">
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Box>
          <Typography id="tenant-setting-registry-title" component="h2" variant="h6">
            {t('settingRegistry.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('settingRegistry.description')}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          icon={<Settings2 size={14} />}
          label={t('settingRegistry.ownerCount', { count: owners.data?.length ?? 0 })}
        />
      </Stack>

      {owners.isLoading ? (
        <Stack gap={1} sx={{ mt: 1.5 }}>
          <Skeleton variant="rounded" height={112} />
          <Skeleton variant="rounded" height={112} />
        </Stack>
      ) : owners.isError ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {t('settingRegistry.loadError')}
        </Alert>
      ) : (
        <Box
          sx={{
            mt: 1.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.25,
          }}
        >
          {(owners.data ?? []).map((owner) => (
            <Box
              key={owner.settingKey}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
            >
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="h3" variant="subtitle2">
                    {tAccount(owner.localizedLabelKey, {
                      defaultValue: t('settingRegistry.values.registeredSetting'),
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`settingRegistry.owners.${owner.ownerKey}`, {
                      defaultValue: t('settingRegistry.owners.registered'),
                    })}{' '}
                    {t('settingRegistry.ownerVersion', { version: owner.ownerVersion })} ·{' '}
                    {t(`settingRegistry.services.${owner.ownerService}`, {
                      defaultValue: t('settingRegistry.services.registered'),
                    })}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={owner.adapterState === 'CONNECTED' ? 'success' : 'warning'}
                  label={t(settingOwnerAdapterLabelKey(owner.adapterState))}
                />
              </Stack>
              <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.25 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(settingResolutionLabelKey(owner.resolutionStrategy))}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(settingFreshnessLabelKey(owner.freshnessState))}
                />
              </Stack>
              <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                {supportsGenericTenantSettingEditor(owner) &&
                  owner.allowedActions.includes('CREATE_CHANGE') && (
                    <ActionButton
                      intent="secondary"
                      size="small"
                      onClick={() => openCreate(owner, 'VALUE')}
                    >
                      {t('settingRegistry.actions.propose')}
                    </ActionButton>
                  )}
                {supportsGenericTenantSettingEditor(owner) &&
                  owner.allowedActions.includes('RESTORE_INHERITANCE') && (
                    <ActionButton
                      intent="quiet"
                      size="small"
                      startIcon={<RotateCcw size={14} />}
                      onClick={() => openCreate(owner, 'INHERIT')}
                    >
                      {t('settingRegistry.actions.inherit')}
                    </ActionButton>
                  )}
              </Stack>
            </Box>
          ))}
        </Box>
      )}

      <Typography component="h3" variant="subtitle1" sx={{ mt: 2.5 }}>
        {t('settingRegistry.changes.title')}
      </Typography>
      {changes.isLoading ? (
        <Stack gap={1} sx={{ mt: 1 }} aria-label={t('settingRegistry.changes.loading')}>
          <Skeleton variant="rounded" height={96} />
          <Skeleton variant="rounded" height={96} />
        </Stack>
      ) : changes.isError ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {t('settingRegistry.changes.loadError')}
        </Alert>
      ) : active.length === 0 ? (
        <Box sx={{ mt: 1 }}>
          <GuidedEmptyState
            kind="empty"
            title={t('settingRegistry.changes.emptyTitle')}
            description={t('settingRegistry.changes.emptyDescription')}
          />
        </Box>
      ) : (
        <Stack gap={1} sx={{ mt: 1 }}>
          {active.map((change) => {
            const owner = ownersBySetting.get(change.settingKey);
            return (
              <Box
                key={change.changeId}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  gap={1}
                >
                  <Box>
                    <Typography variant="subtitle2">
                      {owner
                        ? tAccount(owner.localizedLabelKey, {
                            defaultValue: t('settingRegistry.values.registeredSetting'),
                          })
                        : t('settingRegistry.values.registeredSetting')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('settingRegistry.changes.preview', {
                        before: display(owner, change.preview.beforeValue),
                        after: display(owner, change.preview.effectiveAfter),
                        count: change.preview.impactedPrincipalCount,
                      })}
                    </Typography>
                  </Box>
                  <Chip size="small" label={t(settingLifecycleLabelKey(change.lifecycleState))} />
                </Stack>
                <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.25 }}>
                  {change.allowedActions.map((action) => (
                    <ActionButton
                      key={action}
                      intent={action === 'REJECT' ? 'quiet' : 'secondary'}
                      size="small"
                      startIcon={
                        action === 'PUBLISH' ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <GitPullRequestArrow size={14} />
                        )
                      }
                      onClick={() => {
                        setCommand({ change, action });
                        setReason('');
                      }}
                    >
                      {t(settingActionLabelKey(action))}
                    </ActionButton>
                  ))}
                </Stack>
                {change.publishReceiptId && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: 'block' }}
                  >
                    {t('settingRegistry.changes.receipt', { receipt: change.publishReceiptId })}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      <FormDialog
        open={Boolean(createOwner)}
        title={t(
          desiredState === 'INHERIT'
            ? 'settingRegistry.create.inheritTitle'
            : 'settingRegistry.create.valueTitle'
        )}
        description={t('settingRegistry.create.description')}
        cancelLabel={t('settingRegistry.actions.cancel')}
        submitLabel={t('settingRegistry.actions.createDraft')}
        busy={busy}
        submitDisabled={
          justification.trim().length < 10 || (desiredState === 'VALUE' && !value.trim())
        }
        onClose={() => setCreateOwner(null)}
        onSubmit={create}
      >
        <Stack gap={2}>
          {desiredState === 'VALUE' && createOwner?.valueType === 'BOOLEAN' ? (
            <TextField
              select
              label={t('settingRegistry.create.value')}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              <MenuItem value="true">{t('settingRegistry.values.enabled')}</MenuItem>
              <MenuItem value="false">{t('settingRegistry.values.disabled')}</MenuItem>
            </TextField>
          ) : desiredState === 'VALUE' ? (
            <TextField
              label={t('settingRegistry.create.value')}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          ) : (
            <Alert severity="info">
              {t('settingRegistry.create.inheritPreview', {
                value: display(createOwner ?? undefined, createOwner?.defaultValue),
              })}
            </Alert>
          )}
          <TextField
            multiline
            minRows={3}
            label={t('settingRegistry.create.justification')}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
          />
        </Stack>
      </FormDialog>

      <FormDialog
        open={Boolean(command)}
        title={t(`settingRegistry.command.${command?.action ?? 'SUBMIT'}.title`)}
        description={t('settingRegistry.command.description')}
        cancelLabel={t('settingRegistry.actions.cancel')}
        submitLabel={t(`settingRegistry.actions.${command?.action ?? 'SUBMIT'}`)}
        busy={busy}
        submitDisabled={Boolean(
          command && ['APPROVE', 'REJECT'].includes(command.action) && reason.trim().length < 10
        )}
        onClose={() => setCommand(null)}
        onSubmit={runCommand}
      >
        <Stack gap={2}>
          {command && (
            <Alert severity={command.action === 'PUBLISH' ? 'warning' : 'info'}>
              {t('settingRegistry.command.preview', {
                before: display(
                  ownersBySetting.get(command.change.settingKey),
                  command.change.preview.beforeValue
                ),
                after: display(
                  ownersBySetting.get(command.change.settingKey),
                  command.change.preview.effectiveAfter
                ),
                count: command.change.preview.impactedPrincipalCount,
              })}
            </Alert>
          )}
          {command && ['APPROVE', 'REJECT'].includes(command.action) && (
            <TextField
              multiline
              minRows={3}
              label={t('settingRegistry.command.reason')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Stack>
      </FormDialog>
    </Box>
  );
}
