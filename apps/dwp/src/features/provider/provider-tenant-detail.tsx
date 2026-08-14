import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Globe2,
  KeyRound,
  Layers3,
  PackageCheck,
  PauseCircle,
  PlayCircle,
  Plus,
  Send,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProviderTenantDomain,
  getProviderDomainChallenge,
  getProviderOperatorProfile,
  getProviderTenant,
  issueProviderAdministratorInvitation,
  listProviderEntitlements,
  listProviderSupportSessions,
  replaceProviderTenantEntitlements,
  updateProviderTenantLifecycle,
  useToast,
  verifyProviderTenantDomain,
} from '@dwp-frontend/shared-utils';
import { LiveStatus, OperationalContextBar, SignalMetric } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type {
  ProviderAdministratorInvitation,
  ProviderDomainChallenge,
  ProviderTenant,
  ProviderTenantDomain,
} from '@dwp-frontend/shared-utils';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0, py: 1.25 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="div" variant="body2" sx={{ mt: 0.25, wordBreak: 'break-word' }}>
        {value || '-'}
      </Typography>
    </Box>
  );
}

function LifecycleDialog({
  tenant,
  busy,
  onClose,
  onSubmit,
}: {
  tenant: ProviderTenant;
  busy: boolean;
  onClose: () => void;
  onSubmit: (state: 'ACTIVE' | 'SUSPENDED', justification: string) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const nextState = tenant.lifecycleState === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  const [justification, setJustification] = useState('');
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t(`tenantDetail.lifecycle.${nextState}.title`)}</DialogTitle>
      <DialogContent dividers>
        <TextField
          autoFocus
          required
          fullWidth
          multiline
          minRows={3}
          label={t('fields.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          color={nextState === 'SUSPENDED' ? 'warning' : 'primary'}
          disabled={busy || !justification.trim()}
          onClick={() => void onSubmit(nextState, justification.trim())}
        >
          {t(`tenantDetail.lifecycle.${nextState}.action`)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CreateDomainDialog({
  busy,
  onClose,
  onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (request: {
    domainName: string;
    domainType: string;
    primaryDomain: boolean;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [domainName, setDomainName] = useState('');
  const [domainType, setDomainType] = useState('LOGIN');
  const [primaryDomain, setPrimaryDomain] = useState(false);
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('tenantDetail.domains.createTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2}>
          <TextField
            autoFocus
            required
            fullWidth
            label={t('fields.domain')}
            value={domainName}
            onChange={(event) => setDomainName(event.target.value.toLowerCase())}
          />
          <TextField
            select
            fullWidth
            label={t('fields.domainType')}
            value={domainType}
            onChange={(event) => setDomainType(event.target.value)}
          >
            {['LOGIN', 'EMAIL', 'CUSTOM'].map((value) => (
              <MenuItem key={value} value={value}>
                {t(`domainTypes.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Checkbox
                checked={primaryDomain}
                onChange={(event) => setPrimaryDomain(event.target.checked)}
              />
            }
            label={t('tenantDetail.domains.primary')}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={busy || !domainName.includes('.')}
          onClick={() => void onCreate({ domainName, domainType, primaryDomain })}
        >
          {t('actions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DomainChallengeDialog({
  challenge,
  busy,
  onClose,
  onVerify,
}: {
  challenge: ProviderDomainChallenge;
  busy: boolean;
  onClose: () => void;
  onVerify: (domain: ProviderTenantDomain, justification: string) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const [justification, setJustification] = useState('');
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t('actions.copied'));
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('tenantDetail.domains.challengeTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2}>
          <Alert severity="info">{t('tenantDetail.domains.challengeNotice')}</Alert>
          {[
            [t('tenantDetail.domains.recordType'), challenge.recordType],
            [t('tenantDetail.domains.recordName'), challenge.recordName],
            [t('tenantDetail.domains.recordValue'), challenge.recordValue],
          ].map(([label, value]) => (
            <Stack key={label} direction="row" alignItems="center" gap={1}>
              <TextField
                fullWidth
                label={label}
                value={value}
                slotProps={{ input: { readOnly: true } }}
              />
              <Button
                variant="outlined"
                aria-label={t('actions.copy')}
                onClick={() => void copy(value)}
                sx={{ minWidth: 40, width: 40, height: 40, p: 0 }}
              >
                <Copy size={17} />
              </Button>
            </Stack>
          ))}
          {challenge.domain.verificationState !== 'VERIFIED' && (
            <TextField
              required
              multiline
              minRows={2}
              label={t('fields.justification')}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.close')}</Button>
        {challenge.domain.verificationState !== 'VERIFIED' && (
          <Button
            variant="contained"
            startIcon={<CheckCircle2 size={17} />}
            disabled={busy || !justification.trim()}
            onClick={() => void onVerify(challenge.domain, justification.trim())}
          >
            {t('tenantDetail.domains.verify')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function InvitationDialog({
  invitation,
  onClose,
}: {
  invitation: ProviderAdministratorInvitation;
  onClose: () => void;
}) {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const activationUrl = `${window.location.origin}${invitation.activationPath}`;
  const copy = async () => {
    await navigator.clipboard.writeText(activationUrl);
    toast.success(t('actions.copied'));
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('tenantDetail.administrators.invitationTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2}>
          <Alert severity="info">{t('tenantDetail.administrators.invitationOnce')}</Alert>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label={t('tenantDetail.administrators.activationLink')}
            value={activationUrl}
            slotProps={{ input: { readOnly: true } }}
          />
          <Typography variant="body2" color="text.secondary">
            {t('tenantDetail.administrators.expires', {
              value: formatProviderDate(invitation.expiresAt),
            })}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.close')}</Button>
        <Button variant="contained" startIcon={<Copy size={17} />} onClick={() => void copy()}>
          {t('actions.copy')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ProviderTenantDetail({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation('provider');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const tenantTabs = ['overview', 'services', 'access', 'entitlements', 'support'] as const;
  const requestedTab = searchParams.get('tab');
  const tab = Math.max(0, tenantTabs.indexOf(requestedTab as (typeof tenantTabs)[number]));
  const selectTab = (next: number) => {
    const params = new URLSearchParams(searchParams);
    if (next === 0) params.delete('tab');
    else params.set('tab', tenantTabs[next]);
    setSearchParams(params, { replace: true });
  };
  const [busy, setBusy] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const [challenge, setChallenge] = useState<ProviderDomainChallenge | null>(null);
  const [invitation, setInvitation] = useState<ProviderAdministratorInvitation | null>(null);
  const [selectedEntitlements, setSelectedEntitlements] = useState<Set<string>>(new Set());
  const [entitlementReason, setEntitlementReason] = useState('');

  const tenant = useQuery({
    queryKey: ['provider', 'tenant', tenantId],
    queryFn: () => getProviderTenant(tenantId),
  });
  const catalog = useQuery({
    queryKey: ['provider', 'entitlements'],
    queryFn: listProviderEntitlements,
  });
  const sessions = useQuery({
    queryKey: ['provider', 'support', tenantId],
    queryFn: () => listProviderSupportSessions(tenantId),
  });
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });

  useEffect(() => {
    if (tenant.data) {
      setSelectedEntitlements(
        new Set(tenant.data.entitlements.map((entitlement) => entitlement.entitlementKey))
      );
    }
  }, [tenant.data]);

  const permissions = operator.data?.permissions ?? [];
  const canWrite = permissions.includes('TENANT_WRITE');
  const canWriteEntitlements = permissions.includes('ENTITLEMENT_WRITE');
  const canSupport = permissions.includes('SUPPORT_SESSION_WRITE');
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['provider'] });
  };
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await operation();
      await invalidate();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const lifecycle = async (state: 'ACTIVE' | 'SUSPENDED', justification: string) => {
    if (!tenant.data) return;
    if (
      await run(
        () => updateProviderTenantLifecycle(tenant.data, state, justification),
        t('tenantDetail.lifecycle.updated')
      )
    )
      setLifecycleOpen(false);
  };
  const createDomain = async (request: {
    domainName: string;
    domainType: string;
    primaryDomain: boolean;
  }) => {
    setBusy(true);
    try {
      const next = await createProviderTenantDomain(tenantId, request);
      setDomainOpen(false);
      setChallenge(next);
      await invalidate();
      toast.success(t('tenantDetail.domains.created'));
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };
  const openChallenge = async (domain: ProviderTenantDomain) => {
    setBusy(true);
    try {
      setChallenge(await getProviderDomainChallenge(tenantId, domain.domainId));
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };
  const verifyDomain = async (domain: ProviderTenantDomain, justification: string) => {
    if (
      await run(
        () => verifyProviderTenantDomain(tenantId, domain, justification),
        t('tenantDetail.domains.checked')
      )
    )
      setChallenge(null);
  };
  const invite = async (administratorId: string) => {
    setBusy(true);
    try {
      setInvitation(await issueProviderAdministratorInvitation(tenantId, administratorId));
      await invalidate();
      toast.success(t('tenantDetail.administrators.invited'));
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };
  const saveEntitlements = async () => {
    if (!tenant.data) return;
    if (
      await run(
        () =>
          replaceProviderTenantEntitlements(
            tenant.data,
            [...selectedEntitlements],
            entitlementReason.trim()
          ),
        t('entitlements.saved')
      )
    )
      setEntitlementReason('');
  };

  const serviceHealth = useMemo(
    () => tenant.data?.services.filter((service) => service.lifecycleState === 'READY').length ?? 0,
    [tenant.data]
  );

  if (
    tenant.isLoading ||
    catalog.isLoading ||
    sessions.isLoading ||
    (operator.isLoading && !operator.data)
  )
    return <ProviderLoading />;
  if (tenant.isError || catalog.isError || sessions.isError || (operator.isError && !operator.data))
    return (
      <ProviderError
        error={tenant.error ?? catalog.error ?? sessions.error ?? operator.error}
        onRetry={() =>
          void Promise.all([
            tenant.refetch(),
            catalog.refetch(),
            sessions.refetch(),
            operator.refetch(),
          ])
        }
        retrying={
          tenant.isFetching || catalog.isFetching || sessions.isFetching || operator.isFetching
        }
      />
    );
  if (!tenant.data) return null;
  const value = tenant.data;
  const serviceExceptions = value.services.filter((service) =>
    ['DEGRADED', 'FAILED'].includes(service.lifecycleState)
  ).length;
  const verifiedDomains = value.domains.filter(
    (domain) => domain.verificationState === 'VERIFIED'
  ).length;
  const activeAdministrators = value.administrators.filter(
    (administrator) => administrator.lifecycleState === 'ACTIVE'
  ).length;
  const activeSupportSessions = (sessions.data ?? []).filter(
    (session) => session.lifecycleState === 'ACTIVE'
  ).length;
  const tenantState = value.services.some((service) => service.lifecycleState === 'FAILED')
    ? 'CRITICAL'
    : value.lifecycleState !== 'ACTIVE' ||
        serviceExceptions > 0 ||
        serviceHealth < value.services.length ||
        verifiedDomains < value.domains.length ||
        activeAdministrators === 0
      ? 'ATTENTION'
      : 'HEALTHY';
  const tenantTone =
    tenantState === 'CRITICAL' ? 'error' : tenantState === 'ATTENTION' ? 'warning' : 'success';
  const observedAt = Math.max(tenant.dataUpdatedAt, sessions.dataUpdatedAt);

  return (
    <Stack gap={2.5} sx={{ width: 1, maxWidth: 1600, mx: 'auto' }}>
      <Box>
        <Button
          size="small"
          color="inherit"
          startIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/provider/tenants')}
          sx={{ mb: 1 }}
        >
          {t('tenantDetail.back')}
        </Button>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography component="h1" variant="h4">
              {value.displayName}
            </Typography>
            <ProviderStatusChip state={value.lifecycleState} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {value.organizationName} / {value.tenantKey} / {value.environmentKey}
          </Typography>
        </Box>
      </Box>

      <OperationalContextBar
        label={t('tenantDetail.context.label')}
        items={[
          {
            label: t('tenantDetail.context.scope'),
            value: `${value.organizationName} / ${value.environmentKey}`,
            icon: <Globe2 size={16} />,
          },
          {
            label: t('tenantDetail.context.placement'),
            value: `${value.dataRegion} / ${t(`isolation.${value.isolationModel}`)}`,
            icon: <Layers3 size={16} />,
          },
          {
            label: t('tenantDetail.context.contract'),
            value: value.subscription?.planName ?? t('tenants.noSubscription'),
            icon: <PackageCheck size={16} />,
          },
        ]}
        status={
          <LiveStatus
            state={tenant.isFetching || sessions.isFetching ? 'syncing' : 'live'}
            label={t(
              tenant.isFetching || sessions.isFetching
                ? 'tenantDetail.live.syncing'
                : 'tenantDetail.live.live'
            )}
            detail={t('tenantDetail.context.lastLoaded', {
              value: formatProviderDate(new Date(observedAt).toISOString()),
            })}
            refreshLabel={t('actions.refresh')}
            refreshing={tenant.isFetching || sessions.isFetching}
            onRefresh={() => void invalidate()}
          />
        }
      />

      <Paper
        component="section"
        variant="outlined"
        sx={(theme) => {
          const color = theme.palette[tenantTone].main;
          return {
            position: 'relative',
            overflow: 'hidden',
            px: { xs: 2, md: 2.5 },
            py: { xs: 2, md: 2.25 },
            bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.055),
            borderColor: alpha(color, 0.35),
            '&::before': {
              position: 'absolute',
              inset: '0 auto 0 0',
              width: 4,
              bgcolor: color,
              content: '""',
            },
          };
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={2}
        >
          <Stack direction="row" alignItems="flex-start" gap={1.25} minWidth={0}>
            <Box
              aria-hidden="true"
              sx={{
                width: 38,
                height: 38,
                flex: '0 0 38px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                color: `${tenantTone}.main`,
                bgcolor: 'background.paper',
              }}
            >
              {tenantState === 'HEALTHY' ? <ShieldCheck size={20} /> : <TriangleAlert size={20} />}
            </Box>
            <Box minWidth={0}>
              <Typography component="h2" variant="h5">
                {t(`tenantDetail.pulse.title.${tenantState}`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {t(`tenantDetail.pulse.detail.${tenantState}`, {
                  services: serviceExceptions,
                  domains: value.domains.length - verifiedDomains,
                  administrators: activeAdministrators,
                })}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.25 }}>
                <ProviderStatusChip state={value.onboardingState} />
                {value.subscription && (
                  <ProviderStatusChip state={value.subscription.lifecycleState} />
                )}
                <Chip
                  size="small"
                  variant="outlined"
                  color={activeSupportSessions ? 'warning' : 'default'}
                  label={t('tenantDetail.pulse.support', { count: activeSupportSessions })}
                />
              </Stack>
            </Box>
          </Stack>
          {canWrite && ['ACTIVE', 'SUSPENDED'].includes(value.lifecycleState) && (
            <Button
              variant="outlined"
              color={value.lifecycleState === 'ACTIVE' ? 'warning' : 'primary'}
              startIcon={
                value.lifecycleState === 'ACTIVE' ? (
                  <PauseCircle size={17} />
                ) : (
                  <PlayCircle size={17} />
                )
              }
              onClick={() => setLifecycleOpen(true)}
              sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, flexShrink: 0 }}
            >
              {t(
                `tenantDetail.lifecycle.${value.lifecycleState === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'}.action`
              )}
            </Button>
          )}
        </Stack>
      </Paper>

      <Box
        component="section"
        aria-label={t('tenantDetail.signals.label')}
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        <SignalMetric
          label={t('tenantDetail.metrics.services')}
          value={`${serviceHealth}/${value.services.length}`}
          detail={t('tenantDetail.signals.servicesDetail', { exceptions: serviceExceptions })}
          icon={<Layers3 size={18} />}
          tone={serviceExceptions ? 'error' : 'success'}
          progress={
            value.services.length ? (serviceHealth / value.services.length) * 100 : undefined
          }
          progressLabel={t('tenantDetail.signals.servicesProgress', {
            ready: serviceHealth,
            total: value.services.length,
          })}
        />
        <SignalMetric
          label={t('tenantDetail.signals.domains')}
          value={`${verifiedDomains}/${value.domains.length}`}
          detail={t('tenantDetail.signals.domainsDetail')}
          icon={<ShieldCheck size={18} />}
          tone={verifiedDomains === value.domains.length ? 'success' : 'warning'}
        />
        <SignalMetric
          label={t('tenantDetail.signals.administrators')}
          value={`${activeAdministrators}/${value.administrators.length}`}
          detail={t('tenantDetail.signals.administratorsDetail')}
          icon={<UserCheck size={18} />}
          tone={activeAdministrators ? 'success' : 'error'}
        />
        <SignalMetric
          label={t('tenantDetail.signals.entitlements')}
          value={value.entitlements.length.toLocaleString()}
          detail={t('tenantDetail.signals.entitlementsDetail', {
            schema: value.schemaVersion,
          })}
          icon={<PackageCheck size={18} />}
          tone="info"
        />
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', overflowX: 'auto' }}>
        <Tabs
          value={tab}
          onChange={(_event, next) => selectTab(next)}
          variant="scrollable"
          aria-label={t('tenantDetail.tabs.label')}
        >
          {tenantTabs.map((item) => (
            <Tab key={item} label={t(`tenantDetail.tabs.${item}`)} />
          ))}
        </Tabs>
      </Box>

      {tab === 0 && (
        <Stack gap={4}>
          <Box component="section">
            <ProviderSectionHeading title={t('tenantDetail.organization.title')} />
            <Box
              sx={{
                mt: 1,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                columnGap: 3,
                borderBlock: 1,
                borderColor: 'divider',
              }}
            >
              <DetailField label={t('fields.organizationName')} value={value.organizationName} />
              <DetailField label={t('fields.organizationKey')} value={value.organizationKey} />
              <DetailField
                label={t('fields.servicePlan')}
                value={
                  value.subscription
                    ? `${value.subscription.planName} v${value.subscription.planVersion}`
                    : '-'
                }
              />
              <DetailField
                label={t('fields.subscriptionState')}
                value={
                  value.subscription ? (
                    <ProviderStatusChip state={value.subscription.lifecycleState} />
                  ) : (
                    '-'
                  )
                }
              />
              <DetailField
                label={t('fields.contractReference')}
                value={value.subscription?.contractReference ?? '-'}
              />
              <DetailField label={t('fields.environmentKey')} value={value.environmentKey} />
              <DetailField label={t('fields.defaultLocale')} value={value.defaultLocale} />
              <DetailField label={t('fields.timeZone')} value={value.timeZone} />
              <DetailField
                label={t('fields.isolation')}
                value={t(`isolation.${value.isolationModel}`)}
              />
              <DetailField
                label={t('fields.createdAt')}
                value={formatProviderDate(value.createdAt)}
              />
              <DetailField
                label={t('fields.updatedAt')}
                value={formatProviderDate(value.updatedAt)}
              />
              <DetailField label={t('fields.schemaVersion')} value={`v${value.schemaVersion}`} />
            </Box>
          </Box>
        </Stack>
      )}

      {tab === 1 && (
        <Box component="section">
          <ProviderSectionHeading title={t('tenantDetail.services.title')} />
          <Stack
            divider={<Divider flexItem />}
            sx={{ mt: 1.25, borderBlock: 1, borderColor: 'divider' }}
          >
            {value.services.map((service) => (
              <Stack
                key={service.serviceInstanceId}
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                gap={1.5}
                sx={{ py: 1.5 }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={700}>
                    {service.serviceName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {service.serviceKey} / {service.externalResourceId ?? '-'}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {service.dataRegion ?? value.dataRegion} / {service.deploymentCell ?? '-'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('tenantDetail.services.reconciled', {
                    value: formatProviderDate(service.lastReconciledAt),
                  })}
                </Typography>
                <ProviderStatusChip state={service.lifecycleState} />
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      {tab === 2 && (
        <Stack gap={4}>
          <Box component="section">
            <ProviderSectionHeading
              title={t('tenantDetail.domains.title')}
              action={
                canWrite ? (
                  <Button startIcon={<Plus size={17} />} onClick={() => setDomainOpen(true)}>
                    {t('tenantDetail.domains.add')}
                  </Button>
                ) : undefined
              }
            />
            <Stack
              divider={<Divider flexItem />}
              sx={{ mt: 1.25, borderBlock: 1, borderColor: 'divider' }}
            >
              {value.domains.map((domain) => (
                <Stack
                  key={domain.domainId}
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  gap={1.25}
                  sx={{ py: 1.25 }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {domain.domainName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(`domainTypes.${domain.domainType}`)} / {domain.verificationMethod}
                    </Typography>
                  </Box>
                  {domain.primaryDomain && (
                    <Chip size="small" label={t('tenantDetail.domains.primary')} />
                  )}
                  <ProviderStatusChip state={domain.verificationState} />
                  <Button size="small" onClick={() => void openChallenge(domain)} disabled={busy}>
                    {t('tenantDetail.domains.dns')}
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Box>
          <Box component="section">
            <ProviderSectionHeading title={t('tenantDetail.administrators.title')} />
            <Stack
              divider={<Divider flexItem />}
              sx={{ mt: 1.25, borderBlock: 1, borderColor: 'divider' }}
            >
              {value.administrators.map((administrator) => (
                <Stack
                  key={administrator.tenantAdministratorId}
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  gap={1.25}
                  sx={{ py: 1.25 }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {administrator.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {administrator.email}
                    </Typography>
                  </Box>
                  {administrator.primaryAdministrator && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t('tenantDetail.administrators.primary')}
                    />
                  )}
                  <ProviderStatusChip state={administrator.lifecycleState} />
                  {canWrite && administrator.authUserId && (
                    <Button
                      size="small"
                      startIcon={<Send size={16} />}
                      disabled={busy}
                      onClick={() => void invite(administrator.tenantAdministratorId)}
                    >
                      {t('tenantDetail.administrators.invite')}
                    </Button>
                  )}
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      )}

      {tab === 3 && (
        <Box component="section">
          <ProviderSectionHeading title={t('entitlements.title', { tenant: value.displayName })} />
          <FormGroup
            sx={{
              mt: 1.25,
              py: 1,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              borderBlock: 1,
              borderColor: 'divider',
            }}
          >
            {(catalog.data ?? []).map((entitlement) => (
              <FormControlLabel
                key={entitlement.entitlementId}
                control={
                  <Checkbox
                    disabled={!canWriteEntitlements}
                    checked={selectedEntitlements.has(entitlement.entitlementKey)}
                    onChange={() =>
                      setSelectedEntitlements((current) => {
                        const next = new Set(current);
                        if (next.has(entitlement.entitlementKey))
                          next.delete(entitlement.entitlementKey);
                        else next.add(entitlement.entitlementKey);
                        return next;
                      })
                    }
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={700}>
                      {entitlement.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {entitlement.entitlementKey} / {entitlement.entitlementType}
                    </Typography>
                  </Box>
                }
                sx={{ m: 0, px: 0.5, alignItems: 'flex-start' }}
              />
            ))}
          </FormGroup>
          {canWriteEntitlements && (
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                required
                label={t('fields.justification')}
                value={entitlementReason}
                onChange={(event) => setEntitlementReason(event.target.value)}
              />
              <Button
                variant="contained"
                disabled={busy || selectedEntitlements.size === 0 || !entitlementReason.trim()}
                onClick={() => void saveEntitlements()}
                sx={{ minWidth: 120 }}
              >
                {t('actions.save')}
              </Button>
            </Stack>
          )}
        </Box>
      )}

      {tab === 4 && (
        <Box component="section">
          <ProviderSectionHeading
            title={t('tenantDetail.support.title')}
            action={
              canSupport ? (
                <Button
                  variant="contained"
                  startIcon={<KeyRound size={17} />}
                  onClick={() => navigate(`/provider/support?tenantId=${tenantId}`)}
                >
                  {t('tenantDetail.support.create')}
                </Button>
              ) : undefined
            }
          />
          <Stack
            divider={<Divider flexItem />}
            sx={{ mt: 1.25, borderBlock: 1, borderColor: 'divider' }}
          >
            {(sessions.data ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                {t('tenantDetail.support.empty')}
              </Typography>
            ) : (
              (sessions.data ?? []).map((session) => (
                <Stack
                  key={session.supportSessionId}
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  gap={1.25}
                  sx={{ py: 1.25 }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {session.operatorName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {session.scopes.map((scope) => t(`support.scopes.${scope}`)).join(', ')}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {formatProviderDate(session.expiresAt)}
                  </Typography>
                  <ProviderStatusChip state={session.lifecycleState} />
                </Stack>
              ))
            )}
          </Stack>
        </Box>
      )}

      {lifecycleOpen && (
        <LifecycleDialog
          tenant={value}
          busy={busy}
          onClose={() => setLifecycleOpen(false)}
          onSubmit={lifecycle}
        />
      )}
      {domainOpen && (
        <CreateDomainDialog
          busy={busy}
          onClose={() => setDomainOpen(false)}
          onCreate={createDomain}
        />
      )}
      {challenge && (
        <DomainChallengeDialog
          challenge={challenge}
          busy={busy}
          onClose={() => setChallenge(null)}
          onVerify={verifyDomain}
        />
      )}
      {invitation && (
        <InvitationDialog invitation={invitation} onClose={() => setInvitation(null)} />
      )}
    </Stack>
  );
}
