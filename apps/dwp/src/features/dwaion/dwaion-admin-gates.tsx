import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ErrorState,
  FormDialog,
  FormField,
  foundationTokens,
  InlineFeedback,
  LoadingState,
  PageCanvas,
  SignalMetric,
} from '@dwp-frontend/design-system';
import {
  bootstrapDwaionOperationalGates,
  getDwaionOperationalGate,
  getDwaionOperationalGatePortfolio,
  type BootstrapDwaionOperationalGatesRequest,
  type DwaionGateEnvironment,
  type DwaionOperationalGate,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import {
  BadgeCheck,
  CircleAlert,
  FileCheck2,
  FileDown,
  FileSearch2,
  History,
  ListChecks,
  LockKeyhole,
  ScanSearch,
  Settings2,
  ShieldCheck,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';
import { DwaionGateDialogHost, type GateDialogAction } from './dwaion-gate-dialogs';
import { DwaionGateReview } from './dwaion-gate-review';
import { gateCategoryLabel, gateDescription, gateOptionLabel, gateTitle } from './dwaion-gate-ui';
import { DwaionAdminRegistry, useAdminRegistryCopy } from './dwaion-admin-registry';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

const ENVIRONMENTS: DwaionGateEnvironment[] = ['DEVELOPMENT', 'STAGING', 'PRODUCTION'];

export function DwaionAdminGates() {
  const { t } = useTranslation('work');
  const copy = useAdminRegistryCopy();
  const queryClient = useQueryClient();
  const governBootstrap = useDwaionGovernedMutation(
    'route.dwaion.management.gates-bootstrap.action'
  );
  const { hasPermission } = usePermissions();
  const [params, setParams] = useSearchParams();
  const desktopInspector = useMediaQuery(useTheme().breakpoints.up('md'));
  const [environment, setEnvironment] = useState<DwaionGateEnvironment>('PRODUCTION');
  const [action, setAction] = useState<GateDialogAction>(null);
  const [saved, setSaved] = useState(false);
  const [bootstrap, setBootstrap] = useState<BootstrapDwaionOperationalGatesRequest | null>(null);
  const canUpdate = hasPermission('ADMIN.DWAION_GATES', 'UPDATE');
  const canCreate = hasPermission('ADMIN.DWAION_GATES', 'CREATE');
  const canApprove = hasPermission('ADMIN.DWAION_GATES', 'APPROVE');
  const canManage = hasPermission('ADMIN.DWAION_GATES', 'MANAGE');

  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'gates', environment],
    queryFn: () => getDwaionOperationalGatePortfolio(environment),
    staleTime: 15_000,
  });
  const portfolio = query.data;
  const firstEntryId = portfolio?.gates[0]?.gateKey;

  useEffect(() => {
    if (!desktopInspector || !firstEntryId || params.has('entry')) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('entry', firstEntryId);
        return next;
      },
      { replace: true, preventScrollReset: true }
    );
  }, [desktopInspector, firstEntryId, params, setParams]);

  const bootstrapMutation = useMutation({
    mutationFn: (request: BootstrapDwaionOperationalGatesRequest) =>
      governBootstrap((authority) =>
        bootstrapDwaionOperationalGates(environment, request, authority)
      ),
    onSuccess: async (data) => {
      setBootstrap(null);
      setSaved(true);
      queryClient.setQueryData(['dwaion', 'admin', 'gates', environment], data);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'gates', environment] });
    },
  });

  return (
    <PageCanvas topInset="compact">
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.shared.governance')}
        title={t('dwaionAdmin.gates.title')}
        description={t('dwaionAdmin.gates.description')}
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="stretch">
            <ActionButton intent="secondary" startIcon={<History size={16} />} disabled>
              {t('dwaionAdmin.gates.historyUnavailable')}
            </ActionButton>
            <ActionButton intent="secondary" startIcon={<FileDown size={16} />} disabled>
              {t('dwaionAdmin.gates.exportUnavailable')}
            </ActionButton>
            {!query.isLoading && !query.isError && portfolio?.gates.length === 0 && canManage ? (
              <ActionButton
                intent="primary"
                startIcon={<ListChecks size={16} />}
                onClick={() =>
                  setBootstrap({
                    idempotencyKey: crypto.randomUUID(),
                    expectedExistingCount: 0,
                    changeReason: '',
                  })
                }
              >
                {t('dwaionAdmin.gates.initialize')}
              </ActionButton>
            ) : (
              <ActionButton intent="primary" startIcon={<LockKeyhole size={16} />} disabled>
                {t('dwaionAdmin.gates.bulkAuthorizeUnavailable')}
              </ActionButton>
            )}
          </Stack>
        }
      />

      {saved && (
        <InlineFeedback
          severity="success"
          sx={{ mt: 2 }}
          onClose={() => setSaved(false)}
          closeLabel={t('dwaionAdmin.gates.review.close')}
        >
          {t('dwaionAdmin.gates.saved')}
        </InlineFeedback>
      )}
      <InlineFeedback severity="info" sx={{ mt: 2 }}>
        {t('dwaionAdmin.gates.contractNotice')}
      </InlineFeedback>

      {query.isError ? (
        <Box sx={{ mt: 3 }}>
          <ErrorState
            size="page"
            title={t('dwaionAdmin.gates.error')}
            description={t('dwaionAdmin.gates.unavailableDescription')}
            retryLabel={t('dwaionAdmin.shared.retry')}
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
          />
        </Box>
      ) : query.isLoading || !portfolio ? (
        <LoadingState
          size="page"
          variant="skeleton"
          label={t('dwaionAdmin.gates.loading')}
          skeletonRows={7}
        />
      ) : (
        <>
          <Box
            component="section"
            aria-label={t('dwaionAdmin.gates.summaryLabel')}
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <SignalMetric
              label={t('dwaionAdmin.gates.summary.registered')}
              value={String(portfolio.totalCount)}
              detail={t('dwaionAdmin.gates.summary.registeredDetail', {
                count: portfolio.requiredCount,
              })}
              icon={<ListChecks size={18} />}
            />
            <SignalMetric
              label={t('dwaionAdmin.gates.metrics.approved')}
              value={`${portfolio.approvedCount} / ${portfolio.requiredCount}`}
              detail={t('dwaionAdmin.gates.summary.approvedDetail', {
                count: portfolio.readyForApprovalCount,
              })}
              icon={<BadgeCheck size={18} />}
              tone="success"
            />
            <SignalMetric
              label={t('dwaionAdmin.gates.metrics.attention')}
              value={String(portfolio.blockedCount + portfolio.expiredCount)}
              detail={t('dwaionAdmin.gates.summary.attentionDetail', {
                blocked: portfolio.blockedCount,
                expired: portfolio.expiredCount,
              })}
              icon={<CircleAlert size={18} />}
              tone="error"
            />
            <SignalMetric
              label={t('dwaionAdmin.gates.metrics.readiness')}
              value={`${portfolio.completionPercent}%`}
              detail={t('dwaionAdmin.gates.summary.readinessDetail')}
              icon={<ShieldCheck size={18} />}
              tone={portfolio.deliveryReady ? 'success' : 'warning'}
              progress={portfolio.completionPercent}
              progressLabel={t('dwaionAdmin.gates.metrics.readiness')}
            />
          </Box>

          <InlineFeedback
            severity={
              portfolio.deliveryReady
                ? 'success'
                : portfolio.blockedCount + portfolio.expiredCount > 0
                  ? 'warning'
                  : 'info'
            }
            sx={{ mt: 2 }}
          >
            {portfolio.deliveryReady
              ? t('dwaionAdmin.gates.ready')
              : t('dwaionAdmin.gates.notReady')}
          </InlineFeedback>

          <Box
            sx={{
              mt: 2,
              p: { xs: 1.5, md: 2 },
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: foundationTokens.radius.surface + 'px',
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              gap={2}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <ShieldCheck size={19} />
                <Box>
                  <Typography component="h2" variant="h6">
                    {t('dwaionAdmin.gates.environmentTitle')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('dwaionAdmin.gates.environmentDescription')}
                  </Typography>
                </Box>
              </Stack>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={environment}
                aria-label={t('dwaionAdmin.gates.environmentTitle')}
                onChange={(_, value: DwaionGateEnvironment | null) => {
                  if (value) setEnvironment(value);
                }}
              >
                {ENVIRONMENTS.map((value) => (
                  <ToggleButton key={value} value={value}>
                    {t(`dwaionAdmin.gates.environments.${value}`)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>
            <GateCoveragePipeline gates={portfolio.gates} />
          </Box>

          <Box
            sx={{
              mt: 2,
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
              <Box>
                <Typography component="h2" variant="h6">
                  {t('dwaionAdmin.gates.registryTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('dwaionAdmin.gates.registryScope', {
                    count: portfolio.gates.length,
                    environment: t(`dwaionAdmin.gates.environments.${environment}`),
                  })}
                </Typography>
              </Box>
              <Chip size="small" variant="outlined" label={t('dwaionAdmin.gates.contract')} />
            </Stack>
            <DwaionAdminRegistry
              key={environment}
              label={t('dwaionAdmin.gates.tableLabel')}
              notice={copy.gateRatio}
              pageSize={7}
              showInspectorFields={false}
              inspectorMaxHeight="36rem"
              items={portfolio.gates.map((row) => ({
                id: row.gateKey,
                title: gateTitle(t, row.gateKey),
                description: gateDescription(t, row.gateKey),
                state: t(`dwaionAdmin.gates.statuses.${row.status}`),
                stateTone:
                  row.status === 'APPROVED'
                    ? 'success'
                    : ['BLOCKED', 'EXPIRED'].includes(row.status)
                      ? 'error'
                      : row.status === 'READY_FOR_APPROVAL'
                        ? 'info'
                        : 'warning',
                fields: [
                  [t('dwaionAdmin.gates.review.owner'), row.ownerUserId || row.externalOwner],
                  [t('dwaionAdmin.gates.columns.evidence'), row.evidenceCount],
                  [t('dwaionAdmin.gates.columns.category'), gateCategoryLabel(t, row.category)],
                  [
                    t('dwaionAdmin.gates.review.policy'),
                    row.selectedOption
                      ? gateOptionLabel(t, row.gateKey, row.selectedOption)
                      : t('dwaionAdmin.gates.notSelected'),
                  ],
                  [
                    t('dwaionAdmin.gates.columns.expires'),
                    row.expiresAt
                      ? formatDate(row.expiresAt, { dateStyle: 'medium' })
                      : t('dwaionAdmin.gates.noExpiry'),
                  ],
                  [copy.version, row.policyVersion],
                  [
                    copy.updated,
                    formatDate(row.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }),
                  ],
                ],
                detail: <GateInspector gate={row} environment={environment} />,
                actions: (
                  <>
                    <ActionButton
                      intent="secondary"
                      startIcon={<FileSearch2 size={16} />}
                      onClick={() => setAction({ kind: 'REVIEW', gate: row })}
                    >
                      {t('dwaionAdmin.gates.actions.review')}
                    </ActionButton>
                    {canUpdate && (
                      <ActionButton
                        intent="secondary"
                        startIcon={<Settings2 size={16} />}
                        onClick={() => setAction({ kind: 'CONFIGURE', gate: row })}
                      >
                        {t(
                          row.selectedOption
                            ? 'dwaionAdmin.gates.actions.reconfigure'
                            : 'dwaionAdmin.gates.actions.configure'
                        )}
                      </ActionButton>
                    )}
                    {canCreate &&
                      row.selectedOption &&
                      ['CONFIGURING', 'BLOCKED', 'READY_FOR_APPROVAL'].includes(row.status) && (
                        <ActionButton
                          intent="secondary"
                          startIcon={<FileCheck2 size={16} />}
                          onClick={() => setAction({ kind: 'EVIDENCE', gate: row })}
                        >
                          {t('dwaionAdmin.gates.actions.evidence')}
                        </ActionButton>
                      )}
                    {canUpdate &&
                      row.selectedOption &&
                      ['CONFIGURING', 'BLOCKED'].includes(row.status) && (
                        <ActionButton
                          intent="secondary"
                          startIcon={<ScanSearch size={16} />}
                          onClick={() => setAction({ kind: 'VALIDATE', gate: row })}
                        >
                          {t('dwaionAdmin.gates.actions.validate')}
                        </ActionButton>
                      )}
                    {canApprove && row.status === 'READY_FOR_APPROVAL' && (
                      <ActionButton
                        intent="primary"
                        startIcon={<BadgeCheck size={16} />}
                        onClick={() => setAction({ kind: 'DECIDE', gate: row })}
                      >
                        {t('dwaionAdmin.gates.actions.decide')}
                      </ActionButton>
                    )}
                  </>
                ),
              }))}
            />
          </Box>
        </>
      )}

      <DwaionGateDialogHost
        action={action}
        environment={environment}
        onClose={() => setAction(null)}
        onCompleted={() => setSaved(true)}
      />
      <FormDialog
        open={Boolean(bootstrap)}
        title={t('dwaionAdmin.gates.initializeTitle')}
        description={t('dwaionAdmin.gates.initializeDescription')}
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        submitLabel={t('dwaionAdmin.gates.initialize')}
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
            <InlineFeedback severity="error">{t('dwaionAdmin.gates.error')}</InlineFeedback>
          )}
          <InlineFeedback severity="warning">
            {t('dwaionAdmin.gates.initializeBoundary')}
          </InlineFeedback>
          {bootstrap && (
            <FormField
              label={t('dwaionAdmin.shared.reason')}
              value={bootstrap.changeReason}
              multiline
              minRows={3}
              onChange={(event) => setBootstrap({ ...bootstrap, changeReason: event.target.value })}
              errorMessage={
                bootstrap.changeReason && bootstrap.changeReason.trim().length < 10
                  ? t('dwaionAdmin.shared.reasonError')
                  : undefined
              }
            />
          )}
        </Stack>
      </FormDialog>
    </PageCanvas>
  );
}

function GateInspector({
  gate,
  environment,
}: {
  gate: DwaionOperationalGate;
  environment: DwaionGateEnvironment;
}) {
  const { t } = useTranslation('work');
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'gates', environment, gate.gateKey],
    queryFn: () => getDwaionOperationalGate(gate.gateKey, environment),
    staleTime: 15_000,
  });

  return (
    <Box component="section" aria-label={t('dwaionAdmin.gates.inspectorEvidence')}>
      <Box component="dl" sx={{ m: 0, mb: 1.5, display: 'grid', gridTemplateColumns: '1fr auto' }}>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('dwaionAdmin.shared.version', { version: '' }).trim()}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {gate.policyVersion}
        </Typography>
      </Box>
      <DwaionGateReview detail={query.data} loading={query.isLoading} error={query.isError} />
      <InlineFeedback severity="info" sx={{ mt: 2 }}>
        {t('dwaionAdmin.gates.unsupportedEvidence')}
      </InlineFeedback>
    </Box>
  );
}

