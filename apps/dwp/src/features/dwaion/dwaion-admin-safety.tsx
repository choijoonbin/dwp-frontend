import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileDown,
  Gauge,
  History,
  LockKeyhole,
  Save,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  TestTube2,
} from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  FormDialog,
  FormField,
  foundationTokens,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
  PageCanvas,
  SelectField,
  SignalMetric,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  bootstrapDwaionSafetyPolicy,
  getDwaionSafetyPolicy,
  HttpError,
  updateDwaionSafetyPolicy,
  type BootstrapDwaionGovernancePoliciesRequest,
  type DwaionPolicyOutcome,
  type DwaionSafetyPolicy,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

const OUTCOME_OPTIONS = (['HANDOFF', 'DENY'] as const).map((value) => ({
  value,
  label: value,
}));

type BootstrapEditor = BootstrapDwaionGovernancePoliciesRequest;

export function DwaionAdminSafety() {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const queryClient = useQueryClient();
  const governUpdate = useDwaionGovernedMutation('route.dwaion.management.safety-update.action');
  const governBootstrap = useDwaionGovernedMutation(
    'route.dwaion.management.safety-bootstrap.action'
  );
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission('ADMIN.DWAION_SAFETY', 'UPDATE');
  const canManage = hasPermission('ADMIN.DWAION_SAFETY', 'MANAGE');
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'safety'],
    queryFn: getDwaionSafetyPolicy,
    staleTime: 20_000,
  });
  const [draft, setDraft] = useState<DwaionSafetyPolicy | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<'saved' | 'initialized' | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapEditor | null>(null);

  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  const dirty = useMemo(
    () =>
      Boolean(
        draft &&
        query.data &&
        (draft.privilegedDataOutcome !== query.data.privilegedDataOutcome ||
          draft.mutationOutcome !== query.data.mutationOutcome ||
          draft.maxSourceScopes !== query.data.maxSourceScopes ||
          draft.maxToolCalls !== query.data.maxToolCalls)
      ),
    [draft, query.data]
  );
  const invalid = !dirty || reason.trim().length < 10;
  const uninitialized = query.error instanceof HttpError && query.error.status === 404;

  const mutation = useMutation({
    mutationFn: () =>
      governUpdate((authority) =>
        updateDwaionSafetyPolicy(
          {
            privilegedDataOutcome: draft!.privilegedDataOutcome,
            mutationOutcome: draft!.mutationOutcome,
            requireCitations: true,
            maxSourceScopes: draft!.maxSourceScopes,
            maxToolCalls: draft!.maxToolCalls,
            expectedVersion: query.data!.policyVersion,
            changeReason: reason.trim(),
          },
          authority
        )
      ),
    onSuccess: async (policy) => {
      queryClient.setQueryData(['dwaion', 'admin', 'safety'], policy);
      setDraft(policy);
      setReason('');
      setNotice('saved');
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'overview'] });
    },
  });
  const bootstrapMutation = useMutation({
    mutationFn: (request: BootstrapDwaionGovernancePoliciesRequest) =>
      governBootstrap((authority) => bootstrapDwaionSafetyPolicy(request, authority)),
    onSuccess: async (policy) => {
      queryClient.setQueryData(['dwaion', 'admin', 'safety'], policy);
      setDraft(policy);
      setBootstrap(null);
      setNotice('initialized');
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'overview'] });
    },
  });

  const outcomeLabel = (value: DwaionPolicyOutcome) =>
    t(`dwaionAdmin.safety.outcomes.${value}`, { defaultValue: value });
  const restrictiveCount = draft
    ? Number(draft.promptInjectionOutcome !== 'ALLOW') +
      Number(draft.requireCitations) +
      Number(!draft.publicWebEnabled)
    : 0;

  return (
    <PageCanvas topInset="compact">
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.safety.eyebrow')}
        title={t('dwaionAdmin.safety.title')}
        description={t('dwaionAdmin.safety.description')}
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="stretch">
            <ActionButton intent="secondary" startIcon={<History size={16} />} disabled>
              {t('dwaionAdmin.safety.historyUnavailable')}
            </ActionButton>
            <ActionButton intent="secondary" startIcon={<FileDown size={16} />} disabled>
              {t('dwaionAdmin.safety.schemaUnavailable')}
            </ActionButton>
            <ActionButton intent="secondary" startIcon={<TestTube2 size={16} />} disabled>
              {t('dwaionAdmin.safety.simulationUnavailable')}
            </ActionButton>
            {draft && canUpdate ? (
              <ActionButton
                intent="primary"
                startIcon={<Save size={16} />}
                disabled={invalid}
                loading={mutation.isPending}
                loadingLabel={t('dwaionAdmin.shared.saving')}
                onClick={() => mutation.mutate()}
              >
                {t('dwaionAdmin.shared.save')}
              </ActionButton>
            ) : uninitialized && canManage ? (
              <ActionButton
                intent="primary"
                startIcon={<ShieldAlert size={16} />}
                onClick={() =>
                  setBootstrap({
                    idempotencyKey: crypto.randomUUID(),
                    expectedExistingCount: 0,
                    changeReason: '',
                  })
                }
              >
                {t('dwaionAdmin.safety.initialize')}
              </ActionButton>
            ) : undefined}
          </Stack>
        }
      />

      {notice && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setNotice(null)}>
          {t(`dwaionAdmin.safety.${notice}`)}
        </Alert>
      )}
      {mutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.safety.error')}
        </Alert>
      )}
      <InlineFeedback severity="info" sx={{ mt: 2 }}>
        {t('dwaionAdmin.safety.contractNotice')}
      </InlineFeedback>

      {query.isLoading ? (
        <LoadingState
          label={t('dwaionAdmin.safety.loading')}
          variant="skeleton"
          skeletonRows={7}
          size="page"
        />
      ) : query.isError || !draft ? (
        <Box sx={{ mt: 3 }}>
          <ErrorState
            title={
              uninitialized ? t('dwaionAdmin.safety.notInitialized') : t('dwaionAdmin.safety.error')
            }
            description={
              uninitialized
                ? t('dwaionAdmin.safety.notInitializedDescription')
                : t('dwaionAdmin.safety.unavailableDescription')
            }
            retryLabel={t('dwaionAdmin.shared.retry')}
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
            size="page"
          />
        </Box>
      ) : (
        <>
          <Box
            component="section"
            aria-label={t('dwaionAdmin.safety.summaryLabel')}
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <SignalMetric
              label={t('dwaionAdmin.safety.summary.baseline')}
              value={`${restrictiveCount} / 3`}
              detail={t('dwaionAdmin.safety.summary.baselineDetail')}
              icon={<LockKeyhole size={18} />}
              tone="success"
            />
            <SignalMetric
              label={t('dwaionAdmin.safety.summary.routes')}
              value={`${outcomeLabel(draft.privilegedDataOutcome)} · ${outcomeLabel(draft.mutationOutcome)}`}
              detail={t('dwaionAdmin.safety.summary.routesDetail')}
              icon={<ShieldCheck size={18} />}
              tone="info"
            />
            <SignalMetric
              label={t('dwaionAdmin.safety.summary.budgets')}
              value={`${draft.maxSourceScopes} · ${draft.maxToolCalls}`}
              detail={t('dwaionAdmin.safety.summary.budgetsDetail')}
              icon={<Gauge size={18} />}
              tone="warning"
            />
            <SignalMetric
              label={t('dwaionAdmin.safety.summary.revision')}
              value={`v${draft.policyVersion}`}
              detail={formatDate(
                draft.updatedAt,
                { dateStyle: 'medium', timeStyle: 'short' },
                locale
              )}
              icon={<Settings2 size={18} />}
            />
          </Box>

          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'minmax(0, 2fr) minmax(280px, 1fr)',
              },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Stack spacing={2} sx={{ minWidth: 0 }}>
              <PolicySection
                title={t('dwaionAdmin.safety.baselineTitle')}
                description={t('dwaionAdmin.safety.baselineDescription')}
                badge={t('dwaionAdmin.safety.serverControlled')}
              >
                <SafetyRow
                  title={t('dwaionAdmin.safety.prompt.title')}
                  description={t('dwaionAdmin.safety.prompt.description')}
                  value={outcomeLabel(draft.promptInjectionOutcome)}
                />
                <Divider />
                <SafetyRow
                  title={t('dwaionAdmin.safety.citations.title')}
                  description={t('dwaionAdmin.safety.citations.description')}
                  value={
                    draft.requireCitations
                      ? t('dwaionAdmin.shared.required')
                      : t('dwaionAdmin.safety.notRequired')
                  }
                />
                <Divider />
                <SafetyRow
                  title={t('dwaionAdmin.safety.web.title')}
                  description={t('dwaionAdmin.safety.web.description')}
                  value={
                    draft.publicWebEnabled
                      ? t('dwaionAdmin.shared.enabled')
                      : t('dwaionAdmin.shared.blocked')
                  }
                />
              </PolicySection>

              <PolicySection
                title={t('dwaionAdmin.safety.parametersTitle')}
                description={t('dwaionAdmin.safety.parametersDescription')}
                badge={
                  canUpdate ? t('dwaionAdmin.safety.editable') : t('dwaionAdmin.safety.readOnly')
                }
              >
                <SafetyRow
                  title={t('dwaionAdmin.safety.privileged.title')}
                  description={t('dwaionAdmin.safety.privileged.description')}
                  control={
                    <SelectField<DwaionPolicyOutcome>
                      size="small"
                      aria-label={t('dwaionAdmin.safety.privileged.title')}
                      value={draft.privilegedDataOutcome}
                      options={OUTCOME_OPTIONS.map((option) => ({
                        ...option,
                        label: outcomeLabel(option.value),
                      }))}
                      disabled={!canUpdate}
                      onValueChange={(value) =>
                        value && setDraft({ ...draft, privilegedDataOutcome: value })
                      }
                      sx={{ width: { xs: 1, sm: 200 } }}
                    />
                  }
                />
                <Divider />
                <SafetyRow
                  title={t('dwaionAdmin.safety.mutation.title')}
                  description={t('dwaionAdmin.safety.mutation.description')}
                  control={
                    <SelectField<DwaionPolicyOutcome>
                      size="small"
                      aria-label={t('dwaionAdmin.safety.mutation.title')}
                      value={draft.mutationOutcome}
                      options={OUTCOME_OPTIONS.map((option) => ({
                        ...option,
                        label: outcomeLabel(option.value),
                      }))}
                      disabled={!canUpdate}
                      onValueChange={(value) =>
                        value && setDraft({ ...draft, mutationOutcome: value })
                      }
                      sx={{ width: { xs: 1, sm: 200 } }}
                    />
                  }
                />
                <Divider />
                <Box
                  sx={{
                    py: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 3,
                  }}
                >
                  <PolicySlider
                    label={t('dwaionAdmin.safety.maxSources')}
                    value={draft.maxSourceScopes}
                    min={1}
                    max={7}
                    disabled={!canUpdate}
                    onChange={(value) => setDraft({ ...draft, maxSourceScopes: value })}
                  />
                  <PolicySlider
                    label={t('dwaionAdmin.safety.maxTools')}
                    value={draft.maxToolCalls}
                    min={0}
                    max={10}
                    disabled={!canUpdate}
                    onChange={(value) => setDraft({ ...draft, maxToolCalls: value })}
                  />
                </Box>
                <FormField
                  label={t('dwaionAdmin.shared.reason')}
                  value={reason}
                  disabled={!canUpdate || !dirty}
                  multiline
                  minRows={3}
                  onChange={(event) => setReason(event.target.value)}
                  errorMessage={
                    dirty && reason && reason.trim().length < 10
                      ? t('dwaionAdmin.shared.reasonError')
                      : undefined
                  }
                  sx={{ mt: 1 }}
                />
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="flex-start"
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  gap={1}
                  sx={{ mt: 2 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t('dwaionAdmin.shared.version', { version: draft.policyVersion })}
                  </Typography>
                </Stack>
              </PolicySection>
            </Stack>

            <Stack spacing={2} sx={{ minWidth: 0 }}>
              <PolicySection
                title={t('dwaionAdmin.safety.evidenceTitle')}
                description={t('dwaionAdmin.safety.evidenceDescription')}
                badge={t('dwaionAdmin.safety.configurationOnly')}
              >
                <EvidenceValue
                  label={t('dwaionAdmin.safety.policyVersion')}
                  value={String(draft.policyVersion)}
                />
                <EvidenceValue
                  label={t('dwaionAdmin.safety.updatedAt')}
                  value={formatDate(
                    draft.updatedAt,
                    { dateStyle: 'medium', timeStyle: 'short' },
                    locale
                  )}
                />
                {(['runtimeEnforcement', 'detectionLatency', 'dryRun', 'health'] as const).map(
                  (key) => (
                    <EvidenceValue
                      key={key}
                      label={t(`dwaionAdmin.safety.unsupported.${key}`)}
                      value={t('dwaionAdmin.safety.notProvided')}
                      muted
                    />
                  )
                )}
              </PolicySection>
              <PolicySection
                title={t('dwaionAdmin.safety.controlMapTitle')}
                description={t('dwaionAdmin.safety.controlMapDescription')}
                badge={t('dwaionAdmin.safety.controlMapBadge')}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr)',
                    gap: 1,
                  }}
                >
                  <PolicyBoundaryCard
                    index={1}
                    title={t('dwaionAdmin.safety.prompt.title')}
                    description={t('dwaionAdmin.safety.prompt.description')}
                    value={outcomeLabel(draft.promptInjectionOutcome)}
                    restrictive={draft.promptInjectionOutcome !== 'ALLOW'}
                  />
                  <PolicyBoundaryCard
                    index={2}
                    title={t('dwaionAdmin.safety.citations.title')}
                    description={t('dwaionAdmin.safety.citations.description')}
                    value={
                      draft.requireCitations
                        ? t('dwaionAdmin.shared.required')
                        : t('dwaionAdmin.safety.notRequired')
                    }
                    restrictive={draft.requireCitations}
                  />
                  <PolicyBoundaryCard
                    index={3}
                    title={t('dwaionAdmin.safety.web.title')}
                    description={t('dwaionAdmin.safety.web.description')}
                    value={
                      draft.publicWebEnabled
                        ? t('dwaionAdmin.shared.enabled')
                        : t('dwaionAdmin.shared.blocked')
                    }
                    restrictive={!draft.publicWebEnabled}
                  />
                  <PolicyBoundaryCard
                    index={4}
                    title={t('dwaionAdmin.safety.privileged.title')}
                    description={t('dwaionAdmin.safety.privileged.description')}
                    value={outcomeLabel(draft.privilegedDataOutcome)}
                    restrictive={draft.privilegedDataOutcome !== 'ALLOW'}
                  />
                  <PolicyBoundaryCard
                    index={5}
                    title={t('dwaionAdmin.safety.mutation.title')}
                    description={t('dwaionAdmin.safety.mutation.description')}
                    value={outcomeLabel(draft.mutationOutcome)}
                    restrictive={draft.mutationOutcome !== 'ALLOW'}
                    wide
                  />
                </Box>
              </PolicySection>
            </Stack>
          </Box>
        </>
      )}

      <FormDialog
        open={Boolean(bootstrap)}
        title={t('dwaionAdmin.safety.initializeTitle')}
        description={t('dwaionAdmin.safety.initializeDescription')}
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        submitLabel={t('dwaionAdmin.safety.initialize')}
        submittingLabel={t('dwaionAdmin.shared.saving')}
        busy={bootstrapMutation.isPending}
        submitDisabled={!bootstrap || bootstrap.changeReason.trim().length < 10}
        onClose={() => setBootstrap(null)}
        onSubmit={() => {
          if (bootstrap) bootstrapMutation.mutate(bootstrap);
        }}
      >
        <Stack spacing={2}>
          {bootstrapMutation.isError && (
            <LocalErrorState title={t('dwaionAdmin.safety.error')} size="compact" />
          )}
          <InlineFeedback severity="warning">
            {t('dwaionAdmin.safety.initializeBoundary')}
          </InlineFeedback>
          <FormField
            label={t('dwaionAdmin.shared.reason')}
            value={bootstrap?.changeReason ?? ''}
            multiline
            minRows={3}
            onChange={(event) =>
              setBootstrap((current) =>
                current ? { ...current, changeReason: event.target.value } : current
              )
            }
            errorMessage={
              bootstrap?.changeReason && bootstrap.changeReason.trim().length < 10
                ? t('dwaionAdmin.shared.reasonError')
                : undefined
            }
          />
        </Stack>
      </FormDialog>
    </PageCanvas>
  );
}

