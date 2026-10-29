import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { ActionButton, FormField, InlineFeedback } from '@dwp-frontend/design-system';

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
  calendarSchedulingPollVotesComplete,
  formatCalendarSchedulingPollDateTime,
  type CalendarSchedulingPollVoteChoices,
} from './calendar-scheduling-poll-model';

import type {
  CalendarSchedulingPollDetails,
  CalendarSchedulingPollVoteChoice,
} from '@dwp-frontend/shared-utils/api/calendar-scheduling-poll-api';

const VOTE_CHOICES = ['YES', 'IF_NEEDED', 'NO'] as const;

export function CalendarSchedulingPollParticipant({
  details,
  actorPersonPublicId,
  choices,
  comment,
  submitting = false,
  saved = false,
  errorMessage,
  now,
  onChoiceChange,
  onCommentChange,
  onSubmit,
}: Readonly<{
  details: CalendarSchedulingPollDetails;
  actorPersonPublicId: string | null;
  choices: CalendarSchedulingPollVoteChoices;
  comment: string;
  submitting?: boolean;
  saved?: boolean;
  errorMessage?: string | null;
  now?: number;
  onChoiceChange: (candidateId: string, choice: CalendarSchedulingPollVoteChoice) => void;
  onCommentChange: (comment: string) => void;
  onSubmit: () => void;
}>) {
  const { t, i18n } = useTranslation('calendar');
  const titleId = useId();
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const actions = calendarSchedulingPollActions(details, actorPersonPublicId, now);
  const complete = calendarSchedulingPollVotesComplete(details, choices);
  const format = (value: string) =>
    formatCalendarSchedulingPollDateTime(value, details.poll.timeZone, language) ??
    t('polls.dateUnavailable');

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      data-testid="calendar-scheduling-poll-participant"
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ px: 2, py: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography id={titleId} component="h2" variant="h6" fontWeight={750}>
            {details.poll.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('polls.participant.description')}
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
        {!actions.isParticipant ? (
          <InlineFeedback severity="warning">
            {t('polls.participant.notParticipant')}
          </InlineFeedback>
        ) : (
          <>
            {errorMessage ? <InlineFeedback severity="error">{errorMessage}</InlineFeedback> : null}
            {saved ? (
              <InlineFeedback severity="success">{t('polls.participant.saved')}</InlineFeedback>
            ) : null}
            {actions.expired ? (
              <InlineFeedback severity="warning">{t('polls.expired')}</InlineFeedback>
            ) : null}
            {!actions.canVote && !actions.expired ? (
              <InlineFeedback severity="info">
                {t(`polls.participant.readOnly.${details.poll.state}`)}
              </InlineFeedback>
            ) : null}

            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('polls.expiresAt')}
              </Typography>
              <Typography variant="body2">{format(details.poll.expiresAt)}</Typography>
            </Box>

            <Stack spacing={1.25}>
              {details.poll.candidates.map((candidate, index) => {
                const labelId = `${titleId}-candidate-${index}`;
                return (
                  <FormControl
                    key={candidate.candidateId}
                    component="fieldset"
                    disabled={!actions.canVote || submitting}
                    sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}
                  >
                    <FormLabel id={labelId} component="legend">
                      {t('polls.candidateLabel', { count: index + 1 })}
                    </FormLabel>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {t('polls.candidateRange', {
                        start: format(candidate.startsAt),
                        end: format(candidate.endsAt),
                      })}
                    </Typography>
                    <RadioGroup
                      row
                      aria-labelledby={labelId}
                      name={`calendar-poll-${details.poll.pollId}-${candidate.candidateId}`}
                      value={choices[candidate.candidateId] ?? ''}
                      onChange={(event) =>
                        onChoiceChange(
                          candidate.candidateId,
                          event.target.value as CalendarSchedulingPollVoteChoice
                        )
                      }
                      sx={{ mt: 0.75, gap: { xs: 0, sm: 1 } }}
                    >
                      {VOTE_CHOICES.map((choice) => (
                        <FormControlLabel
                          key={choice}
                          value={choice}
                          control={<Radio size="small" />}
                          label={t(`polls.votes.${choice}`)}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                );
              })}
            </Stack>

            <FormField
              multiline
              minRows={2}
              label={t('polls.participant.comment')}
              value={comment}
              disabled={!actions.canVote || submitting}
              onChange={(event) => onCommentChange(event.target.value)}
              inputProps={{ maxLength: 1_000 }}
              supportingText={t('polls.participant.commentHint')}
            />

            {actions.canVote ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1}>
                <ActionButton
                  intent="primary"
                  loading={submitting}
                  loadingLabel={t('polls.participant.submitting')}
                  disabled={!complete}
                  startIcon={<Send size={17} aria-hidden="true" />}
                  onClick={onSubmit}
                >
                  {t('polls.participant.submit')}
                </ActionButton>
                {!complete ? (
                  <Typography variant="caption" color="text.secondary" role="status">
                    {t('polls.participant.completeAll')}
                  </Typography>
                ) : null}
              </Stack>
            ) : null}
          </>
        )}
      </Stack>
    </Box>
  );
}
