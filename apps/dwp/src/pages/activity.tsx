import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  FileClock,
  ShieldX,
  UserRound,
  Wrench,
} from 'lucide-react';
import { useToast } from '@dwp-frontend/shared-utils';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ButtonBase from '@mui/material/ButtonBase';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { LiveSignal, PageHeader, SectionHeading } from '../features/work-hub/workspace-ui';
import { localizeActivityEvents } from '../features/work-hub/reference-data';

import type { ActivityActor, ActivityState } from '../features/work-hub/reference-data';

type ActorFilter = 'all' | ActivityActor;

const stateColor: Record<ActivityState, 'info' | 'warning' | 'success' | 'error'> = {
  running: 'info',
  'needs-input': 'warning',
  completed: 'success',
  'policy-blocked': 'error',
};

function ActorIcon({ actor }: { actor: ActivityActor }) {
  if (actor === 'agent') return <Bot size={18} strokeWidth={1.8} />;
  if (actor === 'person') return <UserRound size={18} strokeWidth={1.8} />;
  return <Wrench size={18} strokeWidth={1.8} />;
}

function StateIcon({ state }: { state: ActivityState }) {
  if (state === 'running') return <CircleDashed size={17} strokeWidth={1.8} />;
  if (state === 'needs-input') return <CircleAlert size={17} strokeWidth={1.8} />;
  if (state === 'policy-blocked') return <ShieldX size={17} strokeWidth={1.8} />;
  return <CheckCircle2 size={17} strokeWidth={1.8} />;
}

