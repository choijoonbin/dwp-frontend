import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineFeedback, ProgressMeter } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HcmQueryState } from '../../../../components/hcm-query-state';

export function HrisDomainSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      sx={{ overflow: 'hidden', minWidth: 0 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ px: 2, py: 1.75 }}
      >
        <Box minWidth={0}>
          <Typography id={titleId} component="h2" variant="subtitle1">
            {title}
          </Typography>
          {description && (
            <Typography id={descriptionId} variant="caption" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      <Divider />
      {children}
    </Paper>
  );
}

export function HrisProgressSignal({
  label,
  value,
  detail,
  progress,
  tone = 'primary',
}: {
  label: string;
  value: string;
  detail: string;
  progress: number;
  tone?: 'primary' | 'success' | 'warning' | 'error';
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <ProgressMeter label={label} value={progress} valueLabel={value} tone={tone} />
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        {detail}
      </Typography>
    </Paper>
  );
}

export function HrisReferenceNotice() {
  const { t } = useTranslation('hcm');
  return (
    <InlineFeedback severity="info" title={t('domains.reference.title')}>
      {t('domains.reference.description')}
    </InlineFeedback>
  );
}

export function HrisStatusChip({ status }: { status: string }) {
  const { t } = useTranslation('hcm');
  const normalized = status.toUpperCase();
  const color =
    normalized === 'APPROVED' || normalized === 'ACTIVE' || normalized === 'COMPLETED'
      ? 'success'
      : normalized === 'REJECTED' || normalized === 'CANCELLED' || normalized === 'AT_RISK'
        ? 'error'
        : normalized === 'SUBMITTED' || normalized === 'IN_PROGRESS'
          ? 'warning'
          : 'default';
  return (
    <Chip
      size="small"
      color={color}
      variant="outlined"
      label={t(`domains.status.${normalized}`, { defaultValue: normalized })}
    />
  );
}

export function HrisQueryBoundary({
  loading,
  error,
  retrying = false,
  onRetry,
  children,
}: {
  loading: boolean;
  error: unknown;
  retrying?: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (loading || error) {
    return <HcmQueryState loading={loading} error={error} retrying={retrying} onRetry={onRetry} />;
  }
  return (
    <Box data-testid="hris-query-state" data-query-state="ready" minWidth={0}>
      {children}
    </Box>
  );
}
