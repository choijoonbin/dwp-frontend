import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, Settings2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRoomsAdminOverview, saveRoomResource, useToast } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  FormDialog,
  FormField,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomIdentity, RoomsPageHeading, RoomsPermissionNotice, RoomStateChip } from './rooms-ui';

import type {
  CalendarResource,
  CalendarResourceInput,
  CalendarResourceState,
} from '@dwp-frontend/shared-utils';

type FormState = {
  code: string;
  nameKo: string;
  nameEn: string;
  site: string;
  floor: string;
  capacity: string;
  features: string;
  timeZone: string;
  approvalRequired: boolean;
  state: CalendarResourceState;
};

const EMPTY_FORM: FormState = {
  code: '',
  nameKo: '',
  nameEn: '',
  site: '',
  floor: '',
  capacity: '6',
  features: '',
  timeZone: 'Asia/Seoul',
  approvalRequired: false,
  state: 'AVAILABLE',
};

function formFor(resource: CalendarResource | null): FormState {
  if (!resource) return EMPTY_FORM;
  return {
    code: resource.code,
    nameKo: resource.nameKo,
    nameEn: resource.nameEn,
    site: resource.site,
    floor: resource.floor ?? '',
    capacity: String(resource.capacity),
    features: resource.features.join(', '),
    timeZone: resource.timeZone,
    approvalRequired: resource.approvalRequired,
    state: resource.state,
  };
}

function RoomResourceDialog({
  open,
  resource,
  canSave,
  onClose,
}: {
  open: boolean;
  resource: CalendarResource | null;
  canSave: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => formFor(resource));
  const [validationVisible, setValidationVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setForm(formFor(resource));
      setValidationVisible(false);
    }
  }, [open, resource]);
  const patch = <Key extends keyof FormState>(key: Key, value: FormState[Key]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const valid = Boolean(
    /^[A-Z0-9][A-Z0-9_-]{2,79}$/u.test(form.code) &&
      form.nameKo.trim() &&
      form.nameEn.trim() &&
      form.site.trim() &&
      Number(form.capacity) >= 1
  );
  const mutation = useMutation({
    mutationFn: () => {
      if (!canSave) throw new Error(t('permissions.roomAdminCatalogReadOnly'));
      const input: CalendarResourceInput = {
        code: form.code,
        nameKo: form.nameKo.trim(),
        nameEn: form.nameEn.trim(),
        type: 'ROOM',
        site: form.site.trim(),
        floor: form.floor.trim() || null,
        capacity: Number(form.capacity),
        features: form.features
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        timeZone: form.timeZone,
        approvalRequired: form.approvalRequired,
        state: form.state,
        version: resource?.version,
      };
      return saveRoomResource(resource?.resourceId ?? null, input);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rooms'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar', 'admin'] }),
      ]);
      toast.success(t(resource ? 'admin.resources.updated' : 'admin.resources.created'));
      onClose();
    },
    onError: () => toast.error(t('admin.resources.saveError')),
  });
  return (
    <FormDialog
      open={open}
      title={t(resource ? 'admin.resources.editTitle' : 'admin.resources.createTitle')}
      description={t('admin.resources.dialogDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      submitDisabled={!valid || !canSave}
      busy={mutation.isPending}
      onClose={onClose}
      onSubmit={() => {
        if (!valid) {
          setValidationVisible(true);
          return;
        }
        mutation.mutate();
      }}
      maxWidth="md"
    >
      <Stack spacing={2}>
        {!canSave && (
          <RoomsPermissionNotice>{t('permissions.roomAdminCatalogReadOnly')}</RoomsPermissionNotice>
        )}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '0.8fr 1.2fr 1.2fr' },
            gap: 2,
          }}
        >
          <FormField
            autoFocus
            required
            label={t('admin.resources.code')}
            value={form.code}
            disabled={Boolean(resource)}
            onChange={(change) => patch('code', change.target.value.toUpperCase())}
            errorMessage={
              validationVisible && !/^[A-Z0-9][A-Z0-9_-]{2,79}$/u.test(form.code)
                ? t('admin.resources.codeError')
                : undefined
            }
          />
          <FormField
            required
            label={t('admin.resources.nameKo')}
            value={form.nameKo}
            onChange={(change) => patch('nameKo', change.target.value)}
          />
          <FormField
            required
            label={t('admin.resources.nameEn')}
            value={form.nameEn}
            onChange={(change) => patch('nameEn', change.target.value)}
          />
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 0.7fr 0.6fr' },
            gap: 2,
          }}
        >
          <FormField
            required
            label={t('admin.resources.site')}
            value={form.site}
            onChange={(change) => patch('site', change.target.value)}
          />
          <FormField
            label={t('admin.resources.floor')}
            value={form.floor}
            onChange={(change) => patch('floor', change.target.value)}
          />
          <FormField
            required
            type="number"
            label={t('admin.resources.capacity')}
            value={form.capacity}
            onChange={(change) => patch('capacity', change.target.value)}
            inputProps={{ min: 1, max: 10000 }}
          />
        </Box>
        <FormField
          label={t('admin.resources.features')}
          value={form.features}
          onChange={(change) => patch('features', change.target.value)}
          supportingText={t('admin.resources.featuresHint')}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <SelectField
            label={t('admin.resources.state')}
            value={form.state}
            options={(['AVAILABLE', 'MAINTENANCE', 'RETIRED'] as const).map((value) => ({
              value,
              label: t(`admin.resources.states.${value}`),
            }))}
            onValueChange={(value) => patch('state', value as CalendarResourceState)}
          />
          <FormField
            label={t('admin.resources.timeZone')}
            value={form.timeZone}
            onChange={(change) => patch('timeZone', change.target.value)}
          />
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={form.approvalRequired}
              onChange={(change) => patch('approvalRequired', change.target.checked)}
            />
          }
          label={t('admin.resources.approvalRequired')}
        />
      </Stack>
    </FormDialog>
  );
}

