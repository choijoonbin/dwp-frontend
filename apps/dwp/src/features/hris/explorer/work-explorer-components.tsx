import { useTranslation } from 'react-i18next';
import { ArrowRight, FolderClock } from 'lucide-react';
import { ActionButton, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ExplorerActivity, ExplorerRoute } from './work-explorer-contract';

export function LoadingWorkspace() {
  const { t } = useTranslation('hcm');
  return (
    <Box aria-busy="true">
      <LoadingState
        label={t('hris.explorer.states.loading')}
        variant="skeleton"
        embedded
        skeleton={
          <Stack gap={2}>
            <LoadingState
              label={t('hris.explorer.search.label')}
              variant="skeleton"
              embedded
              skeletonRows={1}
              skeletonHeight={58}
            />
            <Box className="work-explorer-card-grid">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <LoadingState
                  key={index}
                  label={t('hris.explorer.sections.available')}
                  variant="skeleton"
                  embedded
                  skeletonRows={1}
                  skeletonHeight={150}
                />
              ))}
            </Box>
          </Stack>
        }
      />
    </Box>
  );
}

export function StatePanel({
  title,
  description,
  actionLabel,
  onAction,
  severity = 'info',
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  severity?: 'info' | 'warning' | 'error';
}) {
  return (
    <Paper variant="outlined" className="work-explorer-state-panel">
      <InlineFeedback
        severity={severity}
        title={title}
        action={
          actionLabel && onAction ? (
            <ActionButton intent="quiet" size="small" onClick={onAction}>
              {actionLabel}
            </ActionButton>
          ) : undefined
        }
      >
        {description}
      </InlineFeedback>
    </Paper>
  );
}

export function CompactRouteList({
  id,
  title,
  icon,
  routes,
  labels,
  commandStartBlocked,
  onOpen,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  routes: readonly ExplorerRoute[];
  labels: ReadonlyMap<string, string>;
  commandStartBlocked: boolean;
  onOpen: (route: ExplorerRoute) => void;
}) {
  if (!routes.length) return null;
  return (
    <Box component="section" aria-labelledby={id}>
      <Stack direction="row" alignItems="center" gap={0.8} sx={{ mb: 1 }}>
        {icon}
        <Typography id={id} component="h2" variant="subtitle1" fontWeight="fontWeightBold">
          {title}
        </Typography>
      </Stack>
      <Box component="ul" className="work-explorer-compact-list">
        {routes.map((route) => (
          <Box component="li" key={route.routeKey}>
            <ActionButton
              intent="quiet"
              disabled={commandStartBlocked}
              onClick={() => onOpen(route)}
            >
              <span className="work-explorer-compact-label">{labels.get(route.routeKey)}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </ActionButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function ActivityList({
  activities,
  onOpen,
  resultUnknownLabel,
  busy,
}: {
  activities: readonly ExplorerActivity[];
  onOpen: (activity: ExplorerActivity) => void;
  resultUnknownLabel: string;
  busy: boolean;
}) {
  const { t } = useTranslation('hcm');
  if (!activities.length) return null;
  return (
    <Box component="section" aria-labelledby="work-explorer-in-progress-title">
      <Stack direction="row" alignItems="center" gap={0.8} sx={{ mb: 1 }}>
        <FolderClock size={18} aria-hidden="true" />
        <Typography
          id="work-explorer-in-progress-title"
          component="h2"
          variant="subtitle1"
          fontWeight="fontWeightBold"
        >
          {t('hris.explorer.sections.inProgress')}
        </Typography>
      </Stack>
      <Box component="ul" className="work-explorer-activity-list">
        {activities.map((activity) => (
          <Paper component="li" variant="outlined" key={activity.activityId}>
            <Box minWidth={0}>
              <Typography variant="body2" fontWeight="fontWeightBold">
                {t(`hris.explorer.sourceKinds.${activity.sourceKind}`)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`hris.explorer.modules.${activity.module}`)} ·{' '}
                {t(`hris.explorer.activityStates.${activity.state}`)}
                {activity.state === 'RESULT_UNKNOWN' ? ` · ${resultUnknownLabel}` : ''}
              </Typography>
            </Box>
            <ActionButton
              intent="quiet"
              size="small"
              aria-label={t('hris.explorer.actions.resumeActivity', {
                source: t(`hris.explorer.sourceKinds.${activity.sourceKind}`),
              })}
              disabled={busy}
              onClick={() => onOpen(activity)}
            >
              {t('hris.explorer.actions.resume')}
            </ActionButton>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
