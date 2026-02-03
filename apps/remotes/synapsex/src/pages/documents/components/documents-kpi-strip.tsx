import { Iconify } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type DocumentsKpiStripProps = {
  totalDocs: number;
  totalAmount: number;
  flaggedCount: number;
  currency?: string;
};

export const DocumentsKpiStrip = ({
  totalDocs,
  totalAmount,
  flaggedCount,
  currency = 'USD',
}: DocumentsKpiStripProps) => (
  <Stack
    direction="row"
    spacing={3}
    sx={{
      py: 1.5,
      px: 2,
      borderRadius: 1,
      bgcolor: 'action.hover',
      flexWrap: 'wrap',
    }}
  >
    <Stack direction="row" alignItems="center" spacing={1}>
      <Iconify icon="solar:document-text-bold" width={18} sx={{ color: 'text.secondary' }} />
      <Typography variant="body2" color="text.secondary">
        Total Docs
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {totalDocs.toLocaleString()}
      </Typography>
    </Stack>
    <Stack direction="row" alignItems="center" spacing={1}>
      <Iconify icon="solar:dollar-bold" width={18} sx={{ color: 'text.secondary' }} />
      <Typography variant="body2" color="text.secondary">
        Total Amount
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
        {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currency}
      </Typography>
    </Stack>
    {flaggedCount > 0 && (
      <Stack direction="row" alignItems="center" spacing={1}>
        <Iconify icon="solar:danger-triangle-bold" width={18} sx={{ color: 'warning.main' }} />
        <Typography variant="body2" color="text.secondary">
          Flagged
        </Typography>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'warning.main' }}>
          {flaggedCount}
        </Typography>
      </Stack>
    )}
  </Stack>
);
