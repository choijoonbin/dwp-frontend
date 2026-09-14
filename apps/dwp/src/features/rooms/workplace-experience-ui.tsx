import { foundationTokens } from '@dwp-frontend/design-system';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { formatWorkplaceExperienceInstant } from './workplace-experience-format';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton, ProgressMeter } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function WorkplaceExperiencePanel({
  title,
  children,
  actions,
  description,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  description?: string;
}) {
  const headingId = useId();
  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.control + 'px',
        bgcolor: 'background.paper',
        p: { xs: 1.5, md: 2 },
        minWidth: 0,
      }}
    >
      <Stack
        direction="row"
        gap={1}
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        sx={{ mb: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            id={headingId}
            component="h2"
            variant="subtitle1"
            fontWeight={(theme) => theme.typography.fontWeightBold}
          >
            {title}
          </Typography>
          {description && (
            <Typography variant="caption" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
        {actions}
      </Stack>
      {children}
    </Box>
  );
}

export function WorkplaceExperienceMetric({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  detail,
}: {
  label: string;
  value: string | number | null;
  icon?: LucideIcon;
  tone?: 'primary' | 'warning' | 'error' | 'success';
  detail?: string;
}) {
  const { t } = useTranslation('rooms');
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        borderRadius: foundationTokens.radius.control + 'px',
        p: 1.75,
        minWidth: 0,
      }}
    >
      <Stack direction="row" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {Icon && (
          <Box sx={{ color: `${tone}.main`, display: 'flex' }}>
            <Icon size={17} aria-hidden="true" />
          </Box>
        )}
      </Stack>
      <Typography
        variant="h4"
        fontWeight={(theme) => theme.typography.fontWeightBold}
        color={`${tone}.main`}
        sx={{ mt: 0.75, letterSpacing: (theme) => theme.typography.h4.letterSpacing }}
      >
        {value ?? t('workplace.experience.unavailable')}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      )}
    </Box>
  );
}

export function WorkplaceExperienceRate({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null;
  detail?: string;
}) {
  const { t } = useTranslation('rooms');
  return (
    <Stack gap={0.65}>
      {value !== null ? (
        <ProgressMeter label={label} value={value} valueLabel={`${value.toFixed(1)}%`} />
      ) : (
        <Stack direction="row" gap={1} justifyContent="space-between">
          <Typography variant="body2">{label}</Typography>
          <Typography variant="body2">{t('workplace.experience.unavailable')}</Typography>
        </Stack>
      )}
      {detail && (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      )}
    </Stack>
  );
}

export function WorkplaceExperienceQueryError({ retry }: { retry: () => void }) {
  const { t } = useTranslation('rooms');
  return (
    <InlineFeedback
      severity="error"
      action={
        <ActionButton intent="quiet" onClick={retry}>
          {t('actions.retry')}
        </ActionButton>
      }
    >
      {t('workplace.experience.loadError')}
    </InlineFeedback>
  );
}

export function WorkplaceExperienceFreshness({
  at,
  refreshing,
}: {
  at: string;
  refreshing: boolean;
}) {
  const { t } = useTranslation('rooms');
  const date = new Date(at);
  return (
    <Chip
      size="small"
      variant="outlined"
      color={refreshing ? 'warning' : 'primary'}
      label={
        refreshing
          ? t('workplace.experience.refreshing')
          : t('workplace.experience.lastChecked', {
              at: Number.isNaN(date.getTime())
                ? t('workplace.experience.unavailable')
                : formatWorkplaceExperienceInstant(at),
            })
      }
    />
  );
}
