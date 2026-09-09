import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, RefreshCw } from 'lucide-react';
import { ActionButton, InlineFeedback, SectionHeader } from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import { evaluateCalendarScheduling } from '@dwp-frontend/shared-utils/api/calendar-api';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  meetingCalendarCriteria,
  readMeetingCalendarObservation,
  type MeetingCalendarObservation,
} from './meeting-schedule-availability-model';
import type { MeetingScheduleDraft } from './meeting-schedule-model';
import { meetingInsetSurface } from './meeting-visual-system';

type State = {
  key: string;
  phase: 'loading' | 'ready' | 'error' | 'expired';
  observation?: MeetingCalendarObservation;
};

export function MeetingScheduleAvailability({
  draft,
  disabled = false,
}: {
  draft: MeetingScheduleDraft;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation('meetings');
  const { user, isAuthenticated } = useAuth();
  const criteria = meetingCalendarCriteria(draft, user ?? null);
  const scopeKey = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
    criteria?.key,
  ]);
  const scope = useRef({ key: scopeKey, generation: 0 });
  if (scope.current.key !== scopeKey) {
    scope.current = { key: scopeKey, generation: scope.current.generation + 1 };
  }
  const key = JSON.stringify([scopeKey, scope.current.generation]);
  const currentKey = useRef(key);
  currentKey.current = key;
  const generation = useRef(0);
  const mounted = useRef(false);
  const [stored, setStored] = useState<State | null>(null);
  const state = stored?.key === key ? stored : null;
  const observation =
    state?.phase === 'ready' &&
    state.observation &&
    Date.parse(state.observation.validUntil) > Date.now()
      ? state.observation
      : null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);
  useEffect(() => {
    if (!observation) return;
    const timer = window.setTimeout(
      () => {
        setStored((previous) => (previous?.key === key ? { key, phase: 'expired' } : previous));
      },
      Math.max(0, Date.parse(observation.validUntil) - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [key, observation]);

  const check = async () => {
    if (!criteria || !isAuthenticated || disabled || state?.phase === 'loading') return;
    const intent = ++generation.current;
    setStored({ key, phase: 'loading' });
    try {
      const result = readMeetingCalendarObservation(
        await evaluateCalendarScheduling(criteria.input),
        criteria
      );
      if (mounted.current && currentKey.current === key && intent === generation.current) {
        setStored({ key, phase: 'ready', observation: result });
      }
    } catch {
      if (mounted.current && currentKey.current === key && intent === generation.current) {
        setStored({ key, phase: 'error' });
      }
    }
  };

  return (
    <Stack
      gap={1.25}
      data-testid="meeting-calendar-availability"
      sx={(theme) => ({ ...meetingInsetSurface(theme), p: 1.5 })}
    >
      <SectionHeader
        icon={CalendarClock}
        title={t('scheduleWorkspace.availability.title')}
        density="compact"
        glyph="plain"
      />
      <Typography variant="body2" color="text.secondary">
        {t('scheduleWorkspace.availability.scope')}
      </Typography>
      {draft.recurrence.frequency !== 'NONE' && (
        <Typography variant="caption" color="text.secondary">
          {t('scheduleWorkspace.availability.firstOccurrence')}
        </Typography>
      )}
      {!criteria && (
        <InlineFeedback severity="info">
          {t('scheduleWorkspace.availability.identityRequired')}
        </InlineFeedback>
      )}
      {state?.phase === 'error' && (
        <InlineFeedback severity="warning">
          {t('scheduleWorkspace.availability.error')}
        </InlineFeedback>
      )}
      {(state?.phase === 'expired' || (state?.phase === 'ready' && !observation)) && (
        <InlineFeedback severity="info">
          {t('scheduleWorkspace.availability.expired')}
        </InlineFeedback>
      )}
      {observation && (
        <Box role="status" aria-live="polite">
          <Typography variant="body2" fontWeight="fontWeightBold">
            {t(
              observation.conflictingPeople.length
                ? 'scheduleWorkspace.availability.conflicts'
                : 'scheduleWorkspace.availability.clear',
              { count: observation.conflictingPeople.length || observation.participantCount }
            )}
          </Typography>
          {observation.conflictingPeople.length > 0 && (
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {observation.conflictingPeople.map((person) => (
                <Typography
                  key={person.id}
                  component="li"
                  variant="body2"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {person.name}
                </Typography>
              ))}
            </Box>
          )}
          <Typography variant="caption" color="text.secondary">
            {t('scheduleWorkspace.availability.observed', {
              time: formatDate(
                observation.generatedAt,
                { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: draft.timeZone },
                resolveSupportedLocale(i18n.language)
              ),
            })}
          </Typography>
        </Box>
      )}
      <ActionButton
        intent="secondary"
        startIcon={<RefreshCw size={16} />}
        onClick={() => void check()}
        disabled={!criteria || !isAuthenticated || disabled || state?.phase === 'loading'}
        sx={{ minHeight: 44, alignSelf: 'flex-start' }}
      >
        {t(
          state?.phase === 'loading'
            ? 'scheduleWorkspace.availability.checking'
            : 'scheduleWorkspace.availability.check'
        )}
      </ActionButton>
    </Stack>
  );
}
