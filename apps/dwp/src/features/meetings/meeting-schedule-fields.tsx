import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarClock,
  ClipboardList,
  FileText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  ActionButton,
  AutocompleteMultiField,
  DateTimePickerField,
  FormField,
  SectionHeader,
  SelectField,
} from '@dwp-frontend/design-system';
import type {
  VideoMeetingCapabilities,
  VideoMeetingPerson,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { alpha } from '@mui/material/styles';
import type { MeetingScheduleDraft } from './meeting-schedule-model';
import { MeetingScheduleAgendaCards } from './meeting-schedule-agenda-cards';
import { MeetingScheduleSourcePicker } from './meeting-schedule-source-picker';
import { meetingInsetSurface, meetingShape, meetingSoftShadow } from './meeting-visual-system';

type Props = {
  draft: MeetingScheduleDraft;
  actorId: number;
  step: number;
  busy: boolean;
  update: (next: MeetingScheduleDraft) => void;
  people: VideoMeetingPerson[];
  search: string;
  onSearch: (value: string) => void;
  searching: boolean;
  searchError: boolean;
  capability: VideoMeetingCapabilities | null;
  onRevoke: () => void;
};

function Section({
  title,
  icon,
  visible,
  children,
  number,
}: {
  title: string;
  icon: LucideIcon;
  visible: boolean;
  children: ReactNode;
  number?: string;
}) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={(theme) => ({
        display: { xs: visible ? 'block' : 'none', md: 'block' },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: alpha(theme.palette.primary.main, 0.1),
        borderRadius: meetingShape.stage,
        boxShadow: meetingSoftShadow(theme),
        p: { xs: 2, md: 3 },
        minWidth: 0,
        '& .MuiOutlinedInput-root': {
          borderRadius: meetingShape.control,
          bgcolor: alpha(theme.palette.primary.main, 0.055),
        },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: 'primary.light',
        },
      })}
    >
      <Stack
        direction="row"
        gap={1.25}
        alignItems="center"
        sx={{ pb: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        {number && (
          <Box
            aria-hidden="true"
            sx={{
              bgcolor: 'action.selected',
              color: 'primary.main',
              borderRadius: meetingShape.inset,
              p: 0.75,
              typography: 'caption',
              fontWeight: 'fontWeightBold',
            }}
          >
            {number}
          </Box>
        )}
        {number ? (
          <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
            {title.replace(/^\d+\.\s*/u, '')}
          </Typography>
        ) : (
          <SectionHeader icon={icon} title={title} />
        )}
      </Stack>
      <Stack gap={2.5} sx={{ pt: 2.5 }}>
        {children}
      </Stack>
    </Box>
  );
}

