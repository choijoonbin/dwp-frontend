import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';

import { formatKeyName, formatDateTime } from '../utils';

import type { LineageStep } from '../../../components/evidence/types';

// ----------------------------------------------------------------------

interface StepDetailsInlineProps {
  step: LineageStep;
}

export function StepDetailsInline({ step }: StepDetailsInlineProps) {
  return (
    <Card sx={{ bgcolor: 'action.hover', mb: 3 }}>
      <CardHeader
        title={
          <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Iconify icon="solar:eye-bold" width={16} />
            Step Details: {step.name}
          </Typography>
        }
        titleTypographyProps={{ variant: 'subtitle2' }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label={step.system} variant="outlined" size="small" />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              |
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {formatDateTime(step.timestamp)}
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            {Object.entries(step.details).map(([key, value]) => (
              <Box key={key} sx={{ bgcolor: 'background.paper', borderRadius: 1, p: 1.5 }}>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', textTransform: 'capitalize', display: 'block' }}
                >
                  {formatKeyName(key)}
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                  {String(value)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
