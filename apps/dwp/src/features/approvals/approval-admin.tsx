import { useTranslation } from 'react-i18next';
import {
  Activity,
  CheckCircle2,
  CloudCog,
  FileStack,
  GitBranch,
  KeyRound,
  RefreshCcw,
  ShieldCheck,
  TimerReset,
  TriangleAlert,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionIconButton, SignalMetric } from '@dwp-frontend/design-system';
import {
  formatDate as formatLocalizedDate,
  resolveSupportedLocale,
} from '@dwp-frontend/shared-i18n';
import {
  getApprovalAdminOverview,
  getApprovalOperations,
  getApprovalSignatureProviders,
  retryApprovalIntegrationDelivery,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { ApprovalFormStudio } from './approval-form-studio';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { approvalDeliveryRetryCommand } from './approval-high-risk-command-model';
import { ApprovalPolicyStudio } from './approval-policy-studio';
import { ApprovalWorkflowStudio } from './approval-workflow-studio';
import { ApprovalLinkRow, ApprovalSurface, StatusChip, approvalTone } from './approval-ui';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';
import { useApprovalHighRiskCommand } from './use-approval-high-risk-command';

import type { ApprovalView } from './approval-navigation';

export function ApprovalAdmin({
  view,
}: {
  view: Extract<
    ApprovalView,
    'admin-overview' | 'workflows' | 'forms' | 'policies' | 'operations' | 'signatures'
  >;
}) {
  if (view === 'admin-overview') return <ApprovalAdminOverview />;
  if (view === 'workflows') return <ApprovalWorkflowStudio />;
  if (view === 'forms') return <ApprovalFormStudio />;
  if (view === 'policies') return <ApprovalPolicyStudio />;
  if (view === 'operations') return <ApprovalOperationsAdmin />;
  return <ApprovalSignatureAdmin />;
}

function ApprovalAdminOverview() {
  const { t } = useTranslation('approvals');
  const requestScope = useApprovalManagementRequestScope();
  const overview = useQuery({
    queryKey: ['approvals', 'admin', 'overview', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getApprovalAdminOverview(requestScope.contextScopeKey, signal),
    staleTime: 20_000,
  });
  if (overview.isError) return <ErrorPanel />;
  const data = overview.data;
  const metrics = [
    {
      label: t('admin.publishedWorkflows'),
      value: data?.publishedWorkflows ?? 0,
      icon: <GitBranch size={17} />,
      tone: 'primary' as const,
    },
    {
      label: t('admin.draftWorkflows'),
      value: data?.draftWorkflows ?? 0,
      icon: <FileStack size={17} />,
      tone: 'info' as const,
    },
    {
      label: t('admin.activeRequests'),
      value: data?.activeRequests ?? 0,
      icon: <Activity size={17} />,
      tone: 'success' as const,
    },
    {
      label: t('admin.overdueTasks'),
      value: data?.overdueTasks ?? 0,
      icon: <TimerReset size={17} />,
      tone: 'warning' as const,
    },
    {
      label: t('admin.failedIntegrations'),
      value: data?.failedIntegrations ?? 0,
      icon: <CloudCog size={17} />,
      tone: 'error' as const,
    },
  ];
  return (
    <Stack gap={2}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(5, 1fr)' },
          gap: 1.5,
        }}
      >
        {metrics.map((metric) => (
          <SignalMetric
            key={metric.label}
            label={metric.label}
            value={String(metric.value)}
            detail={t('admin.metricDetail')}
            icon={metric.icon}
            tone={metric.tone}
          />
        ))}
      </Box>
      <Box
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 2 }}
      >
        <ApprovalSurface title={t('admin.controlModel.title')} meta={t('admin.controlModel.meta')}>
          {['designer', 'publisher', 'operator', 'auditor'].map((role, index) => (
            <ApprovalLinkRow
              key={role}
              title={t(`admin.controlModel.${role}.title`)}
              detail={t(`admin.controlModel.${role}.detail`)}
              route={index < 2 ? '/approvals/admin/workflows' : '/approvals/admin/operations'}
              icon={index < 2 ? GitBranch : ShieldCheck}
              tone={index === 1 ? approvalTone.amber : approvalTone.primary}
            />
          ))}
        </ApprovalSurface>
        <ApprovalSurface title={t('admin.assurance.title')} meta={t('admin.assurance.meta')}>
          {(data?.assurance ?? []).map((signal) => {
            const attention = signal.state === 'ATTENTION';
            const SignalIcon = attention ? TriangleAlert : CheckCircle2;
            return (
              <Stack
                key={signal.key}
                direction="row"
                alignItems="flex-start"
                gap={1.25}
                sx={{ px: 2, py: 1.6, borderBottom: 1, borderColor: 'divider' }}
              >
                <SignalIcon size={18} color={attention ? approvalTone.amber : approvalTone.teal} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={740}>
                    {t(`admin.assurance.${signal.key}.title`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`admin.assurance.${signal.key}.detail`)}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  color={attention ? 'warning' : 'success'}
                  label={
                    attention
                      ? t('admin.assurance.states.attention', { count: signal.exceptions })
                      : t('admin.assurance.states.enforced')
                  }
                />
              </Stack>
            );
          })}
        </ApprovalSurface>
      </Box>
    </Stack>
  );
}