export function MeetingScheduleSections({
  draft,
  actorId,
  step,
  busy,
  update,
  people,
  search,
  onSearch,
  searching,
  searchError,
  capability,
  onRevoke,
}: Props) {
  const { t } = useTranslation('meetings');
  const patch = (value: Partial<MeetingScheduleDraft>) => update({ ...draft, ...value });
  const endsAt =
    draft.startsAt &&
    Number.isFinite(Date.parse(draft.startsAt)) &&
    Number.isFinite(draft.durationMinutes) &&
    Math.abs(draft.durationMinutes) <= 1440
      ? new Date(Date.parse(draft.startsAt) + draft.durationMinutes * 60_000).toISOString()
      : null;
  const repeat = (
    <Stack gap={1}>
      <SelectField<string>
        label={t('scheduleWorkspace.repeat')}
        value={draft.recurrence.frequency}
        options={[
          { value: 'NONE', label: t('scheduleWorkspace.once') },
          { value: 'WEEKLY', label: t('scheduleWorkspace.weekly') },
          { value: 'MONTHLY', label: t('scheduleWorkspace.monthly') },
        ]}
        disabled={busy}
        onValueChange={(frequency) => {
          if (frequency && ['NONE', 'WEEKLY', 'MONTHLY'].includes(frequency))
            patch({
              recurrence: {
                ...draft.recurrence,
                frequency: frequency as MeetingScheduleDraft['recurrence']['frequency'],
              },
            });
        }}
      />
      {draft.recurrence.frequency !== 'NONE' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
            gap: 1.5,
          }}
        >
          <FormField
            required
            type="number"
            label={t('scheduleWorkspace.repeatInterval')}
            value={draft.recurrence.interval}
            inputProps={{ min: 1, max: 12 }}
            disabled={busy}
            onChange={(event) =>
              patch({
                recurrence: { ...draft.recurrence, interval: Number(event.target.value) },
              })
            }
          />
          <FormField
            required
            type="number"
            label={t('scheduleWorkspace.occurrenceCount')}
            value={draft.recurrence.occurrenceCount}
            inputProps={{ min: 2, max: 52 }}
            disabled={busy}
            onChange={(event) =>
              patch({
                recurrence: {
                  ...draft.recurrence,
                  occurrenceCount: Number(event.target.value),
                },
              })
            }
          />
        </Box>
      )}
      <Typography variant="caption" color="text.secondary">
        {t(
          draft.recurrence.frequency === 'NONE'
            ? 'scheduleWorkspace.repeatOnceHint'
            : 'scheduleWorkspace.repeatPreviewHint'
        )}
      </Typography>
    </Stack>
  );
  return (
    <Stack gap={3}>
      <Section
        number="01"
        title={t('scheduleWorkspace.sections.basics')}
        icon={FileText}
        visible={step === 0}
      >
        <FormField
          required
          label={t('schedule.meetingTitle')}
          value={draft.title}
          supportingText={t('scheduleWorkspace.design.titleCount', {
            count: draft.title.length,
            maximum: 240,
          })}
          inputProps={{ maxLength: 240 }}
          disabled={busy}
          onChange={(event) => patch({ title: event.target.value })}
        />
        <MeetingScheduleSourcePicker
          kind="template"
          draft={draft}
          busy={busy}
          update={update}
          onRevoke={onRevoke}
        />
        <Typography variant="caption" color="text.secondary">
          {t(
            draft.sourceTemplateId
              ? 'scheduleWorkspace.templateRecheck'
              : 'scheduleWorkspace.templateHint'
          )}
        </Typography>
        <FormField
          multiline
          minRows={3}
          label={t('scheduleWorkspace.purpose')}
          value={draft.agenda}
          inputProps={{ maxLength: 8000 }}
          disabled={busy}
          onChange={(event) => patch({ agenda: event.target.value })}
        />
      </Section>
      <Section
        number="02"
        title={t('scheduleWorkspace.sections.time')}
        icon={CalendarClock}
        visible={step === 1}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
            gap: 2,
          }}
        >
          <DateTimePickerField
            required
            label={t('schedule.startsAt')}
            value={draft.startsAt}
            disabled={busy}
            onValueChange={(value) => patch({ startsAt: value })}
          />
          <DateTimePickerField
            required
            label={t('scheduleWorkspace.endsAt')}
            value={endsAt}
            disabled={busy}
            onValueChange={(value) => {
              if (value && draft.startsAt)
                patch({
                  durationMinutes: (Date.parse(value) - Date.parse(draft.startsAt)) / 60_000,
                });
            }}
          />
        </Box>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {[25, 45, 60].map((minutes) => (
            <ActionButton
              key={minutes}
              size="small"
              intent={draft.durationMinutes === minutes ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={() => patch({ durationMinutes: minutes })}
            >
              {t('units.minutes', { count: minutes })}
            </ActionButton>
          ))}
        </Stack>
        <FormField
          label={t('schedule.timeZone')}
          value={draft.timeZone}
          slotProps={{ input: { readOnly: true } }}
          supportingText={t('scheduleWorkspace.timeZoneHint')}
        />
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>{repeat}</Box>
      </Section>
      <Section
        number="03"
        title={t('scheduleWorkspace.sections.people')}
        icon={Users}
        visible={step === 1}
      >
        <AutocompleteMultiField<VideoMeetingPerson>
          label={t('schedule.participants')}
          value={draft.participants}
          options={people}
          inputValue={search}
          loading={searching}
          disabled={busy}
          filterOptions={(options) => options}
          filterSelectedOptions
          getOptionLabel={(person) =>
            `${person.displayName} · ${person.emailAddress}${person.organizationName ? ' · ' + person.organizationName : ''}`
          }
          isOptionEqualToValue={(left, right) => left.userId === right.userId}
          supportingText={t('scheduleWorkspace.peopleHint')}
          errorMessage={searchError ? t('schedule.participantSearchError') : undefined}
          loadingText={t('schedule.participantSearching')}
          noOptionsText={
            search.trim().length < 2
              ? t('schedule.participantSearchPrompt')
              : t('schedule.participantNoResults')
          }
          onInputChange={(_, value, reason) => {
            if (reason === 'input' || reason === 'clear') onSearch(value);
          }}
          onChange={(_, participants) => {
            const selected = participants.filter((person) => person.userId !== actorId);
            const allowed = new Set([actorId, ...selected.map((person) => person.userId)]);
            patch({
              participants: selected,
              agendaItems: draft.agendaItems.map((item) => ({
                ...item,
                ownerUserId:
                  item.ownerUserId !== null && !allowed.has(item.ownerUserId)
                    ? null
                    : item.ownerUserId,
              })),
            });
            onSearch('');
          }}
        />
        <Box sx={(theme) => ({ ...meetingInsetSurface(theme), p: 1.5 })}>
          <Typography variant="body2" color="text.secondary">
            {t('scheduleWorkspace.availabilityUnavailable')}
          </Typography>
        </Box>
      </Section>
      <Section
        number="04"
        title={t('scheduleWorkspace.sections.agenda')}
        icon={ClipboardList}
        visible={step === 0}
      >
        <MeetingScheduleAgendaCards draft={draft} actorId={actorId} busy={busy} update={update} />
      </Section>
      <Box sx={{ display: { xs: step === 2 ? 'block' : 'none', md: 'none' } }}>
        <Section title={t('scheduleWorkspace.steps.repeat')} icon={CalendarClock} visible>
          {repeat}
        </Section>
      </Box>
      <Section
        number="05"
        title={t('scheduleWorkspace.sections.security')}
        icon={ShieldCheck}
        visible={step === 3}
      >
        <SelectField<'INVITED' | 'INTERNAL'>
          label={t('schedule.access')}
          value={draft.accessScope}
          disabled={busy}
          options={(['INVITED', 'INTERNAL'] as const).map((value) => ({
            value,
            label: t('access.' + value),
          }))}
          onValueChange={(value) => {
            if (value) patch({ accessScope: value });
          }}
        />
        <FormControlLabel
          label={t('schedule.waitingRoom')}
          control={
            <Switch
              checked={draft.waitingRoomEnabled}
              disabled={busy}
              onChange={(_, checked) => patch({ waitingRoomEnabled: checked })}
            />
          }
        />
        <FormControlLabel
          label={t('scheduleWorkspace.joinBeforeHost')}
          control={<Switch checked={false} disabled onChange={() => undefined} />}
        />
        <Typography variant="caption" color="text.secondary" role="status">
          {t('scheduleWorkspace.joinBeforeHostUnavailable')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('scheduleWorkspace.policyRecheck')}
        </Typography>
        <Box
          sx={{
            bgcolor: 'action.hover',
            p: 1.5,
            borderRadius: meetingShape.control,
          }}
        >
          <Typography variant="subtitle2">{t('scheduleWorkspace.recording')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              capability?.recordingConfigured
                ? 'scheduleWorkspace.recordingConfigured'
                : 'scheduleWorkspace.recordingUnavailable'
            )}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t('scheduleWorkspace.mediaOff')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('scheduleWorkspace.codeAfterCreate')}
        </Typography>
      </Section>
    </Stack>
  );
}
