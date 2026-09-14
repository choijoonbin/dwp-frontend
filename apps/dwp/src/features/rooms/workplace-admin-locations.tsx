import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, FileStack, Layers3, MapPinned, Pencil, Plus, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getWorkplaceAdminFloors,
  getWorkplaceAdminResources,
  getWorkplaceAdminSites,
  useAuth,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';

import { InlineFeedback } from '@dwp-frontend/design-system';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import {
  WorkplaceFloorDialog,
  WorkplaceResourceDialog,
  WorkplaceSiteDialog,
} from './workplace-admin-dialogs';
import { WorkplaceLocationResourceInspector } from './workplace-location-resource-inspector';
import {
  WorkplaceLocationCatalogSummary,
  WORKPLACE_CATALOG_RESOURCE_TYPES,
} from './workplace-location-catalog-summary';
import { workplaceMemberCard } from './workplace-member-surfaces';
import { workplaceHomeSourceData, workplaceHomeSourceState } from './workplace-home-source-state';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { WorkplaceLayoutEditor } from './workplace-layout-editor';
import { useRoomsCapabilities } from './rooms-capabilities';
import { useWorkplaceGovernanceTargetScope } from './workplace-governance-target-scope';
import { RoomsPageHeading, RoomsPermissionNotice } from './rooms-ui';

import type {
  WorkplaceFloor,
  WorkplaceResource,
  WorkplaceResourceType,
  WorkplaceSite,
} from '@dwp-frontend/shared-utils';

