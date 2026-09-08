import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, Copy, FileText, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { workspaceWorkSourceRoute } from '@dwp-frontend/shared-utils/api/workspace-work-policy';
import { selectedWorkConversationRoute } from '@dwp-frontend/shared-utils/api/agent-selected-work-api';
import type {
  AskCitation,
  AskDwpOptions,
  AskDwpResponse,
  AskProgressStage,
} from '@dwp-frontend/shared-utils/api/agent-runtime-api';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionCitationDialog } from '../../components/dwaion-assistant/dwaion-citation-dialog';
import {
  verifiedWorkAssistExcerpt,
  workHubAssistDisposition,
  workHubAssistDraft,
  type WorkHubAssistDraft,
  type WorkHubAssistSourceContext,
} from './work-hub-assist';
import type { WorkHubItem } from './work-hub-contracts';
import { workHubStatusLabelKey } from './work-hub-presentation';

export type WorkHubAssistPanelProps = {
  item: WorkHubItem;
  verifiedAt: string | null;
  sourceContext?: WorkHubAssistSourceContext | null;
  onClose: () => void;
  onSubmit: (
    question: string,
    options: AskDwpOptions & { conversationId?: string }
  ) => Promise<AskDwpResponse>;
  onContinue?: (response: AskDwpResponse) => void | Promise<void>;
  onDraftApply?: (draft: WorkHubAssistDraft) => void;
  onOpenSource?: (route: string) => void;
};