export function RoomsAdminResources() {
  const { t } = useTranslation('rooms');
  const capabilities = useRoomsCapabilities();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarResource | null>(null);
  const overviewQuery = useQuery({
    queryKey: ['rooms', 'admin', 'overview'],
    queryFn: getRoomsAdminOverview,
    staleTime: 30_000,
    retry: 1,
  });
  const rooms = (overviewQuery.data?.resources ?? []).filter(
    (resource) => resource.type === 'ROOM'
  );
  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (room: CalendarResource) => {
    setEditing(room);
    setDialogOpen(true);
  };
  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('admin.resources.eyebrow')}
        title={t('admin.resources.title')}
        description={t('admin.resources.description')}
        actions={
          capabilities.canCreateRoomsAdmin ? (
            <ActionButton intent="primary" startIcon={<Plus size={17} />} onClick={openCreate}>
              {t('admin.resources.add')}
            </ActionButton>
          ) : null
        }
      />
      {capabilities.isLoaded &&
        !capabilities.canCreateRoomsAdmin &&
        !capabilities.canUpdateRoomsAdmin && (
          <RoomsPermissionNotice>{t('permissions.roomAdminCatalogReadOnly')}</RoomsPermissionNotice>
        )}
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography component="h2" variant="subtitle1" fontWeight={800}>
            {t('admin.resources.inventory')}
          </Typography>
          <Chip size="small" label={t('admin.resources.count', { count: rooms.length })} />
        </Stack>
        {overviewQuery.isLoading ? (
          <Stack p={2} gap={1}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} height={92} />
            ))}
          </Stack>
        ) : overviewQuery.isError ? (
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={() => overviewQuery.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('admin.resources.loadError')}
          </Alert>
        ) : rooms.length === 0 ? (
          <EmptyState
            icon={<Building2 size={28} />}
            title={t('admin.resources.emptyTitle')}
            description={t('admin.resources.emptyDescription')}
            actionLabel={capabilities.canCreateRoomsAdmin ? t('admin.resources.add') : undefined}
            onAction={capabilities.canCreateRoomsAdmin ? openCreate : undefined}
          />
        ) : (
          rooms.map((room, index) => (
            <Stack
              key={room.resourceId}
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              gap={2}
              sx={{ p: 2, borderTop: index ? 1 : 0, borderColor: 'divider' }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                  <RoomIdentity room={room} />
                  <RoomStateChip room={room} />
                  {room.approvalRequired && (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={t('admin.resources.approval')}
                    />
                  )}
                </Stack>
                <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                  {room.features.map((value) => (
                    <Chip
                      key={value}
                      size="small"
                      variant="outlined"
                      label={t(`features.${value}`, { defaultValue: value })}
                    />
                  ))}
                </Stack>
              </Box>
              {capabilities.canUpdateRoomsAdmin && (
                <ActionButton
                  intent="secondary"
                  startIcon={<Settings2 size={16} />}
                  onClick={() => openEdit(room)}
                >
                  {t('actions.manage')}
                </ActionButton>
              )}
            </Stack>
          ))
        )}
      </Box>
      <RoomResourceDialog
        open={
          dialogOpen &&
          (editing ? capabilities.canUpdateRoomsAdmin : capabilities.canCreateRoomsAdmin)
        }
        resource={editing}
        canSave={editing ? capabilities.canUpdateRoomsAdmin : capabilities.canCreateRoomsAdmin}
        onClose={() => setDialogOpen(false)}
      />
    </PageCanvas>
  );
}
