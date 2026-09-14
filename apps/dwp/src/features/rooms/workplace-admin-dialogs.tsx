import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listPeople,
  saveWorkplaceFloor,
  saveWorkplaceResource,
  saveWorkplaceSite,
  useToast,
} from '@dwp-frontend/shared-utils';
import { AutocompleteField, FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import { InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';

import { useWorkplaceCatalogCommandScope } from './workplace-catalog-command-scope';
import { workplaceHomeSourceData, workplaceHomeSourceState } from './workplace-home-source-state';
import type {
  PersonSummary,
  WorkplaceBookingMode,
  WorkplaceFloor,
  WorkplaceFloorInput,
  WorkplaceResource,
  WorkplaceResourceInput,
  WorkplaceResourceState,
  WorkplaceResourceType,
  WorkplaceSite,
  WorkplaceSiteInput,
  WorkplaceSiteState,
  WorkplaceSiteType,
} from '@dwp-frontend/shared-utils';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const SUPPORTED_TIME_ZONES = ['UTC', ...Intl.supportedValuesOf('timeZone')].filter(
  (value, index, values) => values.indexOf(value) === index
);

export function WorkplaceSiteDialog({
  open,
  site,
  onClose,
  commandSourceReady = true,
}: {
  open: boolean;
  commandSourceReady?: boolean;
  site: WorkplaceSite | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const commandScope = useWorkplaceCatalogCommandScope(
    `site:${site?.siteId ?? 'new'}:${site?.version ?? 0}:${open}`,
    open &&
      commandSourceReady &&
      (!site || (site.totalFloorCount !== null && site.countsScope !== 'FLOORS')),
    !site,
    { siteId: site?.siteId ?? null }
  );
  type SiteForm = Omit<WorkplaceSiteInput, 'totalFloorCount'> & { totalFloorCount: number | null };
  const [form, setForm] = useState<SiteForm>({
    code: '',
    nameKo: '',
    nameEn: '',
    type: 'HEADQUARTERS',
    address: '',
    timeZone: 'Asia/Seoul',
    totalFloorCount: 1,
    state: 'ACTIVE',
    version: 0,
  });
  useEffect(() => {
    if (!open) return;
    setForm(
      site
        ? {
            code: site.code,
            nameKo: site.nameKo,
            nameEn: site.nameEn,
            type: site.type,
            address: site.address,
            timeZone: site.timeZone,
            totalFloorCount: site.totalFloorCount,
            state: site.state,
            version: site.version,
          }
        : {
            code: '',
            nameKo: '',
            nameEn: '',
            type: 'HEADQUARTERS',
            address: '',
            timeZone: 'Asia/Seoul',
            totalFloorCount: 1,
            state: 'ACTIVE',
            version: 0,
          }
    );
  }, [open, site, commandScope.scopeKey]);
  const patch = <K extends keyof SiteForm>(key: K, value: SiteForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const mutation = useMutation({
    mutationFn: (requestedScope: string) => {
      if (
        form.totalFloorCount === null ||
        !Number.isSafeInteger(form.totalFloorCount) ||
        form.totalFloorCount < 1 ||
        site?.countsScope === 'FLOORS'
      )
        throw new Error('workplace-catalog-command-unverified');
      commandScope.begin(requestedScope);
      return saveWorkplaceSite(site?.siteId ?? null, {
        ...form,
        totalFloorCount: form.totalFloorCount,
        version: site ? form.version : null,
      });
    },
    onSuccess: async (_, requestedScope) => {
      if (!commandScope.current(requestedScope)) return;
      toast.success(
        t(site ? 'workplace.admin.locations.siteUpdated' : 'workplace.admin.locations.siteCreated')
      );
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
    },
    onError: (error, requestedScope) => {
      if (!commandScope.current(requestedScope)) return;
      commandScope.reject(requestedScope, error);
      toast.error(errorMessage(error, t('workplace.admin.locations.saveError')));
    },
    onSettled: (_, __, requestedScope) => commandScope.finish(requestedScope),
  });
  const timeZones = SUPPORTED_TIME_ZONES.includes(form.timeZone)
    ? SUPPORTED_TIME_ZONES
    : [form.timeZone, ...SUPPORTED_TIME_ZONES];
  const valid =
    /^[A-Z0-9][A-Z0-9_-]{2,79}$/u.test(form.code) &&
    form.nameKo.trim() &&
    form.nameEn.trim() &&
    form.totalFloorCount !== null &&
    Number.isSafeInteger(form.totalFloorCount) &&
    form.totalFloorCount >= 1 &&
    SUPPORTED_TIME_ZONES.includes(form.timeZone);
  return (
    <FormDialog
      open={open}
      mobileFullScreen
      title={t(site ? 'workplace.admin.locations.editSite' : 'workplace.admin.locations.addSite')}
      description={t('workplace.admin.locations.siteDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!valid || !commandScope.allowed}
      onClose={onClose}
      onSubmit={() => mutation.mutate(commandScope.scopeKey)}
      maxWidth="md"
    >
      {commandScope.failed ? (
        <InlineFeedback severity="warning">
          {t(
            commandScope.unknown
              ? 'workplace.experience.changeUnknown'
              : 'workplace.admin.locations.saveError'
          )}
        </InlineFeedback>
      ) : null}
      <Box
        component="fieldset"
        disabled={!commandScope.allowed || mutation.isPending}
        sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}
      >
        <Stack spacing={2}>
          <Box
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '0.8fr 1fr' }, gap: 1.5 }}
          >
            <FormField
              required
              label={t('workplace.admin.locations.code')}
              value={form.code}
              onChange={(event) => patch('code', event.target.value.toUpperCase())}
            />
            <SelectField
              required
              label={t('workplace.admin.locations.siteType')}
              value={form.type}
              options={(
                ['HEADQUARTERS', 'SHARED_OFFICE', 'SATELLITE', 'CLIENT_SITE'] as WorkplaceSiteType[]
              ).map((value) => ({ value, label: t(`workplace.siteTypes.${value}`) }))}
              onValueChange={(value) => patch('type', value as WorkplaceSiteType)}
            />
          </Box>
          <Box
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}
          >
            <FormField
              required
              label={t('workplace.admin.locations.nameKo')}
              value={form.nameKo}
              onChange={(event) => patch('nameKo', event.target.value)}
            />
            <FormField
              required
              label={t('workplace.admin.locations.nameEn')}
              value={form.nameEn}
              onChange={(event) => patch('nameEn', event.target.value)}
            />
          </Box>
          <FormField
            label={t('workplace.admin.locations.address')}
            value={form.address ?? ''}
            onChange={(event) => patch('address', event.target.value)}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
              gap: 1.5,
            }}
          >
            <AutocompleteField<string>
              autoHighlight
              label={t('workplace.admin.locations.timeZone')}
              options={timeZones}
              value={form.timeZone}
              onChange={(_, value) => {
                if (value) patch('timeZone', value);
              }}
              supportingText={t('workplace.admin.locations.timeZoneHint')}
            />
            <FormField
              type="number"
              label={t('workplace.admin.locations.floorCount')}
              value={form.totalFloorCount ?? ''}
              onChange={(event) =>
                patch(
                  'totalFloorCount',
                  event.target.value === '' ? null : Number(event.target.value)
                )
              }
              inputProps={{ min: 1, max: 300 }}
            />
            <SelectField
              label={t('workplace.admin.locations.state')}
              value={form.state}
              options={(['ACTIVE', 'MAINTENANCE', 'CLOSED'] as WorkplaceSiteState[]).map(
                (value) => ({
                  value,
                  label: t(`workplace.siteStates.${value}`),
                })
              )}
              onValueChange={(value) => patch('state', value as WorkplaceSiteState)}
            />
          </Box>
        </Stack>
      </Box>
    </FormDialog>
  );
}

