import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, FileStack, Layers3, MapPinned, Pencil, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getWorkplaceAdminFloors,
  getWorkplaceAdminResources,
  getWorkplaceAdminSites,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
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
import { WorkplaceLayoutEditor } from './workplace-layout-editor';
import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading, RoomsPermissionNotice } from './rooms-ui';

import type { WorkplaceFloor, WorkplaceResource, WorkplaceSite } from '@dwp-frontend/shared-utils';

export function WorkplaceAdminLocations() {
  const { t } = useTranslation('rooms');
  const navigate = useNavigate();
  const capabilities = useRoomsCapabilities();
  const [siteId, setSiteId] = useState<string | null>(null);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [editingSite, setEditingSite] = useState<WorkplaceSite | 'new' | null>(null);
  const [editingFloor, setEditingFloor] = useState<WorkplaceFloor | 'new' | null>(null);
  const [editingResource, setEditingResource] = useState<WorkplaceResource | 'new' | null>(null);
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'sites'],
    queryFn: getWorkplaceAdminSites,
    staleTime: 30_000,
    retry: 1,
  });
  const floorsQuery = useQuery({
    queryKey: ['workplace', 'admin', 'floors', siteId],
    queryFn: () => getWorkplaceAdminFloors(siteId!),
    enabled: Boolean(siteId),
    staleTime: 30_000,
    retry: 1,
  });
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'resources', floorId],
    queryFn: () => getWorkplaceAdminResources(floorId!),
    enabled: Boolean(floorId),
    staleTime: 15_000,
    retry: 1,
  });
  const sites = useMemo(() => sitesQuery.data ?? [], [sitesQuery.data]);
  const floors = useMemo(() => floorsQuery.data ?? [], [floorsQuery.data]);
  const selectedSite = sites.find((site) => site.siteId === siteId) ?? null;
  const selectedFloor = floors.find((floor) => floor.floorId === floorId) ?? null;
  useEffect(() => {
    if (!siteId && sites.length) setSiteId(sites[0].siteId);
    if (siteId && sites.length && !sites.some((site) => site.siteId === siteId)) {
      setSiteId(sites[0].siteId);
    }
  }, [siteId, sites]);
  useEffect(() => {
    if (!floors.length) {
      setFloorId(null);
      return;
    }
    if (!floorId || !floors.some((floor) => floor.floorId === floorId))
      setFloorId(floors[0].floorId);
  }, [floorId, floors]);
  const defaultPosition = useMemo(() => {
    const count = resourcesQuery.data?.length ?? 0;
    return { x: 6 + (count % 6) * 12, y: 8 + (Math.floor(count / 6) % 5) * 14 };
  }, [resourcesQuery.data?.length]);
  const requestLocation = (nextSiteId: string, nextFloorId: string | null) => {
    setSiteId(nextSiteId);
    setFloorId(nextFloorId);
  };

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('workplace.admin.locations.eyebrow')}
        title={t('workplace.admin.locations.title')}
        description={t('workplace.admin.locations.description')}
        actions={
          capabilities.canCreateWorkplaceAdmin ? (
            <ActionButton
              intent="primary"
              startIcon={<Plus size={17} />}
              onClick={() => setEditingSite('new')}
            >
              {t('workplace.admin.locations.addSite')}
            </ActionButton>
          ) : null
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

      {sitesQuery.isError && (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => sitesQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.admin.locations.loadError')}
        </Alert>
      )}
      {sitesQuery.isLoading ? (
        <Skeleton variant="rectangular" height={620} />
      ) : sites.length === 0 ? (
        <EmptyState
          icon={<Building2 size={28} />}
          title={t('workplace.admin.locations.emptySites')}
          description={t('workplace.admin.locations.emptySitesDescription')}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' },
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          <Box
            component="aside"
            sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <Typography fontWeight={750}>{t('workplace.admin.locations.sites')}</Typography>
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
                      pr: capabilities.canUpdateWorkplaceAdmin ? 6 : 1.5,
                      border: 0,
                      bgcolor: 'transparent',
                      color: 'text.primary',
                      textAlign: 'left',
                      cursor: 'pointer',
                      font: 'inherit',
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
                      <Stack direction="row" gap={0.6} alignItems="center">
                        <Typography variant="body2" fontWeight={750} noWrap>
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
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {t(`workplace.siteTypes.${site.type}`)} · {site.configuredFloorCount}/
                        {site.totalFloorCount}
                      </Typography>
                    </Box>
                  </Box>
                  {capabilities.canUpdateWorkplaceAdmin && (
                    <ActionIconButton
                      size="small"
                      label={t('actions.edit')}
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        right: 8,
                        transform: 'translateY(-50%)',
                      }}
                      onClick={() => setEditingSite(site)}
                    >
                      <Pencil size={15} />
                    </ActionIconButton>
                  )}
                </Box>
              );
            })}
          </Box>

          <Box sx={{ minWidth: 0, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
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
                    <Typography fontWeight={800}>{selectedSite?.name}</Typography>
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
              {capabilities.canCreateWorkplaceAdmin && (
                <Stack direction="row" gap={1}>
                  <ActionButton
                    intent="secondary"
                    startIcon={<Layers3 size={16} />}
                    onClick={() => setEditingFloor('new')}
                  >
                    {t('workplace.admin.locations.addFloor')}
                  </ActionButton>
                  <ActionButton
                    intent="primary"
                    startIcon={<Plus size={16} />}
                    disabled={!selectedFloor}
                    onClick={() => setEditingResource('new')}
                  >
                    {t('workplace.admin.locations.addResource')}
                  </ActionButton>
                </Stack>
              )}
            </Stack>
            {floorsQuery.isError && (
              <Alert
                severity="error"
                action={
                  <ActionButton intent="quiet" onClick={() => floorsQuery.refetch()}>
                    {t('actions.retry')}
                  </ActionButton>
                }
              >
                {t('workplace.admin.locations.floorLoadError')}
              </Alert>
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
                {selectedFloor && capabilities.canUpdateWorkplaceAdmin && (
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
              ) : !selectedFloor ? (
                <EmptyState
                  icon={<Layers3 size={28} />}
                  title={t('workplace.admin.locations.emptyFloors')}
                  description={t('workplace.admin.locations.emptyFloorsDescription')}
                />
              ) : resourcesQuery.isError ? (
                <Alert
                  severity="error"
                  action={
                    <ActionButton intent="quiet" onClick={() => resourcesQuery.refetch()}>
                      {t('actions.retry')}
                    </ActionButton>
                  }
                >
                  {t('workplace.admin.locations.resourceLoadError')}
                </Alert>
              ) : (
                <Stack spacing={1.5}>
                  <Alert
                    severity="info"
                    action={
                      capabilities.canManageWorkplaceAdmin ? (
                        <ActionButton
                          intent="primary"
                          startIcon={<FileStack size={16} />}
                          onClick={() => navigate('/workplace/admin/governance?area=floorPlans')}
                        >
                          {t('workplace.admin.locations.manageRelease')}
                        </ActionButton>
                      ) : null
                    }
                  >
                    {t('workplace.admin.locations.governedLayoutNotice')}
                  </Alert>
                  <WorkplaceLayoutEditor
                    floor={selectedFloor}
                    resources={resourcesQuery.data ?? []}
                    onEdit={(resource) => setEditingResource(resource)}
                    editable={false}
                    showResourceEditActions={capabilities.canUpdateWorkplaceAdmin}
                  />
                </Stack>
              )}
            </Box>
          </Box>
        </Box>
      )}

      <WorkplaceSiteDialog
        open={
          editingSite !== null &&
          (editingSite === 'new'
            ? capabilities.canCreateWorkplaceAdmin
            : capabilities.canUpdateWorkplaceAdmin)
        }
        site={editingSite === 'new' ? null : editingSite}
        onClose={() => setEditingSite(null)}
      />
      <WorkplaceFloorDialog
        open={
          editingFloor !== null &&
          (editingFloor === 'new'
            ? capabilities.canCreateWorkplaceAdmin
            : capabilities.canUpdateWorkplaceAdmin)
        }
        siteId={siteId ?? ''}
        floor={editingFloor === 'new' ? null : editingFloor}
        onClose={() => setEditingFloor(null)}
      />
      <WorkplaceResourceDialog
        open={
          editingResource !== null &&
          (editingResource === 'new'
            ? capabilities.canCreateWorkplaceAdmin
            : capabilities.canUpdateWorkplaceAdmin)
        }
        floorId={floorId ?? ''}
        resource={editingResource === 'new' ? null : editingResource}
        defaultPosition={defaultPosition}
        onClose={() => setEditingResource(null)}
      />
    </PageCanvas>
  );
}
