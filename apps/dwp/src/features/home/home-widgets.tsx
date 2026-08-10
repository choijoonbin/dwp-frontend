import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Focus,
  Sparkles,
  TimerReset,
  UsersRound,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { SectionHeading } from '../work-hub/workspace-ui';
import {
  localizeActivityEvents,
  localizeScheduleItems,
  localizeTodayItems,
} from '../work-hub/reference-data';

import type { Priority } from '../work-hub/reference-data';

const priorityColor: Record<Priority, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
};

const scheduleTone = {
  meeting: 'primary.main',
  focus: 'success.main',
  deadline: 'warning.main',
} as const;

export function DailyBriefWidget() {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const signals = [
    { key: 'deadline', icon: TimerReset },
    { key: 'focus', icon: Focus },
    { key: 'meeting', icon: UsersRound },
  ] as const;

  return (
    <Box
      component="section"
      aria-labelledby="brief-heading"
      sx={{
        gridColumn: '1 / -1',
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          lg: 'minmax(0, 1.65fr) minmax(320px, 1fr)',
        },
        color: '#F8FAFC',
        bgcolor: '#111923',
        border: 1,
        borderColor: '#293545',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: { xs: 2.5, sm: 3, lg: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            icon={<Sparkles size={14} aria-hidden="true" />}
            label={t('widgets.brief.sourceSummary', { count: 6 })}
            size="small"
            sx={{
              color: '#DCE8FF',
              borderColor: '#5876A3',
              bgcolor: '#18263A',
              '& .MuiChip-icon': { color: '#7EB7FF' },
            }}
            variant="outlined"
          />
          <Typography variant="caption" sx={{ color: '#AEBACC' }}>
            {t('page.updatedAt', { time: '09:10' })}
          </Typography>
        </Box>
        <Typography id="brief-heading" component="h2" variant="h5" sx={{ mt: 2.25 }}>
          {t('widgets.brief.title')}
        </Typography>
        <Typography
          component="p"
          sx={{ mt: 1, maxWidth: 720, fontSize: '1.125rem', lineHeight: 1.55, color: '#F8FAFC' }}
        >
          {t('widgets.brief.summary')}
        </Typography>

        <Box
          sx={{
            mt: 2.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          {signals.map(({ key, icon: SignalIcon }) => {
            const label = t(`widgets.brief.signals.${key}.label`);
            return (
              <Box
                key={label as string}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '32px minmax(0, 1fr)',
                  gap: 1,
                  alignItems: 'center',
                  p: 1.25,
                  border: '1px solid #334155',
                  borderRadius: 1,
                  bgcolor: '#16212E',
                }}
              >
                <Box sx={{ color: '#8DB8FF', display: 'grid', placeItems: 'center' }}>
                  <SignalIcon size={18} strokeWidth={1.8} aria-hidden="true" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: '#AEBACC' }}>
                    {label}
                  </Typography>
                  <Typography component="p" variant="subtitle2" sx={{ color: '#FFFFFF' }}>
                    {t(`widgets.brief.signals.${key}.value`)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#AEBACC' }}>
                    {t(`widgets.brief.signals.${key}.detail`)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2.5 }}>
          <Button
            variant="contained"
            startIcon={<BriefcaseBusiness size={17} aria-hidden="true" />}
            onClick={() => navigate('/work?item=WK-1042')}
          >
            {t('widgets.brief.reviewPriority')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Sparkles size={17} aria-hidden="true" />}
            onClick={() => navigate(`/ask?q=${encodeURIComponent(t('widgets.brief.askPrompt'))}`)}
            sx={{
              color: '#F8FAFC',
              borderColor: '#66778F',
              '&:hover': { borderColor: '#AFC8F2' },
            }}
          >
            {t('widgets.brief.askToday')}
          </Button>
        </Box>
      </Box>

      <Box
        sx={{
          p: { xs: 2.5, sm: 3, lg: 4 },
          borderLeft: { xs: 0, lg: '1px solid #293545' },
          borderTop: { xs: '1px solid #293545', lg: 0 },
          bgcolor: '#0D141D',
        }}
      >
        <Typography component="h3" variant="subtitle1" sx={{ color: '#FFFFFF' }}>
          {t('widgets.brief.rhythmTitle')}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25, color: '#AEBACC' }}>
          {t('widgets.brief.rhythmDescription')}
        </Typography>
        <Box role="img" aria-label={t('widgets.brief.rhythmLabel')} sx={{ mt: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 0.5 }}>
            {['09', '10', '11', '12', '13', '14', '15', '16', '17'].map((hour) => (
              <Typography
                key={hour}
                variant="caption"
                sx={{ color: '#8391A5', textAlign: 'center' }}
              >
                {hour}
              </Typography>
            ))}
          </Box>
          <Box
            sx={{
              mt: 1,
              height: 54,
              display: 'grid',
              gridTemplateColumns: 'repeat(18, 1fr)',
              gap: 0.5,
              alignItems: 'end',
            }}
          >
            {Array.from({ length: 18 }, (_, index) => {
              const meeting = [1, 4, 5].includes(index);
              const focus = [10, 11, 12].includes(index);
              const deadline = index === 17;
              return (
                <Box
                  key={index}
                  sx={{
                    height: meeting ? 44 : focus ? 30 : deadline ? 52 : 8,
                    bgcolor: meeting
                      ? '#5B8DEF'
                      : focus
                        ? '#39B98A'
                        : deadline
                          ? '#E6A23C'
                          : '#273445',
                    borderRadius: 0.5,
                  }}
                />
              );
            })}
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.25, mt: 3 }}>
          {[
            ['#5B8DEF', 'meetings', 'meetingDuration'],
            ['#39B98A', 'focus', 'focusDuration'],
            ['#E6A23C', 'deadline', null],
          ].map(([color, labelKey, valueKey]) => (
            <Box key={labelKey} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: color }} />
              <Typography variant="body2" sx={{ flex: 1, color: '#CBD5E1' }}>
                {t(`widgets.brief.${labelKey}`)}
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#FFFFFF' }}>
                {valueKey ? t(`widgets.brief.${valueKey}`) : '17:00'}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export function FocusWidget() {
  const { t } = useTranslation(['home', 'work', 'common']);
  const navigate = useNavigate();
  const items = useMemo(
    () => localizeTodayItems((key, options) => t(key, { ns: 'work', ...options })),
    [t]
  );
  return (
    <Box
      component="section"
      aria-labelledby="priority-heading"
      sx={{ gridColumn: { xs: '1 / -1', lg: 'span 6' }, minWidth: 0, py: 2.5 }}
    >
      <SectionHeading
        id="priority-heading"
        icon={CheckCircle2}
        title={t('widgets.focus.title')}
        meta={
          <Typography variant="body2" color="text.secondary">
            {t('units.item', { ns: 'common', count: items.length })}
          </Typography>
        }
      />
      <Box component="ol" sx={{ p: 0, mt: 2, mb: 0, listStyle: 'none' }}>
        {items.map((item, index) => (
          <Box component="li" key={item.id} sx={{ borderTop: 1, borderColor: 'divider' }}>
            <ButtonBase
              onClick={() => navigate(item.actionRoute)}
              sx={{
                width: 1,
                minHeight: 78,
                p: 1.5,
                display: 'grid',
                gridTemplateColumns: '32px minmax(0, 1fr) auto',
                gap: 1.5,
                alignItems: 'center',
                textAlign: 'left',
                bgcolor: index === 0 ? 'action.selected' : 'transparent',
                borderLeft: 3,
                borderLeftColor: index === 0 ? 'primary.main' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Typography variant="caption" color="text.secondary" fontWeight={800}>
                {String(index + 1).padStart(2, '0')}
              </Typography>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography component="h3" variant="subtitle2">
                    {item.title}
                  </Typography>
                  <Chip
                    label={t(`labels.priority.${item.priority}`, { ns: 'work' })}
                    color={priorityColor[item.priority]}
                    variant="outlined"
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                  {item.reason}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.dueLabel} / {item.duration} / {item.source}
                </Typography>
              </Box>
              <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
            </ButtonBase>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function ScheduleWidget() {
  const { t } = useTranslation(['home', 'work']);
  const items = useMemo(
    () => localizeScheduleItems((key, options) => t(key, { ns: 'work', ...options })),
    [t]
  );

  return (
    <Box
      component="section"
      aria-labelledby="schedule-heading"
      sx={{ gridColumn: { xs: '1 / -1', lg: 'span 3' }, minWidth: 0, py: 2.5 }}
    >
      <SectionHeading
        id="schedule-heading"
        icon={CalendarDays}
        title={t('widgets.schedule.title')}
      />
      <Box component="ol" sx={{ p: 0, mt: 2, mb: 0, listStyle: 'none' }}>
        {items.map((item, index) => (
          <Box
            component="li"
            key={item.id}
            sx={{
              display: 'grid',
              gridTemplateColumns: '52px 12px minmax(0, 1fr)',
              gap: 1,
              minHeight: 68,
            }}
          >
            <Typography variant="caption" fontWeight={800} sx={{ pt: 0.25 }}>
              {item.time}
            </Typography>
            <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              {index < items.length - 1 && (
                <Box
                  sx={{ position: 'absolute', top: 10, bottom: -4, width: 1, bgcolor: 'divider' }}
                />
              )}
              <Box
                sx={{
                  position: 'relative',
                  width: 8,
                  height: 8,
                  mt: 0.5,
                  borderRadius: '50%',
                  bgcolor: scheduleTone[item.kind],
                }}
              />
            </Box>
            <Box>
              <Typography component="h3" variant="subtitle2">
                {item.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.detail}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function ActivityWidget() {
  const { t } = useTranslation(['home', 'work']);
  const navigate = useNavigate();
  const events = useMemo(
    () => localizeActivityEvents((key, options) => t(key, { ns: 'work', ...options })).slice(0, 3),
    [t]
  );
  return (
    <Box
      component="section"
      aria-labelledby="activity-heading"
      sx={{ gridColumn: { xs: '1 / -1', lg: 'span 3' }, minWidth: 0, py: 2.5 }}
    >
      <SectionHeading
        id="activity-heading"
        icon={Activity}
        title={t('widgets.activity.title')}
        meta={<Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'success.main' }} />}
      />
      <Box component="ul" sx={{ p: 0, mt: 2, mb: 0, listStyle: 'none' }}>
        {events.map((event) => (
          <Box component="li" key={event.id} sx={{ py: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {event.time}
              </Typography>
              <Chip
                label={t(`labels.actor.${event.actor}`, { ns: 'work' })}
                size="small"
                color={event.actor === 'agent' ? 'info' : 'default'}
                variant="outlined"
              />
            </Box>
            <Typography component="h3" variant="subtitle2" sx={{ mt: 0.75 }}>
              {event.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {event.actorName} / {event.source}
            </Typography>
          </Box>
        ))}
      </Box>
      <Button
        variant="text"
        endIcon={<ArrowRight size={16} aria-hidden="true" />}
        onClick={() => navigate('/activity')}
        sx={{ mt: 1, px: 0 }}
      >
        {t('widgets.activity.view')}
      </Button>
    </Box>
  );
}
