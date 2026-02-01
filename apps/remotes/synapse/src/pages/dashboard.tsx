import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';


// ----------------------------------------------------------------------

/** 통합 관제 센터 (Intelligence Command Center) */
export const DashboardPage = () => (
  <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200 }}>
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" gap={1.5}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1.5,
            bgcolor: 'primary.lighter',
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Iconify icon="solar:chart-2-bold-duotone" width={24} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            통합 관제 센터
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
            Real-time overview of autonomous finance operations
          </Typography>
        </Box>
      </Stack>

      <Card variant="outlined" sx={{ borderStyle: 'dashed', bgcolor: 'background.neutral' }}>
        <CardContent sx={{ py: 6, textAlign: 'center' }}>
          <Iconify
            icon="solar:chart-2-bold-duotone"
            width={64}
            sx={{ color: 'primary.main', mb: 2 }}
          />
          <Typography variant="h6" sx={{ mb: 1 }}>
            Intelligence Command Center
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto' }}>
            KPI cards, action queue, risk drivers, and agent stream will appear here. Menu is
            provided by the menu API.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  </Box>
);
