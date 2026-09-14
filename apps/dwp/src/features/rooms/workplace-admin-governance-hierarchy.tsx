import {
  jsonObject,
  SelectableRow,
  HierarchyResourcePanel,
  HierarchyCampusFields,
  HierarchySpatialFields,
} from './workplace-governance-hierarchy-leaves';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Layers3, MapPinned, Pencil, Plus, Settings2, Shapes } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  assignWorkplaceGovernanceSiteCampus,
  getWorkplaceAdminFloors,
  getWorkplaceAdminResources,
  getWorkplaceAdminSites,
  getWorkplaceGovernanceCampuses,
  getWorkplaceGovernanceSections,
  getWorkplaceGovernanceZones,
  saveWorkplaceGovernanceCampus,
  saveWorkplaceGovernanceSection,
  saveWorkplaceGovernanceZone,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  GovernanceEmpty,
  GovernanceLoading,
  GovernancePanel,
  GovernanceQueryError,
} from './workplace-admin-governance-ui';

import { useWorkplaceGovernanceTargetScope } from './workplace-governance-target-scope';
import { useWorkplaceCatalogCommandScope } from './workplace-catalog-command-scope';

import type {
  WorkplaceFloor,
  WorkplaceResource,
  WorkplaceGovernanceCampus,
  WorkplaceGovernanceCampusInput,
  WorkplaceGovernanceSection,
  WorkplaceGovernanceSectionInput,
  WorkplaceGovernanceSpatialState,
  WorkplaceGovernanceZone,
  WorkplaceGovernanceZoneInput,
  WorkplaceGovernanceZoneType,
  WorkplaceSite,
} from '@dwp-frontend/shared-utils';

type Editor<T> = T | 'new' | null;
const ALL_CAMPUSES = '__ALL__';
const UNASSIGNED_CAMPUS = '__UNASSIGNED__';

