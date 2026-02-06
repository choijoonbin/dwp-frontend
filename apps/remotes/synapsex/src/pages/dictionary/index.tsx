/**
 * Dictionary — Term list + search + category filter
 */

import type { SelectChangeEvent } from '@mui/material/Select';

import { useMemo, useState } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';
import {
  useDictionaryQuery,
  type DictionaryTermDto,
  useCreateDictionaryTermMutation,
  useUpdateDictionaryTermMutation,
  useDeleteDictionaryTermMutation,
  type DictionaryTermUpsertRequest,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import DialogContentText from '@mui/material/DialogContentText';

// ----------------------------------------------------------------------

export const DictionaryPage = () => {
  const { t } = useTranslation('common');
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DictionaryTermDto | null>(null);
  const [draft, setDraft] = useState<DictionaryTermUpsertRequest>({
    termKey: '',
    labelKo: '',
    description: '',
    category: '',
  });

  const { data, isLoading, error } = useDictionaryQuery(categoryFilter || undefined);
  const items: DictionaryTermDto[] = (() => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && 'items' in data) {
      const arr = (data as { items?: unknown[] }).items;
      return Array.isArray(arr) ? (arr as DictionaryTermDto[]) : [];
    }
    return [];
  })();
  const createMutation = useCreateDictionaryTermMutation();
  const updateMutation = useUpdateDictionaryTermMutation();
  const deleteMutation = useDeleteDictionaryTermMutation();

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => item.category && set.add(item.category));
    return Array.from(set).sort();
  }, [items]);

  const rows = useMemo(
    () =>
      items.filter((item) => {
        if (!q.trim()) return true;
        const s = `${item.termKey} ${item.labelKo ?? ''} ${item.description ?? ''} ${item.category ?? ''}`.toLowerCase();
        return s.includes(q.toLowerCase());
      }),
    [items, q]
  );

  const handleOpenCreate = () => {
    setEditing(null);
    setDraft({ termKey: '', labelKo: '', description: '', category: '' });
    setDialogOpen(true);
  };

  const handleOpenEdit = (term: DictionaryTermDto) => {
    setEditing(term);
    setDraft({
      termKey: term.termKey,
      labelKo: term.labelKo ?? '',
      description: term.description ?? '',
      category: term.category ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const body: DictionaryTermUpsertRequest = {
      termKey: draft.termKey.trim(),
      labelKo: (draft.labelKo ?? '').trim() || undefined,
      description: (draft.description ?? '').trim() || undefined,
      category: (draft.category ?? '').trim() || undefined,
    };
    if (!body.termKey) return;
    if (editing) {
      updateMutation.mutate(
        { termId: editing.termId, body },
        { onSuccess: () => setDialogOpen(false) }
      );
    } else {
      createMutation.mutate(body, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleDelete = (term: DictionaryTermDto) => {
    if (window.confirm(t('dictionary.deleteConfirm', { termKey: term.termKey }))) {
      deleteMutation.mutate(term.termId);
    }
  };

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'error.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t('dictionary.error.failedToLoad')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {error instanceof Error ? error.message : t('error.errorState.unknownError')}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

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
                {t('dictionary.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {t('dictionary.subtitle')}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<Iconify icon="solar:add-circle-bold" width={18} />}
            onClick={handleOpenCreate}
          >
            {t('dictionary.addEntry')}
          </Button>
        </Stack>

        {/* Filters */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                size="small"
                placeholder={t('dictionary.searchPlaceholder')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
              />
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="dict-category-label">{t('dictionary.category')}</InputLabel>
                <Select
                  labelId="dict-category-label"
                  label={t('dictionary.category')}
                  value={categoryFilter}
                  onChange={(e: SelectChangeEvent) => setCategoryFilter(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">{t('dictionary.allCategories')}</MenuItem>
                  {categories.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </CardContent>
        </Card>

        {/* Table */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {t('dictionary.entries')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              {t('dictionary.entriesHint')}
            </Typography>
            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ width: 170 }}>{t('dictionary.table.key')}</TableCell>
                    <TableCell>{t('dictionary.table.labelKo')}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>{t('dictionary.table.description')}</TableCell>
                    <TableCell sx={{ width: 140 }}>{t('dictionary.table.category')}</TableCell>
                    <TableCell sx={{ width: 100 }} align="right">
                      {t('dictionary.table.actions')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('dictionary.loading')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                        <Stack alignItems="center" spacing={1}>
                          <Iconify icon="solar:book-2-bold" width={48} sx={{ color: 'text.disabled' }} />
                          <Typography variant="body2" color="text.secondary">
                            {t('dictionary.empty')}
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Iconify icon="solar:add-circle-bold" width={18} />}
                            onClick={handleOpenCreate}
                          >
                            {t('dictionary.addFirst')}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((term) => (
                      <TableRow key={term.termId} hover>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {term.termKey}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{term.labelKo ?? '—'}</Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                          <Typography variant="caption" color="text.secondary">
                            {term.description ?? '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {term.category ? (
                            <Label color="info" sx={{ fontSize: '0.75rem' }}>
                              {term.category}
                            </Label>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton size="small" onClick={() => handleOpenEdit(term)}>
                              <Iconify icon="solar:pen-bold" width={16} />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(term)}
                              disabled={deleteMutation.isPending}
                            >
                              <Iconify icon="solar:trash-bin-trash-bold" width={16} />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {t('dictionary.entriesCount', { count: rows.length })}
              </Typography>
              <Chip
                icon={<Iconify icon="solar:hashtag-bold" width={14} />}
                label={t('dictionary.usedInExtraction')}
                size="small"
                variant="outlined"
              />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? t('dictionary.editEntry') : t('dictionary.newEntry')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            {t('dictionary.dialogHint')}
          </DialogContentText>
          <Stack spacing={2.5}>
            <TextField
              size="small"
              fullWidth
              label={t('dictionary.termKey')}
              value={draft.termKey}
              onChange={(e) => setDraft((p) => ({ ...p, termKey: e.target.value }))}
              placeholder="e.g., Mtg / FB60 / 510030"
              required
              disabled={Boolean(editing)}
            />
            <TextField
              size="small"
              fullWidth
              label={t('dictionary.labelKo')}
              value={draft.labelKo}
              onChange={(e) => setDraft((p) => ({ ...p, labelKo: e.target.value }))}
              placeholder="e.g., Meeting / Enter Vendor Invoice"
            />
            <TextField
              size="small"
              fullWidth
              label={t('dictionary.description')}
              value={draft.description}
              onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
              placeholder={t('dictionary.optionalContext')}
            />
            <TextField
              size="small"
              fullWidth
              label={t('dictionary.category')}
              value={draft.category}
              onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
              placeholder="e.g., abbreviation, tcode, account"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            {t('dictionary.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!draft.termKey.trim() || createMutation.isPending || updateMutation.isPending}
          >
            {t('dictionary.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
