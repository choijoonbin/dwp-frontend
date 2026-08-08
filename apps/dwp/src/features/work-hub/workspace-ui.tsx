import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { FlaskConical } from 'lucide-react';
import { useAppearance } from '@dwp-frontend/design-system';

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
};

export function ReferenceModeChip() {
  return (
    <Chip
      icon={<FlaskConical size={14} strokeWidth={1.8} aria-hidden="true" />}
      label="Reference mode"
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

export function SectionHeading({ id, icon: Icon, title, meta }: SectionHeadingProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 30,
            height: 30,
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'action.selected',
            borderRadius: 1,
          }}
        >
          <Icon size={17} strokeWidth={1.8} />
        </Box>
        <Typography id={id} component="h2" variant="h6">
          {title}
        </Typography>
      </Box>
      {meta}
    </Box>
  );
}

export function LiveSignal({ label = 'Live' }: { label?: string }) {
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
        {label}
      </Typography>
    </Box>
  );
}