function PolicySection({
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
        borderRadius: foundationTokens.radius.surface + 'px',
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
          <Typography component="h2" variant="h6">
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

function SafetyRow({
  title,
  description,
  value,
  control,
}: {
  title: string;
  description: string;
  value?: string;
  control?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', sm: 'center' }}
      gap={2}
      sx={{ py: 1.6 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight="fontWeightBold">
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {description}
        </Typography>
      </Box>
      {control ?? (
        <Typography variant="body2" fontWeight="fontWeightBold" sx={{ flexShrink: 0 }}>
          {value}
        </Typography>
      )}
    </Stack>
  );
}

function PolicySlider({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2" fontWeight="fontWeightBold">
          {label}
        </Typography>
        <Typography variant="body2">{value}</Typography>
      </Stack>
      <Slider
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={1}
        marks
        disabled={disabled}
        onChange={(_, next) => onChange(next as number)}
        sx={{ mt: 1 }}
      />
    </Box>
  );
}

function PolicyBoundaryCard({
  index,
  title,
  description,
  value,
  restrictive,
  wide = false,
}: {
  index: number;
  title: string;
  description: string;
  value: string;
  restrictive: boolean;
  wide?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '26px minmax(0, 1fr)',
        gap: 1.25,
        alignItems: 'start',
        minHeight: 88,
        p: 1.35,
        border: 1,
        borderColor: restrictive ? 'success.light' : 'warning.light',
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.25 + 'px',
        bgcolor: restrictive ? 'var(--dwp-product-soft)' : 'var(--dwp-semantic-warning-soft)',
        gridColumn: wide ? { sm: '1 / -1' } : undefined,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 26,
          height: 26,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          bgcolor: restrictive ? 'success.main' : 'warning.main',
          color: restrictive ? 'success.contrastText' : 'warning.contrastText',
          fontWeight: 'fontWeightBold',
          fontSize: 'body2.fontSize',
        }}
      >
        {index}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
            {title}
          </Typography>
          <Chip
            size="small"
            color={restrictive ? 'success' : 'warning'}
            variant="outlined"
            label={value}
            sx={{ flexShrink: 0 }}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.55 }}>
          {description}
        </Typography>
      </Box>
    </Box>
  );
}

function EvidenceValue({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      gap={0.5}
      sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography variant="body2">{label}</Typography>
      <Typography variant="caption" color={muted ? 'text.secondary' : 'text.primary'}>
        {value}
      </Typography>
    </Stack>
  );
}
