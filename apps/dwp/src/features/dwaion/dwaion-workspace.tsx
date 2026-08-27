import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { PageCanvas } from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import {
  askDwpStream,
  consumeQuestionLaunch,
  getDwaionConversation,
  getWorkspaceWorkQueue,
  useAuth,
  type AskCitation,
  type AskCitationSourceType,
  type AskDwpResponse,
  type AskProgressStage,
  type WorkspaceWorkItem,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
  dwaionWorkspaceRoute,
  hasDwaionQuestionLaunchState,
  parseDwaionQuestionLaunchState,
  resolveDwaionAgentKey,
} from './dwaion-contract';
import { DwaionWorkspaceAnswer } from './dwaion-workspace-answer';
import { DwaionWorkspaceComposer } from './dwaion-workspace-composer';
import { DwaionWorkspaceContext } from './dwaion-workspace-context';
import {
  verifiedConversationId,
  visibleWorkItems,
  type DwaionWorkspaceState,
} from './dwaion-workspace-model';
import { DwaionWorkspaceStart } from './dwaion-workspace-start';
import { DwaionActionShelf } from './dwaion-action-shelf';
import { DwaionCitationDialog } from '../../components/dwaion-assistant/dwaion-citation-dialog';
import { DwaionConversationMenu } from './dwaion-conversation-menu';
import { DwaionConversationTranscript } from './dwaion-conversation-transcript';

