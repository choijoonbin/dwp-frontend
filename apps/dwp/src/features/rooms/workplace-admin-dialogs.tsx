import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageUp } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listPeople,
  saveWorkplaceFloor,
  saveWorkplaceResource,
  saveWorkplaceSite,
  uploadWorkplaceFloorBackground,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  AutocompleteField,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';

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

export function WorkplaceSiteDialog({
  open,
  site,
  onClose,
}: {
  open: boolean;
  site: WorkplaceSite | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<WorkplaceSiteInput>({
    code: '', nameKo: '', nameEn: '', type: 'HEADQUARTERS', address: '', timeZone: 'Asia/Seoul',
    totalFloorCount: 1, state: 'ACTIVE', version: 0,
  });
  useEffect(() => {
    if (!open) return;
    setForm(site
      ? {
          code: site.code, nameKo: site.nameKo, nameEn: site.nameEn, type: site.type,
          address: site.address, timeZone: site.timeZone, totalFloorCount: site.totalFloorCount,
          state: site.state, version: site.version,
        }
      : {
          code: '', nameKo: '', nameEn: '', type: 'HEADQUARTERS', address: '',
          timeZone: 'Asia/Seoul', totalFloorCount: 1, state: 'ACTIVE', version: 0,
        });
  }, [open, site]);
  const patch = <K extends keyof WorkplaceSiteInput>(key: K, value: WorkplaceSiteInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const mutation = useMutation({
    mutationFn: () => saveWorkplaceSite(site?.siteId ?? null, { ...form, version: site ? form.version : null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      toast.success(t(site ? 'workplace.admin.locations.siteUpdated' : 'workplace.admin.locations.siteCreated'));
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, t('workplace.admin.locations.saveError'))),
  });
  const valid = /^[A-Z0-9][A-Z0-9_-]{2,79}$/u.test(form.code) && form.nameKo.trim() && form.nameEn.trim();
  return (
    <FormDialog
      open={open}
      title={t(site ? 'workplace.admin.locations.editSite' : 'workplace.admin.locations.addSite')}
      description={t('workplace.admin.locations.siteDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
      maxWidth="md"
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '0.8fr 1fr' }, gap: 1.5 }}>
          <FormField required label={t('workplace.admin.locations.code')} value={form.code} onChange={(event) => patch('code', event.target.value.toUpperCase())} />
          <SelectField
            required label={t('workplace.admin.locations.siteType')} value={form.type}
            options={(['HEADQUARTERS', 'SHARED_OFFICE', 'SATELLITE', 'CLIENT_SITE'] as WorkplaceSiteType[]).map((value) => ({ value, label: t(`workplace.siteTypes.${value}`) }))}
            onValueChange={(value) => patch('type', value as WorkplaceSiteType)}
          />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <FormField required label={t('workplace.admin.locations.nameKo')} value={form.nameKo} onChange={(event) => patch('nameKo', event.target.value)} />
          <FormField required label={t('workplace.admin.locations.nameEn')} value={form.nameEn} onChange={(event) => patch('nameEn', event.target.value)} />
        </Box>
        <FormField label={t('workplace.admin.locations.address')} value={form.address ?? ''} onChange={(event) => patch('address', event.target.value)} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5 }}>
          <FormField label={t('workplace.admin.locations.timeZone')} value={form.timeZone} onChange={(event) => patch('timeZone', event.target.value)} />
          <FormField type="number" label={t('workplace.admin.locations.floorCount')} value={form.totalFloorCount} onChange={(event) => patch('totalFloorCount', Number(event.target.value))} inputProps={{ min: 1, max: 300 }} />
          <SelectField
            label={t('workplace.admin.locations.state')} value={form.state}
            options={(['ACTIVE', 'MAINTENANCE', 'CLOSED'] as WorkplaceSiteState[]).map((value) => ({ value, label: t(`workplace.siteStates.${value}`) }))}
            onValueChange={(value) => patch('state', value as WorkplaceSiteState)}
          />
        </Box>
      </Stack>
    </FormDialog>
  );
}

