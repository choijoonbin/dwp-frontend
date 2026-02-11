/**
 * Case Detail Right Panel — Simulation, Actions tab, Audit tab
 */

import type { UseMutationResult } from '@tanstack/react-query';

import { Link } from 'react-router-dom';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { buildAuditUrl } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { SYNAPSE_ROUTES } from '../../../routes';
import { CaseSimulationDiff } from './case-simulation-diff';
import { SeverityBadge } from '../../../components/finance/severity-badge';
import { StatusPill, type Status } from '../../../components/finance/status-pill';

import type { RelatedAction } from '../hooks/use-case-detail';
import type { CaseDetailUi } from '../adapters/case-detail-adapter';
import type { CaseStatusApi } from '../hooks/use-case-status-select';
import type { CaseSimulationResult } from '../hooks/use-case-simulation';

export type CaseAuditEvent = { actor?: string; description?: string; timestamp?: string };

export type CaseDetailRightPanelProps = {
  caseData: CaseDetailUi;
  caseId: string | undefined;
  rightPanelTab: 'actions' | 'audit';
  onRightPanelTabChange: (v: 'actions' | 'audit') => void;
  simulationMode: boolean;
  onSimulationModeChange: (v: boolean) => void;
  simulationResult: CaseSimulationResult | null;
  simulationLoading: boolean;
  onRunSimulation: () => void;
  relatedActions: RelatedAction[];
  caseAuditEvents: CaseAuditEvent[];
  onStatusChange: (status: CaseStatusApi) => void;
  isStatusMutating: boolean;
  approveActionMutation: UseMutationResult<unknown, unknown, string>;
  rejectActionMutation: UseMutationResult<unknown, unknown, string>;
};

