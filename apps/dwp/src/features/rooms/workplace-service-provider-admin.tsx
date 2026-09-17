import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Link2, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createWorkplaceIdempotencyKey,
  createWorkplaceServiceProvider,
  resolveIdempotentMutationIntent,
  setWorkplaceServiceProviderState,
  updateWorkplaceServiceProvider,
  useProductSurfaceAuthority,
  verifyWorkplaceServiceProvider,
  getWorkplaceServiceProviders,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { requireWorkplaceServiceWrite } from './workplace-services-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceServiceProvider,
  WorkplaceServiceProviderSupport,
} from '@dwp-frontend/shared-utils';

type FormState = Readonly<{
  providerCode: string;
  displayNameKo: string;
  displayNameEn: string;
  adapterType: string;
  siteScope: readonly string[];
  capabilities: readonly string[];
  support: WorkplaceServiceProviderSupport;
  credentialBindingReference: string;
  clearCredentialBinding: boolean;
  reason: string;
}>;

const emptyForm: FormState = {
  providerCode: '',
  displayNameKo: '',
  displayNameEn: '',
  adapterType: 'DWP_NATIVE',
  siteScope: [],
  capabilities: [],
  support: {},
  credentialBindingReference: '',
  clearCredentialBinding: false,
  reason: '',
};
const providerTokenPattern = /^[A-Za-z0-9._-]{1,80}$/u;
const siteIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function formFromProvider(provider: WorkplaceServiceProvider): FormState {
  return {
    providerCode: provider.providerCode,
    displayNameKo: provider.displayNameKo,
    displayNameEn: provider.displayNameEn,
    adapterType: provider.adapterType,
    siteScope: provider.siteScope,
    capabilities: provider.capabilities,
    support: provider.support,
    credentialBindingReference: '',
    clearCredentialBinding: false,
    reason: '',
  };
}

