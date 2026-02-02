import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';

import { SeverityBadge } from '../../../components/finance/severity-badge';
import { formatKeyName, formatDateTime, safeRenderKeyValue } from '../utils';

import type { VendorMasterChange, VendorMasterSnapshot } from '../../../components/evidence/types';

// ----------------------------------------------------------------------

interface TimeTravelSectionProps {
  transaction: VendorMasterSnapshot;
  current: VendorMasterSnapshot;
  value: number;
  onChange: (value: number) => void;
  changedFields: VendorMasterChange[];
}

export function TimeTravelSection({
  transaction,
  current,
  value,
  onChange,
  changedFields,
}: TimeTravelSectionProps) {
  const isTransactionTime = value < 50;
  const activeSnapshot = isTransactionTime ? transaction : current;

  return (
    <Stack spacing={3}>
      {/* Time-Travel Slider */}
      <Card sx={{ bgcolor: 'primary.lighter', borderColor: 'primary.main', borderWidth: 1, borderStyle: 'solid' }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              View data at:
            </Typography>
            <Chip label={isTransactionTime ? 'Transaction Time' : 'Current State'} color={isTransactionTime ? 'primary' : 'default'} size="small" />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Slider value={value} onChange={(_, v) => onChange(v as number)} max={100} step={1} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'text.secondary' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.primary' }}>
                  Transaction Time
                </Typography>
                <Typography variant="caption">{formatDateTime(transaction.timestamp)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.primary' }}>
                  Current State
                </Typography>
                <Typography variant="caption">{formatDateTime(current.timestamp)}</Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Changes Summary */}
      {changedFields.length > 0 && (
        <Card sx={{ bgcolor: 'warning.lighter', borderColor: 'warning.main', borderWidth: 1, borderStyle: 'solid' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Iconify icon="solar:danger-triangle-bold" width={16} sx={{ color: 'warning.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 500, color: 'warning.main' }}>
                {changedFields.length} field(s) changed since transaction
              </Typography>
            </Box>
            <Stack spacing={1}>
              {changedFields.map((change, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.75rem' }}>
                  <Typography variant="caption" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                    {formatKeyName(change.field)}:
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', textDecoration: 'line-through' }}>
                    {change.oldValue}
                  </Typography>
                  <Iconify icon="solar:alt-arrow-right-linear" width={12} />
                  <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 500 }}>
                    {change.newValue}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Vendor Master Data */}
      <Card>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:buildings-2-bold" width={16} sx={{ color: 'text.secondary' }} />
                Vendor Master Record
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 400, color: 'text.secondary' }}>
                As of: {formatDateTime(activeSnapshot.timestamp)}
              </Typography>
            </Box>
          }
          titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }}
        />
        <CardContent sx={{ pt: 0 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            {Object.entries(activeSnapshot.data).map(([key, fieldValue]) => {
              const isChanged = changedFields.some((c) => c.field === key);
              return (
                <Box
                  key={key}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    ...(isChanged && !isTransactionTime
                      ? { bgcolor: 'warning.lighter', border: 1, borderColor: 'warning.main' }
                      : { bgcolor: 'action.hover' }),
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', textTransform: 'capitalize', display: 'block' }}
                  >
                    {formatKeyName(key)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      mt: 0.5,
                      ...(isChanged && !isTransactionTime && { color: 'warning.main' }),
                    }}
                  >
                    {safeRenderKeyValue(fieldValue)}
                  </Typography>
                  {isChanged && (
                    <Typography variant="caption" sx={{ color: 'warning.main', fontSize: '0.625rem' }}>
                      Changed
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {/* Modification Log */}
      <Card>
        <CardHeader
          title={
            <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Iconify icon="solar:history-bold" width={16} sx={{ color: 'text.secondary' }} />
              Recent Modifications
            </Typography>
          }
          titleTypographyProps={{ variant: 'subtitle2' }}
        />
        <CardContent sx={{ pt: 0 }}>
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: 'warning.lighter',
                  color: 'warning.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Iconify icon="solar:user-bold" width={16} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Bank Account Changed
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Modified by USER_AP001
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                  2026-01-29 08:15:00
                </Typography>
              </Box>
              <SeverityBadge severity="high" size="sm" />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: 'action.disabledBackground',
                  color: 'text.disabled',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Iconify icon="solar:database-bold" width={16} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Risk Category Updated
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Auto-updated by Risk Engine
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                  2026-01-29 08:16:00
                </Typography>
              </Box>
              <SeverityBadge severity="medium" size="sm" />
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
