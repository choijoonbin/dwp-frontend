import { useEffect, useState } from 'react';
import { keyframes } from '@emotion/react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Check,
  Copy,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';
import { recordDwaionFeedback, useToast } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { TFunction } from 'i18next';
import type { AskDwpResponse, AskProgressStage } from '@dwp-frontend/shared-utils';
import type { DwaionWorkspaceState } from './dwaion-workspace-model';

import { responseTone } from './dwaion-workspace-model';
import { DwaionSpeechButton } from '../../components/dwaion-assistant/dwaion-voice-controls';

type DwaionWorkspaceAnswerProps = {
  question: string;
  state: DwaionWorkspaceState;
  response: AskDwpResponse | null;
  progressStage: AskProgressStage | null;
  onCancel: () => void;
  onRetry: () => void;
  onReset: () => void;
};

const reveal = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.35; transform: scale(0.86); }
  50% { opacity: 1; transform: scale(1); }
`;

export function DwaionWorkspaceAnswer({
  question,
  state,
  response,
  progressStage,
  onCancel,
  onRetry,
  onReset,
}: DwaionWorkspaceAnswerProps) {
  const { t, i18n } = useTranslation('work');
  const toast = useToast();
  const [feedback, setFeedback] = useState<'UP' | 'DOWN' | null>(null);

  useEffect(() => setFeedback(null), [response?.runId]);

  const copyAnswer = async () => {
    if (!response?.answer) return;
    try {
      await navigator.clipboard.writeText(response.answer);
      toast.success(t('askPage.actions.copied'));
    } catch {
      toast.error(t('askPage.actions.copyFailed'));
    }
  };

  const submitFeedback = async (rating: 'UP' | 'DOWN') => {
    if (!response || feedback) return;
    try {
      await recordDwaionFeedback(response.runId, rating);
      setFeedback(rating);
      toast.success(t('askPage.feedback.recorded'));
    } catch {
      toast.error(t('askPage.feedback.error'));
    }
  };

  return (
    <Box data-testid="dwaion-workspace-result">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          pb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {t('askPage.yourQuestion')}
          </Typography>
          <Typography component="h2" variant="h6" sx={{ mt: 0.4, lineHeight: 1.45 }}>
            {question}
          </Typography>
        </Box>
        <ActionButton
          size="small"
          intent="quiet"
          startIcon={<Plus size={15} aria-hidden="true" />}
          onClick={onReset}
          sx={{ flex: '0 0 auto' }}
        >
          {t('askPage.actions.newQuestion')}
        </ActionButton>
      </Box>

      {state === 'loading' && <LoadingAnswer progressStage={progressStage} onCancel={onCancel} />}

      {state === 'error' && (
        <Alert
          severity="error"
          variant="outlined"
          action={
            <ActionButton size="small" intent="quiet" onClick={onRetry}>
              {t('askPage.retry')}
            </ActionButton>
          }
          sx={{ mt: 3 }}
        >
          <Typography component="p" variant="subtitle2">
            {t('askPage.runtimeErrorTitle')}
          </Typography>
          <Typography component="p" variant="body2" sx={{ mt: 0.25 }}>
            {t('askPage.runtimeErrorDescription')}
          </Typography>
        </Alert>
      )}

      {state === 'ready' && response && (
        <Box
          sx={{
            mt: 3,
            animation: `${reveal} 260ms ease-out`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1,
                  bgcolor: 'primary.lighter',
                  color: 'primary.main',
                }}
              >
                <Sparkles size={18} aria-hidden="true" />
              </Box>
              <Box>
                <Typography component="h2" variant="subtitle1" fontWeight={800}>
                  {t('askPage.answerHeading')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('askPage.answerDescription')}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Chip
                size="small"
                color={responseTone(response)}
                variant="outlined"
                label={t(`askPage.states.${response.state}`)}
              />
              {response.answer && (
                <DwaionSpeechButton
                  text={response.answer}
                  locale={i18n.resolvedLanguage || i18n.language || 'en'}
                  namespace="work"
                />
              )}
              {response.answer && (
                <ActionIconButton
                  label={t('askPage.actions.copy')}
                  tooltip={t('askPage.actions.copy')}
                  size="small"
                  onClick={() => void copyAnswer()}
                >
                  <Copy size={16} aria-hidden="true" />
                </ActionIconButton>
              )}
              {response.answer && (
                <>
                  <ActionIconButton
                    label={t('askPage.feedback.helpful')}
                    tooltip={t('askPage.feedback.helpful')}
                    size="small"
                    intent={feedback === 'UP' ? 'primary' : 'default'}
                    disabled={Boolean(feedback)}
                    onClick={() => void submitFeedback('UP')}
                  >
                    <ThumbsUp size={16} aria-hidden="true" />
                  </ActionIconButton>
                  <ActionIconButton
                    label={t('askPage.feedback.notHelpful')}
                    tooltip={t('askPage.feedback.notHelpful')}
                    size="small"
                    intent={feedback === 'DOWN' ? 'primary' : 'default'}
                    disabled={Boolean(feedback)}
                    onClick={() => void submitFeedback('DOWN')}
                  >
                    <ThumbsDown size={16} aria-hidden="true" />
                  </ActionIconButton>
                </>
              )}
              <ActionIconButton
                label={t('askPage.actions.retry')}
                tooltip={t('askPage.actions.retry')}
                size="small"
                onClick={onRetry}
              >
                <RotateCcw size={16} aria-hidden="true" />
              </ActionIconButton>
            </Stack>
          </Stack>

          <Divider sx={{ mt: 1.75 }} />

          {response.state === 'COMPLETED' && response.answer ? (
            <Box
              data-testid="dwaion-workspace-answer"
              sx={{
                mt: 2.5,
                position: 'relative',
                pl: { xs: 2, sm: 2.5 },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 3,
                  bottom: 3,
                  width: 3,
                  bgcolor: 'primary.main',
                  borderRadius: 1,
                },
              }}
            >
              <Typography
                component="div"
                variant="body1"
                sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 15.5 }}
              >
                {response.answer}
              </Typography>
            </Box>
          ) : (
            <Alert
              severity={response.state === 'CONFIGURATION_REQUIRED' ? 'info' : 'warning'}
              icon={
                response.state === 'CONFIGURATION_REQUIRED' ? (
                  <Bot size={20} />
                ) : (
                  <ShieldCheck size={20} />
                )
              }
              variant="outlined"
              sx={{ mt: 2.5 }}
            >
              <Typography component="p" variant="subtitle2">
                {outcomeTitle(t, response)}
              </Typography>
              <Typography component="p" variant="body2" sx={{ mt: 0.4 }}>
                {outcomeDescription(t, response)}
              </Typography>
            </Alert>
          )}

          <Box
            sx={{
              mt: 3,
              pt: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
            }}
          >
            <Check size={15} color="#188464" aria-hidden="true" />
            <Typography variant="caption" color="text.secondary">
              {t('askPage.independentRun')}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function LoadingAnswer({
  progressStage,
  onCancel,
}: {
  progressStage: AskProgressStage | null;
  onCancel: () => void;
}) {
  const { t } = useTranslation('work');
  const steps = ['permission', 'sources', 'answer'] as const;
  return (
    <Box role="status" aria-live="polite" sx={{ mt: 3, py: 2 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <CircularProgress size={22} />
        <Box>
          <Typography component="p" variant="subtitle2" fontWeight={800}>
            {progressStage
              ? t(`askPage.progress.${progressStage}`)
              : t('askPage.runtimeLoadingTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('askPage.runtimeLoadingDescription')}
          </Typography>
        </Box>
      </Stack>
      <Box
        sx={{
          mt: 2.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        {steps.map((step, index) => (
          <Box
            key={step}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1.25,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                animation: `${pulse} 1.5s ease-in-out ${index * 180}ms infinite`,
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}
            />
            <Typography variant="caption" fontWeight={700}>
              {t(`askPage.loadingSteps.${step}`)}
            </Typography>
          </Box>
        ))}
      </Box>
      <ActionButton intent="quiet" size="small" onClick={onCancel} sx={{ mt: 1.5 }}>
        {t('askPage.composer.cancel')}
      </ActionButton>
    </Box>
  );
}

function outcomeTitle(t: TFunction<'work'>, response: AskDwpResponse): string {
  if (response.state === 'CONFIGURATION_REQUIRED') return t('askPage.outcomes.configurationTitle');
  if (response.policy.outcome === 'DENY') return t('askPage.outcomes.deniedTitle');
  if (response.policy.outcome === 'HANDOFF') return t('askPage.outcomes.handoffTitle');
  return t('askPage.outcomes.insufficientTitle');
}

function outcomeDescription(t: TFunction<'work'>, response: AskDwpResponse): string {
  const descriptions: Record<string, string> = {
    AGENT_REGISTRY_CONFIGURATION_REQUIRED: t('askPage.outcomes.agentRegistryConfiguration'),
    CONTEXT_BROKER_CONFIGURATION_REQUIRED: t('askPage.outcomes.contextConfiguration'),
    MODEL_ROUTE_CONFIGURATION_REQUIRED: t('askPage.outcomes.modelConfiguration'),
    ASK_PERMISSION_REQUIRED: t('askPage.outcomes.permissionRequired'),
    PROMPT_INJECTION_BLOCKED: t('askPage.outcomes.promptInjectionBlocked'),
    PRIVILEGED_DATA_HANDOFF: t('askPage.outcomes.privilegedHandoff'),
    MUTATION_REQUIRES_GOVERNED_WORKFLOW: t('askPage.outcomes.mutationHandoff'),
    NO_GROUNDED_SOURCE: t('askPage.outcomes.noSource'),
    CONTEXT_SOURCE_UNAVAILABLE: t('askPage.outcomes.sourceUnavailable'),
    EVIDENCE_INSUFFICIENT: t('askPage.outcomes.evidenceInsufficient'),
    MODEL_REFUSED: t('askPage.outcomes.modelRefused'),
  };
  return descriptions[response.statusCode] ?? t('askPage.outcomes.safeFallback');
}
