import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileSearch,
  ListChecks,
  MessageSquareReply,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { HomeAppDefinition } from '../../../components/workspace-composer/app-launchpad-model';
import type { HomeContributionModel, NormalizedHomeContribution } from '../contributions';

export type MzGroundingState =
  | 'READY'
  | 'LOADING'
  | 'REFRESHING'
  | 'EMPTY'
  | 'PARTIAL'
  | 'STALE'
  | 'RESTRICTED'
  | 'CONFIGURATION_REQUIRED'
  | 'UNAVAILABLE';

export function resolveMzGroundingState(
  model: HomeContributionModel,
  runtimeState?: Extract<MzGroundingState, 'LOADING' | 'REFRESHING' | 'PARTIAL'>
): MzGroundingState {
  if (runtimeState) return runtimeState;
  const providerStates = model.providers.map(({ state }) => state);
  const noVisibleEvidence = model.diagnostics.visibleCount === 0;
  if (noVisibleEvidence) {
    if (providerStates.some((state) => state === 'FORBIDDEN')) return 'RESTRICTED';
    if (providerStates.some((state) => state === 'CONFIGURATION_REQUIRED')) {
      return 'CONFIGURATION_REQUIRED';
    }
    if (providerStates.some((state) => state === 'UNAVAILABLE')) return 'UNAVAILABLE';
  }
  if (
    providerStates.some(
      (state) =>
        state === 'PARTIAL' ||
        state === 'FORBIDDEN' ||
        state === 'CONFIGURATION_REQUIRED' ||
        state === 'UNAVAILABLE'
    )
  ) {
    return 'PARTIAL';
  }
  if (providerStates.some((state) => state === 'STALE')) return 'STALE';
  if (noVisibleEvidence) return 'EMPTY';
  return 'READY';
}

function uniqueEvidence(model: HomeContributionModel): readonly NormalizedHomeContribution[] {
  const seen = new Set<string>();
  return (['action', 'timeline', 'response', 'request', 'pulse'] as const)
    .flatMap((key) => model.buckets[key])
    .filter((item) => {
      if (seen.has(item.dedupeKey)) return false;
      seen.add(item.dedupeKey);
      return true;
    })
    .slice(0, 5);
}

const laneIcons = {
  timeline: CalendarClock,
  response: MessageSquareReply,
  request: Clock3,
} as const;

type MzGroundedWorkspaceProps = Readonly<{
  model: HomeContributionModel;
  apps: readonly HomeAppDefinition[];
  aiAvailable: boolean;
  runtimeState?: Extract<MzGroundingState, 'LOADING' | 'REFRESHING' | 'PARTIAL'>;
  onRetry: () => void;
  onLaunchApp: (app: HomeAppDefinition) => void;
  onOpenRoute: (route: string) => void;
}>;

