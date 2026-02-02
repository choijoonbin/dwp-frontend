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
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import FormLabel from '@mui/material/FormLabel';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import DialogContentText from '@mui/material/DialogContentText';

// ----------------------------------------------------------------------

type DictionaryEntry = {
  id: string;
  type: 'abbreviation' | 'entity_code' | 'account' | 'cost_center' | 'tcode';
  key: string;
  value: string;
  description?: string;
  confidence?: number;
  source?: 'seed' | 'user' | 'sap' | 'ml';
};

const seed: DictionaryEntry[] = [
  {
    id: 'dict-1',
    type: 'abbreviation',
    key: 'Mtg',
    value: 'Meeting',
    description: 'Common short-hand in free text',
    confidence: 0.94,
    source: 'seed',
  },
  {
    id: 'dict-2',
    type: 'tcode',
    key: 'FB60',
    value: 'Enter Vendor Invoice',
    description: 'FI - Accounts Payable',
    confidence: 0.99,
    source: 'sap',
  },
  {
    id: 'dict-3',
    type: 'tcode',
    key: 'MIRO',
    value: 'Enter Incoming Invoice',
    description: 'MM - Logistics Invoice Verification',
    confidence: 0.99,
    source: 'sap',
  },
  {
    id: 'dict-4',
    type: 'account',
    key: '510030',
    value: 'Entertainment',
    description: 'Policy-sensitive account',
    confidence: 0.9,
    source: 'seed',
  },
  {
    id: 'dict-5',
    type: 'cost_center',
    key: 'CC-1200',
    value: 'Sales - APAC',
    description: 'Regional sales org',
    confidence: 0.86,
    source: 'user',
  },
  {
    id: 'dict-6',
    type: 'entity_code',
    key: 'LIFNR',
    value: 'Vendor',
    description: 'SAP entity identifier',
    confidence: 0.95,
    source: 'sap',
  },
];

const typeMeta: Record<DictionaryEntry['type'], { label: string; color: 'info' | 'default' | 'warning' | 'primary' | 'success' }> = {
  abbreviation: { label: 'Abbreviation', color: 'info' },
  entity_code: { label: 'Entity Code', color: 'default' },
  account: { label: 'Account', color: 'warning' },
  cost_center: { label: 'Cost Center', color: 'primary' },
  tcode: { label: 'T-Code', color: 'success' },
};

const sourceMeta: Record<NonNullable<DictionaryEntry['source']>, { label: string; icon: string }> = {
  seed: { label: 'Seed', icon: 'solar:hashtag-bold' },
  user: { label: 'User', icon: 'solar:user-bold' },
  sap: { label: 'SAP', icon: 'solar:buildings-2-bold' },
  ml: { label: 'ML', icon: 'solar:check-circle-bold' },
};

// ----------------------------------------------------------------------

