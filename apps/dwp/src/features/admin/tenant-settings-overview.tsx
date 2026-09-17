import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import {
  Building2,
  CircleAlert,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Palette,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getAdminTenantBranding,
  getAppGovernanceDashboard,
  getAuthPolicy,
  getIdentityProviders,
  listAuditPolicyRevisions,
  listIdentityUsers,
  listScimConnectors,
} from '@dwp-frontend/shared-utils';
import { ActionButton, GuidedEmptyState } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  resolveTenantAuthenticationPosture,
  resolveTenantPrioritySummaryState,
  resolveTenantSettingsTasks,
  type TenantSettingsTask,
} from './tenant-settings-overview-model';
import { TenantAuthPolicyWorkflow } from './tenant-auth-policy-workflow';

type TenantSettingsOverviewProps = Readonly<{
  canReadIdentity: boolean;
  canReadProvisioning: boolean;
  canReadAppGovernance: boolean;
  canReadAuditGovernance: boolean;
}>;

const taskIcons = {
  SSO_CONFIGURATION: KeyRound,
  SCIM_CONFIGURATION: UsersRound,
  SCIM_ATTENTION: CircleAlert,
  APP_APPROVAL: ShieldCheck,
  POLICY_REVIEW: Fingerprint,
} as const;

function taskColor(tone: TenantSettingsTask['tone']): 'info' | 'warning' | 'error' {
  if (tone === 'critical') return 'error';
  return tone;
}

