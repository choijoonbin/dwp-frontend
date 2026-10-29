import { useTranslation } from 'react-i18next';
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  ShieldX,
  UserRound,
  Wrench,
} from 'lucide-react';
import { ProgressMeter } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

import type {
  WorkspaceActivityActor,
  WorkspaceActivityEvent,
  WorkspaceActivityState,
} from '@dwp-frontend/shared-utils';

export type ActivityTimelineRowData = WorkspaceActivityEvent & { time: string; date: string };

const stateColor: Record<WorkspaceActivityState, 'info' | 'warning' | 'success' | 'error'> = {
  running: 'info',
  'needs-input': 'warning',
  completed: 'success',
  'policy-blocked': 'error',
  failed: 'error',
  cancelled: 'warning',
  unknown: 'warning',
};

function ActorIcon({ actor }: { actor: WorkspaceActivityActor }) {
  if (actor === 'agent') return <Bot size={18} strokeWidth={1.8} />;
  if (actor === 'person') return <UserRound size={18} strokeWidth={1.8} />;
  return <Wrench size={18} strokeWidth={1.8} />;
}

function StateIcon({ state }: { state: WorkspaceActivityState }) {
  if (state === 'running') return <CircleDashed size={17} strokeWidth={1.8} />;
  if (state === 'needs-input') return <CircleAlert size={17} strokeWidth={1.8} />;
  if (state === 'policy-blocked' || state === 'failed') {
    return <ShieldX size={17} strokeWidth={1.8} />;
  }
  if (state === 'cancelled' || state === 'unknown') {
    return <CircleAlert size={17} strokeWidth={1.8} />;
  }
  return <CheckCircle2 size={17} strokeWidth={1.8} />;
}

export function ActivityTimelineRow({
  event,
  active,
  onSelect,
}: {
  event: ActivityTimelineRowData;
  active: boolean;
  onSelect: (eventId: string) => void;
}) {
  const { t } = useTranslation('work');

  return (
    <Box
      component="li"
      sx={{
        mt: 1.25,
        border: 1,
        borderColor: active ? 'primary.main' : 'divider',
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <ButtonBase
        onClick={() => onSelect(event.id)}
        aria-pressed={active}
        sx={{
          width: 1,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: '64px minmax(0, 1fr)',
          },
          gap: { xs: 1, sm: 1.5 },
          alignItems: 'start',
          p: 2,
          pr: { lg: 3 },
          textAlign: 'left',
          bgcolor: active ? 'action.selected' : 'transparent',
          borderLeft: 3,
          borderLeftColor: active ? 'primary.main' : `${stateColor[event.state]}.main`,
          overflowWrap: 'anywhere',
          transition: (theme) => theme.transitions.create(['background-color', 'border-color']),
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Box
          component="time"
          dateTime={event.occurredAt}
          title={`${event.date} ${event.time}`}
          sx={{
            pt: { xs: 0, sm: 0.5 },
            display: { xs: 'flex', sm: 'block' },
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Typography component="span" variant="caption" fontWeight="fontWeightBold">
            {event.time}
          </Typography>
          <Typography
            component="span"
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: { xs: 0, sm: 0.25 } }}
          >
            {event.date}
          </Typography>
        </Box>
        <Box
          aria-label={t('activityPage.actorLabel', {
            actor: t(`labels.actor.${event.actor}`),
          })}
          sx={{
            width: 36,
            height: 36,
            display: 'none',
            placeItems: 'center',
            borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            color: event.actor === 'agent' ? 'primary.main' : 'text.secondary',
            bgcolor: event.actor === 'agent' ? 'action.selected' : 'action.hover',
          }}
        >
          <ActorIcon actor={event.actor} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
              {t(`activityFoundation.detail.kind.${event.eventKind ?? 'EVENT'}.label`)}
            </Typography>
            <Typography component="h3" variant="subtitle2">
              {event.title}
            </Typography>
            {event.dataProvenance === 'SAMPLE' && (
              <Chip size="small" color="warning" label={t('activityFoundation.sample.title')} />
            )}
            <Typography variant="caption" color="text.secondary">
              {event.actorName}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {event.summary}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              mt: 1.25,
              p: 1,
              bgcolor: 'var(--dwp-product-soft)',
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            }}
          >
            <Typography variant="caption">{event.source}</Typography>
            <Typography variant="caption">
              {t(`labels.actor.${event.actor}`)} · {event.actorName}
            </Typography>
            {event.eventKind === 'CHANGE' && event.workStatus && (
              <Typography variant="caption" fontWeight="subtitle2.fontWeight">
                {t('activityFoundation.workStateAtEvent', {
                  state: t(`activityFoundation.workStatus.${event.workStatus}`, {
                    defaultValue: event.workStatus,
                  }),
                })}
              </Typography>
            )}
          </Box>
          {event.progress != null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 1.25 }}>
              <ProgressMeter
                label={t('activityPage.progressLabel', { title: event.title })}
                value={event.progress}
                showLabel={false}
                size="compact"
                sx={{ width: { xs: 150, sm: 220 } }}
              />
              <Typography variant="caption" fontWeight="fontWeightBold">
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
          sx={(theme) => ({
            gridColumn: { xs: '1', sm: '2' },
            justifySelf: 'start',
            ...(event.state === 'completed' && {
              color:
                theme.palette.mode === 'light'
                  ? theme.palette.success.dark
                  : theme.palette.success.light,
            }),
            '@media (forced-colors: active)': {
              color: 'CanvasText',
              borderColor: 'CanvasText',
              '& .MuiChip-icon': { color: 'CanvasText' },
            },
          })}
        />
      </ButtonBase>
    </Box>
  );
}
