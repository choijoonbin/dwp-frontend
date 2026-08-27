import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';

import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AdminLoading() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="rounded" height={126} />
      <Skeleton variant="rounded" height={360} />
    </Stack>
  );
}

export function ScopeNotice() {
  const { t } = useTranslation('calendar');

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }} color="text.secondary">
      <ShieldCheck size={15} />
      <Typography variant="caption">{t('admin.privacyBoundary')}</Typography>
    </Stack>
  );
}