/** Read-only companion. A caller may expose an explicit draft handoff, but this panel never mutates. */
export function WorkHubAssistPanel({
  item,
  verifiedAt,
  sourceContext,
  onClose,
  onSubmit,
  onContinue,
  onDraftApply,
  onOpenSource,
}: WorkHubAssistPanelProps) {
  const { t } = useTranslation(['work', 'common']);
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [response, setResponse] = useState<AskDwpResponse | null>(null);
  const [persistedConversation, setPersistedConversation] = useState<AskDwpResponse | null>(null);
  const [progress, setProgress] = useState<AskProgressStage | null>(null);
  const [busy, setBusy] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'copied' | 'copyFailed' | 'applied' | null>(null);
  const [draftText, setDraftText] = useState('');
  const [selectedCitation, setSelectedCitation] = useState<AskCitation | null>(null);
  const composing = useRef(false);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const request = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const identity = `${item.key}:${item.version}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const excerpt = verifiedWorkAssistExcerpt(item, sourceContext);
  const serviceDraft = Boolean(
    onDraftApply &&
    item.reference.sourceSystem === 'SERVICE_REQUEST' &&
    item.sourceStatus === 'AWAITING_REQUESTER'
  );
  const applicableDraft = workHubAssistDraft(item, response, draftText);
  const conversationRoute = persistedConversation
    ? selectedWorkConversationRoute(persistedConversation)
    : null;
  const disposition = response?.statusCode?.startsWith('SELECTED_WORK_')
    ? workHubAssistDisposition(response)
    : null;
  const sourceRoute = workspaceWorkSourceRoute({ sourceRoute: item.sourceRoute });

  useEffect(() => {
    requestSequence.current += 1;
    request.current?.abort();
    setQuestion('');
    setSubmittedQuestion('');
    setResponse(null);
    setPersistedConversation(null);
    setProgress(null);
    setBusy(false);
    setContinuing(false);
    setError(null);
    setFeedback(null);
    setDraftText('');
    setSelectedCitation(null);
    heading.current?.focus({ preventScroll: true });
    return () => {
      requestSequence.current += 1;
      request.current?.abort();
    };
  }, [identity]);

  const cancel = () => {
    requestSequence.current += 1;
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setProgress(null);
  };
  const close = () => {
    cancel();
    onClose();
  };
  const submit = async (value = question) => {
    const normalized = value.trim();
    if (busy || normalized.length < 2 || normalized.length > 2000 || !verifiedAt) return;
    const continuationId = conversationRoute
      ? (persistedConversation?.conversationId ?? undefined)
      : undefined;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    const sequence = ++requestSequence.current;
    const requestIdentity = identity;
    setSubmittedQuestion(normalized);
    setBusy(true);
    setProgress('AUTHORIZING');
    setError(null);
    setResponse(null);
    setFeedback(null);
    setDraftText('');
    try {
      const result = await onSubmit(normalized, {
        signal: controller.signal,
        ...(continuationId ? { conversationId: continuationId } : {}),
        onProgress: (stage) => {
          if (sequence === requestSequence.current && !controller.signal.aborted)
            setProgress(stage);
        },
      });
      if (
        sequence !== requestSequence.current ||
        controller.signal.aborted ||
        identityRef.current !== requestIdentity
      )
        return;
      setResponse(result);
      if (selectedWorkConversationRoute(result)) setPersistedConversation(result);
      else if (result.statusCode?.startsWith('SELECTED_WORK_')) setPersistedConversation(null);
      setDraftText(result.answer ?? '');
      setQuestion(result.state === 'COMPLETED' ? '' : normalized);
    } catch {
      if (!controller.signal.aborted && sequence === requestSequence.current)
        setError(t('work:workHub.assist.failed'));
    } finally {
      if (sequence === requestSequence.current) {
        setBusy(false);
        setProgress(null);
      }
      if (request.current === controller) request.current = null;
    }
  };
  const copy = async () => {
    if (!response?.answer) return;
    try {
      await navigator.clipboard.writeText(response.answer);
      setFeedback('copied');
    } catch {
      setFeedback('copyFailed');
    }
  };
  const continueConversation = async () => {
    if (continuing || busy || !persistedConversation || !conversationRoute) return;
    const continuationIdentity = identity;
    const sequence = requestSequence.current;
    setContinuing(true);
    try {
      if (onContinue) await onContinue(persistedConversation);
      else navigate(conversationRoute);
    } catch {
      if (identityRef.current === continuationIdentity && sequence === requestSequence.current)
        setError(t('work:workHub.assist.failed'));
    } finally {
      if (identityRef.current === continuationIdentity && sequence === requestSequence.current)
        setContinuing(false);
    }
  };
  const blockedTitle =
    response?.state === 'CONFIGURATION_REQUIRED'
      ? 'askPage.outcomes.configurationTitle'
      : disposition === 'RETRY'
        ? 'workHub.assist.outcomes.retryTitle'
        : disposition === 'RESTRICTED'
          ? 'workHub.assist.outcomes.restrictedTitle'
          : disposition === 'UNSUPPORTED'
            ? 'workHub.assist.outcomes.unsupportedTitle'
            : disposition === 'PURGE' || disposition === 'REFRESH'
              ? 'workHub.assist.outcomes.changedTitle'
              : response?.policy.outcome === 'DENY'
                ? 'askPage.outcomes.deniedTitle'
                : response?.policy.outcome === 'HANDOFF'
                  ? 'askPage.outcomes.handoffTitle'
                  : 'askPage.outcomes.insufficientTitle';
  const blockedDetail =
    disposition === 'RETRY'
      ? 'workHub.assist.outcomes.retryDetail'
      : disposition === 'RESTRICTED'
        ? 'workHub.assist.outcomes.restrictedDetail'
        : disposition === 'UNSUPPORTED'
          ? 'workHub.assist.outcomes.unsupportedDetail'
          : disposition === 'PURGE' || disposition === 'REFRESH'
            ? 'workHub.assist.outcomes.changedDetail'
            : 'workHub.assist.noAnswer';
  const progressLabel = progress
    ? t(`work:askPage.progress.${progress}`, { defaultValue: t('work:workHub.assist.submitting') })
    : t('work:workHub.assist.submitting');

  return (
    <Box
      component="aside"
      data-testid="work-assist-panel"
      aria-label={t('work:workHub.assist.panelTitle')}
      onKeyDown={(event) => {
        if (
          event.key === 'Escape' &&
          !selectedCitation &&
          !composing.current &&
          !event.nativeEvent.isComposing
        ) {
          event.stopPropagation();
          close();
        }
      }}
      sx={{
        minWidth: 0,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 'var(--dwp-shape-borderRadius)',
        overflow: 'hidden',
        scrollMarginTop: (theme) => theme.spacing(9),
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        gap={1.25}
        sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            borderRadius: 'var(--dwp-shape-borderRadius)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Sparkles size={20} aria-hidden="true" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography ref={heading} component="h2" variant="subtitle1" tabIndex={-1}>
            {t('work:workHub.assist.panelTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('work:workHub.assist.panelSubtitle')}
          </Typography>
        </Box>
        <ActionIconButton
          label={t('common:actions.close')}
          onClick={close}
          sx={{ minWidth: { xs: 44, md: 36 }, minHeight: { xs: 44, md: 36 } }}
        >
          <X size={18} />
        </ActionIconButton>
      </Stack>
      <Stack gap={1.5} sx={{ p: 2 }}>
        <Box
          sx={{
            p: 1.25,
            bgcolor: 'var(--dwp-product-soft)',
            borderRadius: 'var(--dwp-shape-borderRadius)',
          }}
        >
          <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center" sx={{ mb: 0.75 }}>
            <Chip
              size="small"
              label={t(`work:workHub.sources.${item.reference.sourceSystem}`, {
                defaultValue: t('work:workHub.sources.OTHER'),
              })}
            />
            <Chip
              size="small"
              variant="outlined"
              label={t(`work:${workHubStatusLabelKey(item)}`)}
            />
            <Typography variant="caption" color="text.secondary">
              {verifiedAt
                ? t('work:workHub.assist.verifiedAt', {
                    date: formatDate(verifiedAt, { timeStyle: 'short' }),
                  })
                : t('work:workHub.assist.verificationRequired')}
            </Typography>
          </Stack>
          <Typography variant="subtitle2">{item.title}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {t(
              excerpt
                ? 'work:workHub.assist.sourceExcerptNotice'
                : 'work:workHub.assist.snapshotNotice'
            )}
          </Typography>
          {excerpt && (
            <Box component="details" sx={{ mt: 1 }}>
              <Typography
                component="summary"
                variant="caption"
                sx={{ cursor: 'pointer', color: 'primary.main' }}
              >
                {t('work:workHub.assist.reviewContext')}
              </Typography>
              <Typography
                component="p"
                variant="caption"
                sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mt: 1 }}
              >
                {excerpt}
              </Typography>
            </Box>
          )}
        </Box>
        <Stack gap={0.75}>
          <Typography variant="caption" color="text.secondary">
            {t('work:workHub.assist.suggestions')}
          </Typography>
          {(['risk', 'draft', 'evidence'] as const).map((kind) => (
            <ActionButton
              key={kind}
              intent="quiet"
              disabled={busy}
              startIcon={kind === 'draft' ? <FileText size={16} /> : <Sparkles size={16} />}
              onClick={() => setQuestion(t(`work:workHub.assist.prompts.${kind}`))}
              sx={{
                alignSelf: 'flex-start',
                textAlign: 'start',
                justifyContent: 'flex-start',
                minHeight: { xs: 44, md: 32 },
                py: 0.5,
                fontSize: 'caption.fontSize',
                bgcolor: 'var(--dwp-product-soft)',
              }}
            >
              {t(`work:workHub.assist.prompts.${kind}`)}
            </ActionButton>
          ))}
        </Stack>
        {busy && (
          <Box>
            <LoadingState label={progressLabel} />
            <ActionButton intent="quiet" onClick={cancel} sx={{ minHeight: { xs: 44, md: 32 } }}>
              {t('common:actions.cancel')}
            </ActionButton>
          </Box>
        )}
        {error && (
          <InlineFeedback severity="error">
            {error}
            <ActionButton
              intent="quiet"
              onClick={() => void submit(submittedQuestion)}
              sx={{ minHeight: { xs: 44, md: 32 } }}
            >
              {t('common:actions.retry')}
            </ActionButton>
          </InlineFeedback>
        )}
        {response && (
          <Box
            data-testid="work-assist-result"
            sx={{
              p: 1.5,
              bgcolor: 'var(--dwp-product-soft)',
              borderRadius: 'var(--dwp-shape-borderRadius)',
            }}
          >
            <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1 }}>
              <ShieldCheck size={17} aria-hidden="true" />
              <Typography component="h3" variant="subtitle2" role="status" aria-live="polite">
                {t('work:workHub.assist.reviewDraft')}
              </Typography>
            </Stack>
            {response.state === 'COMPLETED' && response.answer ? (
              <>
                {response.statusCode === 'ANSWER_GROUNDED_FALLBACK' && (
                  <InlineFeedback severity="info" sx={{ mb: 1 }}>
                    {t('work:askPage.fallback.noticeDescription')}
                  </InlineFeedback>
                )}
                {!serviceDraft && (
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {response.answer}
                  </Typography>
                )}
                {serviceDraft && (
                  <FormField
                    label={t('work:workHub.assist.draftPreview')}
                    value={draftText}
                    onChange={(event) => {
                      setDraftText(event.target.value);
                      setFeedback(null);
                    }}
                    multiline
                    minRows={3}
                    maxRows={8}
                    supportingText={t('work:workHub.assist.draftHelp', { count: draftText.length })}
                    errorMessage={
                      draftText.length > 2000 ? t('work:workHub.assist.draftTooLong') : undefined
                    }
                    sx={{ mt: 1, bgcolor: 'background.paper' }}
                  />
                )}
                <Typography
                  component="h4"
                  variant="caption"
                  sx={{ display: 'block', mt: 2, mb: 0.75 }}
                >
                  {t('work:workHub.assist.citations')}
                </Typography>
                <Stack gap={0.5}>
                  {response.citations.length === 0 && (
                    <InlineFeedback severity="info">
                      {t('work:workHub.assist.noCitations')}
                    </InlineFeedback>
                  )}
                  {response.citations.map((citation) => (
                    <ActionButton
                      key={citation.sourceId}
                      intent="quiet"
                      startIcon={<FileText size={15} />}
                      onClick={() => setSelectedCitation(citation)}
                      sx={{
                        bgcolor: 'background.paper',
                        justifyContent: 'flex-start',
                        textAlign: 'start',
                        minHeight: { xs: 44, md: 42 },
                      }}
                    >
                      {citation.title}
                    </ActionButton>
                  ))}
                </Stack>
              </>
            ) : (
              <InlineFeedback
                severity={response.state === 'CONFIGURATION_REQUIRED' ? 'info' : 'warning'}
              >
                <Typography variant="subtitle2">{t(`work:${blockedTitle}`)}</Typography>
                <Typography variant="body2">{t(`work:${blockedDetail}`)}</Typography>
                {sourceRoute && (
                  <ActionButton
                    intent="quiet"
                    endIcon={<ArrowUpRight size={15} />}
                    onClick={() =>
                      onOpenSource ? onOpenSource(sourceRoute) : navigate(sourceRoute)
                    }
                    sx={{ mt: 0.75, minHeight: { xs: 44, md: 32 } }}
                  >
                    {t('work:workHub.actions.OPEN_SOURCE')}
                  </ActionButton>
                )}
              </InlineFeedback>
            )}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1.25 }}
            >
              {t('work:workHub.assist.reviewNotice')}
            </Typography>
          </Box>
        )}
        {feedback && (
          <InlineFeedback severity={feedback === 'copyFailed' ? 'warning' : 'success'}>
            {t(`work:workHub.assist.${feedback}`)}
          </InlineFeedback>
        )}
        {response?.answer && (
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            {serviceDraft && (
              <ActionButton
                intent="primary"
                disabled={!applicableDraft || feedback === 'applied'}
                startIcon={<Check size={17} />}
                onClick={() => {
                  if (applicableDraft) {
                    onDraftApply?.(applicableDraft);
                    setFeedback('applied');
                  }
                }}
                sx={{ flex: 1, minHeight: { xs: 44, md: 38 } }}
              >
                {t('work:workHub.assist.applyDraft')}
              </ActionButton>
            )}
            <ActionButton
              intent="secondary"
              startIcon={<Copy size={16} />}
              onClick={() => void copy()}
              sx={{ minHeight: { xs: 44, md: 38 } }}
            >
              {t('work:workHub.assist.copyAnswer')}
            </ActionButton>
          </Stack>
        )}
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!composing.current) void submit();
          }}
        >
          <FormField
            multiline
            minRows={3}
            label={t('work:workHub.assist.question')}
            value={question}
            disabled={busy}
            onChange={(event) => setQuestion(event.target.value)}
            errorMessage={question.length > 2000 ? t('work:workHub.assist.tooLong') : undefined}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing)) {
                event.stopPropagation();
                return;
              }
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void submit();
              }
            }}
            supportingText={t('work:workHub.assist.help', { count: question.length })}
          />
          <ActionButton
            intent="primary"
            type="submit"
            disabled={busy || question.trim().length < 2 || question.length > 2000 || !verifiedAt}
            startIcon={<Send size={16} />}
            sx={{ mt: 1, width: 1, minHeight: { xs: 44, md: 38 } }}
          >
            {t('work:workHub.assist.askHere')}
          </ActionButton>
        </Box>
        <ActionButton
          intent="quiet"
          endIcon={<ArrowUpRight size={15} />}
          loading={continuing}
          disabled={busy || !conversationRoute}
          onClick={() => void continueConversation()}
          sx={{
            justifyContent: 'flex-start',
            textAlign: 'start',
            minHeight: { xs: 44, md: 32 },
          }}
        >
          {t('work:workHub.assist.continueConversation')}
        </ActionButton>
        <Typography variant="caption" color="text.secondary">
          {t('work:workHub.assist.safety')}
        </Typography>
        {response && (
          <>
            <Divider />
            <Stack direction="row" gap={1} justifyContent="space-between" flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                {t('work:workHub.assist.actualSources', { count: response.sourceCount })}
              </Typography>
              {response.modelRoute.state === 'COMPLETED' && (
                <Typography variant="caption" color="text.secondary">
                  {t('work:workHub.assist.actualRuntime', {
                    tokens: response.modelRoute.totalTokens,
                    latency: response.modelRoute.latencyMs,
                  })}
                </Typography>
              )}
            </Stack>
          </>
        )}
      </Stack>
      <DwaionCitationDialog
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
        onOpenSource={(citation) => {
          const route = workspaceWorkSourceRoute({ sourceRoute: citation.route });
          if (route) {
            if (onOpenSource) onOpenSource(route);
            else navigate(route);
          }
        }}
      />
    </Box>
  );
}
