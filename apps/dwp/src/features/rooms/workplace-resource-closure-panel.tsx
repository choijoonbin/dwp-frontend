import { isWorkplaceGovernanceUuid } from './workplace-admin-governance-model';
import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { formatWorkplaceExperienceInstant } from './workplace-experience-format';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  DateTimePickerField,
  DwpDateTimeProvider,
  FormField,
} from '@dwp-frontend/design-system';
import {
  cancelWorkplaceResourceClosure,
  createWorkplaceResourceClosure,
  getWorkplaceAdminResources,
  getWorkplaceFutureBookingImpact,
  getWorkplaceResourceClosure,
  getWorkplaceResourceClosures,
  getWorkplaceRoomBookingImpact,
  HttpError,
} from '@dwp-frontend/shared-utils';
import type {
  WorkplaceCreateClosure,
  WorkplaceResource,
  WorkplaceResourceClosure,
} from '@dwp-frontend/shared-utils';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';
import { WorkplaceAdminSection } from './workplace-admin-experience-ui';
import { WorkplaceExperienceBookingInspector } from './workplace-experience-booking-inspector';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRoomsCapabilities, useWorkplaceGovernanceCapabilities } from './rooms-capabilities';
import { WorkplaceExperienceQueryError } from './workplace-experience-ui';

export function workplaceClosureInterval(
  start: string | null,
  end: string | null,
  timeZone: string
) {
  try {
    if (!start || !end) return null;
    const from = Temporal.Instant.from(start);
    const to = Temporal.Instant.from(end);
    from.toZonedDateTimeISO(timeZone);
    const milliseconds = to.epochMilliseconds - from.epochMilliseconds;
    if (milliseconds <= 0 || milliseconds > 366 * 86400000) return null;
    return { from: from.toString(), to: to.toString() };
  } catch {
    return null;
  }
}
type CommandTarget = {
  scope: string;
  generation: number;
  siteId: string;
  floorId: string;
  resourceId: string;
};
type Command = CommandTarget &
  (
    | { operation: 'create'; input: WorkplaceCreateClosure; key: string }
    | { operation: 'cancel'; closureId: string; version: number; reason: string }
  );

