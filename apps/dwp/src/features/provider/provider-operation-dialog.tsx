import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Fingerprint, Play, RotateCcw } from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import type { ProviderOperation } from '@dwp-frontend/shared-utils';

import { formatProviderDate, parseProviderJson, ProviderStatusChip } from './provider-ui';

type Props = {
  operation: ProviderOperation;
  busy: boolean;
  approvalPending?: boolean;
  onClose: () => void;
  onExecute?: (operation: ProviderOperation) => Promise<void>;
  onRetry?: (operation: ProviderOperation, justification: string) => Promise<void>;
};

function planValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

export function ProviderOperationDialog({
  operation,
  busy,
  approvalPending = false,
  onClose,
  onExecute,
  onRetry,
}: Props) {
  const { t } = useTranslation('provider');
  const [retryReason, setRetryReason] = useState('');
  const plan = parseProviderJson(operation.plan);
  const canExecute = operation.lifecycleState === 'PREVIEWED' && onExecute;
  const canRetry = ['FAILED', 'PARTIAL'].includes(operation.lifecycleState) && onRetry;
  const impact: Array<[string, unknown]> =
    operation.operationType === 'TENANT_ONBOARD'
      ? [
          [t('operations.impact.tenant'), plan.displayName ?? plan.tenantKey],
          [t('operations.impact.environment'), plan.environmentKey],
          [t('operations.impact.region'), plan.dataRegion],
          [t('operations.impact.serviceTier'), plan.serviceTier],
          [t('operations.impact.isolation'), plan.isolationModel],
          [t('operations.impact.domain'), plan.primaryDomain],
          [t('operations.impact.entitlements'), plan.entitlements],
        ]
      : [
          [t('operations.impact.scope'), plan.scopeType],
          [
            t('operations.impact.target'),
            plan.tenantId ?? plan.deploymentCellId ?? plan.regionKey ?? plan.serviceKey ?? 'GLOBAL',
          ],
          [t('operations.impact.type'), plan.impactType],
          [t('operations.impact.expectedSeconds'), plan.expectedImpactSeconds],
          [
            t('operations.impact.window'),
            `${formatProviderDate(plan.startsAt as string)} - ${formatProviderDate(plan.endsAt as string)}`,
          ],
        ];

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('operations.reviewTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
            <Box>
              <Typography variant="h6">
                {String(plan.displayName ?? plan.tenantKey ?? operation.operationType)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {operation.operationId}
              </Typography>
            </Box>
            <Stack direction="row" gap={0.75} alignItems="center">
              <Chip
                size="small"
                variant="outlined"
                label={operation.riskTier}
                color={operation.riskTier === 'L3' ? 'warning' : 'default'}
              />
              <ProviderStatusChip state={operation.lifecycleState} />
            </Stack>
          </Stack>

          {operation.failureMessage && <Alert severity="error">{operation.failureMessage}</Alert>}
          {approvalPending && <Alert severity="info">{t('operations.approvalRequired')}</Alert>}

          <Box>
            <Typography variant="subtitle2">{t('operations.impact.title')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('operations.impact.description')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                mt: 1,
                borderBlock: 1,
                borderColor: 'divider',
              }}
            >
              {impact.map(([label, value], index) => (
                <Box
                  key={String(label)}
                  sx={{
                    minWidth: 0,
                    px: 1.5,
                    py: 1.1,
                    borderLeft: { sm: index % 2 ? 1 : 0 },
                    borderTop: index > 1 ? 1 : 0,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body2" fontWeight={650} sx={{ wordBreak: 'break-word' }}>
                    {planValue(value)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              borderBlock: 1,
              borderColor: 'divider',
            }}
          >
            {[
              [t('operations.planHash'), operation.planHash],
              [t('operations.started'), formatProviderDate(operation.startedAt)],
              [t('operations.completed'), formatProviderDate(operation.completedAt)],
            ].map(([label, value], index) => (
              <Box
                key={label}
                sx={{
                  minWidth: 0,
                  px: 1.5,
                  py: 1.25,
                  borderLeft: { sm: index === 0 ? 0 : 1 },
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.25, wordBreak: 'break-word' }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('operations.steps')}
            </Typography>
            <Stack divider={<Divider flexItem />} sx={{ borderBlock: 1, borderColor: 'divider' }}>
              {operation.steps.map((step) => (
                <Box key={step.stepId} sx={{ py: 1.25 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    gap={1.25}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {step.order}. {t(`steps.${step.stepKey}`, { defaultValue: step.stepKey })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {step.targetService}
                        {step.externalReference ? ` / ${step.externalReference}` : ''}
                      </Typography>
                      {step.lastErrorMessage && (
                        <Typography variant="caption" color="error.main" display="block">
                          {step.lastErrorCode ? `${step.lastErrorCode}: ` : ''}
                          {step.lastErrorMessage}
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('operations.attempts', { count: step.attemptCount })}
                    </Typography>
                    <ProviderStatusChip state={step.lifecycleState} />
                  </Stack>

                  {step.attempts.length > 0 && (
                    <Stack
                      gap={0.75}
                      sx={{
                        mt: 1,
                        ml: { sm: 2.25 },
                        pl: 1.5,
                        borderLeft: 2,
                        borderColor: 'divider',
                      }}
                    >
                      {step.attempts.map((attempt) => (
                        <Stack
                          key={attempt.attemptId}
                          direction={{ xs: 'column', sm: 'row' }}
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          gap={1}
                        >
                          <Typography variant="caption" fontWeight={700} sx={{ minWidth: 62 }}>
                            {t('operations.attemptLabel', { number: attempt.attemptNumber })}
                          </Typography>
                          <Stack
                            direction="row"
                            alignItems="center"
                            gap={0.5}
                            sx={{ minWidth: 0, flex: 1 }}
                          >
                            <Fingerprint size={14} />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              title={attempt.requestFingerprint}
                              noWrap
                            >
                              {attempt.requestFingerprint.slice(0, 16)}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {formatProviderDate(attempt.startedAt)}
                          </Typography>
                          <ProviderStatusChip state={attempt.lifecycleState} />
                          {attempt.errorMessage && (
                            <Typography variant="caption" color="error.main">
                              {attempt.errorCode ? `${attempt.errorCode}: ` : ''}
                              {attempt.errorMessage}
                            </Typography>
                          )}
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>

          {canRetry && (
            <TextField
              required
              multiline
              minRows={2}
              label={t('operations.retryReason')}
              value={retryReason}
              onChange={(event) => setRetryReason(event.target.value)}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.close')}
        </Button>
        {canRetry && (
          <Button
            variant="contained"
            color="warning"
            startIcon={<RotateCcw size={17} />}
            disabled={busy || !retryReason.trim()}
            onClick={() => void onRetry(operation, retryReason.trim())}
          >
            {t('actions.retry')}
          </Button>
        )}
        {canExecute && (
          <Button
            variant="contained"
            startIcon={<Play size={17} />}
            disabled={busy}
            onClick={() => void onExecute(operation)}
          >
            {t('actions.execute')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
