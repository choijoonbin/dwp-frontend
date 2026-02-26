/**
 * RAG Document Detail — 문서 메타정보 + 청크 목록 + 문서 내 검색 + 재청킹
 * 열기 버튼으로 진입하는 화면: 등록된 문서의 상세(제목·상태·소스유형·docId)와
 * RAG 인덱싱된 청크(본문 조각) 목록을 보여주며, 재청킹 실행 시 상세 데이터를 refetch하여 새 청크를 반영함.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';
import {
  getMe,
  useAuth,
  showToast,
  useRagDocumentDetailQuery,
  getRagDocumentChunkingStatus,
  useReplaceRagDocumentChunksMutation,
  useActivateRagDocumentVersionMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';

import { SYNAPSE_ROUTES } from '../../routes';
import { ReChunkControl } from './components/rechunk-control';
import { useAgentCatalog } from '../../hooks/use-agent-catalog';
import { RagQualityReportCard, normalizeQualityReport } from './components/rag-quality-report-card';

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
  const [actionTab, setActionTab] = useState<'version' | 'rechunk' | 'quality'>('version');
  const [activateVersionInput, setActivateVersionInput] = useState('');
  const [replaceChunksJson, setReplaceChunksJson] = useState('');
  const { isAuthenticated } = useAuth();

  const effectiveDocId = docId?.trim() || undefined;
  const { data: doc, isLoading, error, refetch } = useRagDocumentDetailQuery(effectiveDocId);
  const activateVersionMutation = useActivateRagDocumentVersionMutation();
  const replaceChunksMutation = useReplaceRagDocumentChunksMutation();
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await getMe();
      if (res.status !== 'SUCCESS' && res.status !== 'OK') throw new Error(res.message || 'Failed to fetch me');
      return res.data as { roles?: unknown };
    },
    enabled: isAuthenticated,
    retry: false,
  });
  const chunkingStatusQuery = useQuery({
    queryKey: ['synapse', 'rag', 'chunking-status', effectiveDocId],
    queryFn: async () => {
      if (!effectiveDocId) throw new Error('Missing docId');
      const res = await getRagDocumentChunkingStatus(effectiveDocId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message ?? 'Failed to fetch chunking status');
      }
      return res.data as {
        strategy?: string;
        docType?: string;
        status?: string;
        chunkCount?: number;
      };
    },
    enabled: Boolean(effectiveDocId),
    retry: false,
    staleTime: 30 * 1000,
  });
  const { docTypes: catalogDocTypes } = useAgentCatalog();
  const chunkingStrategies = useMemo(
    () => catalogDocTypes.map((d) => ({ key: d.key, value: d.value })),
    [catalogDocTypes]
  );
  const currentChunkingStrategy = useMemo(() => {
    const strategyFromStatus = chunkingStatusQuery.data?.strategy;
    const strategyFromDetail = doc?.chunkingStrategy;
    return strategyFromStatus || strategyFromDetail;
  }, [chunkingStatusQuery.data?.strategy, doc?.chunkingStrategy]);
  const currentChunkingStrategyKey = useMemo(() => {
    if (!currentChunkingStrategy) return undefined;
    const candidate = currentChunkingStrategy;
    if (!candidate) return undefined;
    return chunkingStrategies.some((s) => s.key === candidate) ? candidate : undefined;
  }, [currentChunkingStrategy, chunkingStrategies]);
  const currentChunkingStrategyLabel = useMemo(() => {
    if (!currentChunkingStrategy) return '-';
    const matched = chunkingStrategies.find((s) => s.key === currentChunkingStrategy);
    return matched?.value ?? currentChunkingStrategy;
  }, [currentChunkingStrategy, chunkingStrategies]);

  const chunks = useMemo(() => doc?.chunks ?? [], [doc?.chunks]);
  const filteredChunks = useMemo(() => {
    if (!searchWithin.trim()) return chunks;
    const q = searchWithin.toLowerCase();
    return chunks.filter((c) => c.chunkText.toLowerCase().includes(q));
  }, [chunks, searchWithin]);

  const goToLibrary = () => navigate(SYNAPSE_ROUTES.RAG);
  const qualityReport = useMemo(
    () => normalizeQualityReport(doc?.quality_report ?? doc?.qualityReport),
    [doc?.quality_report, doc?.qualityReport]
  );
  const effectiveFrom = doc?.effectiveFrom ?? doc?.effective_from;
  const effectiveTo = doc?.effectiveTo ?? doc?.effective_to;
  const isActive = doc?.isActive ?? doc?.is_active;
  const roles = Array.isArray(meQuery.data?.roles)
    ? meQuery.data?.roles.filter((role): role is string => typeof role === 'string')
    : [];
  const canDebugQuality = roles.includes('ADMIN') || roles.includes('SYNAPSEX_ADMIN') || roles.includes('SYNAPSEX_OPERATOR');
  const activateTargetVersion = activateVersionInput.trim() || doc?.version || '';
  const canActivateVersion = Boolean(activateTargetVersion) && !activateVersionMutation.isPending;
  const canReplaceChunks = replaceChunksJson.trim().length > 0 && !replaceChunksMutation.isPending;
  const isOperatorTab = actionTab === 'version' || actionTab === 'rechunk';

  const handleActivateVersion = async () => {
    if (!canActivateVersion || !doc?.docId) return;
    await activateVersionMutation.mutateAsync({
      docId: doc.docId,
      version: activateTargetVersion,
    });
    await refetch();
  };

  const handleReplaceChunks = async () => {
    if (!doc?.docId || !canReplaceChunks) return;
    try {
      const parsed = JSON.parse(replaceChunksJson) as Record<string, unknown>;
      if (!Array.isArray(parsed.chunks)) {
        throw new Error('Invalid payload: chunks array is required');
      }
      await replaceChunksMutation.mutateAsync({
        docId: doc.docId,
        body: parsed,
      });
      await refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid JSON payload', 'error');
    }
  };

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
  const createdAtLabel = doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '-';
  const updatedAtValue = doc.updatedAt ?? doc.updated_at ?? doc.timestamp;
  const updatedAtLabel = updatedAtValue ? new Date(updatedAtValue).toLocaleString() : '-';
  const effectivePeriodLabel = `${effectiveFrom || '-'} ~ ${effectiveTo || '-'}`;
  const qualityGatePassRaw = (doc.qualityGatePassed ?? doc.quality_gate_passed);
  const qualityGatePass = qualityGatePassRaw ?? qualityReport?.pass;
  const qualityGateLabel =
    qualityGatePass == null ? (qualityReport == null ? '리포트 없음' : '-') : qualityGatePass ? 'PASS' : 'FAIL';
  const qualityGateColor: 'success' | 'error' | 'default' =
    qualityGatePass == null ? 'default' : qualityGatePass ? 'success' : 'error';

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        <Card variant="outlined">
          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                  <IconButton onClick={goToLibrary} sx={{ mt: 0.25 }}>
                    <Iconify icon="solar:arrow-left-linear" width={20} />
                  </IconButton>
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
                      RAG Document Detail
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                      {doc.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {t('rag.detail.description')}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ justifyContent: 'flex-end' }}>
                  <Label color={meta.color} startIcon={<Iconify icon={meta.icon} width={14} />} sx={{ fontSize: '0.75rem' }}>
                    {meta.label}
                  </Label>
                  <Chip label={doc.sourceType} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                  <Label color={isActive ? 'success' : 'default'} variant="soft" sx={{ fontSize: '0.72rem' }}>
                    {isActive ? t('rag.detail.activeVersion') : t('rag.detail.inactiveVersion')}
                  </Label>
                </Stack>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
                  gap: 1.5,
                }}
              >
                <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 1.25 }}>
                    <Typography variant="caption" color="text.secondary">총 청크</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.25 }}>{chunks.length}</Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 1.25 }}>
                    <Typography variant="caption" color="text.secondary">청킹 전략</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.25 }}>{currentChunkingStrategyLabel}</Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 1.25 }}>
                    <Typography variant="caption" color="text.secondary">품질 게이트</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Label color={qualityGateColor} variant="soft" sx={{ fontSize: '0.72rem', fontWeight: 700 }}>
                        {qualityGateLabel}
                      </Label>
                    </Box>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 1.25 }}>
                    <Typography variant="caption" color="text.secondary">현재 검색 결과</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.25 }}>
                      {filteredChunks.length}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                        / {chunks.length}
                      </Typography>
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      문서 식별 정보
                    </Typography>
                    <Stack spacing={0.75}>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography variant="body2" color="text.secondary">문서 번호</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{doc.docId}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography variant="body2" color="text.secondary">생성 일시</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{createdAtLabel}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography variant="body2" color="text.secondary">업데이트 일시</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{updatedAtLabel}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography variant="body2" color="text.secondary">{t('rag.detail.version')}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{doc.version || '-'}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography variant="body2" color="text.secondary">{t('rag.detail.effectivePeriod')}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{effectivePeriodLabel}</Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      문서 운영 액션
                    </Typography>
                    <Tabs
                      value={actionTab}
                      onChange={(_, v) => setActionTab(v)}
                      variant="fullWidth"
                      sx={{ minHeight: 38, mb: 1, '& .MuiTab-root': { minHeight: 38, textTransform: 'none', fontSize: '0.8rem' } }}
                    >
                      <Tab value="version" label="버전 전환" />
                      <Tab value="rechunk" label="재청킹" />
                      <Tab value="quality" label="품질 확인" />
                    </Tabs>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {actionTab === 'quality' ? '조회 권한: 모든 사용자' : '실행 권한: 운영자'}
                      </Typography>
                      {isOperatorTab && (
                        <Tooltip title="ADMIN / SYNAPSEX_ADMIN / SYNAPSEX_OPERATOR 권한에서만 실행 가능합니다.">
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={<Iconify icon="solar:lock-keyhole-minimalistic-bold" width={12} />}
                            label="운영자 전용"
                          />
                        </Tooltip>
                      )}
                    </Stack>

                    {actionTab === 'version' && (
                      <>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <TextField
                            size="small"
                            label={t('rag.detail.activateVersionLabel', '활성 전환 버전')}
                            value={activateVersionInput}
                            onChange={(e) => setActivateVersionInput(e.target.value)}
                            placeholder={doc.version || ''}
                            sx={{ flex: 1 }}
                          />
                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleActivateVersion}
                            disabled={!canDebugQuality || !canActivateVersion}
                            sx={{ minWidth: 140 }}
                          >
                            {activateVersionMutation.isPending
                              ? t('rag.detail.activatingVersion', '전환 중...')
                              : t('rag.detail.activateVersion', '버전 활성 전환')}
                          </Button>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          현재 버전({doc.version || '-'})과 다른 버전을 입력하면 즉시 활성 버전이 전환됩니다.
                        </Typography>
                        {!canDebugQuality && (
                          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                            운영자 권한이 없어 실행할 수 없습니다.
                          </Typography>
                        )}
                      </>
                    )}

                    {actionTab === 'rechunk' && (
                      <>
                        {canDebugQuality ? (
                          <ReChunkControl
                            docId={doc.docId}
                            docTitle={doc.title}
                            chunkingStrategies={chunkingStrategies}
                            currentStrategy={currentChunkingStrategyKey}
                            currentChunkCount={doc.chunks?.length}
                            enableDebug={canDebugQuality}
                            onReChunkComplete={() => refetch()}
                          />
                        ) : (
                          <Card variant="outlined" sx={{ bgcolor: 'warning.lighter' }}>
                            <CardContent sx={{ p: 1.5 }}>
                              <Typography variant="body2" color="warning.dark">
                                운영자 권한이 필요합니다. (ADMIN / SYNAPSEX_ADMIN / SYNAPSEX_OPERATOR)
                              </Typography>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    )}

                    {actionTab === 'quality' && (
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          품질 리포트 상태를 확인하고, FAIL 시 재청킹 탭에서 즉시 재실행할 수 있습니다.
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                          <Label color={qualityGateColor} variant="soft" sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                            {qualityGateLabel}
                          </Label>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`errors: ${qualityReport?.errors?.length ?? 0}`}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`missing: ${qualityReport?.missingRequired?.length ?? 0}`}
                          />
                        </Stack>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {qualityReport && (
          <RagQualityReportCard
            report={qualityReport}
            title={t('rag.quality.detailTitle')}
            enableDebug={canDebugQuality}
          />
        )}

        {canDebugQuality && (
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t('rag.detail.replaceChunksTitle', '활성 청크 교체')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('rag.detail.replaceChunksHint', 'POST /api/synapse/rag/documents/{docId}/chunks/replace payload를 JSON으로 입력하세요.')}
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={8}
                  value={replaceChunksJson}
                  onChange={(e) => setReplaceChunksJson(e.target.value)}
                  placeholder='{"chunks":[{"chunk_index":0,"chunk_content":"...","embedding":[0.1],"metadata_json":{"version":"v2026.02"}}]}'
                />
                <Stack direction="row" justifyContent="flex-end">
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!canReplaceChunks}
                    onClick={() => {
                      void handleReplaceChunks();
                    }}
                  >
                    {replaceChunksMutation.isPending
                      ? t('rag.detail.replacingChunks', '교체 중...')
                      : t('rag.detail.replaceChunks', '청크 교체 실행')}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

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
