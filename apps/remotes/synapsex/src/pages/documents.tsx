import type { SelectChangeEvent } from '@mui/material/Select';

import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../routes';
import { mockCases, mockFiDocs, mockCompanyCodes } from '../data/mock-data';

import type { FiDocHeader } from '../data/mock-data';

// ----------------------------------------------------------------------

const integrityMeta: Record<'pass' | 'warn' | 'fail', { icon: string; label: string; color: 'success' | 'warning' | 'error' }> = {
  pass: { icon: 'solar:check-circle-bold', label: 'Pass', color: 'success' },
  warn: { icon: 'solar:danger-triangle-bold', label: 'Warn', color: 'warning' },
  fail: { icon: 'solar:close-circle-bold', label: 'Fail', color: 'error' },
};

// ----------------------------------------------------------------------

/** 전표 조회 */
export const DocumentsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>('all');
  const [selectedIntegrityStatus, setSelectedIntegrityStatus] = useState<string>('all');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [previewDoc, setPreviewDoc] = useState<FiDocHeader | null>(null);

  const filteredDocs = useMemo(
    () =>
      mockFiDocs.filter((doc) => {
        if (selectedCompanyCode !== 'all' && doc.bukrs !== selectedCompanyCode) return false;
        if (selectedIntegrityStatus !== 'all' && doc.integrityStatus !== selectedIntegrityStatus) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (
            !doc.belnr.toLowerCase().includes(query) &&
            !doc.counterparty.toLowerCase().includes(query) &&
            !doc.xblnr.toLowerCase().includes(query)
          ) {
            return false;
          }
        }
        return true;
      }),
    [searchQuery, selectedCompanyCode, selectedIntegrityStatus]
  );

  const getRelatedCases = (docId: string) => mockCases.filter((c) => c.fiDocId === docId);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
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
                FI Documents
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              SAP source-of-truth view for audit-ready evidence
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
            sx={{ bgcolor: 'transparent' }}
          >
            Export
          </Button>
        </Stack>

        {/* Filters */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search doc number, vendor, reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Select
                  fullWidth
                  size="small"
                  value={selectedCompanyCode}
                  onChange={(e: SelectChangeEvent) => setSelectedCompanyCode(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="all">All Companies</MenuItem>
                  {mockCompanyCodes.map((cc) => (
                    <MenuItem key={cc.code} value={cc.code}>
                      {cc.code} - {cc.name}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Select
                  fullWidth
                  size="small"
                  value={selectedIntegrityStatus}
                  onChange={(e: SelectChangeEvent) => setSelectedIntegrityStatus(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="pass">Pass</MenuItem>
                  <MenuItem value="warn">Warn</MenuItem>
                  <MenuItem value="fail">Fail</MenuItem>
                </Select>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Table */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: previewDoc ? 8 : 12 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 0 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={filteredDocs.length > 0 && selectedRows.length === filteredDocs.length}
                            onChange={(e) =>
                              setSelectedRows(e.target.checked ? filteredDocs.map((d) => d.id) : [])
                            }
                          />
                        </TableCell>
                        <TableCell>Doc Number</TableCell>
                        <TableCell>Company</TableCell>
                        <TableCell>Posting Date</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Counterparty</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Integrity</TableCell>
                        <TableCell align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredDocs.slice(0, 50).map((doc) => {
                        const meta = integrityMeta[doc.integrityStatus];
                        return (
                          <TableRow
                            key={doc.id}
                            hover
                            sx={{ cursor: 'pointer', bgcolor: previewDoc?.id === doc.id ? 'action.selected' : 'transparent' }}
                            onClick={() => setPreviewDoc(doc)}
                          >
                            <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedRows.includes(doc.id)}
                                onChange={(e) =>
                                  setSelectedRows((prev) =>
                                    e.target.checked ? [...prev, doc.id] : prev.filter((id) => id !== doc.id)
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
                                {doc.belnr}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150 }}>
                                {doc.xblnr}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                {doc.bukrs}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption">{new Date(doc.budat).toLocaleDateString()}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={doc.blart} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption">{doc.counterparty}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                {doc.wrbtr.toLocaleString('en-US', { minimumFractionDigits: 2 })} {doc.waers}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Label
                                color={meta.color}
                                startIcon={<Iconify icon={meta.icon} width={14} />}
                                sx={{ fontSize: '0.7rem' }}
                              >
                                {meta.label}
                              </Label>
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                component={Link}
                                to={`${SYNAPSE_ROUTES.DOCUMENT_DETAIL.replace(':id', doc.id)}`}
                                size="small"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Iconify icon="solar:arrow-right-up-linear" width={16} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredDocs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} align="center" sx={{ py: 10 }}>
                            <Stack alignItems="center" spacing={1}>
                              <Iconify icon="solar:document-text-bold" width={48} sx={{ color: 'text.disabled' }} />
                              <Typography variant="body2" color="text.secondary">
                                No documents found
                              </Typography>
                              <Typography variant="caption" color="text.disabled">
                                Try adjusting your filters
                              </Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Preview Panel */}
          {previewDoc && (
            <Grid size={{ xs: 12, lg: 4 }}>
              <Card variant="outlined" sx={{ position: 'sticky', top: 80 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Iconify icon="solar:document-text-bold" width={16} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Document Preview
                      </Typography>
                    </Stack>
                    <IconButton size="small" onClick={() => setPreviewDoc(null)}>
                      <Iconify icon="solar:close-circle-bold" width={18} />
                    </IconButton>
                  </Stack>

                  <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {previewDoc.belnr}
                      </Typography>
                      <Label
                        color={integrityMeta[previewDoc.integrityStatus].color}
                        startIcon={<Iconify icon={integrityMeta[previewDoc.integrityStatus].icon} width={14} />}
                      >
                        {integrityMeta[previewDoc.integrityStatus].label}
                      </Label>
                    </Stack>

                    <Grid container spacing={1.5}>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Company
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {previewDoc.bukrs}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Fiscal Year
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {previewDoc.gjahr}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Posting Date
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {new Date(previewDoc.budat).toLocaleDateString()}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Doc Type
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {previewDoc.blart}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">
                          Amount
                        </Typography>
                        <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {previewDoc.wrbtr.toLocaleString('en-US', { minimumFractionDigits: 2 })} {previewDoc.waers}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">
                          Counterparty
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {previewDoc.counterparty}
                        </Typography>
                      </Grid>
                    </Grid>

                    {getRelatedCases(previewDoc.id).length > 0 && (
                      <Box sx={{ pt: 2 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                            Related Cases
                          </Typography>
                          <Stack spacing={0.5}>
                            {getRelatedCases(previewDoc.id).map((c) => (
                              <Link
                                key={c.id}
                                to={`${SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', c.id.toString())}`}
                                style={{ textDecoration: 'none' }}
                              >
                                <Box
                                  sx={{
                                    p: 1.5,
                                    bgcolor: 'action.hover',
                                    borderRadius: 1,
                                    '&:hover': { bgcolor: 'action.selected' },
                                  }}
                                >
                                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                      {c.caseNumber}
                                    </Typography>
                                    <Label color={c.severity === 'critical' ? 'error' : 'default'} sx={{ fontSize: '0.625rem' }}>
                                      {c.severity}
                                    </Label>
                                  </Stack>
                                </Box>
                              </Link>
                            ))}
                          </Stack>
                        </Box>
                    )}

                    <Stack spacing={1} sx={{ pt: 2 }}>
                      <Button
                        component={Link}
                        to={`${SYNAPSE_ROUTES.DOCUMENT_DETAIL.replace(':id', previewDoc.id)}`}
                        variant="contained"
                        size="small"
                        fullWidth
                        startIcon={<Iconify icon="solar:eye-bold" width={16} />}
                      >
                        Open Detail
                      </Button>
                      <Button
                        component={Link}
                        to={`${SYNAPSE_ROUTES.LINEAGE}?docId=${previewDoc.id}`}
                        variant="outlined"
                        size="small"
                        fullWidth
                        startIcon={<Iconify icon="solar:link-bold" width={16} />}
                        sx={{ bgcolor: 'transparent' }}
                      >
                        Open Lineage
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Stack>
    </Box>
  );
};
