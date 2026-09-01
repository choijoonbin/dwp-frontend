import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { LoadingState } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AdminLoading() {
  const { t } = useTranslation('common');
  return (
    <LoadingState
      label={t('labels.loading')}
      variant="skeleton"
      size="page"
      embedded
      skeletonHeights={[126, 360]}
      skeletonGap={2}
    />
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
