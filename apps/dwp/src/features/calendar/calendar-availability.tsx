import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, CalendarCheck2, Clock3, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import {
  evaluateCalendarScheduling,
  getPerson,
  listPeople,
  useAuth,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  AutocompleteMultiField,
  DateRangePickerField,
  GuidedEmptyState,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { CalendarEventDialog } from './calendar-event-dialog';
import { CalendarPageHeading, calendarDate, calendarTime } from './calendar-components';
import { CalendarCanvas, CalendarSectionHeader } from './calendar-experience';
import {
  CALENDAR_AVAILABILITY_ATTENDEE_LIMIT,
  calendarSchedulingEvaluationIsUsable,
} from './calendar-scheduling-assistant-model';

import type { CalendarAvailabilitySlot, PersonSummary } from '@dwp-frontend/shared-utils';
import type { DateRangeValue } from '@dwp-frontend/design-system';

function dateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialRange(): DateRangeValue {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: dateOnly(start), end: dateOnly(end) };
}

function isoRange(value: DateRangeValue) {
  if (!value.start || !value.end) return null;
  const from = new Date(`${value.start}T00:00:00`);
  const to = new Date(`${value.end}T00:00:00`);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function CalendarAvailability() {
  const { t, i18n } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const auth = useAuth();
  const canViewPeople = hasPermission('APP.PEOPLE_DIRECTORY', 'VIEW');
  const [searchParams] = useSearchParams();
  const requestedPeople = searchParams.getAll('person');
  const requestedPerson =
    requestedPeople.length === 1 && /^[A-Za-z0-9_-]{1,128}$/u.test(requestedPeople[0] ?? '')
      ? requestedPeople[0]!
      : null;
  const consumedPerson = useRef<string | null>(null);
  const canCreate = hasPermission('APP.CALENDAR', 'CREATE');
  const workplacePath = hasPermission('APP.ROOMS', 'VIEW')
    ? '/workplace/rooms'
    : hasPermission('APP.WORKPLACE', 'VIEW')
      ? '/workplace/explore'
      : null;
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [searchedPeople, setSearchedPeople] = useState<PersonSummary[]>([]);
  const [duration, setDuration] = useState(30);
  const [range, setRange] = useState<DateRangeValue>(initialRange);
  const [selectedSlot, setSelectedSlot] = useState<CalendarAvailabilitySlot | null>(null);
  const [, setFreshnessTick] = useState(0);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const timeZone = resolveSystemTimeZone('Asia/Seoul');
  const peopleQuery = useQuery({
    queryKey: ['calendar', 'availability', 'people', auth.user?.tenantId, auth.user?.userId],
    queryFn: () => listPeople({ size: 100, surface: 'directory' }),
    enabled: canViewPeople,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const sharedPersonQuery = useQuery({
    queryKey: [
      'calendar',
      'availability',
      'shared-person',
      auth.user?.tenantId,
      auth.user?.userId,
      requestedPerson,
    ],
    queryFn: ({ signal }) =>
      getPerson(requestedPerson!, undefined, 'directory', undefined, signal, 'directory'),
    enabled: Boolean(requestedPerson && canViewPeople),
    retry: false,
    staleTime: 0,
  });
  const availability = useMutation({
    mutationFn: async () => {
      const values = isoRange(range);
      if (!values) throw new Error(t('availability.rangeRequired'));
      return evaluateCalendarScheduling({
        personIds: people.map((person) => person.personId),
        from: values.from,
        to: values.to,
        roomStartsAt: values.from,
        roomEndsAt: new Date(Date.parse(values.from) + duration * 60_000).toISOString(),
        durationMinutes: duration,
        timeZone,
      });
    },
  });
  const resetAvailability = availability.reset;
  const evaluationUsable = calendarSchedulingEvaluationIsUsable(availability.data);
  const result = evaluationUsable ? availability.data?.availability : undefined;
  const participantLoadMax = Math.max(
    1,
    ...(result?.participants.map((participant) => participant.busyMinutes) ?? [])
  );
  const participantById = useMemo(
    () => new Map(searchedPeople.map((person) => [person.personId, person])),
    [searchedPeople]
  );
  const resetResults = () => {
    availability.reset();
    setSearchedPeople([]);
    setSelectedSlot(null);
  };

  useEffect(() => {
    const person = sharedPersonQuery.data?.person;
    if (
      !requestedPerson ||
      sharedPersonQuery.isError ||
      sharedPersonQuery.isFetching ||
      consumedPerson.current === requestedPerson
    )
      return;
    if (!person || person.personId !== requestedPerson || !person.workEmail) return;
    consumedPerson.current = requestedPerson;
    resetAvailability();
    setPeople([person]);
    setSearchedPeople([]);
    setSelectedSlot(null);
  }, [
    resetAvailability,
    requestedPerson,
    sharedPersonQuery.data,
    sharedPersonQuery.isError,
    sharedPersonQuery.isFetching,
  ]);

  useEffect(() => {
    if (canViewPeople && !sharedPersonQuery.isError) return;
    resetAvailability();
    setPeople((current) =>
      current.filter((person) => canViewPeople && person.personId !== requestedPerson)
    );
    setSearchedPeople([]);
    setSelectedSlot(null);
  }, [canViewPeople, requestedPerson, resetAvailability, sharedPersonQuery.isError]);

  useEffect(() => {
    const validUntil = availability.data?.validUntil;
    if (!validUntil) return;
    const delay = Date.parse(validUntil) - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = window.setTimeout(() => setFreshnessTick((current) => current + 1), delay + 25);
    return () => window.clearTimeout(timer);
  }, [availability.data?.validUntil]);

  return (
    <CalendarCanvas archetype="command">
      <CalendarPageHeading
        icon={UsersRound}
        eyebrow={t('availability.eyebrow')}
        title={t('availability.title')}
        description={t('availability.description')}
        actions={
          workplacePath ? (
            <ActionButton
              component={Link}
              to={workplacePath}
              intent="secondary"
              startIcon={<Building2 size={17} />}
            >
              {t('availability.openWorkplace')}
            </ActionButton>
          ) : undefined
        }
      />

      <Box
        component="section"
        sx={(theme) => ({
          p: { xs: 2, md: 2.5 },
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.035),
          border: 1,
          borderColor: alpha(theme.palette.divider, 0.75),
          borderRadius: 1,
        })}
      >
        <CalendarSectionHeader
          padded={false}
          icon={Search}
          title={t('availability.composerTitle')}
          description={t('availability.composerDescription')}
        />
        <Box
          sx={{
            mt: 2.25,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.6fr) 240px auto' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Stack spacing={2}>
            {requestedPerson && sharedPersonQuery.isError ? (
              <Typography variant="body2" color="error.main" role="alert">
                {t('availability.sharedPersonUnavailable')}
              </Typography>
            ) : null}
            {peopleQuery.isError && (
              <Alert
                severity="error"
                action={
                  <ActionButton intent="quiet" size="small" onClick={() => peopleQuery.refetch()}>
                    {t('actions.retry')}
                  </ActionButton>
                }
              >
                {t('availability.peopleLoadError')}
              </Alert>
            )}
            <AutocompleteMultiField
              multiple
              options={(peopleQuery.data?.items ?? []).filter((person) =>
                Boolean(person.workEmail)
              )}
              value={people}
              onChange={(_, value) => {
                resetResults();
                setPeople(value.slice(0, CALENDAR_AVAILABILITY_ATTENDEE_LIMIT));
              }}
              loading={peopleQuery.isLoading}
              getOptionDisabled={(option) =>
                people.length >= CALENDAR_AVAILABILITY_ATTENDEE_LIMIT &&
                !people.some((person) => person.personId === option.personId)
              }
              getOptionLabel={(person) =>
                `${person.displayName} · ${person.businessTitle ?? person.workEmail}`
              }
              isOptionEqualToValue={(option, value) => option.personId === value.personId}
              renderTags={(values, getTagProps) =>
                values.map((person, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={person.personId}
                    avatar={<Avatar>{person.displayName.slice(0, 1)}</Avatar>}
                    label={person.displayName}
                  />
                ))
              }
              label={t('availability.peopleLabel')}
              supportingText={t('availability.peopleLimit')}
              textFieldProps={{
                placeholder: people.length ? undefined : t('availability.peoplePlaceholder'),
              }}
            />
            <DateRangePickerField
              value={range}
              onValueChange={(value) => {
                resetResults();
                setRange(value);
              }}
              startLabel={t('availability.fromLabel')}
              endLabel={t('availability.toLabel')}
              orderErrorMessage={t('availability.rangeError')}
              minDate={dateOnly(new Date())}
              required
            />
          </Stack>
          <SelectField
            label={t('availability.durationLabel')}
            value={duration}
            onValueChange={(value) => {
              resetResults();
              setDuration(Number(value));
            }}
            options={[15, 30, 45, 60, 90, 120].map((value) => ({
              value,
              label: t('units.minutes', { count: value }),
            }))}
          />
          <ActionButton
            intent="primary"
            startIcon={<Search size={17} />}
            loading={availability.isPending}
            onClick={() => {
              setSearchedPeople([...people]);
              availability.mutate();
            }}
            sx={{ minHeight: 48, px: 2.5 }}
          >
            {t('availability.find')}
          </ActionButton>
        </Box>
      </Box>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        color="text.secondary"
        sx={{ mt: 1.5 }}
      >
        <ShieldCheck size={15} />
        <Typography variant="caption">{t('availability.privacy')}</Typography>
      </Stack>

      {availability.isError ? (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={
            <ActionButton intent="quiet" size="small" onClick={() => availability.mutate()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {availability.error instanceof Error
            ? availability.error.message
            : t('availability.loadError')}
        </Alert>
      ) : availability.isPending ? (
        <Box
          sx={{
            mt: 3,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '320px 1fr' },
            gap: 2,
          }}
        >
          <Skeleton variant="rounded" height={300} />
          <Skeleton variant="rounded" height={420} />
        </Box>
      ) : availability.data && !evaluationUsable ? (
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          role="status"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => availability.mutate()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('schedulingAssistant.incompleteResults')}
        </Alert>
      ) : result ? (
        <Box
          sx={{
            mt: 3,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' },
            gap: 2,
          }}
        >
          <Box
            component="section"
            sx={{
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <CalendarSectionHeader
              icon={UsersRound}
              title={t('availability.participants')}
              description={t('availability.participantsDescription')}
              meta={
                <Typography variant="caption" color="text.secondary" role="status">
                  {t('schedulingAssistant.freshness', {
                    time: calendarTime(result.generatedAt, language),
                  })}
                </Typography>
              }
            />
            <Divider />
            <Stack divider={<Divider flexItem />}>
              {result.participants.map((participant, index) => {
                const person = participantById.get(participant.personPublicId);
                return (
                  <Stack
                    key={participant.personPublicId}
                    direction="row"
                    spacing={1.25}
                    alignItems="center"
                    sx={{ p: 1.75 }}
                  >
                    <Avatar
                      sx={{
                        width: 34,
                        height: 34,
                        bgcolor: index === 0 && !person ? 'primary.main' : 'action.selected',
                        color: index === 0 && !person ? 'primary.contrastText' : 'text.primary',
                        fontSize: 13,
                      }}
                    >
                      {person?.displayName.slice(0, 1) ?? t('availability.meShort')}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {person?.displayName ?? t('availability.me')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('availability.busyMinutes', { count: participant.busyMinutes })}
                      </Typography>
                      <Box
                        role="meter"
                        aria-valuemin={0}
                        aria-valuemax={participantLoadMax}
                        aria-valuenow={participant.busyMinutes}
                        aria-label={t('availability.busyMinutes', {
                          count: participant.busyMinutes,
                        })}
                        sx={(theme) => ({
                          mt: 0.65,
                          height: 5,
                          borderRadius: 999,
                          bgcolor: alpha(theme.palette.text.secondary, 0.1),
                          overflow: 'hidden',
                        })}
                      >
                        <Box
                          aria-hidden="true"
                          sx={{
                            width: `${(participant.busyMinutes * 100) / participantLoadMax}%`,
                            height: 1,
                            borderRadius: 999,
                            bgcolor: 'primary.main',
                          }}
                        />
                      </Box>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          </Box>

          <Box
            component="section"
            sx={{
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <CalendarSectionHeader
              icon={CalendarCheck2}
              title={t('availability.suggestions')}
              description={t('availability.suggestionsDescription')}
            />
            <Divider />
            {result.suggestions.length ? (
              <Box
                component="ol"
                sx={{
                  p: 0,
                  m: 0,
                  listStyle: 'none',
                }}
              >
                {result.suggestions.map((slot, index) => (
                  <Box
                    component="li"
                    key={slot.startsAt}
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Box
                      component={canCreate ? 'button' : 'div'}
                      type={canCreate ? 'button' : undefined}
                      onClick={canCreate ? () => setSelectedSlot(slot) : undefined}
                      sx={(theme) => ({
                        width: 1,
                        minHeight: 92,
                        display: 'grid',
                        gridTemplateColumns: '36px minmax(0, 1fr) auto',
                        gap: 1.25,
                        alignItems: 'center',
                        px: { xs: 1.75, sm: 2.25 },
                        py: 1.5,
                        border: 0,
                        bgcolor: 'transparent',
                        color: 'text.primary',
                        textAlign: 'left',
                        cursor: canCreate ? 'pointer' : 'default',
                        transition: theme.transitions.create('background-color'),
                        '&:hover': canCreate
                          ? {
                              bgcolor: alpha(
                                theme.palette.success.main,
                                theme.palette.mode === 'dark' ? 0.12 : 0.045
                              ),
                            }
                          : undefined,
                        '&:focus-visible': {
                          outline: '2px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: -2,
                        },
                        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                      })}
                    >
                      <Box
                        aria-hidden="true"
                        sx={(theme) => ({
                          width: 32,
                          height: 32,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '50%',
                          bgcolor: alpha(theme.palette.success.main, 0.12),
                          color: 'success.dark',
                          fontSize: 13,
                          fontWeight: 700,
                        })}
                      >
                        {index + 1}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={600}>
                          {calendarDate(slot.startsAt, language)}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                          color="text.secondary"
                        >
                          <Clock3 size={15} />
                          <Typography variant="body2">
                            {calendarTime(slot.startsAt, language)} –{' '}
                            {calendarTime(slot.endsAt, language)}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {slot.reason}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color="success"
                        variant="outlined"
                        label={`${slot.score}%`}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <GuidedEmptyState
                kind="no-results"
                title={t('availability.noSlots')}
                description={t('availability.noSlotsDescription')}
              />
            )}
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            mt: 3,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <GuidedEmptyState
            kind="first-use"
            title={t('availability.emptyTitle')}
            description={t('availability.emptyDescription')}
          />
        </Box>
      )}

      {canCreate && (
        <CalendarEventDialog
          open={Boolean(selectedSlot)}
          initialStart={selectedSlot?.startsAt}
          initialEnd={selectedSlot?.endsAt}
          initialAttendees={searchedPeople}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </CalendarCanvas>
  );
}