export function WorkplaceFloorDialog({
  open,
  siteId,
  floor,
  onClose,
}: {
  open: boolean;
  siteId: string;
  floor: WorkplaceFloor | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<WorkplaceFloorInput>({
    floorNumber: 1, nameKo: '1층', nameEn: '1F', planWidth: 1200, planHeight: 760,
    state: 'DRAFT', version: 0,
  });
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setForm(floor
      ? {
          floorNumber: floor.floorNumber, nameKo: floor.nameKo, nameEn: floor.nameEn,
          planWidth: floor.planWidth, planHeight: floor.planHeight, state: floor.state,
          version: floor.version,
        }
      : { floorNumber: 1, nameKo: '1층', nameEn: '1F', planWidth: 1200, planHeight: 760, state: 'DRAFT', version: 0 });
  }, [floor, open]);
  const patch = <K extends keyof WorkplaceFloorInput>(key: K, value: WorkplaceFloorInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const mutation = useMutation({
    mutationFn: async () => {
      const saved = await saveWorkplaceFloor(siteId, floor?.floorId ?? null, {
        ...form, version: floor ? form.version : null,
      });
      return file ? uploadWorkplaceFloorBackground(saved.floorId, saved.version, file) : saved;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      toast.success(t(floor ? 'workplace.admin.locations.floorUpdated' : 'workplace.admin.locations.floorCreated'));
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, t('workplace.admin.locations.saveError'))),
  });
  return (
    <FormDialog
      open={open}
      title={t(floor ? 'workplace.admin.locations.editFloor' : 'workplace.admin.locations.addFloor')}
      description={t('workplace.admin.locations.floorDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!form.nameKo.trim() || !form.nameEn.trim()}
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
      maxWidth="md"
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '0.65fr 1fr 1fr' }, gap: 1.5 }}>
          <FormField type="number" label={t('workplace.admin.locations.floorNumber')} value={form.floorNumber} onChange={(event) => patch('floorNumber', Number(event.target.value))} inputProps={{ min: -20, max: 300 }} />
          <FormField required label={t('workplace.admin.locations.nameKo')} value={form.nameKo} onChange={(event) => patch('nameKo', event.target.value)} />
          <FormField required label={t('workplace.admin.locations.nameEn')} value={form.nameEn} onChange={(event) => patch('nameEn', event.target.value)} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5 }}>
          <FormField type="number" label={t('workplace.admin.locations.planWidth')} value={form.planWidth} onChange={(event) => patch('planWidth', Number(event.target.value))} inputProps={{ min: 400, max: 5000 }} />
          <FormField type="number" label={t('workplace.admin.locations.planHeight')} value={form.planHeight} onChange={(event) => patch('planHeight', Number(event.target.value))} inputProps={{ min: 300, max: 5000 }} />
          <SelectField label={t('workplace.admin.locations.state')} value={form.state} options={(['DRAFT', 'ACTIVE', 'CLOSED'] as const).map((value) => ({ value, label: t(`workplace.floorStates.${value}`) }))} onValueChange={(value) => patch('state', value as WorkplaceFloorInput['state'])} />
        </Box>
        <Box component="label" sx={{ border: 1, borderStyle: 'dashed', borderColor: file ? 'primary.main' : 'divider', p: 2, cursor: 'pointer', display: 'flex', gap: 1.25, alignItems: 'center' }}>
          <ImageUp size={22} color="var(--dwp-product-accent)" />
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontWeight: 700 }}>{file?.name ?? t('workplace.admin.locations.uploadPlan')}</Box>
            <Box sx={{ color: 'text.secondary', fontSize: 12 }}>{t('workplace.admin.locations.uploadPlanHint')}</Box>
          </Box>
          <input hidden type="file" accept="image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Box>
      </Stack>
    </FormDialog>
  );
}

