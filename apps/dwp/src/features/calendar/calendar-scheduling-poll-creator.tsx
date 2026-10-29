import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Send, Trash2 } from 'lucide-react';
import {
  ActionButton,
  DateTimePickerField,
  DwpDateTimeProvider,
  FormField,
  InlineFeedback,
  SelectField,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CalendarAttendeePicker } from './calendar-attendee-picker';
import {
  calendarSchedulingPollDraftValidation,
  type CalendarSchedulingPollDraft,
  type CalendarSchedulingPollValidationCode,
} from './calendar-scheduling-poll-model';

import type { CalendarEditorAttendee } from './calendar-event-editor-model';

const TIME_ZONES = [
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'UTC',
] as const;

function defaultDraft(
  now: number,
  timeZone: string,
  organizer: { personPublicId: string; displayName: string }
): CalendarSchedulingPollDraft {
  const startsAt = new Date(now + 24 * 60 * 60_000);
  startsAt.setUTCMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
  const expiresAt = new Date(startsAt.getTime() - 60 * 60_000);
  return {
    title: '',
    description: '',
    timeZone,
    candidates: [
      {
        candidateId: crypto.randomUUID(),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        resourceId: null,
      },
    ],
    participants: [
      {
        personPublicId: organizer.personPublicId,
        externalEmail: null,
        displayName: organizer.displayName,
        required: true,
      },
    ],
    expiresAt: expiresAt.toISOString(),
  };
}

function attendee(
  participant: CalendarSchedulingPollDraft['participants'][number]
): CalendarEditorAttendee {
  return {
    personId: participant.personPublicId,
    displayName: participant.displayName,
    workEmail: null,
    type: participant.required ? 'REQUIRED' : 'OPTIONAL',
  };
}

function uniqueIssues(codes: readonly CalendarSchedulingPollValidationCode[]) {
  return [...new Set(codes)];
}

function nextCandidateInstant(value: string, fallback: number) {
  const parsed = Date.parse(value);
  return new Date(Number.isFinite(parsed) ? parsed + 24 * 60 * 60_000 : fallback).toISOString();
}

