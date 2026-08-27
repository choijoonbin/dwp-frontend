import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  AutocompleteMultiField,
  DateTimePickerField,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import {
  searchVideoMeetingPeople,
  type ScheduleVideoMeetingInput,
  type VideoMeetingAccessScope,
  type VideoMeetingPerson,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

type MeetingScheduleForm = Omit<ScheduleVideoMeetingInput, 'startsAt' | 'idempotencyKey'> & {
  startsAt: string | null;
};

function defaultStartIso(date = new Date()): string {
  const next = new Date(date);
  next.setSeconds(0, 0);
  next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15 + 30);
  return next.toISOString();
}

function emptyForm(timeZone: string): MeetingScheduleForm {
  return {
    title: '',
    agenda: '',
    startsAt: defaultStartIso(),
    durationMinutes: 50,
    timeZone,
    participantUserIds: [],
    accessScope: 'INVITED',
    waitingRoomEnabled: true,
    allowJoinBeforeHost: false,
    defaultMicrophoneEnabled: false,
    defaultCameraEnabled: false,
  };
}

export function MeetingScheduleDialog({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: ScheduleVideoMeetingInput) => void;
}) {
  const { t } = useTranslation('meetings');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [form, setForm] = useState(() => emptyForm(timeZone));
  const [participantInput, setParticipantInput] = useState('');
  const [participants, setParticipants] = useState<VideoMeetingPerson[]>([]);
  const deferredParticipantInput = useDeferredValue(participantInput.trim());
  const peopleQuery = useQuery({
    queryKey: ['meetings', 'people', deferredParticipantInput],
    queryFn: () => searchVideoMeetingPeople(deferredParticipantInput),
    enabled: open && deferredParticipantInput.length >= 2,
    staleTime: 30_000,
    retry: 1,
  });
  const startTime = useMemo(
    () => (form.startsAt ? new Date(form.startsAt) : null),
    [form.startsAt]
  );
  const startInvalid = !startTime || Number.isNaN(startTime.getTime()) || startTime <= new Date();
  const invalid = !form.title.trim() || startInvalid;

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(timeZone));
    setParticipantInput('');
    setParticipants([]);
  }, [open, timeZone]);

  return (
    <FormDialog
      open={open}
      title={t('schedule.title')}
      description={t('schedule.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('schedule.submit')}
      submittingLabel={t('schedule.submitting')}
      busy={busy}
      submitDisabled={invalid}
      maxWidth="md"
      onClose={onClose}
      onSubmit={() =>
        onSubmit({
          ...form,
          title: form.title.trim(),
          agenda: form.agenda?.trim() || null,
          startsAt: startTime?.toISOString() ?? '',
          idempotencyKey: crypto.randomUUID(),
        })
      }
    >
      <Stack gap={2.5}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
          <FormField
            required
            autoFocus
            label={t('schedule.meetingTitle')}
            value={form.title}
            errorMessage={!form.title.trim() ? t('schedule.titleRequired') : undefined}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value.slice(0, 160) }))
            }
          />
          <SelectField<number>
            label={t('schedule.duration')}
            value={form.durationMinutes}
            options={[25, 30, 45, 50, 60, 90, 120].map((value) => ({
              value,
              label: t('units.minutes', { count: value }),
            }))}
            onValueChange={(value) =>
              value && setForm((current) => ({ ...current, durationMinutes: value }))
            }
          />
          <DateTimePickerField
            required
            label={t('schedule.startsAt')}
            value={form.startsAt}
            errorMessage={startInvalid ? t('schedule.startRequired') : undefined}
            onValueChange={(value) => setForm((current) => ({ ...current, startsAt: value }))}
          />
          <FormField label={t('schedule.timeZone')} value={form.timeZone} disabled />
        </Box>

        <FormField
          multiline
          minRows={3}
          label={t('schedule.agenda')}
          value={form.agenda ?? ''}
          supportingText={t('schedule.agendaHint')}
          onChange={(event) =>
            setForm((current) => ({ ...current, agenda: event.target.value.slice(0, 2000) }))
          }
        />

        <AutocompleteMultiField<VideoMeetingPerson>
          label={t('schedule.participants')}
          options={peopleQuery.data ?? []}
          value={participants}
          inputValue={participantInput}
          loading={peopleQuery.isLoading}
          filterOptions={(options) => options}
          filterSelectedOptions
          getOptionLabel={(person) =>
            `${person.displayName} · ${person.emailAddress}${
              person.organizationName ? ` · ${person.organizationName}` : ''
            }`
          }
          isOptionEqualToValue={(option, value) => option.userId === value.userId}
          supportingText={t('schedule.participantHint')}
          errorMessage={peopleQuery.isError ? t('schedule.participantSearchError') : undefined}
          loadingText={t('schedule.participantSearching')}
          noOptionsText={
            deferredParticipantInput.length < 2
              ? t('schedule.participantSearchPrompt')
              : t('schedule.participantNoResults')
          }
          onInputChange={(_, value, reason) => {
            if (reason === 'input' || reason === 'clear') setParticipantInput(value);
          }}
          onChange={(_, nextParticipants) => {
            setParticipants(nextParticipants);
            setParticipantInput('');
            setForm((current) => ({
              ...current,
              participantUserIds: nextParticipants.map((person) => person.userId),
            }));
          }}
        />

        <SelectField<VideoMeetingAccessScope>
          label={t('schedule.access')}
          value={form.accessScope}
          options={(['INTERNAL', 'INVITED'] as const).map((value) => ({
            value,
            label: t(`access.${value}`),
          }))}
          onValueChange={(value) =>
            value && setForm((current) => ({ ...current, accessScope: value }))
          }
        />

        <Box component="section" aria-label={t('schedule.waitingRoom')}>
          {[
            {
              key: 'waitingRoomEnabled' as const,
              label: t('schedule.waitingRoom'),
              hint: t('schedule.waitingRoomHint'),
            },
            {
              key: 'defaultMicrophoneEnabled' as const,
              label: t('schedule.microphone'),
              hint: t('schedule.microphoneHint'),
            },
            {
              key: 'defaultCameraEnabled' as const,
              label: t('schedule.camera'),
              hint: t('schedule.cameraHint'),
            },
          ].map((item) => (
            <Stack
              key={item.key}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={2}
              sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
            >
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  {item.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.hint}
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={form[item.key]}
                    slotProps={{ input: { 'aria-label': item.label } }}
                    onChange={(_, checked) =>
                      setForm((current) => ({ ...current, [item.key]: checked }))
                    }
                  />
                }
                label=""
                sx={{ m: 0 }}
              />
            </Stack>
          ))}
        </Box>
      </Stack>
    </FormDialog>
  );
}
