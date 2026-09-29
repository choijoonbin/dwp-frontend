import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, EyeOff, Sparkles } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { ActionButton, ContentDialog } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { flowSourceLabel } from './flow-source-label';
import { selectFlowActionRecommendation } from './next-action-policy';

import type { HomeOverview, HomeRecommendation } from '@dwp-frontend/shared-utils';

type NextActionCueProps = Readonly<{
  overview?: HomeOverview;
  feedbackBusy: boolean;
  onRecommendationFeedback?: (recommendation: HomeRecommendation) => void;
}>;

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
            {onRecommendationFeedback && (
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
            )}
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