/** 용어·코드 사전 */
export const DictionaryPage = () => {
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('all');
  const [items, setItems] = useState<DictionaryEntry[]>(seed);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<DictionaryEntry>>({ type: 'abbreviation' });

  const rows = useMemo(
    () =>
      items.filter((d) => {
        if (type !== 'all' && d.type !== type) return false;
        if (!q) return true;
        const s = `${d.key} ${d.value} ${d.description ?? ''}`.toLowerCase();
        return s.includes(q.toLowerCase());
      }),
    [items, q, type]
  );

  const saveDraft = () => {
    const key = (draft.key ?? '').trim();
    const value = (draft.value ?? '').trim();
    if (!key || !value) return;

    const id = draft.id ?? `dict-${Math.random().toString(16).slice(2)}`;
    const next: DictionaryEntry = {
      id,
      type: (draft.type as DictionaryEntry['type']) ?? 'abbreviation',
      key,
      value,
      description: (draft.description ?? '').trim() || undefined,
      confidence: draft.confidence ?? 0.85,
      source: draft.source ?? 'user',
    };

    setItems((prev) => {
      const exists = prev.some((p) => p.id === id);
      return exists ? prev.map((p) => (p.id === id ? next : p)) : [next, ...prev];
    });

    setOpen(false);
    setDraft({ type: 'abbreviation' });
  };

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
                Enterprise Dictionary
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Abbreviations, entity codes, accounts, and SAP-specific vocabulary used for robust text understanding
            </Typography>
          </Box>

          <Button
            variant="contained"
            size="small"
            startIcon={<Iconify icon="solar:add-circle-bold" width={18} />}
            onClick={() => {
              setDraft({ type: 'abbreviation' });
              setOpen(true);
            }}
          >
            Add entry
          </Button>
        </Stack>

        {/* Filters */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                size="small"
                placeholder="Search keys, values, and descriptions..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
              />
              <Stack direction="row" alignItems="center" spacing={1}>
                <Chip
                  icon={<Iconify icon="solar:filter-bold" width={14} />}
                  label="Type"
                  size="small"
                  variant="outlined"
                />
                <Select
                  size="small"
                  value={type}
                  onChange={(e: SelectChangeEvent) => setType(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="all">All types</MenuItem>
                  {Object.keys(typeMeta).map((k) => (
                    <MenuItem key={k} value={k}>
                      {typeMeta[k as DictionaryEntry['type']].label}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Table */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Entries
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Used by extraction, classification, and policy-aware parsing.
            </Typography>
            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ width: 140 }}>Type</TableCell>
                    <TableCell sx={{ width: 170 }}>Key</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Description</TableCell>
                    <TableCell sx={{ width: 120 }}>Source</TableCell>
                    <TableCell sx={{ width: 120 }} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.slice(0, 200).map((d) => {
                    const t = typeMeta[d.type];
                    const s = d.source ? sourceMeta[d.source] : null;

                    return (
                      <TableRow key={d.id} hover>
                        <TableCell>
                          <Label color={t.color} sx={{ fontSize: '0.75rem' }}>
                            {t.label}
                          </Label>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {d.key}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{d.value}</Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                          <Typography variant="caption" color="text.secondary">
                            {d.description ?? '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {s ? (
                            <Chip
                              icon={<Iconify icon={s.icon} width={14} />}
                              label={s.label}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setDraft(d);
                                setOpen(true);
                              }}
                            >
                              <Iconify icon="solar:pen-bold" width={16} />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setItems((prev) => prev.filter((x) => x.id !== d.id))}
                            >
                              <Iconify icon="solar:trash-bin-trash-bold" width={16} />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                        <Typography variant="body2" color="text.secondary">
                          No dictionary entries match the current filters.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mt: 2 }}
            >
              <Typography variant="caption" color="text.secondary">
                Showing {Math.min(200, rows.length)} of {rows.length.toLocaleString()} entries
              </Typography>
              <Chip
                icon={<Iconify icon="solar:hashtag-bold" width={14} />}
                label="Used in extraction"
                size="small"
                variant="outlined"
              />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{draft.id ? 'Edit entry' : 'New entry'}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            Dictionary entries improve parsing of short-hand text and governance consistency.
          </DialogContentText>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Type</FormLabel>
                <Select
                  size="small"
                  value={String(draft.type ?? 'abbreviation')}
                  onChange={(e: SelectChangeEvent) => setDraft((p) => ({ ...p, type: e.target.value as DictionaryEntry['type'] }))}
                >
                  {Object.keys(typeMeta).map((k) => (
                    <MenuItem key={k} value={k}>
                      {typeMeta[k as DictionaryEntry['type']].label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Source</FormLabel>
                <Select
                  size="small"
                  value={String(draft.source ?? 'user')}
                  onChange={(e: SelectChangeEvent) => setDraft((p) => ({ ...p, source: e.target.value as DictionaryEntry['source'] }))}
                >
                  {Object.keys(sourceMeta).map((k) => (
                    <MenuItem key={k} value={k}>
                      {sourceMeta[k as keyof typeof sourceMeta].label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Key</FormLabel>
                <TextField
                  size="small"
                  value={draft.key ?? ''}
                  onChange={(e) => setDraft((p) => ({ ...p, key: e.target.value }))}
                  placeholder="e.g., Mtg / FB60 / 510030"
                />
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Value</FormLabel>
                <TextField
                  size="small"
                  value={draft.value ?? ''}
                  onChange={(e) => setDraft((p) => ({ ...p, value: e.target.value }))}
                  placeholder="e.g., Meeting / Enter Vendor Invoice"
                />
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem' }}>Description</FormLabel>
                <TextField
                  size="small"
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional context (policy-sensitive, org mapping, etc.)"
                />
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={saveDraft} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