export function CalendarSchedulingPollCreator({
  organizer,
  initialDraft = null,
  submitting = false,
  errorMessage,
  now = Date.now(),
  onCancel,
  onSubmit,
}: Readonly<{
  organizer: { personPublicId: string; displayName: string };
  initialDraft?: CalendarSchedulingPollDraft | null;
  submitting?: boolean;
  errorMessage?: string | null;
  now?: number;
  onCancel: () => void;
  onSubmit: (draft: CalendarSchedulingPollDraft) => void;
}>) {
  const { t, i18n } = useTranslation('calendar');
  const seed = initialDraft ?? defaultDraft(now, 'Asia/Seoul', organizer);
  const [title, setTitle] = useState(seed.title);
  const [description, setDescription] = useState(seed.description);
  const [timeZone, setTimeZone] = useState(seed.timeZone);
  const [expiresAt, setExpiresAt] = useState(seed.expiresAt);
  const [candidates, setCandidates] = useState([...seed.candidates]);
  const [required, setRequired] = useState<CalendarEditorAttendee[]>(
    seed.participants.filter((value) => value.required).map(attendee)
  );
  const [optional, setOptional] = useState<CalendarEditorAttendee[]>(
    seed.participants.filter((value) => !value.required).map(attendee)
  );
  const [showValidation, setShowValidation] = useState(false);
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const draft = useMemo<CalendarSchedulingPollDraft>(
    () => ({
      title,
      description,
      timeZone,
      candidates,
      participants: [
        ...required.map((value) => ({
          personPublicId: value.personId,
          externalEmail: null,
          displayName: value.displayName,
          required: true,
        })),
        ...optional.map((value) => ({
          personPublicId: value.personId,
          externalEmail: null,
          displayName: value.displayName,
          required: false,
        })),
      ],
      expiresAt,
    }),
    [candidates, description, expiresAt, optional, required, timeZone, title]
  );
  const validation = useMemo(() => calendarSchedulingPollDraftValidation(draft, now), [draft, now]);
  const issueCodes = validation.issues.map((issue) => issue.code);
  const hasIssue = (code: CalendarSchedulingPollValidationCode, index?: number) =>
    validation.issues.some(
      (issue) => issue.code === code && (index === undefined || issue.index === index)
    );

  const patchCandidate = (
    index: number,
    patch: Partial<CalendarSchedulingPollDraft['candidates'][number]>
  ) => {
    setCandidates((current) =>
      current.map((candidate, candidateIndex) =>
        candidateIndex === index ? { ...candidate, ...patch } : candidate
      )
    );
  };
  const replaceRequired = (values: readonly CalendarEditorAttendee[]) => {
    const ids = new Set(values.map((value) => value.personId));
    setRequired([...values]);
    setOptional((current) => current.filter((value) => !ids.has(value.personId)));
  };
  const replaceOptional = (values: readonly CalendarEditorAttendee[]) => {
    const ids = new Set(values.map((value) => value.personId));
    setOptional([...values]);
    setRequired((current) => current.filter((value) => !ids.has(value.personId)));
  };

  return (
    <Box
      component="section"
      aria-labelledby="calendar-poll-creator-title"
      data-testid="calendar-scheduling-poll-creator"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.control,
        overflow: 'hidden',
        mb: 2,
      }}
    >
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography
          id="calendar-poll-creator-title"
          component="h2"
          variant="h6"
          fontWeight={foundationTokens.home.typography.weightEmphasis}
        >
          {t('polls.creator.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('polls.creator.description')}
        </Typography>
      </Box>
      <Divider />
      <Stack spacing={2} sx={{ p: 2 }}>
        {errorMessage ? <InlineFeedback severity="error">{errorMessage}</InlineFeedback> : null}
        <FormField
          autoFocus
          required
          label={t('polls.creator.titleLabel')}
          value={title}
          disabled={submitting}
          onChange={(event) => setTitle(event.target.value)}
          inputProps={{ maxLength: 240 }}
          errorMessage={
            showValidation && hasIssue('TITLE_REQUIRED')
              ? t('polls.validation.TITLE_REQUIRED')
              : undefined
          }
        />
        <FormField
          multiline
          minRows={3}
          label={t('polls.creator.descriptionLabel')}
          value={description}
          disabled={submitting}
          onChange={(event) => setDescription(event.target.value)}
          inputProps={{ maxLength: 2_000 }}
          errorMessage={
            showValidation && hasIssue('DESCRIPTION_TOO_LONG')
              ? t('polls.validation.DESCRIPTION_TOO_LONG')
              : undefined
          }
        />
        <SelectField<string>
          label={t('polls.creator.timeZoneLabel')}
          value={timeZone}
          disabled={submitting}
          options={TIME_ZONES.map((value) => ({ value, label: value }))}
          onValueChange={(value) => value && setTimeZone(value)}
          errorMessage={
            showValidation && hasIssue('TIME_ZONE_INVALID')
              ? t('polls.validation.TIME_ZONE_INVALID')
              : undefined
          }
        />

        <DwpDateTimeProvider locale={language} timeZone={timeZone}>
          <DateTimePickerField
            required
            label={t('polls.creator.expiresAtLabel')}
            value={expiresAt}
            disabled={submitting}
            onValueChange={(value) => value && setExpiresAt(value)}
            errorMessage={
              showValidation && hasIssue('EXPIRES_AT_INVALID')
                ? t('polls.validation.EXPIRES_AT_INVALID')
                : showValidation && hasIssue('EXPIRES_AT_RANGE')
                  ? t('polls.validation.EXPIRES_AT_RANGE')
                  : undefined
            }
          />

          <Stack component="fieldset" spacing={1.5} sx={{ m: 0, p: 0, border: 0 }}>
            <Typography
              component="legend"
              fontWeight={foundationTokens.home.typography.weightEmphasis}
            >
              {t('polls.creator.candidatesLabel')}
            </Typography>
            {candidates.map((candidate, index) => (
              <Box
                key={candidate.candidateId}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: foundationTokens.radius.control,
                  p: 1.5,
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                  sx={{ mb: 1.25 }}
                >
                  <Typography fontWeight={foundationTokens.home.typography.weightBold}>
                    {t('polls.candidateLabel', { count: index + 1 })}
                  </Typography>
                  <ActionButton
                    intent="quiet"
                    size="small"
                    aria-label={t('polls.creator.removeCandidate', { count: index + 1 })}
                    disabled={submitting || candidates.length === 1}
                    startIcon={<Trash2 size={15} aria-hidden="true" />}
                    onClick={() =>
                      setCandidates((current) =>
                        current.filter((_, candidateIndex) => candidateIndex !== index)
                      )
                    }
                  >
                    {t('actions.remove')}
                  </ActionButton>
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 1.5,
                  }}
                >
                  <DateTimePickerField
                    required
                    label={t('polls.creator.candidateStart', { count: index + 1 })}
                    value={candidate.startsAt}
                    disabled={submitting}
                    onValueChange={(value) => value && patchCandidate(index, { startsAt: value })}
                    errorMessage={
                      showValidation &&
                      (hasIssue('CANDIDATE_RANGE_INVALID', index) ||
                        hasIssue('CANDIDATE_NOT_FUTURE', index) ||
                        hasIssue('CANDIDATE_TOO_FAR', index))
                        ? t('polls.validation.CANDIDATE_RANGE_INVALID')
                        : undefined
                    }
                  />
                  <DateTimePickerField
                    required
                    label={t('polls.creator.candidateEnd', { count: index + 1 })}
                    value={candidate.endsAt}
                    disabled={submitting}
                    onValueChange={(value) => value && patchCandidate(index, { endsAt: value })}
                    errorMessage={
                      showValidation &&
                      (hasIssue('CANDIDATE_RANGE_INVALID', index) ||
                        hasIssue('CANDIDATE_DURATION', index))
                        ? t('polls.validation.CANDIDATE_DURATION')
                        : undefined
                    }
                  />
                </Box>
                <FormField
                  label={t('polls.creator.resourceId', { count: index + 1 })}
                  value={candidate.resourceId ?? ''}
                  disabled={submitting}
                  onChange={(event) =>
                    patchCandidate(index, { resourceId: event.target.value.trim() || null })
                  }
                  errorMessage={
                    showValidation && hasIssue('RESOURCE_ID_INVALID', index)
                      ? t('polls.validation.RESOURCE_ID_INVALID')
                      : undefined
                  }
                  supportingText={t('polls.creator.resourceIdHint')}
                />
              </Box>
            ))}
            <ActionButton
              intent="secondary"
              startIcon={<Plus size={16} aria-hidden="true" />}
              disabled={submitting || candidates.length >= 20}
              onClick={() => {
                const previous = candidates.at(-1)!;
                setCandidates((current) => [
                  ...current,
                  {
                    candidateId: crypto.randomUUID(),
                    startsAt: nextCandidateInstant(previous.startsAt, now + 24 * 60 * 60_000),
                    endsAt: nextCandidateInstant(
                      previous.endsAt,
                      now + 24 * 60 * 60_000 + 30 * 60_000
                    ),
                    resourceId: previous.resourceId,
                  },
                ]);
              }}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('polls.creator.addCandidate')}
            </ActionButton>
          </Stack>
        </DwpDateTimeProvider>

        <Stack component="fieldset" spacing={1.5} sx={{ m: 0, p: 0, border: 0 }}>
          <Typography
            component="legend"
            fontWeight={foundationTokens.home.typography.weightEmphasis}
          >
            {t('polls.creator.participantsLabel')}
          </Typography>
          <CalendarAttendeePicker
            scope="calendar-scheduling-poll-required"
            type="REQUIRED"
            value={required}
            externalPolicyState="DENIED"
            disabled={submitting || optional.length >= 100}
            maxSelections={Math.max(1, 100 - optional.length)}
            label={t('polls.creator.requiredParticipants')}
            placeholder={t('polls.creator.searchInternalPeople')}
            supportingText={t('polls.creator.requiredParticipantsHint')}
            onChange={replaceRequired}
          />
          <CalendarAttendeePicker
            scope="calendar-scheduling-poll-optional"
            type="OPTIONAL"
            value={optional}
            externalPolicyState="DENIED"
            disabled={submitting || required.length >= 100}
            maxSelections={Math.max(1, 100 - required.length)}
            label={t('polls.creator.optionalParticipants')}
            placeholder={t('polls.creator.searchInternalPeople')}
            supportingText={t('polls.creator.optionalParticipantsHint')}
            onChange={replaceOptional}
          />
          <InlineFeedback severity="info">{t('polls.creator.externalUnsupported')}</InlineFeedback>
        </Stack>

        {showValidation && !validation.valid ? (
          <Box role="alert" aria-labelledby="calendar-poll-validation-title">
            <Typography
              id="calendar-poll-validation-title"
              fontWeight={foundationTokens.home.typography.weightEmphasis}
              color="error.main"
            >
              {t('polls.creator.validationTitle')}
            </Typography>
            <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2.5 }}>
              {uniqueIssues(issueCodes).map((code) => (
                <li key={code}>{t(`polls.validation.${code}`)}</li>
              ))}
            </Box>
          </Box>
        ) : null}

        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="flex-end" gap={1}>
          <ActionButton intent="quiet" disabled={submitting} onClick={onCancel}>
            {t('actions.cancel')}
          </ActionButton>
          <ActionButton
            intent="primary"
            loading={submitting}
            loadingLabel={t('polls.creator.creating')}
            startIcon={<Send size={17} aria-hidden="true" />}
            onClick={() => {
              setShowValidation(true);
              if (validation.valid) onSubmit(draft);
            }}
          >
            {t('polls.creator.submit')}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}
