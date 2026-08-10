import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AgentPlanPreview, PageCanvas, SourceCitationList } from '@dwp-frontend/design-system';
import {
  useToast,
  previewAgentPlan,
  type AgentPlanPreview as AgentPlanContract,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';

import { PageHeader, ReferenceModeChip, SectionHeading } from '../features/work-hub/workspace-ui';
import {
  askSources,
  localizeAskPlanSteps,
  localizeAskSources,
} from '../features/work-hub/reference-data';

const promptKeys = ['remote', 'blocking', 'software'] as const;
const contextKeys = ['customer', 'software', 'benefits'] as const;

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
  const restricted = Boolean(
    submittedQuery && /salary|confidential|payroll|급여|기밀|비밀/i.test(submittedQuery)
  );
  const localizedSources = useMemo(() => localizeAskSources(t), [t]);
  const localizedPlanSteps = useMemo(() => localizeAskPlanSteps(t), [t]);

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
        action: 'flexible work request',
        target: 'employee-services/flexible-work',
        sourceReferences: askSources.map((source) => source.id),
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
        <Button
          type="submit"
          variant="contained"
          endIcon={<ArrowRight size={16} />}
          sx={{ minWidth: 112 }}
        >
          {t('askPage.submit')}
        </Button>
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
            <Button key={prompt} size="small" variant="text" onClick={() => choosePrompt(prompt)}>
              {prompt}
            </Button>
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
            {contextKeys.map((key, index) => (
              <Box
                component="li"
                key={key}
                sx={{
                  py: 2.5,
                  px: { xs: 0, md: 2.5 },
                  borderTop: 1,
                  borderLeft: { xs: 0, md: index === 0 ? 0 : 1 },
                  borderColor: 'divider',
                }}
              >
                <Typography component="h3" variant="subtitle2">
                  {t(`askPage.context.${key}.title`)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                  {t(`askPage.context.${key}.detail`)}
                </Typography>
              </Box>
            ))}
          </Box>
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
                  : t('askPage.status.sourcesVerified.label'),
                restricted
                  ? t('askPage.status.retrievalStopped.detail')
                  : t('askPage.status.sourcesVerified.detail'),
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
                  <Box sx={{ color: restricted && index > 0 ? 'warning.main' : 'success.main' }}>
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
              <SectionHeading id="answer-heading" icon={Sparkles} title={t('askPage.answer')} />
              <Chip
                label={t('askPage.reviewRequired')}
                color="info"
                variant="outlined"
                size="small"
              />
            </Box>
            <Divider sx={{ mt: 1.5 }} />

            {restricted ? (
              <Alert severity="warning" icon={<LockKeyhole size={20} />} sx={{ mt: 3 }}>
                {t('askPage.restricted')}
              </Alert>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    lg: 'minmax(0, 1.8fr) minmax(300px, 0.8fr)',
                  },
                  gap: { xs: 4, lg: 5 },
                  mt: 3,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('askPage.yourQuestion')}
                  </Typography>
                  <Typography component="h3" variant="subtitle1" sx={{ mt: 0.4 }}>
                    {submittedQuery}
                  </Typography>
                  <Box sx={{ mt: 2.5, pl: 2.5, borderLeft: 3, borderColor: 'primary.main' }}>
                    <Typography sx={{ fontSize: '1rem', lineHeight: 1.75 }}>
                      {t('askPage.answerText')}
                    </Typography>
                  </Box>
                  <Alert severity="info" variant="outlined" sx={{ mt: 2.5 }}>
                    {t('askPage.answerCaution')}
                  </Alert>
                </Box>
                <Box component="aside" aria-labelledby="sources-heading" sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 2,
                    }}
                  >
                    <Typography id="sources-heading" component="h3" variant="subtitle2">
                      {t('askPage.verifiedSources')}
                    </Typography>
                    <Typography variant="caption" color="success.main" fontWeight={700}>
                      {t('askPage.currentCount', { count: 2 })}
                    </Typography>
                  </Box>
                  <SourceCitationList
                    sources={localizedSources}
                    ariaLabel={t('askPage.answerSources')}
                    stateLabels={{
                      restricted: t('ai.citationStates.restricted'),
                      stale: t('ai.citationStates.stale'),
                    }}
                  />
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
                      {runtimePlan.agentRegistry.resolution === 'ACTIVE'
                        ? t('askPage.governedContract')
                        : t('askPage.referenceContract')}
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

              {planLoadState !== 'loading' && (
                <AgentPlanPreview
                  title={t('askPage.planTitle')}
                  summary={runtimePlan?.summary || t('askPage.planSummary')}
                  riskLevel={runtimePlan ? toVisualRisk(runtimePlan.riskTier) : 'medium'}
                  riskLabel={
                    runtimePlan
                      ? t('askPage.riskApproval', { tier: runtimePlan.riskTier })
                      : undefined
                  }
                  steps={runtimePlan?.steps || localizedPlanSteps}
                  sources={runtimePlan ? [] : localizedSources}
                  approvalRequired={runtimePlan?.approvalRequired ?? true}
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
                    navigate('/apps?app=service');
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