export function WorkplaceAdminGovernanceHierarchy({
  canManage,
  canManageCampus,
}: {
  canManage: boolean;
  canManageCampus: boolean;
}) {
  const { t } = useTranslation('rooms');
  const navigate = useNavigate();
  const toast = useToast();
  const governance = useWorkplaceGovernanceTargetScope();
  const authorityKey = governance.authorityKey;
  const queryClient = useQueryClient();
  const [campusId, setCampusId] = useState(ALL_CAMPUSES);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [campusEditor, setCampusEditor] = useState<Editor<WorkplaceGovernanceCampus>>(null);
  const [zoneEditor, setZoneEditor] = useState<Editor<WorkplaceGovernanceZone>>(null);
  const [sectionEditor, setSectionEditor] = useState<Editor<WorkplaceGovernanceSection>>(null);
  const [assigningSite, setAssigningSite] = useState<WorkplaceSite | null>(null);

  const campusesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'campuses', authorityKey],
    enabled: governance.ready,
    queryFn: getWorkplaceGovernanceCampuses,
    staleTime: 30_000,
    retry: 1,
  });
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'sites', authorityKey],
    enabled: governance.ready,
    queryFn: getWorkplaceAdminSites,
    staleTime: 30_000,
    retry: 1,
  });
  const floorsQuery = useQuery({
    queryKey: ['workplace', 'admin', 'floors', siteId, authorityKey],
    queryFn: () => getWorkplaceAdminFloors(siteId!),
    enabled:
      governance.ready &&
      Boolean(siteId && sitesQuery.data?.some((site) => site.siteId === siteId)) &&
      !sitesQuery.isError,
    staleTime: 30_000,
    retry: 1,
  });
  const zonesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'zones', floorId, authorityKey],
    queryFn: () => getWorkplaceGovernanceZones(floorId!),
    enabled:
      governance.ready &&
      Boolean(
        floorId &&
        floorsQuery.data?.some(
          (floor) =>
            floor.floorId === floorId &&
            floor.siteId === siteId &&
            governance.allowsTarget('CATALOG_VIEW', siteId!, floorId)
        )
      ) &&
      !floorsQuery.isError,
    staleTime: 20_000,
    retry: 1,
  });
  const sectionsQuery = useQuery({
    queryKey: ['workplace', 'governance', 'sections', zoneId, authorityKey],
    queryFn: () => getWorkplaceGovernanceSections(zoneId!),
    enabled:
      governance.ready &&
      Boolean(
        zoneId &&
        zonesQuery.data?.some((zone) => zone.zoneId === zoneId && zone.floorId === floorId)
      ) &&
      !zonesQuery.isError,
    staleTime: 20_000,
    retry: 1,
  });
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'resources', floorId, authorityKey],
    queryFn: () => getWorkplaceAdminResources(floorId!),
    enabled:
      governance.ready &&
      Boolean(
        floorId &&
        floorsQuery.data?.some(
          (floor) =>
            floor.floorId === floorId &&
            floor.siteId === siteId &&
            governance.allowsTarget('CATALOG_VIEW', siteId!, floorId)
        )
      ) &&
      !floorsQuery.isError,
    staleTime: 20_000,
    retry: 1,
  });

  const campuses = useMemo(
    () => (governance.ready && !campusesQuery.isError ? (campusesQuery.data ?? []) : []),
    [governance.ready, campusesQuery.data, campusesQuery.isError]
  );
  const sites = useMemo(
    () => (governance.ready && !sitesQuery.isError ? (sitesQuery.data ?? []) : []),
    [governance.ready, sitesQuery.data, sitesQuery.isError]
  );
  const campusSites = useMemo(() => {
    if (campusId === ALL_CAMPUSES) return sites;
    if (campusId === UNASSIGNED_CAMPUS) return sites.filter((site) => !site.campusId);
    return sites.filter((site) => site.campusId === campusId);
  }, [campusId, sites]);
  const floors = useMemo(
    () =>
      governance.ready && !floorsQuery.isError
        ? (floorsQuery.data ?? []).filter(
            (floor) =>
              floor.siteId === siteId &&
              governance.allowsTarget('CATALOG_VIEW', floor.siteId, floor.floorId)
          )
        : [],
    [governance, siteId, floorsQuery.data, floorsQuery.isError]
  );
  const zones = useMemo(
    () =>
      floors.some((floor) => floor.floorId === floorId) && !zonesQuery.isError
        ? (zonesQuery.data ?? []).filter((zone) => zone.floorId === floorId)
        : [],
    [floorId, floors, zonesQuery.data, zonesQuery.isError]
  );
  const sections = useMemo(
    () =>
      zones.some((zone) => zone.zoneId === zoneId) && !sectionsQuery.isError
        ? (sectionsQuery.data ?? []).filter(
            (section) => section.zoneId === zoneId && section.floorId === floorId
          )
        : [],
    [floorId, zoneId, zones, sectionsQuery.data, sectionsQuery.isError]
  );
  const floorReady =
    governance.ready &&
    !sitesQuery.isFetching &&
    !sitesQuery.isError &&
    !sitesQuery.isStale &&
    !floorsQuery.isFetching &&
    !floorsQuery.isError &&
    !floorsQuery.isStale &&
    floors.some((floor) => floor.floorId === floorId);
  const canManageFloor =
    canManage &&
    floorReady &&
    Boolean(siteId && floorId) &&
    governance.allowsTarget('CATALOG_MANAGE', siteId!, floorId);
  const spatialReady =
    floorReady && !zonesQuery.isError && !zonesQuery.isFetching && !zonesQuery.isStale;
  useEffect(() => {
    setZoneEditor(null);
    setSectionEditor(null);
  }, [authorityKey, siteId, floorId, zoneId]);
  useEffect(() => {
    setCampusEditor(null);
    setAssigningSite(null);
  }, [authorityKey]);

  useEffect(() => {
    if (!campusSites.length) setSiteId(null);
    else if (!campusSites.some((site) => site.siteId === siteId)) {
      setSiteId(campusSites[0].siteId);
    }
  }, [campusSites, siteId]);
  useEffect(() => {
    if (!floors.length) setFloorId(null);
    else if (!floors.some((floor) => floor.floorId === floorId)) setFloorId(floors[0].floorId);
  }, [floorId, floors]);
  useEffect(() => {
    if (!zones.length) setZoneId(null);
    else if (!zones.some((zone) => zone.zoneId === zoneId)) setZoneId(zones[0].zoneId);
  }, [zoneId, zones]);

  const assignScope = useWorkplaceCatalogCommandScope(
    JSON.stringify(['campus-assignment', assigningSite?.siteId, assigningSite?.version]),
    canManageCampus &&
      governance.ready &&
      !sitesQuery.isFetching &&
      !sitesQuery.isError &&
      !sitesQuery.isStale &&
      !campusesQuery.isFetching &&
      !campusesQuery.isError &&
      !campusesQuery.isStale,
    false,
    { siteId: assigningSite?.siteId ?? null }
  );
  const assignMutation = useMutation({
    mutationFn: (command: { scope: string; site: WorkplaceSite; nextCampusId: string }) => {
      if (
        !assignScope.current(command.scope) ||
        !canManageCampus ||
        !campuses.some((campus) => campus.campusId === command.nextCampusId)
      )
        throw new Error('Global campus permission required');
      return assignWorkplaceGovernanceSiteCampus(
        command.site.siteId,
        command.nextCampusId,
        command.site.version
      );
    },
    onSuccess: async (_, command) => {
      if (!assignScope.current(command.scope)) return;
      setAssigningSite(null);
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'admin', 'sites'] });
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'governance', 'campuses'] });
      if (assignScope.current(command.scope))
        toast.success(t('workplace.admin.governance.hierarchy.assignmentSaved'));
    },
    onError: (error, command) => {
      if (assignScope.current(command.scope)) {
        assignScope.reject(command.scope, error);
        toast.error(t('workplace.admin.governance.common.saveError'));
      }
    },
    onSettled: (_, __, command) => assignScope.finish(command.scope),
  });

  if (campusesQuery.isLoading || sitesQuery.isLoading) return <GovernanceLoading rows={7} />;
  if (campusesQuery.isError || sitesQuery.isError) {
    return (
      <GovernanceQueryError
        retry={() => {
          void campusesQuery.refetch();
          void sitesQuery.refetch();
        }}
      />
    );
  }

  return (
    <Stack spacing={2}>
      <Alert severity="info">{t('workplace.admin.governance.hierarchy.catalogBoundary')}</Alert>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(220px, 0.7fr) minmax(260px, 1fr)',
            xl: '300px 360px minmax(0, 1fr)',
          },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <GovernancePanel
          title={t('workplace.admin.governance.hierarchy.campuses')}
          description={t('workplace.admin.governance.hierarchy.campusDescription')}
          actions={
            canManageCampus ? (
              <ActionIconButton
                size="small"
                label={t('workplace.admin.governance.hierarchy.addCampus')}
                onClick={() => setCampusEditor('new')}
              >
                <Plus size={17} />
              </ActionIconButton>
            ) : null
          }
        >
          <SelectableRow
            renderTitle={renderHierarchyRowTitle}
            selected={campusId === ALL_CAMPUSES}
            icon={<Building2 size={17} />}
            title={t('workplace.admin.governance.hierarchy.allBuildings')}
            detail={t('workplace.admin.governance.hierarchy.buildingCount', {
              count: sites.length,
            })}
            onClick={() => {
              setCampusId(ALL_CAMPUSES);
              setSiteId(null);
              setFloorId(null);
              setZoneId(null);
            }}
          />
          <SelectableRow
            renderTitle={renderHierarchyRowTitle}
            selected={campusId === UNASSIGNED_CAMPUS}
            icon={<MapPinned size={17} />}
            title={t('workplace.admin.governance.hierarchy.unassignedBuildings')}
            detail={t('workplace.admin.governance.hierarchy.buildingCount', {
              count: sites.filter((site) => !site.campusId).length,
            })}
            onClick={() => {
              setCampusId(UNASSIGNED_CAMPUS);
              setSiteId(null);
              setFloorId(null);
              setZoneId(null);
            }}
          />
          {campuses.map((campus) => (
            <SelectableRow
              renderTitle={renderHierarchyRowTitle}
              key={campus.campusId}
              selected={campus.campusId === campusId}
              icon={<MapPinned size={17} />}
              title={campus.nameKo}
              detail={`${campus.code} · ${t('workplace.admin.governance.hierarchy.buildingCount', { count: campus.buildingCount })}`}
              onClick={() => {
                setCampusId(campus.campusId);
                setSiteId(null);
                setFloorId(null);
                setZoneId(null);
              }}
              trailing={
                canManageCampus ? (
                  <ActionIconButton
                    size="small"
                    label={t('actions.edit')}
                    onClick={() => setCampusEditor(campus)}
                  >
                    <Pencil size={15} />
                  </ActionIconButton>
                ) : null
              }
            />
          ))}
          {!campuses.length ? (
            <GovernanceEmpty
              title={t('workplace.admin.governance.hierarchy.emptyCampuses')}
              description={t('workplace.admin.governance.hierarchy.emptyCampusesDescription')}
            />
          ) : null}
        </GovernancePanel>

        <GovernancePanel
          title={t('workplace.admin.governance.hierarchy.buildings')}
          description={t('workplace.admin.governance.hierarchy.buildingDescription')}
          actions={
            <ActionIconButton
              size="small"
              label={t('workplace.admin.governance.hierarchy.openCatalog')}
              onClick={() => navigate('/workplace/admin/locations')}
            >
              <Settings2 size={17} />
            </ActionIconButton>
          }
        >
          {campusSites.length ? (
            campusSites.map((site) => (
              <SelectableRow
                renderTitle={renderHierarchyRowTitle}
                key={site.siteId}
                selected={site.siteId === siteId}
                icon={<Building2 size={17} />}
                title={site.name}
                detail={`${site.code} · ${site.timeZone}`}
                onClick={() => {
                  setSiteId(site.siteId);
                  setFloorId(null);
                  setZoneId(null);
                }}
                trailing={
                  canManageCampus && campuses.length ? (
                    <ActionIconButton
                      size="small"
                      label={t('workplace.admin.governance.hierarchy.assignCampus')}
                      onClick={() => setAssigningSite(site)}
                    >
                      <MapPinned size={15} />
                    </ActionIconButton>
                  ) : null
                }
              />
            ))
          ) : (
            <GovernanceEmpty
              title={t('workplace.admin.governance.hierarchy.emptyBuildings')}
              description={t('workplace.admin.governance.hierarchy.emptyBuildingsDescription')}
            />
          )}
        </GovernancePanel>

        <Stack spacing={2} sx={{ gridColumn: { md: '1 / -1', xl: 'auto' } }}>
          <GovernancePanel
            title={t('workplace.admin.governance.hierarchy.floors')}
            description={t('workplace.admin.governance.hierarchy.floorDescription')}
          >
            {floorsQuery.isLoading ? (
              <GovernanceLoading rows={2} />
            ) : floorsQuery.isError ? (
              <GovernanceQueryError retry={() => void floorsQuery.refetch()} />
            ) : floors.length ? (
              <Stack direction="row" gap={1} flexWrap="wrap" sx={{ p: 1.5 }}>
                {floors.map((floor: WorkplaceFloor) => (
                  <ActionButton
                    key={floor.floorId}
                    intent={floor.floorId === floorId ? 'primary' : 'secondary'}
                    startIcon={<Layers3 size={16} />}
                    onClick={() => {
                      setFloorId(floor.floorId);
                      setZoneId(null);
                    }}
                  >
                    {floor.name}
                  </ActionButton>
                ))}
              </Stack>
            ) : (
              <GovernanceEmpty
                title={t('workplace.admin.governance.hierarchy.emptyFloors')}
                description={t('workplace.admin.governance.hierarchy.emptyFloorsDescription')}
              />
            )}
          </GovernancePanel>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
            <GovernancePanel
              title={t('workplace.admin.governance.hierarchy.zones')}
              actions={
                canManageFloor && spatialReady && floorId ? (
                  <ActionIconButton
                    size="small"
                    label={t('workplace.admin.governance.hierarchy.addZone')}
                    onClick={() => setZoneEditor('new')}
                  >
                    <Plus size={17} />
                  </ActionIconButton>
                ) : null
              }
            >
              {zonesQuery.isLoading ? (
                <GovernanceLoading rows={3} />
              ) : zonesQuery.isError ? (
                <GovernanceQueryError retry={() => void zonesQuery.refetch()} />
              ) : zones.length ? (
                zones.map((zone) => (
                  <SelectableRow
                    renderTitle={renderHierarchyRowTitle}
                    key={zone.zoneId}
                    selected={zone.zoneId === zoneId}
                    icon={<Shapes size={16} />}
                    title={zone.nameKo}
                    detail={`${zone.code} · ${t(`workplace.admin.governance.zoneTypes.${zone.type}`)}`}
                    onClick={() => setZoneId(zone.zoneId)}
                    trailing={
                      canManageFloor && spatialReady ? (
                        <ActionIconButton
                          size="small"
                          label={t('actions.edit')}
                          onClick={() => setZoneEditor(zone)}
                        >
                          <Pencil size={15} />
                        </ActionIconButton>
                      ) : null
                    }
                  />
                ))
              ) : (
                <GovernanceEmpty
                  title={t('workplace.admin.governance.hierarchy.emptyZones')}
                  description={t('workplace.admin.governance.hierarchy.emptyZonesDescription')}
                />
              )}
            </GovernancePanel>

            <GovernancePanel
              title={t('workplace.admin.governance.hierarchy.sections')}
              actions={
                canManageFloor &&
                spatialReady &&
                zoneId &&
                !sectionsQuery.isFetching &&
                !sectionsQuery.isError ? (
                  <ActionIconButton
                    size="small"
                    label={t('workplace.admin.governance.hierarchy.addSection')}
                    onClick={() => setSectionEditor('new')}
                  >
                    <Plus size={17} />
                  </ActionIconButton>
                ) : null
              }
            >
              {sectionsQuery.isLoading ? (
                <GovernanceLoading rows={3} />
              ) : sectionsQuery.isError ? (
                <GovernanceQueryError retry={() => void sectionsQuery.refetch()} />
              ) : sections.length ? (
                sections.map((section) => (
                  <SelectableRow
                    renderTitle={renderHierarchyRowTitle}
                    key={section.sectionId}
                    selected={false}
                    icon={<Layers3 size={16} />}
                    title={section.nameKo}
                    detail={`${section.code} · ${t('workplace.admin.governance.hierarchy.resourceCount', { count: section.resourceCount })}`}
                    trailing={
                      canManageFloor && spatialReady ? (
                        <ActionIconButton
                          size="small"
                          label={t('actions.edit')}
                          onClick={() => setSectionEditor(section)}
                        >
                          <Pencil size={15} />
                        </ActionIconButton>
                      ) : null
                    }
                  />
                ))
              ) : (
                <GovernanceEmpty
                  title={t('workplace.admin.governance.hierarchy.emptySections')}
                  description={t('workplace.admin.governance.hierarchy.emptySectionsDescription')}
                />
              )}
            </GovernancePanel>
          </Box>

          <HierarchyResourcePanel
            t={t}
            loading={resourcesQuery.isLoading}
            failed={resourcesQuery.isError}
            hasResources={
              !resourcesQuery.isError &&
              resourcesQuery.data?.some(
                (resource) => resource.siteId === siteId && resource.floorId === floorId
              )
            }
            resources={
              resourcesQuery.data?.filter(
                (resource) => resource.siteId === siteId && resource.floorId === floorId
              ) ?? []
            }
            retry={() => void resourcesQuery.refetch()}
            renderName={renderHierarchyResourceName}
          />
        </Stack>
      </Box>

      <CampusDialog
        target={campusEditor}
        canManage={canManageCampus}
        sourceReady={!campusesQuery.isFetching && !campusesQuery.isError && !campusesQuery.isStale}
        onClose={() => setCampusEditor(null)}
      />
      <SpatialDialog
        kind="zone"
        floorId={floorId}
        zoneId={zoneId}
        target={zoneEditor}
        siteId={siteId}
        canManage={canManageFloor}
        sourceReady={spatialReady}
        onRecheck={async () =>
          (
            await Promise.all([sitesQuery.refetch(), floorsQuery.refetch(), zonesQuery.refetch()])
          ).every((result) => result.isSuccess)
        }
        onClose={() => setZoneEditor(null)}
      />
      <SpatialDialog
        kind="section"
        floorId={floorId}
        zoneId={zoneId}
        target={sectionEditor}
        siteId={siteId}
        canManage={canManageFloor}
        sourceReady={
          spatialReady &&
          !sectionsQuery.isFetching &&
          !sectionsQuery.isError &&
          !sectionsQuery.isStale
        }
        onRecheck={async () =>
          (
            await Promise.all([
              sitesQuery.refetch(),
              floorsQuery.refetch(),
              zonesQuery.refetch(),
              sectionsQuery.refetch(),
            ])
          ).every((result) => result.isSuccess)
        }
        onClose={() => setSectionEditor(null)}
      />
      <AssignCampusDialog
        site={assigningSite}
        campuses={campuses}
        selectedCampusId={
          assigningSite?.campusId ??
          (campusId === ALL_CAMPUSES || campusId === UNASSIGNED_CAMPUS ? '' : campusId)
        }
        busy={assignMutation.isPending}
        onClose={() => setAssigningSite(null)}
        onSubmit={(nextCampusId) => {
          if (!assigningSite || !assignScope.allowed) return;
          try {
            assignScope.begin(assignScope.scopeKey);
          } catch {
            return;
          }
          assignMutation.mutate({ scope: assignScope.scopeKey, site: assigningSite, nextCampusId });
        }}
      />
    </Stack>
  );
}

