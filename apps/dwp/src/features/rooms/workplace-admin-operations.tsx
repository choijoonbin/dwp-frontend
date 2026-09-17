import { foundationTokens } from '@dwp-frontend/design-system';
import { OperationsPagination, ResultSkeleton } from './workplace-operations-ui';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ban, CalendarRange, History, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Temporal } from 'temporal-polyfill';
import {
  forceCancelWorkplaceBooking,
  getWorkplaceAdminBookings,
  getWorkplaceAdminSites,
  getWorkplaceAdminFloors,
  getWorkplaceAuditEvents,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  DateRangePickerField,
  EmptyState,
  FormDialog,
  FormField,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  formatDate,
  resolveSupportedLocale,
  resolveSystemTimeZone,
} from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading, RoomsPermissionNotice } from './rooms-ui';
import {
  useWorkplaceLegalHoldControl,
  WorkplaceLegalHoldDialog,
} from './workplace-legal-hold-control';
import { AuditResults } from './workplace-admin-audit-results';
import { WorkplaceExperienceBookingInspector } from './workplace-experience-booking-inspector';
import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { WorkplaceExperienceQueryError } from './workplace-experience-ui';

import type {
  WorkplaceAdminBooking,
  WorkplaceAdminBookingPage,
  WorkplaceBookingStatus,
} from '@dwp-frontend/shared-utils';
import type { DateRangeValue } from '@dwp-frontend/design-system';

type OperationsTab = 'bookings' | 'audit';
type RangeIssue = 'required' | 'order' | 'tooLong' | 'invalid' | null;
type BookingFilters = { status: 'ALL' | WorkplaceBookingStatus; userId: string };
type AuditFilters = { action: string; aggregateType: string; actorUserId: string };

const BOOKING_STATUSES: readonly WorkplaceBookingStatus[] = [
  'RESERVED',
  'CHECKED_IN',
  'COMPLETED',
  'NO_SHOW',
  'RELEASED',
  'CANCELLED',
];
const EMPTY_BOOKING_FILTERS: BookingFilters = { status: 'ALL', userId: '' };
const EMPTY_AUDIT_FILTERS: AuditFilters = { action: '', aggregateType: '', actorUserId: '' };

function auditFiltersFromSearchParams(searchParams: URLSearchParams): AuditFilters {
  const actor = searchParams.get('actorUserId')?.trim() ?? '';
  return {
    action: (searchParams.get('action') ?? '').slice(0, 120),
    aggregateType: (searchParams.get('aggregateType') ?? '').slice(0, 80),
    actorUserId: /^\d{1,15}$/u.test(actor) ? actor : '',
  };
}

export function initialOperationsRange(timeZone: string, now = Temporal.Now.instant().toString()) {
  const today = Temporal.Instant.from(now).toZonedDateTimeISO(timeZone).toPlainDate();
  return { start: today.subtract({ days: 7 }).toString(), end: today.add({ days: 30 }).toString() };
}

export function operationsRangeIssue(range: DateRangeValue): RangeIssue {
  if (!range.start || !range.end) return 'required';
  try {
    const start = Temporal.PlainDate.from(range.start);
    const end = Temporal.PlainDate.from(range.end);
    if (Temporal.PlainDate.compare(end, start) < 0) return 'order';
    return start.until(end, { largestUnit: 'days' }).days + 1 > 400 ? 'tooLong' : null;
  } catch {
    return 'invalid';
  }
}

export function operationsRangeToIso(range: DateRangeValue, timeZone: string) {
  if (operationsRangeIssue(range) || !range.start || !range.end) return null;
  const start = Temporal.ZonedDateTime.from(`${range.start}T00:00:00[${timeZone}]`, {
    disambiguation: 'reject',
  });
  const end = Temporal.ZonedDateTime.from(`${range.end}T00:00:00[${timeZone}]`, {
    disambiguation: 'reject',
  }).add({ days: 1 });
  return { from: start.toInstant().toString(), to: end.toInstant().toString() };
}

