import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, EyeOff, Sparkles } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  ContentDialog,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { flowSourceLabel } from './flow-source-label';
import { selectFlowActionRecommendation } from './next-action-policy';

import type {
  HomeOverview,
  HomeRecommendation,
  HomeWidgetHeight,
  HomeWidgetSize,
} from '@dwp-frontend/shared-utils';

type NextActionsProps = {
  overview?: HomeOverview;
  items: readonly HomeRecommendation[];
  height: HomeWidgetHeight;
  size: HomeWidgetSize;
  loading: boolean;
  fetching: boolean;
  requestFailed: boolean;
  feedbackBusy: boolean;
  compact?: boolean;
  supportStack?: boolean;
  itemLimit?: number;
  onRetry: () => void;
  onRecommendationFeedback: (recommendation: HomeRecommendation) => void;
};

type NextActionCueProps = Readonly<{
  overview?: HomeOverview;
  feedbackBusy: boolean;
  onRecommendationFeedback: (recommendation: HomeRecommendation) => void;
}>;

const nextBudget: Record<HomeWidgetHeight, number> = {
  short: 1,
  standard: 2,
  tall: 3,
  expanded: 3,
};

const priorityTone: Record<HomeRecommendation['priority'], string> = {
  HIGH: 'error.main',
  MEDIUM: 'warning.main',
  LOW: 'info.main',
};

/**
 * Opens the evidence behind the ranked action queue without adding another
 * full-width card or shifting the purpose grid after overview hydration.
 */
export function NextActionCue({
  overview,
  feedbackBusy,
  onRecommendationFeedback,
}: NextActionCueProps) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const recommendation = selectFlowActionRecommendation(overview);
  if (!recommendation) return null;

  const generatedAtValue = overview?.recommendations.generatedAt;
  const sourceLabel = flowSourceLabel(recommendation.source, t);
  const generatedAt = generatedAtValue
    ? formatDate(generatedAtValue, { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <>
      <ActionButton
        data-home-recommendation-cue
        intent="quiet"
        size="small"
        startIcon={<Sparkles size={15} aria-hidden="true" />}
        aria-label={t('flow.next.recommendation')}
        aria-haspopup="dialog"
        aria-expanded={open || undefined}
        onClick={() => setOpen(true)}
        sx={{
          minWidth: { xs: 44, sm: 'auto' },
          minHeight: 44,
          px: { xs: 0.75, sm: 1 },
          whiteSpace: 'nowrap',
          color: 'primary.main',
          bgcolor: 'action.hover',
          borderRadius: 2,
          '&:hover': { bgcolor: 'action.selected' },
          '& .MuiButton-startIcon': {
            marginInlineStart: { xs: 0, sm: -0.5 },
            marginInlineEnd: { xs: 0, sm: 1 },
          },
          '@media (forced-colors: active)': {
            color: 'ButtonText',
            bgcolor: 'ButtonFace',
            border: '1px solid ButtonText',
          },
        }}
      >
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          {t('flow.next.recommendation')}
        </Box>
      </ActionButton>
      <ContentDialog
        open={open}
        title={recommendation.title}
        description={recommendation.description}
        closeLabel={t('actions.close', { ns: 'common' })}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        contentDividers
        contentSx={{ py: 2 }}
        footerContent={
          <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ width: 1 }}>
            <ActionButton
              intent="quiet"
              startIcon={<EyeOff size={16} aria-hidden="true" />}
              disabled={feedbackBusy}
              onClick={() => {
                setOpen(false);
                onRecommendationFeedback(recommendation);
              }}
            >
              {t('widgets.brief.notRelevant')}
            </ActionButton>
            <ActionButton
              intent="primary"
              endIcon={<ArrowRight size={15} aria-hidden="true" />}
              onClick={() => {
                setOpen(false);
                navigate(recommendation.actionPath);
              }}
            >
              {t('dayRail.review')}
            </ActionButton>
          </Stack>
        }
      >
        <Stack spacing={1.25}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Typography variant="caption" fontWeight={800} color="primary.main">
              {t('flow.next.recommendation')}
            </Typography>
            <Typography variant="caption" fontWeight={750} color="text.secondary">
              {t(`page.priority.${recommendation.priority.toLowerCase()}`)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {generatedAt
                ? t('flow.next.sourceUpdated', { source: sourceLabel, time: generatedAt })
                : sourceLabel}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {t('flow.next.evidenceShort', {
              count: recommendation.evidenceCount,
              confidence: t(
                `widgets.brief.confidenceLevel.${recommendation.confidence.toLowerCase()}`
              ),
            })}
          </Typography>
        </Stack>
      </ContentDialog>
    </>
  );
}

