import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArchiveRestore, Clock3, LockKeyhole, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCalendarTrash,
  restoreCalendarEvent,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CalendarPageHeading, calendarDate, calendarTime } from './calendar-components';
import { CalendarCanvas, CalendarSectionHeader } from './calendar-experience';

import type { CalendarTrashedEvent } from '@dwp-frontend/shared-utils';

function retentionDays(value?: string | null) {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

export function CalendarTrash() {
  const { t, i18n } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [restoring, setRestoring] = useState<CalendarTrashedEvent | null>(null);
  const canUpdate = hasPermission('APP.CALENDAR', 'UPDATE');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const query = useQuery({
    queryKey: ['calendar', 'trash'],
    queryFn: getCalendarTrash,
    staleTime: 15_000,
    retry: 1,
  });
  const items = useMemo(
    () =>
      [...(query.data ?? [])].sort(
        (left, right) => new Date(right.deletedAt).getTime() - new Date(left.deletedAt).getTime()
      ),
    [query.data]
  );
  const groups = [
    {
      key: 'soon',
      title: t('trash.soonExpiring'),
      description: t('trash.soonExpiringDescription'),
      icon: Clock3,
      items: items.filter((event) => {
        const days = retentionDays(event.purgeAfter);
        return !event.legalHold && days !== null && days <= 7;
      }),
    },
    {
      key: 'later',
      title: t('trash.laterExpiring'),
      description: t('trash.laterExpiringDescription'),
      icon: ArchiveRestore,
      items: items.filter((event) => {
        const days = retentionDays(event.purgeAfter);
        return !event.legalHold && (days === null || days > 7);
      }),
    },
    {
      key: 'policy',
      title: t('trash.policyHeld'),
      description: t('trash.policyHeldDescription'),
      icon: LockKeyhole,
      items: items.filter((event) => event.legalHold),
    },
  ].filter((group) => group.items.length > 0);
  const restoreMutation = useMutation({
    mutationFn: (event: CalendarTrashedEvent) => restoreCalendarEvent(event.eventId, event.version),
    onSuccess: async () => {
      setRestoring(null);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('trash.restored'));
    },
    onError: () => toast.error(t('trash.restoreError')),
  });

  return (
    <CalendarCanvas archetype="queue">
      <CalendarPageHeading
        icon={Trash2}
        eyebrow={t('trash.eyebrow')}
        title={t('trash.title')}
        description={t('trash.description')}
      />
      {query.isError ? (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => query.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('trash.loadError')}
        </Alert>
      ) : query.isLoading ? (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((value) => (
            <Skeleton key={value} variant="rounded" height={144} />
          ))}
        </Stack>
      ) : items.length ? (
        <Stack spacing={2.25} component="section" aria-label={t('trash.listLabel')}>
          {groups.map((group) => (
            <Box
              key={group.key}
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
                icon={group.icon}
                title={group.title}
                description={group.description}
                meta={t('trash.groupCount', { count: group.items.length })}
              />
              <Divider />
              <Stack divider={<Divider flexItem />}>
                {group.items.map((event) => {
                  const days = retentionDays(event.purgeAfter);
                  const restorable = canUpdate && event.capabilities.canRestore;
                  return (
                    <Box
                      key={event.eventId}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                        gap: 2,
                        alignItems: { xs: 'stretch', md: 'center' },
                        px: { xs: 2, sm: 2.5 },
                        py: 1.75,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Box
                            aria-hidden="true"
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: event.calendarColor,
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            {event.calendarName}
                          </Typography>
                          {event.importance === 'HIGH' && (
                            <Chip size="small" color="error" label={t('event.importance.HIGH')} />
                          )}
                        </Stack>
                        <Typography component="h3" fontWeight={600} sx={{ mt: 0.65 }}>
                          {event.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
                          {calendarDate(event.startsAt, language)} ·{' '}
                          {calendarTime(event.startsAt, language)} –{' '}
                          {calendarTime(event.endsAt, language)}
                        </Typography>
                        {event.deletionReason && (
                          <Typography variant="body2" sx={{ mt: 0.75 }}>
                            {event.deletionReason}
                          </Typography>
                        )}
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={{ xs: 0.3, sm: 1.5 }}
                          sx={{ mt: 0.9 }}
                          color="text.secondary"
                        >
                          <Typography variant="caption">
                            {t('trash.deletedAt', {
                              date: `${calendarDate(event.deletedAt, language)} ${calendarTime(event.deletedAt, language)}`,
                            })}
                          </Typography>
                          <Typography variant="caption">
                            {event.legalHold
                              ? t('trash.retainedByPolicy')
                              : days === null
                                ? t('trash.retentionUnavailable')
                                : t('trash.daysRemaining', { count: days })}
                          </Typography>
                        </Stack>
                      </Box>
                      <ActionButton
                        intent="secondary"
                        startIcon={<ArchiveRestore size={17} />}
                        disabled={!restorable}
                        onClick={() => setRestoring(event)}
                        sx={{ width: { xs: 1, md: 'auto' } }}
                      >
                        {restorable ? t('trash.restore') : t('trash.restoreUnavailable')}
                      </ActionButton>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : (
        <Box
          sx={{
            minHeight: 320,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            px: 3,
          }}
        >
          <Box>
            <Box
              sx={{
                width: 52,
                height: 52,
                mx: 'auto',
                display: 'grid',
                placeItems: 'center',
                color: 'text.secondary',
                bgcolor: 'action.hover',
                borderRadius: '50%',
              }}
            >
              <Trash2 size={23} />
            </Box>
            <Typography variant="h6" fontWeight={600} sx={{ mt: 1.5 }}>
              {t('trash.emptyTitle')}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {t('trash.emptyDescription')}
            </Typography>
          </Box>
        </Box>
      )}
      <ConfirmDialog
        open={Boolean(restoring)}
        title={t('trash.restoreTitle')}
        description={t('trash.restoreDescription', { title: restoring?.title })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('trash.restore')}
        confirmingLabel={t('trash.restoring')}
        busy={restoreMutation.isPending}
        onClose={() => setRestoring(null)}
        onConfirm={() => {
          if (restoring) restoreMutation.mutate(restoring);
        }}
      />
    </CalendarCanvas>
  );
}
