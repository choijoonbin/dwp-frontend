import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Fingerprint, KeyRound, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAuditCheckpoint,
  getAuditPolicy,
  listAuditIntegrity,
  updateAuditPolicy,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';

import type { AuditRetentionPolicy } from '@dwp-frontend/shared-utils';

type EditablePolicy = Omit<AuditRetentionPolicy, 'updatedBy' | 'updatedAt'>;

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
    <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
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
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              minHeight: 64,
              px: 2.5,
              bgcolor: 'background.default',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
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
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, flexShrink: 0 }}
            >
              {t('common.actions.save')}
            </Button>
          </Stack>
          <Divider />
          <Box sx={{ p: 2.5 }}>
            <Typography variant="overline" color="text.secondary">
              {t('auditControl.governance.retention')}
            </Typography>
            <Box
              sx={{
                mt: 1.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
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
            <Box
              sx={{
                mt: 1.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
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
          <Box
            sx={{
              position: 'sticky',
              bottom: 0,
              zIndex: 2,
              display: { xs: 'flex', sm: 'none' },
              p: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            <Button
              fullWidth
              variant="contained"
              startIcon={<Save size={17} />}
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {t('common.actions.save')}
            </Button>
          </Box>
        </Box>

        <Box>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={2}
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              minHeight: 64,
              px: 2.5,
              bgcolor: 'background.default',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h2" variant="subtitle1">
                {t('auditControl.governance.integrity')}
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
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, flexShrink: 0 }}
              >
                {t('auditControl.governance.verify')}
              </Button>
            </Stack>
          </Stack>
          <Divider />
          <Stack direction="row" gap={1.25} sx={{ p: 2.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'success.lighter',
                color: 'success.dark',
                borderRadius: 1,
              }}
            >
              <ShieldCheck size={20} />
            </Box>
            <Box>
              <Typography component="p" variant="subtitle2">
                {t('auditControl.governance.appendOnly')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('auditControl.governance.appendOnlyStatus')}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Fingerprint size={17} />}
                disabled={checkpointMutation.isPending || !policy.integrityEnabled}
                onClick={() => checkpointMutation.mutate()}
                sx={{ display: { xs: 'inline-flex', sm: 'none' }, mt: 1.5 }}
              >
                {t('auditControl.governance.verify')}
              </Button>
            </Box>
          </Stack>
          <Divider />
          <Box sx={{ overflowX: 'auto' }}>
            <Table
              size="small"
              aria-label={t('auditControl.governance.integrity')}
              sx={{ minWidth: 620 }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>{t('auditControl.governance.date')}</TableCell>
                  <TableCell>{t('auditControl.governance.records')}</TableCell>
                  <TableCell>{t('auditControl.governance.signature')}</TableCell>
                  <TableCell>{t('auditControl.governance.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(integrityQuery.data ?? []).map((item) => (
                  <TableRow key={item.checkpointId} sx={{ height: 58 }}>
                    <TableCell>{item.checkpointDate}</TableCell>
                    <TableCell>{formatNumber(item.recordCount)}</TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <KeyRound size={15} />
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {item.checkpointHash.slice(0, 14)}…
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
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
                        icon={
                          item.verificationStatus === 'VERIFIED' ? (
                            <CheckCircle2 size={14} />
                          ) : undefined
                        }
                        label={t(`auditControl.integrityStatus.${item.verificationStatus}`)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {!integrityQuery.data?.length && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 7 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('auditControl.governance.noCheckpoints')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
