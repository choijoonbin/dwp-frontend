import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  CheckCircle2,
  Database,
  Download,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAuditCheckpoint,
  getAuditPolicy,
  listAuditIntegrity,
  updateAuditPolicy,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';

import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';

import type { AuditIntegrityCheckpoint, AuditRetentionPolicy } from '@dwp-frontend/shared-utils';

type EditablePolicy = Omit<AuditRetentionPolicy, 'updatedBy' | 'updatedAt'>;

function AssuranceItem({
  icon: Icon,
  label,
  value,
  state = 'success',
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  state?: 'success' | 'warning';
}) {
  return (
    <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0, px: 2, py: 1.5 }}>
      <Box
        sx={(theme) => ({
          display: 'grid',
          placeItems: 'center',
          width: 32,
          height: 32,
          flex: '0 0 auto',
          bgcolor: alpha(theme.palette[state].main, 0.1),
          color: `${state}.main`,
        })}
      >
        <Icon size={17} />
      </Box>
      <Box minWidth={0}>
        <Typography variant="caption" color="text.secondary" noWrap display="block">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={750} noWrap>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function LifecycleStep({
  icon: Icon,
  title,
  detail,
  last = false,
}: {
  icon: typeof Database;
  title: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <Stack direction="row" alignItems="center" flex={1} minWidth={0}>
      <Stack alignItems="center" gap={0.75} minWidth={112} textAlign="center">
        <Box
          sx={(theme) => ({
            display: 'grid',
            placeItems: 'center',
            width: 40,
            height: 40,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.paper,
            color: theme.palette.primary.main,
          })}
        >
          <Icon size={19} />
        </Box>
        <Typography component="p" variant="subtitle2">
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      </Stack>
      {!last && <Box sx={{ flex: 1, minWidth: 24, height: 1, mx: 1, bgcolor: 'divider' }} />}
    </Stack>
  );
}

