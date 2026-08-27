import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Clock3, Inbox, MapPin, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCalendarEvents,
  respondToCalendarEvent,
  trashCalendarEvent,
  updateCalendarEventPreference,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  GuidedEmptyState,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  CalendarEventDrawer,
  CalendarPageHeading,
  calendarDate,
  calendarTime,
} from './calendar-components';
import { CalendarCanvas, CalendarSectionHeader } from './calendar-experience';
import { eventCapability } from './calendar-source-model';
import {
  calendarHorizon,
  calendarInvitations,
  countCalendarInvitationResponses,
  filterCalendarInvitations,
  type CalendarInvitationFilter,
} from './calendar-workbench-model';

import type { CalendarEvent, CalendarResponseStatus } from '@dwp-frontend/shared-utils';

const FILTERS: readonly CalendarInvitationFilter[] = [
  'ALL',
  'NEEDS_ACTION',
  'ACCEPTED',
  'TENTATIVE',
  'DECLINED',
];

const RESPONSE_TONES: Record<
  CalendarResponseStatus,
  'default' | 'warning' | 'success' | 'info' | 'error'
> = {
  NEEDS_ACTION: 'warning',
  ACCEPTED: 'success',
  TENTATIVE: 'info',
  DECLINED: 'error',
};

function InvitationRow({
  event,
  canRespond,
  busy,
  onOpen,
  onRespond,
}: {
  event: CalendarEvent;
  canRespond: boolean;
  busy: boolean;
  onOpen: () => void;
  onRespond: (response: Exclude<CalendarResponseStatus, 'NEEDS_ACTION'>) => void;
}) {
  const { t, i18n } = useTranslation('calendar');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const response = event.myResponse ?? 'NEEDS_ACTION';

  return (
    <Box
      component="article"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '112px minmax(0, 1fr) auto' },
        gap: { xs: 1.5, md: 2 },
        alignItems: { xs: 'stretch', md: 'center' },
        p: { xs: 1.75, md: 2 },
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Box>
        <Typography variant="body2" fontWeight={600} color="primary.main">
          {calendarDate(event.startsAt, language, false)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {calendarTime(event.startsAt, language)} – {calendarTime(event.endsAt, language)}
        </Typography>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography component="h3" fontWeight={600} noWrap title={event.title}>
            {event.title}
          </Typography>
          <Chip
            size="small"
            color={RESPONSE_TONES[response]}
            variant="outlined"
            label={t(`event.responses.${response}`)}
          />
          {event.conflict && (
            <Chip
              size="small"
              color="error"
              icon={<AlertTriangle size={14} />}
              label={t('event.conflict')}
            />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45 }} noWrap>
          {t('invitations.fromOrganizer', { name: event.organizerName })}
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ mt: 0.7 }} color="text.secondary">
          {event.location && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
              <MapPin size={14} />
              <Typography variant="caption" noWrap title={event.location}>
                {event.location}
              </Typography>
            </Stack>
          )}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Clock3 size={14} />
            <Typography variant="caption">
              {t('units.minutes', {
                count: Math.max(
                  0,
                  Math.round(
                    (new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / 60_000
                  )
                ),
              })}
            </Typography>
          </Stack>
        </Stack>
      </Box>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
        {response === 'NEEDS_ACTION' && canRespond ? (
          <>
            <ActionButton
              size="small"
              intent="primary"
              disabled={busy}
              startIcon={<Check size={15} />}
              onClick={() => onRespond('ACCEPTED')}
            >
              {t('event.accept')}
            </ActionButton>
            <ActionButton
              size="small"
              intent="secondary"
              disabled={busy}
              onClick={() => onRespond('TENTATIVE')}
            >
              {t('event.tentative')}
            </ActionButton>
            <ActionButton
              size="small"
              intent="quiet"
              disabled={busy}
              startIcon={<X size={15} />}
              onClick={() => onRespond('DECLINED')}
            >
              {t('event.decline')}
            </ActionButton>
          </>
        ) : null}
        <ActionButton size="small" intent="quiet" onClick={onOpen}>
          {t('actions.details')}
        </ActionButton>
      </Stack>
    </Box>
  );
}

