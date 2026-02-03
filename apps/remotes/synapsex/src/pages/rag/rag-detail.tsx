/**
 * RAG Document Detail — Chunks + search within doc
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Label, Iconify } from '@dwp-frontend/design-system';
import { useRagDocumentDetailQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';

import { SYNAPSE_ROUTES } from '../../routes';

const statusMeta: Record<string, { icon: string; label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  indexed: { icon: 'solar:check-circle-bold', label: 'Indexed', color: 'success' },
  indexing: { icon: 'solar:clock-circle-bold', label: 'Indexing', color: 'warning' },
  error: { icon: 'solar:danger-triangle-bold', label: 'Error', color: 'error' },
  default: { icon: 'solar:info-circle-bold', label: '-', color: 'default' },
};

type RagDocumentDetailPageProps = {
  docId: string;
};

export const RagDocumentDetailPage = ({ docId }: RagDocumentDetailPageProps) => {
  const navigate = useNavigate();
  const [searchWithin, setSearchWithin] = useState('');

  const { data: doc, isLoading, error } = useRagDocumentDetailQuery(docId);

  const chunks = doc?.chunks ?? [];
  const filteredChunks = useMemo(() => {
    if (!searchWithin.trim()) return chunks;
    const q = searchWithin.toLowerCase();
    return chunks.filter((c) => c.chunkText.toLowerCase().includes(q));
  }, [doc?.chunks, searchWithin]);

  if (isLoading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 8, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Loading document…
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error || !doc) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 8, textAlign: 'center' }}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'error.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Document not found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {error instanceof Error ? error.message : 'The document may have been removed.'}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:arrow-left-linear" width={18} />}
              onClick={() => navigate(SYNAPSE_ROUTES.RAG)}
            >
              Back to RAG Library
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const meta = statusMeta[doc.status] ?? statusMeta.default;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-start' }} justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="flex-start" spacing={2}>
            <IconButton onClick={() => navigate(SYNAPSE_ROUTES.RAG)} sx={{ mt: 0.5 }}>
              <Iconify icon="solar:arrow-left-linear" width={20} />
            </IconButton>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {doc.title}
                </Typography>
                <Label color={meta.color} startIcon={<Iconify icon={meta.icon} width={14} />} sx={{ fontSize: '0.75rem' }}>
                  {meta.label}
                </Label>
                <Chip label={doc.sourceType} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {doc.docId} · {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '-'}
              </Typography>
            </Box>
          </Stack>
        </Stack>

        {/* Search within doc */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Search within this document
            </Typography>
            <TextField
              size="small"
              fullWidth
              placeholder="Search in chunks…"
              value={searchWithin}
              onChange={(e) => setSearchWithin(e.target.value)}
              InputProps={{
                startAdornment: (
                  <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                ),
              }}
            />
          </CardContent>
        </Card>

        {/* Chunks */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Chunks ({filteredChunks.length} of {chunks.length})
              </Typography>
              {searchWithin.trim() && (
                <Typography variant="caption" color="text.secondary">
                  Filtered by &ldquo;{searchWithin}&rdquo;
                </Typography>
              )}
            </Stack>
            {filteredChunks.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {chunks.length === 0
                    ? 'No chunks indexed yet.'
                    : `No chunks match "${searchWithin}". Try a different search.`}
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {filteredChunks.map((c) => (
                  <Box
                    key={c.chunkId}
                    sx={{
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {c.chunkId}
                      </Typography>
                      {c.pageNo != null && (
                        <Chip label={`Page ${c.pageNo}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      )}
                    </Stack>
                    <Typography variant="body2">{c.chunkText}</Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