function csv(value: string) {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function ProviderEditor({
  provider,
  onSaved,
}: {
  provider: WorkplaceServiceProvider | null;
  onSaved: (provider: WorkplaceServiceProvider) => void;
}) {
  const { t } = useTranslation('rooms');
  const authority = useProductSurfaceAuthority();
  const capabilities = useRoomsCapabilities();
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const [form, setForm] = useState<FormState>(provider ? formFromProvider(provider) : emptyForm);
  const intentRef = useRef<IdempotentMutationIntent | null>(null);
  useEffect(() => {
    setForm(provider ? formFromProvider(provider) : emptyForm);
    intentRef.current = null;
  }, [provider]);
  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const writable = capabilities.canManageWorkplaceAdmin && elevated;
  const valid = Boolean(
    providerTokenPattern.test(form.providerCode.trim()) &&
    form.displayNameKo.trim() &&
    form.displayNameEn.trim() &&
    providerTokenPattern.test(form.adapterType.trim()) &&
    form.reason.trim() &&
    form.siteScope.length <= 100 &&
    form.siteScope.every((value) => siteIdPattern.test(value)) &&
    form.capabilities.length <= 100 &&
    form.capabilities.every((value) => /^[A-Z][A-Z0-9_]{1,79}$/u.test(value))
  );
  const mutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(writable && valid);
      const common = {
        displayNameKo: form.displayNameKo.trim(),
        displayNameEn: form.displayNameEn.trim(),
        adapterType: form.adapterType.trim(),
        siteScope: form.siteScope,
        capabilities: form.capabilities,
        support: form.support,
        credentialBindingReference: form.credentialBindingReference.trim() || null,
        explicitConfirmation: true as const,
        reason: form.reason.trim(),
      };
      if (provider) {
        const payload = {
          ...common,
          expectedVersion: provider.version,
          clearCredentialBinding: form.clearCredentialBinding,
        };
        const intent = resolveIdempotentMutationIntent(intentRef.current, payload, () =>
          createWorkplaceIdempotencyKey('service-provider-update')
        );
        intentRef.current = intent;
        return updateWorkplaceServiceProvider(provider.providerProfileId, payload, {
          idempotencyKey: intent.key,
          activeAccessMode: 'ELEVATED',
        });
      }
      const input = { ...common, providerCode: form.providerCode.trim() };
      const intent = resolveIdempotentMutationIntent(intentRef.current, input, () =>
        createWorkplaceIdempotencyKey('service-provider-create')
      );
      intentRef.current = intent;
      return createWorkplaceServiceProvider(input, {
        idempotencyKey: intent.key,
        activeAccessMode: 'ELEVATED',
      });
    },
    retry: false,
    onSuccess: (saved) => {
      intentRef.current = null;
      onSaved(saved.provider);
    },
  });
  return (
    <Stack spacing={1.25} data-testid="workplace-service-provider-editor">
      {!elevated && capabilities.canManageWorkplaceAdmin ? (
        <InlineFeedback severity="warning" icon={<ShieldCheck size={17} />}>
          {t('workplace.services.stepUpRequired')}
        </InlineFeedback>
      ) : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
        <FormField
          label={t('workplace.services.extensions.providerCode')}
          value={form.providerCode}
          disabled={!writable || Boolean(provider) || mutation.isPending}
          inputProps={{ maxLength: 80 }}
          onChange={(event) => patch('providerCode', event.target.value.toUpperCase())}
        />
        <FormField
          label={t('workplace.services.extensions.providerNameKo')}
          value={form.displayNameKo}
          disabled={!writable || mutation.isPending}
          inputProps={{ maxLength: 160 }}
          onChange={(event) => patch('displayNameKo', event.target.value)}
        />
        <FormField
          label={t('workplace.services.extensions.providerNameEn')}
          value={form.displayNameEn}
          disabled={!writable || mutation.isPending}
          inputProps={{ maxLength: 160 }}
          onChange={(event) => patch('displayNameEn', event.target.value)}
        />
        <FormField
          label={t('workplace.services.extensions.providerAdapterType')}
          value={form.adapterType}
          disabled={!writable || mutation.isPending}
          inputProps={{ maxLength: 80 }}
          onChange={(event) => patch('adapterType', event.target.value.toUpperCase())}
        />
        <FormField
          label={t('workplace.services.extensions.providerSites')}
          value={form.siteScope.join(', ')}
          disabled={!writable || mutation.isPending}
          supportingText={t('workplace.services.extensions.commaSeparated')}
          onChange={(event) => patch('siteScope', csv(event.target.value))}
        />
        <FormField
          label={t('workplace.services.extensions.providerCapabilities')}
          value={form.capabilities.join(', ')}
          disabled={!writable || mutation.isPending}
          supportingText={t('workplace.services.extensions.commaSeparated')}
          onChange={(event) => patch('capabilities', csv(event.target.value))}
        />
        <SelectField
          label={t('workplace.services.extensions.supportChannel')}
          value={typeof form.support.channel === 'string' ? form.support.channel : ''}
          disabled={!writable || mutation.isPending}
          options={[
            { value: '', label: t('workplace.services.extensions.noSupportChannel') },
            ...(['EMAIL', 'PHONE', 'WEB', 'IN_APP'] as const).map((value) => ({
              value,
              label: t(`workplace.services.extensions.supportChannels.${value}`),
            })),
          ]}
          onValueChange={(value) =>
            patch(
              'support',
              value
                ? {
                    labelKo: typeof form.support.labelKo === 'string' ? form.support.labelKo : '',
                    labelEn: typeof form.support.labelEn === 'string' ? form.support.labelEn : '',
                    channel: value as 'EMAIL' | 'PHONE' | 'WEB' | 'IN_APP',
                    contactUri:
                      typeof form.support.contactUri === 'string' ? form.support.contactUri : null,
                    hoursKo: typeof form.support.hoursKo === 'string' ? form.support.hoursKo : null,
                    hoursEn: typeof form.support.hoursEn === 'string' ? form.support.hoursEn : null,
                  }
                : {}
            )
          }
        />
      </Box>
      {form.support.channel ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
          <FormField
            label={t('workplace.services.extensions.supportLabelKo')}
            value={typeof form.support.labelKo === 'string' ? form.support.labelKo : ''}
            disabled={!writable || mutation.isPending}
            onChange={(event) => patch('support', { ...form.support, labelKo: event.target.value })}
          />
          <FormField
            label={t('workplace.services.extensions.supportLabelEn')}
            value={typeof form.support.labelEn === 'string' ? form.support.labelEn : ''}
            disabled={!writable || mutation.isPending}
            onChange={(event) => patch('support', { ...form.support, labelEn: event.target.value })}
          />
          <FormField
            label={t('workplace.services.extensions.supportContact')}
            value={typeof form.support.contactUri === 'string' ? form.support.contactUri : ''}
            disabled={!writable || mutation.isPending}
            onChange={(event) =>
              patch('support', { ...form.support, contactUri: event.target.value || null })
            }
          />
          <FormField
            label={t('workplace.services.extensions.supportHoursKo')}
            value={typeof form.support.hoursKo === 'string' ? form.support.hoursKo : ''}
            disabled={!writable || mutation.isPending}
            onChange={(event) =>
              patch('support', { ...form.support, hoursKo: event.target.value || null })
            }
          />
          <FormField
            label={t('workplace.services.extensions.supportHoursEn')}
            value={typeof form.support.hoursEn === 'string' ? form.support.hoursEn : ''}
            disabled={!writable || mutation.isPending}
            onChange={(event) =>
              patch('support', { ...form.support, hoursEn: event.target.value || null })
            }
          />
        </Box>
      ) : null}
      <FormField
        label={t('workplace.services.extensions.credentialBindingReference')}
        value={form.credentialBindingReference}
        disabled={!writable || mutation.isPending || form.clearCredentialBinding}
        inputProps={{ maxLength: 320, autoComplete: 'off' }}
        supportingText={t('workplace.services.extensions.credentialBindingReferenceHelp')}
        onChange={(event) => patch('credentialBindingReference', event.target.value)}
      />
      {provider ? (
        <FormControlLabel
          control={
            <Checkbox
              checked={form.clearCredentialBinding}
              disabled={!writable || mutation.isPending}
              onChange={(event) => patch('clearCredentialBinding', event.target.checked)}
            />
          }
          label={t('workplace.services.extensions.clearCredentialBinding')}
        />
      ) : null}
      <FormField
        label={t('workplace.services.changeReason')}
        value={form.reason}
        disabled={!writable || mutation.isPending}
        inputProps={{ maxLength: 500 }}
        onChange={(event) => patch('reason', event.target.value)}
      />
      {mutation.isError ? (
        <InlineFeedback severity="error">{t('workplace.services.commandError')}</InlineFeedback>
      ) : null}
      <ActionButton
        intent="primary"
        loading={mutation.isPending}
        disabled={!writable || !valid}
        onClick={() => mutation.mutate()}
      >
        {t('actions.save')}
      </ActionButton>
    </Stack>
  );
}

