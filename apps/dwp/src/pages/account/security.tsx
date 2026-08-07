import { useAuth } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

export default function SecurityPage() {
  const auth = useAuth();

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography component="h1" variant="h4">
        Security & sessions
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        Account security and active browser sessions
      </Typography>

      <Typography component="h2" variant="h6" sx={{ mt: 5 }}>
        Current session
      </Typography>
      <Divider sx={{ mt: 1, mb: 3 }} />
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: '180px minmax(0, 1fr)' },
        }}
      >
        <Typography color="text.secondary">User</Typography>
        <Typography>{auth.user?.displayName || '-'}</Typography>
        <Typography color="text.secondary">Tenant</Typography>
        <Typography>{auth.user?.tenantCode || '-'}</Typography>
        <Typography color="text.secondary">Status</Typography>
        <Box>
          <Chip label="Active" color="success" size="small" />
        </Box>
      </Box>
    </Container>
  );
}
