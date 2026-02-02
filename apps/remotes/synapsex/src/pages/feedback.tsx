import type { SelectChangeEvent } from '@mui/material/Select';

import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import FormLabel from '@mui/material/FormLabel';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import DialogContentText from '@mui/material/DialogContentText';

import { SYNAPSE_ROUTES } from '../routes';
import { mockCases } from '../data/mock-data';
import { SeverityBadge } from '../components/finance/severity-badge';

// ----------------------------------------------------------------------

type FeedbackLabel = 'tp' | 'fp' | 'fn' | 'needs_review';

const labelMeta: Record<FeedbackLabel, { label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  tp: { label: 'True Positive', color: 'success' },
  fp: { label: 'False Positive', color: 'warning' },
  fn: { label: 'False Negative', color: 'error' },
  needs_review: { label: 'Needs Review', color: 'default' },
};

// ----------------------------------------------------------------------

/** 피드백·라벨링 (HITL Quality Loop) */
export const FeedbackPage = () => {
  const [q, setQ] = useState('');
  const [severity, setSeverity] = useState<string>('all');
  const [label, setLabel] = useState<FeedbackLabel>('needs_review');
  const [suggestion, setSuggestion] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const rows = useMemo(() => {
    const base = mockCases
      .filter((c) => ['open', 'triage', 'review'].includes(String(c.status)))
      .map((c) => ({
        caseId: c.id,
        title: c.title,
        severity: c.severity,
        anomalyType: c.anomalyType,
        createdAt: c.createdAt,
        confidence: c.confidence,
      }));

    return base.filter((r) => {
      const text = `${r.caseId} ${r.title} ${r.anomalyType}`.toLowerCase();
      const okQ = !q || text.includes(q.toLowerCase());
      const okS = severity === 'all' || r.severity === severity;
      return okQ && okS;
    });
  }, [q, severity]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ lg: 'flex-end' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:chat-round-like-bold" width={20} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Feedback & Labeling
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Human-in-the-loop quality loop: label outcomes, attach rationale, and generate policy suggestions.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
              sx={{ bgcolor: 'transparent' }}
            >
              Export Labels (CSV)
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<Iconify icon="solar:magic-stick-bold" width={18} />}
              onClick={() => setDialogOpen(true)}
            >
              Policy Suggestion
            </Button>
          </Stack>
        </Stack>

        {/* Filter & Table */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Iconify icon="solar:filter-bold" width={18} sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Labeling Queue
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
              Prioritize ambiguous cases for rapid quality improvement.
            </Typography>

            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              alignItems={{ lg: 'center' }}
              justifyContent="space-between"
              spacing={2}
              sx={{ mb: 2.5 }}
            >
              <TextField
                size="small"
                placeholder="Search cases, titles, anomaly types…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                sx={{ flex: 1, maxWidth: { lg: 560 } }}
                InputProps={{
                  startAdornment: (
                    <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
              />
              <Select
                size="small"
                value={severity}
                onChange={(e: SelectChangeEvent) => setSeverity(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="all">All severity</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </Stack>

            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Case</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Anomaly Type</TableCell>
                    <TableCell>Confidence</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Label</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.slice(0, 200).map((r) => (
                    <TableRow key={r.caseId} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {r.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {r.caseId}
                            </Typography>
                          </Box>
                          <Link
                            to={`${SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', String(r.caseId))}`}
                            style={{ textDecoration: 'none' }}
                          >
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography
                                variant="caption"
                                sx={{ color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                              >
                                Review
                              </Typography>
                              <Iconify icon="solar:arrow-right-up-linear" width={12} />
                            </Stack>
                          </Link>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={r.severity as 'critical' | 'high' | 'medium' | 'low'} size="sm" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{r.anomalyType}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{Math.round((r.confidence ?? 0) * 100)}%</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(r.createdAt).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:like-bold" width={14} />}>
                            TP
                          </Button>
                          <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:dislike-bold" width={14} />}>
                            FP
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                        <Typography variant="body2" color="text.secondary">
                          No cases match your current filters.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 2.5 }} />

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                Showing {Math.min(200, rows.length)} of {rows.length.toLocaleString()} cases
              </Typography>
              <Stack direction="row" spacing={1}>
                <Label color={labelMeta.needs_review.color}>{labelMeta.needs_review.label}</Label>
                <Chip
                  icon={<Iconify icon="solar:magic-stick-bold" width={14} />}
                  label="Policy Suggestion"
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* Policy Suggestion Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Policy Suggestion (Mock)</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            Turn a labeling decision into a concrete policy or prompt adjustment proposal.
          </DialogContentText>
          <Stack spacing={3}>
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Label</FormLabel>
              <Select
                size="small"
                value={label}
                onChange={(e: SelectChangeEvent) => setLabel(e.target.value as FeedbackLabel)}
              >
                {Object.entries(labelMeta).map(([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {v.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Suggestion</FormLabel>
              <TextField
                multiline
                rows={5}
                size="small"
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="e.g., Tighten duplicate detection for vendors with bank change within 72 hours..."
              />
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuggestion('')} sx={{ color: 'text.secondary' }}>
            Reset
          </Button>
          <Button onClick={() => setDialogOpen(false)} variant="contained">
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