export function NextActions({
  overview,
  items,
  height,
  size,
  loading,
  fetching,
  requestFailed,
  feedbackBusy,
  compact = false,
  supportStack = false,
  itemLimit,
  onRetry,
  onRecommendationFeedback,
}: NextActionsProps) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const section = overview?.recommendations;
  const unavailable = requestFailed || section?.status === 'UNAVAILABLE';
  const forbidden = section?.status === 'FORBIDDEN';
  const visible = items.slice(
    0,
    Math.min(nextBudget[height], itemLimit ?? Number.MAX_SAFE_INTEGER)
  );
  const generatedAt = section?.generatedAt
    ? formatDate(section.generatedAt, { hour: '2-digit', minute: '2-digit' })
    : null;
  const sidecar = size === 'compact' || supportStack;
  // Height controls the number of recommendation rows, not the meaning of an
  // individual recommendation. When only one action is available, short and
  // standard must keep the same decision context instead of deleting its
  // reason and confidence while leaving unused space.
  const showDescription = true;
  const roomy = size === 'full' && !compact;
  const spotlight = !compact && !supportStack && visible.length === 1;
  const showEvidence = !compact && !sidecar && !spotlight;

  return (
    <Box
      component="section"
      aria-labelledby="next-actions-heading"
      data-flow-section="next-actions"
      data-flow-support-stack={supportStack ? 'true' : 'false'}
      data-next-actions-layout={spotlight ? 'spotlight' : 'list'}
      sx={{
        minWidth: 0,
        minHeight: 0,
        height: supportStack ? 'auto' : 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Sparkles size={19} aria-hidden="true" />
            <Typography id="next-actions-heading" component="h2" variant="h5" fontWeight={700}>
              {t('flow.next.title')}
            </Typography>
          </Stack>
          {!compact && !supportStack && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {t('flow.next.description')}
            </Typography>
          )}
        </Box>
        <ActionButton
          intent="quiet"
          size="small"
          endIcon={<ArrowRight size={15} aria-hidden="true" />}
          onClick={() => navigate('/work')}
          sx={{ minHeight: 44, flex: '0 0 auto' }}
        >
          {t('flow.viewAll')}
        </ActionButton>
      </Stack>

      {loading && <LoadingState label={t('widgets.brief.loading')} variant="skeleton" />}
      {!loading && unavailable && (
        <ErrorState
          title={t('dayRail.recommendationLoadError')}
          retryLabel={requestFailed ? undefined : t('page.retry')}
          onRetry={requestFailed ? undefined : onRetry}
          retrying={fetching}
          size="compact"
        />
      )}
      {!loading && !unavailable && forbidden && (
        <GuidedEmptyState
          kind="permission"
          title={t('widgets.common.restrictedTitle')}
          description={t('dayRail.restricted')}
          size="compact"
        />
      )}
      {!loading && !unavailable && !forbidden && visible.length === 0 && (
        <GuidedEmptyState
          kind="empty"
          title={t('flow.next.empty')}
          description={t('flow.next.description')}
          size="compact"
        />
      )}
      {!loading && !unavailable && !forbidden && visible.length > 0 && (
        <Box
          component="ol"
          sx={{
            p: 0,
            mt: 1.5,
            mb: 0,
            minHeight: 0,
            flex: spotlight ? '1 1 auto' : '0 0 auto',
            display: spotlight ? 'flex' : 'block',
            flexDirection: spotlight ? 'column' : undefined,
            listStyle: 'none',
            borderBlockStart: spotlight ? 0 : '1px solid',
            borderColor: 'divider',
          }}
        >
          {visible.map((recommendation) => (
            <Box
              component="li"
              key={recommendation.key}
              data-next-action-item
              sx={{
                minHeight: 0,
                flex: spotlight ? '1 1 auto' : undefined,
                px: spotlight ? 2 : 0,
                py: spotlight ? 2 : supportStack ? 1 : compact ? 1.25 : 1.4,
                display: 'grid',
                gridTemplateColumns: spotlight
                  ? {
                      xs: 'minmax(0, 1fr)',
                      md: 'minmax(0, 2fr) minmax(220px, 1fr) auto',
                    }
                  : roomy
                    ? 'minmax(0, 1fr) auto'
                    : sidecar
                      ? 'minmax(0, 1fr)'
                      : { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) auto' },
                alignItems: 'center',
                gap: 1.5,
                border: spotlight ? '1px solid' : 0,
                borderBlockEnd: spotlight ? undefined : '1px solid',
                borderColor: 'divider',
                borderRadius: spotlight ? 2 : 0,
                bgcolor: spotlight ? 'var(--home-surface-subtle)' : 'transparent',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor: priorityTone[recommendation.priority],
                      flex: '0 0 auto',
                    }}
                  />
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    {t(`page.priority.${recommendation.priority.toLowerCase()}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" aria-hidden="true">
                    ·
                  </Typography>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    {t(`flow.next.kind.${recommendation.kind.toLowerCase()}`)}
                  </Typography>
                  {!supportStack && (
                    <>
                      <Typography variant="caption" color="text.secondary" aria-hidden="true">
                        ·
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {flowSourceLabel(recommendation.source, t)}
                      </Typography>
                      {generatedAt && (
                        <Typography variant="caption" color="text.secondary">
                          {t('flow.next.updated', { time: generatedAt })}
                        </Typography>
                      )}
                    </>
                  )}
                </Stack>
                <Typography
                  component="h3"
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ mt: 0.35, overflowWrap: 'anywhere' }}
                >
                  {recommendation.title}
                </Typography>
                {showDescription && (
                  <Typography
                    data-next-action-description
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 0.2,
                      overflowWrap: 'anywhere',
                      display: '-webkit-box',
                      WebkitLineClamp: roomy ? 2 : 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {recommendation.description}
                  </Typography>
                )}
                {showEvidence && (
                  <Typography
                    data-next-action-evidence
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.45, display: 'block' }}
                  >
                    {t('flow.next.evidenceShort', {
                      count: recommendation.evidenceCount,
                      confidence: t(
                        `widgets.brief.confidenceLevel.${recommendation.confidence.toLowerCase()}`
                      ),
                    })}
                  </Typography>
                )}
              </Box>
              {spotlight && (
                <Box
                  data-next-action-evidence-panel
                  sx={{
                    minWidth: 0,
                    p: 1.25,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    bgcolor: 'var(--home-surface)',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={750}>
                    {t('flow.next.why')}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.35, overflowWrap: 'anywhere' }}>
                    {t('flow.next.evidence', {
                      source: flowSourceLabel(recommendation.source, t),
                      count: recommendation.evidenceCount,
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('flow.next.confidence', {
                      confidence: t(
                        `widgets.brief.confidenceLevel.${recommendation.confidence.toLowerCase()}`
                      ),
                    })}
                  </Typography>
                </Box>
              )}
              <Stack direction="row" alignItems="center" gap={0.5} sx={{ flex: '0 0 auto' }}>
                <ActionIconButton
                  label={t('widgets.brief.notRelevant')}
                  disabled={feedbackBusy}
                  onClick={() => onRecommendationFeedback(recommendation)}
                  sx={{ width: 44, height: 44 }}
                >
                  <EyeOff size={16} />
                </ActionIconButton>
                <ActionButton
                  intent="quiet"
                  endIcon={<ArrowRight size={15} aria-hidden="true" />}
                  onClick={() => navigate(recommendation.actionPath)}
                  sx={{ minHeight: 44 }}
                >
                  {t('dayRail.review')}
                </ActionButton>
              </Stack>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
