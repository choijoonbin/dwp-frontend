import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMe } from '@dwp-frontend/shared-utils';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

export default function ProfilePage() {
  const { t } = useTranslation('account');
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await getMe()).data,
    retry: false,
  });

  return (
    <PageCanvas mode="focus">
      <Typography component="h1" variant="h4">
        {t('profile.title')}
      </Typography>
      <Divider sx={{ my: 3 }} />

      {meQuery.isLoading ? (
        <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={28} aria-label={t('profile.loading')} />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: '160px minmax(0, 1fr)' },
          }}
        >
          <Typography color="text.secondary">{t('profile.fields.name')}</Typography>
          <Typography>{meQuery.data?.displayName || '-'}</Typography>
          <Typography color="text.secondary">{t('profile.fields.email')}</Typography>
          <Typography>{meQuery.data?.email || '-'}</Typography>
          <Typography color="text.secondary">{t('profile.fields.tenant')}</Typography>
          <Typography>{meQuery.data?.tenantName || meQuery.data?.tenantCode || '-'}</Typography>
          <Typography color="text.secondary">{t('profile.fields.roles')}</Typography>
          <Typography>{meQuery.data?.roles?.join(', ') || '-'}</Typography>
        </Box>
      )}
    </PageCanvas>
  );
}
