import { foundationTokens } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard } from './workplace-member-surfaces';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function WorkplaceHomeSectionHeader({
  id,
  icon: Icon,
  title,
  description,
  action,
  mobileIcon = false,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  mobileIcon?: boolean;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={1.25}
      sx={{
        px: { xs: 0, md: foundationTokens.workplace.layout.gutter + 'px' },
        pt: { xs: 0, md: foundationTokens.workplace.layout.gutter + 'px' },
        pb: { xs: 1, md: foundationTokens.workplace.layout.cardGap + 'px' },
      }}
    >
      <Stack direction="row" spacing={1.1} alignItems="flex-start" minWidth={0}>
        <Box
          aria-hidden="true"
          sx={{
            width: 20,
            height: 26,
            flex: '0 0 20px',
            display: { xs: mobileIcon ? 'grid' : 'none', md: 'grid' },
            placeItems: 'center',
            borderRadius: foundationTokens.radius.control + 'px',
            color: mobileIcon ? 'error.main' : 'primary.main',
          }}
        >
          <Icon size={17} strokeWidth={1.9} />
        </Box>
        <Box minWidth={0}>
          <Typography
            id={id}
            component="h2"
            sx={foundationTokens.workplace.typography.subsectionTitle}
          >
            {title}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              ...foundationTokens.workplace.typography.smallBody,
              display: { xs: 'none', md: 'block' },
              mt: 0.5,
            }}
          >
            {description}
          </Typography>
        </Box>
      </Stack>
      {action}
    </Stack>
  );
}

export function WorkplaceHomeSectionShell({
  labelledBy,
  children,
  mobileSurface = 'transparent',
}: {
  labelledBy: string;
  children: ReactNode;
  mobileSurface?: 'transparent' | 'attention';
}) {
  return (
    <Box
      component="section"
      aria-labelledby={labelledBy}
      sx={(theme) => ({
        ...workplaceMemberCard(theme),
        borderWidth: { xs: 0, md: 1 },
        bgcolor: {
          xs: mobileSurface === 'attention' ? 'var(--dwp-product-soft)' : 'transparent',
          md: 'background.paper',
        },
        p: { xs: mobileSurface === 'attention' ? 1 : 0, md: 0 },
        borderRadius: foundationTokens.workplace.radius.card + 'px',
      })}
    >
      {children}
    </Box>
  );
}