export function MzGroundedWorkspace({
  model,
  apps,
  aiAvailable,
  runtimeState,
  onRetry,
  onLaunchApp,
  onOpenRoute,
}: MzGroundedWorkspaceProps) {
  const { t } = useTranslation('home');
  const state = resolveMzGroundingState(model, runtimeState);
  const busy = state === 'LOADING' || state === 'REFRESHING';
  const evidence = uniqueEvidence(model);
  const planItems = evidence.slice(0, 3);
  const relatedApps = apps
    .filter((app) => new Set(evidence.map((item) => item.owner.appKey)).has(app.resourceKey))
    .slice(0, 4);
  const fallbackApps = relatedApps.length > 0 ? relatedApps : apps.slice(0, 4);

  return (
    <Box
      component="section"
      aria-labelledby="mz-grounded-workspace-title"
      data-mz-grounded-workspace
      data-mz-grounding-state={state}
      data-mz-ai-availability={aiAvailable ? 'available' : 'unavailable'}
      aria-busy={busy ? 'true' : 'false'}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={1}
        mb={1.5}
      >
        <Box>
          <Typography
            id="mz-grounded-workspace-title"
            component="h2"
            variant="h6"
            fontWeight={foundationTokens.home.typography.weightHeavy}
          >
            {t('mz.workspace.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('mz.workspace.description')}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          color={state === 'READY' ? 'success' : state === 'EMPTY' ? 'default' : 'warning'}
          label={t(`mz.workspace.state.${state}`)}
        />
      </Stack>

      {state !== 'READY' && (
        <Alert
          severity={
            state === 'UNAVAILABLE' || state === 'RESTRICTED'
              ? 'error'
              : state === 'EMPTY'
                ? 'info'
                : 'warning'
          }
          sx={{ mb: 2 }}
          action={
            ['PARTIAL', 'STALE', 'UNAVAILABLE'].includes(state) ? (
              <ActionButton intent="quiet" size="small" onClick={onRetry}>
                {t('page.retry')}
              </ActionButton>
            ) : undefined
          }
        >
          {t(`mz.workspace.stateDescription.${state}`)}
        </Alert>
      )}
      {!aiAvailable && (
        <Alert severity="warning" sx={{ mb: 2 }} data-mz-ai-unavailable>
          {t('mz.workspace.aiUnavailable')}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.18fr) minmax(0, .82fr)' },
          gap: 2,
        }}
      >
        <Stack
          component="article"
          gap={1.25}
          sx={{
            p: { xs: 2, md: 2.5 },
            border: 1,
            borderColor: 'divider',
            borderRadius: 3,
            bgcolor: 'background.paper',
          }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <FileSearch
              size={19}
              color={foundationTokens.color.product.primary}
              aria-hidden="true"
            />
            <Typography variant="subtitle1" fontWeight={750}>
              {t('mz.workspace.evidence.title')}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('mz.workspace.evidence.description')}
          </Typography>
          {evidence.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('mz.workspace.evidence.empty')}
            </Typography>
          ) : (
            evidence.map((item) => (
              <Stack
                key={item.id}
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
                gap={1}
                data-mz-evidence-item
                sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}
              >
                <Box minWidth={0}>
                  <Typography variant="body2" fontWeight={650} sx={{ overflowWrap: 'anywhere' }}>
                    {item.title}
                  </Typography>
                  <Stack direction="row" gap={0.75} mt={0.5} flexWrap="wrap">
                    <Chip
                      size="small"
                      variant="outlined"
                      label={item.owner.appLabel ?? item.owner.source}
                    />
                    <Chip
                      size="small"
                      color={item.freshness.state === 'STALE' ? 'warning' : 'default'}
                      label={t(`mz.workspace.evidence.${item.freshness.state.toLowerCase()}`)}
                    />
                  </Stack>
                </Box>
                <ActionButton
                  intent="quiet"
                  size="small"
                  onClick={() => onOpenRoute(item.route)}
                  endIcon={<ArrowUpRight size={15} aria-hidden="true" />}
                >
                  {t('mz.workspace.openSource')}
                </ActionButton>
              </Stack>
            ))
          )}
        </Stack>

        <Stack
          component="article"
          gap={1.25}
          sx={{
            p: { xs: 2, md: 2.5 },
            border: 1,
            borderColor: 'divider',
            borderRadius: 3,
            bgcolor: 'background.paper',
          }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <ListChecks
              size={19}
              color={foundationTokens.color.product.primary}
              aria-hidden="true"
            />
            <Typography variant="subtitle1" fontWeight={750}>
              {t('mz.workspace.plan.title')}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('mz.workspace.plan.description')}
          </Typography>
          {planItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('mz.workspace.plan.empty')}
            </Typography>
          ) : (
            planItems.map((item, index) => (
              <Stack
                key={item.id}
                direction="row"
                gap={1}
                alignItems="flex-start"
                data-mz-plan-preview-step
                sx={{ p: 1.25, borderRadius: 2, bgcolor: 'action.hover' }}
              >
                <Chip size="small" color="primary" label={index + 1} />
                <Box minWidth={0}>
                  <Typography variant="body2" fontWeight={650}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.description ?? t('mz.workspace.plan.reviewEvidence')}
                  </Typography>
                </Box>
              </Stack>
            ))
          )}
          <Alert severity="info" icon={<CheckCircle2 size={18} />}>
            {t('mz.workspace.plan.reviewBoundary')}
          </Alert>
        </Stack>
      </Box>

      <Box
        data-mz-operational-lanes
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {(['timeline', 'response', 'request'] as const).map((key) => {
          const Icon = laneIcons[key];
          const item = model.buckets[key][0];
          return (
            <Stack
              key={key}
              component="article"
              gap={0.75}
              data-mz-lane={key}
              sx={{
                p: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Stack direction="row" alignItems="center" gap={0.75}>
                  <Icon size={18} aria-hidden="true" />
                  <Typography variant="subtitle2">{t(`mz.workspace.lanes.${key}`)}</Typography>
                </Stack>
                <Chip size="small" label={model.buckets[key].length} />
              </Stack>
              <Typography
                variant="body2"
                color={item ? 'text.primary' : 'text.secondary'}
                sx={{ overflowWrap: 'anywhere' }}
              >
                {item?.title ?? t('mz.workspace.lanes.empty')}
              </Typography>
            </Stack>
          );
        })}
      </Box>

      <Box
        component="section"
        aria-labelledby="mz-related-apps-title"
        data-mz-related-apps
        sx={{
          mt: 2,
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: 3,
          bgcolor: 'background.paper',
        }}
      >
        <Typography id="mz-related-apps-title" variant="subtitle1" fontWeight={750}>
          {t('mz.workspace.related.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('mz.workspace.related.description')}
        </Typography>
        <Stack direction="row" gap={1} mt={1.25} flexWrap="wrap">
          {fallbackApps.map((app) => (
            <ActionButton key={app.id} intent="quiet" onClick={() => onLaunchApp(app)}>
              {app.shortName ?? app.name}
            </ActionButton>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
