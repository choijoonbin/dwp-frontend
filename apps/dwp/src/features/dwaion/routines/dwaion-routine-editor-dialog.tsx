import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DateRangePickerField,
  FormDialog,
  FormField,
  SelectField,
  TimePickerField,
} from '@dwp-frontend/design-system';

import { DWAION_ROUTINE_COPY_KO } from './dwaion-routine-copy';
import { routineDraftErrors } from './dwaion-routine-model';

import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type { DwaionRoutineConsent, DwaionRoutineDraft } from './dwaion-routine-model';

export type DwaionRoutineSourceOption = {
  key: string;
  label: string;
  description?: string;
  available?: boolean;
};

export function DwaionRoutineEditorDialog({
  open,
  draft,
  sourceOptions,
  timeZoneOptions,
  busy = false,
  onDraftChange,
  onClose,
  onSubmit,
  copy = DWAION_ROUTINE_COPY_KO,
}: {
  open: boolean;
  draft: DwaionRoutineDraft;
  sourceOptions: readonly DwaionRoutineSourceOption[];
  timeZoneOptions: readonly string[];
  busy?: boolean;
  onDraftChange: (draft: DwaionRoutineDraft) => void;
  onClose: () => void;
  onSubmit: (draft: DwaionRoutineDraft) => void | Promise<void>;
  copy?: DwaionRoutineCopy;
}) {
  const errors = useMemo(() => routineDraftErrors(draft), [draft]);
  const update = (patch: Partial<DwaionRoutineDraft>) => onDraftChange({ ...draft, ...patch });
  const updateSchedule = (patch: Partial<DwaionRoutineDraft['schedule']>) =>
    update({ schedule: { ...draft.schedule, ...patch } });

  return (
    <FormDialog
      open={open}
      title={copy.editorTitle}
      description={copy.editorDescription}
      cancelLabel={copy.cancel}
      submitLabel={copy.save}
      submittingLabel={copy.saving}
      busy={busy}
      submitDisabled={errors.length > 0}
      mobileFullScreen
      maxWidth="md"
      onClose={onClose}
      onSubmit={() => onSubmit(draft)}
    >
      <Stack gap={2.5}>
        <FormField
          label={copy.name}
          value={draft.title}
          required
          supportingText={copy.nameHelp}
          errorMessage={errors.includes('TITLE_REQUIRED') ? copy.nameHelp : undefined}
          onChange={(event) => update({ title: event.target.value })}
        />
        <FormField
          label={copy.details}
          value={draft.description}
          required
          multiline
          minRows={3}
          supportingText={copy.detailsHelp}
          errorMessage={errors.includes('DESCRIPTION_REQUIRED') ? copy.detailsHelp : undefined}
          onChange={(event) => update({ description: event.target.value })}
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' },
            gap: 2,
          }}
        >
          <SelectField
            label={copy.cadenceLabel}
            value={draft.schedule.cadence}
            options={(['DAILY', 'WEEKDAYS', 'WEEKLY'] as const).map((value) => ({
              value,
              label: copy.cadence[value],
            }))}
            onValueChange={(value) => {
              if (value) {
                updateSchedule({
                  cadence: value,
                  weekDays: value === 'WEEKLY' ? draft.schedule.weekDays : [],
                });
              }
            }}
          />
          <TimePickerField
            label={copy.localTime}
            value={draft.schedule.localTime || null}
            required
            onValueChange={(value) => updateSchedule({ localTime: value ?? '' })}
          />
          <SelectField
            label={copy.timeZone}
            value={draft.schedule.timeZone}
            options={timeZoneOptions.map((value) => ({ value, label: value }))}
            errorMessage={errors.includes('TIME_ZONE_REQUIRED') ? copy.timeZone : undefined}
            onValueChange={(value) => updateSchedule({ timeZone: value || '' })}
          />
        </Box>
        <DateRangePickerField
          value={{ start: draft.schedule.activeFrom, end: draft.schedule.activeUntil }}
          startLabel={copy.activeFrom}
          endLabel={copy.activeUntil}
          orderErrorMessage={copy.dateOrderError}
          onValueChange={(value) =>
            updateSchedule({ activeFrom: value.start, activeUntil: value.end })
          }
        />

        {draft.schedule.cadence === 'WEEKLY' ? (
          <Box component="fieldset" sx={{ m: 0, p: 0, border: 0 }}>
            <Typography component="legend" variant="subtitle2">
              {copy.weekDays}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
              {copy.weekdayLabels.map((label, index) => {
                const day = index + 1;
                return (
                  <FormControlLabel
                    key={label}
                    sx={{ m: 0, minHeight: 44 }}
                    control={
                      <Checkbox
                        checked={draft.schedule.weekDays.includes(day)}
                        onChange={(_, checked) =>
                          updateSchedule({
                            weekDays: checked
                              ? [...draft.schedule.weekDays, day].sort()
                              : draft.schedule.weekDays.filter((value) => value !== day),
                          })
                        }
                      />
                    }
                    label={label}
                  />
                );
              })}
            </Stack>
            {errors.includes('WEEK_DAY_REQUIRED') ? (
              <Typography role="alert" variant="caption" color="error.main">
                {copy.weekDayRequired}
              </Typography>
            ) : null}
          </Box>
        ) : null}

        <Box>
          <Typography variant="subtitle2">{copy.quietHours}</Typography>
          <Typography variant="caption" color="text.secondary">
            {copy.quietHoursHelp}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' },
              gap: 2,
              mt: 1,
            }}
          >
            <TimePickerField
              label={copy.quietStart}
              value={draft.schedule.quietHoursStart}
              errorMessage={
                errors.includes('QUIET_HOURS_INCOMPLETE') ? copy.quietHoursHelp : undefined
              }
              onValueChange={(value) => updateSchedule({ quietHoursStart: value })}
            />
            <TimePickerField
              label={copy.quietEnd}
              value={draft.schedule.quietHoursEnd}
              errorMessage={
                errors.includes('QUIET_HOURS_INCOMPLETE') ? copy.quietHoursHelp : undefined
              }
              onValueChange={(value) => updateSchedule({ quietHoursEnd: value })}
            />
          </Box>
        </Box>

        <Box component="fieldset" sx={{ m: 0, p: 0, border: 0 }}>
          <Typography component="legend" variant="subtitle2">
            {copy.sourceSelection}
          </Typography>
          <Stack sx={{ mt: 0.75 }}>
            {sourceOptions.map((source) => (
              <FormControlLabel
                key={source.key}
                sx={{ minHeight: 44, alignItems: 'flex-start', m: 0 }}
                control={
                  <Checkbox
                    checked={draft.sourceKeys.includes(source.key)}
                    disabled={source.available === false}
                    onChange={(_, checked) =>
                      update({
                        sourceKeys: checked
                          ? [...draft.sourceKeys, source.key]
                          : draft.sourceKeys.filter((key) => key !== source.key),
                      })
                    }
                  />
                }
                label={
                  <Box sx={{ py: 0.75 }}>
                    <Typography variant="body2">{source.label}</Typography>
                    {source.description ? (
                      <Typography variant="caption" color="text.secondary">
                        {source.description}
                      </Typography>
                    ) : null}
                    {source.available === false ? (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                        {copy.unavailableSource}
                      </Typography>
                    ) : null}
                  </Box>
                }
              />
            ))}
          </Stack>
        </Box>

        <Box component="fieldset" sx={{ m: 0, p: 0, border: 0 }}>
          <Typography component="legend" variant="subtitle2">
            {copy.consent}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {copy.consentHelp}
          </Typography>
          <Stack sx={{ mt: 0.75 }}>
            {(
              [
                'SOURCE_ACCESS',
                'ANALYSIS',
                'PROPOSAL_DELIVERY',
              ] as const satisfies readonly DwaionRoutineConsent['key'][]
            ).map((key) => (
              <FormControlLabel
                key={key}
                sx={{ minHeight: 44, m: 0 }}
                control={
                  <Checkbox
                    checked={draft.consentKeys.includes(key)}
                    onChange={(_, checked) =>
                      update({
                        consentKeys: checked
                          ? [...draft.consentKeys, key]
                          : draft.consentKeys.filter((value) => value !== key),
                      })
                    }
                  />
                }
                label={copy.consentLabels[key]}
              />
            ))}
          </Stack>
        </Box>
      </Stack>
    </FormDialog>
  );
}