export function WorkplaceResourceDialog({
  open,
  floorId,
  resource,
  defaultPosition,
  onClose,
}: {
  open: boolean;
  floorId: string;
  resource: WorkplaceResource | null;
  defaultPosition: { x: number; y: number };
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<WorkplaceResourceInput>({
    code: '', nameKo: '', nameEn: '', type: 'DESK', mode: 'RESERVABLE', state: 'AVAILABLE',
    neighborhood: '', capacity: 1, features: [], accessible: false, approvalRequired: false,
    positionX: defaultPosition.x, positionY: defaultPosition.y, widthPercent: 8,
    heightPercent: 8, rotationDegrees: 0, assignedUserId: null,
    assignedPersonPublicId: null, assignedDisplayName: null, version: 0,
  });
  const [features, setFeatures] = useState('');
  useEffect(() => {
    if (!open) return;
    const next: WorkplaceResourceInput = resource
      ? {
          code: resource.code, nameKo: resource.nameKo, nameEn: resource.nameEn,
          type: resource.type, mode: resource.mode, state: resource.state,
          neighborhood: resource.neighborhood, capacity: resource.capacity,
          features: resource.features, accessible: resource.accessible,
          approvalRequired: resource.approvalRequired, positionX: resource.positionX,
          positionY: resource.positionY, widthPercent: resource.widthPercent,
          heightPercent: resource.heightPercent, rotationDegrees: resource.rotationDegrees,
          assignedUserId: resource.assignedUserId,
          assignedPersonPublicId: resource.assignedPersonPublicId,
          assignedDisplayName: resource.assignedDisplayName, version: resource.version,
        }
      : {
          code: '', nameKo: '', nameEn: '', type: 'DESK', mode: 'RESERVABLE', state: 'AVAILABLE',
          neighborhood: '', capacity: 1, features: [], accessible: false, approvalRequired: false,
          positionX: defaultPosition.x, positionY: defaultPosition.y, widthPercent: 8,
          heightPercent: 8, rotationDegrees: 0, assignedUserId: null,
          assignedPersonPublicId: null, assignedDisplayName: null, version: 0,
        };
    setForm(next);
    setFeatures(next.features.join(', '));
  }, [defaultPosition.x, defaultPosition.y, open, resource]);
  const patch = <K extends keyof WorkplaceResourceInput>(key: K, value: WorkplaceResourceInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const peopleQuery = useQuery({
    queryKey: ['workplace', 'directory-assignees'],
    queryFn: () => listPeople({ size: 100, surface: 'directory' }),
    enabled: open && form.mode === 'ASSIGNED',
    staleTime: 5 * 60_000,
  });
  const people = useMemo(() => peopleQuery.data?.items ?? [], [peopleQuery.data?.items]);
  const assignedPerson = useMemo(
    () => people.find((person) => person.personId === form.assignedPersonPublicId) ?? null,
    [form.assignedPersonPublicId, people]
  );
  const mutation = useMutation({
    mutationFn: () => saveWorkplaceResource(floorId, resource?.resourceId ?? null, {
      ...form,
      features: features.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean),
      approvalRequired: form.type === 'ROOM' && form.approvalRequired,
      assignedPersonPublicId: form.mode === 'ASSIGNED' ? form.assignedPersonPublicId : null,
      assignedDisplayName: form.mode === 'ASSIGNED' ? form.assignedDisplayName : null,
      version: resource ? form.version : null,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      toast.success(t(resource ? 'workplace.admin.locations.resourceUpdated' : 'workplace.admin.locations.resourceCreated'));
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, t('workplace.admin.locations.saveError'))),
  });
  const assignedValid = form.mode !== 'ASSIGNED' || Boolean(form.assignedPersonPublicId || form.assignedDisplayName?.trim());
  const valid = /^[A-Z0-9][A-Z0-9_-]{2,79}$/u.test(form.code) && form.nameKo.trim() && form.nameEn.trim() && assignedValid;
  return (
    <FormDialog
      open={open}
      title={t(resource ? 'workplace.admin.locations.editResource' : 'workplace.admin.locations.addResource')}
      description={t('workplace.admin.locations.resourceDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
      maxWidth="md"
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '0.8fr 1fr 1fr' }, gap: 1.5 }}>
          <FormField required label={t('workplace.admin.locations.code')} value={form.code} onChange={(event) => patch('code', event.target.value.toUpperCase())} />
          <FormField required label={t('workplace.admin.locations.nameKo')} value={form.nameKo} onChange={(event) => patch('nameKo', event.target.value)} />
          <FormField required label={t('workplace.admin.locations.nameEn')} value={form.nameEn} onChange={(event) => patch('nameEn', event.target.value)} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
          <SelectField label={t('workplace.admin.locations.resourceType')} value={form.type} disabled={Boolean(resource?.calendarResourceId)} options={(['ROOM', 'DESK', 'LOCKER', 'PARKING', 'FOCUS_POD', 'PHONE_BOOTH', 'EQUIPMENT'] as WorkplaceResourceType[]).map((value) => ({ value, label: t(`workplace.resourceTypes.${value}`) }))} onValueChange={(value) => patch('type', value as WorkplaceResourceType)} />
          <SelectField label={t('workplace.admin.locations.bookingMode')} value={form.mode} options={(['RESERVABLE', 'DROP_IN', 'ASSIGNED', 'UNAVAILABLE'] as WorkplaceBookingMode[]).map((value) => ({ value, label: t(`workplace.bookingModes.${value}`) }))} onValueChange={(value) => patch('mode', value as WorkplaceBookingMode)} />
          <SelectField label={t('workplace.admin.locations.state')} value={form.state} options={(['AVAILABLE', 'MAINTENANCE', 'RETIRED'] as WorkplaceResourceState[]).map((value) => ({ value, label: t(`admin.resources.states.${value}`) }))} onValueChange={(value) => patch('state', value as WorkplaceResourceState)} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 0.45fr' }, gap: 1.5 }}>
          <FormField label={t('workplace.admin.locations.neighborhood')} value={form.neighborhood ?? ''} onChange={(event) => patch('neighborhood', event.target.value)} />
          <FormField type="number" label={t('workplace.admin.locations.capacity')} value={form.capacity} onChange={(event) => patch('capacity', Number(event.target.value))} inputProps={{ min: 1, max: 10000 }} />
        </Box>
        <FormField label={t('workplace.admin.locations.features')} value={features} onChange={(event) => setFeatures(event.target.value)} supportingText={t('workplace.admin.locations.featuresHint')} />
        {form.mode === 'ASSIGNED' && (
          <Stack spacing={1.5}>
            <AutocompleteField<PersonSummary>
              label={t('workplace.admin.locations.assignee')}
              options={people}
              value={assignedPerson}
              loading={peopleQuery.isLoading}
              getOptionLabel={(person) => `${person.displayName} · ${person.organizationName ?? ''}`}
              isOptionEqualToValue={(option, value) => option.personId === value.personId}
              onChange={(_, person) => setForm((current) => ({
                ...current,
                assignedPersonPublicId: person?.personId ?? null,
                assignedDisplayName: person?.displayName ?? current.assignedDisplayName,
              }))}
            />
            <FormField label={t('workplace.admin.locations.fixedSeatLabel')} value={form.assignedDisplayName ?? ''} onChange={(event) => patch('assignedDisplayName', event.target.value)} supportingText={t('workplace.admin.locations.fixedSeatHint')} />
          </Stack>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormControlLabel control={<Switch checked={form.accessible} onChange={(_, checked) => patch('accessible', checked)} />} label={t('workplace.admin.locations.accessible')} />
          {form.type === 'ROOM' && <FormControlLabel control={<Switch checked={form.approvalRequired} onChange={(_, checked) => patch('approvalRequired', checked)} />} label={t('workplace.admin.locations.approvalRequired')} />}
        </Stack>
        <Alert severity="info">{t('workplace.admin.locations.dragHint')}</Alert>
      </Stack>
    </FormDialog>
  );
}