function CampusDialog({
  target,
  canManage,
  sourceReady,
  onClose,
}: {
  target: Editor<WorkplaceGovernanceCampus>;
  canManage: boolean;
  sourceReady: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const campus = target && target !== 'new' ? target : null;
  const [form, setForm] = useState<WorkplaceGovernanceCampusInput>({
    code: '',
    nameKo: '',
    nameEn: '',
    state: 'ACTIVE',
    version: null,
  });
  useEffect(() => {
    if (!target) return;
    setForm(
      campus
        ? {
            code: campus.code,
            nameKo: campus.nameKo,
            nameEn: campus.nameEn,
            state: campus.state,
            version: campus.version,
          }
        : { code: '', nameKo: '', nameEn: '', state: 'ACTIVE', version: null }
    );
  }, [campus, target]);
  const commandScope = useWorkplaceCatalogCommandScope(
    JSON.stringify(['campus', campus, Boolean(target)]),
    canManage && sourceReady,
    !campus,
    { siteId: null }
  );
  const mutation = useMutation({
    mutationFn: (command: {
      scope: string;
      campusId: string | null;
      input: WorkplaceGovernanceCampusInput;
    }) => {
      if (!commandScope.current(command.scope)) throw new Error('Manage permission required');
      return saveWorkplaceGovernanceCampus(command.campusId, command.input);
    },
    onSuccess: async (_, command) => {
      if (!commandScope.current(command.scope)) return;
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'governance', 'campuses'] });
      if (commandScope.current(command.scope))
        toast.success(t('workplace.admin.governance.common.saved'));
    },
    onError: (error, command) => {
      if (commandScope.current(command.scope)) {
        commandScope.reject(command.scope, error);
        toast.error(t('workplace.admin.governance.common.saveError'));
      }
    },
    onSettled: (_, __, command) => commandScope.finish(command.scope),
  });

  const valid =
    /^[A-Z0-9][A-Z0-9_-]{2,79}$/u.test(form.code) && form.nameKo.trim() && form.nameEn.trim();
  return (
    <FormDialog
      open={Boolean(target)}
      title={t(
        campus
          ? 'workplace.admin.governance.hierarchy.editCampus'
          : 'workplace.admin.governance.hierarchy.addCampus'
      )}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!commandScope.allowed || !valid}
      onClose={onClose}
      onSubmit={() => {
        if (!valid || !commandScope.allowed) return;
        try {
          commandScope.begin(commandScope.scopeKey);
        } catch {
          return;
        }
        mutation.mutate({
          scope: commandScope.scopeKey,
          campusId: campus?.campusId ?? null,
          input: { ...form },
        });
      }}
    >
      <HierarchyCampusFields
        t={t}
        form={form}
        onCodeChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
        onNameKoChange={(event) => setForm({ ...form, nameKo: event.target.value })}
        onNameEnChange={(event) => setForm({ ...form, nameEn: event.target.value })}
        onStateChange={(value) =>
          setForm({ ...form, state: value as WorkplaceGovernanceCampusInput['state'] })
        }
      />
    </FormDialog>
  );
}

