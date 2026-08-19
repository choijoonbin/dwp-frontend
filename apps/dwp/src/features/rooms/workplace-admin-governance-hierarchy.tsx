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
  EmptyState,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  GovernanceEmpty,
  GovernanceLoading,
  GovernancePanel,
  GovernanceQueryError,
} from './workplace-admin-governance-ui';

import type {
  WorkplaceFloor,
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

function jsonObject(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function SelectableRow({
  selected,
  icon,
  title,
  detail,
  trailing,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  detail: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  return (
    <Box sx={{ position: 'relative', borderBottom: 1, borderColor: 'divider' }}>
      <Box
        component={interactive ? 'button' : 'div'}
        type={interactive ? 'button' : undefined}
        aria-pressed={interactive ? selected : undefined}
        onClick={onClick}
        sx={{
          width: '100%',
          minHeight: 68,
          p: 1.25,
          pr: trailing ? 6 : 1.25,
          border: 0,
          bgcolor: selected ? 'var(--dwp-product-selection)' : 'transparent',
          color: 'text.primary',
          cursor: interactive ? 'pointer' : 'default',
          font: 'inherit',
          textAlign: 'left',
          display: 'grid',
          gridTemplateColumns: '32px minmax(0, 1fr)',
          gap: 1,
          alignItems: 'center',
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'var(--dwp-product-soft)',
            color: 'var(--dwp-product-accent)',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={750} noWrap>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {detail}
          </Typography>
        </Box>
      </Box>
      {trailing ? (
        <Box sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
          {trailing}
        </Box>
      ) : null}
    </Box>
  );
}

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
    queryKey: ['workplace', 'governance', 'campuses'],
    queryFn: getWorkplaceGovernanceCampuses,
    staleTime: 30_000,
    retry: 1,
  });
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
  const zonesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'zones', floorId],
    queryFn: () => getWorkplaceGovernanceZones(floorId!),
    enabled: Boolean(floorId),
    staleTime: 20_000,
    retry: 1,
  });
  const sectionsQuery = useQuery({
    queryKey: ['workplace', 'governance', 'sections', zoneId],
    queryFn: () => getWorkplaceGovernanceSections(zoneId!),
    enabled: Boolean(zoneId),
    staleTime: 20_000,
    retry: 1,
  });
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'resources', floorId],
    queryFn: () => getWorkplaceAdminResources(floorId!),
    enabled: Boolean(floorId),
    staleTime: 20_000,
    retry: 1,
  });

  const campuses = useMemo(() => campusesQuery.data ?? [], [campusesQuery.data]);
  const sites = useMemo(() => sitesQuery.data ?? [], [sitesQuery.data]);
  const campusSites = useMemo(() => {
    if (campusId === ALL_CAMPUSES) return sites;
    if (campusId === UNASSIGNED_CAMPUS) return sites.filter((site) => !site.campusId);
    return sites.filter((site) => site.campusId === campusId);
  }, [campusId, sites]);
  const floors = useMemo(() => floorsQuery.data ?? [], [floorsQuery.data]);
  const zones = useMemo(() => zonesQuery.data ?? [], [zonesQuery.data]);
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);

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

  const assignMutation = useMutation({
    mutationFn: ({ site, nextCampusId }: { site: WorkplaceSite; nextCampusId: string }) => {
      if (!canManageCampus) throw new Error('Global campus permission required');
      return assignWorkplaceGovernanceSiteCampus(site.siteId, nextCampusId, site.version);
    },
    onSuccess: async () => {
      setAssigningSite(null);
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'admin', 'sites'] });
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'governance', 'campuses'] });
      toast.success(t('workplace.admin.governance.hierarchy.assignmentSaved'));
    },
    onError: () => toast.error(t('workplace.admin.governance.common.saveError')),
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
                canManage && floorId ? (
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
                    key={zone.zoneId}
                    selected={zone.zoneId === zoneId}
                    icon={<Shapes size={16} />}
                    title={zone.nameKo}
                    detail={`${zone.code} · ${t(`workplace.admin.governance.zoneTypes.${zone.type}`)}`}
                    onClick={() => setZoneId(zone.zoneId)}
                    trailing={
                      canManage ? (
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
                canManage && zoneId ? (
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
                    key={section.sectionId}
                    selected={false}
                    icon={<Layers3 size={16} />}
                    title={section.nameKo}
                    detail={`${section.code} · ${t('workplace.admin.governance.hierarchy.resourceCount', { count: section.resourceCount })}`}
                    trailing={
                      canManage ? (
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

          <GovernancePanel
            title={t('workplace.admin.governance.hierarchy.resources')}
            description={t('workplace.admin.governance.hierarchy.resourceDescription')}
          >
            {resourcesQuery.isLoading ? (
              <GovernanceLoading rows={2} />
            ) : resourcesQuery.isError ? (
              <GovernanceQueryError retry={() => void resourcesQuery.refetch()} />
            ) : resourcesQuery.data?.length ? (
              <Stack divider={<Divider flexItem />}>
                {resourcesQuery.data.map((resource) => (
                  <Stack
                    key={resource.resourceId}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1}
                    sx={{ px: 1.5, py: 1.1 }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {resource.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {resource.code} · {resource.type}
                      </Typography>
                    </Box>
                    <Chip size="small" variant="outlined" label={resource.state} />
                  </Stack>
                ))}
              </Stack>
            ) : (
              <EmptyState
                size="compact"
                icon={<Building2 size={24} />}
                title={t('workplace.admin.governance.hierarchy.emptyResources')}
                description={t('workplace.admin.governance.hierarchy.emptyResourcesDescription')}
              />
            )}
          </GovernancePanel>
        </Stack>
      </Box>

      <CampusDialog
        target={campusEditor}
        canManage={canManageCampus}
        onClose={() => setCampusEditor(null)}
      />
      <SpatialDialog
        kind="zone"
        floorId={floorId}
        zoneId={zoneId}
        target={zoneEditor}
        canManage={canManage}
        onClose={() => setZoneEditor(null)}
      />
      <SpatialDialog
        kind="section"
        floorId={floorId}
        zoneId={zoneId}
        target={sectionEditor}
        canManage={canManage}
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
          if (assigningSite) assignMutation.mutate({ site: assigningSite, nextCampusId });
        }}
      />
    </Stack>
  );
}

function CampusDialog({
  target,
  canManage,
  onClose,
}: {
  target: Editor<WorkplaceGovernanceCampus>;
  canManage: boolean;
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
  const mutation = useMutation({
    mutationFn: () => {
      if (!canManage) throw new Error('Manage permission required');
      return saveWorkplaceGovernanceCampus(campus?.campusId ?? null, form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'governance', 'campuses'] });
      toast.success(t('workplace.admin.governance.common.saved'));
      onClose();
    },
    onError: () => toast.error(t('workplace.admin.governance.common.saveError')),
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
      submitDisabled={!canManage || !valid}
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
    >
      <Stack spacing={2}>
        <FormField
          required
          label={t('workplace.admin.governance.fields.code')}
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <FormField
            required
            label={t('workplace.admin.governance.fields.nameKo')}
            value={form.nameKo}
            onChange={(event) => setForm({ ...form, nameKo: event.target.value })}
          />
          <FormField
            required
            label={t('workplace.admin.governance.fields.nameEn')}
            value={form.nameEn}
            onChange={(event) => setForm({ ...form, nameEn: event.target.value })}
          />
        </Box>
        <SelectField
          label={t('workplace.admin.governance.fields.state')}
          value={form.state}
          options={(['ACTIVE', 'MAINTENANCE', 'CLOSED'] as const).map((value) => ({
            value,
            label: t(`workplace.admin.governance.states.${value}`),
          }))}
          onValueChange={(value) =>
            setForm({ ...form, state: value as WorkplaceGovernanceCampusInput['state'] })
          }
        />
      </Stack>
    </FormDialog>
  );
}

function SpatialDialog({
  kind,
  floorId,
  zoneId,
  target,
  canManage,
  onClose,
}: {
  kind: 'zone' | 'section';
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
  const mutation = useMutation<WorkplaceGovernanceZone | WorkplaceGovernanceSection, Error, void>({
    mutationFn: () => {
      if (!canManage || !parsedBoundary) throw new Error('Invalid spatial command');
      if (kind === 'zone') {
        if (!floorId) throw new Error('Floor required');
        const input: WorkplaceGovernanceZoneInput = {
          code,
          nameKo,
          nameEn,
          type,
          boundary: parsedBoundary,
          state,
          version: existing?.version ?? null,
        };
        return saveWorkplaceGovernanceZone(
          floorId,
          existing && 'zoneId' in existing ? existing.zoneId : null,
          input
        );
      }
      if (!zoneId) throw new Error('Zone required');
      const input: WorkplaceGovernanceSectionInput = {
        code,
        nameKo,
        nameEn,
        boundary: parsedBoundary,
        state,
        version: existing?.version ?? null,
      };
      return saveWorkplaceGovernanceSection(
        zoneId,
        existing && 'sectionId' in existing ? existing.sectionId : null,
        input
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['workplace', 'governance', kind === 'zone' ? 'zones' : 'sections'],
      });
      toast.success(t('workplace.admin.governance.common.saved'));
      onClose();
    },
    onError: () => toast.error(t('workplace.admin.governance.common.saveError')),
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
      submitDisabled={!canManage || !valid}
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
      maxWidth="md"
    >
      <Stack spacing={2}>
        <Box
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '0.8fr 1fr' }, gap: 1.5 }}
        >
          <FormField
            required
            label={t('workplace.admin.governance.fields.code')}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          {kind === 'zone' ? (
            <SelectField
              label={t('workplace.admin.governance.fields.zoneType')}
              value={type}
              options={(
                ['GENERAL', 'WORK_AREA', 'COLLABORATION', 'QUIET', 'SERVICE', 'RESTRICTED'] as const
              ).map((value) => ({
                value,
                label: t(`workplace.admin.governance.zoneTypes.${value}`),
              }))}
              onValueChange={(value) => setType(value as WorkplaceGovernanceZoneType)}
            />
          ) : null}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <FormField
            required
            label={t('workplace.admin.governance.fields.nameKo')}
            value={nameKo}
            onChange={(event) => setNameKo(event.target.value)}
          />
          <FormField
            required
            label={t('workplace.admin.governance.fields.nameEn')}
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
          />
        </Box>
        <SelectField
          label={t('workplace.admin.governance.fields.state')}
          value={state}
          options={(['ACTIVE', 'MAINTENANCE', 'CLOSED'] as const).map((value) => ({
            value,
            label: t(`workplace.admin.governance.states.${value}`),
          }))}
          onValueChange={(value) => setState(value as WorkplaceGovernanceSpatialState)}
        />
        <FormField
          required
          multiline
          minRows={4}
          label={t('workplace.admin.governance.fields.boundary')}
          value={boundary}
          errorMessage={
            !parsedBoundary ? t('workplace.admin.governance.fields.invalidJson') : undefined
          }
          onChange={(event) => setBoundary(event.target.value)}
        />
      </Stack>
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
