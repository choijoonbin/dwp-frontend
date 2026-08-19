import { useEffect, useState } from 'react';
import { keyframes } from '@emotion/react';
import {
  ArrowRight,
  BookOpenCheck,
  RotateCcw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';
import { recordDwaionFeedback } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { AskCitation, AskDwpResponse, AskProgressStage } from '@dwp-frontend/shared-utils';

export type DwaionPanelRequestState = 'idle' | 'loading' | 'ready' | 'error';

type DwaionPanelResultProps = {
  query: string;
  requestState: DwaionPanelRequestState;
  response: AskDwpResponse | null;
  progressStage: AskProgressStage | null;
  onRetry: () => void;
  onOpenWorkspace?: () => void;
  onSelectCitation: (citation: AskCitation) => void;
};

const responseReveal = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const thinkingPulse = keyframes`
  0%, 100% { opacity: 0.38; transform: scale(0.84); }
  50% { opacity: 1; transform: scale(1); }
`;

export function DwaionPanelResult({
  query,
  requestState,
  response,
  progressStage,
  onRetry,
  onOpenWorkspace,
  onSelectCitation,
}: DwaionPanelResultProps) {
  const { t } = useTranslation('home');
  const [feedback, setFeedback] = useState<'UP' | 'DOWN' | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);

  useEffect(() => {
    setFeedback(null);
    setFeedbackError(false);
  }, [response?.runId]);

  const submitFeedback = async (rating: 'UP' | 'DOWN') => {
    if (!response || feedback) return;
    setFeedbackError(false);
    try {
      await recordDwaionFeedback(response.runId, rating);
      setFeedback(rating);
    } catch {
      setFeedbackError(true);
    }
  };

  return (
    <Box component="section" aria-label={t('dwaion.conversationLabel')} sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Box
          sx={{
            maxWidth: '88%',
            px: 1.3,
            py: 0.9,
            borderRadius: '8px 8px 2px 8px',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {query}
          </Typography>
        </Box>
      </Box>

      {requestState === 'loading' && <ThinkingState progressStage={progressStage} />}

      {requestState === 'error' && (
        <Alert
          severity="error"
          variant="outlined"
          action={
            <ActionIconButton label={t('dwaion.retry')} size="small" onClick={onRetry}>
              <RotateCcw size={16} aria-hidden="true" />
            </ActionIconButton>
          }
          sx={{ mt: 1.25, alignItems: 'center' }}
        >
          <Typography variant="caption">{t('dwaion.error')}</Typography>
        </Alert>
      )}

      {requestState === 'ready' && response && (
        <Box
          data-testid="dwaion-answer"
          sx={{
            mt: 1.25,
            pl: 1.3,
            pr: 1,
            py: 1.15,
            borderLeft: 3,
            borderColor: response.state === 'COMPLETED' ? 'primary.main' : 'warning.main',
            bgcolor: 'action.hover',
            animation: `${responseReveal} 220ms ease-out both`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          {response.state === 'COMPLETED' && response.answer ? (
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.65,
                display: '-webkit-box',
                WebkitLineClamp: 7,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {response.answer}
            </Typography>
          ) : (
            <>
              <Typography variant="subtitle2" fontWeight={750}>
                {outcomeTitle(t, response)}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.35 }}
              >
                {outcomeDescription(t, response)}
              </Typography>
            </>
          )}

          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
            <Chip
              icon={<ShieldCheck size={13} aria-hidden="true" />}
              label={t(`dwaion.policy.${response.policy.outcome}`)}
              size="small"
              variant="outlined"
              color={response.policy.outcome === 'ALLOW' ? 'success' : 'warning'}
              sx={{ height: 23 }}
            />
            <Chip
              icon={<BookOpenCheck size={13} aria-hidden="true" />}
              label={t('dwaion.sources', { count: response.sourceCount })}
              size="small"
              variant="outlined"
              sx={{ height: 23 }}
            />
            {response.confidence && (
              <Typography variant="caption" color="text.secondary">
                {t('dwaion.confidence', {
                  level: t(`dwaion.confidenceLevels.${response.confidence}`),
                })}
              </Typography>
            )}
          </Stack>

          {response.citations.length > 0 && (
            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.85 }}>
              {response.citations.slice(0, 3).map((citation) => (
                <Chip
                  key={citation.sourceId}
                  label={`${citation.sourceId} · ${citation.title}`}
                  size="small"
                  variant="outlined"
                  clickable
                  onClick={() => onSelectCitation(citation)}
                  sx={{
                    maxWidth: '100%',
                    '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                  }}
                />
              ))}
            </Stack>
          )}

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mt: 0.65 }}
          >
            {onOpenWorkspace ? (
              <ActionButton
                intent="quiet"
                size="small"
                endIcon={<ArrowRight size={14} aria-hidden="true" />}
                onClick={onOpenWorkspace}
                sx={{ px: 0 }}
              >
                {t('dwaion.viewWorkspace')}
              </ActionButton>
            ) : (
              <span />
            )}
            <Stack direction="row" alignItems="center" spacing={0.25}>
              <ActionIconButton
                label={t('dwaion.feedback.helpful')}
                size="small"
                intent={feedback === 'UP' ? 'primary' : 'default'}
                disabled={Boolean(feedback)}
                onClick={() => void submitFeedback('UP')}
              >
                <ThumbsUp size={15} aria-hidden="true" />
              </ActionIconButton>
              <ActionIconButton
                label={t('dwaion.feedback.notHelpful')}
                size="small"
                intent={feedback === 'DOWN' ? 'primary' : 'default'}
                disabled={Boolean(feedback)}
                onClick={() => void submitFeedback('DOWN')}
              >
                <ThumbsDown size={15} aria-hidden="true" />
              </ActionIconButton>
            </Stack>
          </Stack>
          <Typography
            variant="caption"
            color={feedbackError ? 'error.main' : 'text.secondary'}
            aria-live="polite"
          >
            {feedbackError
              ? t('dwaion.feedback.error')
              : feedback
                ? t('dwaion.feedback.recorded')
                : ''}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function ThinkingState({ progressStage }: { progressStage: AskProgressStage | null }) {
  const { t } = useTranslation('home');
  return (
    <Stack
      role="status"
      aria-live="polite"
      direction="row"
      alignItems="center"
      gap={1}
      sx={{ mt: 1.25, px: 1.25, py: 1.1, bgcolor: 'action.hover' }}
    >
      <Stack direction="row" gap={0.35} aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <Box
            key={index}
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              animation: `${thinkingPulse} 900ms ${index * 120}ms ease-in-out infinite`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.7 },
            }}
          />
        ))}
      </Stack>
      <Box minWidth={0}>
        <Typography variant="caption" fontWeight={700}>
          {progressStage ? t(`dwaion.progress.${progressStage}`) : t('dwaion.thinking.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {t('dwaion.thinking.description')}
        </Typography>
      </Box>
    </Stack>
  );
}

