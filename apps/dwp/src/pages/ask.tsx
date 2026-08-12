import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  ExternalLink,
  Gauge,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ActionButton, ActionIconButton, FormField, PageCanvas } from '@dwp-frontend/design-system';
import {
  askDwp,
  getWorkspaceWorkQueue,
  type AskDwpResponse,
  type AskCitation,
  type WorkspaceWorkItem,
} from '@dwp-frontend/shared-utils';

import type { TFunction } from 'i18next';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';

import { PageHeader, SectionHeading } from '../features/work-hub/workspace-ui';

const promptKeys = ['remote', 'blocking', 'software'] as const;

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function AskPage() {
  const { t, i18n } = useTranslation('work');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [runtimeResponse, setRuntimeResponse] = useState<AskDwpResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const requestSequence = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const unmountAbortTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const autoSubmittedQuery = useRef<string | null>(null);
  const workQueueQuery = useQuery({
    queryKey: ['workspace', 'work-queue'],
    queryFn: getWorkspaceWorkQueue,
    staleTime: 30_000,
    retry: 1,
  });
  const recentWork = useMemo(
    () => (workQueueQuery.data?.items ?? []).slice(0, 3),
    [workQueueQuery.data?.items]
  );

  const prepareAnswer = useCallback(
    async (value: string) => {
      requestController.current?.abort('superseded');
      const controller = new AbortController();
      requestController.current = controller;
      const nextSequence = requestSequence.current + 1;
      requestSequence.current = nextSequence;
      setSubmittedQuery(value);
      setRuntimeResponse(null);
      setLoadState('loading');
      try {
        const response = await askDwp(
          {
            requestId: globalThis.crypto.randomUUID(),
            query: value,
            locale: i18n.resolvedLanguage || i18n.language || 'en',
            agentKey: 'DWP_ASSISTANT',
          },
          { signal: controller.signal }
        );
        if (requestSequence.current !== nextSequence) return;
        setRuntimeResponse(response);
        setLoadState('ready');
      } catch {
        if (controller.signal.aborted || requestSequence.current !== nextSequence) return;
        setLoadState('error');
      } finally {
        if (requestController.current === controller) requestController.current = null;
      }
    },
    [i18n.language, i18n.resolvedLanguage]
  );

  useEffect(() => {
    if (initialQuery && autoSubmittedQuery.current !== initialQuery) {
      autoSubmittedQuery.current = initialQuery;
      setQuery(initialQuery);
      void prepareAnswer(initialQuery);
    }
  }, [initialQuery, prepareAnswer]);

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

  const runQuery = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('q', value);
    autoSubmittedQuery.current = value;
    setSearchParams(nextParams, { replace: true });
    void prepareAnswer(value);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (value) runQuery(value);
  };

  const choosePrompt = (value: string) => {
    setQuery(value);
    runQuery(value);
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
    <PageCanvas>
      <PageHeader
        eyebrow={t('askPage.header.eyebrow')}
        title={t('askPage.header.title')}
        description={t('askPage.header.description')}
        action={
          <Chip
            icon={<LockKeyhole size={14} aria-hidden="true" />}
            label={t('askPage.readOnly')}
            color="info"
            variant="outlined"
            size="small"
          />
        }
      />

      <Box
        component="form"
        onSubmit={submit}
        sx={{
          mt: 3,
          p: { xs: 2, sm: 2.5 },
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
          gap: 1.5,
          alignItems: 'start',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderTop: 3,
          borderTopColor: 'primary.main',
          borderRadius: 1,
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 12px 32px rgba(0, 0, 0, 0.22)'
              : '0 12px 32px rgba(15, 21, 29, 0.06)',
        }}
      >
        <FormField
          label={t('askPage.questionLabel')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('askPage.questionPlaceholder')}
          inputProps={{ maxLength: 4000 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={19} strokeWidth={1.8} aria-hidden="true" />
              </InputAdornment>
            ),
          }}
        />
        <ActionButton
          type="submit"
          intent="primary"
          endIcon={
            loadState === 'loading' ? (
              <CircularProgress size={15} color="inherit" />
            ) : (
              <ArrowRight size={16} />
            )
          }
          disabled={!query.trim()}
          sx={{ minWidth: 124, minHeight: 56 }}
        >
          {t('askPage.submit')}
        </ActionButton>
      </Box>

      <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          {t('askPage.suggested')}
        </Typography>
        {promptKeys.map((key) => {
          const prompt = t(`askPage.prompts.${key}`);
          return (
            <ActionButton
              key={prompt}
              size="small"
              intent="quiet"
              onClick={() => choosePrompt(prompt)}
            >
              {prompt}
            </ActionButton>
          );
        })}
      </Box>

      {!submittedQuery && (
        <RecentContext
          loading={workQueueQuery.isLoading}
          error={workQueueQuery.isError}
          items={recentWork}
          onOpen={(id) => navigate(`/work?item=${encodeURIComponent(id)}`)}
        />
      )}

      {submittedQuery && loadState === 'loading' && (
        <Box
          role="status"
          aria-live="polite"
          sx={{ mt: 5, py: 4, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CircularProgress size={22} />
            <Box>
              <Typography component="p" variant="subtitle2">
                {t('askPage.runtimeLoadingTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('askPage.runtimeLoadingDescription')}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {submittedQuery && loadState === 'error' && (
        <Alert
          severity="error"
          variant="outlined"
          action={
            <ActionButton size="small" intent="quiet" onClick={() => prepareAnswer(submittedQuery)}>
              {t('askPage.retry')}
            </ActionButton>
          }
          sx={{ mt: 4 }}
        >
          <Typography component="p" variant="subtitle2">
            {t('askPage.runtimeErrorTitle')}
          </Typography>
          <Typography component="p" variant="body2" sx={{ mt: 0.25 }}>
            {t('askPage.runtimeErrorDescription')}
          </Typography>
        </Alert>
      )}

      {submittedQuery && runtimeResponse && (
        <Box sx={{ mt: 4 }}>
          <RuntimeStatus response={runtimeResponse} />

          <Box component="section" aria-labelledby="ask-answer-heading" sx={{ mt: 4 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1,
              }}
            >
              <SectionHeading
                id="ask-answer-heading"
                icon={Sparkles}
                title={t('askPage.answerHeading')}
              />
              <Chip
                label={t(`askPage.states.${runtimeResponse.state}`)}
                color={runtimeResponse.state === 'COMPLETED' ? 'success' : 'warning'}
                variant="outlined"
                size="small"
              />
            </Box>
            <Divider sx={{ mt: 1.5 }} />

            <Box sx={{ mt: 2.5 }}>
              <Typography variant="caption" color="text.secondary">
                {t('askPage.yourQuestion')}
              </Typography>
              <Typography component="h3" variant="subtitle1" sx={{ mt: 0.4 }}>
                {submittedQuery}
              </Typography>
            </Box>

            {runtimeResponse.state === 'COMPLETED' && runtimeResponse.answer ? (
              <Box
                sx={{
                  mt: 3,
                  pl: { xs: 2, sm: 2.5 },
                  pr: { xs: 1, sm: 2 },
                  py: 2.5,
                  borderLeft: 3,
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                }}
              >
                <Typography
                  component="p"
                  variant="body1"
                  sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}
                >
                  {runtimeResponse.answer}
                </Typography>
              </Box>
            ) : (
              <Alert
                severity={runtimeResponse.state === 'CONFIGURATION_REQUIRED' ? 'info' : 'warning'}
                icon={
                  runtimeResponse.state === 'CONFIGURATION_REQUIRED' ? (
                    <Bot size={20} />
                  ) : (
                    <LockKeyhole size={20} />
                  )
                }
                variant="outlined"
                sx={{ mt: 3 }}
              >
                <Typography component="p" variant="subtitle2">
                  {outcomeTitle(t, runtimeResponse)}
                </Typography>
                <Typography component="p" variant="body2" sx={{ mt: 0.4 }}>
                  {outcomeDescription(t, runtimeResponse)}
                </Typography>
              </Alert>
            )}
          </Box>

          {runtimeResponse.citations.length > 0 && (
            <Box component="section" aria-labelledby="ask-sources-heading" sx={{ mt: 4 }}>
              <SectionHeading
                id="ask-sources-heading"
                icon={BookOpenCheck}
                title={t('askPage.sourcesHeading', { count: runtimeResponse.citations.length })}
              />
              <Box
                component="ol"
                sx={{
                  p: 0,
                  m: 0,
                  mt: 1.5,
                  listStyle: 'none',
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                {runtimeResponse.citations.map((citation, index) => (
                  <Box
                    component="li"
                    key={citation.sourceId}
                    sx={{
                      py: 2,
                      pr: { xs: 0, md: index % 2 === 0 ? 2.5 : 0 },
                      pl: { xs: 0, md: index % 2 === 0 ? 0 : 2.5 },
                      borderBottom: 1,
                      borderLeft: { xs: 0, md: index % 2 === 0 ? 0 : 1 },
                      borderColor: 'divider',
                      display: 'grid',
                      gridTemplateColumns: '32px minmax(0, 1fr) auto',
                      gap: 1.25,
                      alignItems: 'start',
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'primary.lighter',
                        color: 'primary.main',
                        borderRadius: 1,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography component="h3" variant="subtitle2" noWrap>
                        {citation.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(`askPage.sourceTypes.${citation.sourceType}`)} / {citation.sourceSystem}
                      </Typography>
                    </Box>
                    {citation.route && (
                      <ActionIconButton
                        label={t('askPage.openSource', { title: citation.title })}
                        tooltip={t('askPage.openSource', { title: citation.title })}
                        size="small"
                        onClick={() => openCitation(citation)}
                      >
                        <ExternalLink size={16} aria-hidden="true" />
                      </ActionIconButton>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <RuntimeEvidence response={runtimeResponse} />
        </Box>
      )}
    </PageCanvas>
  );
}

function RecentContext({
  loading,
  error,
  items,
  onOpen,
}: {
  loading: boolean;
  error: boolean;
  items: WorkspaceWorkItem[];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation('work');
  return (
    <Box
      component="section"
      aria-labelledby="recent-context-heading"
      sx={{ mt: 5, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
    >
      <Box sx={{ py: 2.5 }}>
        <SectionHeading
          id="recent-context-heading"
          icon={Sparkles}
          title={t('askPage.recentContext')}
        />
      </Box>
      {loading ? (
        <Typography role="status" color="text.secondary" sx={{ py: 2.5 }}>
          {t('askPage.contextLoading')}
        </Typography>
      ) : items.length ? (
        <Box
          component="ul"
          sx={{
            p: 0,
            m: 0,
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {items.map((item, index) => (
            <Box
              component="li"
              key={item.workItemId}
              sx={{
                py: 2.5,
                px: { xs: 0, md: 2.5 },
                borderTop: 1,
                borderLeft: { xs: 0, md: index === 0 ? 0 : 1 },
                borderColor: 'divider',
              }}
            >
              <Typography component="h3" variant="subtitle2">
                {item.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                {item.summary || item.sourceSystem}
              </Typography>
              <ActionButton
                size="small"
                intent="quiet"
                endIcon={<ArrowRight size={14} aria-hidden="true" />}
                onClick={() => onOpen(item.id)}
                sx={{ mt: 1, px: 0 }}
              >
                {t('askPage.openContext')}
              </ActionButton>
            </Box>
          ))}
        </Box>
      ) : (
        <Typography color="text.secondary" sx={{ py: 2.5 }}>
          {error ? t('askPage.contextUnavailable') : t('askPage.contextEmpty')}
        </Typography>
      )}
    </Box>
  );
}

function RuntimeStatus({ response }: { response: AskDwpResponse }) {
  const { t } = useTranslation('work');
  const items = [
    {
      icon: ShieldCheck,
      label: t(`askPage.policyOutcomes.${response.policy.outcome}`),
      detail: t('askPage.status.permission.detail'),
      tone: response.policy.outcome === 'ALLOW' ? 'success.main' : 'warning.main',
    },
    {
      icon: BookOpenCheck,
      label: t('askPage.status.sources.label', { count: response.sourceCount }),
      detail: t('askPage.status.sources.detail'),
      tone: response.sourceCount ? 'success.main' : 'warning.main',
    },
    {
      icon: response.state === 'COMPLETED' ? CheckCircle2 : Bot,
      label: t(`askPage.modelStates.${response.modelRoute.state}`),
      detail: response.modelRoute.model || t('askPage.status.modelNotInvoked'),
      tone: response.state === 'COMPLETED' ? 'success.main' : 'warning.main',
    },
  ];
  return (
    <Box
      aria-label={t('askPage.responseStatus')}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {items.map(({ icon: Icon, label, detail, tone }, index) => (
        <Box
          key={label}
          sx={{
            py: 1.75,
            px: { xs: 0, sm: 2.5 },
            display: 'grid',
            gridTemplateColumns: '26px minmax(0, 1fr)',
            alignItems: 'center',
            gap: 1,
            borderLeft: { xs: 0, sm: index === 0 ? 0 : 1 },
            borderTop: { xs: index === 0 ? 0 : 1, sm: 0 },
            borderColor: 'divider',
          }}
        >
          <Box sx={{ color: tone }}>
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="p" variant="subtitle2" noWrap>
              {label}
            </Typography>
            <Typography component="p" variant="caption" color="text.secondary" noWrap>
              {detail}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function RuntimeEvidence({ response }: { response: AskDwpResponse }) {
  const { t } = useTranslation('work');
  const metrics = [
    {
      icon: Bot,
      label: t('askPage.evidence.agent'),
      value: `${response.agentRegistry.entryKey} r${response.agentRegistry.revision}`,
    },
    {
      icon: Gauge,
      label: t('askPage.evidence.usage'),
      value: response.modelRoute.totalTokens
        ? t('askPage.evidence.tokens', { count: response.modelRoute.totalTokens })
        : t('askPage.evidence.notApplicable'),
    },
    {
      icon: Gauge,
      label: t('askPage.evidence.latency'),
      value: response.modelRoute.latencyMs
        ? t('askPage.evidence.milliseconds', { count: response.modelRoute.latencyMs })
        : t('askPage.evidence.notApplicable'),
    },
    {
      icon: ShieldCheck,
      label: t('askPage.evidence.audit'),
      value: response.auditId.slice(0, 12),
    },
  ];
  return (
    <Box component="section" aria-label={t('askPage.evidence.label')} sx={{ mt: 4 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, 1fr)' },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {metrics.map(({ icon: Icon, label, value }, index) => (
          <Box
            key={label}
            sx={{
              py: 1.75,
              px: { xs: 1.5, md: 2 },
              borderLeft: index % 2 === 0 ? 0 : 1,
              borderTop: { xs: index < 2 ? 0 : 1, md: 0 },
              borderColor: 'divider',
              display: 'grid',
              gridTemplateColumns: '24px minmax(0, 1fr)',
              gap: 1,
              alignItems: 'center',
              '&:not(:first-of-type)': { borderLeft: { md: 1 } },
            }}
          >
            <Icon size={17} color="currentColor" aria-hidden="true" />
            <Box sx={{ minWidth: 0 }}>
              <Typography component="p" variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography
                component="p"
                variant="subtitle2"
                noWrap
                sx={{ fontFamily: index === 3 ? 'monospace' : undefined }}
              >
                {value}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {t('askPage.evidence.privacy')}
      </Typography>
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
    PRIVILEGED_DATA_HANDOFF: t('askPage.outcomes.privilegedHandoff'),
    MUTATION_REQUIRES_GOVERNED_WORKFLOW: t('askPage.outcomes.mutationHandoff'),
    NO_GROUNDED_SOURCE: t('askPage.outcomes.noSource'),
    CONTEXT_SOURCE_UNAVAILABLE: t('askPage.outcomes.sourceUnavailable'),
    EVIDENCE_INSUFFICIENT: t('askPage.outcomes.evidenceInsufficient'),
    MODEL_REFUSED: t('askPage.outcomes.modelRefused'),
  };
  return descriptions[response.statusCode] ?? t('askPage.outcomes.safeFallback');
}