export function TenantSettingsOverview({
  canReadIdentity,
  canReadProvisioning,
  canReadAppGovernance,
  canReadAuditGovernance,
}: TenantSettingsOverviewProps) {
  const { t } = useTranslation('admin');
  const branding = useQuery({
    queryKey: ['admin', 'settings-overview', 'branding'],
    queryFn: getAdminTenantBranding,
    retry: false,
  });
  const authPolicy = useQuery({
    queryKey: ['admin', 'settings-overview', 'auth-policy'],
    queryFn: async () => (await getAuthPolicy()).data,
    retry: false,
  });
  const identityProviders = useQuery({
    queryKey: ['admin', 'settings-overview', 'identity-providers'],
    queryFn: async () => (await getIdentityProviders()).data,
    retry: false,
  });
  const identities = useQuery({
    queryKey: ['admin', 'settings-overview', 'identities'],
    queryFn: () => listIdentityUsers(''),
    enabled: canReadIdentity,
    retry: false,
  });
  const scim = useQuery({
    queryKey: ['admin', 'settings-overview', 'scim'],
    queryFn: listScimConnectors,
    enabled: canReadProvisioning,
    retry: false,
  });
  const appGovernance = useQuery({
    queryKey: ['admin', 'app-governance'],
    queryFn: getAppGovernanceDashboard,
    enabled: canReadAppGovernance,
    retry: false,
  });
  const policyRevisions = useQuery({
    queryKey: ['audit-control', 'policy-revisions'],
    queryFn: listAuditPolicyRevisions,
    enabled: canReadAuditGovernance,
    retry: false,
  });

  const authentication = useMemo(
    () =>
      resolveTenantAuthenticationPosture({
        authPolicy: authPolicy.data,
        identityProviders: identityProviders.data,
        scimConnectors: canReadProvisioning ? scim.data : undefined,
      }),
    [authPolicy.data, canReadProvisioning, identityProviders.data, scim.data]
  );
  const tasks = useMemo(
    () =>
      resolveTenantSettingsTasks({
        authentication,
        appGovernance: appGovernance.data,
        policyRevisions: policyRevisions.data,
      }),
    [appGovernance.data, authentication, policyRevisions.data]
  );
  const loading =
    branding.isLoading ||
    authPolicy.isLoading ||
    identityProviders.isLoading ||
    (canReadIdentity && identities.isLoading) ||
    (canReadProvisioning && scim.isLoading) ||
    (canReadAppGovernance && appGovernance.isLoading) ||
    (canReadAuditGovernance && policyRevisions.isLoading);
  const partialFailure = [
    branding,
    authPolicy,
    identityProviders,
    canReadIdentity ? identities : null,
    canReadProvisioning ? scim : null,
    canReadAppGovernance ? appGovernance : null,
    canReadAuditGovernance ? policyRevisions : null,
  ].some((query) => query?.isError);
  const priorityState = resolveTenantPrioritySummaryState({
    loading,
    partialFailure,
    taskCount: tasks.length,
  });
  const currentRevisions = (policyRevisions.data ?? []).slice(0, 3);

  return (
    <Stack gap={2.5} data-testid="tenant-settings-operational-overview">
      {partialFailure && (
        <Alert severity="warning">{t('settingsHome.overview.partialFailure')}</Alert>
      )}

      <Box component="section" aria-labelledby="tenant-settings-priority-title">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          gap={1}
        >
          <Box>
            <Typography id="tenant-settings-priority-title" component="h2" variant="h6">
              {t('settingsHome.overview.priority.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settingsHome.overview.priority.description')}
            </Typography>
          </Box>
          {!loading && (
            <Chip
              size="small"
              variant="outlined"
              color={priorityState === 'CLEAR' ? 'success' : 'warning'}
              label={
                priorityState === 'UNAVAILABLE'
                  ? t('settingsHome.overview.priority.unavailableCount')
                  : t('settingsHome.overview.priority.count', { count: tasks.length })
              }
            />
          )}
        </Stack>

        {loading ? (
          <Box
            sx={{
              mt: 1.25,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 1.25,
            }}
          >
            <Skeleton variant="rounded" height={120} />
            <Skeleton variant="rounded" height={120} />
          </Box>
        ) : tasks.length ? (
          <Box
            sx={{
              mt: 1.25,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.25,
            }}
          >
            {tasks.map((task) => {
              const TaskIcon = taskIcons[task.kind];
              return (
                <Box
                  key={task.kind}
                  sx={{
                    border: 1,
                    borderColor: `${taskColor(task.tone)}.main`,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    p: 2,
                  }}
                >
                  <Stack direction="row" alignItems="flex-start" gap={1.25}>
                    <TaskIcon size={20} aria-hidden="true" />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography component="h3" variant="subtitle1" fontWeight={750}>
                          {t(`settingsHome.overview.tasks.${task.kind}.title`)}
                        </Typography>
                        <Chip
                          size="small"
                          color={taskColor(task.tone)}
                          label={t('settingsHome.overview.tasks.count', { count: task.count })}
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t(`settingsHome.overview.tasks.${task.kind}.description`)}
                      </Typography>
                      <ActionButton
                        component={NavLink}
                        to={task.route}
                        intent="quiet"
                        size="small"
                        endIcon={<ExternalLink size={15} aria-hidden="true" />}
                        sx={{ mt: 1.25 }}
                      >
                        {t('settingsHome.overview.tasks.openOwner')}
                      </ActionButton>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box sx={{ mt: 1.25 }}>
            <GuidedEmptyState
              kind="empty"
              title={t(
                priorityState === 'UNAVAILABLE'
                  ? 'settingsHome.overview.priority.unavailableTitle'
                  : 'settingsHome.overview.priority.emptyTitle'
              )}
              description={t(
                priorityState === 'UNAVAILABLE'
                  ? 'settingsHome.overview.priority.unavailableDescription'
                  : 'settingsHome.overview.priority.emptyDescription'
              )}
            />
          </Box>
        )}
      </Box>

      <Box component="section" aria-labelledby="tenant-settings-profile-title">
        <Typography id="tenant-settings-profile-title" component="h2" variant="h6">
          {t('settingsHome.overview.profile.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('settingsHome.overview.profile.description')}
        </Typography>
        <Box
          sx={{
            mt: 1.25,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
            gap: 1.25,
          }}
        >
          <OverviewCard
            icon={Palette}
            title={t('settingsHome.overview.branding.title')}
            state={
              branding.data
                ? t('settingsHome.overview.branding.revision', { version: branding.data.version })
                : t('settingsHome.overview.unavailable')
            }
            rows={[
              [
                t('settingsHome.overview.branding.organization'),
                branding.data?.organizationName || t('settingsHome.overview.notConfigured'),
              ],
              [t('settingsHome.overview.branding.accent'), branding.data?.accentColor || '—'],
            ]}
            route="/admin/experience/branding"
          />
          <OverviewCard
            icon={KeyRound}
            title={t('settingsHome.overview.authentication.title')}
            state={t(`settingsHome.overview.authentication.sso.${authentication.sso}`)}
            rows={[
              [
                t('settingsHome.overview.authentication.provider'),
                authentication.providerKeys.join(', ') || t('settingsHome.overview.notConfigured'),
              ],
              [
                t('settingsHome.overview.authentication.mfa'),
                authentication.mfaRequired === null
                  ? t('settingsHome.overview.unavailable')
                  : t(
                      `settingsHome.overview.authentication.${authentication.mfaRequired ? 'required' : 'optional'}`
                    ),
              ],
              [
                t('settingsHome.overview.authentication.scimLabel'),
                t(`settingsHome.overview.authentication.scim.${authentication.scim}`, {
                  count: authentication.activeScimConnectors ?? 0,
                }),
              ],
            ]}
            route="/admin/identity/provisioning"
          />
          <OverviewCard
            icon={Building2}
            title={t('settingsHome.overview.organization.title')}
            state={t('settingsHome.overview.organization.domainOwner')}
            rows={[
              [
                t('settingsHome.overview.organization.identities'),
                identities.data
                  ? t('settingsHome.overview.organization.identityCount', {
                      count: identities.data.totalElements,
                    })
                  : t('settingsHome.overview.unavailable'),
              ],
              [
                t('settingsHome.overview.organization.domainVerification'),
                t('settingsHome.overview.organization.notObserved'),
              ],
            ]}
            route="/admin/identity/access"
          />
        </Box>
      </Box>

      <TenantAuthPolicyWorkflow />

      {canReadAuditGovernance && (
        <Box component="section" aria-labelledby="tenant-settings-recent-change-title">
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Box>
              <Typography id="tenant-settings-recent-change-title" component="h2" variant="h6">
                {t('settingsHome.overview.recent.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('settingsHome.overview.recent.description')}
              </Typography>
            </Box>
            <ActionButton
              component={NavLink}
              to="/admin/governance/audit-governance"
              intent="quiet"
              size="small"
            >
              {t('settingsHome.overview.recent.open')}
            </ActionButton>
          </Stack>
          <Stack sx={{ mt: 1.25, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {currentRevisions.length ? (
              currentRevisions.map((revision, index) => (
                <Box key={revision.revisionId} sx={{ p: 1.75 }}>
                  {index > 0 && <Divider sx={{ mb: 1.75 }} />}
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    gap={0.75}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2">{revision.changeReason}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('settingsHome.overview.recent.actor', {
                          actor: revision.createdBy,
                          date: formatDate(revision.createdAt, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }),
                        })}
                      </Typography>
                    </Box>
                    <Chip size="small" variant="outlined" label={revision.lifecycleState} />
                  </Stack>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                {t('settingsHome.overview.recent.empty')}
              </Typography>
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

function OverviewCard({
  icon: Icon,
  title,
  state,
  rows,
  route,
}: Readonly<{
  icon: LucideIcon;
  title: string;
  state: string;
  rows: ReadonlyArray<readonly [string, string]>;
  route: string;
}>) {
  const { t } = useTranslation('admin');
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ p: 2 }}
      >
        <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
          <Icon size={19} aria-hidden="true" />
          <Typography component="h3" variant="subtitle1" fontWeight={750}>
            {title}
          </Typography>
        </Stack>
        <Chip size="small" variant="outlined" label={state} />
      </Stack>
      <Divider />
      <Stack component="dl" sx={{ m: 0, p: 2 }} gap={1.25}>
        {rows.map(([label, value]) => (
          <Stack key={label} direction="row" justifyContent="space-between" gap={2}>
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography
              component="dd"
              variant="body2"
              fontWeight={650}
              textAlign="right"
              sx={{ m: 0 }}
            >
              {value}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Divider />
      <ActionButton component={NavLink} to={route} intent="quiet" size="small" sx={{ m: 1 }}>
        {t('settingsHome.overview.openDetail')}
      </ActionButton>
    </Box>
  );
}
