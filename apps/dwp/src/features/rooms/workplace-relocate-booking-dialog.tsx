import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
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
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { workplaceRelocationCandidates } from './workplace-discovery-model';
import { workplaceHomeSourceState } from './workplace-home-source-state';
import { validateWorkplaceBookingRange } from './workplace-time-policy';

import type { WorkplaceBooking, WorkplaceResource } from '@dwp-frontend/shared-utils';

type WorkplaceRelocateSubmission = {
  identityKey: string;
  bookingId: string;
  version: number;
  target: {
    generatedAt: string;
    queryScope: string;
    resourceId: string;
    resourceVersion: number;
  };
  input: {
    resourceId: string;
    startsAt: string;
    endsAt: string;
    reason: string;
    version: number;
  };
};

type WorkplaceRelocateTargetSnapshot = {
  identityKey: string;
  bookingId: string | null;
  generatedAt: string | null;
  queryScope: string;
  sourceReady: boolean;
  resourceVersions: ReadonlyMap<string, number>;
};

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function WorkplaceRelocateBookingDialog({
  booking,
  identityKey,
  isBookingCurrent,
  open,
  onClose,
  onDenied,
}: {
  booking: WorkplaceBooking | null;
  identityKey: string;
  isBookingCurrent: (identityKey: string, bookingId: string, version: number) => boolean;
  open: boolean;
  onClose: () => void;
  onDenied: (event: { identityKey: string; bookingId: string }) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const capabilities = useRoomsCapabilities();
  const activeIdentityRef = useRef(identityKey);
  const componentActiveRef = useRef(true);
  const isBookingCurrentRef = useRef(isBookingCurrent);
  const targetSnapshotRef = useRef<WorkplaceRelocateTargetSnapshot | null>(null);
  activeIdentityRef.current = identityKey;
  isBookingCurrentRef.current = isBookingCurrent;
  useEffect(() => {
    componentActiveRef.current = true;
    return () => {
      componentActiveRef.current = false;
    };
  }, []);
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
    queryKey: ['workplace', 'relocate', identityKey, booking?.bookingId, floorId, startsAt, endsAt],
    queryFn: () => getWorkplaceExplore(startsAt, endsAt, floorId),
    enabled: Boolean(open && booking && startsAt && endsAt),
    staleTime: 15_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const targetSourceState = workplaceHomeSourceState({
    data: query.data,
    error: query.error,
    failureCount: query.failureCount,
    failureReason: query.failureReason,
    isError: query.isError,
    isPending: query.isPending,
    required: Boolean(open && booking && startsAt && endsAt),
  });
  const data = targetSourceState === 'DENIED' ? undefined : query.data;
  const selectedFloor = data?.selectedFloor ?? null;
  const selectedSite = data?.sites.find((site) => site.siteId === selectedFloor?.siteId) ?? null;

  useEffect(() => {
    if (!open || !booking || targetSourceState !== 'DENIED') return;
    targetSnapshotRef.current = null;
    setSiteId('');
    setFloorId(null);
    setResourceId('');
    queryClient.removeQueries({
      queryKey: ['workplace', 'relocate', identityKey, booking.bookingId],
    });
    onDenied({ identityKey, bookingId: booking.bookingId });
  }, [booking, identityKey, onDenied, open, queryClient, targetSourceState]);

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

  const relocationOccupancy = useMemo(
    () => (data?.occupancy ?? []).filter((occupancy) => occupancy.bookingId !== booking?.bookingId),
    [booking?.bookingId, data?.occupancy]
  );
  const relocationBookability = useMemo(
    () => ({
      canCreateRoomBooking: false,
      canCreateWorkplaceBooking: capabilities.canUpdateWorkplaceBooking,
      occupancy: relocationOccupancy,
      rangeFrom: startsAt || null,
      rangeTo: endsAt || null,
      roomPolicy: null,
      roomPolicyReady: false,
      serverNow: data?.generatedAt ?? '',
      timeZone: selectedSite?.timeZone ?? null,
      verified: data !== undefined,
      workplacePolicy: data?.policy ?? null,
    }),
    [
      capabilities.canUpdateWorkplaceBooking,
      data,
      endsAt,
      relocationOccupancy,
      selectedSite?.timeZone,
      startsAt,
    ]
  );
  const candidates = useMemo(
    () =>
      workplaceRelocationCandidates(
        data?.resources ?? [],
        booking?.resourceType,
        relocationBookability
      ),
    [booking?.resourceType, data?.resources, relocationBookability]
  );
  const selectedResource =
    candidates.find((resource) => resource.resourceId === resourceId) ?? null;
  const targetQueryScope = `${floorId ?? ''}|${startsAt}|${endsAt}`;
  targetSnapshotRef.current = {
    identityKey,
    bookingId: booking?.bookingId ?? null,
    generatedAt: data?.generatedAt ?? null,
    queryScope: targetQueryScope,
    sourceReady: targetSourceState === 'READY',
    resourceVersions: new Map(
      candidates.map((candidate) => [candidate.resourceId, candidate.version])
    ),
  };

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
    targetSourceState === 'READY' &&
    capabilities.canUpdateWorkplaceBooking &&
    isBookingCurrent(identityKey, booking.bookingId, booking.version)
  );

  const mutation = useMutation({
    mutationFn: (submission: WorkplaceRelocateSubmission) => {
      const targetSnapshot = targetSnapshotRef.current;
      if (
        !componentActiveRef.current ||
        submission.identityKey !== activeIdentityRef.current ||
        !isBookingCurrentRef.current(
          submission.identityKey,
          submission.bookingId,
          submission.version
        )
      ) {
        throw new Error(t('workplace.my.relocate.saveError'));
      }
      if (!capabilities.canUpdateWorkplaceBooking) {
        throw new Error(t('permissions.workplaceUpdateReadOnly'));
      }
      if (
        !targetSnapshot?.sourceReady ||
        targetSnapshot.identityKey !== submission.identityKey ||
        targetSnapshot.bookingId !== submission.bookingId ||
        targetSnapshot.generatedAt !== submission.target.generatedAt ||
        targetSnapshot.queryScope !== submission.target.queryScope ||
        targetSnapshot.resourceVersions.get(submission.target.resourceId) !==
          submission.target.resourceVersion ||
        submission.input.resourceId !== submission.target.resourceId
      ) {
        throw new Error(t('workplace.my.relocate.freshnessRequired'));
      }
      return relocateWorkplaceBooking(submission.bookingId, submission.input);
    },
    onSuccess: async (_, submission) => {
      if (!componentActiveRef.current || submission.identityKey !== activeIdentityRef.current) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      if (!componentActiveRef.current || submission.identityKey !== activeIdentityRef.current) {
        return;
      }
      toast.success(t('workplace.my.relocate.saved'));
      onClose();
    },
    onError: (error, submission) => {
      if (componentActiveRef.current && submission.identityKey === activeIdentityRef.current) {
        toast.error(message(error, t('workplace.my.relocate.saveError')));
      }
    },
  });

  const submit = () => {
    if (targetSourceState !== 'READY') {
      toast.error(t('workplace.my.relocate.freshnessRequired'));
      return;
    }
    if (!booking || !selectedResource) {
      toast.error(t('workplace.my.relocate.resourceRequired'));
      return;
    }
    mutation.mutate({
      identityKey,
      bookingId: booking.bookingId,
      version: booking.version,
      target: {
        generatedAt: data?.generatedAt ?? '',
        queryScope: targetQueryScope,
        resourceId: selectedResource.resourceId,
        resourceVersion: selectedResource.version,
      },
      input: {
        resourceId: selectedResource.resourceId,
        startsAt,
        endsAt,
        reason: reason.trim(),
        version: booking.version,
      },
    });
  };

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
      onSubmit={submit}
      maxWidth="md"
    >
      <Stack spacing={2}>
        {query.isLoading && <Skeleton variant="rectangular" height={220} />}
        {(targetSourceState === 'STALE' || targetSourceState === 'UNAVAILABLE') && (
          <Alert
            severity={data ? 'warning' : 'error'}
            action={
              targetSourceState === 'STALE' ? (
                <ActionButton intent="quiet" onClick={() => void query.refetch()}>
                  {t('actions.retry')}
                </ActionButton>
              ) : undefined
            }
          >
            {t(
              targetSourceState === 'STALE'
                ? 'workplace.my.relocate.staleNotice'
                : 'workplace.my.relocate.loadError'
            )}
          </Alert>
        )}
        {data && (
          <>
            {targetSourceState === 'READY' && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <ActionButton
                  intent="quiet"
                  loading={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  {t('workplace.my.relocate.refresh')}
                </ActionButton>
              </Box>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1.4fr' },
                gap: 1.5,
              }}
            >
              <SelectField
                disabled={targetSourceState !== 'READY'}
                label={t('workplace.explore.site')}
                value={siteId}
                options={data.sites.map((site) => ({ value: site.siteId, label: site.name }))}
                onValueChange={(value) => chooseSite(String(value))}
              />
              <SelectField
                disabled={targetSourceState !== 'READY'}
                label={t('workplace.explore.floor')}
                value={selectedFloor?.floorId ?? ''}
                options={floors.map((floor) => ({ value: floor.floorId, label: floor.name }))}
                onValueChange={(value) => setFloorId(String(value))}
              />
              <SelectField
                disabled={targetSourceState !== 'READY'}
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
                  disabled={targetSourceState !== 'READY'}
                  required
                  label={t('workplace.booking.start')}
                  value={startsAt}
                  supportingText={timeZone}
                  onValueChange={(value) => value && setStartsAt(value)}
                />
                <DateTimePickerField
                  disabled={targetSourceState !== 'READY'}
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
              disabled={targetSourceState !== 'READY'}
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
