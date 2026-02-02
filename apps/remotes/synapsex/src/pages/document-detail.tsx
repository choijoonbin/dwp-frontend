import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { Link, useParams, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../routes';
import { StatusPill } from '../components/finance/status-pill';
import { SeverityBadge } from '../components/finance/severity-badge';
import {
  mockCases,
  mockFiDocs,
  mockActions,
  mockFiDocItems,
  type FiDocHeader,
  mockIntegrityChecks,
} from '../data/mock-data';

// ----------------------------------------------------------------------

const integrityMeta: Record<'pass' | 'warn' | 'fail', { icon: string; label: string; color: 'success' | 'warning' | 'error' }> = {
  pass: { icon: 'solar:check-circle-bold', label: 'Pass', color: 'success' },
  warn: { icon: 'solar:danger-triangle-bold', label: 'Warning', color: 'warning' },
  fail: { icon: 'solar:close-circle-bold', label: 'Failed', color: 'error' },
};

// ----------------------------------------------------------------------

/** 전표 상세 페이지 */
export const DocumentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Find the document
  const doc = mockFiDocs.find((d) => d.id === id);
  const lineItems = mockFiDocItems.filter((item) => item.docId === id);
  const integrityChecks = mockIntegrityChecks.filter((chk) => chk.docId === id);
  const relatedCases = mockCases.filter((c) => c.fiDocId === id);
  const relatedActions = mockActions.filter((a) => relatedCases.some((c) => c.id === a.caseId));

  // Build reversal chain
  const reversalChain = useMemo(() => {
    if (!doc) return [];

    const chain: FiDocHeader[] = [];

    // Go backwards to find the original
    let current = doc;
    const visitedBack = new Set<string>();
    while (current.reversesDoc && !visitedBack.has(current.reversesDoc)) {
      visitedBack.add(current.reversesDoc);
      const prev = mockFiDocs.find((d) => d.id === current.reversesDoc);
      if (prev) {
        chain.unshift(prev);
        current = prev;
      } else break;
    }

    // Add current doc
    chain.push(doc);

    // Go forward to find subsequent reversals
    current = doc;
    const visitedFwd = new Set<string>();
    while (current.reversedByDoc && !visitedFwd.has(current.reversedByDoc)) {
      visitedFwd.add(current.reversedByDoc);
      const next = mockFiDocs.find((d) => d.id === current.reversedByDoc);
      if (next) {
        chain.push(next);
        current = next;
      } else break;
    }

    return chain;
  }, [doc]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Integrity status badge
  const IntegrityBadge = ({ status }: { status: 'pass' | 'warn' | 'fail' }) => {
    const config = integrityMeta[status];
    return (
      <Chip
        icon={<Iconify icon={config.icon} width={16} />}
        label={config.label}
        color={config.color}
        variant="outlined"
        size="small"
        sx={{ fontWeight: 400 }}
      />
    );
  };

  // Check severity badge
  const CheckSeverityBadge = ({ severity }: { severity: 'info' | 'warn' | 'critical' }) => {
    const config = {
      info: { color: 'info' as const },
      warn: { color: 'warning' as const },
      critical: { color: 'error' as const },
    };
    return (
      <Chip
        label={severity}
        color={config[severity].color}
        variant="outlined"
        size="small"
        sx={{ fontWeight: 400, textTransform: 'capitalize' }}
      />
    );
  };

  if (!doc) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card>
          <CardContent sx={{ p: 12, textAlign: 'center' }}>
            <Iconify icon="solar:document-text-bold-duotone" width={48} sx={{ color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Document Not Found
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              The document you are looking for does not exist or has been removed.
            </Typography>
            <Button component={Link} to={SYNAPSE_ROUTES.DOCUMENTS} startIcon={<Iconify icon="solar:arrow-left-linear" width={18} />}>
              Back to Documents
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Calculate line item totals
  const totalDebit = lineItems.filter((i) => i.shkzg === 'S').reduce((sum, i) => sum + i.wrbtr, 0);
  const totalCredit = lineItems.filter((i) => i.shkzg === 'H').reduce((sum, i) => sum + i.wrbtr, 0);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-start' }} justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="flex-start" spacing={2}>
            <IconButton onClick={() => navigate(-1)} sx={{ mt: 0.5 }}>
              <Iconify icon="solar:arrow-left-linear" width={20} />
            </IconButton>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                <Typography variant="h4" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                  {doc.belnr}
                </Typography>
                <IntegrityBadge status={doc.integrityStatus} />
                {doc.reversalFlag && (
                  <Chip
                    icon={<Iconify icon="solar:git-branch-bold" width={14} />}
                    label="Reversal Chain"
                    variant="outlined"
                    size="small"
                  />
                )}
                {doc.linkedCasesCount > 0 && (
                  <Chip
                    icon={<Iconify icon="solar:info-circle-bold" width={14} />}
                    label={`${doc.linkedCasesCount} Case(s)`}
                    color="secondary"
                    size="small"
                  />
                )}
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {doc.bktxt} | {doc.bukrs} / {doc.gjahr}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />} sx={{ bgcolor: 'transparent' }}>
              Export
            </Button>
            <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:external-link-bold" width={18} />} sx={{ bgcolor: 'transparent' }}>
              Open in SAP
            </Button>
          </Stack>
        </Stack>

        {/* Header Summary Card (BKPF-like) */}
        <Card variant="outlined">
          <CardHeader
            title={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Iconify icon="solar:document-text-bold" width={20} />
                <Typography variant="subtitle1">Document Header</Typography>
              </Stack>
            }
            sx={{ pb: 1.5 }}
          />
          <CardContent>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
                <Stack spacing={0.5}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Iconify icon="solar:hashtag-bold" width={14} sx={{ color: 'text.secondary' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Document Number
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {doc.belnr}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => copyToClipboard(doc.belnr, 'belnr')}
                      sx={{ width: 20, height: 20 }}
                    >
                      <Iconify
                        icon={copiedField === 'belnr' ? 'solar:check-circle-bold' : 'solar:copy-bold'}
                        width={14}
                        sx={{ color: copiedField === 'belnr' ? 'success.main' : 'text.secondary' }}
                      />
                    </IconButton>
                  </Stack>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
                <Stack spacing={0.5}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Iconify icon="solar:buildings-bold" width={14} sx={{ color: 'text.secondary' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Company Code
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {doc.bukrs}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
                <Stack spacing={0.5}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Iconify icon="solar:calendar-bold" width={14} sx={{ color: 'text.secondary' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Posting Date
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {new Date(doc.budat).toLocaleDateString()}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
                <Stack spacing={0.5}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Iconify icon="solar:document-text-bold" width={14} sx={{ color: 'text.secondary' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Doc Type / TCode
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Chip label={doc.blart} variant="outlined" size="small" sx={{ fontFamily: 'monospace' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {doc.tcode}
                    </Typography>
                  </Stack>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
                <Stack spacing={0.5}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Iconify icon="solar:user-bold" width={14} sx={{ color: 'text.secondary' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Created By
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {doc.usnam}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
                <Stack spacing={0.5}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Iconify icon="solar:dollar-bold" width={14} sx={{ color: 'text.secondary' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Total Amount
                    </Typography>
                  </Stack>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {Math.abs(doc.wrbtr).toLocaleString('en-US', { minimumFractionDigits: 2 })} {doc.waers}
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
            <Divider sx={{ my: 3 }} />
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Reference
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {doc.xblnr}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Counterparty
                  </Typography>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {doc.counterparty}
                    </Typography>
                    {doc.counterpartyId && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                        {doc.counterpartyId}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Document Date
                  </Typography>
                  <Typography variant="body2">{new Date(doc.bldat).toLocaleDateString()}</Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Entry Date
                  </Typography>
                  <Typography variant="body2">{new Date(doc.createdAt).toLocaleString()}</Typography>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tabbed Content */}
        <Box>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab
              icon={<Iconify icon="solar:document-text-bold" width={18} />}
              iconPosition="start"
              label={<Box sx={{ display: { xs: 'none', sm: 'inline' } }}>Line Items</Box>}
              sx={{ minHeight: 48 }}
            />
            <Tab
              icon={<Iconify icon="solar:git-branch-bold" width={18} />}
              iconPosition="start"
              label={<Box sx={{ display: { xs: 'none', sm: 'inline' } }}>Reversals</Box>}
              sx={{ minHeight: 48 }}
            />
            <Tab
              icon={<Iconify icon="solar:info-circle-bold" width={18} />}
              iconPosition="start"
              label={<Box sx={{ display: { xs: 'none', sm: 'inline' } }}>Integrity</Box>}
              sx={{ minHeight: 48 }}
            />
            <Tab
              icon={<Iconify icon="solar:bolt-bold" width={18} />}
              iconPosition="start"
              label={<Box sx={{ display: { xs: 'none', sm: 'inline' } }}>Related</Box>}
              sx={{ minHeight: 48 }}
            />
          </Tabs>

          {/* Line Items Tab */}
          {activeTab === 0 && (
            <Card variant="outlined" sx={{ mt: 2 }}>
              <CardHeader
                title="Line Items (BSEG)"
                subheader={`${lineItems.length} line item(s)`}
                sx={{ pb: 1.5 }}
              />
              <CardContent sx={{ p: 0 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'background.neutral' }}>
                        <TableCell sx={{ width: 80 }}>Item</TableCell>
                        <TableCell>G/L Account</TableCell>
                        <TableCell>Text</TableCell>
                        <TableCell>D/C</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Tax</TableCell>
                        <TableCell>Cost Center</TableCell>
                        <TableCell>Assignment</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lineItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                            No line items found for this document
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {lineItems.map((item) => (
                            <TableRow key={item.id} hover>
                              <TableCell sx={{ fontFamily: 'monospace' }}>{item.buzei}</TableCell>
                              <TableCell>
                                <Box>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                    {item.hkont}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {item.hkontName}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.sgtxt}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={item.shkzg === 'S' ? 'Debit' : 'Credit'}
                                  color={item.shkzg === 'S' ? 'success' : 'info'}
                                  variant="outlined"
                                  size="small"
                                  sx={{ fontFamily: 'monospace' }}
                                />
                              </TableCell>
                              <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                                {item.wrbtr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                {item.mwskz || '-'}
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                {item.kostl || '-'}
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.zuonr || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Totals row */}
                          <TableRow sx={{ bgcolor: 'background.neutral', fontWeight: 600 }}>
                            <TableCell colSpan={4} align="right">
                              Totals:
                            </TableCell>
                            <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                              <Stack spacing={0.5}>
                                <Typography variant="body2" sx={{ color: 'success.main' }}>
                                  {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })} D
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'info.main' }}>
                                  {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })} C
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell colSpan={3} />
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* Reversal Chain Tab */}
          {activeTab === 1 && (
            <Card variant="outlined" sx={{ mt: 2 }}>
              <CardHeader
                title={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Iconify icon="solar:git-branch-bold" width={20} />
                    <Typography variant="subtitle1">Reversal Chain</Typography>
                  </Stack>
                }
                subheader="Document reversal history and relationships"
                sx={{ pb: 1.5 }}
              />
              <CardContent>
                {reversalChain.length <= 1 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Iconify icon="solar:git-branch-bold-duotone" width={48} sx={{ color: 'text.disabled', mb: 2 }} />
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                      No Reversal Chain
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                      This document has not been reversed and does not reverse another document.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={3}>
                    {/* Visual chain */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflowX: 'auto', pb: 1 }}>
                      {reversalChain.map((chainDoc, idx) => (
                        <Box key={chainDoc.id} sx={{ display: 'flex', alignItems: 'center' }}>
                          <Card
                            component={Link}
                            to={`${SYNAPSE_ROUTES.DOCUMENTS}/${chainDoc.id}`}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              minWidth: 120,
                              transition: 'all 0.2s',
                              ...(chainDoc.id === doc.id
                                ? { borderColor: 'primary.main', bgcolor: 'primary.lighter' }
                                : { '&:hover': { borderColor: 'primary.main', bgcolor: 'background.neutral' } }),
                            }}
                          >
                            <Stack spacing={0.5} alignItems="center">
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                {chainDoc.belnr}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {new Date(chainDoc.budat).toLocaleDateString()}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  fontFamily: 'monospace',
                                  color: chainDoc.wrbtr < 0 ? 'error.main' : 'text.primary',
                                  mt: 0.5,
                                }}
                              >
                                {chainDoc.wrbtr.toLocaleString('en-US', { minimumFractionDigits: 2 })} {chainDoc.waers}
                              </Typography>
                              {chainDoc.id === doc.id && (
                                <Chip label="Current" size="small" color="primary" sx={{ mt: 1, fontSize: '0.625rem' }} />
                              )}
                            </Stack>
                          </Card>
                          {idx < reversalChain.length - 1 && (
                            <Iconify icon="solar:alt-arrow-right-linear" width={20} sx={{ color: 'text.secondary', mx: 0.5, flexShrink: 0 }} />
                          )}
                        </Box>
                      ))}
                    </Box>

                    {/* Chain table */}
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'background.neutral' }}>
                            <TableCell>Doc Number</TableCell>
                            <TableCell>Posting Date</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell align="right">Amount</TableCell>
                            <TableCell>Relationship</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reversalChain.map((chainDoc, idx) => (
                            <TableRow
                              key={chainDoc.id}
                              sx={chainDoc.id === doc.id ? { bgcolor: 'primary.lighter' } : {}}
                            >
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                {chainDoc.belnr}
                              </TableCell>
                              <TableCell>{new Date(chainDoc.budat).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Chip label={chainDoc.blart} variant="outlined" size="small" sx={{ fontFamily: 'monospace' }} />
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ fontFamily: 'monospace', color: chainDoc.wrbtr < 0 ? 'error.main' : undefined }}
                              >
                                {chainDoc.wrbtr.toLocaleString('en-US', { minimumFractionDigits: 2 })} {chainDoc.waers}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                                {idx === 0 ? 'Original' : `Reverses ${reversalChain[idx - 1].belnr}`}
                              </TableCell>
                              <TableCell>
                                {chainDoc.id !== doc.id && (
                                  <Button
                                    component={Link}
                                    to={`${SYNAPSE_ROUTES.DOCUMENTS}/${chainDoc.id}`}
                                    size="small"
                                    variant="text"
                                  >
                                    Open
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}

          {/* Integrity Checks Tab */}
          {activeTab === 2 && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              {integrityChecks.length === 0 ? (
                <Card variant="outlined">
                  <CardContent sx={{ p: 8, textAlign: 'center' }}>
                    <Iconify icon="solar:check-circle-bold-duotone" width={48} sx={{ color: 'success.main', mb: 2 }} />
                    <Typography variant="h6" sx={{ color: 'success.main', mb: 0.5 }}>
                      All Integrity Checks Passed
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      No validation issues were detected for this document.
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                integrityChecks.map((check) => (
                  <Card
                    key={check.id}
                    variant="outlined"
                    sx={{
                      borderLeft: `4px solid ${
                        check.severity === 'critical'
                          ? 'error.main'
                          : check.severity === 'warn'
                            ? 'warning.main'
                            : 'info.main'
                      }`,
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                            {check.passed ? (
                              <Iconify icon="solar:check-circle-bold" width={20} sx={{ color: 'success.main' }} />
                            ) : (
                              <Iconify
                                icon="solar:info-circle-bold"
                                width={20}
                                sx={{
                                  color:
                                    check.severity === 'critical'
                                      ? 'error.main'
                                      : check.severity === 'warn'
                                        ? 'warning.main'
                                        : 'info.main',
                                }}
                              />
                            )}
                            <Typography variant="subtitle2">{check.ruleName}</Typography>
                            <CheckSeverityBadge severity={check.severity} />
                          </Stack>
                          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                            {check.evidence}
                          </Typography>
                          {check.recommendation && (
                            <Box sx={{ p: 1.5, bgcolor: 'background.neutral', borderRadius: 1 }}>
                              <Stack direction="row" spacing={1}>
                                <Iconify icon="solar:info-circle-bold" width={18} sx={{ color: 'text.secondary', mt: 0.25 }} />
                                <Box>
                                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                                    Recommended Action
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {check.recommendation}
                                  </Typography>
                                </Box>
                              </Stack>
                            </Box>
                          )}
                        </Box>
                        {check.relatedCaseId && (
                          <Button
                            component={Link}
                            to={`${SYNAPSE_ROUTES.CASES}/${check.relatedCaseId}`}
                            variant="outlined"
                            size="small"
                            endIcon={<Iconify icon="solar:alt-arrow-right-linear" width={16} />}
                            sx={{ bgcolor: 'transparent' }}
                          >
                            View Case
                          </Button>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                ))
              )}
            </Stack>
          )}

          {/* Related Objects Tab */}
          {activeTab === 3 && (
            <Grid container spacing={2} sx={{ mt: 2 }}>
              {/* Related Cases */}
              <Grid size={{ xs: 12, lg: 6 }}>
                <Card variant="outlined">
                  <CardHeader
                    title={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Iconify icon="solar:info-circle-bold" width={20} />
                        <Typography variant="subtitle1">Related Cases</Typography>
                      </Stack>
                    }
                    subheader={`${relatedCases.length} case(s) linked to this document`}
                    sx={{ pb: 1.5 }}
                  />
                  <CardContent>
                    {relatedCases.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                        <Typography variant="body2">No cases linked to this document</Typography>
                      </Box>
                    ) : (
                      <Stack spacing={1}>
                        {relatedCases.map((c) => (
                          <Card
                            key={c.id}
                            component={Link}
                            to={`${SYNAPSE_ROUTES.CASES}/${c.id}`}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              textDecoration: 'none',
                              transition: 'all 0.2s',
                              '&:hover': { bgcolor: 'background.neutral' },
                            }}
                          >
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Box>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                  {c.caseNumber}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {c.title}
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={1}>
                                <SeverityBadge severity={c.severity} />
                                <StatusPill status={c.status} />
                              </Stack>
                            </Stack>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Related Actions */}
              <Grid size={{ xs: 12, lg: 6 }}>
                <Card variant="outlined">
                  <CardHeader
                    title={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Iconify icon="solar:bolt-bold" width={20} />
                        <Typography variant="subtitle1">Related Actions</Typography>
                      </Stack>
                    }
                    subheader={`${relatedActions.length} action(s) associated with related cases`}
                    sx={{ pb: 1.5 }}
                  />
                  <CardContent>
                    {relatedActions.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                        <Typography variant="body2">No actions linked to this document</Typography>
                      </Box>
                    ) : (
                      <Stack spacing={1}>
                        {relatedActions.map((a) => (
                          <Card
                            key={a.id}
                            component={Link}
                            to={`${SYNAPSE_ROUTES.ACTIONS}?caseId=${a.caseId}`}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              textDecoration: 'none',
                              transition: 'all 0.2s',
                              '&:hover': { bgcolor: 'background.neutral' },
                            }}
                          >
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Box>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                  {a.id}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {a.description}
                                </Typography>
                              </Box>
                              <StatusPill status={a.status} />
                            </Stack>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Quick Links */}
              <Grid size={{ xs: 12 }}>
                <Card variant="outlined">
                  <CardHeader title="Quick Navigation" sx={{ pb: 1.5 }} />
                  <CardContent>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        component={Link}
                        to={`${SYNAPSE_ROUTES.LINEAGE}?docId=${doc.id}`}
                        variant="outlined"
                        startIcon={<Iconify icon="solar:git-branch-bold" width={18} />}
                        sx={{ bgcolor: 'transparent' }}
                      >
                        Open in Lineage
                      </Button>
                      <Button
                        component={Link}
                        to={`${SYNAPSE_ROUTES.ENTITIES}/${doc.counterpartyId}`}
                        variant="outlined"
                        startIcon={<Iconify icon="solar:user-bold" width={18} />}
                        sx={{ bgcolor: 'transparent' }}
                      >
                        View Counterparty
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Iconify icon="solar:external-link-bold" width={18} />}
                        sx={{ bgcolor: 'transparent' }}
                      >
                        Open in SAP
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      </Stack>
    </Box>
  );
};
