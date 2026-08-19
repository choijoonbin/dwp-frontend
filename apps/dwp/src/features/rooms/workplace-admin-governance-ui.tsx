import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, EmptyState } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ReactNode } from 'react';

export function GovernancePanel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.25}
        sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" fontWeight={800}>
            {title}
          </Typography>
          {description ? (
            <Typography variant="caption" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Box>
        {actions ? (
          <Stack direction="row" gap={1}>
            {actions}
          </Stack>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}

export function GovernanceQueryError({ retry }: { retry: () => void }) {
  const { t } = useTranslation('rooms');
  return (
    <Alert
      severity="error"
      action={
        <ActionButton intent="quiet" startIcon={<RefreshCw size={15} />} onClick={retry}>
          {t('actions.retry')}
        </ActionButton>
      }
    >
      {t('workplace.admin.governance.common.loadError')}
    </Alert>
  );
}

export function GovernanceLoading({ rows = 4 }: { rows?: number }) {
  return (
    <Stack spacing={1} sx={{ p: 2 }} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={54} />
      ))}
    </Stack>
  );
}

export function GovernanceEmpty({ title, description }: { title: string; description: string }) {
  return (
    <EmptyState
      size="standard"
      icon={<AlertTriangle size={26} />}
      title={title}
      description={description}
    />
  );
}
