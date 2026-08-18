import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionHeader, useAppearance } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { keyframes } from '@mui/material/styles';

const livePulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.58; transform: scale(0.78); }
`;

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
};

type SectionHeadingProps = {
  id: string;
  icon: LucideIcon;
  title: string;
  meta?: ReactNode;
  divider?: boolean;
};

export function ReferenceModeChip() {
  const { t } = useTranslation('work');

  return (
    <Chip
      icon={<FlaskConical size={14} strokeWidth={1.8} aria-hidden="true" />}
      label={t('shared.referenceMode')}
      size="small"
      variant="outlined"
      sx={{ bgcolor: 'background.paper' }}
    />
  );
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 1.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography component="p" variant="overline" color="primary.main">
            {eyebrow}
          </Typography>
        )}
        <Typography component="h1" variant="h4">
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.35 }}>
          {description}
        </Typography>
      </Box>
      {action ?? <ReferenceModeChip />}
    </Box>
  );
}

export function SectionHeading({ id, icon, title, meta, divider }: SectionHeadingProps) {
  return <SectionHeader id={id} icon={icon} title={title} meta={meta} divider={divider} />;
}

export function LiveSignal({ label }: { label?: string }) {
  const { t } = useTranslation('work');
  const { effectiveReduceMotion } = useAppearance();

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        aria-hidden="true"
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: 'success.main',
          boxShadow: (theme) => `0 0 0 3px ${theme.palette.action.selected}`,
          animation: effectiveReduceMotion ? 'none' : `${livePulse} 1.8s ease-in-out infinite`,
        }}
      />
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        {label ?? t('shared.live')}
      </Typography>
    </Box>
  );
}