export function CalendarInvitations() {
  const { t } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => calendarHorizon(now, 7, 90), [now]);
  const [filter, setFilter] = useState<CalendarInvitationFilter>('NEEDS_ACTION');
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [trashing, setTrashing] = useState<CalendarEvent | null>(null);
  const canUpdate = hasPermission('APP.CALENDAR', 'UPDATE');
  const canRespond = canUpdate;
  const query = useQuery({
    queryKey: ['calendar', 'events', range.from, range.to],
    queryFn: () => getCalendarEvents(range.from, range.to),
    staleTime: 20_000,
    retry: 1,
  });
  const respond = useMutation({
    mutationFn: ({
      eventId,
      response,
    }: {
      eventId: string;
      response: Exclude<CalendarResponseStatus, 'NEEDS_ACTION'>;
    }) => respondToCalendarEvent(eventId, response),
    onSuccess: async (event) => {
      setSelected((current) => (current?.eventId === event.eventId ? event : current));
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('event.responseSaved'));
    },
    onError: () => toast.error(t('event.responseError')),
  });
  const trashMutation = useMutation({
    mutationFn: (event: CalendarEvent) =>
      trashCalendarEvent(event.eventId, event.version, t('event.userDeletionReason')),
    onSuccess: async () => {
      setSelected(null);
      setTrashing(null);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('event.trashed'));
    },
    onError: () => toast.error(t('event.trashError')),
  });
  const preferenceMutation = useMutation({
    mutationFn: (event: CalendarEvent) =>
      updateCalendarEventPreference(event.eventId, {
        starred: !event.starred,
        hidden: false,
        version: event.preferenceVersion ?? 0,
      }),
    onSuccess: async (preference, event) => {
      setSelected((current) =>
        current?.eventId === event.eventId
          ? { ...current, starred: preference.starred, preferenceVersion: preference.version }
          : current
      );
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t(preference.starred ? 'event.starred' : 'event.unstarred'));
    },
    onError: () => toast.error(t('event.starError')),
  });
  const all = useMemo(() => query.data ?? [], [query.data]);
  const inbox = useMemo(() => calendarInvitations(all), [all]);
  const counts = useMemo(() => countCalendarInvitationResponses(all, now), [all, now]);
  const filtered = useMemo(() => filterCalendarInvitations(all, filter, now), [all, filter, now]);
  const invitations = inbox.length;
  const conflicts = inbox.filter((event) => event.conflict).length;

  return (
    <CalendarCanvas archetype="queue">
      <CalendarPageHeading
        icon={Inbox}
        eyebrow={t('invitations.eyebrow')}
        title={t('invitations.title')}
        description={t('invitations.description')}
      />

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
          icon={Inbox}
          title={t('invitations.listTitle')}
          description={`${t('invitations.listDescription', { count: invitations })} · ${t('invitations.rangeHint')}`}
          meta={
            <Stack direction="row" spacing={0.75}>
              <Chip
                size="small"
                color={counts.NEEDS_ACTION ? 'warning' : 'success'}
                variant="outlined"
                label={`${t('invitations.metrics.pending')} ${counts.NEEDS_ACTION}`}
              />
              {conflicts > 0 && (
                <Chip
                  size="small"
                  color="error"
                  variant="outlined"
                  label={`${t('invitations.metrics.conflicts')} ${conflicts}`}
                />
              )}
            </Stack>
          }
        />
        <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1.5 }}>
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <SelectField
              label={t('invitations.filterLabel')}
              value={filter}
              onValueChange={(value) => setFilter(value as CalendarInvitationFilter)}
              options={FILTERS.map((value) => ({
                value,
                label:
                  value === 'ALL'
                    ? t(`invitations.filters.${value}`)
                    : `${t(`invitations.filters.${value}`)} ${counts[value]}`,
              }))}
            />
          </Box>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filter}
            onChange={(_, value: CalendarInvitationFilter | null) => value && setFilter(value)}
            aria-label={t('invitations.filterLabel')}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            {FILTERS.map((value) => (
              <ToggleButton key={value} value={value} sx={{ whiteSpace: 'nowrap', px: 1.5 }}>
                {t(`invitations.filters.${value}`)}
                {value !== 'ALL' && (
                  <Box component="span" sx={{ ml: 0.75, color: 'text.secondary' }}>
                    {counts[value]}
                  </Box>
                )}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Divider />

        {query.isError ? (
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={() => query.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('invitations.loadError')}
          </Alert>
        ) : query.isLoading ? (
          <Stack divider={<Divider flexItem />}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} variant="rectangular" height={112} />
            ))}
          </Stack>
        ) : filtered.length ? (
          filtered.map((event) => (
            <InvitationRow
              key={event.eventId}
              event={event}
              canRespond={canRespond && eventCapability(event, 'canRespond')}
              busy={respond.isPending && respond.variables?.eventId === event.eventId}
              onOpen={() => setSelected(event)}
              onRespond={(response) => respond.mutate({ eventId: event.eventId, response })}
            />
          ))
        ) : (
          <GuidedEmptyState
            kind={invitations ? 'no-results' : 'empty'}
            title={invitations ? t('invitations.noResultsTitle') : t('invitations.emptyTitle')}
            description={
              invitations
                ? t('invitations.noResultsDescription')
                : t('invitations.emptyDescription')
            }
          />
        )}
      </Box>

      <CalendarEventDrawer
        event={selected}
        open={Boolean(selected)}
        canEdit={false}
        canDelete={Boolean(selected && canUpdate && eventCapability(selected, 'canDelete'))}
        canStar={Boolean(selected && canUpdate && eventCapability(selected, 'canStar'))}
        starBusy={preferenceMutation.isPending}
        onClose={() => setSelected(null)}
        onTrash={
          selected && canUpdate && eventCapability(selected, 'canDelete')
            ? () => setTrashing(selected)
            : undefined
        }
        onToggleStar={
          selected && canUpdate && eventCapability(selected, 'canStar')
            ? () => preferenceMutation.mutate(selected)
            : undefined
        }
        onRespond={
          selected && canRespond && eventCapability(selected, 'canRespond')
            ? (response) => selected && respond.mutate({ eventId: selected.eventId, response })
            : undefined
        }
      />
      <ConfirmDialog
        open={Boolean(trashing && canUpdate && eventCapability(trashing, 'canDelete'))}
        title={t('event.trashTitle')}
        description={t('event.trashDescription', { title: trashing?.title })}
        cancelLabel={t('actions.close')}
        confirmLabel={t('event.moveToTrash')}
        confirmingLabel={t('event.trashing')}
        intent="danger"
        busy={trashMutation.isPending}
        onClose={() => setTrashing(null)}
        onConfirm={() => {
          if (canUpdate && trashing && eventCapability(trashing, 'canDelete')) {
            trashMutation.mutate(trashing);
          }
        }}
      />
    </CalendarCanvas>
  );
}
