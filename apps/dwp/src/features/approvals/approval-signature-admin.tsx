import { useTranslation } from 'react-i18next';
import { ArrowUpRight, KeyRound, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ActionIconButton,
  ActionButton,
  EmptyState,
  ErrorState,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { getApprovalSignatureProviders } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';

import {
  approvalProviderCapabilityEntries,
  approvalSignatureReadiness,
} from './approval-management-model';
import { useApprovalManagementScopeReady } from './approval-management-scope';
import {
  approvalSignatureSourceState,
  retryApprovalSignatureRead,
} from './approval-signature-source-state';
import { ApprovalSurface, StatusChip } from './approval-ui';
import { useApprovalManagementRequestScope } from './use-approval-experience';
import { ApprovalAdminAttachmentPolicyController } from './approval-admin-attachment-policy-controller';

export function ApprovalSignatureAdmin() {
  const { t, i18n } = useTranslation('approvals');
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const providers = useQuery({
    queryKey: ['approvals', 'admin', 'signatures', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getApprovalSignatureProviders(requestScope.contextScopeKey, signal),
    enabled: scopeReady,
    staleTime: 60_000,
    retry: retryApprovalSignatureRead,
  });
  const sourceState = approvalSignatureSourceState(providers);
  const formatTimestamp = (value?: string | null) =>
    value
      ? formatDate(
          value,
          { dateStyle: 'medium', timeStyle: 'short' },
          resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
        )
      : t('admin.integrations.notAvailable');

  if (!scopeReady) {
    return (
      <ErrorState
        title={t('admin.loadError')}
        description={t('pages.signatures.description')}
        size="compact"
      />
    );
  }

  if (sourceState === 'LOADING') {
    return (
      <LoadingState
        label={t('pages.signatures.title')}
        description={t('pages.signatures.description')}
        variant="skeleton"
        skeletonRows={3}
        size="compact"
      />
    );
  }

  if (sourceState === 'DENIED' || sourceState === 'UNAVAILABLE') {
    return (
      <ErrorState
        title={t('admin.loadError')}
        description={t('admin.signatures.sourceUnavailable')}
        retryLabel={t('actions.retry')}
        retrying={providers.isFetching}
        onRetry={() => void providers.refetch()}
        size="compact"
      />
    );
  }

  return (
    <Stack gap={2}>
      <ApprovalAdminAttachmentPolicyController />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={2}
        sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box minWidth={0}>
          <Box sx={{ typography: 'subtitle2' }}>{t('signatureCeremony.kind')}</Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary', mt: 0.5 }}>
            {t('signatureCeremony.notExternal')}
          </Box>
        </Box>
        <ActionButton
          intent="secondary"
          href="/approvals/requests/submitted"
          endIcon={<ArrowUpRight size={16} />}
          sx={{ alignSelf: 'flex-start', flexShrink: 0 }}
        >
          {t('signatureCeremony.openRequests')}
        </ActionButton>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
          {t('admin.metricDetail')} ·{' '}
          {formatTimestamp(
            providers.dataUpdatedAt ? new Date(providers.dataUpdatedAt).toISOString() : undefined
          )}
        </Box>
        <ActionIconButton
          label={t('actions.refresh')}
          size="small"
          tooltipDisablePortal
          loading={providers.isFetching}
          onClick={() => void providers.refetch()}
        >
          <RefreshCcw size={16} />
        </ActionIconButton>
      </Stack>
      <InlineFeedback severity="warning" icon={<ShieldCheck size={18} />}>
        {t('admin.signatures.gate')}
      </InlineFeedback>
      {sourceState === 'STALE' ? (
        <InlineFeedback severity="warning">
          {t(
            providers.failureReason == null &&
              providers.error == null &&
              providers.failureCount === 0
              ? 'admin.signatures.sourceChecking'
              : 'admin.signatures.sourceStale'
          )}
        </InlineFeedback>
      ) : null}
      {(providers.data?.length ?? 0) === 0 ? (
        <EmptyState
          title={t('admin.signatures.notConfigured')}
          description={t('admin.signatures.gate')}
          icon={<KeyRound size={24} />}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'repeat(3,minmax(0,1fr))' },
            gap: 2,
            '& h2, & h2 + .MuiTypography-root': { overflowWrap: 'anywhere' },
          }}
        >
          {(providers.data ?? []).map((provider) => {
            const capabilities = approvalProviderCapabilityEntries(provider);
            const readiness =
              sourceState === 'READY' ? approvalSignatureReadiness(provider) : 'UNKNOWN';
            return (
              <ApprovalSurface
                key={provider.providerId}
                title={provider.displayName}
                meta={`${provider.providerType} · ${provider.providerKey}`}
              >
                <Stack gap={1.5} sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
                    <StatusChip status={provider.lifecycleState} />
                    <Stack gap={0.5} alignItems="flex-end">
                      <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                        {t('admin.signatures.metadataReadiness')}
                      </Box>
                      <StatusChip status={readiness} />
                    </Stack>
                  </Stack>
                  <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                    {formatTimestamp(provider.lastHealthCheckedAt)}
                  </Box>
                  <Box sx={{ typography: 'body2', color: 'text.secondary' }}>
                    {t(
                      provider.credentialConfigured
                        ? 'admin.signatures.credentialReferenceRegistered'
                        : 'admin.signatures.credentialReferenceMissing'
                    )}
                  </Box>
                  <Divider />
                  {capabilities.length > 0 ? (
                    <Box component="dl" sx={{ m: 0 }}>
                      {capabilities.map((capability) => (
                        <Stack
                          key={capability.key}
                          direction="row"
                          justifyContent="space-between"
                          gap={1}
                          sx={{ py: 0.65 }}
                        >
                          <Box
                            component="dt"
                            sx={{ typography: 'caption', color: 'text.secondary' }}
                          >
                            {t(
                              capability.key === 'remoteSigningSupported'
                                ? 'admin.signatures.declaredProtocolCapability'
                                : `admin.signatures.capabilities.${capability.key}`
                            )}
                          </Box>
                          <Box
                            component="dd"
                            sx={{
                              m: 0,
                              typography: 'caption',
                              fontWeight: 'fontWeightBold',
                              textAlign: 'right',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {t(
                              capability.key === 'remoteSigningSupported'
                                ? capability.value === 'true'
                                  ? 'admin.signatures.protocolDeclared'
                                  : 'admin.signatures.protocolNotDeclared'
                                : capability.value === 'true'
                                  ? 'admin.signatures.capabilitySupported'
                                  : 'admin.signatures.capabilityUnsupported'
                            )}
                          </Box>
                        </Stack>
                      ))}
                    </Box>
                  ) : (
                    <Stack direction="row" alignItems="center" gap={1}>
                      <KeyRound size={16} />
                      <StatusChip status="UNKNOWN" />
                    </Stack>
                  )}
                  <Divider />
                  <Box component="dl" sx={{ m: 0 }}>
                    {(provider.providerType === 'INTERNAL_ATTESTATION'
                      ? ['nativeKeyVerification']
                      : ['adapterVerification', 'probeVerification']
                    ).map((key) => (
                      <Stack key={key} gap={0.5} sx={{ py: 0.65 }}>
                        <Box component="dt" sx={{ typography: 'caption' }}>
                          {t(`admin.signatures.${key}`)}
                        </Box>
                        <Box
                          component="dd"
                          sx={{ m: 0, typography: 'caption', color: 'text.secondary' }}
                        >
                          {t('admin.signatures.verificationNotReported')}
                        </Box>
                      </Stack>
                    ))}
                  </Box>
                </Stack>
              </ApprovalSurface>
            );
          })}
        </Box>
      )}
    </Stack>
  );
}
