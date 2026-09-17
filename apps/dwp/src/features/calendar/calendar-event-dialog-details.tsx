import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronDown, SlidersHorizontal } from 'lucide-react';
import {
  AutocompleteMultiField,
  DatePickerField,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { CalendarResource } from '@dwp-frontend/shared-utils';
import {
  CALENDAR_EDITOR_COMMON_TIME_ZONES,
  calendarSystemTimeZone,
  type CalendarEditorAttendee,
  type CalendarEventDraft,
} from './calendar-event-editor-model';

type CalendarEventDialogDetailsProps = {
  expanded: boolean;
  form: CalendarEventDraft;
  attendees: readonly CalendarEditorAttendee[];
  attendeeOptions: readonly CalendarEditorAttendee[];
  resources: readonly CalendarResource[];
  peopleLoading: boolean;
  workProtected: boolean;
  workReceiptLocked: boolean;
  occurrenceOnly: boolean;
  validationVisible: boolean;
  resourceRecurrenceError: boolean;
  eventResourceId?: string | null;
  onExpandedChange: (expanded: boolean) => void;
  onFormPatch: (patch: Partial<CalendarEventDraft>) => void;
  onResourceChange: (resourceId: string, resourceName?: string) => void;
  onReplaceAttendees: (
    type: CalendarEditorAttendee['type'],
    values: readonly CalendarEditorAttendee[]
  ) => void;
};

export const CalendarEventDialogDetails = memo(function CalendarEventDialogDetails({
  expanded,
  form,
  attendees,
  attendeeOptions,
  resources,
  peopleLoading,
  workProtected,
  workReceiptLocked,
  occurrenceOnly,
  validationVisible,
  resourceRecurrenceError,
  eventResourceId,
  onExpandedChange,
  onFormPatch,
  onResourceChange,
  onReplaceAttendees,
}: CalendarEventDialogDetailsProps) {
  const { t } = useTranslation('calendar');
  const timeZoneOptions = useMemo(
    () =>
      Array.from(
        new Set([form.timeZone, calendarSystemTimeZone(), ...CALENDAR_EDITOR_COMMON_TIME_ZONES])
      ).map((timeZone) => ({ value: timeZone, label: timeZone })),
    [form.timeZone]
  );
  const resourceOptions = useMemo(
    () => [
      { value: '', label: t('event.noResource') },
      ...resources.map((resource) => ({
        value: resource.resourceId,
        label: `${resource.name} · ${resource.capacity}${t('resources.peopleUnit')}`,
        disabled:
          resource.state !== 'AVAILABLE' ||
          (!resource.available && resource.resourceId !== eventResourceId),
      })),
    ],
    [eventResourceId, resources, t]
  );

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, nextExpanded) => onExpandedChange(nextExpanded)}
      disableGutters
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: '8px !important',
        overflow: 'hidden',
        '&::before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ChevronDown size={18} />}
        sx={{
          minHeight: 64,
          px: 2,
          '& .MuiAccordionSummary-content': { my: 1.25 },
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            aria-hidden="true"
            sx={{
              width: 30,
              height: 30,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 0.75,
              bgcolor: 'action.hover',
              color: 'primary.main',
            }}
          >
            <SlidersHorizontal size={16} />
          </Box>
          <Box>
            <Typography fontWeight={600}>{t('event.additionalOptions')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('event.additionalOptionsDescription')}
            </Typography>
          </Box>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pt: 0.75, pb: 2 }}>
        <Stack spacing={2.25}>
          <FormField
            multiline
            minRows={3}
            disabled={workProtected}
            label={t(form.type === 'MEETING' ? 'event.agendaLabel' : 'event.descriptionLabel')}
            value={form.description}
            onChange={(event) => onFormPatch({ description: event.target.value })}
            supportingText={
              workProtected
                ? t('event.workMetadataLockedHint')
                : form.type === 'MEETING'
                  ? t('event.agendaHint')
                  : undefined
            }
            inputProps={{ maxLength: 4000 }}
          />
          {form.type === 'MEETING' &&
            (['REQUIRED', 'OPTIONAL'] as const).map((attendeeType) => {
              const selectedForType = attendees.filter((person) => person.type === attendeeType);
              return (
                <AutocompleteMultiField
                  key={attendeeType}
                  multiple
                  disabled={occurrenceOnly}
                  options={attendeeOptions.map((person) => ({ ...person, type: attendeeType }))}
                  value={selectedForType}
                  onChange={(_, value) => onReplaceAttendees(attendeeType, value)}
                  loading={peopleLoading}
                  getOptionLabel={(person) => `${person.displayName} · ${person.workEmail ?? ''}`}
                  isOptionEqualToValue={(option, value) => option.personId === value.personId}
                  renderTags={(values, getTagProps) =>
                    values.map((person, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={person.personId}
                        size="small"
                        label={person.displayName}
                      />
                    ))
                  }
                  label={t(
                    attendeeType === 'REQUIRED'
                      ? 'event.requiredAttendeesLabel'
                      : 'event.optionalAttendeesLabel'
                  )}
                  textFieldProps={{
                    placeholder: selectedForType.length
                      ? undefined
                      : t(
                          attendeeType === 'REQUIRED'
                            ? 'event.requiredAttendeesPlaceholder'
                            : 'event.optionalAttendeesPlaceholder'
                        ),
                  }}
                />
              );
            })}
          {form.type === 'MEETING' ? (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 2,
                }}
              >
                <FormField
                  label={t('event.locationLabel')}
                  value={form.location}
                  onChange={(event) => onFormPatch({ location: event.target.value })}
                  inputProps={{ maxLength: 240 }}
                />
                <SelectField
                  disabled={occurrenceOnly}
                  label={t('event.resourceLabel')}
                  value={form.resourceId}
                  options={resourceOptions}
                  onValueChange={(value) => {
                    const resource = resources.find((item) => item.resourceId === value);
                    onResourceChange(String(value), resource?.name);
                  }}
                  InputProps={{ startAdornment: <Building2 size={17} /> }}
                />
              </Box>
              <FormField
                label={t('event.conferenceLabel')}
                value={form.conferenceUrl}
                onChange={(event) => onFormPatch({ conferenceUrl: event.target.value })}
                placeholder={t('event.conferencePlaceholder')}
                inputProps={{ maxLength: 1000 }}
              />
            </>
          ) : null}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            <SelectField
              disabled={workProtected || occurrenceOnly}
              label={t('event.recurrenceLabel')}
              value={form.recurrence}
              options={(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const).map((value) => ({
                value,
                label: t(`event.recurrence.${value}`),
              }))}
              onValueChange={(value) => value && onFormPatch({ recurrence: value })}
            />
            <SelectField
              disabled={workProtected}
              label={t('event.visibilityLabel')}
              value={form.visibility}
              options={(['DEFAULT', 'PUBLIC', 'PRIVATE', 'CONFIDENTIAL'] as const).map((value) => ({
                value,
                label: t(`event.visibility.${value}`),
              }))}
              onValueChange={(value) => value && onFormPatch({ visibility: value })}
            />
            <SelectField
              disabled={workReceiptLocked}
              label={t('event.importanceLabel')}
              value={form.importance}
              options={(['LOW', 'NORMAL', 'HIGH'] as const).map((value) => ({
                value,
                label: t(`event.importance.${value}`),
              }))}
              onValueChange={(value) => value && onFormPatch({ importance: value })}
            />
          </Box>
          <SelectField
            disabled={workReceiptLocked || occurrenceOnly}
            label={t('event.timeZoneLabel')}
            value={form.timeZone}
            options={timeZoneOptions}
            onValueChange={(timeZone) => timeZone && onFormPatch({ timeZone: String(timeZone) })}
            supportingText={t('event.timeZoneHint')}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.allDay}
                disabled={workProtected}
                onChange={(event) => onFormPatch({ allDay: event.target.checked })}
              />
            }
            label={t('event.allDay')}
          />
          {form.recurrence !== 'NONE' && (
            <SelectField<number>
              disabled={occurrenceOnly}
              label={t('event.recurrenceIntervalLabel')}
              value={form.recurrenceInterval}
              options={[1, 2, 3, 4].map((value) => ({
                value,
                label: t(`event.recurrenceIntervals.${form.recurrence}`, { count: value }),
              }))}
              onValueChange={(value) => value && onFormPatch({ recurrenceInterval: Number(value) })}
            />
          )}
          {form.recurrence !== 'NONE' && (
            <DatePickerField
              disabled={occurrenceOnly}
              label={t('event.recurrenceUntilLabel')}
              value={form.recurrenceUntil}
              onValueChange={(value) => onFormPatch({ recurrenceUntil: value ?? '' })}
              errorMessage={
                validationVisible && resourceRecurrenceError
                  ? t('event.resourceRecurrenceUntilRequired')
                  : undefined
              }
            />
          )}
          {form.type === 'MEETING' ? (
            <FormControlLabel
              control={
              <Checkbox
                checked={form.responseRequired}
                disabled={occurrenceOnly}
                  onChange={(event) => onFormPatch({ responseRequired: event.target.checked })}
                />
              }
              label={t('event.responseRequired')}
            />
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
});
