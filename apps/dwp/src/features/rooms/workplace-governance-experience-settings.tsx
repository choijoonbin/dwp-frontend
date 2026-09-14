import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { useQuery } from '@tanstack/react-query';
import { InlineFeedback } from '@dwp-frontend/design-system';
import {
  getWorkplaceGovernanceExperienceOverview,
  useAuth,
  usePermissionsStore,
} from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  GovernanceLoading,
  GovernancePanel,
  GovernanceQueryError,
} from './workplace-admin-governance-ui';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { ConnectorEditor, SharingPolicyEditor } from './workplace-governance-experience-forms';

export function WorkplaceGovernanceExperienceSettings({
  canManage,
  canView = canManage,
}: {
  canManage: boolean;
  canView?: boolean;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const { user } = useAuth();
  const permissions = usePermissionsStore((state) => state.permissions);
  const authorityKey = JSON.stringify([user, permissions, canView, canManage]);
  const query = useQuery({
    queryKey: ['workplace', 'governance', 'experience', authorityKey],
    queryFn: getWorkplaceGovernanceExperienceOverview,
    enabled: canView,
    staleTime: 30_000,
    refetchInterval: 15_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const refresh = async () => (await query.refetch()).isSuccess;
  if (!canView)
    return <InlineFeedback severity="info">{t('workplace.experience.readOnly')}</InlineFeedback>;
  if (query.isLoading) return <GovernanceLoading rows={6} />;
  if (query.isError) return <GovernanceQueryError retry={() => void query.refetch()} />;
  const overview = query.data;
  if (!overview) return null;
  const sourceReady = !query.isFetching && !query.isStale;
  const counts = [
    ['bookingRetentionDays', overview.privacy.bookingRetentionDays],
    ['legalHoldCount', overview.privacy.legalHoldCount],
    ['anonymizedBookingCount', overview.privacy.anonymizedBookingCount],
    ['expiredEligibleBookingCount', overview.privacy.expiredEligibleBookingCount],
    [
      'facilityRequestEligibleRetentionCount',
      overview.privacy.facilityRequestEligibleRetentionCount,
    ],
    [
      'facilityClosureEligibleRetentionCount',
      overview.privacy.facilityClosureEligibleRetentionCount,
    ],
    ['facilityRequestsPurgedCount', overview.privacy.facilityRequestsPurgedCount],
    ['facilityClosuresPurgedCount', overview.privacy.facilityClosuresPurgedCount],
  ] as const;
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }} data-testid="governance-experience-settings">
      {!canManage ? (
        <InlineFeedback severity="info">{t('workplace.experience.readOnly')}</InlineFeedback>
      ) : null}
      <GovernancePanel
        title={t('workplace.experience.privacyTitle')}
        description={t('workplace.experience.privacyDescription')}
      >
        <Box
          component="dl"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
            p: 1.5,
            m: 0,
          }}
        >
          {counts.map(([key, value]) => (
            <Box key={key} sx={{ minWidth: 0 }}>
              <Typography component="dt" variant="body2" color="text.secondary">
                {t(`workplace.experience.${key}`)}
              </Typography>
              <Typography component="dd" variant="h5" sx={{ m: 0 }}>
                {formatNumber(value, {}, locale)}
              </Typography>
            </Box>
          ))}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, pb: 1.5 }}>
          {t('workplace.experience.facilityRetentionNotice')}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', px: 1.5, pb: 1.5 }}
        >
          {t('workplace.experience.observedAt', {
            time: formatDate(
              overview.generatedAt,
              { dateStyle: 'medium', timeStyle: 'short' },
              locale
            ),
          })}
        </Typography>
      </GovernancePanel>
      <GovernancePanel
        title={t('workplace.experience.sharingPolicyTitle')}
        description={t('workplace.experience.sharingPolicyDescription')}
      >
        <Box sx={{ p: 1.5 }}>
          <SharingPolicyEditor
            key={`${authorityKey}:policy`}
            policy={overview.policy}
            contextKey={`${authorityKey}:policy`}
            sourceReady={sourceReady}
            canManage={canManage}
            refresh={refresh}
          />
        </Box>
      </GovernancePanel>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {overview.connectors.map((connector) => (
          <ConnectorEditor
            key={`${authorityKey}:${connector.kind}`}
            connector={connector}
            contextKey={`${authorityKey}:${connector.kind}`}
            sourceReady={sourceReady}
            canManage={canManage}
            refresh={refresh}
          />
        ))}
      </Box>
    </Stack>
  );
}
