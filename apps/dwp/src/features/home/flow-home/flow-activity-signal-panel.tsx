import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { ActionButton, ContentDialog, LocalErrorState } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { formatDate } from '@dwp-frontend/shared-i18n';
import type { WorkspaceActivityExecutionSummary } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha } from '@mui/material/styles';

import {
  FLOW_ACTIVITY_STATES,
  flowActivityHistoryRoute,
  validFlowActivitySummary,
} from './flow-activity-signal-model';
import type { FlowSignal } from './flow-home-model';

const CONTROL_RADIUS = `${foundationTokens.radius.control}px`;
const SURFACE_RADIUS = `${foundationTokens.radius.surface}px`;

export function FlowActivityDistribution({
  summary,
  compact = false,
}: {
  summary: WorkspaceActivityExecutionSummary;
  compact?: boolean;
}) {
  const { t } = useTranslation('home');
  if (!validFlowActivitySummary(summary) || summary.total === 0) return null;
  const description = FLOW_ACTIVITY_STATES.map(
    ([state, key]) => `${t(`flow.signals.execution.states.${state}`)} ${summary[key] ?? 0}`
  ).join(' · ');
  return (
    <Box
      data-testid={compact ? 'flow-activity-mini-distribution' : 'flow-activity-distribution'}
      role="img"
      aria-label={description}
      title={description}
      sx={{
        display: 'flex',
        width: 1,
        height: compact ? 6 : 7,
        overflow: 'hidden',
        borderRadius: compact ? CONTROL_RADIUS : 0,
        bgcolor: 'action.hover',
      }}
    >
      {FLOW_ACTIVITY_STATES.map(([state, key, tone]) => (
        <Box
          key={state}
          data-activity-state={state}
          data-activity-count={summary[key] ?? 0}
          aria-hidden="true"
          sx={{
            width: `${((summary[key] ?? 0) / summary.total) * 100}%`,
            bgcolor: `${tone}.main`,
            '@media (forced-colors: active)': {
              bgcolor: 'CanvasText',
              borderInlineEnd: '1px solid Canvas',
            },
          }}
        />
      ))}
    </Box>
  );
}