export function parseOperationUserId(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function canForceCancelBooking(status: WorkplaceBookingStatus) {
  return status === 'RESERVED' || status === 'CHECKED_IN';
}

function statusColor(status: WorkplaceBookingStatus) {
  if (status === 'RESERVED') return 'info';
  if (status === 'CHECKED_IN') return 'success';
  if (status === 'NO_SHOW') return 'warning';
  if (status === 'CANCELLED') return 'error';
  return 'default';
}

export function WorkplaceAdminOperations() {
  const { t, i18n } = useTranslation('rooms');
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const capabilities = useRoomsCapabilities();
  const authority = useWorkplaceExperienceAuthority();
  const [reviewTarget, setReviewTarget] = useState<WorkplaceAdminBooking | null>(null);
  useEffect(() => setReviewTarget(null), [authority]);
  const toast = useToast();
  const queryClient = useQueryClient();
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const systemTimeZone = resolveSystemTimeZone('UTC');
  const [searchParams, setSearchParams] = useSearchParams();
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'operations', 'sites', authority],
    queryFn: getWorkplaceAdminSites,
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    staleTime: 15_000,
    retry: false,
  });
  const sites = sitesQuery.isError ? [] : (sitesQuery.data ?? []);
  const selectedSite = sites.find((site) => site.siteId === searchParams.get('site'));
  const floorsQuery = useQuery({
    queryKey: ['workplace', 'admin', 'operations', 'floors', authority, selectedSite?.siteId],
    queryFn: () => getWorkplaceAdminFloors(selectedSite!.siteId),
    enabled: Boolean(selectedSite) && capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    staleTime: 15_000,
    retry: false,
  });
  const floors = floorsQuery.isError ? [] : (floorsQuery.data ?? []);
  const selectedFloor = floors.find((floor) => floor.floorId === searchParams.get('floor'));
  const timeZone = selectedSite?.timeZone ?? systemTimeZone;
  const scopeReady =
    !sitesQuery.isError &&
    (!searchParams.get('site') || Boolean(selectedSite)) &&
    (!searchParams.get('floor') || Boolean(selectedFloor && !floorsQuery.isError));
  const changeScope = (key: 'site' | 'floor', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'site') next.delete('floor');
    setSearchParams(next, { replace: true });
    setBookingPage(0);
  };
  const tab: OperationsTab = searchParams.get('view') === 'audit' ? 'audit' : 'bookings';
  const [draftRange, setDraftRange] = useState<DateRangeValue>(() =>
    initialOperationsRange(timeZone)
  );
  const [appliedRange, setAppliedRange] = useState<DateRangeValue>(draftRange);
  const [bookingDraft, setBookingDraft] = useState<BookingFilters>(EMPTY_BOOKING_FILTERS);
  const [bookingFilters, setBookingFilters] = useState<BookingFilters>(EMPTY_BOOKING_FILTERS);
  const [auditDraft, setAuditDraft] = useState<AuditFilters>(() =>
    auditFiltersFromSearchParams(searchParams)
  );
  const [auditFilters, setAuditFilters] = useState<AuditFilters>(() =>
    auditFiltersFromSearchParams(searchParams)
  );
  const [bookingPage, setBookingPage] = useState(0);
  const [bookingSize, setBookingSize] = useState(25);
  const [auditPage, setAuditPage] = useState(0);
  const [auditSize, setAuditSize] = useState(25);
  const [cancelTarget, setCancelTarget] = useState<WorkplaceAdminBooking | null>(null);
  const [reason, setReason] = useState('');
  const legalHold = useWorkplaceLegalHoldControl(capabilities.canManageWorkplaceAdmin);
  const range = operationsRangeToIso(appliedRange, timeZone);
  const draftIssue = operationsRangeIssue(draftRange);
  const bookingUserId = parseOperationUserId(bookingFilters.userId);
  const auditActorId = parseOperationUserId(auditFilters.actorUserId);
  const bookingUserInvalid =
    Boolean(bookingDraft.userId.trim()) && !parseOperationUserId(bookingDraft.userId);
  const auditUserInvalid =
    Boolean(auditDraft.actorUserId.trim()) && !parseOperationUserId(auditDraft.actorUserId);
  const activeUserInvalid = tab === 'bookings' ? bookingUserInvalid : auditUserInvalid;

  const bookingsQuery = useQuery({
    queryKey: [
      'workplace',
      'admin',
      'operations',
      'bookings',
      authority,
      selectedSite?.siteId,
      selectedFloor?.floorId,
      range,
      bookingFilters,
      bookingPage,
      bookingSize,
    ],
    queryFn: () => {
      if (!range) throw new Error('Invalid Workplace operations range');
      return getWorkplaceAdminBookings(range.from, range.to, {
        siteId: selectedSite?.siteId,
        floorId: selectedFloor?.floorId,
        status: bookingFilters.status === 'ALL' ? null : bookingFilters.status,
        userId: bookingUserId,
        page: bookingPage,
        size: bookingSize,
      });
    },
    enabled:
      tab === 'bookings' &&
      capabilities.isLoaded &&
      capabilities.canViewWorkplaceAdmin &&
      Boolean(range) &&
      scopeReady,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[4] === authority &&
      previousQuery.queryKey[5] === selectedSite?.siteId &&
      previousQuery.queryKey[6] === selectedFloor?.floorId
        ? previous
        : undefined,
    staleTime: 15_000,
    retry: 1,
  });
  const auditQuery = useQuery({
    queryKey: [
      'workplace',
      'admin',
      'operations',
      'audit',
      authority,
      range,
      auditFilters,
      auditPage,
      auditSize,
    ],
    queryFn: () => {
      if (!range) throw new Error('Invalid Workplace audit range');
      return getWorkplaceAuditEvents(range.from, range.to, {
        action: auditFilters.action.trim() || null,
        aggregateType: auditFilters.aggregateType.trim() || null,
        actorUserId: auditActorId,
        page: auditPage,
        size: auditSize,
      });
    },
    enabled:
      tab === 'audit' &&
      capabilities.isLoaded &&
      capabilities.canViewWorkplaceAdmin &&
      Boolean(range),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[4] === authority ? previous : undefined,
    staleTime: 15_000,
    retry: 1,
  });
  useEffect(() => setReviewTarget(null), [selectedSite?.siteId, selectedFloor?.floorId]);
  const bookingsScopeMismatch = Boolean(
    selectedSite &&
    bookingsQuery.data?.content.some(
      (booking) =>
        booking.siteId !== selectedSite.siteId ||
        (selectedFloor && booking.floorId !== selectedFloor.floorId)
    )
  );
  useEffect(() => {
    if (bookingsScopeMismatch) setReviewTarget(null);
  }, [bookingsScopeMismatch]);
  const activeQuery = tab === 'bookings' ? bookingsQuery : auditQuery;

  const cancelMutation = useMutation({
    mutationFn: ({
      booking,
      cancellationReason,
    }: {
      booking: WorkplaceAdminBooking;
      cancellationReason: string;
    }) => {
      if (!capabilities.canManageWorkplaceAdmin) throw new Error('Manage permission required');
      return forceCancelWorkplaceBooking(booking.bookingId, booking.version, cancellationReason);
    },
    onSuccess: (saved) => {
      queryClient.setQueriesData<WorkplaceAdminBookingPage>(
        { queryKey: ['workplace', 'admin', 'operations', 'bookings'] },
        (current) =>
          current
            ? {
                ...current,
                content: current.content.map((booking) =>
                  booking.bookingId === saved.bookingId ? saved : booking
                ),
              }
            : current
      );
      setCancelTarget(null);
      setReason('');
      toast.success(t('workplace.admin.operations.cancelSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'admin', 'operations'] });
    },
    onError: () => {
      toast.error(t('workplace.admin.operations.cancelError'));
      void queryClient.invalidateQueries({
        queryKey: ['workplace', 'admin', 'operations', 'bookings'],
      });
    },
  });
  const applyFilters = () => {
    if (draftIssue || activeUserInvalid) return;
    setAppliedRange(draftRange);
    if (tab === 'bookings') {
      setBookingFilters(bookingDraft);
      setBookingPage(0);
    } else {
      setAuditFilters(auditDraft);
      setAuditPage(0);
    }
  };
  const resetFilters = () => {
    const nextRange = initialOperationsRange(timeZone);
    setDraftRange(nextRange);
    setAppliedRange(nextRange);
    if (tab === 'bookings') {
      setBookingDraft(EMPTY_BOOKING_FILTERS);
      setBookingFilters(EMPTY_BOOKING_FILTERS);
      setBookingPage(0);
    } else {
      setAuditDraft(EMPTY_AUDIT_FILTERS);
      setAuditFilters(EMPTY_AUDIT_FILTERS);
      setAuditPage(0);
    }
  };
  const formatInstant = (value: string) =>
    formatDate(value, { dateStyle: 'medium', timeStyle: 'short', timeZone }, locale);
  const updatedAt = activeQuery.dataUpdatedAt
    ? formatInstant(new Date(activeQuery.dataUpdatedAt).toISOString())
    : null;

  if (capabilities.isLoaded && !capabilities.canViewWorkplaceAdmin) {
    return (
      <PageCanvas mode="workspace">
        <RoomsPageHeading
          eyebrow={t('workplace.admin.operations.eyebrow')}
          title={t('workplace.admin.operations.title')}
          description={t('workplace.admin.operations.description')}
        />
        <RoomsPermissionNotice>{t('workplace.admin.operations.noView')}</RoomsPermissionNotice>
      </PageCanvas>
    );
  }

  return (
    <PageCanvas mode="workspace">
      <RoomsPageHeading
        eyebrow={t('workplace.admin.operations.eyebrow')}
        title={t('workplace.admin.operations.title')}
        description={t('workplace.admin.operations.description')}
      />
      {capabilities.isLoaded && !capabilities.canManageWorkplaceAdmin && (
        <RoomsPermissionNotice>{t('workplace.admin.operations.readOnly')}</RoomsPermissionNotice>
      )}

      <Tabs
        value={tab}
        onChange={(_event, value: OperationsTab) => {
          const next = new URLSearchParams(searchParams);
          next.set('view', value);
          setSearchParams(next, { replace: true });
        }}
        aria-label={t('workplace.admin.operations.tabs.label')}
        variant={mobile ? 'fullWidth' : 'standard'}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          value="bookings"
          icon={<CalendarRange size={17} />}
          iconPosition="start"
          label={t('workplace.admin.operations.tabs.bookings')}
        />
        <Tab
          value="audit"
          icon={<History size={17} />}
          iconPosition="start"
          label={t('workplace.admin.operations.tabs.audit')}
        />
      </Tabs>

      {tab === 'bookings' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(2, minmax(180px, 1fr))',
            },
            gap: 1.25,
            pt: 1.5,
          }}
        >
          <SelectField
            size="small"
            label={t('workplace.admin.governance.fields.site')}
            value={selectedSite?.siteId ?? ''}
            options={[
              { value: '', label: t('workplace.explore.allSites') },
              ...sites.map((site) => ({ value: site.siteId, label: site.name })),
            ]}
            onValueChange={(value) => changeScope('site', value)}
          />
          <SelectField
            size="small"
            label={t('workplace.admin.governance.fields.floor')}
            value={selectedFloor?.floorId ?? ''}
            disabled={!selectedSite || floorsQuery.isFetching || floorsQuery.isError}
            options={[
              { value: '', label: t('workplace.experience.allFloors') },
              ...floors.map((floor) => ({ value: floor.floorId, label: floor.name })),
            ]}
            onValueChange={(value) => changeScope('floor', value)}
          />
        </Box>
      ) : null}
      {sitesQuery.isError || (selectedSite && floorsQuery.isError) ? (
        <WorkplaceExperienceQueryError
          retry={() => {
            void sitesQuery.refetch();
            if (selectedSite) void floorsQuery.refetch();
          }}
        />
      ) : null}
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
        sx={{
          p: 1.5,
          my: 1.5,
          bgcolor: 'var(--dwp-product-soft)',
          borderRadius: foundationTokens.radius.control + 'px',
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'minmax(0, 1.3fr) minmax(0, 1fr)',
              lg: 'minmax(250px, 1.4fr) repeat(2, minmax(120px, 0.7fr)) auto',
            },
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          <DateRangePickerField
            value={draftRange}
            onValueChange={setDraftRange}
            startLabel={t('workplace.admin.operations.filters.from')}
            endLabel={t('workplace.admin.operations.filters.to')}
            orderErrorMessage={t('workplace.admin.operations.filters.rangeOrder')}
            errorMessage={
              draftIssue === 'tooLong'
                ? t('workplace.admin.operations.filters.rangeTooLong')
                : draftIssue === 'invalid'
                  ? t('workplace.admin.operations.filters.rangeInvalid')
                  : undefined
            }
            required
            pickerProps={{ size: 'small' }}
          />
          {tab === 'bookings' ? (
            <>
              <SelectField
                size="small"
                label={t('workplace.admin.operations.filters.status')}
                value={bookingDraft.status}
                onValueChange={(status) =>
                  setBookingDraft((current) => ({
                    ...current,
                    status: status as BookingFilters['status'],
                  }))
                }
                options={[
                  { value: 'ALL', label: t('workplace.admin.operations.filters.allStatuses') },
                  ...BOOKING_STATUSES.map((status) => ({
                    value: status,
                    label: t(`workplace.bookingStatus.${status}`),
                  })),
                ]}
              />
              <FormField
                size="small"
                type="number"
                label={t('workplace.admin.operations.filters.userId')}
                value={bookingDraft.userId}
                errorMessage={
                  bookingUserInvalid
                    ? t('workplace.admin.operations.filters.userIdError')
                    : undefined
                }
                reserveFeedbackSpace
                inputProps={{ min: 1, step: 1 }}
                onChange={(event) =>
                  setBookingDraft((current) => ({ ...current, userId: event.target.value }))
                }
              />
            </>
          ) : (
            <>
              <FormField
                size="small"
                label={t('workplace.admin.operations.filters.action')}
                value={auditDraft.action}
                inputProps={{ maxLength: 120 }}
                onChange={(event) =>
                  setAuditDraft((current) => ({ ...current, action: event.target.value }))
                }
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                <FormField
                  size="small"
                  label={t('workplace.admin.operations.filters.aggregateType')}
                  value={auditDraft.aggregateType}
                  inputProps={{ maxLength: 80 }}
                  onChange={(event) =>
                    setAuditDraft((current) => ({
                      ...current,
                      aggregateType: event.target.value,
                    }))
                  }
                />
                <FormField
                  size="small"
                  type="number"
                  label={t('workplace.admin.operations.filters.actorUserId')}
                  value={auditDraft.actorUserId}
                  errorMessage={
                    auditUserInvalid
                      ? t('workplace.admin.operations.filters.userIdError')
                      : undefined
                  }
                  reserveFeedbackSpace
                  inputProps={{ min: 1, step: 1 }}
                  onChange={(event) =>
                    setAuditDraft((current) => ({
                      ...current,
                      actorUserId: event.target.value,
                    }))
                  }
                />
              </Stack>
            </>
          )}
          <Stack direction="row" gap={1} justifyContent={{ xs: 'stretch', lg: 'flex-end' }}>
            <ActionButton
              intent="quiet"
              onClick={resetFilters}
              sx={{ flex: { xs: 1, lg: 'none' } }}
            >
              {t('actions.resetFilters')}
            </ActionButton>
            <ActionButton
              type="submit"
              intent="primary"
              startIcon={<Search size={16} />}
              disabled={Boolean(draftIssue || activeUserInvalid)}
              sx={{ flex: { xs: 1, lg: 'none' } }}
            >
              {t('workplace.admin.operations.filters.apply')}
            </ActionButton>
          </Stack>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t('workplace.admin.operations.filters.timeZone', { timeZone })}
        </Typography>
      </Box>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ minHeight: 48, py: 1 }}
      >
        <Typography variant="body2" color="text.secondary" role="status">
          {activeQuery.isFetching
            ? t('workplace.admin.operations.refreshing')
            : updatedAt
              ? t('workplace.admin.operations.updatedAt', { time: updatedAt })
              : t('workplace.admin.operations.notLoaded')}
        </Typography>
        <ActionIconButton
          label={t('workplace.admin.operations.refresh')}
          disabled={
            !capabilities.isLoaded || !capabilities.canViewWorkplaceAdmin || activeQuery.isFetching
          }
          onClick={() => void activeQuery.refetch()}
        >
          <RefreshCw size={17} />
        </ActionIconButton>
      </Stack>
      {activeQuery.isFetching && <LinearProgress aria-hidden="true" />}
      {activeQuery.isError && (
        <Alert
          severity={activeQuery.data ? 'warning' : 'error'}
          action={
            <ActionButton intent="quiet" onClick={() => void activeQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
          sx={{ my: 1.5 }}
        >
          {activeQuery.data
            ? t('workplace.admin.operations.staleError')
            : t('workplace.admin.operations.loadError')}
        </Alert>
      )}

      {tab === 'bookings' ? (
        !scopeReady || bookingsQuery.isError || bookingsScopeMismatch ? (
          <WorkplaceExperienceQueryError retry={() => void bookingsQuery.refetch()} />
        ) : (
          <BookingResults
            data={scopeReady && !bookingsQuery.isError ? bookingsQuery.data : undefined}
            loading={bookingsQuery.isPending}
            mobile={mobile}
            canManage={capabilities.canManageWorkplaceAdmin}
            actionsEnabled={!bookingsQuery.isFetching && !bookingsQuery.isError}
            page={bookingPage}
            size={bookingSize}
            formatInstant={formatInstant}
            onPage={setBookingPage}
            onSize={(size) => {
              setBookingSize(size);
              setBookingPage(0);
            }}
            onReview={setReviewTarget}
            onCancel={setCancelTarget}
            onLegalHold={legalHold.open}
          />
        )
      ) : (
        <AuditResults
          data={auditQuery.data}
          loading={auditQuery.isPending}
          mobile={mobile}
          page={auditPage}
          size={auditSize}
          formatInstant={formatInstant}
          slots={{
            desktopAction: <Typography variant="body2" fontWeight={750} />,
            mobileAction: (
              <Typography fontWeight={750} sx={{ mt: 0.5, overflowWrap: 'anywhere' }} />
            ),
            desktopCorrelation: (
              <TableCell
                sx={{ maxWidth: 240, overflowWrap: 'anywhere', fontFamily: 'monospace' }}
              />
            ),
            mobileCorrelation: (
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 0.25, overflowWrap: 'anywhere', fontFamily: 'monospace' }}
              />
            ),
          }}
          onPage={setAuditPage}
          onSize={(size) => {
            setAuditSize(size);
            setAuditPage(0);
          }}
        />
      )}

      <WorkplaceExperienceBookingInspector
        siteId={reviewTarget?.siteId ?? ''}
        bookingId={
          scopeReady && reviewTarget?.siteId && reviewTarget.floorId ? reviewTarget.bookingId : null
        }
        timeZone={sites.find((site) => site.siteId === reviewTarget?.siteId)?.timeZone ?? timeZone}
        onClose={() => setReviewTarget(null)}
      />
      <FormDialog
        open={Boolean(cancelTarget)}
        title={t('workplace.admin.operations.forceCancel.title')}
        description={
          cancelTarget
            ? t('workplace.admin.operations.forceCancel.description', {
                resource: cancelTarget.resourceName,
                user: cancelTarget.bookedForDisplayName,
              })
            : undefined
        }
        cancelLabel={t('actions.keep')}
        submitLabel={t('workplace.admin.operations.forceCancel.submit')}
        submittingLabel={t('actions.cancelling')}
        submitIntent="danger"
        busy={cancelMutation.isPending}
        submitDisabled={!capabilities.canManageWorkplaceAdmin || !reason.trim()}
        onClose={() => {
          setCancelTarget(null);
          setReason('');
        }}
        onSubmit={() => {
          if (cancelTarget && reason.trim()) {
            cancelMutation.mutate({ booking: cancelTarget, cancellationReason: reason.trim() });
          }
        }}
      >
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('workplace.admin.operations.forceCancel.warning')}
        </Alert>
        <FormField
          autoFocus
          required
          multiline
          minRows={4}
          label={t('workplace.admin.operations.forceCancel.reason')}
          value={reason}
          inputProps={{ maxLength: 1000 }}
          supportingText={t('workplace.admin.operations.forceCancel.reasonHint')}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormDialog>

      <WorkplaceLegalHoldDialog
        control={legalHold}
        canManage={capabilities.canManageWorkplaceAdmin}
      />
    </PageCanvas>
  );
}

