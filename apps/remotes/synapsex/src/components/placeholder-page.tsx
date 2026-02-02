import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

// ----------------------------------------------------------------------

export type PlaceholderPageProps = {
  title: string;
  description: string;
  icon?: string;
};

/**
 * MUI-based placeholder for Synapse pages (design system compliant).
 * No shadcn/lucide; use Iconify only.
 */
export const PlaceholderPage = ({
  title,
  description,
  icon = 'solar:widget-5-bold-duotone',
}: PlaceholderPageProps) => (
  <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
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
            <Iconify icon={icon} width={24} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              {description}
            </Typography>
          </Box>
        </Stack>
        <Chip
          icon={<Iconify icon="solar:hammer-bold-duotone" width={16} />}
          label="Under Development"
          size="small"
          variant="outlined"
        />
      </Stack>

      <Card variant="outlined" sx={{ borderStyle: 'dashed', bgcolor: 'background.neutral' }}>
        <CardContent sx={{ py: 6, textAlign: 'center' }}>
          <Iconify
            icon="solar:hammer-bold-duotone"
            width={64}
            sx={{ color: 'primary.main', mb: 2 }}
          />
          <Typography variant="h6" sx={{ mb: 1 }}>
            Coming Soon
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto' }}>
            This module is under development. Enterprise features will be available in a future
            release.
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Data Preview
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sample data will appear here once the module is active.
          </Typography>
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderStyle: 'dashed',
              borderRadius: 1,
              py: 6,
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No data available yet
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  </Box>
);