function GateCoveragePipeline({ gates }: { gates: DwaionOperationalGate[] }) {
  const { t } = useTranslation('work');
  const groups = Array.from(new Set(gates.map((gate) => gate.category))).map((category) => {
    const categoryGates = gates.filter((gate) => gate.category === category);
    return {
      category,
      total: categoryGates.length,
      approved: categoryGates.filter((gate) => gate.status === 'APPROVED').length,
      ready: categoryGates.filter((gate) => gate.status === 'READY_FOR_APPROVAL').length,
      attention: categoryGates.filter((gate) => ['BLOCKED', 'EXPIRED'].includes(gate.status))
        .length,
    };
  });

  return (
    <Box
      component="section"
      aria-label={t('dwaionAdmin.gates.workflow.title')}
      sx={{
        mt: 2,
        pt: 1.5,
        borderTop: 1,
        borderColor: 'divider',
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(3, minmax(0, 1fr))',
          lg: `repeat(${Math.min(groups.length, 6)}, minmax(0, 1fr))`,
        },
        gap: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ gridColumn: '1 / -1' }}>
        {t('dwaionAdmin.gates.workflow.title')}
      </Typography>
      {groups.map((group, index) => {
        const percent = group.total ? Math.round((group.approved / group.total) * 100) : 0;
        const tone = group.attention
          ? 'error.main'
          : group.approved === group.total
            ? 'success.main'
            : group.ready
              ? 'info.main'
              : 'text.secondary';
        return (
          <Box
            key={group.category}
            sx={{
              p: 1,
              minWidth: 0,
              bgcolor: 'action.hover',
              borderRadius: foundationTokens.radius.control + 'px',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  borderRadius: '50%',
                  bgcolor: 'background.paper',
                  color: tone,
                  typography: 'caption',
                  fontWeight: 'fontWeightBold',
                }}
              >
                {index + 1}
              </Box>
              <Typography
                variant="caption"
                fontWeight="fontWeightBold"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {gateCategoryLabel(t, group.category)}
              </Typography>
            </Stack>
            <Box
              aria-hidden="true"
              sx={{
                mt: 0.75,
                height: 4,
                overflow: 'hidden',
                borderRadius: (theme) => Number(theme.shape.borderRadius) * 999 + 'px',
                bgcolor: 'divider',
              }}
            >
              <Box sx={{ width: `${percent}%`, height: 1, bgcolor: tone }} />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: 'block', mt: 0.5 }}
            >
              {group.approved} / {group.total} ·{' '}
              {group.attention
                ? t('dwaionAdmin.gates.metrics.attention')
                : group.ready
                  ? t('dwaionAdmin.gates.statuses.READY_FOR_APPROVAL')
                  : t('dwaionAdmin.gates.statuses.NOT_CONFIGURED')}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
