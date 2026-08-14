import { useTranslation } from 'react-i18next';
import {
  Activity,
  CheckCircle2,
  CloudCog,
  FileStack,
  GitBranch,
  KeyRound,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { SignalMetric } from '@dwp-frontend/design-system';
import {
  getApprovalAdminOverview,
  getApprovalOperations,
  getApprovalSignatureProviders,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalFormStudio } from './approval-form-studio';
import { ApprovalPolicyStudio } from './approval-policy-studio';
import { ApprovalWorkflowStudio } from './approval-workflow-studio';
import { ApprovalLinkRow, ApprovalSurface, StatusChip, approvalTone } from './approval-ui';

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
  const overview = useQuery({
    queryKey: ['approvals', 'admin', 'overview'],
    queryFn: getApprovalAdminOverview,
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
          {['identity', 'segregation', 'evidence', 'delivery'].map((item) => (
            <Stack
              key={item}
              direction="row"
              gap={1.25}
              sx={{ px: 2, py: 1.6, borderBottom: 1, borderColor: 'divider' }}
            >
              <CheckCircle2 size={18} color={approvalTone.teal} />
              <Box>
                <Typography variant="body2" fontWeight={740}>
                  {t(`admin.assurance.${item}.title`)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(`admin.assurance.${item}.detail`)}
                </Typography>
              </Box>
            </Stack>
          ))}
        </ApprovalSurface>
      </Box>
    </Stack>
  );
}

function ApprovalOperationsAdmin() {
  const { t, i18n } = useTranslation('approvals');
  const operations = useQuery({
    queryKey: ['approvals', 'admin', 'operations'],
    queryFn: getApprovalOperations,
    refetchInterval: 30_000,
  });
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
    </Stack>
  );
}

function ApprovalSignatureAdmin() {
  const { t } = useTranslation('approvals');
  const providers = useQuery({
    queryKey: ['approvals', 'admin', 'signatures'],
    queryFn: getApprovalSignatureProviders,
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
