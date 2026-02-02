import type { SelectChangeEvent } from '@mui/material/Select';

import { useMemo, useState } from 'react';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
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

import { mockPolicies } from '../data/mock-data';

// ----------------------------------------------------------------------

type DocStatus = 'indexed' | 'indexing' | 'error';

const mockDocs = mockPolicies.map((p, idx) => {
  const status: DocStatus = idx % 11 === 0 ? 'error' : idx % 4 === 0 ? 'indexing' : 'indexed';
  const pages = 8 + (idx % 24);
  const chunks = 120 + ((idx * 17) % 420);
  return {
    id: `doc-${idx + 1}`,
    title: p.title,
    category: p.category,
    version: p.version,
    lastUpdated: p.updatedAt,
    pages,
    chunks,
    status,
    notes: p.description,
  };
});

const statusMeta: Record<DocStatus, { icon: string; label: string; color: 'success' | 'warning' | 'error' }> = {
  indexed: { icon: 'solar:check-circle-bold', label: 'Indexed', color: 'success' },
  indexing: { icon: 'solar:clock-circle-bold', label: 'Indexing', color: 'warning' },
  error: { icon: 'solar:danger-triangle-bold', label: 'Error', color: 'error' },
};

// ----------------------------------------------------------------------

/** 규정·문서 라이브러리 (RAG) */
export const RagPage = () => {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(mockDocs[0]?.id ?? null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    mockDocs.forEach((d) => set.add(d.category));
    return Array.from(set);
  }, []);

  const rows = useMemo(
    () =>
      mockDocs
        .filter((d) => {
          if (q) {
            const query = q.toLowerCase();
            if (!d.title.toLowerCase().includes(query) && !d.notes.toLowerCase().includes(query)) return false;
          }
          if (category !== 'all' && d.category !== category) return false;
          if (status !== 'all' && d.status !== status) return false;
          return true;
        })
        .slice(0, 200),
    [q, category, status]
  );

  const selected = useMemo(() => mockDocs.find((d) => d.id === selectedId) ?? null, [selectedId]);

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
              <Iconify icon="solar:book-2-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                RAG Library
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Manage compliance documents and track indexing health for explainable AI decisions.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<Iconify icon="solar:upload-bold" width={18} />}
            onClick={() => setUploadDialogOpen(true)}
          >
            Upload Policy Doc
          </Button>
        </Stack>

        {/* KPIs */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  Documents
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {mockDocs.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Across all tenants (mock)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  Indexed
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {mockDocs.filter((d) => d.status === 'indexed').length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ready for citations
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  Attention needed
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {mockDocs.filter((d) => d.status !== 'indexed').length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Indexing / errors
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Document Library */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Iconify icon="solar:document-text-bold" width={18} sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Document Library
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
              Search, filter, and inspect the exact evidence returned to users.
            </Typography>

            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              spacing={2}
              sx={{ mb: 3 }}
            >
              <TextField
                size="small"
                placeholder="Search docs…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
              />
              <Stack direction="row" spacing={1}>
                <Select size="small" value={category} onChange={(e: SelectChangeEvent) => setCategory(e.target.value)} sx={{ minWidth: 220 }}>
                  <MenuItem value="all">All categories</MenuItem>
                  {categories.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
                <Select size="small" value={status} onChange={(e: SelectChangeEvent) => setStatus(e.target.value)} sx={{ minWidth: 170 }}>
                  <MenuItem value="all">All status</MenuItem>
                  <MenuItem value="indexed">Indexed</MenuItem>
                  <MenuItem value="indexing">Indexing</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                </Select>
                <Button variant="outlined" startIcon={<Iconify icon="solar:filter-bold" width={16} />} sx={{ bgcolor: 'transparent' }}>
                  Advanced
                </Button>
              </Stack>
            </Stack>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, lg: 7 }}>
                <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Document</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Chunks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((d) => {
                        const meta = statusMeta[d.status];
                        const isSelected = selectedId === d.id;
                        return (
                          <TableRow
                            key={d.id}
                            hover
                            sx={{
                              cursor: 'pointer',
                              bgcolor: isSelected ? 'action.selected' : 'transparent',
                            }}
                            onClick={() => setSelectedId(d.id)}
                          >
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {d.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {d.version} • {d.pages} pages • {new Date(d.lastUpdated).toLocaleDateString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={d.category} size="small" variant="filled" sx={{ fontSize: '0.75rem' }} />
                            </TableCell>
                            <TableCell>
                              <Label
                                color={meta.color}
                                startIcon={<Iconify icon={meta.icon} width={14} />}
                                sx={{ fontSize: '0.75rem' }}
                              >
                                {meta.label}
                              </Label>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                {d.chunks}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                            <Typography variant="body2" color="text.secondary">
                              No documents match the current filters.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              <Grid size={{ xs: 12, lg: 5 }}>
                <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Evidence Preview
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      What the agent will cite in Case Detail.
                    </Typography>
                    {selected ? (
                      <Stack spacing={2}>
                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {selected.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {selected.category} • {selected.version}
                            </Typography>
                          </Box>
                          <Button
                            variant="outlined"
                            size="small"
                            endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                            sx={{ bgcolor: 'transparent' }}
                          >
                            Open
                          </Button>
                        </Stack>
                        <Divider />
                        <Box sx={{ maxHeight: 260, overflow: 'auto', pr: 1 }}>
                          <Stack spacing={2}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Iconify icon="solar:notes-bold" width={14} sx={{ color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                Example citations
                              </Typography>
                            </Stack>
                            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                              <Typography variant="caption" color="text.secondary">
                                Page 4 • Chunk #18
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                &ldquo;Entertainment expenses above threshold require evidence and managerial approval.&rdquo;
                              </Typography>
                            </Box>
                            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                              <Typography variant="caption" color="text.secondary">
                                Page 9 • Chunk #51
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                &ldquo;Bank account changes require a cooling period before payments can be released.&rdquo;
                              </Typography>
                            </Box>
                            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                              <Typography variant="caption" color="text.secondary">
                                Page 12 • Chunk #72
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                &ldquo;Duplicate invoice detection should consider vendor, amount tolerance, and posting window.&rdquo;
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 1 }}>
                          <Chip
                            icon={<Iconify icon="solar:magic-stick-3-bold" width={14} />}
                            label="Embeddings healthy"
                            size="small"
                            variant="outlined"
                          />
                          <Button variant="outlined" size="small" sx={{ bgcolor: 'transparent' }}>
                            Re-index
                          </Button>
                        </Stack>
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Select a document to preview evidence.
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Stack>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload document (mock)</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            In production, this will store the raw file, extract text, and create embeddings in Milvus.
          </DialogContentText>
          <Stack spacing={3}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                    Category
                  </Typography>
                  <TextField size="small" placeholder="Internal Control / Tax / Audit" />
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                    Version
                  </Typography>
                  <TextField size="small" placeholder="v2026.01" />
                </FormControl>
              </Grid>
            </Grid>
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                p: 6,
                textAlign: 'center',
                color: 'text.secondary',
              }}
            >
              <Typography variant="body2">
                Drag & drop files here (PDF/TXT) — mocked for UI
              </Typography>
            </Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Chip
                icon={<Iconify icon="solar:magic-stick-3-bold" width={14} />}
                label="Automatic chunking + embedding"
                size="small"
                variant="outlined"
              />
              <Button variant="contained">Start indexing</Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
