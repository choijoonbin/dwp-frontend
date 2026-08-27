import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DateTimePickerField,
  DwpDateTimeProvider,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  getWorkplaceExplore,
  relocateWorkplaceBooking,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { useRoomsCapabilities } from './rooms-capabilities';
import { validateWorkplaceBookingRange } from './workplace-time-policy';

import type { WorkplaceBooking, WorkplaceResource } from '@dwp-frontend/shared-utils';

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function WorkplaceRelocateBookingDialog({
  booking,
  open,
  onClose,
}: {
  booking: WorkplaceBooking | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const capabilities = useRoomsCapabilities();
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [siteId, setSiteId] = useState('');
  const [floorId, setFloorId] = useState<string | null>(null);
  const [resourceId, setResourceId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open || !booking) return;
    setStartsAt(booking.startsAt);
    setEndsAt(booking.endsAt);
    setSiteId('');
    setFloorId(null);
    setResourceId(booking.resourceId);
    setReason('');
  }, [booking, open]);

  const query = useQuery({
    queryKey: ['workplace', 'relocate', booking?.bookingId, floorId, startsAt, endsAt],
    queryFn: () => getWorkplaceExplore(startsAt, endsAt, floorId),
    enabled: Boolean(open && booking && startsAt && endsAt),
    staleTime: 15_000,
    retry: 1,
  });
  const data = query.data;
  const selectedFloor = data?.selectedFloor ?? null;
  const selectedSite = data?.sites.find((site) => site.siteId === selectedFloor?.siteId) ?? null;

  useEffect(() => {
    if (!booking || !data || floorId) return;
    const currentFloor = data.floors.find(
      (floor) => floor.siteName === booking.siteName && floor.name === booking.floorName
    );
    setFloorId(currentFloor?.floorId ?? data.selectedFloor?.floorId ?? null);
  }, [booking, data, floorId]);

  useEffect(() => {
    if (!selectedFloor) return;
    setSiteId(selectedFloor.siteId);
  }, [selectedFloor]);

  const occupiedIds = useMemo(
    () =>
      new Set(
        (data?.occupancy ?? [])
          .filter((occupancy) => occupancy.bookingId !== booking?.bookingId)
          .map((occupancy) => occupancy.resourceId)
      ),
    [booking?.bookingId, data?.occupancy]
  );
  const candidates = useMemo(
    () =>
      (data?.resources ?? []).filter(
        (resource) =>
          resource.type === booking?.resourceType &&
          resource.state === 'AVAILABLE' &&
          resource.mode !== 'UNAVAILABLE' &&
          !occupiedIds.has(resource.resourceId)
      ),
    [booking?.resourceType, data?.resources, occupiedIds]
  );
  const selectedResource =
    candidates.find((resource) => resource.resourceId === resourceId) ?? null;

  useEffect(() => {
    if (!data) return;
    if (candidates.some((resource) => resource.resourceId === resourceId)) return;
    setResourceId(candidates[0]?.resourceId ?? '');
  }, [candidates, data, resourceId]);

  const floors = (data?.floors ?? []).filter((floor) => !siteId || floor.siteId === siteId);
  const timeZone = selectedSite?.timeZone ?? 'UTC';
  const rangeError = data?.policy
    ? validateWorkplaceBookingRange(startsAt, endsAt, timeZone, data.policy, data.generatedAt)
    : 'invalid';
  const unchanged = Boolean(
    booking &&
    resourceId === booking.resourceId &&
    startsAt === booking.startsAt &&
    endsAt === booking.endsAt
  );
  const valid = Boolean(
    booking &&
    selectedResource &&
    !rangeError &&
    !unchanged &&
    reason.trim() &&
    capabilities.canUpdateWorkplaceBooking
  );

  const mutation = useMutation({
    mutationFn: () => {
      if (!booking || !selectedResource) {
        throw new Error(t('workplace.my.relocate.resourceRequired'));
      }
      if (!capabilities.canUpdateWorkplaceBooking) {
        throw new Error(t('permissions.workplaceUpdateReadOnly'));
      }
      return relocateWorkplaceBooking(booking.bookingId, {
        resourceId: selectedResource.resourceId,
        startsAt,
        endsAt,
        reason: reason.trim(),
        version: booking.version,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      toast.success(t('workplace.my.relocate.saved'));
      onClose();
    },
    onError: (error) => toast.error(message(error, t('workplace.my.relocate.saveError'))),
  });

  const chooseSite = (value: string) => {
    setSiteId(value);
    const floor = data?.floors.find((candidate) => candidate.siteId === value);
    setFloorId(floor?.floorId ?? null);
  };

  return (
    <FormDialog
      open={open}
      title={t('workplace.my.relocate.title')}
      description={t('workplace.my.relocate.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('workplace.my.relocate.submit')}
      submittingLabel={t('actions.saving')}
      submitDisabled={!valid}
      busy={mutation.isPending}
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
      maxWidth="md"
    >
      <Stack spacing={2}>
        {query.isLoading && <Skeleton variant="rectangular" height={220} />}
        {query.isError && (
          <Alert severity={data ? 'warning' : 'error'}>
            {t(data ? 'workplace.staleWarning' : 'workplace.my.relocate.loadError')}
          </Alert>
        )}
        {data && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1.4fr' },
                gap: 1.5,
              }}
            >
              <SelectField
                label={t('workplace.explore.site')}
                value={siteId}
                options={data.sites.map((site) => ({ value: site.siteId, label: site.name }))}
                onValueChange={(value) => chooseSite(String(value))}
              />
              <SelectField
                label={t('workplace.explore.floor')}
                value={selectedFloor?.floorId ?? ''}
                options={floors.map((floor) => ({ value: floor.floorId, label: floor.name }))}
                onValueChange={(value) => setFloorId(String(value))}
              />
              <SelectField
                label={t('workplace.my.relocate.resource')}
                value={selectedResource?.resourceId ?? ''}
                options={candidates.map((resource: WorkplaceResource) => ({
                  value: resource.resourceId,
                  label: `${resource.name} · ${resource.neighborhood ?? resource.code}`,
                }))}
                onValueChange={(value) => setResourceId(String(value))}
              />
            </Box>
            <DwpDateTimeProvider locale={i18n.resolvedLanguage} timeZone={timeZone}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                <DateTimePickerField
                  required
                  label={t('workplace.booking.start')}
                  value={startsAt}
                  supportingText={timeZone}
                  onValueChange={(value) => value && setStartsAt(value)}
                />
                <DateTimePickerField
                  required
                  label={t('workplace.booking.end')}
                  value={endsAt}
                  errorMessage={
                    rangeError ? t(`workplace.booking.rangeErrors.${rangeError}`) : undefined
                  }
                  onValueChange={(value) => value && setEndsAt(value)}
                />
              </Box>
            </DwpDateTimeProvider>
            <FormField
              required
              label={t('workplace.my.relocate.reason')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              inputProps={{ maxLength: 500 }}
              supportingText={unchanged ? t('workplace.my.relocate.changeRequired') : undefined}
            />
            {candidates.length === 0 && (
              <Alert severity="warning">{t('workplace.my.relocate.empty')}</Alert>
            )}
          </>
        )}
      </Stack>
    </FormDialog>
  );
}