function ApprovalOperationsAdmin() {
  const { t, i18n } = useTranslation('approvals');
  const queryClient = useQueryClient();
  const { canOperate } = useApprovalExperience();
  const requestScope = useApprovalManagementRequestScope();
  const operationsQueryKey = [
    'approvals',
    'admin',
    'operations',
    ...requestScope.cacheKey,
  ] as const;
  const operations = useQuery({
    queryKey: operationsQueryKey,
    queryFn: ({ signal }) => getApprovalOperations(requestScope.contextScopeKey, signal),
    refetchInterval: 30_000,
  });
  const highRiskRetry = useApprovalHighRiskCommand({
    operation: 'DELIVERY_RETRY',
    execute: (command, execution) =>
      retryApprovalIntegrationDelivery(command.targetId, command.expectedObjectVersion, execution),
    onSuccess: (data) => {
      queryClient.setQueryData(operationsQueryKey, data);
    },
    onConflict: async () => {
      await queryClient.invalidateQueries({ queryKey: ['approvals', 'admin', 'operations'] });
    },
  });
  const formatDate = (value?: string | null) =>
    value
      ? formatLocalizedDate(
          value,
          {
            dateStyle: 'short',
            timeStyle: 'short',
          },
          resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
        )
      : t('admin.integrations.notAvailable');
  if (operations.isError) return <ErrorPanel />;
  return (
    <Stack gap={2}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        {(operations.data?.signals ?? []).map((signal) => (
          <SignalMetric
            key={signal.key}
            label={i18n.resolvedLanguage?.startsWith('ko') ? signal.titleKo : signal.titleEn}
            value={String(signal.count)}
            detail={i18n.resolvedLanguage?.startsWith('ko') ? signal.detailKo : signal.detailEn}
            icon={signal.key === 'integration' ? <CloudCog size={17} /> : <Activity size={17} />}
            tone={
              signal.state === 'HEALTHY'
                ? 'success'
                : signal.state === 'INFORMATIONAL'
                  ? 'info'
                  : 'warning'
            }
          />
        ))}
      </Box>
      <ApprovalSurface title={t('admin.breached.title')} meta={t('admin.breached.meta')}>
        {(operations.data?.breachedTasks ?? []).map((task) => (
          <ApprovalLinkRow
            key={task.taskId}
            title={task.title}
            detail={`${task.requestNumber} · ${task.requesterName}`}
            route="/approvals/inbox"
            tone={approvalTone.red}
            trailing={<Chip size="small" color="error" label={task.riskScore} />}
          />
        ))}
      </ApprovalSurface>
      <ApprovalSurface
        title={t('admin.integrations.title')}
        meta={t('admin.integrations.meta')}
        action={
          <Chip
            size="small"
            variant="outlined"
            label={t('admin.integrations.eventCount', {
              count: operations.data?.integrationDeliveries.length ?? 0,
            })}
          />
        }
      >
        {(operations.data?.integrationDeliveries.length ?? 0) === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 3 }}>
            {t('admin.integrations.empty')}
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label={t('admin.integrations.title')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.integrations.columns.event')}</TableCell>
                  <TableCell>{t('admin.integrations.columns.status')}</TableCell>
                  <TableCell align="right">{t('admin.integrations.columns.attempts')}</TableCell>
                  <TableCell>{t('admin.integrations.columns.updated')}</TableCell>
                  <TableCell>{t('admin.integrations.columns.error')}</TableCell>
                  <TableCell align="right">{t('admin.integrations.columns.action')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(operations.data?.integrationDeliveries ?? []).map((delivery) => {
                  const retryable =
                    (delivery.status === 'FAILED' || delivery.status === 'DEAD') &&
                    Number.isSafeInteger(delivery.version);
                  return (
                    <TableRow key={delivery.outboxId} hover>
                      <TableCell sx={{ minWidth: 220 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {delivery.eventType}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {delivery.eventId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={delivery.status} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {delivery.attemptCount}
                          {delivery.manualRetryCount > 0 ? ` + ${delivery.manualRetryCount}` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatDate(
                          delivery.lastRetriedAt ?? delivery.publishedAt ?? delivery.createdAt
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 360 }}>
                        <Tooltip title={delivery.lastError ?? ''} placement="top-start">
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {delivery.lastError ?? t('admin.integrations.noError')}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right" sx={{ pr: { xs: 12, sm: 2 } }}>
                        <ActionIconButton
                          label={t('admin.integrations.retry')}
                          tooltip={
                            canOperate
                              ? t('admin.integrations.retry')
                              : t('admin.integrations.retryRestricted')
                          }
                          size="small"
                          disabled={!canOperate || !retryable}
                          loading={highRiskRetry.controller.busy}
                          onClick={() =>
                            void highRiskRetry.begin(
                              approvalDeliveryRetryCommand(delivery.outboxId, delivery.version)
                            )
                          }
                        >
                          <RefreshCcw size={16} />
                        </ActionIconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </ApprovalSurface>
      <ApprovalHighRiskCommandDialog controller={highRiskRetry.controller} />
    </Stack>
  );
}

function ApprovalSignatureAdmin() {
  const { t } = useTranslation('approvals');
  const requestScope = useApprovalManagementRequestScope();
  const providers = useQuery({
    queryKey: ['approvals', 'admin', 'signatures', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getApprovalSignatureProviders(requestScope.contextScopeKey, signal),
    staleTime: 60_000,
  });
  if (providers.isError) return <ErrorPanel />;
  return (
    <Stack gap={2}>
      <Alert severity="info">{t('admin.signatures.gate')}</Alert>
      <Box
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}
      >
        {(providers.data ?? []).map((provider) => (
          <ApprovalSurface
            key={provider.providerId}
            title={provider.displayName}
            meta={provider.providerType}
            action={<KeyRound size={18} />}
          >
            <Stack gap={1.5} sx={{ p: 2 }}>
              <StatusChip status={provider.lifecycleState} />
              <Typography variant="body2" color="text.secondary">
                {t(
                  provider.credentialConfigured
                    ? 'admin.signatures.configured'
                    : 'admin.signatures.notConfigured'
                )}
              </Typography>
              <Stack gap={0.75}>
                {Object.entries(provider.capabilities).map(([key, value]) => (
                  <Stack key={key} direction="row" justifyContent="space-between" gap={1}>
                    <Typography variant="caption" color="text.secondary">
                      {key}
                    </Typography>
                    <Typography variant="caption" fontWeight={700}>
                      {String(value)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </ApprovalSurface>
        ))}
      </Box>
    </Stack>
  );
}

function ErrorPanel() {
  const { t } = useTranslation('approvals');
  return <Alert severity="error">{t('admin.loadError')}</Alert>;
}
