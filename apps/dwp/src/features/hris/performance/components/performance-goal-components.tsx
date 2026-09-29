import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export function PerformanceGoalSection({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description?: string;
  children: React.ReactNode;
}>) {
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
      <Box sx={{ px: 2, py: 1.75 }}>
        <Typography id={titleId} component="h2" variant="subtitle1">
          {title}
        </Typography>
        {description && (
          <Typography id={descriptionId} variant="caption" color="text.secondary">
            {description}
          </Typography>
        )}
      </Box>
      <Divider />
      {children}
    </Paper>
  );
}

export function PerformanceReferenceNotice() {
  const { t } = useTranslation('hcm');
  return (
    <InlineFeedback severity="info" title={t('domains.reference.title')}>
      {t('domains.reference.description')}
    </InlineFeedback>
  );
}

export function PerformanceGoalStatus({ status }: Readonly<{ status: string }>) {
  const { t } = useTranslation('hcm');
  const normalized = status.trim().toUpperCase();
  const color =
    normalized === 'ACTIVE' || normalized === 'COMPLETED'
      ? 'success'
      : normalized === 'CANCELLED' || normalized === 'AT_RISK'
        ? 'error'
        : normalized === 'IN_PROGRESS'
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
