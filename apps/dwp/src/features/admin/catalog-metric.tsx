import { formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

type CatalogMetricProps = {
  label: string;
  value: number;
  detail: string;
};

export function CatalogMetric({ label, value, detail }: CatalogMetricProps) {
  return (
    <Box sx={{ minWidth: 0, px: 2, py: 1.6, borderLeft: { xs: 0, sm: 1 }, borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      <Typography component="p" variant="h6" fontWeight={760} sx={{ mt: 0.25 }}>
        {formatNumber(value)}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap display="block">
        {detail}
      </Typography>
    </Box>
  );
}
