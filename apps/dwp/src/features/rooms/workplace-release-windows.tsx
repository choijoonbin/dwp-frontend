import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Armchair, CalendarRange, Plus, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelWorkplaceReleaseWindow,
  createWorkplaceReleaseWindow,
  createWorkplaceIdempotencyKey,
  getWorkplaceAssignedResources,
  getWorkplaceReleaseWindows,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  DateTimePickerField,
  DwpDateTimeProvider,
  EmptyState,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';

import type { WorkplaceAssignedResource, WorkplaceReleaseWindow } from '@dwp-frontend/shared-utils';

function defaultPeriod() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setMinutes(0, 0, 0);
  start.setHours(Math.max(9, start.getHours()));
  const end = new Date(start);
  end.setHours(start.getHours() + 8);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

function queryPeriod() {
  const from = new Date();
  from.setDate(from.getDate() - 1);
  const to = new Date();
  to.setFullYear(to.getFullYear() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function WorkplaceReleaseWindows() {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const capabilities = useRoomsCapabilities();
  const range = useMemo(queryPeriod, []);
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'release-windows', 'eligible-resources'],
    queryFn: getWorkplaceAssignedResources,
    staleTime: 60_000,
    retry: 1,
  });
  const windowsQuery = useQuery({
    queryKey: ['workplace', 'release-windows', range.from, range.to],
    queryFn: () => getWorkplaceReleaseWindows(range.from, range.to),
    staleTime: 20_000,
    retry: 1,
  });
  const resources = resourcesQuery.data ?? [];
  const windows = (windowsQuery.data ?? []).sort(
    (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt)
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resourceId, setResourceId] = useState('');
  const [startsAt, setStartsAt] = useState(defaultPeriod().startsAt);
  const [endsAt, setEndsAt] = useState(defaultPeriod().endsAt);
  const [note, setNote] = useState('');
  const [cancelling, setCancelling] = useState<WorkplaceReleaseWindow | null>(null);
  const commandRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const selectedResource =
    resources.find((resource) => resource.resourceId === resourceId) ?? resources[0] ?? null;
  const valid = Boolean(
    selectedResource &&
    Date.parse(endsAt) > Date.parse(startsAt) &&
    Date.parse(startsAt) > Date.now()
  );
  const format = (value: string) =>
    formatDate(
      value,
      { dateStyle: 'medium', timeStyle: 'short' },
      resolveSupportedLocale(i18n.resolvedLanguage)
    );

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedResource || !capabilities.canCreateWorkplaceBooking) {
        throw new Error(t('workplace.my.releaseWindows.readOnly', {}));
      }
      const input = {
        resourceId: selectedResource.resourceId,
        startsAt,
        endsAt,
        note: note.trim(),
      };
      const fingerprint = JSON.stringify(input);
      const command =
        commandRef.current?.fingerprint === fingerprint
          ? commandRef.current
          : {
              fingerprint,
              key: createWorkplaceIdempotencyKey('release-window'),
            };
      commandRef.current = command;
      return createWorkplaceReleaseWindow(input, command.key);
    },
    onSuccess: async () => {
      commandRef.current = null;
      setDialogOpen(false);
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      toast.success(t('workplace.my.releaseWindows.created'));
    },
    onError: () => toast.error(t('workplace.my.releaseWindows.saveError')),
  });
  const cancelMutation = useMutation({
    mutationFn: (window: WorkplaceReleaseWindow) => {
      if (!capabilities.canUpdateWorkplaceBooking) {
        throw new Error(t('workplace.my.releaseWindows.readOnly', {}));
      }
      return cancelWorkplaceReleaseWindow(window.releaseWindowId, window.version);
    },
    onSuccess: async () => {
      setCancelling(null);
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      toast.success(t('workplace.my.releaseWindows.cancelled'));
    },
    onError: () => toast.error(t('workplace.my.releaseWindows.cancelError')),
  });

  if (resourcesQuery.isLoading) return <Skeleton variant="rectangular" height={176} />;
  if (resourcesQuery.isError && !resourcesQuery.data) {
    return (
      <Alert
        severity="error"
        action={
          <ActionButton intent="quiet" onClick={() => resourcesQuery.refetch()}>
            {t('actions.retry')}
          </ActionButton>
        }
      >
        {t('workplace.my.releaseWindows.resourceLoadError')}
      </Alert>
    );
  }
  if (resources.length === 0) return null;

  const openDialog = () => {
    const period = defaultPeriod();
    setResourceId(resources[0]?.resourceId ?? '');
    setStartsAt(period.startsAt);
    setEndsAt(period.endsAt);
    setNote('');
    commandRef.current = null;
    setDialogOpen(true);
  };

  return (
    <Box sx={{ mt: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ p: { xs: 1.5, md: 2 }, borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" gap={1} alignItems="center">
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
            <Armchair size={18} />
          </Box>
          <Box>
            <Typography component="h2" fontWeight={800}>
              {t('workplace.my.releaseWindows.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('workplace.my.releaseWindows.description')}
            </Typography>
          </Box>
        </Stack>
        {capabilities.canCreateWorkplaceBooking && (
          <ActionButton intent="secondary" startIcon={<Plus size={16} />} onClick={openDialog}>
            {t('workplace.my.releaseWindows.add')}
          </ActionButton>
        )}
      </Stack>

      {resourcesQuery.isError && resourcesQuery.data && (
        <Alert
          severity="warning"
          action={
            <ActionButton intent="quiet" onClick={() => resourcesQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.staleWarning')}
        </Alert>
      )}

      {windowsQuery.isLoading && (
        <Stack spacing={1} p={2}>
          <Skeleton height={72} />
          <Skeleton height={72} />
        </Stack>
      )}
      {windowsQuery.isError && (
        <Alert
          severity={windowsQuery.data ? 'warning' : 'error'}
          action={
            <ActionButton intent="quiet" onClick={() => windowsQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t(
            windowsQuery.data ? 'workplace.staleWarning' : 'workplace.my.releaseWindows.loadError'
          )}
        </Alert>
      )}
      {!windowsQuery.isLoading &&
        (!windowsQuery.isError || windowsQuery.data) &&
        windows.length === 0 && (
          <EmptyState
            icon={<CalendarRange size={26} />}
            title={t('workplace.my.releaseWindows.empty')}
            description={t('workplace.my.releaseWindows.emptyDescription')}
          />
        )}
      {!windowsQuery.isLoading &&
        (!windowsQuery.isError || windowsQuery.data) &&
        windows.length > 0 && (
          <Stack divider={<Divider flexItem />}>
            {windows.map((window) => (
              <Stack
                key={window.releaseWindowId}
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                gap={1.5}
                sx={{ p: { xs: 1.5, md: 2 } }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={0.8} alignItems="center" flexWrap="wrap">
                    <Typography fontWeight={750}>{window.resourceName}</Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`workplace.my.releaseWindows.status.${window.status}`)}
                    />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {format(window.startsAt)} - {format(window.endsAt)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {window.siteName} · {window.floorName}
                    {window.note ? ` · ${window.note}` : ''}
                  </Typography>
                </Box>
                {window.canCancel && capabilities.canUpdateWorkplaceBooking && (
                  <ActionButton
                    intent="danger"
                    startIcon={<XCircle size={16} />}
                    onClick={() => setCancelling(window)}
                  >
                    {t('workplace.my.releaseWindows.cancel')}
                  </ActionButton>
                )}
              </Stack>
            ))}
          </Stack>
        )}

      <FormDialog
        open={dialogOpen}
        title={t('workplace.my.releaseWindows.dialogTitle')}
        description={t('workplace.my.releaseWindows.dialogDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('workplace.my.releaseWindows.publish')}
        submittingLabel={t('actions.saving')}
        busy={createMutation.isPending}
        submitDisabled={!valid || !capabilities.canCreateWorkplaceBooking}
        onClose={() => setDialogOpen(false)}
        onSubmit={() => createMutation.mutate()}
        maxWidth="sm"
      >
        <Stack spacing={2}>
          <SelectField
            label={t('workplace.my.releaseWindows.resource')}
            value={selectedResource?.resourceId ?? ''}
            options={resources.map((resource: WorkplaceAssignedResource) => ({
              value: resource.resourceId,
              label: `${resource.resourceName} · ${resource.siteName} · ${resource.floorName}`,
            }))}
            onValueChange={setResourceId}
          />
          <DwpDateTimeProvider
            locale={i18n.resolvedLanguage}
            timeZone={selectedResource?.timeZone ?? 'UTC'}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              <DateTimePickerField
                required
                label={t('workplace.my.releaseWindows.start')}
                value={startsAt}
                onValueChange={(value) => value && setStartsAt(value)}
                supportingText={selectedResource?.timeZone}
              />
              <DateTimePickerField
                required
                label={t('workplace.my.releaseWindows.end')}
                value={endsAt}
                onValueChange={(value) => value && setEndsAt(value)}
                errorMessage={!valid ? t('workplace.my.releaseWindows.invalidRange') : undefined}
              />
            </Box>
          </DwpDateTimeProvider>
          <FormField
            label={t('workplace.my.releaseWindows.note')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            inputProps={{ maxLength: 240 }}
          />
          <Alert severity="info">{t('workplace.my.releaseWindows.policyNotice')}</Alert>
        </Stack>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(cancelling)}
        title={t('workplace.my.releaseWindows.cancelTitle')}
        description={t('workplace.my.releaseWindows.cancelDescription')}
        cancelLabel={t('actions.keep')}
        confirmLabel={t('workplace.my.releaseWindows.cancel')}
        confirmingLabel={t('actions.saving')}
        intent="danger"
        busy={cancelMutation.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (cancelling) cancelMutation.mutate(cancelling);
        }}
      />
    </Box>
  );
}
