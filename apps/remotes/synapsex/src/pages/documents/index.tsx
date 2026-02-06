import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';
import { is403Error, useCompanyCodeCatalogQuery } from '@dwp-frontend/shared-utils';

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

import { ErrorStateWithRetry } from '../../components/ux';
import { useDocumentsList } from './hooks/use-documents-list';
import { DocumentsKpiStrip } from './components/documents-kpi-strip';
import { DocumentsFilterBar } from './components/documents-filter-bar';

const getIntegrityMeta = (t: (k: string) => string) =>
  ({
    pass: { icon: 'solar:check-circle-bold', label: t('documents.integrity.pass'), color: 'success' as const },
    warn: { icon: 'solar:danger-triangle-bold', label: t('documents.integrity.warn'), color: 'warning' as const },
    fail: { icon: 'solar:close-circle-bold', label: t('documents.integrity.fail'), color: 'error' as const },
    default: { icon: 'solar:info-circle-bold', label: '-', color: 'default' as const },
  }) as Record<string, { icon: string; label: string; color: 'success' | 'warning' | 'error' | 'default' }>;

const buildDocDetailPath = (bukrs: string, belnr: string, gjahr: string) =>
  `/synapse/documents/${bukrs}/${belnr}/${gjahr}`;

export const DocumentsPage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { data: catalogData } = useCompanyCodeCatalogQuery({ enabled: true });
  const companyCodes = (catalogData ?? []).map((c) => ({
    code: c.bukrs,
    name: c.bukrs,
  }));

  const {
    items,
    isLoading,
    error,
    refetch,
    filters,
    setFilters,
    summary,
    page,
    setPage,
    totalCount,
    totalPages,
  } = useDocumentsList();

  const handleRowClick = (bukrs: string, belnr: string, gjahr: string) => {
    navigate(buildDocDetailPath(bukrs, belnr, gjahr));
  };

  if (error) {
    return (
      <ErrorStateWithRetry
        title={is403Error(error) ? undefined : t('error.errorState.failedToLoadDocuments')}
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
        is403={is403Error(error)}
      />
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
              <Iconify icon="solar:document-text-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('documents.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {t('documents.subtitle')}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
            sx={{ bgcolor: 'transparent' }}
          >
            {t('documents.export')}
          </Button>
        </Stack>

        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <DocumentsFilterBar
              filters={filters}
              onFiltersChange={setFilters}
              companyCodes={companyCodes}
            />
          </CardContent>
        </Card>

        <DocumentsKpiStrip
          totalDocs={summary.totalDocs}
          totalAmount={summary.totalAmount}
          flaggedCount={summary.flaggedCount}
        />

        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>{t('documents.table.docNumber')}</TableCell>
                    <TableCell>{t('documents.table.company')}</TableCell>
                    <TableCell>{t('documents.table.postingDate')}</TableCell>
                    <TableCell>{t('documents.table.type')}</TableCell>
                    <TableCell>{t('documents.table.counterparty')}</TableCell>
                    <TableCell align="right">{t('documents.table.amount')}</TableCell>
                    <TableCell>{t('documents.table.integrity')}</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('documents.loading')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                        <Stack alignItems="center" spacing={1}>
                          <Iconify
                            icon="solar:document-text-bold"
                            width={48}
                            sx={{ color: 'text.disabled' }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {t('documents.empty')}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {t('documents.emptyHint')}
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((doc) => {
                      const integrityMeta = getIntegrityMeta(t);
                      const meta = integrityMeta[doc.integrityStatus ?? ''] ?? integrityMeta.default;
                      return (
                        <TableRow
                          key={doc.docKey}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                          onClick={() => handleRowClick(doc.bukrs, doc.belnr, doc.gjahr)}
                        >
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
                              {doc.belnr}
                            </Typography>
                            {doc.xblnr && (
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150 }}>
                                {doc.xblnr}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {doc.bukrs}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {doc.budat ? new Date(doc.budat).toLocaleDateString() : '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {doc.blart ? (
                              <Chip
                                label={doc.blart}
                                size="small"
                                variant="outlined"
                                sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                              />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">{doc.counterparty ?? '-'}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {doc.wrbtr != null
                                ? doc.wrbtr.toLocaleString('en-US', { minimumFractionDigits: 2 })
                                : '-'}{' '}
                              {doc.waers}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {doc.integrityStatus ? (
                              <Label color={meta.color} startIcon={<Iconify icon={meta.icon} width={14} />} sx={{ fontSize: '0.7rem' }}>
                                {meta.label}
                              </Label>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              component={Link}
                              to={buildDocDetailPath(doc.bukrs, doc.belnr, doc.gjahr)}
                              size="small"
                              endIcon={<Iconify icon="solar:arrow-right-up-linear" width={16} />}
                            >
                              {t('documents.open')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {totalPages > 1 && (
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
              >
                <Typography variant="body2" color="text.secondary">
                  {t('documents.pageOf', {
                    current: String(page + 1),
                    total: String(totalPages),
                    count: totalCount,
                  })}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    {t('documents.previous')}
                  </Button>
                  <Button
                    size="small"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    {t('documents.next')}
                  </Button>
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