function BookingResults({
  data,
  loading,
  mobile,
  canManage,
  actionsEnabled,
  page,
  size,
  formatInstant,
  onPage,
  onSize,
  onReview,
  onCancel,
  onLegalHold,
}: {
  data?: WorkplaceAdminBookingPage;
  loading: boolean;
  mobile: boolean;
  canManage: boolean;
  actionsEnabled: boolean;
  page: number;
  size: number;
  formatInstant: (value: string) => string;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
  onReview: (booking: WorkplaceAdminBooking) => void;
  onCancel: (booking: WorkplaceAdminBooking) => void;
  onLegalHold: (booking: WorkplaceAdminBooking) => void;
}) {
  const { t } = useTranslation('rooms');
  if (loading && !data) return <ResultSkeleton />;
  if (!data?.content.length) {
    return (
      <EmptyState
        size="standard"
        icon={<CalendarRange size={28} />}
        title={t('workplace.admin.operations.bookings.empty')}
        description={t('workplace.admin.operations.bookings.emptyDescription')}
      />
    );
  }
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.control + 'px',
        overflow: 'hidden',
      }}
    >
      {mobile ? (
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {data.content.map((booking) => (
            <Box key={booking.bookingId} sx={{ p: 2, minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={750}>{booking.resourceName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {booking.siteName} · {booking.floorName}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  color={statusColor(booking.status)}
                  label={t(`workplace.bookingStatus.${booking.status}`)}
                />
              </Stack>
              <Typography variant="body2" sx={{ mt: 1.5 }}>
                {booking.bookedForDisplayName} · #{booking.userId}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {formatInstant(booking.startsAt)} - {formatInstant(booking.endsAt)}
              </Typography>
              {booking.legalHold && (
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  icon={<ShieldCheck size={14} />}
                  label={t('workplace.admin.operations.bookings.legalHold')}
                  sx={{ mt: 1 }}
                />
              )}
              {booking.purpose && (
                <Typography variant="body2" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
                  {booking.purpose}
                </Typography>
              )}
              <ActionButton
                intent="secondary"
                disabled={!actionsEnabled || !booking.siteId || !booking.floorId}
                onClick={() => onReview(booking)}
                sx={{ mt: 1 }}
              >
                {t('workplace.experience.review')}
              </ActionButton>
              {canManage && canForceCancelBooking(booking.status) && (
                <ActionButton
                  intent="danger"
                  startIcon={<Ban size={16} />}
                  onClick={() => onCancel(booking)}
                  disabled={!actionsEnabled}
                  sx={{ mt: 1.5 }}
                >
                  {t('workplace.admin.operations.bookings.forceCancel')}
                </ActionButton>
              )}
              {canManage && !booking.anonymizedAt && (
                <ActionButton
                  intent="quiet"
                  startIcon={<ShieldCheck size={16} />}
                  onClick={() => onLegalHold(booking)}
                  disabled={!actionsEnabled}
                  sx={{ mt: 1.5, ml: canForceCancelBooking(booking.status) ? 1 : 0 }}
                >
                  {t(
                    booking.legalHold
                      ? 'workplace.admin.operations.bookings.releaseLegalHold'
                      : 'workplace.admin.operations.bookings.applyLegalHold'
                  )}
                </ActionButton>
              )}
            </Box>
          ))}
        </Stack>
      ) : (
        <TableContainer>
          <Table size="small" aria-label={t('workplace.admin.operations.bookings.tableLabel')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('workplace.admin.operations.bookings.resource')}</TableCell>
                <TableCell>{t('workplace.admin.operations.bookings.user')}</TableCell>
                <TableCell>{t('workplace.admin.operations.bookings.period')}</TableCell>
                <TableCell>{t('workplace.admin.operations.bookings.status')}</TableCell>
                {canManage && (
                  <TableCell align="right">
                    {t('workplace.admin.operations.bookings.action')}
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.content.map((booking) => (
                <TableRow key={booking.bookingId} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={750}>
                      <ActionButton
                        intent="quiet"
                        disabled={!actionsEnabled || !booking.siteId || !booking.floorId}
                        onClick={() => onReview(booking)}
                        sx={{ px: 0, justifyContent: 'start', textAlign: 'left' }}
                      >
                        {booking.resourceName}
                      </ActionButton>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {booking.siteName} · {booking.floorName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{booking.bookedForDisplayName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      #{booking.userId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatInstant(booking.startsAt)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('workplace.admin.operations.bookings.until', {
                        time: formatInstant(booking.endsAt),
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={statusColor(booking.status)}
                      label={t(`workplace.bookingStatus.${booking.status}`)}
                    />
                    {booking.legalHold && (
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={t('workplace.admin.operations.bookings.legalHold')}
                        sx={{ ml: 0.75 }}
                      />
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell align="right">
                      <Stack direction="row" gap={0.75} justifyContent="flex-end">
                        {canForceCancelBooking(booking.status) && (
                          <ActionButton
                            intent="danger"
                            disabled={!actionsEnabled}
                            onClick={() => onCancel(booking)}
                          >
                            {t('workplace.admin.operations.bookings.forceCancel')}
                          </ActionButton>
                        )}
                        {!booking.anonymizedAt && (
                          <ActionIconButton
                            label={t(
                              booking.legalHold
                                ? 'workplace.admin.operations.bookings.releaseLegalHold'
                                : 'workplace.admin.operations.bookings.applyLegalHold'
                            )}
                            disabled={!actionsEnabled}
                            onClick={() => onLegalHold(booking)}
                          >
                            <ShieldCheck size={16} />
                          </ActionIconButton>
                        )}
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <OperationsPagination
        count={data.totalElements}
        page={page}
        size={size}
        onPage={onPage}
        onSize={onSize}
      />
    </Box>
  );
}
