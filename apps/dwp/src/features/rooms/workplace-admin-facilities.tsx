import { foundationTokens } from '@dwp-frontend/design-system';
import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { LoadingState } from '@dwp-frontend/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { NavLink, useSearchParams } from 'react-router-dom';
import {
  ActionButton,
  EmptyState,
  InlineFeedback,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  getWorkplaceAdminFloors,
  getWorkplaceAdminResources,
  getWorkplaceAdminSites,
} from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { WorkplaceAdminSection } from './workplace-admin-experience-ui';
import { useRoomsCapabilities, useWorkplaceGovernanceCapabilities } from './rooms-capabilities';
import {
  workplaceAuthorizedFloorMetadata,
  workplaceAuthorizedFloorContains,
  workplaceCanonicalScopeUuid,
} from './workplace-authorized-floor-metadata';
import { RoomsPageHeading } from './rooms-ui';
import { WorkplaceAdminOperations } from './workplace-admin-operations';
import { WorkplaceFacilityRequests } from './workplace-facility-requests';
import { WorkplaceResourceClosurePanel } from './workplace-resource-closure-panel';
import { WorkplaceResourcePhoto } from './workplace-resource-photo';
import { WorkplaceExperienceQueryError } from './workplace-experience-ui';

export function WorkplaceAdminFacilities() {
  const { t } = useTranslation('rooms');
  const authorityKey = useWorkplaceExperienceAuthority();
  const capabilities = useRoomsCapabilities();
  const governance = useWorkplaceGovernanceCapabilities();
  const identity = authorityKey;
  const [params, setParams] = useSearchParams();
  const [resourceId, setResourceId] = useState('');
  const allowed = capabilities.isLoaded && capabilities.canViewWorkplaceAdmin;
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'facilities', identity, 'sites'],
    queryFn: getWorkplaceAdminSites,
    enabled: allowed,
    staleTime: 15_000,
    retry: false,
  });
  const sites = allowed && !sitesQuery.isError ? (sitesQuery.data ?? []) : [];
  const site = sites.find((item) => item.siteId === params.get('site')) ?? sites[0];
  const authorizedScope = workplaceAuthorizedFloorMetadata(
    site,
    governance.isLoaded && governance.globalAdministrator
  );
  const scopeVerified = Boolean(
    authorizedScope && (authorizedScope.kind !== 'FLOORS' || site?.totalFloorCount === null)
  );
  const scopeKey = JSON.stringify(authorizedScope);
  const floorsQuery = useQuery({
    queryKey: ['workplace', 'facilities', identity, 'floors', site?.siteId, scopeKey],
    queryFn: () => getWorkplaceAdminFloors(site!.siteId),
    enabled: allowed && scopeVerified && Boolean(site),
    staleTime: 15_000,
    retry: false,
  });
  const floorsValid =
    (floorsQuery.data ?? []).every(
      (item) =>
        item.siteId === site?.siteId &&
        workplaceAuthorizedFloorContains(authorizedScope, item.floorId)
    ) &&
    new Set((floorsQuery.data ?? []).map((item) => item.floorId)).size ===
      (floorsQuery.data ?? []).length;
  const floors =
    allowed && scopeVerified && floorsValid && !floorsQuery.isError ? (floorsQuery.data ?? []) : [];
  const requestedFloor = params.get('floor');
  const floor = params.has('floor')
    ? floors.find((item) => item.floorId === requestedFloor)
    : floors[0];
  const invalidFloor = Boolean(requestedFloor && floorsQuery.isSuccess && !floor);
  const catalogReady =
    allowed &&
    scopeVerified &&
    floorsQuery.isSuccess &&
    floorsValid &&
    !invalidFloor &&
    !sitesQuery.isError &&
    !floorsQuery.isError;
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'facilities', identity, 'resources', floor?.floorId, scopeKey],
    queryFn: () => getWorkplaceAdminResources(floor!.floorId),
    enabled: catalogReady && Boolean(site && floor),
    staleTime: 15_000,
    retry: false,
  });
  const resourcesValid = (resourcesQuery.data ?? []).every(
    (item) =>
      workplaceCanonicalScopeUuid(item.resourceId) &&
      Number.isSafeInteger(item.version) &&
      item.version >= 0 &&
      item.siteId === site?.siteId &&
      item.floorId === floor?.floorId &&
      workplaceAuthorizedFloorContains(authorizedScope, item.floorId)
  );
  const resources =
    catalogReady && resourcesValid && !resourcesQuery.isError ? (resourcesQuery.data ?? []) : [];
  const selected = resources.find((item) => item.resourceId === resourceId);
  useEffect(() => setResourceId(''), [identity, site?.siteId, floor?.floorId, scopeKey]);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key === 'site') next.delete('floor');
    setParams(next, { replace: true });
  };
  return (
    <PageCanvas topInset="compact">
      <RoomsPageHeading
        eyebrow={t('workplace.admin.operations.eyebrow')}
        title={t('workplace.experience.polish.operationsWorkspace')}
        description={t('workplace.experience.polish.facilitiesDescription')}
      />
      <Stack gap={2}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 1.25,
            bgcolor: 'var(--dwp-product-soft)',
            borderRadius: foundationTokens.radius.control + 'px',
            p: 1.5,
          }}
        >
          <SelectField
            size="small"
            label={t('workplace.admin.governance.fields.site')}
            value={site?.siteId ?? ''}
            options={sites.map((item) => ({ value: item.siteId, label: item.name }))}
            onValueChange={(value) => update('site', value)}
          />
          <SelectField
            size="small"
            label={t('workplace.admin.governance.fields.floor')}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            value={floor?.floorId ?? ''}
            options={[
              {
                value: '',
                label: t(
                  authorizedScope?.kind === 'FLOORS'
                    ? 'workplace.experience.floorScope.allAuthorizedFloors'
                    : 'workplace.experience.allFloors'
                ),
              },
              ...floors.map((item) => ({ value: item.floorId, label: item.name })),
            ]}
            onValueChange={(value) => update('floor', value)}
          />
          <Stack
            direction="row"
            alignItems="center"
            gap={0.75}
            sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
          >
            <MapPin size={16} aria-hidden="true" />
            <Typography variant="body2" color="text.secondary">
              {site?.timeZone} ·{' '}
              {floor && resourcesQuery.isSuccess && resourcesValid
                ? t('workplace.experience.polish.mapResourceCount', { count: resources.length })
                : t('workplace.experience.floorScope.chooseResourceFloor')}
            </Typography>
          </Stack>
        </Box>
        {authorizedScope?.kind === 'FLOORS' && scopeVerified ? (
          <Typography variant="body2" color="primary.main">
            {t('workplace.experience.floorScope.authorizedScope', {
              count: authorizedScope.floorIds?.length,
            })}
          </Typography>
        ) : null}
        {site && (!scopeVerified || !floorsValid || !resourcesValid || invalidFloor) ? (
          <InlineFeedback severity="warning">
            {t('workplace.experience.floorScope.scopeUnverified')}
          </InlineFeedback>
        ) : null}
        {sitesQuery.isLoading || floorsQuery.isLoading || resourcesQuery.isLoading ? (
          <LoadingState
            embedded
            variant="skeleton"
            skeletonRows={1}
            skeletonHeight={40}
            label={t('workplace.experience.resource')}
          />
        ) : null}
        {sitesQuery.isError || floorsQuery.isError || resourcesQuery.isError ? (
          <WorkplaceExperienceQueryError
            retry={() => {
              void sitesQuery.refetch();
              if (site) void floorsQuery.refetch();
              if (floor) void resourcesQuery.refetch();
            }}
          />
        ) : null}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(230px, .7fr) minmax(0, 2fr)' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <WorkplaceAdminSection
            title={t('workplace.experience.polish.resourceQueue')}
            description={floor?.name ?? t('workplace.experience.floorScope.chooseResourceFloor')}
            tone="soft"
          >
            <Stack gap={0.5} sx={{ maxHeight: { lg: 580 }, overflowY: 'auto' }}>
              {resources.map((item) => (
                <ActionButton
                  key={item.resourceId}
                  intent={selected?.resourceId === item.resourceId ? 'secondary' : 'quiet'}
                  aria-pressed={selected?.resourceId === item.resourceId}
                  onClick={() => setResourceId(item.resourceId)}
                  sx={{
                    width: '100%',
                    textAlign: 'left',
                    justifyContent: 'space-between',
                    gap: 1,
                    py: 1.25,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      fontWeight="fontWeightBold"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.type} · {item.code}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`admin.resources.states.${item.state}`)}
                  />
                </ActionButton>
              ))}
            </Stack>
            {!resources.length && !resourcesQuery.isLoading ? (
              <EmptyState title={t('workplace.experience.selectResource')} />
            ) : null}
          </WorkplaceAdminSection>
          {selected && site ? (
            <Stack gap={2}>
              <WorkplaceAdminSection
                title={t('workplace.experience.resource')}
                description={`${site.name} · ${floor?.name ?? ''}`}
                tone="soft"
              >
                <Stack direction="row" gap={2} justifyContent="space-between" flexWrap="wrap">
                  <Box>
                    <Typography
                      variant="h5"
                      component="h3"
                      fontWeight="fontWeightBold"
                      color="primary.main"
                    >
                      {selected.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selected.code}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t(`workplace.resourceTypes.${selected.type}`)} ·{' '}
                      {t('admin.resources.capacity')}: {selected.capacity}
                    </Typography>
                  </Box>
                  <Chip
                    variant="outlined"
                    size="small"
                    label={t(`admin.resources.states.${selected.state}`)}
                  />
                </Stack>
                {selected.features.length ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}
                  >
                    {selected.features.join(' · ')}
                  </Typography>
                ) : null}
              </WorkplaceAdminSection>
              <WorkplaceResourceClosurePanel resource={selected} timeZone={site.timeZone} />
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                gap={1.5}
                alignItems={{ md: 'center' }}
              >
                <Box sx={{ maxWidth: 220, width: '100%' }}>
                  <WorkplaceResourcePhoto
                    resourceId={selected.resourceId}
                    alt={selected.name}
                    admin
                  />
                </Box>
                <ActionButton
                  component={NavLink}
                  to={`/workplace/admin/locations?site=${encodeURIComponent(site.siteId)}&floor=${encodeURIComponent(selected.floorId)}`}
                  intent="secondary"
                  endIcon={<ArrowUpRight size={15} />}
                >
                  {t('workplace.experience.floorplanManagement')}
                </ActionButton>
              </Stack>
            </Stack>
          ) : (
            <WorkplaceAdminSection title={t('workplace.experience.closure')}>
              <EmptyState title={t('workplace.experience.selectResource')} />
            </WorkplaceAdminSection>
          )}
        </Box>
        {site && catalogReady ? (
          <WorkplaceFacilityRequests
            admin
            siteId={site.siteId}
            floorId={floor?.floorId}
            timeZone={site.timeZone}
            authorizedScope={authorizedScope}
          />
        ) : null}
      </Stack>
    </PageCanvas>
  );
}

export function WorkplaceAdminOperationsWorkspace() {
  const { t } = useTranslation('rooms');
  const [params, setParams] = useSearchParams();
  const facilities = params.get('view') === 'facilities';
  return (
    <>
      <Stack
        component="nav"
        aria-label={t('workplace.admin.operations.tabs.label')}
        direction="row"
        gap={1}
        sx={{ px: { xs: 2, md: 3 }, pt: 2, flexWrap: 'wrap' }}
      >
        {(['operations', 'facilities'] as const).map((value) => (
          <ActionButton
            key={value}
            intent={(value === 'facilities') === facilities ? 'primary' : 'quiet'}
            aria-pressed={(value === 'facilities') === facilities}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('view', value === 'facilities' ? 'facilities' : 'bookings');
              setParams(next, { replace: true });
            }}
          >
            {t(
              value === 'facilities'
                ? 'workplace.experience.closures'
                : 'workplace.admin.operations.title'
            )}
          </ActionButton>
        ))}
      </Stack>
      {facilities ? <WorkplaceAdminFacilities /> : <WorkplaceAdminOperations />}
    </>
  );
}