function IntegrityLedger({ items }: { items: AuditIntegrityCheckpoint[] }) {
  const { t } = useTranslation('admin');
  if (!items.length) {
    return (
      <Stack alignItems="center" gap={1} sx={{ py: 6 }}>
        <Fingerprint size={27} />
        <Typography variant="body2" color="text.secondary">
          {t('auditControl.governance.noCheckpoints')}
        </Typography>
      </Stack>
    );
  }
  return (
    <Stack>
      {items.map((item, index) => (
        <Stack
          key={item.checkpointId}
          direction="row"
          gap={1.5}
          sx={{ position: 'relative', px: 2.25, py: 1.75, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box sx={{ width: 20, position: 'relative', flex: '0 0 auto' }}>
            {index < items.length - 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  left: 9,
                  top: 18,
                  bottom: -28,
                  width: 1,
                  bgcolor: 'divider',
                }}
              />
            )}
            <Box
              sx={{
                position: 'absolute',
                top: 3,
                left: 3,
                display: 'grid',
                placeItems: 'center',
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: item.verificationStatus === 'VERIFIED' ? 'success.main' : 'warning.main',
                color: 'common.white',
              }}
            >
              {item.verificationStatus === 'VERIFIED' && <CheckCircle2 size={10} />}
            </Box>
          </Box>
          <Box minWidth={0} flex={1}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Typography component="p" variant="subtitle2">
                {item.checkpointDate}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color={
                  item.verificationStatus === 'VERIFIED'
                    ? 'success'
                    : item.verificationStatus === 'FAILED'
                      ? 'error'
                      : 'warning'
                }
                label={t(`auditControl.integrityStatus.${item.verificationStatus}`)}
              />
            </Stack>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              gap={{ xs: 0.5, sm: 2 }}
              sx={{ mt: 0.75 }}
            >
              <Typography variant="caption" color="text.secondary">
                {t('auditControl.governance.recordCount', { count: item.recordCount })}
              </Typography>
              <Stack direction="row" alignItems="center" gap={0.6} minWidth={0}>
                <KeyRound size={13} />
                <Typography variant="caption" color="text.secondary" fontFamily="monospace" noWrap>
                  {item.checkpointHash.slice(0, 20)}…
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

export function AuditGovernance() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const policyQuery = useQuery({ queryKey: ['audit-control', 'policy'], queryFn: getAuditPolicy });
  const integrityQuery = useQuery({
    queryKey: ['audit-control', 'integrity'],
    queryFn: listAuditIntegrity,
  });
  const [policy, setPolicy] = useState<EditablePolicy | null>(null);

  useEffect(() => {
    if (!policyQuery.data) return;
    const { updatedBy: _updatedBy, updatedAt: _updatedAt, ...editable } = policyQuery.data;
    setPolicy(editable);
  }, [policyQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateAuditPolicy(policy!),
    onSuccess: async () => {
      toast.success(t('auditControl.governance.saved'));
      await queryClient.invalidateQueries({ queryKey: ['audit-control', 'policy'] });
    },
    onError: () => toast.error(t('common.operationError')),
  });
  const checkpointMutation = useMutation({
    mutationFn: createAuditCheckpoint,
    onSuccess: async () => {
      toast.success(t('auditControl.governance.checkpointCreated'));
      await queryClient.invalidateQueries({ queryKey: ['audit-control', 'integrity'] });
    },
    onError: () => toast.error(t('common.operationError')),
  });

  const latestCheckpoint = useMemo(() => integrityQuery.data?.[0], [integrityQuery.data]);

  if (policyQuery.isLoading || integrityQuery.isLoading || !policy) {
    return <AdminPanelLoading label={t('auditControl.loading')} />;
  }
  if (policyQuery.isError || integrityQuery.isError) {
    return <AdminPanelError message={t('auditControl.loadError')} />;
  }

  const setNumber = (field: keyof EditablePolicy, value: string) => {
    setPolicy((current) => (current ? { ...current, [field]: Number(value) } : current));
  };

  return (
    <Box
      sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
          '& > *:not(:last-child)': { borderRight: { sm: 1 }, borderColor: 'divider' },
        }}
      >
        <AssuranceItem
          icon={LockKeyhole}
          label={t('auditControl.governance.storeControl')}
          value={t('auditControl.governance.appendOnlyActive')}
        />
        <AssuranceItem
          icon={Fingerprint}
          label={t('auditControl.governance.integrityControl')}
          value={
            latestCheckpoint?.verificationStatus === 'VERIFIED'
              ? t('auditControl.governance.lastVerified', { date: latestCheckpoint.checkpointDate })
              : t('auditControl.governance.awaitingCheckpoint')
          }
          state={latestCheckpoint?.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}
        />
        <AssuranceItem
          icon={Download}
          label={t('auditControl.governance.exportControl')}
          value={
            policy.requireExportReason
              ? t('auditControl.governance.reasonRequired')
              : t('auditControl.governance.reasonOptional')
          }
          state={policy.requireExportReason ? 'success' : 'warning'}
        />
        <AssuranceItem
          icon={Archive}
          label={t('auditControl.governance.retentionControl')}
          value={t('auditControl.governance.retentionSummary', {
            standard: policy.standardRetentionDays,
            extended: policy.extendedRetentionDays,
          })}
        />
      </Box>

      <Box
        role="region"
        aria-label={t('auditControl.governance.lifecycle')}
        tabIndex={0}
        sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider', overflowX: 'auto' }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
          sx={{ mb: 2.5 }}
        >
          <Box>
            <Typography component="h2" variant="subtitle1">
              {t('auditControl.governance.lifecycle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('auditControl.governance.lifecycleHint')}
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            color="success"
            label={t('auditControl.governance.policyActive')}
          />
        </Stack>
        <Stack direction="row" alignItems="flex-start" sx={{ minWidth: 760 }}>
          <LifecycleStep
            icon={Database}
            title={t('auditControl.governance.stageCapture')}
            detail={t('auditControl.governance.stageCaptureHint')}
          />
          <LifecycleStep
            icon={LockKeyhole}
            title={t('auditControl.governance.stageImmutable')}
            detail={t('auditControl.governance.stageImmutableHint')}
          />
          <LifecycleStep
            icon={Archive}
            title={t('auditControl.governance.stageStandard')}
            detail={t('auditControl.governance.days', { count: policy.standardRetentionDays })}
          />
          <LifecycleStep
            icon={Archive}
            title={t('auditControl.governance.stageExtended')}
            detail={t('auditControl.governance.days', { count: policy.extendedRetentionDays })}
          />
          <LifecycleStep
            icon={TimerReset}
            title={t('auditControl.governance.stageDisposition')}
            detail={t('auditControl.governance.stageDispositionHint')}
            last
          />
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.05fr) minmax(420px, 0.95fr)' },
        }}
      >
        <Box sx={{ borderRight: { xl: 1 }, borderColor: 'divider' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={2}
            sx={{ minHeight: 64, px: 2.5 }}
          >
            <Box minWidth={0}>
              <Typography component="h2" variant="subtitle1">
                {t('auditControl.governance.policy')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('auditControl.governance.policyUpdated', {
                  actor: policyQuery.data?.updatedBy || '—',
                  time: policyQuery.data?.updatedAt
                    ? formatDate(policyQuery.data.updatedAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—',
                })}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Save size={17} />}
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {t('common.actions.save')}
            </Button>
          </Stack>
          <Divider />
          <Box sx={{ p: 2.5 }}>
            <Typography variant="overline" color="text.secondary">
              {t('auditControl.governance.retention')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t('auditControl.governance.retentionHint')}
            </Typography>
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
            >
              <TextField
                type="number"
                label={t('auditControl.governance.standardDays')}
                value={policy.standardRetentionDays}
                onChange={(event) => setNumber('standardRetentionDays', event.target.value)}
                slotProps={{ htmlInput: { min: 90, max: 3650 } }}
              />
              <TextField
                type="number"
                label={t('auditControl.governance.extendedDays')}
                value={policy.extendedRetentionDays}
                onChange={(event) => setNumber('extendedRetentionDays', event.target.value)}
                slotProps={{ htmlInput: { min: 365, max: 3650 } }}
              />
            </Box>
            <Divider sx={{ my: 3 }} />
            <Typography variant="overline" color="text.secondary">
              {t('auditControl.governance.riskAndExport')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t('auditControl.governance.riskAndExportHint')}
            </Typography>
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
            >
              <TextField
                type="number"
                label={t('auditControl.governance.riskThreshold')}
                value={policy.highRiskThreshold}
                onChange={(event) => setNumber('highRiskThreshold', event.target.value)}
                slotProps={{ htmlInput: { min: 50, max: 100 } }}
              />
              <TextField
                type="number"
                label={t('auditControl.governance.exportLimit')}
                value={policy.exportLimitRows}
                onChange={(event) => setNumber('exportLimitRows', event.target.value)}
                slotProps={{ htmlInput: { min: 100, max: 500000 } }}
              />
            </Box>
            <Stack sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={policy.requireExportReason}
                    onChange={(event) =>
                      setPolicy((current) =>
                        current
                          ? { ...current, requireExportReason: event.target.checked }
                          : current
                      )
                    }
                  />
                }
                label={t('auditControl.governance.requireReason')}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={policy.integrityEnabled}
                    onChange={(event) =>
                      setPolicy((current) =>
                        current ? { ...current, integrityEnabled: event.target.checked } : current
                      )
                    }
                  />
                }
                label={t('auditControl.governance.integrityEnabled')}
              />
            </Stack>
          </Box>
        </Box>

        <Box>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={2}
            sx={{ minHeight: 64, px: 2.5 }}
          >
            <Box minWidth={0}>
              <Typography component="h2" variant="subtitle1">
                {t('auditControl.governance.integrityLedger')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('auditControl.governance.integrityDescription')}
              </Typography>
            </Box>
            <Stack direction="row" gap={0.5}>
              <Tooltip title={t('common.actions.refresh')}>
                <IconButton
                  aria-label={t('common.actions.refresh')}
                  onClick={() => void integrityQuery.refetch()}
                >
                  <RefreshCw size={18} />
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                startIcon={<Fingerprint size={17} />}
                disabled={checkpointMutation.isPending || !policy.integrityEnabled}
                onClick={() => checkpointMutation.mutate()}
              >
                {t('auditControl.governance.verify')}
              </Button>
            </Stack>
          </Stack>
          <Divider />
          <Box
            sx={(theme) => ({
              p: 2.25,
              bgcolor: alpha(theme.palette.success.main, 0.045),
              borderBottom: 1,
              borderColor: 'divider',
            })}
          >
            <Stack direction="row" gap={1.25}>
              <Box
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 38,
                  height: 38,
                  bgcolor: 'success.main',
                  color: 'success.contrastText',
                }}
              >
                <ShieldCheck size={20} />
              </Box>
              <Box>
                <Typography component="h3" variant="subtitle2">
                  {t('auditControl.governance.appendOnly')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('auditControl.governance.appendOnlyStatus')}
                </Typography>
              </Box>
            </Stack>
          </Box>
          <IntegrityLedger items={integrityQuery.data ?? []} />
        </Box>
      </Box>
    </Box>
  );
}
