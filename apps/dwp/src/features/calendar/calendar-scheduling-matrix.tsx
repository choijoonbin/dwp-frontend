import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, UsersRound } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { calendarDate, calendarTime } from './calendar-components';
import {
  calendarSchedulingCandidateDecisionV2,
  type CalendarSchedulingMatrixStatus,
} from './calendar-scheduling-v2-model';

import type {
  CalendarSchedulingCandidateV2,
  CalendarSchedulingEvaluationV2,
} from '@dwp-frontend/shared-utils';

function statusColor(status: CalendarSchedulingMatrixStatus) {
  if (status === 'AVAILABLE') return 'success' as const;
  if (status === 'TENTATIVE') return 'warning' as const;
  return 'error' as const;
}

export function CalendarSchedulingMatrix({
  evaluation,
  candidates = evaluation.suggestions,
  participantLabels,
  language,
  timeZone,
}: Readonly<{
  evaluation: CalendarSchedulingEvaluationV2;
  candidates?: readonly CalendarSchedulingCandidateV2[];
  participantLabels?: Readonly<Record<string, string>>;
  language: string;
  timeZone: string;
}>) {
  const { t } = useTranslation('calendar');
  const titleId = useId();
  const visibleCandidates = candidates.slice(0, 4);
  if (!visibleCandidates.length) return null;
  const participants = evaluation.participants;

  return (
    <Box component="section" aria-labelledby={titleId} sx={{ mt: 2 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <UsersRound size={17} aria-hidden="true" />
        <Box>
          <Typography id={titleId} component="h3" variant="subtitle2" fontWeight={800}>
            {t('schedulingAssistant.matrixTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('schedulingAssistant.matrixDescription')}
          </Typography>
        </Box>
      </Stack>
      <TableContainer
        tabIndex={0}
        sx={{ mt: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}
      >
        <Table
          size="small"
          aria-label={t('schedulingAssistant.matrixTitle')}
          sx={{ minWidth: 620 }}
        >
          <TableHead>
            <TableRow>
              <TableCell>{t('schedulingAssistant.attendee')}</TableCell>
              {visibleCandidates.map((candidate) => (
                <TableCell key={candidate.candidateId} align="center">
                  <Stack spacing={0.25} alignItems="center">
                    <CalendarClock size={14} aria-hidden="true" />
                    <Typography variant="caption" fontWeight={800}>
                      {calendarDate(candidate.startsAt, language, false, timeZone)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {calendarTime(candidate.startsAt, language, timeZone)}–
                      {calendarTime(candidate.endsAt, language, timeZone)}
                    </Typography>
                  </Stack>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {participants.map((participant) => (
              <TableRow key={`${participant.role}:${participant.clientRef}`}>
                <TableCell component="th" scope="row">
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {participantLabels?.[participant.clientRef] ??
                      t(`schedulingAssistant.roles.${participant.role}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`schedulingAssistant.roles.${participant.role}`)}
                  </Typography>
                </TableCell>
                {visibleCandidates.map((candidate) => {
                  const decision = calendarSchedulingCandidateDecisionV2(evaluation, candidate);
                  const status =
                    decision.cells.find(
                      (cell) => cell.participant.clientRef === participant.clientRef
                    )?.status ?? 'UNKNOWN';
                  const label = t(`schedulingAssistant.intervals.${status}`);
                  return (
                    <TableCell
                      key={candidate.candidateId}
                      align="center"
                      aria-label={t('schedulingAssistant.matrixCellLabel', {
                        attendee:
                          participantLabels?.[participant.clientRef] ??
                          t(`schedulingAssistant.roles.${participant.role}`),
                        status: label,
                      })}
                    >
                      <Chip
                        size="small"
                        color={statusColor(status)}
                        variant={status === 'AVAILABLE' ? 'filled' : 'outlined'}
                        label={label}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
