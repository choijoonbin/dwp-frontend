import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { NOTIFICATION_PREFERENCE_SECTION_IDS } from './notification-preference-navigation';
import {
  notificationPreferenceRadius,
  notificationPreferenceSelectedBackground,
} from './notification-preference-styles';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function PreferenceSection({
  id,
  title,
  description,
  hidden,
  children,
}: {
  id: string;
  title: string;
  description: string;
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      id={id}
      hidden={hidden}
      tabIndex={-1}
      sx={{
        mt: 1.5,
        scrollMarginTop: {
          xs: 'calc(var(--dwp-shell-mobile-sticky-offset, 64px) + 56px)',
          lg: 112,
        },
        minWidth: 0,
        bgcolor: 'background.paper',
        borderRadius: notificationPreferenceRadius,
        overflow: 'clip',
      }}
    >
      <Box sx={{ p: { xs: 1.5, md: 2 } }}>
        <Typography component="h2" variant="h6">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {description}
        </Typography>
      </Box>
      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          px: id === NOTIFICATION_PREFERENCE_SECTION_IDS.global ? { xs: 1.5, md: 2 } : 0,
          py: id === NOTIFICATION_PREFERENCE_SECTION_IDS.global ? 1.5 : 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function PreferenceRow({
  icon: Icon,
  title,
  description,
  meta,
  inlineControl = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  meta?: ReactNode;
  inlineControl?: boolean;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: inlineControl
          ? '28px minmax(0, 1fr) minmax(0, auto)'
          : '28px minmax(0, 1fr)',
        gap: 1.25,
        alignItems: 'center',
        px: 1.5,
        py: 1.25,
        minHeight: 64,
        '@container notification-preferences (min-width: 720px)': {
          gridTemplateColumns: '28px minmax(0, 1fr) minmax(0, auto)',
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 28,
          height: 28,
          display: 'grid',
          placeItems: 'center',
          borderRadius: notificationPreferenceRadius,
          bgcolor: notificationPreferenceSelectedBackground,
          color: 'primary.main',
        }}
      >
        <Icon size={16} strokeWidth={1.8} />
      </Box>
      <Box minWidth={0}>
        <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
          <Typography component="h3" variant="subtitle2">
            {title}
          </Typography>
          {meta}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {description}
        </Typography>
      </Box>
      <Box
        sx={{
          gridColumn: inlineControl ? '3' : '1 / -1',
          minWidth: 0,
          maxWidth: '100%',
          justifySelf: inlineControl ? 'end' : 'stretch',
          '@container notification-preferences (min-width: 720px)': {
            gridColumn: '3',
            justifySelf: 'end',
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