export function WorkplaceFloorDialog({
  open,
  siteId,
  floor,
  onClose,
  commandSourceReady = true,
}: {
  open: boolean;
  commandSourceReady?: boolean;
  siteId: string;
  floor: WorkplaceFloor | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const commandScope = useWorkplaceCatalogCommandScope(
    `floor:${siteId}:${floor?.floorId ?? 'new'}:${floor?.version ?? 0}:${open}`,
    open && commandSourceReady,
    !floor,
    { siteId, floorId: floor?.floorId ?? null }
  );
  const [form, setForm] = useState<WorkplaceFloorInput>({
    floorNumber: 1,
    nameKo: '1층',
    nameEn: '1F',
    planWidth: 1200,
    planHeight: 760,
    state: 'DRAFT',
    version: 0,
  });
  useEffect(() => {
    if (!open) return;
    setForm(
      floor
        ? {
            floorNumber: floor.floorNumber,
            nameKo: floor.nameKo,
            nameEn: floor.nameEn,
            planWidth: floor.planWidth,
            planHeight: floor.planHeight,
            state: floor.state,
            version: floor.version,
          }
        : {
            floorNumber: 1,
            nameKo: '1층',
            nameEn: '1F',
            planWidth: 1200,
            planHeight: 760,
            state: 'DRAFT',
            version: 0,
          }
    );
  }, [floor, open, commandScope.scopeKey]);
  const patch = <K extends keyof WorkplaceFloorInput>(key: K, value: WorkplaceFloorInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const mutation = useMutation({
    mutationFn: (requestedScope: string) => {
      commandScope.begin(requestedScope);
      return saveWorkplaceFloor(siteId, floor?.floorId ?? null, {
        ...form,
        version: floor ? form.version : null,
      });
    },
    onSuccess: async (_, requestedScope) => {
      if (!commandScope.current(requestedScope)) return;
      toast.success(
        t(
          floor
            ? 'workplace.admin.locations.floorUpdated'
            : 'workplace.admin.locations.floorCreated'
        )
      );
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
    },
    onError: (error, requestedScope) => {
      if (!commandScope.current(requestedScope)) return;
      commandScope.reject(requestedScope, error);
      toast.error(errorMessage(error, t('workplace.admin.locations.saveError')));
    },
    onSettled: (_, __, requestedScope) => commandScope.finish(requestedScope),
  });
  return (
    <FormDialog
      open={open}
      mobileFullScreen
      title={t(
        floor ? 'workplace.admin.locations.editFloor' : 'workplace.admin.locations.addFloor'
      )}
      description={t('workplace.admin.locations.floorDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!form.nameKo.trim() || !form.nameEn.trim() || !commandScope.allowed}
      onClose={onClose}
      onSubmit={() => mutation.mutate(commandScope.scopeKey)}
      maxWidth="md"
    >
      {commandScope.failed ? (
        <InlineFeedback severity="warning">
          {t(
            commandScope.unknown
              ? 'workplace.experience.changeUnknown'
              : 'workplace.admin.locations.saveError'
          )}
        </InlineFeedback>
      ) : null}
      <Box
        component="fieldset"
        disabled={!commandScope.allowed || mutation.isPending}
        sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}
      >
        <Stack spacing={2}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '0.65fr 1fr 1fr' },
              gap: 1.5,
            }}
          >
            <FormField
              type="number"
              label={t('workplace.admin.locations.floorNumber')}
              value={form.floorNumber}
              onChange={(event) => patch('floorNumber', Number(event.target.value))}
              inputProps={{ min: -20, max: 300 }}
            />
            <FormField
              required
              label={t('workplace.admin.locations.nameKo')}
              value={form.nameKo}
              onChange={(event) => patch('nameKo', event.target.value)}
            />
            <FormField
              required
              label={t('workplace.admin.locations.nameEn')}
              value={form.nameEn}
              onChange={(event) => patch('nameEn', event.target.value)}
            />
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
              gap: 1.5,
            }}
          >
            <FormField
              type="number"
              label={t('workplace.admin.locations.planWidth')}
              value={form.planWidth}
              onChange={(event) => patch('planWidth', Number(event.target.value))}
              inputProps={{ min: 400, max: 5000 }}
            />
            <FormField
              type="number"
              label={t('workplace.admin.locations.planHeight')}
              value={form.planHeight}
              onChange={(event) => patch('planHeight', Number(event.target.value))}
              inputProps={{ min: 300, max: 5000 }}
            />
            <SelectField
              label={t('workplace.admin.locations.state')}
              value={form.state}
              options={(['DRAFT', 'ACTIVE', 'CLOSED'] as const).map((value) => ({
                value,
                label: t(`workplace.floorStates.${value}`),
              }))}
              onValueChange={(value) => patch('state', value as WorkplaceFloorInput['state'])}
            />
          </Box>
          <InlineFeedback severity="info">
            {t('workplace.admin.locations.releaseManagedUpload')}
          </InlineFeedback>
        </Stack>
      </Box>
    </FormDialog>
  );
}

