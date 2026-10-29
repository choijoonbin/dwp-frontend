import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck2 } from 'lucide-react';
import { GuidedEmptyState } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { calendarDate, calendarTime } from './calendar-components';
import { CalendarSectionHeader } from './calendar-experience';
import { CalendarSchedulingEvidence } from './calendar-scheduling-evidence';
import { CalendarSchedulingMatrix } from './calendar-scheduling-matrix';
import {
  calendarSchedulingCandidateDecisionV2,
  type CalendarSchedulingV2State,
} from './calendar-scheduling-v2-model';

import type {
  CalendarSchedulingCandidateV2,
  CalendarSchedulingEvaluationV2,
} from '@dwp-frontend/shared-utils';

export function CalendarAvailabilityResultsV2({
  evaluation,
  state,
  participantLabels,
  language,
  timeZone,
  canApply,
  applying,
  applyError,
  onApply,
}: Readonly<{
  evaluation: CalendarSchedulingEvaluationV2;
  state: CalendarSchedulingV2State;
  participantLabels: Readonly<Record<string, string>>;
  language: string;
  timeZone: string;
  canApply: boolean;
  applying: boolean;
  applyError: boolean;
  onApply: (candidate: CalendarSchedulingCandidateV2) => void;
}>) {
  const { t, i18n } = useTranslation('calendar');
  const evidenceBlocked = state !== 'READY';
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    resultsHeadingRef.current?.focus();
  }, [evaluation.evaluationId]);
  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      <Box>
        <Typography
          ref={resultsHeadingRef}
          component="h2"
          variant="h6"
          fontWeight={800}
          tabIndex={-1}
        >
          {t('schedulingAssistant.resultsTitle')}
        </Typography>
        <Typography role="status" aria-live="polite" variant="body2" color="text.secondary">
          {t('schedulingAssistant.resultSummary', {
            count: evaluation.suggestions.length,
          })}
        </Typography>
      </Box>
      {evidenceBlocked ? (
        <Alert severity="warning" role="status">
          {t(
            state === 'PARTIAL'
              ? 'schedulingAssistant.partialBlocked'
              : state === 'STALE' || state === 'MISMATCH'
                ? 'schedulingAssistant.staleResults'
                : 'schedulingAssistant.unknownBlocked'
          )}
        </Alert>
      ) : null}
      {applyError ? (
        <Alert severity="error" role="alert">
          {t('schedulingAssistant.hardRecheckBlocked')}
        </Alert>
      ) : null}

      <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
          <CalendarSchedulingMatrix
            evaluation={evaluation}
            participantLabels={participantLabels}
            language={language}
            timeZone={timeZone}
          />
        </Box>
        <Divider />
        <CalendarSectionHeader
          icon={CalendarCheck2}
          title={t('availability.suggestions')}
          description={t('availability.suggestionsDescription')}
          meta={
            <Typography variant="caption" color="text.secondary" role="status">
              {t('schedulingAssistant.freshness', {
                time: calendarTime(evaluation.generatedAt, language, timeZone),
              })}
            </Typography>
          }
        />
        <Divider />
        {evaluation.suggestions.length ? (
          <Stack
            component="ol"
            divider={<Divider flexItem />}
            sx={{ p: 0, m: 0, listStyle: 'none' }}
          >
            {evaluation.suggestions.map((candidate, index) => {
              const decision = calendarSchedulingCandidateDecisionV2(
                evaluation,
                candidate,
                state !== 'MISMATCH'
              );
              const eligibleAction = canApply && decision.canApply;
              const actionable = eligibleAction && !applying;
              const reasonCode = candidate.reasonCodes[0] ?? 'ALL_REQUIRED_AVAILABLE';
              const reasonKey = `schedulingAssistant.reasons.${reasonCode}`;
              return (
                <Box component="li" key={candidate.candidateId} sx={{ p: 1.5 }}>
                  <Box
                    component={eligibleAction ? 'button' : 'div'}
                    type={eligibleAction ? 'button' : undefined}
                    disabled={eligibleAction ? applying : undefined}
                    aria-busy={eligibleAction ? applying : undefined}
                    onClick={actionable ? () => onApply(candidate) : undefined}
                    sx={{
                      width: 1,
                      display: 'grid',
                      gridTemplateColumns: '32px minmax(0, 1fr) auto',
                      gap: 1.25,
                      alignItems: 'center',
                      p: 0,
                      border: 0,
                      bgcolor: 'transparent',
                      color: 'text.primary',
                      textAlign: 'left',
                      cursor: actionable ? 'pointer' : 'default',
                      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                    }}
                  >
                    <Typography aria-hidden="true" fontWeight={800} color="primary.main">
                      {index + 1}
                    </Typography>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700}>
                        {calendarDate(candidate.startsAt, language, true, timeZone)} ·{' '}
                        {calendarTime(candidate.startsAt, language, timeZone)}–
                        {calendarTime(candidate.endsAt, language, timeZone)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {i18n.exists(reasonKey, { ns: 'calendar' })
                          ? t(reasonKey)
                          : t('schedulingAssistant.reasonFallback')}
                        {decision.optionalConflictCount
                          ? ` · ${t('schedulingAssistant.optionalConflictWarning', {
                              count: decision.optionalConflictCount,
                            })}`
                          : ''}
                      </Typography>
                    </Box>
                    {eligibleAction ? (
                      <Typography component="span" variant="caption" color="primary.main">
                        {t('schedulingAssistant.apply')}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          decision.blockReason === 'REQUIRED_CONFLICT'
                            ? 'schedulingAssistant.requiredConflictBlocked'
                            : 'availability.reviewOnly'
                        )}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <GuidedEmptyState
            kind="no-results"
            title={t('availability.noSlots')}
            description={t('availability.noSlotsDescription')}
          />
        )}
      </Box>
      <CalendarSchedulingEvidence sources={evaluation.sources} rooms={evaluation.rooms} />
    </Stack>
  );
}
