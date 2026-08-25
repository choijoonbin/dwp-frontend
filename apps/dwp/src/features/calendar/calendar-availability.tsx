import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getCalendarAvailability, listPeople, usePermissions } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  AutocompleteMultiField,
  DateRangePickerField,
  GuidedEmptyState,
  PageCanvas,
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

import { CalendarEventDialog } from './calendar-event-dialog';
import { CalendarPageHeading, calendarDate, calendarTime } from './calendar-components';

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
  const canCreate = hasPermission('APP.CALENDAR', 'CREATE');
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [duration, setDuration] = useState(30);
  const [range, setRange] = useState<DateRangeValue>(initialRange);
  const [selectedSlot, setSelectedSlot] = useState<CalendarAvailabilitySlot | null>(null);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
  const peopleQuery = useQuery({
    queryKey: ['calendar', 'availability', 'people'],
    queryFn: () => listPeople({ size: 100, surface: 'directory' }),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const availability = useMutation({
    mutationFn: async () => {
      const values = isoRange(range);
      if (!values) throw new Error(t('availability.rangeRequired'));
      return getCalendarAvailability(
        people.map((person) => person.personId),
        values.from,
        values.to,
        duration,
        timeZone
      );
    },
  });
  const participantById = useMemo(
    () => new Map(people.map((person) => [person.personId, person])),
    [people]
  );

  return (
    <PageCanvas>
      <CalendarPageHeading
        eyebrow={t('availability.eyebrow')}
        title={t('availability.title')}
        description={t('availability.description')}
      />

      <Box
        component="section"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.6fr) 240px auto' },
          gap: 2,
          alignItems: 'start',
          p: 2.5,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <Stack spacing={2}>
          <AutocompleteMultiField
            multiple
            options={(peopleQuery.data?.items ?? []).filter((person) => Boolean(person.workEmail))}
            value={people}
            onChange={(_, value) => setPeople(value)}
            loading={peopleQuery.isLoading}
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
            textFieldProps={{
              placeholder: people.length ? undefined : t('availability.peoplePlaceholder'),
            }}
          />
          <DateRangePickerField
            value={range}
            onValueChange={setRange}
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
          onValueChange={(value) => setDuration(Number(value))}
          options={[15, 30, 45, 60, 90, 120].map((value) => ({
            value,
            label: t('units.minutes', { count: value }),
          }))}
        />
        <ActionButton
          intent="primary"
          startIcon={<Search size={17} />}
          loading={availability.isPending}
          onClick={() => availability.mutate()}
          sx={{ minHeight: 48, px: 2.5 }}
        >
          {t('availability.find')}
        </ActionButton>
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

      {availability.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {availability.error instanceof Error
            ? availability.error.message
            : t('availability.loadError')}
        </Alert>
      )}

      {availability.isPending ? (
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
      ) : availability.data ? (
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
            <Box sx={{ p: 2 }}>
              <Typography component="h2" variant="h6" fontWeight={800}>
                {t('availability.participants')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('availability.participantsDescription')}
              </Typography>
            </Box>
            <Divider />
            <Stack divider={<Divider flexItem />}>
              {availability.data.participants.map((participant, index) => {
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
                      <Typography variant="body2" fontWeight={750} noWrap>
                        {person?.displayName ?? t('availability.me')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('availability.busyMinutes', { count: participant.busyMinutes })}
                      </Typography>
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
            <Box sx={{ p: 2.25, display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Sparkles size={19} color="#7C3AED" />
              <Box>
                <Typography component="h2" variant="h6" fontWeight={800}>
                  {t('availability.suggestions')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('availability.suggestionsDescription')}
                </Typography>
              </Box>
            </Box>
            <Divider />
            {availability.data.suggestions.length ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                }}
              >
                {availability.data.suggestions.map((slot) => (
                  <Box
                    component={canCreate ? 'button' : 'div'}
                    type={canCreate ? 'button' : undefined}
                    key={slot.startsAt}
                    onClick={canCreate ? () => setSelectedSlot(slot) : undefined}
                    sx={{
                      minHeight: 132,
                      p: 2,
                      border: 0,
                      borderRight: 1,
                      borderBottom: 1,
                      borderColor: 'divider',
                      bgcolor: 'transparent',
                      color: 'text.primary',
                      textAlign: 'left',
                      cursor: canCreate ? 'pointer' : 'default',
                      '&:hover': canCreate ? { bgcolor: 'action.hover' } : undefined,
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: -2,
                      },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Box>
                        <Typography fontWeight={800}>
                          {calendarDate(slot.startsAt, language)}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                          sx={{ mt: 0.5 }}
                          color="text.secondary"
                        >
                          <Clock3 size={15} />
                          <Typography variant="body2">
                            {calendarTime(slot.startsAt, language)} –{' '}
                            {calendarTime(slot.endsAt, language)}
                          </Typography>
                        </Stack>
                      </Box>
                      <Chip
                        size="small"
                        color="success"
                        variant="outlined"
                        label={`${slot.score}%`}
                      />
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 1.25 }}
                    >
                      {slot.reason}
                    </Typography>
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
          initialAttendees={people}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </PageCanvas>
  );
}