function SpatialDialog({
  kind,
  siteId,
  sourceReady,
  onRecheck,
  floorId,
  zoneId,
  target,
  canManage,
  onClose,
}: {
  kind: 'zone' | 'section';
  siteId: string | null;
  sourceReady: boolean;
  onRecheck: () => Promise<boolean>;
  floorId: string | null;
  zoneId: string | null;
  target: Editor<WorkplaceGovernanceZone> | Editor<WorkplaceGovernanceSection>;
  canManage: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const existing = target && target !== 'new' ? target : null;
  const [code, setCode] = useState('');
  const [nameKo, setNameKo] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [state, setState] = useState<WorkplaceGovernanceSpatialState>('ACTIVE');
  const [type, setType] = useState<WorkplaceGovernanceZoneType>('GENERAL');
  const [boundary, setBoundary] = useState('{}');
  useEffect(() => {
    if (!target) return;
    setCode(existing?.code ?? '');
    setNameKo(existing?.nameKo ?? '');
    setNameEn(existing?.nameEn ?? '');
    setState(existing?.state ?? 'ACTIVE');
    setBoundary(JSON.stringify(existing?.boundary ?? {}, null, 2));
    setType(existing && 'type' in existing ? existing.type : 'GENERAL');
  }, [existing, target]);
  const parsedBoundary = jsonObject(boundary);
  const commandScope = useWorkplaceCatalogCommandScope(
    JSON.stringify([kind, floorId, zoneId, existing, Boolean(target)]),
    canManage && sourceReady && Boolean(siteId && floorId),
    !existing,
    { siteId, floorId }
  );
  const mutation = useMutation({
    mutationFn: async (command: {
      scope: string;
      parentId: string;
      existingId: string | null;
      input: WorkplaceGovernanceZoneInput | WorkplaceGovernanceSectionInput;
    }): Promise<WorkplaceGovernanceZone | WorkplaceGovernanceSection> => {
      if (!commandScope.current(command.scope)) throw new Error('Invalid spatial command');
      return kind === 'zone'
        ? saveWorkplaceGovernanceZone(
            command.parentId,
            command.existingId,
            command.input as WorkplaceGovernanceZoneInput
          )
        : saveWorkplaceGovernanceSection(command.parentId, command.existingId, command.input);
    },
    onSuccess: async (_, command) => {
      if (!commandScope.current(command.scope)) return;
      onClose();
      await queryClient.invalidateQueries({
        queryKey: ['workplace', 'governance', kind === 'zone' ? 'zones' : 'sections'],
      });
      if (commandScope.current(command.scope))
        toast.success(t('workplace.admin.governance.common.saved'));
    },
    onError: (error, command) => {
      if (commandScope.current(command.scope)) {
        commandScope.reject(command.scope, error);
        toast.error(t('workplace.admin.governance.common.saveError'));
      }
    },
    onSettled: (_, __, command) => commandScope.finish(command.scope),
  });
  const valid =
    /^[A-Z0-9][A-Z0-9_-]{2,79}$/u.test(code) && nameKo.trim() && nameEn.trim() && parsedBoundary;
  return (
    <FormDialog
      open={Boolean(target)}
      title={t(
        `workplace.admin.governance.hierarchy.${existing ? 'edit' : 'add'}${kind === 'zone' ? 'Zone' : 'Section'}`
      )}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!commandScope.allowed || !valid}
      onClose={onClose}
      onSubmit={() => {
        const parentId = kind === 'zone' ? floorId : zoneId;
        if (!parentId || !parsedBoundary || !valid || !commandScope.allowed) return;
        const input = {
          code,
          nameKo,
          nameEn,
          boundary: parsedBoundary,
          state,
          version: existing?.version ?? null,
          ...(kind === 'zone' ? { type } : {}),
        };
        try {
          commandScope.begin(commandScope.scopeKey);
        } catch {
          return;
        }
        mutation.mutate({
          scope: commandScope.scopeKey,
          parentId,
          existingId: existing
            ? kind === 'zone' && 'zoneId' in existing
              ? existing.zoneId
              : 'sectionId' in existing
                ? existing.sectionId
                : null
            : null,
          input,
        });
      }}
      maxWidth="md"
    >
      {commandScope.failed ? (
        <GovernanceQueryError
          retry={() =>
            void (async () => {
              const expected = commandScope.scopeKey;
              if (await onRecheck()) commandScope.recover(expected);
            })()
          }
        />
      ) : null}
      <HierarchySpatialFields
        t={t}
        kind={kind}
        code={code}
        nameKo={nameKo}
        nameEn={nameEn}
        state={state}
        type={type}
        boundary={boundary}
        parsedBoundary={parsedBoundary}
        onCodeChange={(event) => setCode(event.target.value.toUpperCase())}
        onTypeChange={(value) => setType(value as WorkplaceGovernanceZoneType)}
        onNameKoChange={(event) => setNameKo(event.target.value)}
        onNameEnChange={(event) => setNameEn(event.target.value)}
        onStateChange={(value) => setState(value as WorkplaceGovernanceSpatialState)}
        onBoundaryChange={(event) => setBoundary(event.target.value)}
      />
    </FormDialog>
  );
}