export function WorkplaceResourceDialog({
  open,
  siteId,
  floorId,
  resource,
  defaultPosition,
  onClose,
  commandSourceReady = true,
}: {
  open: boolean;
  commandSourceReady?: boolean;
  siteId?: string;
  floorId: string;
  resource: WorkplaceResource | null;
  defaultPosition: { x: number; y: number };
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const canonicalSiteId = siteId ?? resource?.siteId ?? null;
  const commandScope = useWorkplaceCatalogCommandScope(
    `resource:${floorId}:${resource?.resourceId ?? 'new'}:${resource?.version ?? 0}:${open}`,
    open &&
      commandSourceReady &&
      (!resource || (resource.siteId === canonicalSiteId && resource.floorId === floorId)),
    !resource,
    { siteId: canonicalSiteId, floorId }
  );
  const [form, setForm] = useState<WorkplaceResourceInput>({
    code: '',
    nameKo: '',
    nameEn: '',
    type: 'DESK',
    mode: 'RESERVABLE',
    state: 'AVAILABLE',
    neighborhood: '',
    capacity: 1,
    features: [],
    accessible: false,
    approvalRequired: false,
    positionX: defaultPosition.x,
    positionY: defaultPosition.y,
    widthPercent: 8,
    heightPercent: 8,
    rotationDegrees: 0,
    assignedUserId: null,
    assignedPersonPublicId: null,
    assignedDisplayName: null,
    version: 0,
  });
  const [features, setFeatures] = useState('');
  const [personQuery, setPersonQuery] = useState('');
  const deferredPersonQuery = useDeferredValue(personQuery.trim());
  useEffect(() => {
    if (!open) return;
    const next: WorkplaceResourceInput = resource
      ? {
          code: resource.code,
          nameKo: resource.nameKo,
          nameEn: resource.nameEn,
          type: resource.type,
          mode: resource.mode,
          state: resource.state,
          neighborhood: resource.neighborhood,
          capacity: resource.capacity,
          features: resource.features,
          accessible: resource.accessible,
          approvalRequired: resource.approvalRequired,
          positionX: resource.positionX,
          positionY: resource.positionY,
          widthPercent: resource.widthPercent,
          heightPercent: resource.heightPercent,
          rotationDegrees: resource.rotationDegrees,
          assignedUserId: resource.assignedUserId,
          assignedPersonPublicId: resource.assignedPersonPublicId,
          assignedDisplayName: resource.assignedDisplayName,
          version: resource.version,
        }
      : {
          code: '',
          nameKo: '',
          nameEn: '',
          type: 'DESK',
          mode: 'RESERVABLE',
          state: 'AVAILABLE',
          neighborhood: '',
          capacity: 1,
          features: [],
          accessible: false,
          approvalRequired: false,
          positionX: defaultPosition.x,
          positionY: defaultPosition.y,
          widthPercent: 8,
          heightPercent: 8,
          rotationDegrees: 0,
          assignedUserId: null,
          assignedPersonPublicId: null,
          assignedDisplayName: null,
          version: 0,
        };
    setForm(next);
    setFeatures(next.features.join(', '));
    setPersonQuery('');
  }, [defaultPosition.x, defaultPosition.y, open, resource, commandScope.scopeKey]);
  const patch = <K extends keyof WorkplaceResourceInput>(
    key: K,
    value: WorkplaceResourceInput[K]
  ) => setForm((current) => ({ ...current, [key]: value }));
  const peopleQuery = useQuery({
    queryKey: ['workplace', 'directory-assignees', commandScope.scopeKey, deferredPersonQuery],
    queryFn: () =>
      listPeople({
        query: deferredPersonQuery || undefined,
        size: 50,
        surface: 'directory',
      }),
    enabled: open && commandScope.allowed && form.mode === 'ASSIGNED',
    staleTime: 5 * 60_000,
  });
  const peopleState = workplaceHomeSourceState({
    ...peopleQuery,
    required: open && commandScope.allowed && form.mode === 'ASSIGNED',
  });
  const peopleData = workplaceHomeSourceData(peopleState, peopleQuery.data);
  const people = useMemo(() => peopleData?.items ?? [], [peopleData?.items]);
  const assignedPerson = useMemo(
    () => people.find((person) => person.personId === form.assignedPersonPublicId) ?? null,
    [form.assignedPersonPublicId, people]
  );
  const mutation = useMutation({
    mutationFn: (requestedScope: string) => {
      commandScope.begin(requestedScope);
      return saveWorkplaceResource(floorId, resource?.resourceId ?? null, {
        ...form,
        features: features
          .split(',')
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean),
        approvalRequired: form.type === 'ROOM' && form.approvalRequired,
        assignedPersonPublicId: form.mode === 'ASSIGNED' ? form.assignedPersonPublicId : null,
        assignedDisplayName: form.mode === 'ASSIGNED' ? form.assignedDisplayName : null,
        version: resource ? form.version : null,
      });
    },
    onSuccess: async (_, requestedScope) => {
      if (!commandScope.current(requestedScope)) return;
      toast.success(
        t(
          resource
            ? 'workplace.admin.locations.resourceUpdated'
            : 'workplace.admin.locations.resourceCreated'
        )
      );
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
    },
    onError: (error, requestedScope) => {
      if (!commandScope.current(requestedScope)) return;
      commandScope.reject(requestedScope, error);
      toast.error(errorMessage(error, t('workplace.admin.locations.saveError')));
    },
    onSettled: (_, __, requestedScope) => commandScope.finish(requestedScope),
  });
  const assignedValid =
    form.mode !== 'ASSIGNED' || Boolean(form.assignedPersonPublicId || form.assignedUserId);
  const valid =
    /^[A-Z0-9][A-Z0-9_-]{2,79}$/u.test(form.code) &&
    form.nameKo.trim() &&
    form.nameEn.trim() &&
    assignedValid;
  return (
    <FormDialog
      open={open}
      mobileFullScreen
      title={t(
        resource
          ? 'workplace.admin.locations.editResource'
          : 'workplace.admin.locations.addResource'
      )}
      description={t('workplace.admin.locations.resourceDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!valid || !commandScope.allowed}
      onClose={onClose}
      onSubmit={() => mutation.mutate(commandScope.scopeKey)}
      maxWidth="md"
    >
      {commandScope.failed ? (
        <InlineFeedback severity="warning">
          {t(
            commandScope.unknown
              ? 'workplace.experience.changeUnknown'
              : 'workplace.admin.locations.saveError'
          )}
        </InlineFeedback>
      ) : null}
      <Box
        component="fieldset"
        disabled={!commandScope.allowed || mutation.isPending}
        sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}
      >
        <Stack spacing={2}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '0.8fr 1fr 1fr' },
              gap: 1.5,
            }}
          >
            <FormField
              required
              label={t('workplace.admin.locations.code')}
              value={form.code}
              onChange={(event) => patch('code', event.target.value.toUpperCase())}
            />
            <FormField
              required
              label={t('workplace.admin.locations.nameKo')}
              value={form.nameKo}
              onChange={(event) => patch('nameKo', event.target.value)}
            />
            <FormField
              required
              label={t('workplace.admin.locations.nameEn')}
              value={form.nameEn}
              onChange={(event) => patch('nameEn', event.target.value)}
            />
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 1.5,
            }}
          >
            <SelectField
              label={t('workplace.admin.locations.resourceType')}
              value={form.type}
              disabled={Boolean(resource?.calendarResourceId)}
              options={(
                [
                  'ROOM',
                  'DESK',
                  'LOCKER',
                  'PARKING',
                  'FOCUS_POD',
                  'PHONE_BOOTH',
                  'EQUIPMENT',
                ] as WorkplaceResourceType[]
              ).map((value) => ({ value, label: t(`workplace.resourceTypes.${value}`) }))}
              onValueChange={(value) => patch('type', value as WorkplaceResourceType)}
            />
            <SelectField
              label={t('workplace.admin.locations.bookingMode')}
              value={form.mode}
              options={(
                ['RESERVABLE', 'DROP_IN', 'ASSIGNED', 'UNAVAILABLE'] as WorkplaceBookingMode[]
              ).map((value) => ({ value, label: t(`workplace.bookingModes.${value}`) }))}
              onValueChange={(value) => patch('mode', value as WorkplaceBookingMode)}
            />
            <SelectField
              label={t('workplace.admin.locations.state')}
              value={form.state}
              options={(['AVAILABLE', 'MAINTENANCE', 'RETIRED'] as WorkplaceResourceState[]).map(
                (value) => ({ value, label: t(`admin.resources.states.${value}`) })
              )}
              onValueChange={(value) => patch('state', value as WorkplaceResourceState)}
            />
          </Box>
          <Box
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 0.45fr' }, gap: 1.5 }}
          >
            <FormField
              label={t('workplace.admin.locations.neighborhood')}
              value={form.neighborhood ?? ''}
              onChange={(event) => patch('neighborhood', event.target.value)}
            />
            <FormField
              type="number"
              label={t('workplace.admin.locations.capacity')}
              value={form.capacity}
              onChange={(event) => patch('capacity', Number(event.target.value))}
              inputProps={{ min: 1, max: 10000 }}
            />
          </Box>
          <FormField
            label={t('workplace.admin.locations.features')}
            value={features}
            onChange={(event) => setFeatures(event.target.value)}
            supportingText={t('workplace.admin.locations.featuresHint')}
          />
          {form.mode === 'ASSIGNED' && (
            <Stack spacing={1.5}>
              <AutocompleteField<PersonSummary>
                label={t('workplace.admin.locations.assignee')}
                options={people}
                value={assignedPerson}
                loading={peopleQuery.isLoading}
                onInputChange={(_, value, reason) => {
                  if (reason === 'input') setPersonQuery(value);
                }}
                filterOptions={(options) => options}
                getOptionLabel={(person) =>
                  `${person.displayName} · ${person.organizationName ?? ''}`
                }
                isOptionEqualToValue={(option, value) => option.personId === value.personId}
                onChange={(_, person) =>
                  setForm((current) => ({
                    ...current,
                    assignedUserId: null,
                    assignedPersonPublicId: person?.personId ?? null,
                    assignedDisplayName: person?.displayName ?? null,
                  }))
                }
              />
              <FormField
                label={t('workplace.admin.locations.fixedSeatLabel')}
                value={form.assignedDisplayName ?? ''}
                inputProps={{ readOnly: true }}
                supportingText={t('workplace.admin.locations.fixedSeatHint')}
              />
            </Stack>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.accessible}
                  onChange={(_, checked) => patch('accessible', checked)}
                />
              }
              label={t('workplace.admin.locations.accessible')}
            />
            {form.type === 'ROOM' && (
              <FormControlLabel
                control={
                  <Switch
                    checked={form.approvalRequired}
                    onChange={(_, checked) => patch('approvalRequired', checked)}
                  />
                }
                label={t('workplace.admin.locations.approvalRequired')}
              />
            )}
          </Stack>
          <InlineFeedback severity="info">{t('workplace.admin.locations.dragHint')}</InlineFeedback>
        </Stack>
      </Box>
    </FormDialog>
  );
}
