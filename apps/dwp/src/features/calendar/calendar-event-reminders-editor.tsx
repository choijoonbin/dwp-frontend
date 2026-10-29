import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  getCalendarEventReminders,
  getNotificationCapabilities,
  HttpError,
  updateCalendarEventReminders,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  CALENDAR_REMINDER_LIMIT,
  calendarAddReminderDraft,
  calendarReminderDrafts,
  calendarReminderDraftsEqual,
  calendarReminderInput,
  calendarReminderValidation,
  type CalendarReminderDraft,
} from './calendar-reminders-model';

import type { CalendarEvent, CalendarReminderChannel } from '@dwp-frontend/shared-utils';

const OFFSET_OPTIONS = [0, 5, 10, 15, 30, 60, 120, 1440, 10080, 40320] as const;

export function CalendarEventRemindersEditor({
  event,
}: Readonly<{ event?: Pick<CalendarEvent, 'eventId' | 'version'> | null }>) {
  const { t } = useTranslation('calendar');
  const titleId = useId();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<readonly CalendarReminderDraft[]>([]);
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [conflictedDrafts, setConflictedDrafts] = useState<readonly CalendarReminderDraft[] | null>(
    null
  );
  const [saved, setSaved] = useState(false);
  const reminderQuery = useQuery({
    queryKey: ['calendar', 'event-reminders', event?.eventId],
    queryFn: ({ signal }) => getCalendarEventReminders(event!.eventId, signal),
    enabled: Boolean(event),
    staleTime: 30_000,
    retry: 1,
  });
  const capabilitiesQuery = useQuery({
    queryKey: ['notifications', 'capabilities'],
    queryFn: ({ signal }) => getNotificationCapabilities(signal),
    enabled: Boolean(event),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const emailEnabled =
    capabilitiesQuery.isSuccess && capabilitiesQuery.data.enabledChannels.includes('EMAIL');
  const serverDrafts = useMemo(
    () => calendarReminderDrafts(reminderQuery.data),
    [reminderQuery.data]
  );
  useEffect(() => {
    setDrafts(serverDrafts);
    setRecoveryEnabled(false);
  }, [event?.eventId, reminderQuery.data?.version, serverDrafts]);
  const invalidated = Boolean(
    reminderQuery.data &&
    (reminderQuery.data.state === 'INVALIDATED' ||
      (event?.version !== undefined && reminderQuery.data.eventVersion < event.version))
  );
  const editingBlocked = invalidated && !recoveryEnabled;
  const dirty = !calendarReminderDraftsEqual(drafts, serverDrafts);
  const validation = useMemo(
    () => calendarReminderValidation(drafts, { emailEnabled }),
    [drafts, emailEnabled]
  );
  const updateMutation = useMutation({
    mutationFn: () =>
      updateCalendarEventReminders(
        event!.eventId,
        calendarReminderInput(reminderQuery.data!.version, drafts, { emailEnabled })
      ),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['calendar', 'event-reminders', event?.eventId], saved);
      setDrafts(calendarReminderDrafts(saved));
      setRecoveryEnabled(false);
      setConflictedDrafts(null);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
    },
    onError: async (error) => {
      setSaved(false);
      if (!(error instanceof HttpError) || error.status !== 409) return;
      setConflictedDrafts(drafts);
      setRecoveryEnabled(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] }),
        reminderQuery.refetch(),
      ]);
    },
  });
  const patchDraft = (key: string, patch: Partial<CalendarReminderDraft>) => {
    setSaved(false);
    updateMutation.reset();
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft))
    );
  };
  const beginRecovery = async () => {
    setSaved(false);
    updateMutation.reset();
    const [, latest] = await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] }),
      reminderQuery.refetch(),
    ]);
    if (!latest.data) return;
    setDrafts(calendarReminderDrafts(latest.data));
    setRecoveryEnabled(
      latest.data.state === 'INVALIDATED' ||
        (event?.version !== undefined && latest.data.eventVersion < event.version)
    );
  };

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, py: 1.5 }}>
        <BellRing size={17} aria-hidden="true" />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography id={titleId} component="h3" fontWeight={700}>
            {t('event.reminders.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('event.reminders.description')}
          </Typography>
        </Box>
      </Stack>
      <Divider />
      <Stack spacing={1.5} sx={{ p: 2 }}>
        {!event ? (
          <InlineFeedback severity="info">{t('event.reminders.saveFirst')}</InlineFeedback>
        ) : reminderQuery.isPending ? (
          <Typography role="status" variant="body2" color="text.secondary">
            {t('event.reminders.loading')}
          </Typography>
        ) : reminderQuery.isError ? (
          <InlineFeedback
            severity="error"
            action={
              <ActionButton
                intent="quiet"
                size="small"
                onClick={() => void reminderQuery.refetch()}
              >
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('event.reminders.loadError')}
          </InlineFeedback>
        ) : (
          <>
            {invalidated ? (
              <InlineFeedback
                severity="warning"
                action={
                  recoveryEnabled ? (
                    <ActionButton
                      intent="quiet"
                      size="small"
                      onClick={() => {
                        setDrafts(serverDrafts);
                        setRecoveryEnabled(false);
                      }}
                    >
                      {t('event.reminders.cancelRecovery')}
                    </ActionButton>
                  ) : (
                    <ActionButton
                      intent="quiet"
                      size="small"
                      loading={reminderQuery.isFetching}
                      loadingLabel={t('event.reminders.refreshing')}
                      startIcon={<RefreshCw size={15} aria-hidden="true" />}
                      onClick={() => void beginRecovery()}
                    >
                      {t('event.reminders.reviewAndReapply')}
                    </ActionButton>
                  )
                }
              >
                {t(
                  recoveryEnabled ? 'event.reminders.recoveryReview' : 'event.reminders.invalidated'
                )}
              </InlineFeedback>
            ) : null}
            {updateMutation.isError ? (
              <InlineFeedback
                severity="error"
                action={
                  conflictedDrafts ? (
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      <ActionButton
                        intent="quiet"
                        size="small"
                        onClick={() => {
                          setConflictedDrafts(null);
                          updateMutation.reset();
                        }}
                      >
                        {t('event.reminders.useLatest')}
                      </ActionButton>
                      <ActionButton
                        intent="secondary"
                        size="small"
                        onClick={() => {
                          setDrafts(conflictedDrafts);
                          setConflictedDrafts(null);
                          setRecoveryEnabled(invalidated);
                          updateMutation.reset();
                        }}
                      >
                        {t('event.reminders.keepEdits')}
                      </ActionButton>
                    </Stack>
                  ) : undefined
                }
              >
                {t(
                  conflictedDrafts ? 'event.reminders.versionConflict' : 'event.reminders.saveError'
                )}
              </InlineFeedback>
            ) : null}
            {saved ? (
              <InlineFeedback severity="success">{t('event.reminders.saved')}</InlineFeedback>
            ) : null}
            {!emailEnabled ? (
              <InlineFeedback
                severity={drafts.some((draft) => draft.channel === 'EMAIL') ? 'warning' : 'info'}
              >
                {t(
                  capabilitiesQuery.isPending
                    ? 'event.reminders.emailChecking'
                    : 'event.reminders.emailUnavailable'
                )}
              </InlineFeedback>
            ) : null}
            {!validation.valid ? (
              <InlineFeedback severity="error">
                {t('event.reminders.validationError')}
              </InlineFeedback>
            ) : null}
            {drafts.length ? (
              <Stack component="ol" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
                {drafts.map((draft, index) => (
                  <Box
                    component="li"
                    key={draft.key}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: '1fr 1fr auto' },
                      gap: 1,
                      alignItems: 'start',
                    }}
                  >
                    <SelectField
                      label={t('event.reminders.offsetLabel', { count: index + 1 })}
                      value={draft.offsetMinutes}
                      disabled={editingBlocked || updateMutation.isPending}
                      errorMessage={
                        validation.invalidOffsetKeys.has(draft.key)
                          ? t('event.reminders.offsetRangeError')
                          : validation.duplicateKeys.has(draft.key)
                            ? t('event.reminders.duplicateError')
                            : undefined
                      }
                      options={OFFSET_OPTIONS.map((offset) => ({
                        value: offset,
                        label:
                          offset === 0
                            ? t('event.reminders.atStart')
                            : t('event.reminders.minutesBefore', { count: offset }),
                      }))}
                      onValueChange={(value) =>
                        patchDraft(draft.key, { offsetMinutes: Number(value) })
                      }
                    />
                    <SelectField
                      label={t('event.reminders.channelLabel', { count: index + 1 })}
                      value={draft.channel}
                      disabled={editingBlocked || updateMutation.isPending}
                      errorMessage={
                        validation.unavailableChannelKeys.has(draft.key)
                          ? t('event.reminders.emailUnavailableRow')
                          : undefined
                      }
                      options={(['IN_APP', 'EMAIL'] as const)
                        .map((channel) => ({
                          value: channel,
                          label: t(`event.reminders.channels.${channel}`),
                          disabled: channel === 'EMAIL' && !emailEnabled,
                        }))
                        .filter(
                          (option) =>
                            option.value !== 'EMAIL' || emailEnabled || draft.channel === 'EMAIL'
                        )}
                      onValueChange={(value) =>
                        patchDraft(draft.key, {
                          channel: value as CalendarReminderChannel,
                        })
                      }
                      sx={{ gridColumn: { xs: '1', sm: 'auto' } }}
                    />
                    <ActionIconButton
                      label={t('event.reminders.remove', { count: index + 1 })}
                      disabled={editingBlocked || updateMutation.isPending}
                      onClick={() => {
                        setSaved(false);
                        updateMutation.reset();
                        setDrafts((current) => current.filter((item) => item.key !== draft.key));
                      }}
                      sx={{ mt: { xs: 0, sm: 1.75 } }}
                    >
                      <Trash2 size={16} />
                    </ActionIconButton>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('event.reminders.empty')}
              </Typography>
            )}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              justifyContent="space-between"
            >
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<Plus size={16} aria-hidden="true" />}
                disabled={
                  editingBlocked ||
                  updateMutation.isPending ||
                  drafts.length >= CALENDAR_REMINDER_LIMIT
                }
                onClick={() => {
                  setSaved(false);
                  updateMutation.reset();
                  setDrafts((current) =>
                    calendarAddReminderDraft(current, `new-${crypto.randomUUID()}`, emailEnabled)
                  );
                }}
              >
                {t('event.reminders.add')}
              </ActionButton>
              <ActionButton
                intent="primary"
                size="small"
                loading={updateMutation.isPending}
                disabled={editingBlocked || (!dirty && !recoveryEnabled) || !validation.valid}
                onClick={() => updateMutation.mutate()}
              >
                {t(recoveryEnabled ? 'event.reminders.reapply' : 'event.reminders.save')}
              </ActionButton>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
