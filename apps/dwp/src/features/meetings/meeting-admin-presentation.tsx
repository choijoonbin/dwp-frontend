import type { ReactNode } from 'react';
import { LockKeyhole, type LucideIcon } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, type Theme } from '@mui/material/styles';

import { meetingShape, meetingSoftShadow, meetingType } from './meeting-visual-system';

export const adminPanel = (theme: Theme) => ({
  minWidth: 0,
  borderRadius: meetingShape.card,
  bgcolor: 'background.paper',
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
  boxShadow: meetingSoftShadow(theme),
});

export const adminInset = (theme: Theme) => ({
  minWidth: 0,
  borderRadius: meetingShape.inset,
  bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.055),
});

export function AdminPageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', md: 'center' }}
      gap={1.5}
      sx={{ mb: 2 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" color="primary.main" sx={meetingType.micro}>
          {eyebrow}
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: 'h6.fontSize', md: 'h5.fontSize' },
            lineHeight: 'h6.lineHeight',
            letterSpacing: 'h6.letterSpacing',
            fontWeight: 'fontWeightBold',
            mt: 0.25,
          }}
        >
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      </Box>
      {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
    </Stack>
  );
}

export function AdminPanel({
  title,
  icon: Icon,
  children,
  testId,
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Box
      component="section"
      aria-label={title}
      data-testid={testId}
      sx={(theme) => ({ ...adminPanel(theme), p: { xs: 1.5, md: 2 } })}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
        {Icon && (
          <Box sx={{ color: 'primary.main', display: 'flex' }}>
            <Icon size={18} aria-hidden="true" />
          </Box>
        )}
        <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
          {title}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}

export function AdminMetric({
  label,
  value,
  detail,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  compact?: boolean;
}) {
  return (
    <Box
      sx={(theme) => ({
        ...adminInset(theme),
        p: compact ? 1 : 1.5,
        display: compact ? 'flex' : 'block',
        alignItems: 'center',
        gap: 1,
        justifyContent: 'space-between',
      })}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="p"
        sx={{
          fontWeight: 'fontWeightBold',
          fontSize: compact ? 'subtitle1.fontSize' : 'h5.fontSize',
          letterSpacing: 'h6.letterSpacing',
          my: 0.5,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </Typography>
      {detail && !compact && (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      )}
    </Box>
  );
}

export function AdminUnavailableAction({
  label,
  danger = false,
}: {
  label: string;
  danger?: boolean;
}) {
  const { t } = useTranslation('meetings');
  return (
    <Stack gap={0.5}>
      <ActionButton
        intent="secondary"
        disabled
        startIcon={<LockKeyhole size={15} aria-hidden="true" />}
        sx={{ justifyContent: 'flex-start', color: danger ? 'error.main' : undefined }}
      >
        {label}
      </ActionButton>
      <Typography variant="caption" color="text.secondary">
        {t(danger ? 'admin.design.approvalConnection' : 'admin.design.sourceConnection')}
      </Typography>
    </Stack>
  );
}
