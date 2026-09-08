import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Bot,
  Captions,
  CircleCheck,
  Fingerprint,
  Gavel,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MeetingAdminIntelligenceLabels } from './meeting-admin-intelligence-labels';
import type { MeetingAdminIntelligenceReadiness } from './meeting-admin-model';
import { meetingShape } from './meeting-visual-system';
import {
  AdminMetric,
  AdminPanel,
  AdminUnavailableAction,
  adminInset,
} from './meeting-admin-presentation';

export function MeetingAdminGovernanceWorkbench({
  readiness,
  labels,
  onRefresh,
  recordRetentionControl,
}: {
  readiness: MeetingAdminIntelligenceReadiness;
  labels: MeetingAdminIntelligenceLabels;
  onRefresh?: () => void;
  recordRetentionControl?: ReactNode;
}) {
  const { t } = useTranslation('meetings');
  const unavailable = t('admin.design.notMeasured');
  return (
    <>
      <Box
        data-testid="meeting-admin-governance-workbench"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(0, 5fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Stack gap={2} sx={{ display: { xs: 'none', md: 'flex' } }}>
          <AdminPanel title={t('admin.design.modelGovernanceTitle')} icon={Bot}>
            <Box sx={(theme) => ({ ...adminInset(theme), p: 1.5 })}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
                  {readiness.providerModel || labels.unavailable}
                </Typography>
                <Chip size="small" label={labels.states[readiness.dependencies.llm.state]} />
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 0.75 }}
              >
                {readiness.providerCode || labels.unavailable} ·{' '}
                {readiness.processingRegion || labels.unavailable}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 0.75,
                  mt: 1.5,
                }}
              >
                {['training', 'memory', 'attestation'].map((key) => (
                  <Box
                    key={key}
                    sx={{ bgcolor: 'background.paper', borderRadius: meetingShape.inset, p: 1 }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {t(`admin.design.modelFacts.${key}`)}
                    </Typography>
                    <Typography variant="body2" fontWeight="fontWeightMedium" sx={{ mt: 0.75 }}>
                      {labels.states[readiness.dependencies.llm.state]}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <Stack
              direction="row"
              gap={1}
              alignItems="center"
              sx={(theme) => ({ ...adminInset(theme), p: 1.5, mt: 1 })}
            >
              <Captions size={22} aria-hidden="true" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight="fontWeightMedium">
                  {labels.dependencies.stt.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {labels.dependencies.stt.description}
                </Typography>
              </Box>
              <Chip size="small" label={labels.states[readiness.dependencies.stt.state]} />
            </Stack>
            <Typography component="h3" variant="subtitle2" sx={{ mt: 2 }}>
              {t('admin.design.modelAssuranceTitle')}
            </Typography>
            <Stack component="ul" gap={1} sx={{ listStyle: 'none', p: 0, mb: 0 }}>
              {(['region', 'audit', 'llm'] as const).map((key) => (
                <Stack component="li" direction="row" gap={1} key={key} alignItems="flex-start">
                  <CircleCheck size={15} aria-hidden="true" />
                  <Box>
                    <Typography variant="caption">
                      {labels.dependencies[key].label} ·{' '}
                      {labels.states[readiness.dependencies[key].state]}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {readiness.dependencies[key].reason
                        ? labels.reason(readiness.dependencies[key].reason)
                        : labels.dependencies[key].description}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </AdminPanel>
          <AdminPanel title={t('admin.design.integrityTitle')} icon={Activity}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
              <AdminMetric label={t('admin.design.validationLatency')} value={unavailable} />
              <AdminMetric label={t('admin.design.decryptAttempts')} value={unavailable} />
            </Box>
            <Box
              sx={(theme) => ({
                ...adminInset(theme),
                minHeight: 108,
                display: 'grid',
                placeItems: 'center',
                p: 2,
                mt: 1,
              })}
            >
              <Typography variant="body2" color="text.secondary" align="center">
                {t('admin.design.integrityConnection')}
              </Typography>
            </Box>
          </AdminPanel>
        </Stack>
        <Stack gap={2}>
          <AdminPanel
            title={t('admin.design.destructionTitle')}
            icon={Trash2}
            testId="meeting-admin-destruction-ledger"
          >
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
              <AdminMetric
                label={t('admin.design.pendingDeletion')}
                value="—"
                detail={t('admin.design.sourceConnection')}
              />
              <AdminMetric
                label={labels.governance.legalHold.label}
                value="—"
                detail={labels.states[readiness.governance.legalHold.state]}
              />
            </Box>
            <Box sx={(theme) => ({ ...adminInset(theme), p: 1.5, mt: 1.5 })}>
              <Stack direction="row" gap={1} alignItems="center">
                <Fingerprint size={17} aria-hidden="true" />
                <Typography component="h3" variant="subtitle2">
                  {t('admin.design.latestDeletionEvidence')}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {labels.states[readiness.governance.deletionEvidence.state]}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 0.75 }}
              >
                {t('admin.design.deletionLedgerConnection')}
              </Typography>
            </Box>
            <Box
              sx={(theme) => ({
                ...adminInset(theme),
                p: 1.5,
                mt: 1.25,
                display: { xs: 'none', md: 'block' },
              })}
            >
              <Stack direction="row" gap={1} alignItems="center">
                <Gavel size={17} aria-hidden="true" />
                <Typography component="h3" variant="subtitle2">
                  {t('admin.design.legalHoldTitle')}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                {labels.governance.legalHold.description}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 0.75 }}
              >
                {readiness.governance.legalHold.reason
                  ? labels.reason(readiness.governance.legalHold.reason)
                  : labels.states[readiness.governance.legalHold.state]}
              </Typography>
            </Box>
            {recordRetentionControl}
          </AdminPanel>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <AdminPanel title={t('admin.design.contentBoundaryTitle')} icon={ShieldCheck}>
              <Typography variant="body2" color="text.secondary">
                {labels.accessBoundary}
              </Typography>
              <Stack
                direction="row"
                gap={1}
                alignItems="center"
                sx={(theme) => ({ ...adminInset(theme), p: 1.25, mt: 1.5 })}
              >
                <LockKeyhole size={16} aria-hidden="true" />
                <Typography variant="caption">
                  {labels.governance.adminContentAccess.label} ·{' '}
                  {labels.states[readiness.governance.adminContentAccess.state]}
                </Typography>
              </Stack>
            </AdminPanel>
          </Box>
        </Stack>
      </Box>
      <AdminPanel
        title={t('admin.design.actionsTitle')}
        icon={Terminal}
        testId="meeting-admin-governance-actions"
      >
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
          {t('admin.design.actionsDescription')}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <Stack gap={1.25} sx={(theme) => ({ ...adminInset(theme), p: 1.5 })}>
            <Typography component="h3" variant="subtitle2">
              {t('admin.design.routineActions')}
            </Typography>
            <ActionButton
              intent="primary"
              startIcon={<RefreshCw size={16} aria-hidden="true" />}
              disabled={!onRefresh}
              onClick={onRefresh}
            >
              {t('admin.design.revalidateChain')}
            </ActionButton>
            <AdminUnavailableAction label={t('admin.design.exportEvidence')} />
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <AdminUnavailableAction label={t('admin.design.syncLegalHold')} />
            </Box>
          </Stack>
          <Stack
            gap={1.25}
            sx={(theme) => ({ ...adminInset(theme), p: 1.5, display: { xs: 'none', md: 'flex' } })}
          >
            <Typography
              component="h3"
              variant="subtitle2"
              sx={(theme) => ({
                color: theme.palette.mode === 'dark' ? 'error.light' : 'error.dark',
              })}
            >
              {t('admin.design.highRiskActions')}
            </Typography>
            <AdminUnavailableAction label={t('admin.design.forceCryptoShred')} danger />
            <AdminUnavailableAction label={t('admin.design.emergencyStop')} danger />
            <Stack direction="row" gap={1} alignItems="flex-start">
              <KeyRound size={15} aria-hidden="true" />
              <Typography variant="caption" color="text.secondary">
                {t('admin.design.highRiskBoundary')}
              </Typography>
            </Stack>
          </Stack>
        </Box>
        <Stack direction="row" gap={1} sx={{ mt: 1.5, color: 'text.secondary' }}>
          <ScrollText size={16} aria-hidden="true" />
          <Typography variant="caption">{t('admin.design.auditConnection')}</Typography>
        </Stack>
      </AdminPanel>
    </>
  );
}