export function WorkplaceResourceClosurePanel({
  resource,
  timeZone,
}: {
  resource: WorkplaceResource;
  timeZone: string;
}) {
  const { t, i18n } = useTranslation('rooms');
  const authorityKey = useWorkplaceExperienceAuthority();
  const capabilities = useRoomsCapabilities();
  const governance = useWorkplaceGovernanceCapabilities();
  const queryClient = useQueryClient();
  const targetValid = [resource.siteId, resource.floorId, resource.resourceId].every(
    isWorkplaceGovernanceUuid
  );
  const canRead =
    targetValid &&
    capabilities.isLoaded &&
    capabilities.canViewWorkplaceAdmin &&
    governance.isLoaded &&
    !governance.isError &&
    governance.allowsTarget('CATALOG_VIEW', resource.siteId, resource.floorId);
  const restrictedRead = canRead && !governance.allowsTarget('CATALOG_VIEW', resource.siteId, null);
  const canManage =
    canRead &&
    governance.hierarchy.canManage &&
    governance.allowsTarget('CATALOG_MANAGE', resource.siteId, resource.floorId) &&
    capabilities.canUpdateWorkplaceAdmin &&
    (resource.type !== 'ROOM' || capabilities.canUpdateRoomsAdmin);
  const delegationKey = JSON.stringify([
    governance.isLoaded,
    governance.isError,
    governance.globalAdministrator,
    governance.effectiveScopes,
    canRead,
    canManage,
    capabilities.canCreateWorkplaceAdmin,
    capabilities.canViewRoomsAdmin,
  ]);
  const scope = JSON.stringify([
    authorityKey,
    delegationKey,
    resource.siteId,
    resource.floorId,
    resource.resourceId,
    resource.type,
    resource.calendarResourceId,
    timeZone,
  ]);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const commandContext = useRef({ scope, generation: 0 });
  if (commandContext.current.scope !== scope)
    commandContext.current = { scope, generation: commandContext.current.generation + 1 };
  const inFlight = useRef<Command | null>(null);
  const confirmedContext = useRef<string | null>(null);
  const initial = useMemo(() => {
    const start = Temporal.Now.instant().toZonedDateTimeISO(timeZone).add({ hours: 1 });
    return {
      start: start.toInstant().toString(),
      end: start.add({ days: 1 }).toInstant().toString(),
    };
  }, [timeZone]);
  const [dates, setDates] = useState<{ start: string | null; end: string | null }>(initial);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [selectedClosure, setSelectedClosure] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'conflict' | 'unknown' | 'denied' | null>(null);
  const [unknownCreate, setUnknownCreate] = useState<Extract<
    Command,
    { operation: 'create' }
  > | null>(null);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  useEffect(() => setReviewBookingId(null), [scope, selectedClosure, dates.start, dates.end]);
  const [page, setPage] = useState(0);
  const [impactPage, setImpactPage] = useState(0);
  useEffect(() => {
    setDates(initial);
    setReason('');
    setConfirmed(false);
    setSelectedClosure(null);
    setOutcome(null);
    setUnknownCreate(null);
    setPage(0);
  }, [scope, initial]);
  const range = workplaceClosureInterval(dates.start, dates.end, timeZone);
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'closures', scope, 'resources'],
    queryFn: () => getWorkplaceAdminResources(resource.floorId),
    enabled: canRead,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const candidateResource = Array.isArray(resourcesQuery.data)
    ? resourcesQuery.data.find((item) => item?.resourceId === resource.resourceId)
    : undefined;
  const canonicalResource = (item: WorkplaceResource | undefined) =>
    Boolean(
      item &&
      item.resourceId === resource.resourceId &&
      item.siteId === resource.siteId &&
      item.floorId === resource.floorId &&
      item.type === resource.type &&
      item.calendarResourceId === resource.calendarResourceId &&
      Number.isSafeInteger(item.version) &&
      item.version >= 0
    );
  const currentResource =
    canRead && !resourcesQuery.isError && canonicalResource(candidateResource)
      ? candidateResource
      : undefined;
  const sameInstant = (left: string, right: string) => {
    try {
      return Temporal.Instant.compare(left, right) === 0;
    } catch {
      return false;
    }
  };
  const validClosure = (item: WorkplaceResourceClosure) =>
    Boolean(
      item &&
      item.siteId === resource.siteId &&
      item.floorId === resource.floorId &&
      item.resourceId === resource.resourceId &&
      item.timeZone === timeZone &&
      isWorkplaceGovernanceUuid(item.closureId) &&
      Number.isSafeInteger(item.version) &&
      item.version >= 0 &&
      ['ACTIVE', 'CANCELLED'].includes(item.status) &&
      Boolean(workplaceClosureInterval(item.startsAt, item.endsAt, timeZone))
    );
  const validPage = (
    value: {
      page: number;
      size: number;
      totalElements: number;
      totalPages: number;
      content: unknown[];
    },
    expected: number
  ) =>
    value.page === expected &&
    value.size === 20 &&
    [value.totalElements, value.totalPages].every(
      (item) => Number.isSafeInteger(item) && item >= 0
    ) &&
    value.totalPages === Math.ceil(value.totalElements / value.size) &&
    Array.isArray(value.content) &&
    value.content.length ===
      Math.min(value.size, Math.max(0, value.totalElements - value.page * value.size));
  const closuresQuery = useQuery({
    queryKey: ['workplace', 'closures', scope, range, page],
    queryFn: () =>
      getWorkplaceResourceClosures({
        siteId: resource.siteId,
        resourceId: resource.resourceId,
        from: range!.from,
        to: range!.to,
        includeCancelled: true,
        page,
      }),
    enabled: canRead && Boolean(currentResource && range),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const closureQuery = useQuery({
    queryKey: ['workplace', 'closures', scope, 'detail', selectedClosure],
    queryFn: () => getWorkplaceResourceClosure(resource.siteId, selectedClosure!),
    enabled: canRead && Boolean(currentResource && selectedClosure),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const denied = (error: unknown) =>
    error instanceof HttpError && [401, 403, 404].includes(error.status);
  const accessDenied = [resourcesQuery.error, closuresQuery.error, closureQuery.error].some(denied);
  const closure =
    canRead &&
    currentResource &&
    !accessDenied &&
    !closureQuery.isError &&
    closureQuery.data &&
    closureQuery.data.closureId === selectedClosure &&
    validClosure(closureQuery.data)
      ? closureQuery.data
      : undefined;
  const impactRange = selectedClosure
    ? workplaceClosureInterval(closure?.startsAt ?? null, closure?.endsAt ?? null, timeZone)
    : range;
  useEffect(() => setImpactPage(0), [scope, impactRange?.from, impactRange?.to]);
  const impactQuery = useQuery({
    queryKey: ['workplace', 'closures', scope, 'impact', impactRange, impactPage],
    queryFn: () =>
      getWorkplaceFutureBookingImpact(
        resource.siteId,
        resource.resourceId,
        impactRange!.from,
        impactRange!.to,
        impactPage
      ),
    enabled: canRead && Boolean(currentResource && impactRange) && resource.type !== 'ROOM',
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const roomsImpactQuery = useQuery({
    queryKey: ['workplace', 'closures', scope, 'room-impact', impactRange, impactPage],
    queryFn: () =>
      getWorkplaceRoomBookingImpact(
        resource.siteId,
        resource.resourceId,
        impactRange!.from,
        impactRange!.to,
        impactPage
      ),
    enabled:
      canRead &&
      capabilities.canViewRoomsAdmin &&
      Boolean(currentResource && impactRange) &&
      resource.type === 'ROOM',
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const protectedRead =
    canRead &&
    Boolean(currentResource) &&
    !accessDenied &&
    ![impactQuery.error, roomsImpactQuery.error].some(denied);
  const closurePage = closuresQuery.data;
  const closures =
    protectedRead &&
    !closuresQuery.isError &&
    closurePage &&
    validPage(closurePage, page) &&
    closurePage.content.every(validClosure) &&
    (!restrictedRead || closurePage.countsScope === 'FLOORS') &&
    (closurePage.countsScope !== 'FLOORS' ||
      Boolean(
        closurePage.allowedFloorIds?.includes(resource.floorId) &&
        closurePage.allowedFloorIds.every(
          (floorId) =>
            isWorkplaceGovernanceUuid(floorId) &&
            governance.allowsTarget('CATALOG_VIEW', resource.siteId, floorId)
        )
      ))
      ? closurePage
      : undefined;
  const wpImpact = impactQuery.data;
  const impact =
    protectedRead &&
    !impactQuery.isError &&
    wpImpact &&
    impactRange &&
    wpImpact.siteId === resource.siteId &&
    wpImpact.resourceId === resource.resourceId &&
    sameInstant(wpImpact.from, impactRange.from) &&
    sameInstant(wpImpact.to, impactRange.to) &&
    wpImpact.affectedBookings &&
    validPage(wpImpact.affectedBookings, impactPage) &&
    wpImpact.affectedBookings.content.every(
      (item) =>
        item &&
        item.resourceId === resource.resourceId &&
        item.siteId === resource.siteId &&
        item.floorId === resource.floorId &&
        isWorkplaceGovernanceUuid(item.bookingId) &&
        Number.isSafeInteger(item.version) &&
        item.version >= 0 &&
        Boolean(workplaceClosureInterval(item.startsAt, item.endsAt, timeZone))
    )
      ? wpImpact
      : undefined;
  const nativeRoomImpact = roomsImpactQuery.data;
  const roomImpact =
    protectedRead &&
    capabilities.canViewRoomsAdmin &&
    !roomsImpactQuery.isError &&
    nativeRoomImpact &&
    impactRange &&
    nativeRoomImpact.siteId === resource.siteId &&
    nativeRoomImpact.resourceId === resource.resourceId &&
    nativeRoomImpact.calendarResourceId === resource.calendarResourceId &&
    sameInstant(nativeRoomImpact.startsAt, impactRange.from) &&
    sameInstant(nativeRoomImpact.endsAt, impactRange.to) &&
    validPage(nativeRoomImpact, impactPage) &&
    nativeRoomImpact.content.every(
      (item) =>
        item &&
        item.calendarResourceId === resource.calendarResourceId &&
        isWorkplaceGovernanceUuid(item.bookingId) &&
        Number.isSafeInteger(item.version) &&
        item.version >= 0 &&
        Boolean(workplaceClosureInterval(item.startsAt, item.endsAt, timeZone))
    )
      ? nativeRoomImpact
      : undefined;
  const impactPages =
    resource.type === 'ROOM' ? roomImpact?.totalPages : impact?.affectedBookings?.totalPages;
  const sourceError =
    resourcesQuery.isError ||
    closuresQuery.isError ||
    closureQuery.isError ||
    impactQuery.isError ||
    roomsImpactQuery.isError ||
    Boolean(
      (resourcesQuery.isSuccess && !currentResource) ||
      (closuresQuery.isSuccess && !closures) ||
      (selectedClosure && closureQuery.isSuccess && !closure) ||
      (resource.type !== 'ROOM' && impactQuery.isSuccess && !impact) ||
      (resource.type === 'ROOM' &&
        capabilities.canViewRoomsAdmin &&
        roomsImpactQuery.isSuccess &&
        !roomImpact)
    );
  const sourceContext = JSON.stringify([
    scope,
    dates,
    reason,
    selectedClosure,
    page,
    impactPage,
    sourceError,
    currentResource,
    closure,
    closures,
    impact,
    roomImpact,
  ]);
  const navigationContext = JSON.stringify([
    scope,
    dates,
    reason,
    selectedClosure,
    page,
    impactPage,
  ]);
  const activeNavigation = useRef({ key: navigationContext, generation: 0 });
  if (activeNavigation.current.key !== navigationContext)
    activeNavigation.current = {
      key: navigationContext,
      generation: activeNavigation.current.generation + 1,
    };
  const boundContext = useRef(sourceContext);
  if (boundContext.current !== sourceContext) {
    boundContext.current = sourceContext;
    commandContext.current.generation += 1;
  }
  useEffect(() => {
    setConfirmed(false);
    confirmedContext.current = null;
  }, [sourceContext]);
  useEffect(() => {
    if (!canManage || sourceError) {
      setReason('');
      setSelectedClosure(null);
      setReviewBookingId(null);
      setUnknownCreate(null);
      setOutcome(null);
    }
  }, [canManage, sourceError]);
  const fresh =
    Boolean(
      impactRange &&
      currentResource &&
      (resource.type === 'ROOM'
        ? roomImpact && roomImpact.availability === 'AVAILABLE'
        : impact && ['AVAILABLE', 'EMPTY'].includes(impact.metadata?.availability)) &&
      closures
    ) &&
    !sourceError &&
    (!selectedClosure || Boolean(closure && !closureQuery.isFetching && !closureQuery.isStale)) &&
    !resourcesQuery.isFetching &&
    !resourcesQuery.isStale &&
    !(resource.type === 'ROOM' ? roomsImpactQuery.isStale : impactQuery.isStale) &&
    !impactQuery.isFetching &&
    !roomsImpactQuery.isFetching &&
    !closuresQuery.isFetching &&
    !closuresQuery.isStale;
  const ready =
    canManage &&
    fresh &&
    confirmed &&
    confirmedContext.current === sourceContext &&
    Boolean(reason.trim()) &&
    !outcome;
  const matchesCommand = (command: Command) =>
    command.scope === activeScope.current &&
    command.generation === commandContext.current.generation;
  const mutation = useMutation<WorkplaceResourceClosure, Error, Command>({
    mutationFn: async (command) => {
      if (
        !canManage ||
        !fresh ||
        !matchesCommand(command) ||
        (command.operation === 'create' && !capabilities.canCreateWorkplaceAdmin)
      )
        throw new Error('Closure scope changed');
      const result =
        command.operation === 'create'
          ? await createWorkplaceResourceClosure(
              command.siteId,
              command.resourceId,
              command.input,
              command.key
            )
          : await cancelWorkplaceResourceClosure(command.siteId, command.closureId, {
              version: command.version,
              reason: command.reason,
              confirmed: true,
            });
      if (
        !validClosure(result) ||
        result.siteId !== command.siteId ||
        result.floorId !== command.floorId ||
        result.resourceId !== command.resourceId ||
        (command.operation === 'cancel' && result.closureId !== command.closureId)
      )
        throw new Error('Closure response scope changed');
      if (
        command.operation === 'create'
          ? result.status !== 'ACTIVE' ||
            result.resourceVersionAtCreate !== command.input.version ||
            result.reason !== command.input.reason ||
            !sameInstant(result.startsAt, command.input.startsAt) ||
            !sameInstant(result.endsAt, command.input.endsAt)
          : result.status !== 'CANCELLED' ||
            result.version <= command.version ||
            result.cancellationReason !== command.reason
      )
        throw new Error('Closure response does not match the issued command');
      return result;
    },
    onSuccess: async (_result, command) => {
      if (!matchesCommand(command)) return;
      setReason('');
      setConfirmed(false);
      setOutcome(null);
      setUnknownCreate(null);
      setSelectedClosure(null);
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
    },
    onError: (error, command) => {
      if (!matchesCommand(command)) return;
      const state =
        error instanceof HttpError && [401, 403, 404].includes(error.status)
          ? 'denied'
          : error instanceof HttpError && [400, 409].includes(error.status)
            ? 'conflict'
            : 'unknown';
      setOutcome(state);
      setConfirmed(false);
      if (state === 'unknown' && command.operation === 'create') setUnknownCreate(command);
    },
    onSettled: (_data, _error, command) => {
      if (inFlight.current === command) inFlight.current = null;
    },
  });
  const dispatch = (command: Command) => {
    if (
      inFlight.current ||
      !canManage ||
      !fresh ||
      !matchesCommand(command) ||
      (!ready && command !== unknownCreate) ||
      (command.operation === 'cancel' &&
        (closure?.closureId !== command.closureId ||
          closure.version !== command.version ||
          closure.status !== 'ACTIVE'))
    )
      return;
    inFlight.current = command;
    mutation.mutate(command);
  };
  const recheck = async () => {
    const context = navigationContext;
    const navigationGeneration = activeNavigation.current.generation;
    const detail = selectedClosure ? await closureQuery.refetch() : null;
    if (
      activeScope.current !== scope ||
      activeNavigation.current.key !== context ||
      activeNavigation.current.generation !== navigationGeneration ||
      detail?.isError ||
      (detail?.data && (!validClosure(detail.data) || detail.data.closureId !== selectedClosure))
    )
      return;
    const results = await Promise.all([
      resourcesQuery.refetch(),
      closuresQuery.refetch(),
      resource.type === 'ROOM' ? roomsImpactQuery.refetch() : impactQuery.refetch(),
    ]);
    const resourceRows = results[0].data;
    const closureRows = results[1].data;
    const refreshedImpact = results[2].data;
    const impactMatches =
      refreshedImpact &&
      impactRange &&
      refreshedImpact.siteId === resource.siteId &&
      refreshedImpact.resourceId === resource.resourceId &&
      ('from' in refreshedImpact
        ? sameInstant(refreshedImpact.from, impactRange.from) &&
          sameInstant(refreshedImpact.to, impactRange.to) &&
          refreshedImpact.affectedBookings &&
          validPage(refreshedImpact.affectedBookings, impactPage) &&
          refreshedImpact.affectedBookings.content.every(
            (item) =>
              item &&
              item.siteId === resource.siteId &&
              item.floorId === resource.floorId &&
              item.resourceId === resource.resourceId
          )
        : sameInstant(refreshedImpact.startsAt, impactRange.from) &&
          sameInstant(refreshedImpact.endsAt, impactRange.to) &&
          refreshedImpact.calendarResourceId === resource.calendarResourceId &&
          validPage(refreshedImpact, impactPage));
    if (
      activeScope.current === scope &&
      activeNavigation.current.key === context &&
      activeNavigation.current.generation === navigationGeneration &&
      !unknownCreate &&
      results.every((item) => item.isSuccess) &&
      Array.isArray(resourceRows) &&
      canonicalResource(resourceRows.find((item) => item?.resourceId === resource.resourceId)) &&
      closureRows &&
      validPage(closureRows, page) &&
      closureRows.content.every(validClosure) &&
      impactMatches
    ) {
      setOutcome(null);
      setConfirmed(false);
      mutation.reset();
    }
  };
  const blocked = mutation.isPending || Boolean(outcome) || !canRead || sourceError;
  return (
    <WorkplaceAdminSection
      title={t('workplace.experience.closure')}
      description={`${resource.name} · ${timeZone}`}
    >
      <Stack gap={1.5}>
        <InlineFeedback severity="warning">
          {t('workplace.experience.closurePreservesBookings')}
        </InlineFeedback>
        {!canRead ? (
          <InlineFeedback severity="warning">
            {t('workplace.experience.permissionChanged')}
          </InlineFeedback>
        ) : null}
        <DwpDateTimeProvider timeZone={timeZone} locale={i18n.resolvedLanguage}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <DateTimePickerField
              label={t('workplace.experience.startsAt')}
              value={selectedClosure ? (closure?.startsAt ?? null) : dates.start}
              disabled={blocked || Boolean(selectedClosure)}
              onValueChange={(start) => {
                setDates((value) => ({ ...value, start }));
                setPage(0);
              }}
            />
            <DateTimePickerField
              label={t('workplace.experience.endsAt')}
              value={selectedClosure ? (closure?.endsAt ?? null) : dates.end}
              disabled={blocked || Boolean(selectedClosure)}
              onValueChange={(end) => {
                setDates((value) => ({ ...value, end }));
                setPage(0);
              }}
            />
          </Box>
        </DwpDateTimeProvider>
        {!range ? (
          <InlineFeedback severity="warning">{t('workplace.experience.rangeError')}</InlineFeedback>
        ) : null}
        {sourceError ? <WorkplaceExperienceQueryError retry={() => void recheck()} /> : null}
        {impact ? (
          <Typography fontWeight={(theme) => theme.typography.fontWeightBold}>
            {impact.affectedBookings
              ? t('workplace.experience.affectedCount', {
                  count: impact.affectedBookings.totalElements,
                })
              : t('workplace.experience.roomsImpactNotice')}
          </Typography>
        ) : null}
        {impact?.affectedBookings?.content.map((booking) => (
          <ActionButton
            key={booking.bookingId}
            intent="quiet"
            onClick={() => setReviewBookingId(booking.bookingId)}
            sx={{
              justifyContent: 'space-between',
              textAlign: 'left',
              gap: 1,
              bgcolor: 'var(--dwp-product-soft)',
              p: 1.25,
              borderRadius: (theme) => theme.shape.borderRadius,
            }}
          >
            <Typography variant="body2">
              {booking.resourceName} ·{' '}
              {formatWorkplaceExperienceInstant(booking.startsAt, timeZone)} –{' '}
              {formatWorkplaceExperienceInstant(booking.endsAt, timeZone)}
            </Typography>
            <Typography variant="caption" color="primary.main">
              {t('workplace.experience.review')}
            </Typography>
          </ActionButton>
        ))}
        {roomImpact ? (
          <Typography fontWeight={(theme) => theme.typography.fontWeightBold}>
            {t('workplace.experience.affectedCount', { count: roomImpact.totalElements })} ·{' '}
            {t('workplace.member.bookings.openMeetings')}
          </Typography>
        ) : null}
        {roomImpact?.content.map((booking) => (
          <Typography key={`${booking.bookingId}:${booking.startsAt}`} variant="caption">
            {formatWorkplaceExperienceInstant(booking.startsAt, timeZone)} –{' '}
            {formatWorkplaceExperienceInstant(booking.endsAt, timeZone)} · {booking.status}
          </Typography>
        ))}
        {impactPages && impactPages > 1 ? (
          <Stack
            component="nav"
            aria-label={t('workplace.experience.futureImpact')}
            direction="row"
            justifyContent="space-between"
          >
            <ActionButton
              intent="quiet"
              disabled={!impactPage || blocked}
              onClick={() => setImpactPage(impactPage - 1)}
            >
              {t('workplace.experience.previous')}
            </ActionButton>
            <ActionButton
              intent="quiet"
              disabled={impactPage + 1 >= impactPages || blocked}
              onClick={() => setImpactPage(impactPage + 1)}
            >
              {t('workplace.experience.next')}
            </ActionButton>
          </Stack>
        ) : null}
        <Typography
          component="h3"
          variant="subtitle2"
          sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}
        >
          {t('workplace.experience.polish.savedClosures')}
          {closures ? ` · ${closures.totalElements}` : ''}
        </Typography>
        {closures?.content.map((item) => (
          <ActionButton
            key={item.closureId}
            intent={item.closureId === selectedClosure ? 'secondary' : 'quiet'}
            disabled={blocked}
            onClick={() => setSelectedClosure(item.closureId)}
            sx={{ justifyContent: 'space-between', textAlign: 'left', gap: 1 }}
          >
            <Stack gap={0.5}>
              <Typography variant="body2">
                {formatWorkplaceExperienceInstant(item.startsAt, timeZone)} –{' '}
                {formatWorkplaceExperienceInstant(item.endsAt, timeZone)}
              </Typography>
              <Typography variant="caption">{item.reason}</Typography>
            </Stack>
            <Chip
              size="small"
              variant="outlined"
              label={t(`workplace.experience.closureStates.${item.status}`)}
            />
          </ActionButton>
        ))}
        {closures && !closures.content.length ? (
          <Typography color="text.secondary">{t('workplace.experience.closureEmpty')}</Typography>
        ) : null}
        {closures && closures.totalPages > 1 ? (
          <Stack direction="row" justifyContent="space-between">
            <ActionButton
              intent="quiet"
              disabled={!page || blocked}
              onClick={() => setPage(page - 1)}
            >
              {t('workplace.experience.previous')}
            </ActionButton>
            <ActionButton
              intent="quiet"
              disabled={page + 1 >= closures.totalPages || blocked}
              onClick={() => setPage(page + 1)}
            >
              {t('workplace.experience.next')}
            </ActionButton>
          </Stack>
        ) : null}
        <FormField
          label={t(
            selectedClosure
              ? 'workplace.experience.cancelClosureReason'
              : 'workplace.experience.closureReason'
          )}
          value={reason}
          inputProps={{ maxLength: 500 }}
          disabled={!canManage || blocked}
          onChange={(event) => setReason(event.target.value)}
          multiline
          minRows={2}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={confirmed && confirmedContext.current === sourceContext}
              disabled={!canManage || !fresh || blocked}
              onChange={(event) => {
                confirmedContext.current = event.target.checked ? sourceContext : null;
                setConfirmed(event.target.checked);
              }}
            />
          }
          label={t('workplace.experience.confirmImpact')}
        />
        <Stack direction="row" gap={1} flexWrap="wrap">
          <ActionButton
            intent="danger"
            disabled={
              !ready ||
              mutation.isPending ||
              !capabilities.canCreateWorkplaceAdmin ||
              Boolean(selectedClosure)
            }
            onClick={() => {
              if (!ready || !range || !currentResource || selectedClosure) return;
              dispatch({
                operation: 'create',
                siteId: resource.siteId,
                floorId: resource.floorId,
                resourceId: resource.resourceId,
                scope,
                generation: commandContext.current.generation,
                key: crypto.randomUUID(),
                input: {
                  startsAt: range!.from,
                  endsAt: range!.to,
                  version: currentResource!.version,
                  reason: reason.trim(),
                  confirmed: true,
                },
              });
            }}
          >
            {t('workplace.experience.closureCreate')}
          </ActionButton>
          {closure?.status === 'ACTIVE' ? (
            <ActionButton
              intent="secondary"
              disabled={!ready || mutation.isPending}
              onClick={() => {
                if (!ready || !closure) return;
                dispatch({
                  operation: 'cancel',
                  siteId: resource.siteId,
                  floorId: resource.floorId,
                  resourceId: resource.resourceId,
                  scope,
                  generation: commandContext.current.generation,
                  closureId: closure.closureId,
                  version: closure.version,
                  reason: reason.trim(),
                });
              }}
            >
              {t('workplace.experience.closureCancel')}
            </ActionButton>
          ) : null}
          {selectedClosure ? (
            <ActionButton
              intent="quiet"
              disabled={blocked}
              onClick={() => setSelectedClosure(null)}
            >
              {t('actions.close')}
            </ActionButton>
          ) : null}
        </Stack>
        {outcome ? (
          <InlineFeedback
            severity="error"
            action={
              outcome === 'denied' ? undefined : (
                <ActionButton
                  intent="secondary"
                  disabled={
                    mutation.isPending ||
                    Boolean(
                      unknownCreate && (!canManage || !fresh || !matchesCommand(unknownCreate))
                    )
                  }
                  onClick={() => (unknownCreate ? dispatch(unknownCreate) : void recheck())}
                >
                  {t(
                    unknownCreate
                      ? 'workplace.experience.sameRequestRetry'
                      : 'workplace.experience.recheck'
                  )}
                </ActionButton>
              )
            }
          >
            {t(
              outcome === 'unknown'
                ? 'workplace.experience.changeUnknown'
                : outcome === 'denied'
                  ? 'workplace.experience.permissionChanged'
                  : 'workplace.experience.conflict'
            )}
          </InlineFeedback>
        ) : null}
        <WorkplaceExperienceBookingInspector
          siteId={resource.siteId}
          bookingId={reviewBookingId}
          timeZone={timeZone}
          onClose={() => setReviewBookingId(null)}
        />
      </Stack>
    </WorkplaceAdminSection>
  );
}
