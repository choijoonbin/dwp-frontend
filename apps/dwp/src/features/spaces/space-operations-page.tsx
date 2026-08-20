import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  RotateCcw,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ActionButton, ActionIconButton, OperationalKpiStrip } from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import {
  getSpaceOperations,
  reconcileSpaceOperations,
  recoverSpaceOwner,
  retrySpaceEntitlement,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { SpaceFindingDrawer, SpaceFindingListItem } from './space-operations-finding';
import { SpaceOwnerRecoveryDialog } from './space-owner-recovery-dialog';

import type { SpaceOperationsDashboard } from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';

type Finding = SpaceOperationsDashboard['findings'][number];
type Delivery = SpaceOperationsDashboard['deliveries'][number];

const deliveryColor = {
  PENDING: 'default',
  IN_PROGRESS: 'info',
  SUCCEEDED: 'success',
  RETRY: 'warning',
  DEAD: 'error',
} as const;

function SectionTitle({
  icon,
  title,
  detail,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      gap={1.5}
      sx={{ mb: 1.5 }}
    >
      <Stack direction="row" gap={1.25} alignItems="center">
        <Box
          sx={{
            width: 36,
            height: 36,
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'action.selected',
            borderRadius: 1,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography component="h2" variant="h6">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {detail}
          </Typography>
        </Box>
      </Stack>
      {action}
    </Stack>
  );
}

function DeliveryRow({
  delivery,
  retrying,
  onRetry,
}: {
  delivery: Delivery;
  retrying: boolean;
  onRetry: (syncItemId: string) => void;
}) {
  const { t } = useTranslation('admin');
  const retryable = delivery.deliveryState === 'RETRY' || delivery.deliveryState === 'DEAD';
  return (
    <TableRow hover sx={{ '& td': { height: 64, py: 1 } }}>
      <TableCell>
        <Typography variant="body2" fontWeight={700}>
          {delivery.resourceKey}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {delivery.principalType} · {delivery.principalRef}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip size="small" variant="outlined" label={delivery.permissionCode} />
      </TableCell>
      <TableCell>{t(`spaces.operations.desired.${delivery.desiredState}`)}</TableCell>
      <TableCell>
        <Chip
          size="small"
          color={deliveryColor[delivery.deliveryState]}
          label={t(`spaces.operations.delivery.${delivery.deliveryState}`)}
        />
      </TableCell>
      <TableCell align="right">{formatNumber(delivery.attemptCount)}</TableCell>
      <TableCell>
        {delivery.synchronizedAt
          ? formatDate(delivery.synchronizedAt, { dateStyle: 'medium', timeStyle: 'short' })
          : t('spaces.operations.common.notAvailable')}
      </TableCell>
      <TableCell align="right">
        {retryable ? (
          <ActionIconButton
            size="small"
            disabled={retrying}
            loading={retrying}
            label={t('spaces.operations.actions.retry')}
            onClick={() => onRetry(delivery.syncItemId)}
          >
            <RotateCcw size={17} />
          </ActionIconButton>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function SpaceAdminOperations() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [ownerRecoveryFinding, setOwnerRecoveryFinding] = useState<Finding | null>(null);
  const operations = useQuery({
    queryKey: ['spaces', 'admin', 'operations'],
    queryFn: getSpaceOperations,
    refetchInterval: 30_000,
  });
  const reconcile = useMutation({
    mutationFn: reconcileSpaceOperations,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['spaces', 'admin'] });
      toast.success(t('spaces.operations.messages.reconciled'));
    },
    onError: () => toast.error(t('spaces.operations.messages.error')),
  });
  const retry = useMutation({
    mutationFn: retrySpaceEntitlement,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'operations'] });
      toast.success(t('spaces.operations.messages.retryQueued'));
    },
    onError: () => toast.error(t('spaces.operations.messages.error')),
  });
  const recoverOwner = useMutation({
    mutationFn: ({
      spaceKey,
      personPublicId,
      reason,
    }: {
      spaceKey: string;
      personPublicId: string;
      reason: string;
    }) => recoverSpaceOwner(spaceKey, { personPublicId, reason }),
    onSuccess: async () => {
      setOwnerRecoveryFinding(null);
      await queryClient.invalidateQueries({ queryKey: ['spaces', 'admin'] });
      toast.success(t('spaces.operations.ownerRecovery.success'));
    },
    onError: () => toast.error(t('spaces.operations.ownerRecovery.error')),
  });

  if (operations.isLoading) return <Skeleton variant="rounded" height={520} sx={{ mt: 3 }} />;
  if (operations.isError || !operations.data) {
    return (
      <Alert severity="error" sx={{ mt: 3 }}>
        {t('spaces.common.loadError')}
      </Alert>
    );
  }

  const data = operations.data;
  const healthy =
    data.entitlementProviderConfigured &&
    data.metrics.deadLetters === 0 &&
    data.metrics.highRiskFindings === 0;

  return (
    <Box>
      <Alert
        severity={healthy ? 'success' : data.entitlementProviderConfigured ? 'warning' : 'error'}
        icon={healthy ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
        action={
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<RefreshCw size={16} />}
            loading={reconcile.isPending}
            onClick={() => reconcile.mutate()}
          >
            {t('spaces.operations.actions.reconcile')}
          </ActionButton>
        }
        sx={{ mt: 3, alignItems: 'center' }}
      >
        <Typography variant="body2" fontWeight={750}>
          {healthy
            ? t('spaces.operations.health.healthy')
            : t('spaces.operations.health.attention')}
        </Typography>
        <Typography variant="caption">
          {data.entitlementProviderConfigured
            ? t('spaces.operations.health.connected')
            : t('spaces.operations.health.notConfigured')}
        </Typography>
      </Alert>

      <Box sx={{ mt: 2 }}>
        <OperationalKpiStrip
          ariaLabel={t('spaces.operations.metrics.label')}
          items={[
            {
              key: 'queued',
              label: t('spaces.operations.metrics.queued'),
              value: formatNumber(data.metrics.queuedDeliveries),
              tone: data.metrics.queuedDeliveries ? 'info' : 'neutral',
            },
            {
              key: 'dead',
              label: t('spaces.operations.metrics.dead'),
              value: formatNumber(data.metrics.deadLetters),
              tone: data.metrics.deadLetters ? 'critical' : 'neutral',
            },
            {
              key: 'findings',
              label: t('spaces.operations.metrics.findings'),
              value: formatNumber(data.metrics.openFindings),
              tone: data.metrics.openFindings ? 'warning' : 'neutral',
            },
            {
              key: 'ownerless',
              label: t('spaces.operations.metrics.ownerless'),
              value: formatNumber(data.metrics.ownerlessSpaces),
              tone: data.metrics.ownerlessSpaces ? 'critical' : 'neutral',
            },
            {
              key: 'overdue',
              label: t('spaces.operations.metrics.overdue'),
              value: formatNumber(data.metrics.overdueReviews),
              tone: data.metrics.overdueReviews ? 'warning' : 'neutral',
            },
            {
              key: 'synchronized',
              label: t('spaces.operations.metrics.synchronized'),
              value: formatNumber(data.metrics.synchronizedLast24Hours),
              tone: 'success',
            },
          ]}
        />
      </Box>

      <Box
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.45fr) minmax(320px, 0.75fr)' },
          gap: 2,
        }}
      >
        <Box component="section" sx={{ minWidth: 0 }}>
          <SectionTitle
            icon={<ShieldAlert size={18} />}
            title={t('spaces.operations.findings.title')}
            detail={t('spaces.operations.findings.description')}
          />
          <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
            {data.findings.length ? (
              <Stack divider={<Divider flexItem />}>
                {data.findings.slice(0, 8).map((finding) => (
                  <SpaceFindingListItem
                    key={finding.findingId}
                    finding={finding}
                    onInspect={setSelectedFinding}
                  />
                ))}
              </Stack>
            ) : (
              <Stack alignItems="center" gap={1} sx={{ px: 2, py: 5, textAlign: 'center' }}>
                <CheckCircle2 size={24} color="var(--mui-palette-success-main)" />
                <Typography variant="body2" fontWeight={750}>
                  {t('spaces.operations.findings.emptyTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('spaces.operations.findings.emptyDetail')}
                </Typography>
              </Stack>
            )}
          </Paper>
        </Box>

        <Box component="section" sx={{ minWidth: 0 }}>
          <SectionTitle
            icon={<Clock3 size={18} />}
            title={t('spaces.operations.runs.title')}
            detail={t('spaces.operations.runs.description')}
          />
          <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
            <Stack divider={<Divider flexItem />}>
              {data.recentRuns.slice(0, 6).map((run) => (
                <Box key={run.runId} sx={{ px: 2, py: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Box>
                      <Typography variant="body2" fontWeight={750}>
                        {t(`spaces.operations.runs.trigger.${run.triggerType}`)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(run.startedAt, { dateStyle: 'medium', timeStyle: 'short' })}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={
                        run.lifecycleState === 'FAILED'
                          ? 'error'
                          : run.lifecycleState === 'SUCCEEDED'
                            ? 'success'
                            : 'info'
                      }
                      label={t(`spaces.operations.runs.state.${run.lifecycleState}`)}
                    />
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.75, display: 'block' }}
                  >
                    {t('spaces.operations.runs.result', {
                      planned: run.plannedCount,
                      expired: run.expiredCount,
                      findings: run.findingCount,
                    })}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Box>
      </Box>

      <Box
        component="section"
        id="space-entitlement-deliveries"
        sx={{ mt: 3, scrollMarginTop: 88 }}
      >
        <SectionTitle
          icon={<ServerCog size={18} />}
          title={t('spaces.operations.deliveries.title')}
          detail={t('spaces.operations.deliveries.description')}
        />
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
          <Table aria-label={t('spaces.operations.deliveries.tableLabel')} sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('spaces.operations.columns.target')}</TableCell>
                <TableCell>{t('spaces.operations.columns.permission')}</TableCell>
                <TableCell>{t('spaces.operations.columns.desired')}</TableCell>
                <TableCell>{t('spaces.operations.columns.delivery')}</TableCell>
                <TableCell align="right">{t('spaces.operations.columns.attempts')}</TableCell>
                <TableCell>{t('spaces.operations.columns.synchronizedAt')}</TableCell>
                <TableCell align="right">{t('spaces.operations.columns.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.deliveries.map((delivery) => (
                <DeliveryRow
                  key={delivery.syncItemId}
                  delivery={delivery}
                  retrying={retry.isPending && retry.variables === delivery.syncItemId}
                  onRetry={(syncItemId) => retry.mutate(syncItemId)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      <SpaceFindingDrawer
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onNavigate={(path) => {
          setSelectedFinding(null);
          if (path.startsWith('#')) {
            requestAnimationFrame(() =>
              document.querySelector(path)?.scrollIntoView({ behavior: 'smooth' })
            );
          } else {
            navigate(path);
          }
        }}
        onRecoverOwner={(finding) => {
          setSelectedFinding(null);
          setOwnerRecoveryFinding(finding);
        }}
      />
      <SpaceOwnerRecoveryDialog
        open={Boolean(ownerRecoveryFinding)}
        spaceName={
          typeof ownerRecoveryFinding?.evidence.spaceName === 'string'
            ? ownerRecoveryFinding.evidence.spaceName
            : (ownerRecoveryFinding?.targetRef ?? '')
        }
        busy={recoverOwner.isPending}
        onClose={() => setOwnerRecoveryFinding(null)}
        onSubmit={async (personPublicId, reason) => {
          const spaceKey = ownerRecoveryFinding?.evidence.spaceKey;
          if (typeof spaceKey !== 'string') return;
          await recoverOwner.mutateAsync({ spaceKey, personPublicId, reason });
        }}
      />
    </Box>
  );
}
