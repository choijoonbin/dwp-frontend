import { useTranslation } from 'react-i18next';
import { formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import type { NotificationPolicyChannelRule } from '@dwp-frontend/shared-utils/api/notification-api';

export function NotificationPolicyChannels({
  channels,
}: {
  channels: NotificationPolicyChannelRule[];
}) {
  const { t } = useTranslation('notifications');
  const status = (channel: NotificationPolicyChannelRule) => (
    <Chip
      size="small"
      variant={channel.enabled ? 'filled' : 'outlined'}
      color={channel.enabled ? 'success' : 'default'}
      label={t(`admin.policies.${channel.enabled ? 'enabled' : 'disabled'}`)}
    />
  );
  const control = (channel: NotificationPolicyChannelRule) =>
    t(`admin.policies.${channel.userOverridable ? 'userOverridable' : 'managedByTenant'}`);
  const limit = (channel: NotificationPolicyChannelRule) =>
    channel.maxPerWindow == null ? '-' : formatNumber(channel.maxPerWindow);
  return (
    <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Table
        size="small"
        aria-label={t('admin.policies.channelsTable')}
        sx={{
          display: { xs: 'none', lg: 'table' },
          tableLayout: 'fixed',
          '& th, & td': { px: 1, py: 1, typography: 'caption', overflowWrap: 'anywhere' },
          '& th': { bgcolor: 'action.hover', color: 'text.secondary' },
          '& tbody tr:last-child td': { borderBottom: 0 },
        }}
      >
        <TableHead>
          <TableRow>
            {['channel', 'delivery', 'defaultMode', 'userControl', 'limit'].map((key) => (
              <TableCell key={key} align={key === 'limit' ? 'right' : 'left'}>
                {t(`admin.policies.columns.${key}`)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {channels.map((channel) => (
            <TableRow key={channel.channel}>
              <TableCell sx={{ fontWeight: 'subtitle2.fontWeight' }}>
                {t(`channels.${channel.channel}`)}
              </TableCell>
              <TableCell>{status(channel)}</TableCell>
              <TableCell>{t(`admin.policies.mode.${channel.defaultMode}`)}</TableCell>
              <TableCell>{control(channel)}</TableCell>
              <TableCell align="right">{limit(channel)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box
        aria-label={t('admin.policies.channelsTable')}
        sx={{ display: { xs: 'block', lg: 'none' } }}
      >
        {channels.map((channel) => (
          <Box
            key={channel.channel}
            sx={{
              py: 1.25,
              borderBottom: 1,
              borderColor: 'divider',
              '&:last-child': { borderBottom: 0 },
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              flexWrap="wrap"
            >
              <Typography variant="subtitle2">{t(`channels.${channel.channel}`)}</Typography>
              {status(channel)}
            </Stack>
            <Box
              component="dl"
              sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, m: 0, mt: 1 }}
            >
              {[
                ['defaultMode', t(`admin.policies.mode.${channel.defaultMode}`)],
                ['userControl', control(channel)],
                ['limit', limit(channel)],
              ].map(([key, value]) => (
                <Box key={key} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <Typography component="dt" variant="caption" color="text.secondary">
                    {t(`admin.policies.columns.${key}`)}
                  </Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
