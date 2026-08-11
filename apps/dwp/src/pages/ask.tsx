import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ActionButton, AgentPlanPreview, PageCanvas } from '@dwp-frontend/design-system';
import {
  getWorkspaceWorkQueue,
  useToast,
  previewAgentPlan,
  type AgentPlanPreview as AgentPlanContract,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';

import { PageHeader, ReferenceModeChip, SectionHeading } from '../features/work-hub/workspace-ui';

const promptKeys = ['remote', 'blocking', 'software'] as const;

type PlanLoadState = 'idle' | 'loading' | 'ready' | 'fallback';

function toVisualRisk(riskTier: AgentPlanContract['riskTier']) {
  if (riskTier === 'L3') return 'critical' as const;
  if (riskTier === 'L2') return 'medium' as const;
  return 'low' as const;
}

export default function AskPage() {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [runtimePlan, setRuntimePlan] = useState<AgentPlanContract | null>(null);
  const [planLoadState, setPlanLoadState] = useState<PlanLoadState>('idle');
  const requestSequence = useRef(0);
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
  const restricted = Boolean(
    submittedQuery && /salary|confidential|payroll|급여|기밀|비밀/i.test(submittedQuery)
  );

  const prepareAnswer = useCallback(async (value: string) => {
    const nextSequence = requestSequence.current + 1;
    requestSequence.current = nextSequence;
    setSubmittedQuery(value);
    setRuntimePlan(null);

    if (/salary|confidential|payroll|급여|기밀|비밀/i.test(value)) {
      setPlanLoadState('idle');
      return;
    }

    setPlanLoadState('loading');
    try {
      const plan = await previewAgentPlan({
        requestId: globalThis.crypto.randomUUID(),
        intent: value,
        action: 'workspace request',
        target: 'workspace/request-preview',
        sourceReferences: [],
        agentKey: 'REFERENCE_PLANNER',
      });
      if (requestSequence.current !== nextSequence) return;
      setRuntimePlan(plan);
      setPlanLoadState('ready');
    } catch {
      if (requestSequence.current !== nextSequence) return;
      setPlanLoadState('fallback');
    }
  }, []);

  useEffect(() => {
    if (initialQuery) void prepareAnswer(initialQuery);
  }, [initialQuery, prepareAnswer]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (value) void prepareAnswer(value);
  };

  const choosePrompt = (value: string) => {
    setQuery(value);
    void prepareAnswer(value);
  };

  return (
    <PageCanvas>
      <PageHeader
        eyebrow={t('askPage.header.eyebrow')}
        title={t('askPage.header.title')}
        description={t('askPage.header.description')}
        action={<ReferenceModeChip />}
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
          alignItems: 'end',
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
        <TextField
          fullWidth
          label={t('askPage.questionLabel')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('askPage.questionPlaceholder')}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={19} strokeWidth={1.8} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <ActionButton
          type="submit"
          intent="primary"
          endIcon={<ArrowRight size={16} />}
          sx={{ minWidth: 112 }}
        >
          {t('askPage.submit')}
        </ActionButton>
      </Box>

      <Box
        sx={{
          mt: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
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
          {workQueueQuery.isLoading ? (
            <Typography role="status" color="text.secondary" sx={{ py: 2.5 }}>
              {t('askPage.contextLoading')}
            </Typography>
          ) : recentWork.length ? (
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
              {recentWork.map((item, index) => (
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
                    onClick={() => navigate(`/work?item=${encodeURIComponent(item.id)}`)}
                    sx={{ mt: 1, px: 0 }}
                  >
                    {t('askPage.openContext')}
                  </ActionButton>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary" sx={{ py: 2.5 }}>
              {workQueueQuery.isError ? t('askPage.contextUnavailable') : t('askPage.contextEmpty')}
            </Typography>
          )}
        </Box>
      )}

      {submittedQuery && (
        <Box sx={{ mt: 4 }}>
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
            {[
              [
                ShieldCheck,
                t('askPage.status.permission.label'),
                t('askPage.status.permission.detail'),
              ],
              [
                BookOpenCheck,
                restricted
                  ? t('askPage.status.retrievalStopped.label')
                  : t('askPage.status.retrievalUnavailable.label'),
                restricted
                  ? t('askPage.status.retrievalStopped.detail')
                  : t('askPage.status.retrievalUnavailable.detail'),
              ],
              [
                CheckCircle2,
                restricted
                  ? t('askPage.status.noAnswer.label')
                  : planLoadState === 'loading'
                    ? t('askPage.status.preparing.label')
                    : planLoadState === 'ready'
                      ? t('askPage.status.verified.label')
                      : t('askPage.status.preview.label'),
                restricted
                  ? t('askPage.status.noAnswer.detail')
                  : planLoadState === 'ready'
                    ? t('askPage.status.verified.detail')
                    : planLoadState === 'loading'
                      ? t('askPage.status.preparing.detail')
                      : t('askPage.status.preview.detail'),
              ],
            ].map(([Icon, label, detail], index) => {
              const StatusIcon = Icon as typeof ShieldCheck;
              return (
                <Box
                  key={label as string}
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
                  <Box
                    sx={{
                      color:
                        index === 1 || (restricted && index > 0) ? 'warning.main' : 'success.main',
                    }}
                  >
                    <StatusIcon size={18} strokeWidth={1.8} aria-hidden="true" />
                  </Box>
                  <Box>
                    <Typography component="p" variant="subtitle2">
                      {label as string}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {detail as string}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Box component="section" aria-labelledby="answer-heading" sx={{ mt: 4 }}>
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
                id="answer-heading"
                icon={Sparkles}
                title={t('askPage.previewHeading')}
              />
              <Chip label={t('askPage.previewOnly')} color="info" variant="outlined" size="small" />
            </Box>
            <Divider sx={{ mt: 1.5 }} />

            {restricted ? (
              <Alert severity="warning" icon={<LockKeyhole size={20} />} sx={{ mt: 3 }}>
                {t('askPage.restricted')}
              </Alert>
            ) : (
              <Box sx={{ mt: 3 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('askPage.yourQuestion')}
                  </Typography>
                  <Typography component="h3" variant="subtitle1" sx={{ mt: 0.4 }}>
                    {submittedQuery}
                  </Typography>
                  <Alert severity="info" variant="outlined" sx={{ mt: 2.5 }}>
                    <Typography component="p" variant="subtitle2">
                      {t('askPage.answerUnavailableTitle')}
                    </Typography>
                    <Typography component="p" variant="body2" sx={{ mt: 0.4 }}>
                      {t('askPage.answerUnavailableDescription')}
                    </Typography>
                  </Alert>
                </Box>
              </Box>
            )}
          </Box>

          {!restricted && (
            <Box sx={{ mt: 4 }}>
              {planLoadState === 'loading' && (
                <Box
                  role="status"
                  aria-live="polite"
                  sx={{ py: 2.5, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1.25 }}>
                    <Typography component="p" variant="subtitle2">
                      {t('askPage.preparingPreview')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('askPage.noMutation')}
                    </Typography>
                  </Box>
                  <LinearProgress aria-label={t('askPage.preparingPlanLabel')} />
                </Box>
              )}

              {planLoadState === 'fallback' && (
                <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
                  {t('askPage.fallback')}
                </Alert>
              )}

              {runtimePlan && (
                <Box
                  sx={{
                    mb: 2,
                    py: 1.5,
                    display: 'flex',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 0.75,
                    borderTop: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle2
                      size={18}
                      strokeWidth={1.8}
                      color="currentColor"
                      aria-hidden="true"
                    />
                    <Typography component="p" variant="subtitle2">
                      {runtimePlan.referenceMode
                        ? t('askPage.referenceContract')
                        : t('askPage.governedContract')}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontFamily: 'monospace' }}
                    aria-label={t('askPage.contractAria', {
                      agent: runtimePlan.agentRegistry.entryKey,
                      revision: runtimePlan.agentRegistry.revision,
                      audit: runtimePlan.auditId,
                      hash: runtimePlan.planHash,
                    })}
                  >
                    {t('askPage.contractMeta', {
                      agent: runtimePlan.agentRegistry.entryKey,
                      revision: runtimePlan.agentRegistry.revision,
                      audit: runtimePlan.auditId,
                      hash: runtimePlan.planHash.slice(0, 12),
                    })}
                  </Typography>
                </Box>
              )}

              {runtimePlan && (
                <AgentPlanPreview
                  title={t('askPage.planTitle')}
                  summary={runtimePlan.summary}
                  riskLevel={toVisualRisk(runtimePlan.riskTier)}
                  riskLabel={t('askPage.riskApproval', { tier: runtimePlan.riskTier })}
                  steps={runtimePlan.steps}
                  sources={[]}
                  approvalRequired={runtimePlan.approvalRequired}
                  approveLabel={t('askPage.openService')}
                  rejectLabel={t('askPage.dismiss')}
                  labels={{
                    risk: {
                      low: t('ai.risk.low'),
                      medium: t('ai.risk.medium'),
                      high: t('ai.risk.high'),
                      critical: t('ai.risk.critical'),
                    },
                    planSteps: t('ai.planSteps'),
                    sources: t('ai.sources'),
                    planSources: t('ai.planSources'),
                    planApproved: t('ai.planApproved'),
                    planRejected: t('ai.planRejected'),
                    reviewBeforeExecution: t('ai.reviewBeforeExecution'),
                    noApprovalRequired: t('ai.noApprovalRequired'),
                    citationStates: {
                      restricted: t('ai.citationStates.restricted'),
                      stale: t('ai.citationStates.stale'),
                    },
                  }}
                  onApprove={() => {
                    toast.success(t('askPage.serviceOpened'));
                    navigate('/apps');
                  }}
                  onReject={() => {
                    requestSequence.current += 1;
                    setSubmittedQuery(null);
                    setRuntimePlan(null);
                    setPlanLoadState('idle');
                  }}
                />
              )}
            </Box>
          )}
        </Box>
      )}
    </PageCanvas>
  );
}