export function DwaionWorkspace() {
  const { t, i18n } = useTranslation('work');
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { conversationId: routeConversationId } = useParams<{ conversationId: string }>();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const agentKey = resolveDwaionAgentKey(searchParams.get('agent'));
  const approvalExpert = agentKey === DWAION_APPROVAL_EXPERT_AGENT_KEY;
  const availableSourceScopes = useMemo<AskCitationSourceType[]>(
    () =>
      approvalExpert
        ? ['APPROVAL_TASK', 'APPROVAL_REQUEST', 'APPROVAL_FORM', 'APPROVAL_OPERATION']
        : ['WORK_ITEM', 'MAIL', 'CALENDAR'],
    [approvalExpert]
  );
  const initialConversationId = approvalExpert
    ? null
    : routeConversationId?.trim() || searchParams.get('conversation')?.trim() || null;
  const [draft, setDraft] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [response, setResponse] = useState<AskDwpResponse | null>(null);
  const [state, setState] = useState<DwaionWorkspaceState>('idle');
  const [progressStage, setProgressStage] = useState<AskProgressStage | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [sourceScopes, setSourceScopes] = useState<AskCitationSourceType[]>(availableSourceScopes);
  const [selectedCitation, setSelectedCitation] = useState<AskCitation | null>(null);
  const [launchFailure, setLaunchFailure] = useState(false);
  const requestSequence = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const unmountAbortTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const consumedLaunchId = useRef<string | null>(null);
  const internalConversationNavigation = useRef<string | null>(null);
  const firstName = auth.user?.displayName?.trim().split(/\s+/)[0];
  const workQueue = useQuery({
    queryKey: ['workspace', 'work-queue'],
    queryFn: getWorkspaceWorkQueue,
    enabled: !approvalExpert,
    staleTime: 30_000,
    retry: 1,
  });
  const conversation = useQuery({
    queryKey: ['dwaion', 'conversation', conversationId],
    queryFn: () => getDwaionConversation(conversationId!),
    enabled: Boolean(conversationId),
    staleTime: 10_000,
    retry: (failureCount, error) =>
      !(error instanceof HttpError && error.status === 404) && failureCount < 1,
  });
  const workItems = useMemo(
    () => visibleWorkItems(workQueue.data?.items ?? []),
    [workQueue.data?.items]
  );

  const prepareAnswer = useCallback(
    async (value: string) => {
      const normalized = value.trim();
      if (!normalized) return;
      setLaunchFailure(false);

      requestController.current?.abort('superseded');
      const controller = new AbortController();
      const sequence = requestSequence.current + 1;
      requestController.current = controller;
      requestSequence.current = sequence;
      setSubmittedQuery(normalized);
      setDraft('');
      setResponse(null);
      setProgressStage('AUTHORIZING');
      setState('loading');

      try {
        const result = await askDwpStream(
          {
            requestId: globalThis.crypto.randomUUID(),
            query: normalized,
            locale: i18n.resolvedLanguage || i18n.language || 'en',
            agentKey,
            conversationId: approvalExpert
              ? undefined
              : verifiedConversationId(conversationId, conversation.data?.summary.conversationId),
            sourceScopes,
            pageContext: approvalExpert
              ? {
                  route: '/approvals/home',
                  appKey: 'APP.APPROVALS',
                  surface: 'approval-expert',
                }
              : {
                  route: conversationId
                    ? `/dwaion/conversations/${encodeURIComponent(conversationId)}`
                    : '/dwaion/new',
                  appKey: 'APP.ASK',
                  surface: 'workspace',
                },
          },
          { signal: controller.signal, onProgress: setProgressStage }
        );
        if (requestSequence.current !== sequence) return;
        setResponse(result);
        if (result.conversationId) {
          internalConversationNavigation.current = result.conversationId;
          setConversationId(result.conversationId);
          navigate(dwaionWorkspaceRoute(undefined, result.conversationId, agentKey), {
            replace: true,
          });
          await queryClient.invalidateQueries({
            queryKey: ['dwaion', 'conversation', result.conversationId],
          });
          await queryClient.invalidateQueries({ queryKey: ['dwaion', 'conversations'] });
        }
        setState('ready');
      } catch {
        if (controller.signal.aborted || requestSequence.current !== sequence) return;
        setState('error');
      } finally {
        if (requestController.current === controller) requestController.current = null;
      }
    },
    [
      conversationId,
      conversation.data?.summary.conversationId,
      agentKey,
      approvalExpert,
      i18n.language,
      i18n.resolvedLanguage,
      navigate,
      queryClient,
      sourceScopes,
    ]
  );

  useEffect(() => {
    const hasLaunchState = hasDwaionQuestionLaunchState(location.state);
    if (!hasLaunchState) return;
    const launchId = parseDwaionQuestionLaunchState(location.state);
    if (launchId && consumedLaunchId.current === launchId) return;
    if (launchId) consumedLaunchId.current = launchId;
    const sanitized = new URLSearchParams(location.search);
    sanitized.delete('q');
    const search = sanitized.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ''}`, {
      replace: true,
      state: null,
    });
    if (!launchId) {
      setLaunchFailure(true);
      return;
    }
    void consumeQuestionLaunch(launchId)
      .then((question) => prepareAnswer(question))
      .catch(() => setLaunchFailure(true));
  }, [location.pathname, location.search, location.state, navigate, prepareAnswer]);

  useEffect(() => {
    if (!searchParams.has('q')) return;
    const sanitized = new URLSearchParams(searchParams);
    sanitized.delete('q');
    setSearchParams(sanitized, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setSourceScopes(availableSourceScopes);
  }, [availableSourceScopes]);

  useEffect(() => {
    if (
      !conversationId ||
      !(conversation.error instanceof HttpError) ||
      conversation.error.status !== 404
    ) {
      return;
    }
    internalConversationNavigation.current = null;
    setConversationId(null);
    navigate(dwaionWorkspaceRoute(undefined, undefined, agentKey), { replace: true });
    queryClient.removeQueries({ queryKey: ['dwaion', 'conversation', conversationId] });
  }, [agentKey, conversation.error, conversationId, navigate, queryClient]);

  useEffect(() => {
    const requestedConversationId = approvalExpert
      ? null
      : routeConversationId?.trim() || searchParams.get('conversation')?.trim() || null;
    const internalTarget = internalConversationNavigation.current;
    if (internalTarget && requestedConversationId === internalTarget) {
      internalConversationNavigation.current = null;
      if (conversationId !== requestedConversationId) {
        setConversationId(requestedConversationId);
      }
      return;
    }
    if (internalTarget && conversationId === internalTarget) return;
    if (requestedConversationId === conversationId) return;

    requestSequence.current += 1;
    requestController.current?.abort('browser-history-changed');
    requestController.current = null;
    setConversationId(requestedConversationId);
    setSubmittedQuery(null);
    setResponse(null);
    setProgressStage(null);
    setDraft('');
    setState('idle');
  }, [approvalExpert, conversationId, routeConversationId, searchParams]);

  useEffect(() => {
    if (unmountAbortTimer.current !== null) {
      globalThis.clearTimeout(unmountAbortTimer.current);
      unmountAbortTimer.current = null;
    }
    return () => {
      unmountAbortTimer.current = globalThis.setTimeout(() => {
        requestSequence.current += 1;
        requestController.current?.abort('page-unmounted');
      }, 0);
    };
  }, []);

  const runQuestion = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    void prepareAnswer(normalized);
  };

  const reset = () => {
    requestSequence.current += 1;
    requestController.current?.abort('new-question');
    requestController.current = null;
    internalConversationNavigation.current = null;
    setSubmittedQuery(null);
    setResponse(null);
    setProgressStage(null);
    setConversationId(null);
    setDraft('');
    setState('idle');
    setLaunchFailure(false);
    navigate(dwaionWorkspaceRoute(undefined, undefined, agentKey), { replace: true });
  };

  const selectConversation = (nextConversationId: string) => {
    requestSequence.current += 1;
    requestController.current?.abort('conversation-changed');
    internalConversationNavigation.current = null;
    setConversationId(nextConversationId);
    setSubmittedQuery(null);
    setResponse(null);
    setState('idle');
    setDraft('');
    navigate(dwaionWorkspaceRoute(undefined, nextConversationId, agentKey));
  };

  const cancelRequest = () => {
    requestSequence.current += 1;
    requestController.current?.abort('user-cancelled');
    requestController.current = null;
    setDraft(submittedQuery ?? '');
    setSubmittedQuery(null);
    setResponse(null);
    setProgressStage(null);
    setState('idle');
  };

  const toggleSource = (source: AskCitationSourceType) => {
    setSourceScopes((current) => {
      if (!current.includes(source)) return [...current, source];
      return current.length === 1 ? current : current.filter((item) => item !== source);
    });
  };

  const openWork = (item: WorkspaceWorkItem) => {
    navigate(item.sourceRoute || `/work?item=${encodeURIComponent(item.id)}`);
  };

  const openCitation = (citation: AskCitation) => {
    if (!citation.route) return;
    if (citation.route.startsWith('/')) {
      navigate(citation.route);
      return;
    }
    globalThis.open(citation.route, '_blank', 'noopener,noreferrer');
  };

  return (
    <PageCanvas topInset="compact">
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
          pb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 42,
              height: 42,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              bgcolor: '#071A3B',
              border: '1px solid rgba(98, 215, 255, 0.5)',
              boxShadow: '0 8px 20px rgba(13, 42, 91, 0.18)',
            }}
          >
            <Box
              component="img"
              src="/assets/assistants/dwaion-link-v1.png"
              alt=""
              sx={{ width: 36, height: 36, objectFit: 'contain' }}
            />
          </Box>
          <Box>
            <Stack direction="row" spacing={0.6} alignItems="center">
              <Sparkles size={14} color="#2459D3" aria-hidden="true" />
              <Typography variant="overline" color="primary.main">
                {t(
                  approvalExpert
                    ? 'askPage.approvalExpert.header.eyebrow'
                    : 'askPage.header.eyebrow'
                )}
              </Typography>
            </Stack>
            <Typography component="h1" variant="h5" sx={{ lineHeight: 1.15 }}>
              {t(approvalExpert ? 'askPage.approvalExpert.header.title' : 'askPage.header.title')}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {!approvalExpert && (
            <DwaionConversationMenu
              currentConversationId={conversationId}
              onSelect={selectConversation}
              onNew={reset}
            />
          )}
          <Chip
            icon={<ShieldCheck size={14} aria-hidden="true" />}
            label={t('askPage.permissionScoped')}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<LockKeyhole size={14} aria-hidden="true" />}
            label={t('askPage.readOnly')}
            size="small"
            variant="outlined"
          />
        </Stack>
      </Box>

      {launchFailure && (
        <Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>
          {t('askPage.questionLaunchUnavailable')}
        </Alert>
      )}

      <Box
        sx={{
          mt: 2.5,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 304px' },
          gap: { xs: 2.5, lg: 3 },
          alignItems: 'start',
        }}
      >
        <Box component="main" sx={{ minWidth: 0 }}>
          {!submittedQuery && !conversationId ? (
            <DwaionWorkspaceStart
              expert={approvalExpert}
              firstName={firstName}
              query={draft}
              loading={state === 'loading'}
              workLoading={workQueue.isLoading}
              workError={workQueue.isError}
              workItems={workItems}
              sourceScopes={sourceScopes}
              availableSources={availableSourceScopes}
              onQueryChange={setDraft}
              onSubmit={() => runQuestion(draft)}
              onChooseMode={(_mode, prompt) => runQuestion(prompt)}
              onOpenWork={openWork}
              onToggleSource={toggleSource}
              onCancel={cancelRequest}
            />
          ) : (
            <>
              {conversation.data && (
                <DwaionConversationTranscript
                  messages={conversation.data.messages}
                  excludedMessageIds={[
                    response?.userMessageId,
                    response?.assistantMessageId,
                  ].filter((value): value is string => Boolean(value))}
                />
              )}
              {submittedQuery && (
                <DwaionWorkspaceAnswer
                  question={submittedQuery}
                  state={state}
                  response={response}
                  progressStage={progressStage}
                  onCancel={cancelRequest}
                  onRetry={() => void prepareAnswer(submittedQuery)}
                  onReset={reset}
                />
              )}
              <DwaionActionShelf query={submittedQuery} response={response} />
              <Box sx={{ mt: 3 }}>
                <DwaionWorkspaceComposer
                  value={draft}
                  loading={state === 'loading'}
                  compact
                  sourceScopes={sourceScopes}
                  availableSources={availableSourceScopes}
                  onToggleSource={toggleSource}
                  onCancel={cancelRequest}
                  onChange={setDraft}
                  onSubmit={() => runQuestion(draft)}
                />
              </Box>
            </>
          )}
        </Box>

        <DwaionWorkspaceContext
          response={response}
          workSummary={workQueue.data?.summary}
          sourceScopes={availableSourceScopes}
          showWorkSignals={!approvalExpert}
          onOpenCitation={setSelectedCitation}
        />
      </Box>
      <DwaionCitationDialog
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
        onOpenSource={(citation) => {
          setSelectedCitation(null);
          openCitation(citation);
        }}
      />
    </PageCanvas>
  );
}
