/**
 * RAG Library — Documents list + register modal + search
 */

import type { SelectChangeEvent } from '@mui/material/Select';

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';
import {
  useRagSearchQuery,
  useRagDocumentsQuery,
  useRegisterRagDocumentMutation,
  type RegisterRagDocumentPayload,
} from '@dwp-frontend/shared-utils';

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
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../../routes';
import { useAgentCatalog } from '../../hooks/use-agent-catalog';
import { RegisterRagDocumentModal } from './components/register-rag-document-modal';

// ----------------------------------------------------------------------


const statusMeta: Record<string, { icon: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  indexed: { icon: 'solar:check-circle-bold', color: 'success' },
  indexing: { icon: 'solar:clock-circle-bold', color: 'warning' },
  error: { icon: 'solar:danger-triangle-bold', color: 'error' },
  default: { icon: 'solar:info-circle-bold', color: 'default' },
};

/** Mock: how often this doc was referenced in recent AI inference. Replace with API when available. */
const getMockReferenceCount = (docId: string, index: number): number =>
  (docId.length * 5 + index) % 21;

// ----------------------------------------------------------------------

export const RagPage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState('');

  const { data: docsData, isLoading: docsLoading, error: docsError } = useRagDocumentsQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const { data: searchData, isLoading: searchLoading } = useRagSearchQuery(
    { q: searchSubmitted, page: 0, size: 20 },
    Boolean(searchSubmitted.trim())
  );

  const registerMutation = useRegisterRagDocumentMutation();
  const { docTypes } = useAgentCatalog();

  const items = docsData?.items ?? [];
  const totalDocs = docsData?.total ?? 0;
  const indexedCount = items.filter((d) => d.status === 'indexed').length;
  const attentionCount = items.filter((d) => d.status !== 'indexed').length;

  const searchGroupedByDoc = useMemo(() => {
    const searchResults = searchData?.items ?? [];
    const map = new Map<string, typeof searchResults>();
    for (const r of searchResults) {
      const list = map.get(r.docId) ?? [];
      list.push(r);
      map.set(r.docId, list);
    }
    return Array.from(map.entries()).map(([docId, chunks]) => {
      const first = chunks[0];
      return { docId, docTitle: first?.docTitle ?? docId, chunks };
    });
  }, [searchData?.items]);

  const handleRegisterSubmit = (payload: RegisterRagDocumentPayload) => {
    registerMutation.mutate(payload, {
      onSuccess: () => {
        setRegisterOpen(false);
      },
    });
  };

  const handleSearch = () => {
    setSearchSubmitted(searchQ.trim());
  };

  if (docsError) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'error.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t('rag.error.failedToLoad')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {docsError instanceof Error ? docsError.message : t('error.errorState.unknownError')}
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
                {t('rag.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {t('rag.subtitle')}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<Iconify icon="solar:upload-bold" width={18} />}
            onClick={() => setRegisterOpen(true)}
          >
            {t('rag.registerDocument')}
          </Button>
        </Stack>

        {/* KPIs */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  {t('rag.documents')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {totalDocs}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('rag.totalRegistered')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  {t('rag.indexed')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {indexedCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('rag.readyForCitations')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  {t('rag.attentionNeeded')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {attentionCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('rag.indexingErrors')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Search Section */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Iconify icon="solar:magnifer-linear" width={20} sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('rag.searchRag')}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              {t('rag.searchHint')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <TextField
                size="small"
                placeholder={t('rag.searchDocuments')}
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
              />
              <Button variant="contained" onClick={handleSearch} disabled={!searchQ.trim()}>
                {t('rag.search')}
              </Button>
            </Stack>
            {searchSubmitted && (
              <Box sx={{ mt: 2 }}>
                {searchLoading ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('rag.searching')}
                  </Typography>
                ) : searchGroupedByDoc.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('rag.noResults', { query: searchSubmitted })}
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {searchGroupedByDoc.map(({ docId, docTitle, chunks }) => (
                      <Box
                        key={docId}
                        sx={{
                          p: 2,
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1.5,
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ mb: 1.5 }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {docTitle}
                          </Typography>
                          <Button
                            size="small"
                            endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                            onClick={() => navigate(`${SYNAPSE_ROUTES.RAG}/${docId}`)}
                          >
                            {t('rag.open')}
                          </Button>
                        </Stack>
                        <Stack spacing={1}>
                          {chunks.slice(0, 3).map((c) => (
                            <Box
                              key={c.chunkId}
                              sx={{
                                p: 1.5,
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                                bgcolor: 'background.paper',
                              }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                {t('rag.chunk')} {c.pageNo != null ? `· ${t('rag.page')} ${c.pageNo}` : ''} · {t('rag.score')}: {c.score?.toFixed(2) ?? '-'}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {c.chunkText.length > 200 ? `${c.chunkText.slice(0, 200)}…` : c.chunkText}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Iconify icon="solar:document-text-bold" width={18} sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('rag.documentLibrary')}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              {t('rag.libraryHint')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <Select
                size="small"
                value={statusFilter}
                onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="all">{t('rag.allStatus')}</MenuItem>
                <MenuItem value="indexed">{t('rag.status.indexed')}</MenuItem>
                <MenuItem value="indexing">{t('rag.status.indexing')}</MenuItem>
                <MenuItem value="error">{t('rag.status.error')}</MenuItem>
              </Select>
            </Stack>
            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('rag.table.document')}</TableCell>
                    <TableCell>{t('rag.table.source')}</TableCell>
                    <TableCell>{t('rag.table.status')}</TableCell>
                    <TableCell sx={{ width: 100 }} align="center">
                      {t('rag.table.referenceCount')}
                    </TableCell>
                    <TableCell align="right">{t('rag.table.created')}</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {docsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('rag.loading')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                        <Stack alignItems="center" spacing={1}>
                          <Iconify icon="solar:document-text-bold" width={48} sx={{ color: 'text.disabled' }} />
                          <Typography variant="body2" color="text.secondary">
                            {t('rag.empty')}
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Iconify icon="solar:upload-bold" width={18} />}
                            onClick={() => setRegisterOpen(true)}
                          >
                            {t('rag.registerFirst')}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((d, idx) => {
                      const meta = statusMeta[d.status] ?? statusMeta.default;
                      const referenceCount = getMockReferenceCount(d.docId, idx);
                      return (
                        <TableRow
                          key={d.docId}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                          onClick={() => navigate(`${SYNAPSE_ROUTES.RAG}/${d.docId}`)}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {d.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {d.docId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={d.sourceType} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                          </TableCell>
                          <TableCell>
                            <Label
                              color={meta.color}
                              startIcon={<Iconify icon={meta.icon} width={14} />}
                              sx={{ fontSize: '0.75rem' }}
                            >
                              {t(`rag.status.${d.status === 'indexed' || d.status === 'indexing' || d.status === 'error' ? d.status : 'default'}`)}
                            </Label>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={t('rag.referenceCountBadge', { count: referenceCount })}
                              sx={{
                                fontSize: '0.7rem',
                                bgcolor: 'primary.lighter',
                                color: 'primary.darker',
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="caption">
                              {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="small"
                              endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                              onClick={() => navigate(`${SYNAPSE_ROUTES.RAG}/${d.docId}`)}
                            >
                              {t('rag.open')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={registerOpen} onClose={() => setRegisterOpen(false)} maxWidth="sm" fullWidth>
        <RegisterRagDocumentModal
          onClose={() => setRegisterOpen(false)}
          onSubmit={handleRegisterSubmit}
          isLoading={registerMutation.isPending}
          docTypes={docTypes}
        />
      </Dialog>
    </Box>
  );
};
