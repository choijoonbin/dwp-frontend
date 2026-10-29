import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck2, RotateCcw, XCircle } from 'lucide-react';
import {
  ActionButton,
  InlineFeedback,
  SelectField,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  calendarSchedulingPollActions,
  formatCalendarSchedulingPollDateTime,
} from './calendar-scheduling-poll-model';

import type { CalendarSchedulingPollDetails } from '@dwp-frontend/shared-utils/api/calendar-scheduling-poll-api';

export type CalendarSchedulingPollCalendarOption = Readonly<{
  calendarId: string;
  name: string;
}>;

export type CalendarSchedulingPollOrganizerAction = 'OPEN' | 'CANCEL' | 'CONFIRM';

export function CalendarSchedulingPollOrganizer({
  details,
  actorPersonPublicId,
  calendars,
  selectedCandidateId,
  selectedCalendarId,
  busyAction = null,
  errorMessage,
  now,
  onCandidateChange,
  onCalendarChange,
  onOpen,
  onCancel,
  onConfirm,
}: Readonly<{
  details: CalendarSchedulingPollDetails;
  actorPersonPublicId: string | null;
  calendars: readonly CalendarSchedulingPollCalendarOption[];
  selectedCandidateId: string;
  selectedCalendarId: string;
  busyAction?: CalendarSchedulingPollOrganizerAction | null;
  errorMessage?: string | null;
  now?: number;
  onCandidateChange: (candidateId: string) => void;
  onCalendarChange: (calendarId: string) => void;
  onOpen: (version: number) => void;
  onCancel: (version: number) => void;
  onConfirm: (input: { candidateId: string; calendarId: string; version: number }) => void;
}>) {
  const { t, i18n } = useTranslation('calendar');
  const titleId = useId();
  const candidatesLabelId = useId();
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const actions = calendarSchedulingPollActions(details, actorPersonPublicId, now);
  const evidenceByCandidate = useMemo(
    () => new Map(details.availability.map((value) => [value.candidateId, value] as const)),
    [details.availability]
  );
  const eligible = useMemo(
    () => new Set(actions.eligibleCandidateIds),
    [actions.eligibleCandidateIds]
  );
  const selectedCandidateEligible = eligible.has(selectedCandidateId);
  const canSubmitConfirmation = Boolean(
    actions.canConfirm && selectedCandidateEligible && selectedCalendarId && !busyAction
  );
  const format = (value: string) =>
    formatCalendarSchedulingPollDateTime(value, details.poll.timeZone, language) ??
    t('polls.dateUnavailable');

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      data-testid="calendar-scheduling-poll-organizer"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.control,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ px: 2, py: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            id={titleId}
            component="h2"
            variant="h6"
            fontWeight={foundationTokens.home.typography.weightEmphasis}
          >
            {details.poll.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('polls.organizer.description')}
          </Typography>
        </Box>
        <Chip
          size="small"
          role="status"
          label={t(`polls.states.${details.poll.state}`)}
          color={details.poll.state === 'AGREEMENT_REACHED' ? 'success' : 'default'}
        />
      </Stack>
      <Divider />

      <Stack spacing={2} sx={{ p: 2 }}>
        {!actions.isOrganizer ? (
          <InlineFeedback severity="warning">{t('polls.organizer.notOrganizer')}</InlineFeedback>
        ) : (
          <>
            {errorMessage ? <InlineFeedback severity="error">{errorMessage}</InlineFeedback> : null}
            {actions.expired ? (
              <InlineFeedback severity="warning">{t('polls.expired')}</InlineFeedback>
            ) : null}
            {details.poll.state === 'CONFIRMED' ? (
              <InlineFeedback severity="success">{t('polls.organizer.confirmed')}</InlineFeedback>
            ) : null}

            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('polls.expiresAt')}
              </Typography>
              <Typography variant="body2">{format(details.poll.expiresAt)}</Typography>
            </Box>

            <FormControl component="fieldset" fullWidth>
              <FormLabel id={candidatesLabelId} component="legend">
                {t('polls.organizer.candidates')}
              </FormLabel>
              <RadioGroup
                aria-labelledby={candidatesLabelId}
                value={selectedCandidateId}
                onChange={(event) => onCandidateChange(event.target.value)}
                sx={{ gap: 1, mt: 1 }}
              >
                {details.poll.candidates.map((candidate, index) => {
                  const candidateEvidence = evidenceByCandidate.get(candidate.candidateId);
                  const candidateEligible = eligible.has(candidate.candidateId);
                  return (
                    <Box
                      key={candidate.candidateId}
                      sx={{
                        border: 1,
                        borderColor: candidateEligible ? 'success.main' : 'divider',
                        borderRadius: foundationTokens.radius.control,
                        px: 1.25,
                        py: 1,
                      }}
                    >
                      <FormControlLabel
                        value={candidate.candidateId}
                        disabled={!actions.canConfirm || !candidateEligible || Boolean(busyAction)}
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography
                              fontWeight={foundationTokens.home.typography.weightBold}
                              variant="body2"
                            >
                              {t('polls.candidateLabel', { count: index + 1 })}
                            </Typography>
                            <Typography variant="body2">
                              {t('polls.candidateRange', {
                                start: format(candidate.startsAt),
                                end: format(candidate.endsAt),
                              })}
                            </Typography>
                          </Box>
                        }
                      />
                      <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap sx={{ pl: 4 }}>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('polls.votes.YESCount', { count: candidate.yesCount })}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('polls.votes.IF_NEEDEDCount', {
                            count: candidate.ifNeededCount,
                          })}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('polls.votes.NOCount', { count: candidate.noCount })}
                        />
                        <Chip
                          size="small"
                          color={candidateEligible ? 'success' : 'default'}
                          label={t(
                            candidateEligible
                              ? 'polls.organizer.agreementEligible'
                              : `polls.availability.${candidateEvidence?.availabilityState ?? 'UNAVAILABLE'}`
                          )}
                        />
                      </Stack>
                    </Box>
                  );
                })}
              </RadioGroup>
            </FormControl>

            {actions.canConfirm ? (
              <SelectField<string>
                label={t('polls.organizer.calendarLabel')}
                value={selectedCalendarId}
                disabled={Boolean(busyAction)}
                options={calendars.map((calendar) => ({
                  value: calendar.calendarId,
                  label: calendar.name,
                }))}
                onValueChange={(value) => onCalendarChange(value ?? '')}
              />
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap" useFlexGap>
              {actions.canOpen ? (
                <ActionButton
                  intent="primary"
                  loading={busyAction === 'OPEN'}
                  loadingLabel={t('polls.organizer.opening')}
                  disabled={Boolean(busyAction)}
                  startIcon={<RotateCcw size={17} aria-hidden="true" />}
                  onClick={() => onOpen(details.poll.version)}
                >
                  {t(
                    details.poll.state === 'DRAFT'
                      ? 'polls.organizer.open'
                      : 'polls.organizer.reopen'
                  )}
                </ActionButton>
              ) : null}
              {actions.canConfirm ? (
                <ActionButton
                  intent="primary"
                  loading={busyAction === 'CONFIRM'}
                  loadingLabel={t('polls.organizer.confirming')}
                  disabled={!canSubmitConfirmation}
                  startIcon={<CalendarCheck2 size={17} aria-hidden="true" />}
                  onClick={() =>
                    onConfirm({
                      candidateId: selectedCandidateId,
                      calendarId: selectedCalendarId,
                      version: details.poll.version,
                    })
                  }
                >
                  {t('polls.organizer.confirm')}
                </ActionButton>
              ) : null}
              {actions.canCancel ? (
                <ActionButton
                  intent="danger"
                  loading={busyAction === 'CANCEL'}
                  loadingLabel={t('polls.organizer.cancelling')}
                  disabled={Boolean(busyAction)}
                  startIcon={<XCircle size={17} aria-hidden="true" />}
                  onClick={() => onCancel(details.poll.version)}
                >
                  {t('polls.organizer.cancel')}
                </ActionButton>
              ) : null}
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
