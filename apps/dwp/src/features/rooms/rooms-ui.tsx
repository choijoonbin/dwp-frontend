import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ReactNode } from 'react';
import type { CalendarResource } from '@dwp-frontend/shared-utils';

export function RoomsPermissionNotice({ children }: { children: ReactNode }) {
  return (
    <Alert severity="info" role="status" data-testid="rooms-permission-notice" sx={{ mb: 2 }}>
      {children}
    </Alert>
  );
}

export function RoomsPageHeading({
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
      alignItems={{ xs: 'flex-start', md: 'flex-end' }}
      justifyContent="space-between"
      gap={2}
      sx={{ mb: 3 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" sx={{ color: 'var(--dwp-product-accent)' }}>
          {eyebrow}
        </Typography>
        <Typography component="h1" variant="h4" fontWeight={800} sx={{ mt: 0.25 }}>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
          {description}
        </Typography>
      </Box>
      {actions && (
        <Stack direction="row" gap={1} flexWrap="wrap">
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

export function RoomIdentity({ room }: { room: CalendarResource }) {
  return (
    <Stack direction="row" gap={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <Box
        aria-hidden="true"
        sx={{
          width: 38,
          height: 38,
          flex: '0 0 auto',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          color: 'var(--dwp-product-accent)',
          bgcolor: 'var(--dwp-product-soft)',
        }}
      >
        <Building2 size={19} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={750} noWrap>
          {room.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {[room.site, room.floor, `${room.capacity}명`].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
    </Stack>
  );
}

export function RoomStateChip({ room }: { room: CalendarResource }) {
  const { t } = useTranslation('rooms');
  const color =
    room.state === 'AVAILABLE' ? 'success' : room.state === 'MAINTENANCE' ? 'warning' : 'default';
  return (
    <Chip
      size="small"
      color={color}
      variant="outlined"
      label={t(`admin.resources.states.${room.state}`)}
    />
  );
}
