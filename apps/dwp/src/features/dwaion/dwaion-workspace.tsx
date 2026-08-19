import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { PageCanvas } from '@dwp-frontend/design-system';
import {
  askDwpStream,
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
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DWAION_APPROVAL_EXPERT_AGENT_KEY, resolveDwaionAgentKey } from './dwaion-contract';
import { DwaionWorkspaceAnswer } from './dwaion-workspace-answer';
import { DwaionWorkspaceComposer } from './dwaion-workspace-composer';
import { DwaionWorkspaceContext } from './dwaion-workspace-context';
import { visibleWorkItems, type DwaionWorkspaceState } from './dwaion-workspace-model';
import { DwaionWorkspaceStart } from './dwaion-workspace-start';
import { DwaionActionShelf } from './dwaion-action-shelf';
import { DwaionCitationDialog } from './dwaion-citation-dialog';
import { DwaionConversationMenu } from './dwaion-conversation-menu';
import { DwaionConversationTranscript } from './dwaion-conversation-transcript';

export function DwaionWorkspace() {
  const { t, i18n } = useTranslation('work');
  const auth = useAuth();
  const navigate = useNavigate();
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
  const initialQuery = searchParams.get('q')?.trim() ?? '';
  const initialConversationId = approvalExpert
    ? null
    : searchParams.get('conversation')?.trim() || null;
  const [draft, setDraft] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [response, setResponse] = useState<AskDwpResponse | null>(null);
  const [state, setState] = useState<DwaionWorkspaceState>('idle');
  const [progressStage, setProgressStage] = useState<AskProgressStage | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [sourceScopes, setSourceScopes] = useState<AskCitationSourceType[]>(availableSourceScopes);
  const [selectedCitation, setSelectedCitation] = useState<AskCitation | null>(null);
  const requestSequence = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const unmountAbortTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const autoSubmittedQuery = useRef<string | null>(null);
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
  });
  const workItems = useMemo(
    () => visibleWorkItems(workQueue.data?.items ?? []),
    [workQueue.data?.items]
  );

  const prepareAnswer = useCallback(
    async (value: string) => {
      const normalized = value.trim();
      if (!normalized) return;

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
            conversationId: approvalExpert ? undefined : (conversationId ?? undefined),
            sourceScopes,
            pageContext: approvalExpert
              ? {
                  route: '/approvals/home',
                  appKey: 'APP.APPROVALS',
                  surface: 'approval-expert',
                }
              : { route: '/dwaion', appKey: 'APP.ASK', surface: 'workspace' },
          },
          { signal: controller.signal, onProgress: setProgressStage }
        );
        if (requestSequence.current !== sequence) return;
        setResponse(result);
        if (result.conversationId) {
          setConversationId(result.conversationId);
          const next = new URLSearchParams(searchParams);
          next.set('conversation', result.conversationId);
          next.delete('q');
          setSearchParams(next, { replace: true });
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
      agentKey,
      approvalExpert,
      i18n.language,
      i18n.resolvedLanguage,
      queryClient,
      searchParams,
      setSearchParams,
      sourceScopes,
    ]
  );

  useEffect(() => {
    if (!initialQuery || autoSubmittedQuery.current === initialQuery) return;
    autoSubmittedQuery.current = initialQuery;
    void prepareAnswer(initialQuery);
  }, [initialQuery, prepareAnswer]);

  useEffect(() => {
    setSourceScopes(availableSourceScopes);
  }, [availableSourceScopes]);

  useEffect(() => {
    const requestedConversationId = approvalExpert
      ? null
      : searchParams.get('conversation')?.trim() || null;
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
  }, [approvalExpert, conversationId, searchParams]);

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
    const next = new URLSearchParams(searchParams);
    next.set('q', normalized);
    autoSubmittedQuery.current = normalized;
    setSearchParams(next, { replace: true });
    void prepareAnswer(normalized);
  };

  const reset = () => {
    requestSequence.current += 1;
    requestController.current?.abort('new-question');
    requestController.current = null;
    autoSubmittedQuery.current = null;
    setSubmittedQuery(null);
    setResponse(null);
    setProgressStage(null);
    setConversationId(null);
    setDraft('');
    setState('idle');
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    next.delete('conversation');
    setSearchParams(next, { replace: true });
  };

  const selectConversation = (nextConversationId: string) => {
    requestSequence.current += 1;
    requestController.current?.abort('conversation-changed');
    setConversationId(nextConversationId);
    setSubmittedQuery(null);
    setResponse(null);
    setState('idle');
    setDraft('');
    const next = new URLSearchParams(searchParams);
    next.set('conversation', nextConversationId);
    next.delete('q');
    setSearchParams(next, { replace: true });
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
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
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
              <DwaionActionShelf response={response} />
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
