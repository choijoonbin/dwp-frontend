import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import {
  getWorkplaceGovernanceExperienceOverview,
  useAuth,
  usePermissionsStore,
} from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ConnectorEditor } from './workplace-governance-experience-forms';
import { WorkplaceConnectorOperations } from './workplace-connector-operations';
import {
  GovernanceLoading,
  GovernancePanel,
  GovernanceQueryError,
} from './workplace-admin-governance-ui';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import type { WorkplaceConnectorKind, WorkplaceConnectorStatus } from '@dwp-frontend/shared-utils';

export function summarizeWorkplaceDataSources(
  connectors: readonly Pick<WorkplaceConnectorStatus, 'status'>[]
) {
  return {
    total: connectors.length,
    configured: connectors.filter((connector) => connector.status === 'CONFIGURED_UNVERIFIED')
      .length,
    disabled: connectors.filter((connector) => connector.status === 'DISABLED').length,
    missing: connectors.filter((connector) => connector.status === 'NOT_CONFIGURED').length,
  };
}

export function WorkplaceGovernanceDataSources({
  canManage,
  canView = canManage,
}: {
  canManage: boolean;
  canView?: boolean;
}) {
  const { t } = useTranslation('rooms');
  const { user } = useAuth();
  const permissions = usePermissionsStore((state) => state.permissions);
  const authorityKey = JSON.stringify([user, permissions, canView, canManage]);
  const recoveryScope = user ? `${user.tenantId}:${user.userId}` : null;
  const query = useQuery({
    queryKey: ['workplace', 'governance', 'experience', authorityKey],
    queryFn: getWorkplaceGovernanceExperienceOverview,
    enabled: canView,
    staleTime: 30_000,
    refetchInterval: 15_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const overview = query.data;
  const [selectedConnectorKind, setSelectedConnectorKind] = useState<WorkplaceConnectorKind | ''>(
    ''
  );
  useEffect(() => {
    if (!overview?.connectors.length) return;
    if (overview.connectors.some((connector) => connector.kind === selectedConnectorKind)) return;
    setSelectedConnectorKind(
      overview.connectors.find((connector) => connector.status !== 'NOT_CONFIGURED')?.kind ??
        overview.connectors[0]!.kind
    );
  }, [overview, selectedConnectorKind]);
  const selectedConnector = overview?.connectors.find(
    (connector) => connector.kind === selectedConnectorKind
  );
  const summary = useMemo(
    () => summarizeWorkplaceDataSources(overview?.connectors ?? []),
    [overview?.connectors]
  );
  const refresh = async () => (await query.refetch()).isSuccess;

  if (!canView)
    return <InlineFeedback severity="info">{t('workplace.experience.readOnly')}</InlineFeedback>;

  const sourceReady = !query.isFetching && !query.isStale;
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }} data-testid="workplace-data-sources">
      {!canManage ? (
        <InlineFeedback severity="info">{t('workplace.experience.readOnly')}</InlineFeedback>
      ) : null}
      <WorkplaceConnectorOperations
        authorityKey={authorityKey}
        canManage={canManage}
        recoveryScope={recoveryScope}
      />
      {query.isLoading ? <GovernanceLoading rows={7} /> : null}
      {query.isError ? <GovernanceQueryError retry={() => void query.refetch()} /> : null}
      {overview ? (
        <>
          <GovernancePanel
            title={t('workplace.experience.dataSourcesTitle')}
            description={t('workplace.experience.dataSourcesDescription')}
          >
            <Box
              component="dl"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, 1fr)' },
                m: 0,
                '& > div': { p: 1.5, borderRight: { lg: 1 }, borderColor: 'divider' },
                '& > div:last-of-type': { borderRight: 0 },
              }}
            >
              {(['total', 'configured', 'disabled', 'missing'] as const).map((key) => (
                <Box key={key} sx={{ minWidth: 0 }}>
                  <Typography component="dt" variant="caption" color="text.secondary">
                    {t(`workplace.experience.dataSourceSummary.${key}`)}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="h5"
                    sx={{ m: 0, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {summary[key]}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ px: 1.5, pb: 1.5 }}>
              <InlineFeedback severity={summary.configured ? 'warning' : 'info'}>
                {t('workplace.experience.dataSourceTruthNotice')}
              </InlineFeedback>
            </Box>
          </GovernancePanel>

          <SelectField<WorkplaceConnectorKind>
            label={t('workplace.experience.connectorConfigurationSelect')}
            value={selectedConnectorKind}
            options={overview.connectors.map((connector) => ({
              value: connector.kind,
              label: t(`workplace.experience.connectorKinds.${connector.kind}`),
            }))}
            onValueChange={setSelectedConnectorKind}
          />
          {selectedConnector ? (
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.75 }}
              >
                {t(`workplace.experience.connectorPurposes.${selectedConnector.kind}`)}
              </Typography>
              <ConnectorEditor
                key={selectedConnector.kind}
                connector={selectedConnector}
                contextKey={`${authorityKey}:${selectedConnector.kind}`}
                sourceReady={sourceReady}
                canManage={canManage}
                refresh={refresh}
              />
            </Box>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
