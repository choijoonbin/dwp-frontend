import { useTranslation } from 'react-i18next';
import { Archive, Globe2, LockKeyhole, ShieldAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getTenantProviderDataGovernance,
  getTenantProviderDomains,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  dataGovernanceObservationSummary,
  domainObservationSummary,
  ownerActionLabelKey,
  ownerDomainTypeLabelKey,
  ownerEvidenceLabelKey,
  ownerExclusionLabelKey,
  ownerFreshnessLabelKey,
  ownerHoldStateLabelKey,
  ownerPolicyTypeLabelKey,
  ownerProjectionErrorState,
  ownerStateLabelKey,
  ownerVerificationMethodLabelKey,
} from './tenant-owner-projection-model';

import type { ReactNode } from 'react';

const domainsKey = ['admin', 'tenant-owner', 'provider-domains'] as const;
const governanceKey = ['admin', 'tenant-owner', 'data-governance'] as const;

function observedTime(value: string | null | undefined): string {
  return value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function LoadingEvidence() {
  const { t } = useTranslation('tenantOwner');
  return <Skeleton variant="rounded" height={152} aria-label={t('loading')} />;
}

function BoundaryAlert({ children }: { children: ReactNode }) {
  return (
    <Alert severity="info" icon={<ShieldAlert size={18} />} sx={{ mt: 1.5 }}>
      {children}
    </Alert>
  );
}

function ProjectionError({ error }: { error: unknown }) {
  const { t } = useTranslation('tenantOwner');
  const state = ownerProjectionErrorState(error);
  return (
    <Alert severity={state === 'AUTHORITY_REVOKED' ? 'error' : 'warning'}>
      {t(`errors.${state}`)}
    </Alert>
  );
}

export function TenantProviderDomainEvidence() {
  const { t } = useTranslation('tenantOwner');
  const { hasPermission, isLoaded } = usePermissions();
  const permitted = isLoaded && hasPermission('ADMIN.IDENTITY_PROVISIONING', 'VIEW');
  const query = useQuery({
    queryKey: domainsKey,
    queryFn: ({ signal }) => getTenantProviderDomains(signal),
    enabled: permitted,
    retry: false,
    staleTime: 30_000,
  });

  if (!isLoaded || (permitted && query.isLoading)) return <LoadingEvidence />;
  if (!permitted) return <Alert severity="info">{t('permissions.domains')}</Alert>;
  if (query.isError || !query.data) return <ProjectionError error={query.error} />;

  const data = query.data;
  const summary = domainObservationSummary(data);
  return (
    <Box
      component="section"
      aria-labelledby="tenant-provider-domain-evidence-title"
      sx={{ mt: 1.25, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ p: 2, bgcolor: 'background.default' }}
      >
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <Globe2 size={18} aria-hidden="true" />
            <Typography
              id="tenant-provider-domain-evidence-title"
              component="h3"
              variant="subtitle1"
            >
              {t('domains.title')}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('domains.description', { observedAt: observedTime(data.observedAt) })}
          </Typography>
        </Box>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          <Chip size="small" label={t('domains.total', { count: summary.total })} />
          <Chip
            size="small"
            color="success"
            variant="outlined"
            label={t('domains.verified', { count: summary.verified })}
          />
          {(summary.pending > 0 || summary.notObserved > 0) && (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={t('domains.attention', {
                count: summary.pending + summary.notObserved + summary.failed,
              })}
            />
          )}
        </Stack>
      </Stack>
      <Divider />
      {data.domains.length ? (
        <Stack divider={<Divider flexItem />}>
          {data.domains.map((domain) => (
            <Stack
              key={domain.domainId}
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              gap={1.5}
              sx={{ p: 2 }}
            >
              <Box minWidth={0}>
                <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                  <Typography component="p" variant="subtitle2">
                    {domain.domainName}
                  </Typography>
                  {domain.primaryDomain && <Chip size="small" label={t('domains.primary')} />}
                  <Chip
                    size="small"
                    variant="outlined"
                    color={
                      domain.verificationState === 'VERIFIED'
                        ? 'success'
                        : domain.verificationState === 'FAILED'
                          ? 'error'
                          : 'warning'
                    }
                    label={t(ownerStateLabelKey(domain.verificationState))}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {t('domains.typeAndMethod', {
                    type: t(ownerDomainTypeLabelKey(domain.domainType)),
                    method: t(ownerVerificationMethodLabelKey(domain.verificationMethod)),
                  })}
                </Typography>
              </Box>
              <Stack alignItems={{ md: 'flex-end' }} gap={0.25}>
                <Typography variant="caption" color="text.secondary">
                  {t('domains.freshness', {
                    state: t(ownerFreshnessLabelKey(domain.evidenceFreshnessState)),
                  })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('domains.lastChecked', { value: observedTime(domain.lastCheckedAt) })}
                </Typography>
              </Stack>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          {t('domains.empty')}
        </Typography>
      )}
      <Box sx={{ px: 2, pb: 2 }}>
        <BoundaryAlert>
          {t('coverage.domains', {
            changedAt: observedTime(data.sourceLastChangedAt),
          })}
        </BoundaryAlert>
      </Box>
    </Box>
  );
}

export function TenantDataGovernanceEvidence() {
  const { t } = useTranslation('tenantOwner');
  const { hasPermission, isLoaded } = usePermissions();
  const permitted = isLoaded && hasPermission('ADMIN.AUDIT_VIEW', 'VIEW');
  const query = useQuery({
    queryKey: governanceKey,
    queryFn: ({ signal }) => getTenantProviderDataGovernance(signal),
    enabled: permitted,
    retry: false,
    staleTime: 30_000,
  });

  if (!isLoaded || (permitted && query.isLoading)) return <LoadingEvidence />;
  if (!permitted) return <Alert severity="info">{t('permissions.governance')}</Alert>;
  if (query.isError || !query.data) return <ProjectionError error={query.error} />;

  const data = query.data;
  const summary = dataGovernanceObservationSummary(data);
  return (
    <Box component="section" aria-labelledby="tenant-data-governance-owner-title">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{
          px: 2.5,
          py: 2,
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <LockKeyhole size={18} aria-hidden="true" />
            <Typography id="tenant-data-governance-owner-title" component="h2" variant="subtitle1">
              {t('governance.title')}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('governance.description', { observedAt: observedTime(data.observedAt) })}
          </Typography>
        </Box>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          <Chip
            size="small"
            variant="outlined"
            label={t('governance.retentionCount', { count: summary.activeRetentionPolicies })}
          />
          <Chip
            size="small"
            color={summary.activeLegalHolds ? 'warning' : 'default'}
            variant="outlined"
            label={t('governance.legalHoldCount', { count: summary.activeLegalHolds })}
          />
          <Chip
            size="small"
            color={summary.blockedLifecycleRequests ? 'warning' : 'default'}
            variant="outlined"
            label={t('governance.blockedCount', { count: summary.blockedLifecycleRequests })}
          />
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' } }}>
        <Box sx={{ borderRight: { xl: 1 }, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2.5, py: 1.5 }}>
            <Archive size={17} aria-hidden="true" />
            <Typography component="h3" variant="subtitle2">
              {t('governance.policies')}
            </Typography>
          </Stack>
          <Divider />
          {data.policies.length ? (
            <Stack divider={<Divider flexItem />}>
              {data.policies.map((policy) => (
                <Box
                  key={`${policy.policyType}:${policy.revisionNumber}`}
                  sx={{ px: 2.5, py: 1.75 }}
                >
                  <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
                    <Typography variant="subtitle2">
                      {t('governance.policyTitle', {
                        type: t(ownerPolicyTypeLabelKey(policy.policyType)),
                        revision: policy.revisionNumber,
                      })}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={policy.effectiveState === 'ACTIVE' ? 'success' : 'default'}
                      label={t(ownerStateLabelKey(policy.effectiveState))}
                    />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.75 }}>
                    {policy.policyType === 'RETENTION'
                      ? t('governance.retentionDays', { count: policy.retentionDays ?? 0 })
                      : t(
                          policy.legalHoldActive
                            ? 'governance.legalHoldActive'
                            : 'governance.legalHoldInactive'
                        )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t('governance.policyEvidence', {
                      freshness: t(ownerFreshnessLabelKey(policy.freshnessState)),
                      evidence: t(ownerEvidenceLabelKey(policy.evidenceState)),
                      fingerprint: policy.impactFingerprint
                        ? `${policy.impactFingerprint.slice(0, 12)}…`
                        : '—',
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('governance.changedAt', { value: observedTime(policy.sourceChangedAt) })}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, py: 2 }}>
              {t('governance.noPolicies')}
            </Typography>
          )}
        </Box>

        <Box>
          <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2.5, py: 1.5 }}>
            <ShieldAlert size={17} aria-hidden="true" />
            <Typography component="h3" variant="subtitle2">
              {t('governance.tenantHolds')}
            </Typography>
          </Stack>
          <Divider />
          {data.tenantLifecycleHoldObservations.length ? (
            <Stack divider={<Divider flexItem />}>
              {data.tenantLifecycleHoldObservations.map((hold) => (
                <Box key={hold.lifecycleRequestId} sx={{ px: 2.5, py: 1.75 }}>
                  <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
                    <Typography variant="subtitle2">
                      {t(ownerActionLabelKey(hold.requestedAction))}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={hold.lifecycleState === 'BLOCKED_BY_HOLD' ? 'warning' : 'default'}
                      label={t(ownerStateLabelKey(hold.lifecycleState))}
                    />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.75 }}>
                    {t(ownerHoldStateLabelKey(hold.holdEvaluationState))}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t('governance.holdEvidence', {
                      count: hold.evidenceReferenceCount,
                      evidence: t(ownerEvidenceLabelKey(hold.evidenceState)),
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('governance.changedAt', { value: observedTime(hold.sourceChangedAt) })}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, py: 2 }}>
              {t('governance.noTenantHolds')}
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ px: 2.5, pb: 2 }}>
        <BoundaryAlert>
          {t('coverage.governance', { changedAt: observedTime(data.sourceLastChangedAt) })}{' '}
          {data.exclusions.map((exclusion) => t(ownerExclusionLabelKey(exclusion))).join(' · ')}
        </BoundaryAlert>
      </Box>
    </Box>
  );
}
