import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { ArrowUpRight, Search, ShieldCheck } from 'lucide-react';
import { ActionButton, FormField, GuidedEmptyState } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  AppLifecycleCatalogItem,
  AppLifecycleObservationState,
} from './app-catalog-lifecycle-model';

function observationColor(state: AppLifecycleObservationState) {
  if (state === 'OBSERVED') return 'success' as const;
  if (state === 'UNAVAILABLE') return 'warning' as const;
  return 'default' as const;
}

function Observation({
  label,
  state,
  detail,
}: {
  label: string;
  state: AppLifecycleObservationState;
  detail?: string;
}) {
  const { t } = useTranslation('admin');
  return (
    <Box
      sx={{
        minWidth: 0,
        p: 1.25,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.default',
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
        {label}
      </Typography>
      <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
        <Chip
          size="small"
          variant="outlined"
          color={observationColor(state)}
          label={t(`catalog.applications.observation.${state}`)}
        />
        {detail && (
          <Typography variant="caption" color="text.secondary">
            {detail}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function ApplicationCard({ item }: { item: AppLifecycleCatalogItem }) {
  const { t } = useTranslation('admin');
  const registryDetail =
    item.registry.state === 'OBSERVED'
      ? t('catalog.applications.details.registry', {
          lifecycle: item.registry.lifecycleState,
          scope: item.registry.scope,
          revision: item.registry.revision,
        })
      : undefined;
  const managementLinkAvailable =
    Boolean(item.managementPath) && item.managementAccess === 'OBSERVED';

  return (
    <Box
      component="article"
      data-testid={`application-lifecycle-${item.appKey}`}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        p: 2,
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" variant="h6" noWrap>
            {item.displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {item.appKey}
          </Typography>
        </Box>
        {managementLinkAvailable && item.managementPath ? (
          <ActionButton
            component={NavLink}
            to={item.managementPath}
            intent="quiet"
            size="small"
            endIcon={<ArrowUpRight size={16} />}
          >
            {t('catalog.applications.openManagement')}
          </ActionButton>
        ) : (
          <Chip
            size="small"
            variant="outlined"
            color={observationColor(item.managementAccess)}
            label={t(`catalog.applications.management.${item.managementAccess}`)}
          />
        )}
      </Stack>

      <Box
        sx={{
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        <Observation
          label={t('catalog.applications.stages.registry')}
          state={item.registry.state}
          detail={registryDetail}
        />
        <Observation
          label={t('catalog.applications.stages.tenantBoundary')}
          state={item.tenantAdminBoundary.state}
          detail={
            item.tenantAdminBoundary.state === 'OBSERVED'
              ? t('catalog.applications.details.boundaryCount', {
                  count: item.tenantAdminBoundary.count,
                })
              : undefined
          }
        />
        <Observation
          label={t('catalog.applications.stages.entitlement')}
          state={item.currentActorEntitlement.state}
          detail={
            item.currentActorEntitlement.sources.length
              ? t('catalog.applications.details.accessSources', {
                  sources: item.currentActorEntitlement.sources.join(', '),
                })
              : undefined
          }
        />
        <Observation
          label={t('catalog.applications.stages.installation')}
          state={item.installation.state}
          detail={t('catalog.applications.details.ownerContractUnavailable')}
        />
        <Observation
          label={t('catalog.applications.stages.workforceAssignment')}
          state={item.workforceAssignment.state}
          detail={t('catalog.applications.details.ownerContractUnavailable')}
        />
        <Observation
          label={t('catalog.applications.stages.runnable')}
          state={item.runnable.state}
          detail={
            item.runnable.state === 'OBSERVED'
              ? t('catalog.applications.details.surfaceCount', {
                  count: item.runnable.surfaceCount,
                })
              : undefined
          }
        />
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={0.75}
        alignItems={{ sm: 'center' }}
        sx={{ mt: 1.25 }}
      >
        <ShieldCheck size={17} aria-hidden="true" />
        <Typography variant="caption" color="text.secondary">
          {item.adminAssignments.state === 'UNAVAILABLE'
            ? t('catalog.applications.details.adminAssignmentsUnavailable')
            : t('catalog.applications.details.adminAssignments', {
                active: item.adminAssignments.active,
                pending: item.adminAssignments.pending,
              })}
        </Typography>
      </Stack>
    </Box>
  );
}

export function ApplicationLifecycleCatalog({
  items,
  partialFailure,
}: {
  items: AppLifecycleCatalogItem[];
  partialFailure: boolean;
}) {
  const { t } = useTranslation('admin');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return normalized
      ? items.filter(
          (item) =>
            item.displayName.toLowerCase().includes(normalized) ||
            item.appKey.toLowerCase().includes(normalized)
        )
      : items;
  }, [deferredQuery, items]);

  return (
    <Stack gap={2} data-testid="application-lifecycle-catalog">
      <Box>
        <Typography component="h2" variant="h6">
          {t('catalog.applications.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('catalog.applications.description')}
        </Typography>
      </Box>
      <Alert severity="info">{t('catalog.applications.contractBoundary')}</Alert>
      {partialFailure && (
        <Alert severity="warning">{t('catalog.applications.partialFailure')}</Alert>
      )}
      <FormField
        size="small"
        label={t('catalog.applications.search')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search size={17} />
              </InputAdornment>
            ),
          },
        }}
      />
      {filtered.length ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          {filtered.map((item) => (
            <ApplicationCard key={item.appKey} item={item} />
          ))}
        </Box>
      ) : (
        <GuidedEmptyState
          kind="empty"
          title={t('catalog.applications.emptyTitle')}
          description={t('catalog.applications.emptyDescription')}
        />
      )}
    </Stack>
  );
}