export function FlowActivitySignalPanel({
  open,
  signal,
  fetching = false,
  failed = false,
  onClose,
  onRefresh,
}: {
  open: boolean;
  signal?: FlowSignal;
  fetching?: boolean;
  failed?: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation('home');
  const mobile = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const summary = signal?.activityExecutionSummary;
  const valid = !failed && summary && validFlowActivitySummary(summary) ? summary : undefined;
  const attention = valid ? valid.needsInput + valid.policyBlocked : undefined;
  const stale = valid ? Date.now() - Date.parse(valid.generatedAt) > 5 * 60_000 : true;
  const hasUnknown = Boolean(valid?.unknown);
  const allClear = attention === 0 && !hasUnknown && valid?.failed === 0 && !stale;

  return (
    <ContentDialog
      open={open}
      title={t('flow.signals.execution.title')}
      description={t('flow.signals.execution.scope')}
      closeLabel={t('flow.signals.execution.close')}
      onClose={onClose}
      fullScreen={mobile}
      maxWidth="lg"
      titleStart={<Activity size={22} aria-hidden="true" />}
      contentDividers
      contentSx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: 'background.default' }}
    >
      {!valid ? (
        <LocalErrorState
          title={t('flow.signals.loadError')}
          retryLabel={t('page.retry')}
          onRetry={onRefresh}
          size="compact"
        />
      ) : (
        <Box
          data-testid="flow-activity-signal-panel"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(0, 1fr) minmax(230px, 0.44fr)',
            },
            gap: 2,
          }}
        >
          <Box
            sx={{
              minWidth: 0,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: SURFACE_RADIUS,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="overline" color="primary.main">
                {t('flow.signals.execution.snapshot')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('flow.signals.execution.definition')}
              </Typography>
              <Box
                sx={(theme) => ({
                  mt: 2,
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  borderRadius: SURFACE_RADIUS,
                  bgcolor: alpha(
                    attention ? theme.palette.error.main : theme.palette.success.main,
                    0.07
                  ),
                  border: '1px solid',
                  borderColor: alpha(
                    attention ? theme.palette.error.main : theme.palette.success.main,
                    0.16
                  ),
                  '@media (forced-colors: active)': { borderColor: 'CanvasText' },
                })}
              >
                <Box>
                  <Typography variant="subtitle2">
                    {t('flow.signals.execution.attention')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('flow.signals.activityBreakdown', {
                      needsInput: valid.needsInput,
                      policyBlocked: valid.policyBlocked,
                    })}
                  </Typography>
                </Box>
                <Typography
                  component="p"
                  variant="h1"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {attention}
                  <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                    {t('flow.signals.unit.items')}
                  </Typography>
                </Typography>
              </Box>
              <Box
                component="dl"
                aria-label={t('flow.signals.execution.distribution')}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(3,minmax(0,1fr))',
                    sm: 'repeat(4,minmax(0,1fr))',
                  },
                  gap: 0.75,
                  m: 0,
                  mt: 2,
                }}
              >
                <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: CONTROL_RADIUS }}>
                  <Typography component="dt" variant="caption">
                    {t('flow.signals.execution.total')}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="h6"
                    sx={{ m: 0, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {valid.total}
                  </Typography>
                </Box>
                {FLOW_ACTIVITY_STATES.map(([state, key, tone]) => (
                  <Box
                    key={state}
                    sx={(theme) => ({
                      p: 1.25,
                      minWidth: 0,
                      bgcolor: alpha(theme.palette[tone].main, 0.065),
                      borderRadius: CONTROL_RADIUS,
                    })}
                  >
                    <Typography component="dt" variant="caption">
                      {t(`flow.signals.execution.states.${state}`)}
                    </Typography>
                    <Typography
                      component="dd"
                      variant="h6"
                      sx={{ m: 0, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {valid[key] ?? 0}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <FlowActivityDistribution summary={valid} />
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack direction="row" alignItems="center" gap={0.75}>
                <CircleAlert size={17} aria-hidden="true" />
                <Typography component="h3" variant="subtitle2">
                  {t('flow.signals.execution.reviewTitle')}
                </Typography>
              </Stack>
              <Stack gap={1} sx={{ mt: 1.5 }}>
                {(['needs-input', 'policy-blocked'] as const).map((state) => {
                  const blocked = state === 'policy-blocked';
                  const Icon = blocked ? ShieldX : CircleAlert;
                  const count = blocked ? valid.policyBlocked : valid.needsInput;
                  return (
                    <Box
                      key={state}
                      sx={(theme) => ({
                        p: 1.5,
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 1.25,
                        borderRadius: SURFACE_RADIUS,
                        bgcolor: alpha(
                          blocked ? theme.palette.error.main : theme.palette.warning.main,
                          0.065
                        ),
                      })}
                    >
                      <Icon size={19} aria-hidden="true" />
                      <Box sx={{ minWidth: 0, flex: '1 1 140px' }}>
                        <Typography variant="body2" fontWeight="fontWeightBold">
                          {t(`flow.signals.execution.states.${state}`)} ·{' '}
                          {t('flow.signals.execution.count', { count })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t(`flow.signals.execution.review.${state}`)}
                        </Typography>
                      </Box>
                      <ActionButton
                        component={Link}
                        to={flowActivityHistoryRoute(state)}
                        intent="secondary"
                        size="small"
                        endIcon={<ArrowUpRight size={14} aria-hidden="true" />}
                        sx={{ minHeight: { xs: 44, sm: 38 } }}
                      >
                        {t('flow.signals.execution.viewHistory')}
                      </ActionButton>
                    </Box>
                  );
                })}
              </Stack>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
                {t('flow.signals.execution.historyNotice')}
              </Typography>
            </Box>
          </Box>
          <Stack gap={2} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                bgcolor: 'background.paper',
                p: 2.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: SURFACE_RADIUS,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: fetching ? 'info.main' : stale ? 'warning.main' : 'success.main',
                  }}
                />
                <Typography variant="caption" fontWeight="fontWeightBold">
                  {t(
                    `flow.signals.execution.freshness.${fetching ? 'refreshing' : stale ? 'stale' : 'current'}`
                  )}
                </Typography>
              </Box>
              <Box sx={{ mt: 3, mb: 2, color: allClear ? 'success.main' : 'warning.main' }}>
                {allClear ? (
                  <CheckCircle2 size={36} aria-hidden="true" />
                ) : (
                  <CircleAlert size={36} aria-hidden="true" />
                )}
              </Box>
              <Typography component="h3" variant="h6">
                {t(
                  `flow.signals.execution.${allClear ? 'clearTitle' : hasUnknown ? 'unknownTitle' : stale ? 'staleTitle' : 'attentionTitle'}`
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {t(
                  `flow.signals.execution.${allClear ? 'clearDescription' : 'attentionDescription'}`
                )}
              </Typography>
              <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 2 }}>
                {t('flow.signals.execution.observed', {
                  at: formatDate(valid.generatedAt, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </Typography>
              {onRefresh && (
                <ActionButton
                  intent="secondary"
                  size="small"
                  disabled={fetching}
                  onClick={onRefresh}
                  sx={{ mt: 1.5, minHeight: { xs: 44, sm: 38 } }}
                >
                  {t('page.retry')}
                </ActionButton>
              )}
            </Box>
            <Box sx={{ p: 2.5, bgcolor: 'action.hover', borderRadius: SURFACE_RADIUS }}>
              <Stack direction="row" alignItems="center" gap={0.75}>
                <ShieldCheck size={17} aria-hidden="true" />
                <Typography component="h3" variant="subtitle2">
                  {t('flow.signals.execution.scopeTitle')}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('flow.signals.execution.scopeDescription')}
              </Typography>
              <Typography
                variant="caption"
                component="p"
                sx={{ mt: 1.5, overflowWrap: 'anywhere' }}
              >
                {t('flow.signals.execution.coverage', {
                  types:
                    valid.coverage?.supportedObjectTypes?.join(' · ') ||
                    t('flow.signals.execution.noCoverage'),
                })}
              </Typography>
              <ActionButton
                component={Link}
                to={flowActivityHistoryRoute()}
                intent="quiet"
                size="small"
                endIcon={<ArrowUpRight size={14} aria-hidden="true" />}
                sx={{ mt: 1.5, minHeight: { xs: 44, sm: 38 } }}
              >
                {t('flow.signals.execution.openTimeline')}
              </ActionButton>
            </Box>
          </Stack>
        </Box>
      )}
    </ContentDialog>
  );
}
