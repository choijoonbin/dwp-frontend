import { useQuery } from '@tanstack/react-query';
import { getMe } from '@dwp-frontend/shared-utils';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

export default function ProfilePage() {
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await getMe()).data,
    retry: false,
  });

  return (
    <PageCanvas mode="focus">
      <Typography component="h1" variant="h4">
        Profile
      </Typography>
      <Divider sx={{ my: 3 }} />

      {meQuery.isLoading ? (
        <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: '160px minmax(0, 1fr)' },
          }}
        >
          <Typography color="text.secondary">Name</Typography>
          <Typography>{meQuery.data?.displayName || '-'}</Typography>
          <Typography color="text.secondary">Email</Typography>
          <Typography>{meQuery.data?.email || '-'}</Typography>
          <Typography color="text.secondary">Tenant</Typography>
          <Typography>{meQuery.data?.tenantCode || '-'}</Typography>
          <Typography color="text.secondary">Roles</Typography>
          <Typography>{meQuery.data?.roles?.join(', ') || '-'}</Typography>
        </Box>
      )}
    </PageCanvas>
  );
}
