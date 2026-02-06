/**
 * Open Items 페이지 — API 연동
 * URL params: ?bukrs=1000&itemType=AP&dueFrom=2025-01-01&dueTo=2025-12-31&status=open&partyId=xxx&lifnr=xxx&kunnr=xxx
 * belnr, gjahr는 BE 미지원 — 숨김. docs/reference/OPEN_ITEMS_BELNR_GJAHR_BE_REQUEST.md
 */

import { useMemo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOpenItemsListQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

const buildDocDetailPath = (bukrs: string, belnr: string, gjahr: string) =>
  `/synapse/documents/${bukrs}/${belnr}/${gjahr}`;

export const OpenItemsPage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const queryParams = useMemo(() => {
    const bukrs = searchParams.get('bukrs') ?? undefined;
    const itemType = searchParams.get('itemType') as 'AP' | 'AR' | undefined;
    const dueFrom = searchParams.get('dueFrom') ?? undefined;
    const dueTo = searchParams.get('dueTo') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const partyId = searchParams.get('partyId') ?? undefined;
    const lifnr = searchParams.get('lifnr') ?? undefined;
    const kunnr = searchParams.get('kunnr') ?? undefined;
    const docKey = searchParams.get('docKey') ?? undefined;
    return {
      limit: 200,
      bukrs: bukrs || undefined,
      itemType: itemType === 'AP' || itemType === 'AR' ? itemType : undefined,
      dueFrom: dueFrom || undefined,
      dueTo: dueTo || undefined,
      status: status || undefined,
      partyId: partyId || undefined,
      lifnr: lifnr || undefined,
      kunnr: kunnr || undefined,
      docKey: docKey || undefined,
    };
  }, [searchParams]);

  const { data: items = [], isLoading, error, refetch } = useOpenItemsListQuery(queryParams);

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <Iconify
              icon="solar:danger-triangle-bold-duotone"
              width={48}
              sx={{ color: 'error.main', mb: 2 }}
            />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t('error.errorState.failedToLoadOpenItems')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {error instanceof Error ? error.message : t('error.errorState.unknownError')}
            </Typography>
            <Button variant="outlined" onClick={() => refetch()} startIcon={<Iconify icon="solar:refresh-bold" width={18} />}>
              {t('error.errorState.retry')}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:wallet-bold-duotone" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('openItems.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {t('openItems.subtitle')}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
            sx={{ bgcolor: 'transparent' }}
          >
            {t('openItems.export')}
          </Button>
        </Stack>

        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>{t('openItems.table.item')}</TableCell>
                    <TableCell>{t('openItems.table.type')}</TableCell>
                    <TableCell>{t('openItems.table.entity')}</TableCell>
                    <TableCell>{t('openItems.table.document')}</TableCell>
                    <TableCell>{t('openItems.table.dueDate')}</TableCell>
                    <TableCell>{t('openItems.table.overdue')}</TableCell>
                    <TableCell align="right">{t('openItems.table.amount')}</TableCell>
                    <TableCell>{t('openItems.table.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('openItems.loading')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                        <Stack alignItems="center" spacing={1}>
                          <Iconify
                            icon="solar:wallet-bold-duotone"
                            width={48}
                            sx={{ color: 'text.disabled' }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {t('openItems.empty')}
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow
                        key={item.id}
                        hover
                        onClick={() => navigate(buildDocDetailPath(item.bukrs, item.belnr, item.gjahr))}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {item.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.type}
                            size="small"
                            variant="outlined"
                            sx={{
                              fontSize: '0.75rem',
                              bgcolor: item.type === 'AR' ? 'info.50' : 'primary.50',
                              color: item.type === 'AR' ? 'info.main' : 'primary.main',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.entityName || item.entityId || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                            {item.docNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              color: item.daysPastDue > 0 ? 'error.main' : 'text.secondary',
                              fontWeight: item.daysPastDue > 0 ? 600 : 400,
                            }}
                          >
                            {item.daysPastDue > 0 ? `+${item.daysPastDue}d` : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {item.amount.toLocaleString('en-US', { minimumFractionDigits: 0 })} {item.currency}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {item.paymentBlock && (
                              <Chip label={t('openItems.status.blocked')} size="small" color="error" sx={{ fontSize: '0.65rem' }} />
                            )}
                            {item.disputeFlag && (
                              <Chip label={t('openItems.status.dispute')} size="small" color="warning" sx={{ fontSize: '0.65rem' }} />
                            )}
                            {item.daysPastDue > 0 && (
                              <Chip label={t('openItems.status.overdue')} size="small" color="error" sx={{ fontSize: '0.65rem' }} />
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