export default function ActivityPage() {
  const { t } = useTranslation('work');
  const toast = useToast();
  const [actorFilter, setActorFilter] = useState<ActorFilter>('all');
  const events = useMemo(() => localizeActivityEvents(t), [t]);
  const [selectedId, setSelectedId] = useState(events[0]?.id || '');
  const visibleEvents = useMemo(
    () => (actorFilter === 'all' ? events : events.filter((event) => event.actor === actorFilter)),
    [actorFilter, events]
  );
  const selected = events.find((event) => event.id === selectedId) || visibleEvents[0];

  const changeActor = (_event: React.MouseEvent<HTMLElement>, value: ActorFilter | null) => {
    if (value) setActorFilter(value);
  };

  return (
    <PageCanvas>
      <PageHeader
        eyebrow={t('activityPage.header.eyebrow')}
        title={t('activityPage.header.title')}
        description={t('activityPage.header.description')}
        action={<LiveSignal label={t('activityPage.header.live')} />}
      />

      <Box
        aria-label={t('activityPage.summaryLabel')}
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {(['signals', 'agent', 'input'] as const).map((key, index) => (
          <Box
            key={key}
            sx={{
              py: 2,
              px: { xs: 0, sm: 2.5 },
              borderLeft: { xs: 0, sm: index === 0 ? 0 : 1 },
              borderTop: { xs: index === 0 ? 0 : 1, sm: 0 },
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography component="p" variant="h5">
                {t(`activityPage.summary.${key}.value`)}
              </Typography>
              <Typography component="p" variant="subtitle2">
                {t(`activityPage.summary.${key}.label`)}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t(`activityPage.summary.${key}.detail`)}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          mt: 3,
          display: 'flex',
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 1.5,
        }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={actorFilter}
          onChange={changeActor}
          aria-label={t('activityPage.actorFilter')}
          sx={{ maxWidth: 1, overflowX: 'auto' }}
        >
          <ToggleButton value="all">{t('activityPage.filters.all')}</ToggleButton>
          <ToggleButton value="agent">{t('activityPage.filters.agent')}</ToggleButton>
          <ToggleButton value="person">{t('activityPage.filters.person')}</ToggleButton>
          <ToggleButton value="system">{t('activityPage.filters.system')}</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary">
          {t('activityPage.visibleCount', { count: visibleEvents.length })}
        </Typography>
      </Box>

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.7fr) minmax(320px, 1fr)' },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box component="section" aria-labelledby="activity-timeline-heading" sx={{ minWidth: 0 }}>
          <Box sx={{ py: 2, pr: { lg: 3 } }}>
            <SectionHeading
              id="activity-timeline-heading"
              icon={Activity}
              title={t('activityPage.timeline')}
              meta={<LiveSignal />}
            />
          </Box>
          <Divider />
          <Box
            component="ol"
            aria-label={t('activityPage.timelineLabel')}
            sx={{ p: 0, m: 0, listStyle: 'none' }}
          >
            {visibleEvents.map((event) => {
              const active = event.id === selected?.id;
              return (
                <Box component="li" key={event.id} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <ButtonBase
                    onClick={() => setSelectedId(event.id)}
                    sx={{
                      width: 1,
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '44px minmax(0, 1fr)',
                        sm: '58px 40px minmax(0, 1fr) auto',
                      },
                      gap: { xs: 1, sm: 1.5 },
                      alignItems: 'start',
                      p: 2,
                      pr: { lg: 3 },
                      textAlign: 'left',
                      bgcolor: active ? 'action.selected' : 'transparent',
                      borderLeft: 3,
                      borderLeftColor: active ? 'primary.main' : 'transparent',
                      transition: (theme) =>
                        theme.transitions.create(['background-color', 'border-color']),
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ pt: 0.75 }}>
                      {event.time}
                    </Typography>
                    <Box
                      aria-label={t('activityPage.actorLabel', {
                        actor: t(`labels.actor.${event.actor}`),
                      })}
                      sx={{
                        width: 36,
                        height: 36,
                        display: { xs: 'none', sm: 'grid' },
                        placeItems: 'center',
                        borderRadius: 1,
                        color: event.actor === 'agent' ? 'primary.main' : 'text.secondary',
                        bgcolor: event.actor === 'agent' ? 'action.selected' : 'action.hover',
                      }}
                    >
                      <ActorIcon actor={event.actor} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography component="h3" variant="subtitle2">
                          {event.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {event.actorName}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                        {event.summary}
                      </Typography>
                      {event.progress !== undefined && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 1.25 }}>
                          <LinearProgress
                            variant="determinate"
                            value={event.progress}
                            aria-label={t('activityPage.progressLabel', { title: event.title })}
                            sx={{ width: { xs: 150, sm: 220 }, height: 5, borderRadius: 1 }}
                          />
                          <Typography variant="caption" fontWeight={700}>
                            {event.progress}%
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Chip
                      icon={<StateIcon state={event.state} />}
                      label={t(`activityPage.states.${event.state}`)}
                      color={stateColor[event.state]}
                      size="small"
                      variant="outlined"
                      sx={{ gridColumn: { xs: '2', sm: 'auto' }, justifySelf: 'start' }}
                    />
                  </ButtonBase>
                </Box>
              );
            })}
          </Box>
        </Box>

        {selected && (
          <Box
            component="aside"
            aria-labelledby="activity-detail-heading"
            sx={{
              minWidth: 0,
              p: { xs: 2, md: 3 },
              borderLeft: { xs: 0, lg: 1 },
              borderTop: { xs: 1, lg: 0 },
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Typography id="activity-detail-heading" component="h2" variant="h6">
                {t('activityPage.detailTitle')}
              </Typography>
              <Chip
                label={t(`activityPage.states.${selected.state}`)}
                color={stateColor[selected.state]}
                size="small"
              />
            </Box>
            <Typography component="p" variant="subtitle1" sx={{ mt: 3 }}>
              {selected.title}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {selected.summary}
            </Typography>

            <Box sx={{ display: 'grid', gap: 2, mt: 3 }}>
              {[
                ['actor', selected.actorName],
                ['object', selected.objectLabel],
                ['source', selected.source],
                ['tool', selected.tool || t('activityPage.noTool')],
                ['auditId', selected.auditId],
              ].map(([key, value]) => (
                <Box key={key}>
                  <Typography variant="caption" color="text.secondary">
                    {t(`activityPage.fields.${key}`)}
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ mt: 0.25, overflowWrap: 'anywhere' }}
                  >
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {selected.state === 'needs-input' && (
                <Button
                  variant="contained"
                  startIcon={<FileClock size={17} aria-hidden="true" />}
                  onClick={() => toast.success(t('activityPage.reviewOpened'))}
                >
                  {t('activityPage.reviewNow')}
                </Button>
              )}
              <Button
                variant="outlined"
                endIcon={<ArrowUpRight size={16} aria-hidden="true" />}
                onClick={() =>
                  toast.success(t('activityPage.sourceOpened', { source: selected.source }))
                }
              >
                {t('activityPage.openSource')}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              {t('activityPage.referenceNotice')}
            </Typography>
          </Box>
        )}
      </Box>
    </PageCanvas>
  );
}
