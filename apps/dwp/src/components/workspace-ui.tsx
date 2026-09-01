import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { useTranslation } from 'react-i18next';
import { SectionHeader, useAppearance } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { keyframes } from '@mui/material/styles';

const livePulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.58; transform: scale(0.78); }
`;

type SectionHeadingProps = {
  id: string;
  icon: LucideIcon;
  title: string;
  meta?: ReactNode;
  divider?: boolean;
};

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