function outcomeTitle(
  t: ReturnType<typeof useTranslation<'home'>>['t'],
  response: AskDwpResponse
): string {
  if (response.state === 'CONFIGURATION_REQUIRED') return t('dwaion.outcomes.configurationTitle');
  if (response.policy.outcome === 'DENY') return t('dwaion.outcomes.deniedTitle');
  if (response.policy.outcome === 'HANDOFF') return t('dwaion.outcomes.handoffTitle');
  return t('dwaion.outcomes.insufficientTitle');
}

function outcomeDescription(
  t: ReturnType<typeof useTranslation<'home'>>['t'],
  response: AskDwpResponse
): string {
  const keyByCode: Record<string, string> = {
    AGENT_REGISTRY_CONFIGURATION_REQUIRED: 'agentRegistryConfiguration',
    CONTEXT_BROKER_CONFIGURATION_REQUIRED: 'contextConfiguration',
    MODEL_ROUTE_CONFIGURATION_REQUIRED: 'modelConfiguration',
    ASK_PERMISSION_REQUIRED: 'permissionRequired',
    PRIVILEGED_DATA_HANDOFF: 'privilegedHandoff',
    MUTATION_REQUIRES_GOVERNED_WORKFLOW: 'mutationHandoff',
    NO_GROUNDED_SOURCE: 'noSource',
    CONTEXT_SOURCE_UNAVAILABLE: 'sourceUnavailable',
    EVIDENCE_INSUFFICIENT: 'evidenceInsufficient',
    MODEL_REFUSED: 'modelRefused',
  };
  const key = keyByCode[response.statusCode] ?? 'safeFallback';
  return t(`dwaion.outcomes.${key}`);
}
