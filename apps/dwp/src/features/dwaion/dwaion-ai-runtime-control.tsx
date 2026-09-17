import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CircleStop, Gauge, Pencil, PlayCircle, Route, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
  SignalMetric,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  bootstrapAIExecutionPolicy,
  getAIControlOverview,
  setAIEmergencyDisable,
  updateAIExecutionPolicy,
  usePermissions,
  type AIControlOverview,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';
import {
  buildAIExecutionPolicy,
  createAIRuntimePolicyEditor,
  type AIRuntimePolicyEditor,
} from './dwaion-ai-runtime-control-model';
import { DwaionAIRuntimePolicyDialog } from './dwaion-ai-runtime-policy-dialog';

type EmergencyEditor = { disabled: boolean; reason: string; confirmed: boolean };

export function DwaionAIRuntimeControl() {
  const { t, i18n } = useTranslation('work');
  const copy = 'dwaionAdmin.aiRuntime';
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.DWAION_SAFETY', 'MANAGE');
  const canUpdate = canManage || hasPermission('ADMIN.DWAION_SAFETY', 'UPDATE');
  const governBootstrap = useDwaionGovernedMutation(
    'route.dwaion.management.ai-control-bootstrap.action'
  );
  const governUpdate = useDwaionGovernedMutation(
    'route.dwaion.management.ai-control-update.action'
  );
  const governEmergency = useDwaionGovernedMutation(
    'route.dwaion.management.ai-control-emergency.action'
  );
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'ai-runtime-control'],
    queryFn: getAIControlOverview,
    staleTime: 15_000,
  });
  const [editor, setEditor] = useState<AIRuntimePolicyEditor | null>(null);
  const [emergency, setEmergency] = useState<EmergencyEditor | null>(null);
  const [notice, setNotice] = useState<'bootstrapped' | 'saved' | 'stopped' | 'released' | null>(
    null
  );
  const builtPolicy = useMemo(
    () => (editor ? buildAIExecutionPolicy(editor) : { issues: [] }),
    [editor]
  );

  const accept = async (data: AIControlOverview, nextNotice: typeof notice) => {
    queryClient.setQueryData(['dwaion', 'admin', 'ai-runtime-control'], data);
    setEditor(null);
    setEmergency(null);
    setNotice(nextNotice);
  };
  const bootstrapMutation = useMutation({
    mutationFn: () =>
      governBootstrap((authority) =>
        bootstrapAIExecutionPolicy(
          {
            ...builtPolicy.value!,
            idempotencyKey: crypto.randomUUID(),
            expectedExistingCount: 0,
          },
          authority
        )
      ),
    onSuccess: (data) => void accept(data, 'bootstrapped'),
  });
  const updateMutation = useMutation({
    mutationFn: () =>
      governUpdate((authority) =>
        updateAIExecutionPolicy(
          {
            ...builtPolicy.value!,
            expectedVersion: query.data!.policy!.policyVersion,
          },
          authority
        )
      ),
    onSuccess: (data) => void accept(data, 'saved'),
  });
  const emergencyMutation = useMutation({
    mutationFn: () =>
      governEmergency((authority) =>
        setAIEmergencyDisable(
          {
            disabled: emergency!.disabled,
            expectedVersion: query.data!.policy!.policyVersion,
            changeReason: emergency!.reason.trim(),
          },
          authority
        )
      ),
    onSuccess: (data) => void accept(data, emergency?.disabled ? 'stopped' : 'released'),
  });

  const overview = query.data;
  const policy = overview?.policy;
  const bootstrap = Boolean(editor && !policy);
  const commandBusy = bootstrapMutation.isPending || updateMutation.isPending;
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const periodPressure = policy
    ? overview.usage.measuredTotalTokens + overview.usage.reservedTokens
    : 0;
  const periodPercent =
    policy?.periodTokenLimit && policy.periodTokenLimit > 0
      ? Math.min(100, (periodPressure / policy.periodTokenLimit) * 100)
      : null;

  return (
    <Box component="section" aria-labelledby="ai-runtime-control-title" sx={{ mt: 3 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        gap={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">
            {t(`${copy}.eyebrow`)}
          </Typography>
          <Typography id="ai-runtime-control-title" component="h2" variant="h5">
            {t(`${copy}.title`)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t(`${copy}.description`)}
          </Typography>
        </Box>
        {policy && (
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="stretch">
            {canUpdate && (
              <ActionButton
                intent="secondary"
                startIcon={<Pencil size={16} aria-hidden="true" />}
                onClick={() => setEditor(createAIRuntimePolicyEditor(policy))}
              >
                {t(`${copy}.actions.edit`)}
              </ActionButton>
            )}
            {canManage && (
              <ActionButton
                intent={policy.emergencyDisabled ? 'primary' : 'danger'}
                startIcon={
                  policy.emergencyDisabled ? (
                    <PlayCircle size={16} aria-hidden="true" />
                  ) : (
                    <CircleStop size={16} aria-hidden="true" />
                  )
                }
                onClick={() =>
                  setEmergency({
                    disabled: !policy.emergencyDisabled,
                    reason: '',
                    confirmed: false,
                  })
                }
              >
                {t(`${copy}.actions.${policy.emergencyDisabled ? 'release' : 'stop'}`)}
              </ActionButton>
            )}
          </Stack>
        )}
      </Stack>

      {notice && (
        <InlineFeedback severity="success" sx={{ mt: 2 }}>
          {t(`${copy}.notices.${notice}`)}
        </InlineFeedback>
      )}
      {query.isLoading ? (
        <Box sx={{ mt: 2 }}>
          <LoadingState
            label={t(`${copy}.loading`)}
            variant="skeleton"
            skeletonRows={5}
            size="page"
          />
        </Box>
      ) : query.isError || !overview ? (
        <Box sx={{ mt: 2 }}>
          <ErrorState
            title={t(`${copy}.loadError`)}
            description={t(`${copy}.loadErrorDescription`)}
            retryLabel={t('dwaionAdmin.shared.retry')}
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
            size="page"
          />
        </Box>
      ) : !policy ? (
        <RuntimeSection
          title={t(`${copy}.notConfigured.title`)}
          description={t(`${copy}.notConfigured.description`)}
          badge={t(`${copy}.states.${overview.runtimeControlState}`)}
        >
          <InlineFeedback severity="warning">{t(`${copy}.notConfigured.boundary`)}</InlineFeedback>
          {canUpdate && (
            <ActionButton
              intent="primary"
              sx={{ mt: 2 }}
              onClick={() => setEditor(createAIRuntimePolicyEditor())}
            >
              {t(`${copy}.actions.initialize`)}
            </ActionButton>
          )}
        </RuntimeSection>
      ) : (
        <Stack spacing={2} sx={{ mt: 2 }}>
          {overview.enforcementActivationState === 'DISABLED' && (
            <InlineFeedback severity="warning">{t(`${copy}.activationDisabled`)}</InlineFeedback>
          )}
          {policy.emergencyDisabled && (
            <InlineFeedback severity="error">{t(`${copy}.emergencyActive`)}</InlineFeedback>
          )}
          <InlineFeedback severity="info">{t(`${copy}.scopeBoundary`)}</InlineFeedback>

          <Box
            aria-label={t(`${copy}.summaryLabel`)}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <SignalMetric
              label={t(`${copy}.summary.activation`)}
              value={t(`${copy}.activation.${overview.enforcementActivationState}`)}
              detail={t(`${copy}.summary.activationDetail`)}
              tone={overview.enforcementActivationState === 'ENABLED' ? 'success' : 'warning'}
              icon={<ShieldCheck size={18} aria-hidden="true" />}
            />
            <SignalMetric
              label={t(`${copy}.summary.runtime`)}
              value={t(`${copy}.states.${overview.runtimeControlState}`)}
              detail={t(`${copy}.summary.runtimeDetail`)}
              tone={policy.emergencyDisabled ? 'error' : 'info'}
              icon={<Bot size={18} aria-hidden="true" />}
            />
            <SignalMetric
              label={t(`${copy}.summary.usage`)}
              value={number.format(overview.usage.measuredTotalTokens)}
              detail={t(`${copy}.summary.usageDetail`, {
                reserved: number.format(overview.usage.reservedTokens),
              })}
              tone={overview.usage.unmeasuredReservedTokens > 0 ? 'warning' : 'info'}
              icon={<Gauge size={18} aria-hidden="true" />}
            />
            <SignalMetric
              label={t(`${copy}.summary.version`)}
              value={`v${policy.policyVersion}`}
              detail={formatDate(
                policy.updatedAt,
                { dateStyle: 'medium', timeStyle: 'short' },
                locale
              )}
              icon={<Route size={18} aria-hidden="true" />}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'minmax(0, 1.45fr) minmax(300px, 1fr)',
              },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Stack spacing={2} sx={{ minWidth: 0 }}>
              <RuntimeSection
                title={t(`${copy}.models.title`)}
                description={t(`${copy}.models.description`)}
                badge={t(`${copy}.models.count`, { count: policy.allowedModelRoutes.length })}
              >
                <Stack spacing={1}>
                  {policy.allowedModelRoutes.map((route) => (
                    <Box
                      key={`${route.provider}:${route.model}:${route.region ?? ''}`}
                      sx={{
                        p: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 'shape.borderRadius',
                      }}
                    >
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        gap={1}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight="fontWeightBold">
                            {route.provider} · {route.model}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {route.region
                              ? t(`${copy}.models.region`, { region: route.region })
                              : t(`${copy}.models.regionUnspecified`)}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={route.availabilityState === 'VERIFIED' ? 'success' : 'default'}
                          label={t(`${copy}.externalStates.${route.availabilityState}`)}
                        />
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </RuntimeSection>

              <RuntimeSection
                title={t(`${copy}.access.title`)}
                description={t(`${copy}.access.description`)}
                badge={t(`${copy}.toolStates.${overview.toolEnforcementState}`)}
              >
                <RuntimeTags
                  title={t(`${copy}.access.sources`)}
                  values={policy.allowedKnowledgeSources}
                  empty={t(`${copy}.access.noSources`)}
                />
                <Divider sx={{ my: 1.5 }} />
                <RuntimeTags
                  title={t(`${copy}.access.tools`)}
                  values={policy.allowedToolKeys}
                  empty={t(`${copy}.access.noTools`)}
                />
                <InlineFeedback severity="warning" sx={{ mt: 1.5 }}>
                  {t(`${copy}.access.toolBoundary`)}
                </InlineFeedback>
              </RuntimeSection>
            </Stack>

            <Stack spacing={2} sx={{ minWidth: 0 }}>
              <RuntimeSection
                title={t(`${copy}.budget.title`)}
                description={t(`${copy}.budget.description`)}
                badge={t(`${copy}.budgetModes.${policy.budgetEnforcementMode}`)}
              >
                <EvidenceRow
                  label={t(`${copy}.budget.maxOutput`)}
                  value={number.format(policy.maxOutputTokensPerRequest)}
                />
                <EvidenceRow
                  label={t(`${copy}.budget.periodLimit`)}
                  value={
                    policy.periodTokenLimit
                      ? number.format(policy.periodTokenLimit)
                      : t(`${copy}.unavailable`)
                  }
                />
                <EvidenceRow
                  label={t(`${copy}.budget.measured`)}
                  value={number.format(overview.usage.measuredTotalTokens)}
                />
                <EvidenceRow
                  label={t(`${copy}.budget.reserved`)}
                  value={number.format(overview.usage.reservedTokens)}
                />
                <EvidenceRow
                  label={t(`${copy}.budget.unmeasured`)}
                  value={number.format(overview.usage.unmeasuredReservedTokens)}
                  warning={overview.usage.unmeasuredReservedTokens > 0}
                />
                {periodPercent !== null && (
                  <Box sx={{ mt: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography variant="caption" color="text.secondary">
                        {t(`${copy}.budget.pressure`)}
                      </Typography>
                      <Typography variant="caption">{Math.round(periodPercent)}%</Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={periodPercent}
                      aria-label={t(`${copy}.budget.pressure`)}
                      color={periodPercent >= policy.alertThresholdPercent ? 'warning' : 'primary'}
                      sx={{ mt: 0.75, height: 8, borderRadius: 4 }}
                    />
                  </Box>
                )}
                <Divider sx={{ my: 1.5 }} />
                <EvidenceRow
                  label={t(`${copy}.budget.providerUsage`)}
                  value={t(`${copy}.externalStates.${overview.usage.providerUsageState}`)}
                />
                <EvidenceRow
                  label={t(`${copy}.budget.pricing`)}
                  value={t(`${copy}.externalStates.${overview.usage.providerPricingState}`)}
                />
                <EvidenceRow
                  label={t(`${copy}.budget.billing`)}
                  value={t(`${copy}.externalStates.${overview.usage.providerBillingState}`)}
                />
                <InlineFeedback severity="info" sx={{ mt: 1.5 }}>
                  {t(`${copy}.budget.costBoundary`)}
                </InlineFeedback>
              </RuntimeSection>

              <RuntimeSection
                title={t(`${copy}.evaluation.title`)}
                description={t(`${copy}.evaluation.description`)}
                badge={t(`${copy}.evaluationStates.${policy.evaluationGateStatus}`)}
              >
                <EvidenceRow
                  label={t(`${copy}.evaluation.required`)}
                  value={
                    policy.requireEvaluationPass
                      ? t('dwaionAdmin.shared.required')
                      : t(`${copy}.evaluation.notRequired`)
                  }
                />
                <EvidenceRow
                  label={t(`${copy}.evaluation.evidence`)}
                  value={t(`${copy}.evaluationEvidence.${policy.evaluationEvidenceState}`)}
                />
                <ActionButton
                  component={NavLink}
                  to="/dwaion/admin/evaluation"
                  intent="secondary"
                  size="small"
                  sx={{ mt: 1.5 }}
                >
                  {t(`${copy}.evaluation.open`)}
                </ActionButton>
              </RuntimeSection>
            </Stack>
          </Box>

          {overview.warnings.length > 0 && (
            <RuntimeSection
              title={t(`${copy}.warnings.title`)}
              description={t(`${copy}.warnings.description`)}
              badge={t(`${copy}.warnings.count`, { count: overview.warnings.length })}
            >
              <Stack component="ul" spacing={0.75} sx={{ pl: 2.5, my: 0 }}>
                {overview.warnings.map((warning) => (
                  <Typography component="li" variant="body2" key={warning}>
                    {t(`${copy}.warningCodes.${warning}`, { defaultValue: warning })}
                  </Typography>
                ))}
              </Stack>
            </RuntimeSection>
          )}
        </Stack>
      )}

      {editor && (
        <DwaionAIRuntimePolicyDialog
          open
          bootstrap={bootstrap}
          editor={editor}
          issues={builtPolicy.issues}
          busy={commandBusy}
          error={bootstrapMutation.isError || updateMutation.isError}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onSubmit={() => (bootstrap ? bootstrapMutation.mutate() : updateMutation.mutate())}
        />
      )}

      <FormDialog
        open={Boolean(emergency)}
        title={t(`${copy}.emergency.${emergency?.disabled ? 'stopTitle' : 'releaseTitle'}`)}
        description={t(`${copy}.emergency.description`)}
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        submitLabel={t(`${copy}.actions.${emergency?.disabled ? 'stop' : 'release'}`)}
        submittingLabel={t('dwaionAdmin.shared.saving')}
        submitIntent={emergency?.disabled ? 'danger' : 'primary'}
        busy={emergencyMutation.isPending}
        submitDisabled={!emergency || emergency.reason.trim().length < 10 || !emergency.confirmed}
        onClose={() => setEmergency(null)}
        onSubmit={() => emergencyMutation.mutate()}
      >
        <Stack spacing={2}>
          {emergencyMutation.isError && (
            <LocalErrorState title={t(`${copy}.commandError`)} size="compact" />
          )}
          <InlineFeedback severity={emergency?.disabled ? 'error' : 'warning'}>
            {t(`${copy}.emergency.impact`)}
          </InlineFeedback>
          <FormField
            label={t('dwaionAdmin.shared.reason')}
            value={emergency?.reason ?? ''}
            multiline
            minRows={3}
            onChange={(event) =>
              setEmergency((current) =>
                current ? { ...current, reason: event.target.value } : current
              )
            }
            errorMessage={
              emergency?.reason && emergency.reason.trim().length < 10
                ? t('dwaionAdmin.shared.reasonError')
                : undefined
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={emergency?.confirmed ?? false}
                onChange={(_, checked) =>
                  setEmergency((current) =>
                    current ? { ...current, confirmed: checked } : current
                  )
                }
              />
            }
            label={t(`${copy}.emergency.confirm`)}
          />
        </Stack>
      </FormDialog>
    </Box>
  );
}

function RuntimeSection({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        p: { xs: 1.5, md: 2 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 'shape.borderRadius',
        minWidth: 0,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        gap={1}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" variant="h6">
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        </Box>
        <Chip label={badge} size="small" variant="outlined" />
      </Stack>
      <Box sx={{ mt: 1.5 }}>{children}</Box>
    </Box>
  );
}

function RuntimeTags({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return (
    <Box>
      <Typography variant="body2" fontWeight="fontWeightBold">
        {title}
      </Typography>
      {values.length > 0 ? (
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
          {values.map((value) => (
            <Chip key={value} label={value} size="small" variant="outlined" />
          ))}
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {empty}
        </Typography>
      )}
    </Box>
  );
}

function EvidenceRow({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      gap={0.5}
      sx={{ py: 0.8, borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography variant="body2">{label}</Typography>
      <Typography
        variant="body2"
        color={warning ? 'warning.main' : 'text.primary'}
        fontWeight={warning ? 'fontWeightBold' : undefined}
      >
        {value}
      </Typography>
    </Stack>
  );
}