export const CaseDetailRightPanel = ({
  caseData,
  caseId,
  rightPanelTab,
  onRightPanelTabChange,
  simulationMode,
  onSimulationModeChange,
  simulationResult,
  simulationLoading,
  onRunSimulation,
  relatedActions,
  caseAuditEvents,
  onStatusChange,
  isStatusMutating,
  approveActionMutation,
  rejectActionMutation,
}: CaseDetailRightPanelProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: { xs: '100%', lg: 400 },
        flexShrink: 0,
        minHeight: { xs: 200, lg: 0 },
        borderLeft: { lg: 1 },
        borderTop: { xs: 1, lg: 0 },
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Iconify icon="solar:play-bold-duotone" width={18} />
            <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
              {t('caseDetail.simulationMode')}
            </Typography>
          </Stack>
          <FormControlLabel
            control={<Switch checked={simulationMode} onChange={(e) => onSimulationModeChange(e.target.checked)} size="small" />}
            label={simulationMode ? t('caseDetail.on') : t('caseDetail.off')}
            sx={{ m: 0 }}
          />
        </Stack>
      </Box>

      {simulationMode && (
        <CaseSimulationDiff result={simulationResult} isLoading={simulationLoading} onRunSimulation={onRunSimulation} />
      )}

      <Box
        sx={{
          px: { xs: 1.5, sm: 2 },
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        }}
      >
        <Tabs value={rightPanelTab} onChange={(_, v) => onRightPanelTabChange(v)} sx={{ minHeight: 'auto' }}>
          <Tab
            icon={<Iconify icon="solar:bolt-bold-duotone" width={18} />}
            iconPosition="start"
            label={t('caseDetail.actions')}
            value="actions"
            sx={{ minHeight: 'auto', py: 0.5 }}
          />
          <Tab
            icon={<Iconify icon="solar:history-bold-duotone" width={18} />}
            iconPosition="start"
            label={t('caseDetail.auditStream')}
            value="audit"
            sx={{ minHeight: 'auto', py: 0.5 }}
          />
        </Tabs>
      </Box>

      {rightPanelTab === 'actions' && (
        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1.5, sm: 2 } }}>
          <Stack spacing={2}>
            <Stack spacing={1}>
              <Button
                variant="contained"
                fullWidth
                disabled={isStatusMutating}
                startIcon={isStatusMutating ? <CircularProgress size={16} color="inherit" /> : <Iconify icon="solar:check-circle-bold-duotone" width={20} />}
                onClick={() => onStatusChange('RESOLVED')}
              >
                {t('caseDetail.approveAction')}
              </Button>
              <Button
                variant="outlined"
                fullWidth
                disabled={isStatusMutating}
                startIcon={<Iconify icon="solar:close-circle-bold-duotone" width={20} />}
                onClick={() => onStatusChange('DISMISSED')}
              >
                {t('caseDetail.reject')}
              </Button>
              <Button
                variant="outlined"
                fullWidth
                disabled={isStatusMutating}
                startIcon={<Iconify icon="solar:info-circle-bold-duotone" width={20} />}
                onClick={() => onStatusChange('TRIAGED')}
              >
                {t('caseDetail.requestInfo')}
              </Button>
              <Tooltip title={t('caseDetail.comingInPhaseB')}>
                <span>
                  <Button variant="outlined" fullWidth disabled startIcon={<Iconify icon="solar:forbidden-circle-bold-duotone" width={20} />}>
                    {t('caseDetail.setPaymentBlock')}
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={t('caseDetail.comingInPhaseB')}>
                <span>
                  <Button variant="outlined" fullWidth disabled startIcon={<Iconify icon="solar:refresh-bold-duotone" width={20} />}>
                    {t('caseDetail.postReversal')}
                  </Button>
                </span>
              </Tooltip>
            </Stack>

            <Divider />

            <Button
              variant="outlined"
              fullWidth
              component={Link}
              to={`${SYNAPSE_ROUTES.ACTIONS}?caseId=${caseData.id}`}
              endIcon={<Iconify icon="solar:alt-arrow-right-bold-duotone" width={20} />}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Iconify icon="solar:bolt-bold-duotone" width={20} />
                <Typography>{t('caseDetail.goToActionCenter')}</Typography>
              </Stack>
            </Button>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 1.5 }}>
                {t('caseDetail.pendingActions')} ({relatedActions.filter((a) => (a as { status: string }).status === 'pending').length})
              </Typography>
              <Stack spacing={1}>
                {relatedActions.map((action) => {
                  const isPending = (action as { status: string }).status === 'pending';
                  const isActionApproving = approveActionMutation.isPending && approveActionMutation.variables === action.id;
                  const isActionRejecting = rejectActionMutation.isPending && rejectActionMutation.variables === action.id;
                  return (
                    <Card key={action.id} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                      <CardContent sx={{ p: 1.5 }}>
                        <Stack spacing={1}>
                          <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                                {action.actionType.replace(/_/g, ' ')}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                                {action.description}
                              </Typography>
                            </Box>
                            <StatusPill status={(action as { status: string }).status as Status} size="sm" />
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {action.riskLevel && (
                              <SeverityBadge
                                severity={action.riskLevel as 'critical' | 'high' | 'medium' | 'low'}
                                size="sm"
                                showIcon={false}
                              />
                            )}
                            {action.targetSystem && (
                              <Typography variant="caption" color="text.secondary">
                                {action.targetSystem}
                              </Typography>
                            )}
                          </Stack>
                          {isPending && (
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                              <Button
                                variant="contained"
                                size="small"
                                disabled={approveActionMutation.isPending || rejectActionMutation.isPending}
                                startIcon={isActionApproving ? <CircularProgress size={12} color="inherit" /> : <Iconify icon="solar:check-circle-bold-duotone" width={14} />}
                                onClick={() => approveActionMutation.mutate(action.id)}
                              >
                                {t('actions.buttons.approve')}
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                disabled={approveActionMutation.isPending || rejectActionMutation.isPending}
                                startIcon={isActionRejecting ? <CircularProgress size={12} color="inherit" /> : <Iconify icon="solar:close-circle-bold-duotone" width={14} />}
                                onClick={() => rejectActionMutation.mutate(action.id)}
                              >
                                {t('actions.buttons.reject')}
                              </Button>
                            </Stack>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
                {relatedActions.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    {t('caseDetail.noActionsPhaseB')}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </Box>
      )}

      {rightPanelTab === 'audit' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1.5, sm: 2 } }}>
            <Stack spacing={2}>
              {caseAuditEvents
                .map((e, i) => ({
                  type: 'event' as const,
                  author: e.actor,
                  content: e.description,
                  createdAt: e.timestamp,
                  key: i,
                }))
                .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
                .map((item) => (
                  <Stack key={item.key} direction="row" spacing={1.5}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'action.hover' }}>
                      <Iconify icon="solar:clock-circle-bold-duotone" width={16} />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.author}
                        </Typography>
                        <Chip label={t('caseDetail.system')} size="small" variant="outlined" />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {new Date(item.createdAt ?? '').toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.content}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
            </Stack>
          </Box>
          <Box sx={{ p: { xs: 1.5, sm: 2 }, borderTop: 1, borderColor: 'divider' }}>
            <Button
              component={Link}
              to={
                caseId
                  ? buildAuditUrl({
                      resourceId: caseId,
                      range: '24h',
                      eventCategory: 'CASE',
                      resourceType: 'AGENT_CASE',
                    })
                  : SYNAPSE_ROUTES.AUDIT
              }
              size="small"
              fullWidth
              endIcon={<Iconify icon="solar:alt-arrow-right-bold-duotone" width={16} />}
              sx={{ textTransform: 'none' }}
            >
              {t('caseDetail.viewFullAuditLog')}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};
