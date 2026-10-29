import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  evaluateCalendarSchedulingV2,
  getCalendarPolicy,
  getPerson,
  hardRecheckCalendarSchedulingV2,
  useAuth,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DateRangePickerField,
  GuidedEmptyState,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { CalendarEventDialog } from './calendar-event-dialog';
import { CalendarAttendeePicker } from './calendar-attendee-picker';
import { calendarAvailabilityIsoRange } from './calendar-availability-range';
import { CalendarAvailabilityResultsV2 } from './calendar-availability-results-v2';
import { useCalendarEffectivePreferences } from './calendar-effective-preferences';
import { CalendarPageHeading } from './calendar-components';
import { CalendarCanvas, CalendarSectionHeader } from './calendar-experience';
import {
  calendarSchedulingAssistedDraftFingerprintV2,
  calendarSchedulingVerificationReceiptV2,
  type CalendarSchedulingVerificationReceiptV2,
} from './calendar-scheduling-final-check';
import { CALENDAR_AVAILABILITY_ATTENDEE_LIMIT } from './calendar-scheduling-assistant-model';
import {
  calendarSchedulingEvaluationStateV2,
  calendarSchedulingFingerprintV2,
  calendarSchedulingParticipantsV2,
} from './calendar-scheduling-v2-model';

import type {
  CalendarSchedulingCandidateV2,
  CalendarSchedulingEvaluationInputV2,
  CalendarSchedulingEvaluationV2,
} from '@dwp-frontend/shared-utils';
import type { CalendarEditorAttendee } from './calendar-event-editor-model';
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

type SelectedSchedulingSlot = Readonly<{
  candidate: CalendarSchedulingCandidateV2;
  receipt: CalendarSchedulingVerificationReceiptV2;
}>;

