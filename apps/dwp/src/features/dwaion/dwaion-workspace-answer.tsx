import { useEffect, useRef, useState } from 'react';
import { keyframes } from '@emotion/react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  BookOpenCheck,
  Check,
  Clock3,
  Copy,
  Database,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  foundationTokens,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import { recordDwaionFeedback, useToast } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';

import type { TFunction } from 'i18next';
import type { AskDwpResponse, AskProgressStage } from '@dwp-frontend/shared-utils';
import type { DwaionWorkspaceState } from './dwaion-workspace-model';

import { isGroundedFallbackResponse, responseTone } from './dwaion-workspace-model';
import { DwaionSpeechButton } from '../../components/dwaion-assistant/dwaion-voice-controls';
import { DwaionArtifactAnswerAction } from './dwaion-artifact-answer-action';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';
import { DwaionStructuredAnswerBody } from './dwaion-workspace-answer-body';

type DwaionWorkspaceAnswerProps = {
  question: string;
  authorName?: string;
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
  authorName,
  state,
  response,
  progressStage,
  onCancel,
  onRetry,
  onReset,
}: DwaionWorkspaceAnswerProps) {
  const { t, i18n } = useTranslation('work');
  const toast = useToast();
  const governFeedback = useDwaionGovernedMutation('route.dwaion.work.feedback.action');
  const [feedback, setFeedback] = useState<'UP' | 'DOWN' | null>(null);
  const [answerAnnouncement, setAnswerAnnouncement] = useState('');
  const announcedResponse = useRef<string | null>(null);
  const groundedFallback = response ? isGroundedFallbackResponse(response) : false;
  const compact = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));
  const authorLabel = authorName?.trim() || t('askPage.history.you');
  const authorInitials = authorLabel.replace(/\s+/g, '').slice(0, 2).toUpperCase();

  const announcement =
    state === 'ready' && response
      ? response.state === 'COMPLETED' && response.answer
        ? `${t(
            groundedFallback ? 'askPage.fallback.answerHeading' : 'askPage.answerHeading'
          )}. ${response.answer}`
        : `${outcomeTitle(t, response)}. ${outcomeDescription(t, response)}`
      : '';

  useEffect(() => setFeedback(null), [response?.runId]);

  useEffect(() => {
    if (state !== 'ready' || !response || !announcement) {
      announcedResponse.current = null;
      setAnswerAnnouncement('');
      return undefined;
    }
    const announcementKey = `${response.runId}:${response.state}`;
    if (announcedResponse.current === announcementKey) return undefined;
    announcedResponse.current = announcementKey;
    setAnswerAnnouncement('');
    const timer = globalThis.setTimeout(() => setAnswerAnnouncement(announcement), 0);
    return () => globalThis.clearTimeout(timer);
  }, [announcement, response, state]);

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
      await governFeedback((authority) =>
        recordDwaionFeedback(response.runId, rating, [], undefined, authority)
      );
      setFeedback(rating);
      toast.success(t('askPage.feedback.recorded'));
    } catch {
      toast.error(t('askPage.feedback.error'));
    }
  };

  if (compact) {
    return (
      <Box data-testid="dwaion-workspace-result" sx={{ minWidth: 0 }}>
        <MobileQuestion
          question={question}
          authorName={authorName}
          onReset={onReset}
          showReset={!response?.conversationId}
        />

        {state === 'loading' && <LoadingAnswer progressStage={progressStage} onCancel={onCancel} />}

        {state === 'error' && (
          <InlineFeedback severity="error" title={t('askPage.runtimeErrorTitle')} sx={{ mt: 2 }}>
            <Stack spacing={1} alignItems="flex-start">
              <Typography component="p" variant="body2">
                {t('askPage.runtimeErrorDescription')}
              </Typography>
              <ActionButton size="small" intent="quiet" onClick={onRetry} sx={{ minHeight: 44 }}>
                {t('askPage.retry')}
              </ActionButton>
            </Stack>
          </InlineFeedback>
        )}

        {state === 'ready' && response && (
          <MobileReadyAnswer
            question={question}
            response={response}
            groundedFallback={groundedFallback}
            feedback={feedback}
            locale={i18n.resolvedLanguage || i18n.language || 'en'}
            onCopy={() => void copyAnswer()}
            onRetry={onRetry}
            onFeedback={(rating) => void submitFeedback(rating)}
          />
        )}

        <Box
          data-testid="dwaion-answer-announcement"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          sx={visuallyHidden}
        >
          {answerAnnouncement}
        </Box>
      </Box>
    );
  }

  return (
    <Box data-testid="dwaion-workspace-result" sx={{ minWidth: 0 }}>
      <Box
        sx={{
          p: { xs: 1.75, sm: 2 },
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          border: 1,
          borderColor: { xs: 'primary.main', sm: 'divider' },
          borderRadius: foundationTokens.radius.surface + 'px',
          bgcolor: { xs: 'primary.main', sm: 'background.paper' },
          color: { xs: 'primary.contrastText', sm: 'text.primary' },
          boxShadow: (theme) => theme.shadows[1],
        }}
      >
        <Stack direction="row" gap={1.25} sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              bgcolor: { xs: 'primary.contrastText', sm: 'primary.main' },
              color: { xs: 'primary.main', sm: 'primary.contrastText' },
              fontWeight: 'fontWeightBold',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {authorInitials}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              fontWeight="fontWeightBold"
              sx={{ color: { xs: 'inherit', sm: 'text.secondary' }, opacity: { xs: 0.82, sm: 1 } }}
            >
              {authorLabel} · {t('askPage.yourQuestion')}
            </Typography>
            <Typography component="h2" variant="h6" sx={{ mt: 0.35, lineHeight: 'h6.lineHeight' }}>
              {question}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {state === 'loading' && <LoadingAnswer progressStage={progressStage} onCancel={onCancel} />}

      {state === 'error' && (
        <InlineFeedback severity="error" title={t('askPage.runtimeErrorTitle')} sx={{ mt: 3 }}>
          <Stack spacing={1} alignItems="flex-start">
            <Typography component="p" variant="body2">
              {t('askPage.runtimeErrorDescription')}
            </Typography>
            <ActionButton size="small" intent="quiet" onClick={onRetry} sx={{ minHeight: 44 }}>
              {t('askPage.retry')}
            </ActionButton>
          </Stack>
        </InlineFeedback>
      )}

      {state === 'ready' && response && (
        <Box
          sx={{
            mt: 2,
            animation: (theme) =>
              `${reveal} ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeOut}`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          <Box
            component="section"
            tabIndex={0}
            aria-label={t('askPage.responseStatus')}
            sx={{
              display: { xs: 'flex', md: 'grid' },
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
              overflowX: { xs: 'auto', md: 'hidden' },
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2,
              },
              border: 1,
              borderColor: 'divider',
              borderRadius: foundationTokens.radius.surface + 'px',
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            <ResultSignal
              icon={ShieldCheck}
              label={t('askPage.status.permission.label')}
              value={t(`askPage.policyOutcomes.${response.policy.outcome}`)}
            />
            <ResultSignal
              icon={Database}
              label={t('askPage.resultBrief.evidence')}
              value={t('askPage.contextRail.sourceCount', { count: response.sourceCount })}
            />
            <ResultSignal
              icon={Bot}
              label={t('askPage.resultBrief.model')}
              value={t(`askPage.modelStates.${response.modelRoute.state}`)}
            />
            <ResultSignal
              icon={Clock3}
              label={t('askPage.resultBrief.processing')}
              value={
                response.modelRoute.latencyMs > 0
                  ? t('askPage.resultBrief.latency', { count: response.modelRoute.latencyMs })
                  : t('askPage.evidence.notApplicable')
              }
            />
          </Box>

          <Box
            sx={{
              mt: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: foundationTokens.radius.surface + 'px',
              bgcolor: 'background.paper',
              overflow: 'hidden',
              boxShadow: 'none',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'flex-start' }}
              justifyContent="space-between"
              sx={{
                p: { xs: 1.75, sm: 2 },
                bgcolor: 'var(--dwp-product-soft)',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: foundationTokens.radius.surface + 'px',
                    bgcolor: 'primary.lighter',
                    color: 'primary.main',
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={20} aria-hidden="true" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
                    {t(
                      groundedFallback ? 'askPage.fallback.answerHeading' : 'askPage.answerHeading'
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                    {t(
                      groundedFallback
                        ? 'askPage.fallback.answerDescription'
                        : 'askPage.answerDescription'
                    )}
                  </Typography>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                    <Chip
                      size="small"
                      color={responseTone(response)}
                      label={
                        groundedFallback
                          ? t('askPage.fallback.state')
                          : t(`askPage.states.${response.state}`)
                      }
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(
                        `askPage.contextRail.confidence.${response.confidence ?? 'NOT_AVAILABLE'}`
                      )}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t('askPage.sourcesHeading', { count: response.citations.length })}
                    />
                  </Stack>
                </Box>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                {response.answer && (
                  <DwaionSpeechButton
                    text={response.answer}
                    locale={i18n.resolvedLanguage || i18n.language || 'en'}
                    namespace="work"
                  />
                )}
                <DwaionArtifactAnswerAction question={question} response={response} />
                {response.answer && (
                  <ActionIconButton
                    label={t('askPage.actions.copy')}
                    tooltip={t('askPage.actions.copy')}
                    size="small"
                    onClick={() => void copyAnswer()}
                    sx={{ width: 44, height: 44 }}
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
                      sx={{ width: 44, height: 44 }}
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
                      sx={{ width: 44, height: 44 }}
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
                  sx={{ width: 44, height: 44 }}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                </ActionIconButton>
              </Stack>
            </Stack>

            {groundedFallback && (
              <Box
                sx={{
                  mx: { xs: 1.75, sm: 2 },
                  px: 1.5,
                  py: 1.25,
                  borderInlineStart: 3,
                  borderColor: 'info.main',
                  bgcolor: 'action.hover',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <Box>
                    <Typography component="p" variant="subtitle2">
                      {t('askPage.fallback.noticeTitle')}
                    </Typography>
                    <Typography component="p" variant="body2" sx={{ mt: 0.25 }}>
                      {t('askPage.fallback.noticeDescription')}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}

            {response.state === 'COMPLETED' && response.answer ? (
              <Box
                data-testid="dwaion-workspace-answer"
                sx={{ p: { xs: 1.75, sm: 2.25 }, pt: { xs: 2, sm: 2.5 } }}
              >
                <DwaionStructuredAnswerBody answer={response.answer} compact={false} />
                {response.citations.length > 0 && (
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
                    {response.citations.map((citation, index) => (
                      <Chip
                        key={`${citation.sourceSystem}:${citation.sourceId}`}
                        size="small"
                        variant="outlined"
                        icon={<BookOpenCheck size={14} />}
                        label={`${index + 1}. ${citation.title}`}
                        sx={{ maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden' } }}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            ) : (
              <InlineFeedback
                severity={response.state === 'CONFIGURATION_REQUIRED' ? 'info' : 'warning'}
                title={outcomeTitle(t, response)}
                sx={{ m: { xs: 1.75, sm: 2 } }}
              >
                {outcomeDescription(t, response)}
              </InlineFeedback>
            )}

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              gap={0.75}
              sx={{ px: { xs: 1.75, sm: 2 }, py: 1.25, bgcolor: 'action.hover' }}
            >
              <Stack direction="row" alignItems="center" gap={0.75}>
                <Check size={15} color="currentColor" aria-hidden="true" />
                <Typography variant="caption" color="text.secondary">
                  {t('askPage.independentRun')}
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontFamily: foundationTokens.font.mono }}
              >
                {t('askPage.resultBrief.audit')} {response.auditId.slice(0, 12)}
              </Typography>
            </Stack>
          </Box>
        </Box>
      )}
      <Box
        data-testid="dwaion-answer-announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={visuallyHidden}
      >
        {answerAnnouncement}
      </Box>
    </Box>
  );
}

function MobileQuestion({
  question,
  authorName,
  onReset,
  showReset,
}: {
  question: string;
  authorName?: string;
  onReset: () => void;
  showReset: boolean;
}) {
  const { t } = useTranslation('work');
  const label = authorName?.trim() || t('askPage.history.you');
  const initials = label.replace(/\s+/g, '').slice(0, 2).toUpperCase();
  return (
    <Box component="section" aria-label={t('askPage.yourQuestion')} sx={{ mb: 1.5 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ px: 0.5, mb: 0.75 }}
      >
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 22,
              height: 22,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontSize: 'caption.fontSize',
              fontWeight: 'fontWeightBold',
              flex: '0 0 auto',
            }}
          >
            {initials}
          </Box>
          <Typography variant="caption" fontWeight="fontWeightBold" color="text.primary" noWrap>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            · {t('askPage.yourQuestion')}
          </Typography>
        </Stack>
        {showReset && (
          <ActionButton
            size="small"
            intent="quiet"
            startIcon={<Plus size={14} aria-hidden="true" />}
            onClick={onReset}
            sx={{ minHeight: 44, flex: '0 0 auto' }}
          >
            {t('askPage.actions.newQuestion')}
          </ActionButton>
        )}
      </Stack>
      <Box
        sx={{
          p: 1.5,
          borderRadius:
            foundationTokens.radius.surface * 2 +
            'px ' +
            foundationTokens.radius.compact +
            'px ' +
            foundationTokens.radius.surface * 2 +
            'px ' +
            foundationTokens.radius.surface * 2 +
            'px',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          boxShadow: 'none',
        }}
      >
        <Typography
          component="h2"
          variant="body2"
          fontWeight="fontWeightMedium"
          sx={{ lineHeight: 'body2.lineHeight' }}
        >
          {question}
        </Typography>
      </Box>
    </Box>
  );
}

function MobileReadyAnswer({
  question,
  response,
  groundedFallback,
  feedback,
  locale,
  onCopy,
  onRetry,
  onFeedback,
}: {
  question: string;
  response: AskDwpResponse;
  groundedFallback: boolean;
  feedback: 'UP' | 'DOWN' | null;
  locale: string;
  onCopy: () => void;
  onRetry: () => void;
  onFeedback: (rating: 'UP' | 'DOWN') => void;
}) {
  const { t } = useTranslation('work');
  const latency =
    response.modelRoute.latencyMs > 0
      ? t('askPage.resultBrief.latency', { count: response.modelRoute.latencyMs })
      : t('askPage.evidence.notApplicable');

  return (
    <Box
      component="article"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface * 2 + 'px',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        boxShadow: (theme) => theme.shadows[1],
        animation: (theme) =>
          `${reveal} ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeOut}`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        gap={0.7}
        sx={{ px: 1.5, py: 1, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}
      >
        <Check size={15} color="var(--dwp-product-secondary)" aria-hidden="true" />
        <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
          {t('askPage.status.permission.label')} →{' '}
          {t('askPage.contextRail.sourceCount', {
            count: response.sourceCount,
          })}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 'auto', fontFamily: foundationTokens.font.mono, flex: '0 0 auto' }}
        >
          {latency}
        </Typography>
      </Stack>

      <Box sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            color={responseTone(response)}
            variant="outlined"
            label={
              groundedFallback ? t('askPage.fallback.state') : t(`askPage.states.${response.state}`)
            }
          />
          <Chip
            size="small"
            color="success"
            variant="outlined"
            label={t(`askPage.contextRail.confidence.${response.confidence ?? 'NOT_AVAILABLE'}`)}
          />
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            label={t('askPage.sourcesHeading', { count: response.citations.length })}
          />
        </Stack>

        <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold" sx={{ mt: 1.1 }}>
          {t(groundedFallback ? 'askPage.fallback.answerHeading' : 'askPage.answerHeading')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {t(groundedFallback ? 'askPage.fallback.answerDescription' : 'askPage.answerDescription')}
        </Typography>

        {groundedFallback && (
          <Box
            sx={{
              mt: 1.25,
              px: 1.25,
              py: 1,
              borderInlineStart: 3,
              borderColor: 'info.main',
              bgcolor: 'action.hover',
            }}
          >
            <Typography component="p" variant="caption" fontWeight="fontWeightBold">
              {t('askPage.fallback.noticeTitle')}
            </Typography>
            <Typography component="p" variant="caption" color="text.secondary">
              {t('askPage.fallback.noticeDescription')}
            </Typography>
          </Box>
        )}

        {response.state === 'COMPLETED' && response.answer ? (
          <Box data-testid="dwaion-workspace-answer" sx={{ mt: 1.5 }}>
            <DwaionStructuredAnswerBody answer={response.answer} />
          </Box>
        ) : (
          <InlineFeedback
            severity={response.state === 'CONFIGURATION_REQUIRED' ? 'info' : 'warning'}
            title={outcomeTitle(t, response)}
            sx={{ mt: 1.5 }}
          >
            {outcomeDescription(t, response)}
          </InlineFeedback>
        )}

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={0.5}
          sx={{ mt: 1.5, pt: 0.75, borderTop: 1, borderColor: 'divider' }}
        >
          <Stack direction="row" alignItems="center" gap={0.1}>
            {response.answer && (
              <ActionIconButton
                label={t('askPage.actions.copy')}
                tooltip={t('askPage.actions.copy')}
                size="small"
                onClick={onCopy}
                sx={{ width: 44, height: 44 }}
              >
                <Copy size={16} aria-hidden="true" />
              </ActionIconButton>
            )}
            {response.answer && (
              <DwaionSpeechButton text={response.answer} locale={locale} namespace="work" />
            )}
            <ActionIconButton
              label={t('askPage.actions.retry')}
              tooltip={t('askPage.actions.retry')}
              size="small"
              onClick={onRetry}
              sx={{ width: 44, height: 44 }}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </ActionIconButton>
            <DwaionArtifactAnswerAction question={question} response={response} />
          </Stack>
          {response.answer && (
            <Stack direction="row" alignItems="center" gap={0.1}>
              <ActionIconButton
                label={t('askPage.feedback.helpful')}
                tooltip={t('askPage.feedback.helpful')}
                size="small"
                intent={feedback === 'UP' ? 'primary' : 'default'}
                disabled={Boolean(feedback)}
                onClick={() => onFeedback('UP')}
                sx={{ width: 44, height: 44 }}
              >
                <ThumbsUp size={16} aria-hidden="true" />
              </ActionIconButton>
              <ActionIconButton
                label={t('askPage.feedback.notHelpful')}
                tooltip={t('askPage.feedback.notHelpful')}
                size="small"
                intent={feedback === 'DOWN' ? 'primary' : 'default'}
                disabled={Boolean(feedback)}
                onClick={() => onFeedback('DOWN')}
                sx={{ width: 44, height: 44 }}
              >
                <ThumbsDown size={16} aria-hidden="true" />
              </ActionIconButton>
            </Stack>
          )}
        </Stack>
      </Box>

      <Stack
        direction="row"
        justifyContent="space-between"
        gap={1}
        sx={{ px: 1.5, py: 1, bgcolor: 'action.hover' }}
      >
        <Typography variant="caption" color="text.secondary">
          {t('askPage.independentRun')}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontFamily: foundationTokens.font.mono, flex: '0 0 auto' }}
        >
          {response.auditId.slice(0, 12)}
        </Typography>
      </Stack>
    </Box>
  );
}

function ResultSignal({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <Stack
      direction="row"
      gap={1}
      alignItems="flex-start"
      sx={{
        minWidth: { xs: 150, md: 0 },
        flex: { xs: '0 0 auto', md: 'initial' },
        p: { xs: 1, md: 1.25 },
        borderInlineEnd: 1,
        borderBottom: 0,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', color: 'primary.main', mt: 0.15 }}>
        <Icon size={16} aria-hidden="true" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 'fontWeightBold' }}>
          {value}
        </Typography>
      </Box>
    </Stack>
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
        <CircularProgress size={22} aria-hidden="true" />
        <Box>
          <Typography component="p" variant="subtitle2" fontWeight="fontWeightBold">
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
              borderRadius: foundationTokens.radius.surface + 'px',
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                animation: (theme) =>
                  `${pulse} ${foundationTokens.duration.standard * 8}ms ${theme.transitions.easing.easeInOut} ${index * foundationTokens.duration.standard}ms infinite`,
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}
            />
            <Typography variant="caption" fontWeight="fontWeightMedium">
              {t(`askPage.loadingSteps.${step}`)}
            </Typography>
          </Box>
        ))}
      </Box>
      <ActionButton intent="quiet" size="small" onClick={onCancel} sx={{ mt: 1.5, minHeight: 44 }}>
        {t('askPage.composer.cancel')}
      </ActionButton>
    </Box>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  p: 0,
  m: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

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