export default function WorkplaceServiceProviderAdminPage() {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const korean = locale === 'ko';
  const capabilities = useRoomsCapabilities();
  const authority = useProductSurfaceAuthority();
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<WorkplaceServiceProvider | null>(null);
  const query = useQuery({
    queryKey: ['workplace', 'services', 'providers'],
    queryFn: getWorkplaceServiceProviders,
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    retry: false,
  });
  const providers = query.data?.items ?? [];
  const lifecycleMutation = useMutation({
    mutationFn: (provider: WorkplaceServiceProvider) =>
      setWorkplaceServiceProviderState(
        provider.providerProfileId,
        {
          expectedVersion: provider.version,
          lifecycleState: provider.lifecycleState === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
          reason: t('workplace.services.extensions.providerLifecycleReason'),
          explicitConfirmation: true,
        },
        {
          idempotencyKey: createWorkplaceIdempotencyKey('service-provider-state'),
          activeAccessMode: 'ELEVATED',
        }
      ),
    onSuccess: (result) => {
      setSelected((current) =>
        current?.providerProfileId === result.provider.providerProfileId ? result.provider : current
      );
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services', 'providers'] });
    },
  });
  const verifyMutation = useMutation({
    mutationFn: (provider: WorkplaceServiceProvider) =>
      verifyWorkplaceServiceProvider(
        provider.providerProfileId,
        {
          expectedVersion: provider.version,
          reason: t('workplace.services.extensions.providerVerifyReason'),
          explicitConfirmation: true,
        },
        {
          idempotencyKey: createWorkplaceIdempotencyKey('service-provider-verify'),
          activeAccessMode: 'ELEVATED',
        }
      ),
    onSuccess: (result) => {
      setSelected((current) =>
        current?.providerProfileId === result.provider.providerProfileId ? result.provider : current
      );
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services', 'providers'] });
    },
  });

  return (
    <Box
      data-testid="workplace-service-provider-admin"
      sx={{ maxWidth: 1440, mx: 'auto', p: { xs: 2, md: 3 } }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        gap={2}
        mb={2.5}
      >
        <Box>
          <Typography variant="overline" color="primary.main">
            {t('workplace.services.adminEyebrow')}
          </Typography>
          <Typography component="h1" variant="h4" fontWeight="fontWeightBold">
            {t('workplace.services.extensions.providersTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('workplace.services.extensions.providersDescription')}
          </Typography>
        </Box>
        <ActionButton
          intent="primary"
          startIcon={<Plus size={16} />}
          onClick={() => setSelected(null)}
        >
          {t('workplace.services.extensions.newProvider')}
        </ActionButton>
      </Stack>
      {!capabilities.isLoaded || query.isLoading ? (
        <Typography color="text.secondary">{t('workplace.services.loading')}</Typography>
      ) : !capabilities.canViewWorkplaceAdmin ? (
        <InlineFeedback severity="warning">{t('workplace.services.adminDenied')}</InlineFeedback>
      ) : query.isError ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton
              intent="quiet"
              startIcon={<RefreshCw size={16} />}
              onClick={() => void query.refetch()}
            >
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.services.extensions.providersError')}
        </InlineFeedback>
      ) : !providers.length ? (
        <EmptyState title={t('workplace.services.extensions.providersEmpty')} />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, .8fr) minmax(0, 1.2fr)' },
            gap: 2,
          }}
        >
          <Stack component="ul" spacing={1} sx={{ p: 0, m: 0 }}>
            {providers.map((provider) => (
              <Box
                component="li"
                key={provider.providerProfileId}
                sx={(theme) => ({
                  ...workplaceMemberSoftSurface(theme),
                  listStyle: 'none',
                  p: 1.5,
                })}
              >
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box minWidth={0}>
                    <Typography component="h2" variant="subtitle2" fontWeight="fontWeightBold">
                      {korean ? provider.displayNameKo : provider.displayNameEn}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {provider.providerCode}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    color={provider.readiness === 'READY' ? 'success' : 'warning'}
                    label={t(`workplace.services.providerStates.${provider.readiness}`)}
                  />
                </Stack>
                {provider.support.channel ? (
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    <Link2 size={14} aria-hidden="true" />{' '}
                    {korean
                      ? (provider.support.labelKo ?? provider.displayNameKo)
                      : (provider.support.labelEn ?? provider.displayNameEn)}
                  </Typography>
                ) : null}
                <Stack direction="row" gap={0.75} flexWrap="wrap" mt={1}>
                  <ActionButton size="small" intent="quiet" onClick={() => setSelected(provider)}>
                    {t('actions.edit')}
                  </ActionButton>
                  <ActionButton
                    size="small"
                    intent="secondary"
                    startIcon={<BadgeCheck size={15} />}
                    disabled={
                      !elevated ||
                      verifyMutation.isPending ||
                      provider.lifecycleState !== 'ACTIVE' ||
                      !provider.credentialBindingConfigured
                    }
                    onClick={() => verifyMutation.mutate(provider)}
                  >
                    {t('workplace.services.extensions.verifyProvider')}
                  </ActionButton>
                  <ActionButton
                    size="small"
                    intent={provider.lifecycleState === 'ACTIVE' ? 'danger' : 'secondary'}
                    disabled={
                      !elevated ||
                      lifecycleMutation.isPending ||
                      provider.lifecycleState === 'RETIRED' ||
                      (provider.lifecycleState !== 'ACTIVE' &&
                        !provider.credentialBindingConfigured)
                    }
                    onClick={() => lifecycleMutation.mutate(provider)}
                  >
                    {provider.lifecycleState === 'ACTIVE'
                      ? t('workplace.services.catalog.deactivate')
                      : t('workplace.services.catalog.activate')}
                  </ActionButton>
                </Stack>
              </Box>
            ))}
          </Stack>
          <Box component="aside" sx={(theme) => ({ ...workplaceMemberCard(theme), p: 2 })}>
            <ProviderEditor
              provider={selected}
              onSaved={(saved) => {
                setSelected(saved);
                void queryClient.invalidateQueries({
                  queryKey: ['workplace', 'services', 'providers'],
                });
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
