import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Send } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, PageCanvas } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getSpaceRequests, useAuth } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { CreateSpaceDialog } from './create-space-dialog';
import { SpaceStatusChip } from './space-ui';

export function SpaceRequestsPage() {
  const { t, i18n } = useTranslation('spaces');
  const auth = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const requests = useQuery({
    queryKey: ['spaces', 'requests', auth.user?.tenantId, auth.user?.userId],
    queryFn: () => getSpaceRequests('ALL'),
    staleTime: 20_000,
  });
  const korean = (i18n.resolvedLanguage ?? i18n.language).startsWith('ko');

  return (
    <PageCanvas>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        gap={2}
      >
        <Stack direction="row" gap={1.5} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--dwp-product-accent)',
              bgcolor: 'var(--dwp-product-selection)',
              borderRadius: 1,
            }}
          >
            <Send size={20} />
          </Box>
          <Box>
            <Typography component="h1" variant="h5">
              {t('requests.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('requests.description')}
            </Typography>
          </Box>
        </Stack>
        <ActionButton
          intent="primary"
          startIcon={<Plus size={17} />}
          onClick={() => setCreateOpen(true)}
        >
          {t('actions.createSpace')}
        </ActionButton>
      </Stack>

      {requests.isError && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {t('requests.loadError')}
        </Alert>
      )}
      {requests.isLoading ? (
        <Skeleton variant="rounded" height={360} sx={{ mt: 3 }} />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 3, borderRadius: 1 }}>
          <Table aria-label={t('requests.tableLabel')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('requests.columns.space')}</TableCell>
                <TableCell>{t('requests.columns.template')}</TableCell>
                <TableCell>{t('requests.columns.visibility')}</TableCell>
                <TableCell>{t('requests.columns.risk')}</TableCell>
                <TableCell>{t('requests.columns.status')}</TableCell>
                <TableCell>{t('requests.columns.requestedAt')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.data?.map((request) => (
                <TableRow key={request.requestId} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={750}>
                      {request.requestedName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {request.requestedKey}
                    </Typography>
                  </TableCell>
                  <TableCell>{korean ? request.templateNameKo : request.templateNameEn}</TableCell>
                  <TableCell>{t(`visibility.${request.requestedVisibility}`)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={request.riskLevel === 'HIGH' ? 'error' : 'default'}
                      label={t(`risk.${request.riskLevel}`, { defaultValue: request.riskLevel })}
                    />
                  </TableCell>
                  <TableCell>
                    <SpaceStatusChip value={request.status} />
                  </TableCell>
                  <TableCell>
                    {formatDate(request.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                  </TableCell>
                </TableRow>
              ))}
              {!requests.data?.length && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography fontWeight={750}>{t('requests.emptyTitle')}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {t('requests.emptyDescription')}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <CreateSpaceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageCanvas>
  );
}