function AvailabilityProgress({ step }: Readonly<{ step: 1 | 2 | 3 }>) {
  const { t } = useTranslation('calendar');
  return (
    <Box
      component="ol"
      aria-label={t('availability.progressLabel')}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 0,
        p: 0,
        m: '0 0 20px',
        listStyle: 'none',
      }}
    >
      {([1, 2, 3] as const).map((value) => {
        const complete = value < step;
        const current = value === step;
        return (
          <Stack
            component="li"
            key={value}
            spacing={0.75}
            alignItems="center"
            aria-current={current ? 'step' : undefined}
            sx={{ position: 'relative', minWidth: 0 }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 32,
                height: 32,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                border: 2,
                borderColor: current || complete ? 'primary.main' : 'divider',
                bgcolor: current || complete ? 'primary.main' : 'background.paper',
                color: current || complete ? 'primary.contrastText' : 'text.secondary',
                fontWeight: 700,
                zIndex: 1,
                '&::before':
                  value === 1
                    ? undefined
                    : {
                        content: '""',
                        position: 'absolute',
                        top: 15,
                        right: '50%',
                        width: '100%',
                        height: 2,
                        bgcolor: complete ? 'primary.main' : 'divider',
                        zIndex: -1,
                      },
                '@media (forced-colors: active)': {
                  borderColor: current || complete ? 'Highlight' : 'CanvasText',
                  backgroundColor: current || complete ? 'Highlight' : 'Canvas',
                  color: current || complete ? 'HighlightText' : 'CanvasText',
                },
              }}
            >
              {complete ? '✓' : value}
            </Box>
            <Typography
              variant="caption"
              fontWeight={current ? 700 : 500}
              color={current ? 'text.primary' : 'text.secondary'}
              textAlign="center"
              sx={{ lineHeight: 1.25 }}
            >
              {t(`availability.steps.${value}`)}
            </Typography>
          </Stack>
        );
      })}
    </Box>
  );
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
    ? '/workplace/find?v=1&types=ROOM'
    : hasPermission('APP.WORKPLACE', 'VIEW')
      ? '/workplace/find?v=1&types=ALL'
      : null;
  const [people, setPeople] = useState<CalendarEditorAttendee[]>([]);
  const [searchedPeople, setSearchedPeople] = useState<CalendarEditorAttendee[]>([]);
  const [duration, setDuration] = useState(30);
  const [range, setRange] = useState<DateRangeValue>(initialRange);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSchedulingSlot | null>(null);
  const [lastFingerprint, setLastFingerprint] = useState<string | null>(null);
  const [hardRecheckFailed, setHardRecheckFailed] = useState(false);
  const [, setFreshnessTick] = useState(0);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { preferences: calendarPreferences } = useCalendarEffectivePreferences();
  const timeZone = calendarPreferences.timeZone;
  const policyQuery = useQuery({
    queryKey: ['calendar', 'policy'],
    queryFn: getCalendarPolicy,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const externalAttendeePolicyState = policyQuery.isPending
    ? ('LOADING' as const)
    : policyQuery.isError
      ? ('UNAVAILABLE' as const)
      : policyQuery.data?.allowExternalAttendees
        ? ('ALLOWED' as const)
        : ('DENIED' as const);
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
  const participantSelection = useMemo(
    () => calendarSchedulingParticipantsV2(people, CALENDAR_AVAILABILITY_ATTENDEE_LIMIT),
    [people]
  );
  const evaluationInput = useMemo<CalendarSchedulingEvaluationInputV2 | null>(() => {
    const values = calendarAvailabilityIsoRange(range, timeZone);
    if (!values) return null;
    return {
      participants: [...participantSelection.participants],
      searchWindow: values,
      candidateSlot: {
        startsAt: values.from,
        endsAt: new Date(Date.parse(values.from) + duration * 60_000).toISOString(),
      },
      durationMinutes: duration,
      searchTimeZone: timeZone,
      roomCriteria: {
        minimumCapacity: people.length + 1,
        requiredFeatures: [],
        preferredFeatures: ['VIDEO'],
        approvalPreference: 'PREFER_NO_APPROVAL',
      },
    };
  }, [duration, participantSelection.participants, people.length, range, timeZone]);
  const fingerprint = evaluationInput
    ? calendarSchedulingFingerprintV2(evaluationInput)
    : 'INVALID';
  const fingerprintRef = useRef(fingerprint);
  fingerprintRef.current = fingerprint;
  const availability = useMutation<
    CalendarSchedulingEvaluationV2,
    Error,
    Readonly<{ input: CalendarSchedulingEvaluationInputV2; fingerprint: string }>
  >({
    mutationFn: (request) => evaluateCalendarSchedulingV2(request.input),
    onSuccess: (_evaluation, request) => setLastFingerprint(request.fingerprint),
  });
  const resetAvailability = availability.reset;
  const hardRecheck = useMutation({
    mutationFn: ({
      evaluation,
      candidate,
    }: Readonly<{
      evaluation: CalendarSchedulingEvaluationV2;
      candidate: CalendarSchedulingCandidateV2;
      fingerprint: string;
    }>) => {
      if (!evaluation.challengeToken) throw new Error('A fresh scheduling challenge is required.');
      return hardRecheckCalendarSchedulingV2(evaluation.evaluationId, {
        challengeToken: evaluation.challengeToken,
        criteriaHash: evaluation.criteriaHash,
        selection: { startsAt: candidate.startsAt, endsAt: candidate.endsAt },
        roomId: null,
      });
    },
    onSuccess: (recheck, request) => {
      const receipt = calendarSchedulingVerificationReceiptV2(
        request.evaluation,
        recheck,
        { startsAt: request.candidate.startsAt, endsAt: request.candidate.endsAt },
        null,
        calendarSchedulingAssistedDraftFingerprintV2({
          startsAt: request.candidate.startsAt,
          endsAt: request.candidate.endsAt,
          timeZone,
          attendees: people.map((person) => ({ ...person, type: 'REQUIRED' })),
          resourceId: null,
        })
      );
      if (request.fingerprint === fingerprintRef.current && receipt) {
        setSelectedSlot({ candidate: request.candidate, receipt });
        return;
      }
      setHardRecheckFailed(true);
    },
    onError: () => setHardRecheckFailed(true),
    onSettled: () => {
      setLastFingerprint(null);
      resetAvailability();
    },
  });
  const resetHardRecheck = hardRecheck.reset;
  const evaluationMatches = lastFingerprint === fingerprint;
  const evaluationState = calendarSchedulingEvaluationStateV2(availability.data, evaluationMatches);
  const evaluationVisible = Boolean(availability.data && evaluationMatches);
  const search = () => {
    if (!evaluationInput) return;
    setHardRecheckFailed(false);
    resetHardRecheck();
    availability.mutate({ input: evaluationInput, fingerprint });
  };
  const resetResults = () => {
    resetAvailability();
    resetHardRecheck();
    setLastFingerprint(null);
    setHardRecheckFailed(false);
    setSearchedPeople([]);
    setSelectedSlot(null);
  };

  useEffect(() => {
    if (!lastFingerprint || lastFingerprint === fingerprint) return;
    resetAvailability();
    resetHardRecheck();
    setLastFingerprint(null);
    setHardRecheckFailed(false);
  }, [fingerprint, lastFingerprint, resetAvailability, resetHardRecheck]);

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
    resetHardRecheck();
    setLastFingerprint(null);
    setHardRecheckFailed(false);
    setPeople([{ ...person, type: 'REQUIRED' }]);
    setSearchedPeople([]);
    setSelectedSlot(null);
  }, [
    resetAvailability,
    resetHardRecheck,
    requestedPerson,
    sharedPersonQuery.data,
    sharedPersonQuery.isError,
    sharedPersonQuery.isFetching,
  ]);

  useEffect(() => {
    if (canViewPeople && !sharedPersonQuery.isError) return;
    resetAvailability();
    resetHardRecheck();
    setLastFingerprint(null);
    setHardRecheckFailed(false);
    setPeople((current) =>
      current.filter(
        (person) =>
          person.personId.startsWith('email:') ||
          (canViewPeople && person.personId !== requestedPerson)
      )
    );
    setSearchedPeople([]);
    setSelectedSlot(null);
  }, [
    canViewPeople,
    requestedPerson,
    resetAvailability,
    resetHardRecheck,
    sharedPersonQuery.isError,
  ]);

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

      <AvailabilityProgress step={selectedSlot ? 3 : evaluationVisible ? 2 : 1} />

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
            <CalendarAttendeePicker
              scope="availability"
              type="REQUIRED"
              value={people}
              externalPolicyState={externalAttendeePolicyState}
              directoryEnabled={canViewPeople}
              maxSelections={CALENDAR_AVAILABILITY_ATTENDEE_LIMIT}
              onChange={(value) => {
                resetResults();
                setPeople([...value].slice(0, CALENDAR_AVAILABILITY_ATTENDEE_LIMIT));
              }}
              label={t('availability.peopleLabel')}
              placeholder={t('availability.peoplePlaceholder')}
              supportingText={t('availability.peopleLimit')}
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
              search();
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
            <ActionButton intent="quiet" size="small" onClick={search}>
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
      ) : evaluationVisible && availability.data ? (
        <CalendarAvailabilityResultsV2
          evaluation={availability.data}
          state={evaluationState}
          participantLabels={participantSelection.labels}
          language={language}
          timeZone={timeZone}
          canApply={
            canCreate &&
            participantSelection.uncheckedCount === 0 &&
            participantSelection.overflowCount === 0
          }
          applying={hardRecheck.isPending}
          applyError={hardRecheckFailed}
          onApply={(candidate) =>
            hardRecheck.mutate({
              evaluation: availability.data!,
              candidate,
              fingerprint,
            })
          }
        />
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
          initialStart={selectedSlot?.candidate.startsAt}
          initialEnd={selectedSlot?.candidate.endsAt}
          initialTimeZone={timeZone}
          initialAttendees={searchedPeople}
          initialSchedulingReceipt={selectedSlot?.receipt}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </CalendarCanvas>
  );
}
