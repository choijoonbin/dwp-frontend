import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import {
  askDwpStream,
  type AskCitation,
  type AskDwpResponse,
  type AskPageContext,
  type AskProgressStage,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DWAION_AGENT_KEY } from '@dwp-frontend/shared-utils';
import { DwaionCitationDialog } from './dwaion-citation-dialog';
import { DwaionPanelComposer } from './dwaion-panel-composer';
import { DwaionPanelHeader } from './dwaion-panel-header';
import { DwaionPanelResult, type DwaionPanelRequestState } from './dwaion-panel-result';
import { DwaionSupportTools, type DwaionSupportTool } from './dwaion-support-tools';

type DwaionPanelProps = {
  firstName?: string;
  pageContext?: AskPageContext;
  suggestionKeys?: readonly string[];
  onClose: () => void;
  onOpenWorkspace?: (query?: string, conversationId?: string) => boolean | Promise<boolean>;
  onOpenGuide?: () => void;
  onOpenContacts?: () => void;
  onOpenStatus: () => void;
  onSizeChange?: () => void;
  fullScreen?: boolean;
};

const defaultSuggestionKeys = ['priority', 'policy', 'access'] as const;

export function DwaionPanel({
  firstName,
  pageContext,
  suggestionKeys = defaultSuggestionKeys,
  onClose,
  onOpenWorkspace,
  onOpenGuide,
  onOpenContacts,
  onOpenStatus,
  onSizeChange,
  fullScreen = false,
}: DwaionPanelProps) {
  const { t, i18n } = useTranslation('home');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [response, setResponse] = useState<AskDwpResponse | null>(null);
  const [requestState, setRequestState] = useState<DwaionPanelRequestState>('idle');
  const [progressStage, setProgressStage] = useState<AskProgressStage | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<DwaionSupportTool | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<AskCitation | null>(null);
  const [workspaceOpening, setWorkspaceOpening] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const canAsk = Boolean(onOpenWorkspace);

  useEffect(
    () => () => {
      requestSequence.current += 1;
      requestController.current?.abort('panel-unmounted');
    },
    []
  );

  useEffect(() => {
    if (requestState === 'idle') return;
    contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight });
  }, [requestState, response]);

  useEffect(() => {
    const frame = globalThis.requestAnimationFrame(() => onSizeChange?.());
    return () => globalThis.cancelAnimationFrame(frame);
  }, [activeTool, onSizeChange, requestState, response]);

  const runQuestion = useCallback(
    async (value: string) => {
      const normalized = value.trim();
      if (!normalized || !canAsk) return;

      requestController.current?.abort('superseded');
      const controller = new AbortController();
      const sequence = requestSequence.current + 1;
      requestController.current = controller;
      requestSequence.current = sequence;
      setActiveTool(null);
      setSubmittedQuery(normalized);
      setQuery('');
      setResponse(null);
      setProgressStage('AUTHORIZING');
      setRequestState('loading');

      try {
        const result = await askDwpStream(
          {
            requestId: globalThis.crypto.randomUUID(),
            query: normalized,
            locale: i18n.resolvedLanguage || i18n.language || 'en',
            agentKey: DWAION_AGENT_KEY,
            conversationId: conversationId ?? undefined,
            sourceScopes: ['WORK_ITEM', 'MAIL', 'CALENDAR'],
            pageContext,
          },
          { signal: controller.signal, onProgress: setProgressStage }
        );
        if (requestSequence.current !== sequence) return;
        setResponse(result);
        setConversationId(result.conversationId);
        setRequestState('ready');
      } catch {
        if (controller.signal.aborted || requestSequence.current !== sequence) return;
        setRequestState('error');
      } finally {
        if (requestController.current === controller) requestController.current = null;
      }
    },
    [canAsk, conversationId, i18n.language, i18n.resolvedLanguage, pageContext]
  );

  const clearQuestion = () => {
    requestSequence.current += 1;
    requestController.current?.abort('new-question');
    requestController.current = null;
    setSubmittedQuery(null);
    setResponse(null);
    setProgressStage(null);
    setConversationId(null);
    setRequestState('idle');
    setActiveTool(null);
    setQuery('');
  };

  const cancelQuestion = () => {
    requestSequence.current += 1;
    requestController.current?.abort('cancelled-by-user');
    requestController.current = null;
    setQuery(submittedQuery ?? '');
    setSubmittedQuery(null);
    setResponse(null);
    setProgressStage(null);
    setRequestState('idle');
  };

  const openWorkspace = async () => {
    if (!onOpenWorkspace || workspaceOpening) return;
    const currentQuery = submittedQuery || query.trim() || undefined;
    setWorkspaceOpening(true);
    try {
      const opened = await onOpenWorkspace(currentQuery, conversationId ?? undefined);
      if (opened) onClose();
    } finally {
      setWorkspaceOpening(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void runQuestion(query);
  };

  const selectTool = (tool: DwaionSupportTool) => {
    setActiveTool((current) => (current === tool ? null : tool));
  };

  const closeAndRun = (action?: () => void) =>
    action
      ? () => {
          onClose();
          action();
        }
      : undefined;

  return (
    <Box
      role="dialog"
      aria-modal={fullScreen || undefined}
      aria-label={t('dwaion.panelLabel')}
      data-testid="dwaion-panel"
      sx={{
        height: fullScreen ? '100%' : 'auto',
        maxHeight: fullScreen ? '100%' : 620,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ height: 3, flex: '0 0 auto', bgcolor: 'primary.main' }} />
      <DwaionPanelHeader
        busy={requestState === 'loading'}
        hasQuestion={Boolean(submittedQuery || query.trim())}
        canExpand={canAsk}
        onNewQuestion={clearQuestion}
        onExpand={openWorkspace}
        onClose={onClose}
      />

      <Box
        ref={contentRef}
        data-testid="dwaion-conversation"
        sx={{
          flex: fullScreen ? '1 1 auto' : '0 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          px: 2,
          py: 1.75,
          scrollbarGutter: 'stable',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '32px minmax(0, 1fr)',
            gap: 1,
            alignItems: 'start',
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              bgcolor: 'primary.lighter',
              color: 'primary.main',
            }}
          >
            <Sparkles size={17} strokeWidth={1.9} aria-hidden="true" />
          </Box>
          <Box>
            <Typography component="h2" variant="subtitle2" fontWeight={800}>
              {firstName ? t('dwaion.greeting', { name: firstName }) : t('dwaion.greetingFallback')}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.25 }}
            >
              {t('dwaion.greetingDescription')}
            </Typography>
          </Box>
        </Box>

        {canAsk && requestState === 'idle' && (
          <Box component="section" aria-labelledby="dwaion-suggestions-title" sx={{ mt: 2 }}>
            <Typography
              id="dwaion-suggestions-title"
              component="h3"
              variant="caption"
              color="text.secondary"
              fontWeight={700}
            >
              {t('dwaion.suggestions.title')}
            </Typography>
            <Stack spacing={0.6} sx={{ mt: 0.8 }}>
              {suggestionKeys.map((key) => {
                const suggestion = t(`dwaion.suggestions.${key}`);
                return (
                  <ActionButton
                    key={key}
                    intent="quiet"
                    size="small"
                    endIcon={<ArrowRight size={14} aria-hidden="true" />}
                    onClick={() => void runQuestion(suggestion)}
                    sx={{
                      minHeight: 44,
                      px: 1,
                      justifyContent: 'space-between',
                      border: 1,
                      borderColor: 'divider',
                      color: 'text.primary',
                      fontWeight: 600,
                    }}
                  >
                    {suggestion}
                  </ActionButton>
                );
              })}
            </Stack>
          </Box>
        )}

        {submittedQuery && (
          <DwaionPanelResult
            query={submittedQuery}
            requestState={requestState}
            response={response}
            onRetry={() => void runQuestion(submittedQuery)}
            onOpenWorkspace={onOpenWorkspace ? () => void openWorkspace() : undefined}
            openingWorkspace={workspaceOpening}
            progressStage={progressStage}
            onSelectCitation={setSelectedCitation}
          />
        )}

        <Box sx={{ mt: 2.2 }}>
          <DwaionSupportTools
            activeTool={activeTool}
            onSelect={selectTool}
            onOpenGuide={closeAndRun(onOpenGuide)}
            onOpenContacts={closeAndRun(onOpenContacts)}
            onOpenStatus={() => {
              onClose();
              onOpenStatus();
            }}
            onDetailEntered={() => {
              contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight });
              onSizeChange?.();
            }}
          />
        </Box>
      </Box>

      <DwaionPanelComposer
        value={query}
        busy={requestState === 'loading'}
        enabled={canAsk}
        onChange={setQuery}
        onSubmit={submit}
        onSend={() => void runQuestion(query)}
        onCancel={cancelQuestion}
      />
      <DwaionCitationDialog
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
        onOpenSource={(citation) => {
          if (!citation.route) return;
          setSelectedCitation(null);
          onClose();
          navigate(citation.route);
        }}
      />
    </Box>
  );
}
