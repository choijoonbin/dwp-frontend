import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { TenantAccessProjection } from '@dwp-frontend/shared-utils';

import {
  projectionActorEvidenceLabelKey,
  projectionEntitlementTypeLabelKey,
  projectionFreshnessLabelKey,
  projectionLifecycleLabelKey,
  projectionLineageLabelKey,
  projectionOwnerLabelKey,
  projectionScopeLabelKey,
  projectionSourcePresentation,
  projectionSourceTypeLabelKey,
} from './tenant-access-projection-model';

export function TenantAccessProjectionInspector({
  projected,
  coverage,
  loading,
  unavailable,
}: {
  projected?: TenantAccessProjection['principals'][number];
  coverage?: TenantAccessProjection['coverage'];
  loading: boolean;
  unavailable: boolean;
}) {
  const { t } = useTranslation('admin');
  return (
    <Box component="section" aria-labelledby="projected-entitlements-title">
      <Typography id="projected-entitlements-title" component="h3" variant="subtitle2">
        {t('access.projection.inspectorTitle')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('access.projection.inspectorDescription')}
      </Typography>
      {loading && (
        <Stack gap={0.75} sx={{ mt: 1.25 }} aria-label={t('access.projection.loading')}>
          <Skeleton variant="rounded" height={64} />
          <Skeleton variant="rounded" height={64} />
        </Stack>
      )}
      {coverage && (
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
          {coverage.owners.map((owner) => (
            <Chip
              key={owner.ownerKey}
              size="small"
              variant="outlined"
              color={owner.freshnessState === 'FRESH' ? 'success' : 'warning'}
              label={t('access.projection.ownerCoverage', {
                owner: t(projectionOwnerLabelKey(owner.ownerKey)),
                freshness: t(projectionFreshnessLabelKey(owner.freshnessState)),
              })}
            />
          ))}
        </Stack>
      )}
      {!loading && unavailable && (
        <Typography variant="body2" color="warning.main" sx={{ mt: 1.25 }}>
          {t('access.projection.unavailable')}
        </Typography>
      )}
      {!loading && !unavailable && projected?.grants.length ? (
        <Stack sx={{ mt: 1.25, borderTop: 1, borderColor: 'divider' }}>
          {projected.grants.map((grant) => {
            const source = projectionSourcePresentation(grant);
            return (
              <Box
                key={`${grant.entitlementType}:${grant.sourceId}:${grant.entitlementKey}`}
                sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
              >
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {grant.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(projectionEntitlementTypeLabelKey(grant.entitlementType))}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(projectionLifecycleLabelKey(grant.lifecycleState))}
                  />
                </Stack>
                <Stack gap={0.35} sx={{ mt: 0.75 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('access.projection.sourceLine', {
                      source: source.kind === 'literal' ? source.value : t(source.key),
                      sourceType: t(projectionSourceTypeLabelKey(grant.sourceType)),
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('access.projection.scopeLine', {
                      scope: t(projectionScopeLabelKey(grant.scopeType)),
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('access.projection.lineage', {
                      state: t(projectionLineageLabelKey(grant.approvalLineageState)),
                      requester: t(projectionActorEvidenceLabelKey(grant.requestedBy)),
                      approver: t(projectionActorEvidenceLabelKey(grant.approvedBy)),
                      activator: t(projectionActorEvidenceLabelKey(grant.activatedBy)),
                    })}
                  </Typography>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      ) : !loading && !unavailable ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {t('access.projection.noInternalGrants')}
        </Typography>
      ) : null}
    </Box>
  );
}