export function WorkplaceAdminLocations() {
  const { t } = useTranslation('rooms');
  const navigate = useNavigate();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('lg'));
  const capabilities = useRoomsCapabilities();
  const governance = useWorkplaceGovernanceTargetScope();
  const auth = useAuth();
  const identityKey = JSON.stringify([
    auth.user?.tenantId,
    auth.user?.userId,
    governance.authorityKey,
  ]);
  const activeIdentity = useRef(identityKey);
  activeIdentity.current = identityKey;
  const [params, setParams] = useSearchParams();
  const siteId = params.get('site');
  const floorId = params.get('floor');
  const resourceId = params.get('resource');
  const requestedType = params.get('type') as WorkplaceResourceType | null;
  const selectedType =
    requestedType && WORKPLACE_CATALOG_RESOURCE_TYPES.includes(requestedType)
      ? requestedType
      : 'ALL';
  const view =
    params.get('view') === 'map'
      ? 'map'
      : params.get('view') === 'list'
        ? 'list'
        : compact
          ? 'list'
          : 'map';
  const [editingIdentity, setEditingIdentity] = useState(identityKey);
  const changeParams = useCallback(
    (values: Record<string, string | null>) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(values).forEach(([key, value]) =>
            value ? next.set(key, value) : next.delete(key)
          );
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );
  const setSiteId = useCallback(
    (id: string | null) => changeParams({ site: id, floor: null, resource: null }),
    [changeParams]
  );
  const setFloorId = useCallback(
    (id: string | null) => changeParams({ floor: id, resource: null }),
    [changeParams]
  );
  const [editingSite, setEditingSite] = useState<WorkplaceSite | 'new' | null>(null);
  const [editingFloor, setEditingFloor] = useState<WorkplaceFloor | 'new' | null>(null);
  const [editingResource, setEditingResource] = useState<WorkplaceResource | 'new' | null>(null);
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'sites', identityKey],
    enabled: governance.ready && governance.hierarchy.canView,
    queryFn: async () => {
      const data = await getWorkplaceAdminSites();
      if (activeIdentity.current !== identityKey)
        throw new Error('workplace-location-identity-changed');
      return data;
    },
    staleTime: 30_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const floorsQuery = useQuery({
    queryKey: ['workplace', 'admin', 'floors', identityKey, siteId],
    queryFn: async () => {
      const data = await getWorkplaceAdminFloors(siteId!);
      if (activeIdentity.current !== identityKey)
        throw new Error('workplace-location-identity-changed');
      return data;
    },
    enabled:
      governance.ready &&
      governance.hierarchy.canView &&
      Boolean(siteId) &&
      !sitesQuery.isError &&
      Boolean(sitesQuery.data?.some((site) => site.siteId === siteId)),
    staleTime: 30_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'resources', identityKey, floorId],
    queryFn: async () => {
      const data = await getWorkplaceAdminResources(floorId!);
      if (activeIdentity.current !== identityKey)
        throw new Error('workplace-location-identity-changed');
      return data;
    },
    enabled:
      governance.ready &&
      governance.hierarchy.canView &&
      Boolean(floorId) &&
      !sitesQuery.isError &&
      !floorsQuery.isError &&
      Boolean(
        floorsQuery.data?.some((floor) => floor.floorId === floorId && floor.siteId === siteId)
      ),
    staleTime: 15_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const required = governance.ready && governance.hierarchy.canView;
  const sitesState = workplaceHomeSourceState({ ...sitesQuery, required });
  const floorsState = workplaceHomeSourceState({
    ...floorsQuery,
    required: required && Boolean(siteId),
  });
  const resourcesState = workplaceHomeSourceState({
    ...resourcesQuery,
    required: required && Boolean(floorId),
  });
  const sitesData = workplaceHomeSourceData(sitesState, sitesQuery.data);
  const floorsData = sitesData ? workplaceHomeSourceData(floorsState, floorsQuery.data) : undefined;
  const resourcesData = floorsData
    ? workplaceHomeSourceData(resourcesState, resourcesQuery.data)
    : undefined;
  const sites = useMemo(() => sitesData ?? [], [sitesData]);
  const floors = useMemo(
    () =>
      (floorsData ?? []).filter(
        (floor) =>
          floor.siteId === siteId &&
          governance.allowsTarget('CATALOG_VIEW', floor.siteId, floor.floorId)
      ),
    [floorsData, siteId, governance]
  );
  const resources = (resourcesData ?? []).filter((resource) => resource.floorId === floorId);
  const visibleResources =
    selectedType === 'ALL'
      ? resources
      : resources.filter((resource) => resource.type === selectedType);
  const selectedResource =
    visibleResources.find((resource) => resource.resourceId === resourceId) ??
    (resourceId ? null : (visibleResources[0] ?? null));
  const sitesReady = sitesState === 'READY' && !sitesQuery.isFetching;
  const floorsReady = sitesReady && floorsState === 'READY' && !floorsQuery.isFetching;
  const resourcesReady = floorsReady && resourcesState === 'READY' && !resourcesQuery.isFetching;
  const editingActive = editingIdentity === identityKey;
  useEffect(() => {
    setEditingSite(null);
    setEditingFloor(null);
    setEditingResource(null);
    setEditingIdentity(identityKey);
  }, [identityKey]);
  const selectedSite = sites.find((site) => site.siteId === siteId) ?? null;
  const selectedFloor = floors.find((floor) => floor.floorId === floorId) ?? null;
  const siteManageable = (site: WorkplaceSite | null) =>
    Boolean(
      site &&
      governance.ready &&
      site.countsScope !== 'FLOORS' &&
      site.totalFloorCount !== null &&
      governance.allowsTarget('CATALOG_MANAGE', site.siteId)
    );
  const floorManageable = (floor: WorkplaceFloor | null) =>
    Boolean(
      floor &&
      governance.ready &&
      governance.allowsTarget('CATALOG_MANAGE', floor.siteId, floor.floorId)
    );
  useEffect(() => {
    if (!siteId && sites.length) setSiteId(sites[0].siteId);
    if (siteId && sites.length && !sites.some((site) => site.siteId === siteId)) {
      setSiteId(sites[0].siteId);
    }
  }, [siteId, sites, setSiteId]);
  useEffect(() => {
    if (floorsState !== 'READY' || !selectedSite) return;
    if (!floors.length) {
      setFloorId(null);
      return;
    }
    if (!floorId || !floors.some((floor) => floor.floorId === floorId))
      setFloorId(floors[0].floorId);
  }, [floorId, floors, floorsState, selectedSite, setFloorId]);
  const defaultPosition = useMemo(() => {
    const count = resourcesData?.length ?? 0;
    return { x: 6 + (count % 6) * 12, y: 8 + (Math.floor(count / 6) % 5) * 14 };
  }, [resourcesData?.length]);
  const recheck = async () => {
    const expected = identityKey;
    const sitesResult = await sitesQuery.refetch();
    if (
      activeIdentity.current !== expected ||
      sitesResult.isError ||
      !sitesResult.data?.some((site) => site.siteId === siteId)
    )
      return;
    const floorsResult = await floorsQuery.refetch();
    if (
      activeIdentity.current !== expected ||
      floorsResult.isError ||
      !floorsResult.data?.some((floor) => floor.floorId === floorId)
    )
      return;
    await resourcesQuery.refetch();
  };
  const requestLocation = (nextSiteId: string, nextFloorId: string | null) => {
    changeParams({ site: nextSiteId, floor: nextFloorId, resource: null });
  };

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('workplace.admin.locations.eyebrow')}
        title={t('workplace.admin.locations.title')}
        description={t('workplace.admin.locations.description')}
        actions={
          <Stack direction="row" gap={1} flexWrap="wrap">
            <ActionButton
              intent="secondary"
              startIcon={<RefreshCw size={17} />}
              onClick={() => void recheck()}
              disabled={
                !required ||
                sitesQuery.isFetching ||
                floorsQuery.isFetching ||
                resourcesQuery.isFetching
              }
            >
              {t('workplace.experience.refresh')}
            </ActionButton>
            {capabilities.canCreateWorkplaceAdmin &&
            governance.globalAdministrator &&
            sitesReady ? (
              <ActionButton
                intent="primary"
                startIcon={<Plus size={17} />}
                onClick={() => {
                  setEditingIdentity(identityKey);
                  setEditingSite('new');
                }}
              >
                {t('workplace.admin.locations.addSite')}
              </ActionButton>
            ) : null}
          </Stack>
        }
      />

      {capabilities.isLoaded && !capabilities.canUpdateWorkplaceAdmin && (
        <RoomsPermissionNotice>
          {t(
            capabilities.canCreateWorkplaceAdmin
              ? 'permissions.adminUpdateRestricted'
              : 'permissions.adminCatalogReadOnly'
          )}
        </RoomsPermissionNotice>
      )}

      {(['STALE', 'DENIED', 'UNAVAILABLE'] as string[]).includes(sitesState) && (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => sitesQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.admin.locations.loadError')}
        </InlineFeedback>
      )}
      {sites.length > 0 ? (
        <Box
          sx={(theme) => ({
            ...workplaceMemberCard(theme),
            p: 1.5,
            mb: 2,
            display: { xs: 'block', lg: 'none' },
          })}
        >
          <SelectField
            label={t('workplace.admin.locations.sites')}
            value={siteId ?? ''}
            options={sites.map((site) => ({ value: site.siteId, label: site.name }))}
            onValueChange={(value) => requestLocation(String(value), null)}
          />
        </Box>
      ) : null}
      {sitesQuery.isLoading ? (
        <Skeleton variant="rectangular" height={620} />
      ) : sitesState === 'DENIED' ||
        sitesState === 'UNAVAILABLE' ||
        sitesState === 'SKIPPED' ? null : sites.length === 0 ? (
        <EmptyState
          icon={<Building2 size={28} />}
          title={t('workplace.admin.locations.emptySites')}
          description={t('workplace.admin.locations.emptySitesDescription')}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: selectedResource
                ? 'minmax(170px, .55fr) minmax(0, 1.4fr) minmax(240px, .8fr)'
                : '220px minmax(0, 1fr)',
            },
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          <Box
            component="aside"
            data-testid="workplace-location-site-tree"
            sx={(theme) => ({
              ...workplaceMemberCard(theme),
              display: { xs: 'none', lg: 'block' },
            })}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <Typography fontWeight="fontWeightBold">
                {t('workplace.admin.locations.sites')}
              </Typography>
              <Chip size="small" label={sites.length} />
            </Stack>
            {sites.map((site) => {
              const selected = site.siteId === siteId;
              return (
                <Box
                  key={site.siteId}
                  sx={{
                    position: 'relative',
                    width: '100%',
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: selected ? 'var(--dwp-product-selection)' : 'transparent',
                  }}
                >
                  <Box
                    component="button"
                    type="button"
                    aria-pressed={selected}
                    onClick={() => requestLocation(site.siteId, null)}
                    sx={{
                      width: '100%',
                      minHeight: 78,
                      p: 1.5,
                      pr: capabilities.canUpdateWorkplaceAdmin && siteManageable(site) ? 6 : 1.5,
                      border: 0,
                      bgcolor: 'transparent',
                      color: 'text.primary',
                      textAlign: 'left',
                      cursor: 'pointer',
                      font: 'inherit',
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: -2,
                      },
                      display: 'grid',
                      gridTemplateColumns: '34px minmax(0, 1fr)',
                      gap: 1,
                      alignItems: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'var(--dwp-product-soft)',
                        color: 'var(--dwp-product-accent)',
                      }}
                    >
                      <Building2 size={18} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack gap={0.6} alignItems="start">
                        <Typography
                          variant="body2"
                          fontWeight="fontWeightBold"
                          sx={{ overflowWrap: 'anywhere' }}
                        >
                          {site.name}
                        </Typography>
                        <Chip
                          size="small"
                          color={
                            site.state === 'ACTIVE'
                              ? 'success'
                              : site.state === 'MAINTENANCE'
                                ? 'warning'
                                : 'default'
                          }
                          label={t(`workplace.siteStates.${site.state}`)}
                          sx={{ height: 20, fontSize: 10 }}
                        />
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {t(`workplace.siteTypes.${site.type}`)} ·{' '}
                        {site.countsScope === 'FLOORS' || site.totalFloorCount === null
                          ? t('workplace.experience.visibleFloorCount', {
                              count: site.configuredFloorCount,
                            })
                          : `${site.configuredFloorCount}/${site.totalFloorCount}`}
                      </Typography>
                    </Box>
                  </Box>
                  {capabilities.canUpdateWorkplaceAdmin && sitesReady && siteManageable(site) && (
                    <ActionIconButton
                      size="small"
                      label={t('actions.edit')}
                      sx={{
                        position: 'absolute',
                        top: 20,
                        right: 8,
                      }}
                      onClick={() => setEditingSite(site)}
                    >
                      <Pencil size={15} />
                    </ActionIconButton>
                  )}
                  {selected && floorsState === 'READY' && (
                    <Stack gap={0.25} sx={{ px: 1, pb: 1 }}>
                      {floors.map((floor) => (
                        <ActionButton
                          key={floor.floorId}
                          intent={floor.floorId === floorId ? 'primary' : 'quiet'}
                          size="small"
                          aria-pressed={floor.floorId === floorId}
                          startIcon={<Layers3 size={14} aria-hidden="true" />}
                          onClick={() => requestLocation(site.siteId, floor.floorId)}
                          sx={{ justifyContent: 'space-between', textAlign: 'left', minHeight: 36 }}
                        >
                          <span>{floor.name}</span>
                          <span>{floor.resourceCount}</span>
                        </ActionButton>
                      ))}
                    </Stack>
                  )}
                </Box>
              );
            })}
            {resourcesReady && selectedFloor && (
              <WorkplaceLocationCatalogSummary
                resources={resources}
                selectedType={selectedType}
                onTypeChange={(value) =>
                  changeParams({
                    type: value === 'ALL' ? null : value,
                    resource: null,
                    view: 'list',
                  })
                }
              />
            )}
          </Box>

          <Box data-testid="workplace-location-map-card" sx={workplaceMemberCard}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              gap={1}
              sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <Stack direction="row" gap={1} alignItems="center">
                <MapPinned size={19} color="var(--dwp-product-accent)" />
                <Box>
                  <Stack direction="row" gap={0.8} alignItems="center">
                    <Typography fontWeight="fontWeightBold">{selectedSite?.name}</Typography>
                    {selectedSite && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`workplace.siteStates.${selectedSite.state}`)}
                      />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {selectedSite?.address}
                  </Typography>
                </Box>
              </Stack>
              {capabilities.canCreateWorkplaceAdmin && floorsReady && (
                <Stack direction="row" gap={1}>
                  {siteManageable(selectedSite) ? (
                    <ActionButton
                      intent="secondary"
                      startIcon={<Layers3 size={16} />}
                      onClick={() => setEditingFloor('new')}
                    >
                      {t('workplace.admin.locations.addFloor')}
                    </ActionButton>
                  ) : null}
                  <ActionButton
                    intent="primary"
                    startIcon={<Plus size={16} />}
                    disabled={!floorManageable(selectedFloor) || !resourcesReady}
                    onClick={() => setEditingResource('new')}
                  >
                    {t('workplace.admin.locations.addResource')}
                  </ActionButton>
                </Stack>
              )}
            </Stack>
            {(['STALE', 'DENIED', 'UNAVAILABLE'] as string[]).includes(floorsState) && (
              <InlineFeedback
                severity="error"
                action={
                  <ActionButton intent="quiet" onClick={() => floorsQuery.refetch()}>
                    {t('actions.retry')}
                  </ActionButton>
                }
              >
                {t('workplace.admin.locations.floorLoadError')}
              </InlineFeedback>
            )}
            {floors.length > 0 && (
              <Stack
                direction="row"
                alignItems="center"
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              >
                <Tabs
                  value={floorId ?? false}
                  onChange={(_, value: string) => requestLocation(siteId!, value)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  {floors.map((floor) => (
                    <Tab
                      key={floor.floorId}
                      value={floor.floorId}
                      label={`${floor.name} (${floor.resourceCount}) · ${t(`workplace.floorStates.${floor.state}`)}`}
                    />
                  ))}
                </Tabs>
                {selectedFloor &&
                  capabilities.canUpdateWorkplaceAdmin &&
                  floorsReady &&
                  floorManageable(selectedFloor) && (
                    <ActionIconButton
                      sx={{ mr: 1 }}
                      label={t('workplace.admin.locations.editFloor')}
                      onClick={() => setEditingFloor(selectedFloor)}
                    >
                      <Pencil size={16} />
                    </ActionIconButton>
                  )}
              </Stack>
            )}
            <Box sx={{ p: { xs: 1.25, md: 2 } }}>
              {floorsQuery.isLoading || resourcesQuery.isLoading ? (
                <Skeleton variant="rectangular" height={500} />
              ) : floorsState === 'DENIED' ||
                floorsState === 'UNAVAILABLE' ? null : !selectedFloor ? (
                <EmptyState
                  icon={<Layers3 size={28} />}
                  title={t('workplace.admin.locations.emptyFloors')}
                  description={t('workplace.admin.locations.emptyFloorsDescription')}
                />
              ) : resourcesState === 'DENIED' || resourcesState === 'UNAVAILABLE' ? (
                <InlineFeedback
                  severity="error"
                  action={
                    <ActionButton intent="quiet" onClick={() => resourcesQuery.refetch()}>
                      {t('actions.retry')}
                    </ActionButton>
                  }
                >
                  {t('workplace.admin.locations.resourceLoadError')}
                </InlineFeedback>
              ) : (
                <Stack spacing={1.5}>
                  {compact && resourcesReady && (
                    <WorkplaceLocationCatalogSummary
                      resources={resources}
                      selectedType={selectedType}
                      onTypeChange={(value) =>
                        changeParams({
                          type: value === 'ALL' ? null : value,
                          resource: null,
                          view: 'list',
                        })
                      }
                    />
                  )}
                  <InlineFeedback
                    severity="info"
                    sx={{
                      flexWrap: 'wrap',
                      '& .MuiAlert-message': { flex: '1 1 12rem', overflow: 'visible' },
                      '& .MuiAlert-action': {
                        maxWidth: '100%',
                        ml: 0,
                        pl: 0,
                        width: { xs: '100%', md: 'auto' },
                      },
                    }}
                    action={
                      capabilities.canManageWorkplaceAdmin &&
                      selectedFloor &&
                      governance.floorPlans.canManage &&
                      governance.allowsTarget(
                        'FLOOR_PLAN_MANAGE',
                        selectedFloor.siteId,
                        selectedFloor.floorId
                      ) ? (
                        <ActionButton
                          intent="primary"
                          startIcon={<FileStack size={16} />}
                          sx={{
                            flexShrink: 0,
                            minWidth: { xs: 0, md: 'max-content' },
                            maxWidth: '100%',
                            width: { xs: '100%', md: 'auto' },
                            whiteSpace: { xs: 'normal', md: 'nowrap' },
                            wordBreak: 'keep-all',
                          }}
                          onClick={() => navigate('/workplace/admin/governance?area=floorPlans')}
                        >
                          {t('workplace.admin.locations.manageRelease')}
                        </ActionButton>
                      ) : null
                    }
                  >
                    {t('workplace.admin.locations.governedLayoutNotice')}
                  </InlineFeedback>
                  {resourcesState === 'STALE' ? (
                    <InlineFeedback severity="warning">
                      {t('workplace.staleWarning')}
                    </InlineFeedback>
                  ) : null}
                  <Stack
                    direction="row"
                    gap={1}
                    role="group"
                    aria-label={t('workplace.member.filters.view')}
                  >
                    {(['list', 'map'] as const).map((mode) => (
                      <ActionButton
                        key={mode}
                        intent={mode === view ? 'primary' : 'secondary'}
                        aria-pressed={mode === view}
                        onClick={() => changeParams({ view: mode })}
                      >
                        {t(`workplace.explore.${mode}View`)}
                      </ActionButton>
                    ))}
                  </Stack>
                  {visibleResources.length === 0 && resources.length > 0 ? (
                    <EmptyState
                      title={t('workplace.explore.emptyTitle')}
                      description={t('workplace.explore.emptyDescription')}
                    />
                  ) : (
                    <WorkplaceLayoutEditor
                      floor={selectedFloor}
                      view={view}
                      resources={visibleResources}
                      onEdit={(resource) => setEditingResource(resource)}
                      selectedResourceId={selectedResource?.resourceId ?? null}
                      onSelectResource={(resource) =>
                        changeParams({ resource: resource.resourceId })
                      }
                      editable={false}
                      showResourceEditActions={false}
                    />
                  )}
                </Stack>
              )}
            </Box>
          </Box>
          {selectedResource && selectedSite && selectedFloor ? (
            <WorkplaceLocationResourceInspector
              key={`${identityKey}:${selectedResource.resourceId}`}
              resource={selectedResource}
              site={selectedSite}
              floor={selectedFloor}
              canEdit={
                capabilities.canUpdateWorkplaceAdmin &&
                resourcesReady &&
                floorManageable(selectedFloor)
              }
              onEdit={() => setEditingResource(selectedResource)}
            />
          ) : null}
        </Box>
      )}

      <WorkplaceSiteDialog
        open={
          editingActive &&
          sitesReady &&
          editingSite !== null &&
          (editingSite === 'new' ||
            sites.some(
              (site) => site.siteId === editingSite.siteId && site.version === editingSite.version
            )) &&
          (editingSite === 'new'
            ? capabilities.canCreateWorkplaceAdmin && governance.globalAdministrator
            : capabilities.canUpdateWorkplaceAdmin && siteManageable(editingSite))
        }
        commandSourceReady={sitesReady}
        site={editingSite === 'new' ? null : editingSite}
        onClose={() => setEditingSite(null)}
      />
      <WorkplaceFloorDialog
        open={
          editingActive &&
          floorsReady &&
          editingFloor !== null &&
          (editingFloor === 'new' ||
            floors.some(
              (floor) =>
                floor.floorId === editingFloor.floorId && floor.version === editingFloor.version
            )) &&
          (editingFloor === 'new'
            ? capabilities.canCreateWorkplaceAdmin && siteManageable(selectedSite)
            : capabilities.canUpdateWorkplaceAdmin && floorManageable(editingFloor))
        }
        commandSourceReady={floorsReady}
        siteId={siteId ?? ''}
        floor={editingFloor === 'new' ? null : editingFloor}
        onClose={() => setEditingFloor(null)}
      />
      <WorkplaceResourceDialog
        open={
          editingActive &&
          resourcesReady &&
          floorManageable(selectedFloor) &&
          editingResource !== null &&
          (editingResource === 'new' ||
            resources.some(
              (resource) =>
                resource.resourceId === editingResource.resourceId &&
                resource.version === editingResource.version
            )) &&
          (editingResource === 'new'
            ? capabilities.canCreateWorkplaceAdmin
            : capabilities.canUpdateWorkplaceAdmin)
        }
        commandSourceReady={resourcesReady}
        siteId={siteId ?? ''}
        floorId={floorId ?? ''}
        resource={editingResource === 'new' ? null : editingResource}
        defaultPosition={defaultPosition}
        onClose={() => setEditingResource(null)}
      />
    </PageCanvas>
  );
}
