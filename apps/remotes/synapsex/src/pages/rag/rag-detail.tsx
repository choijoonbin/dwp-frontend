/**
 * RAG Document Detail — 문서 메타정보 + 청크 목록 + 문서 내 검색 + 재청킹
 * 열기 버튼으로 진입하는 화면: 등록된 문서의 상세(제목·상태·소스유형·docId)와
 * RAG 인덱싱된 청크(본문 조각) 목록을 보여주며, 재청킹 실행 시 상세 데이터를 refetch하여 새 청크를 반영함.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@dwp-frontend/shared-i18n';
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
import { ReChunkControl } from './components/rechunk-control';
import { useAgentCatalog } from '../../hooks/use-agent-catalog';

const statusMeta: Record<string, { icon: string; label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  indexed: { icon: 'solar:check-circle-bold', label: 'Indexed', color: 'success' },
  indexing: { icon: 'solar:clock-circle-bold', label: 'Indexing', color: 'warning' },
  error: { icon: 'solar:danger-triangle-bold', label: 'Error', color: 'error' },
  default: { icon: 'solar:info-circle-bold', label: '-', color: 'default' },
};

type RagDocumentDetailPageProps = {
  docId: string;
};

const renderBackCard = (
  navigate: () => void,
  title: string,
  hint: string,
  t: (key: string) => string
) => (
  <Box sx={{ p: { xs: 2, sm: 3 } }}>
    <Card variant="outlined">
      <CardContent sx={{ p: 8, textAlign: 'center' }}>
        <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'error.main', mb: 2 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {hint}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Iconify icon="solar:arrow-left-linear" width={18} />}
          onClick={navigate}
        >
          {t('rag.detail.backToLibrary')}
        </Button>
      </CardContent>
    </Card>
  </Box>
);

export const RagDocumentDetailPage = ({ docId }: RagDocumentDetailPageProps) => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchWithin, setSearchWithin] = useState('');

  const effectiveDocId = docId?.trim() || undefined;
  const { data: doc, isLoading, error, refetch } = useRagDocumentDetailQuery(effectiveDocId);
  const { docTypes: catalogDocTypes } = useAgentCatalog();
  const chunkingStrategies = useMemo(
    () => catalogDocTypes.map((d) => ({ key: d.key, value: d.value })),
    [catalogDocTypes]
  );
  const currentChunkingStrategy = useMemo(() => {
    if (!doc?.chunkingStrategy) return undefined;
    return chunkingStrategies.some((s) => s.key === doc.chunkingStrategy) ? doc.chunkingStrategy : undefined;
  }, [doc?.chunkingStrategy, chunkingStrategies]);

  const chunks = useMemo(() => doc?.chunks ?? [], [doc?.chunks]);
  const filteredChunks = useMemo(() => {
    if (!searchWithin.trim()) return chunks;
    const q = searchWithin.toLowerCase();
    return chunks.filter((c) => c.chunkText.toLowerCase().includes(q));
  }, [chunks, searchWithin]);

  const goToLibrary = () => navigate(SYNAPSE_ROUTES.RAG);

  if (!effectiveDocId) {
    return renderBackCard(goToLibrary, t('rag.detail.missingDocId'), '', t);
  }

  if (isLoading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 8, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('rag.detail.loading')}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error || !doc) {
    return renderBackCard(
      goToLibrary,
      t('rag.detail.notFound'),
      error instanceof Error ? error.message : t('rag.detail.notFoundHint'),
      t
    );
  }

  const meta = statusMeta[doc.status] ?? statusMeta.default;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-start' }} justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="flex-start" spacing={2}>
            <IconButton onClick={goToLibrary} sx={{ mt: 0.5 }}>
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
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                {t('rag.detail.description')}
              </Typography>
            </Box>
          </Stack>
        </Stack>

        {/* Re-chunking: catalog docTypes(key/value)로 청킹 전략 Select 표시, 하드코딩 없음 */}
        <ReChunkControl
          docId={doc.docId}
          docTitle={doc.title}
          chunkingStrategies={chunkingStrategies}
          currentStrategy={currentChunkingStrategy}
          currentChunkCount={doc.chunks?.length}
          onReChunkComplete={() => refetch()}
        />

        {/* Search within doc */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              {t('rag.detail.searchWithin')}
            </Typography>
            <TextField
              size="small"
              fullWidth
              placeholder={t('rag.detail.searchPlaceholder')}
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
                {t('rag.detail.chunksTitle')} ({filteredChunks.length} / {chunks.length})
              </Typography>
              {searchWithin.trim() && (
                <Typography variant="caption" color="text.secondary">
                  {t('rag.detail.filteredBy', { q: searchWithin })}
                </Typography>
              )}
            </Stack>
            {filteredChunks.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {chunks.length === 0
                    ? t('rag.detail.chunksEmpty')
                    : t('rag.detail.chunksNoMatch', { q: searchWithin })}
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