function AssignCampusDialog({
  site,
  campuses,
  selectedCampusId,
  busy,
  onClose,
  onSubmit,
}: {
  site: WorkplaceSite | null;
  campuses: WorkplaceGovernanceCampus[];
  selectedCampusId: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (campusId: string) => void;
}) {
  const { t } = useTranslation('rooms');
  const [nextCampusId, setNextCampusId] = useState('');
  useEffect(() => {
    if (site) setNextCampusId(selectedCampusId ?? campuses[0]?.campusId ?? '');
  }, [campuses, selectedCampusId, site]);
  return (
    <FormDialog
      open={Boolean(site)}
      title={t('workplace.admin.governance.hierarchy.assignCampus')}
      description={site?.name}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={busy}
      submitDisabled={!nextCampusId}
      onClose={onClose}
      onSubmit={() => onSubmit(nextCampusId)}
    >
      <SelectField
        label={t('workplace.admin.governance.hierarchy.campus')}
        value={nextCampusId}
        options={campuses.map((campus) => ({
          value: campus.campusId,
          label: `${campus.nameKo} (${campus.code})`,
        }))}
        onValueChange={setNextCampusId}
      />
    </FormDialog>
  );
}

function renderHierarchyRowTitle(title: string) {
  return (
    <Typography variant="body2" fontWeight={750} noWrap>
      {title}
    </Typography>
  );
}
function renderHierarchyResourceName(resource: WorkplaceResource) {
  return (
    <Typography variant="body2" fontWeight={700} noWrap>
      {resource.name}
    </Typography>
  );
}
