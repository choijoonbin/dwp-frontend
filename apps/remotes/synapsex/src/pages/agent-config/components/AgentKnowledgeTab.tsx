/**
 * Agent Studio — 지식 탭: 2단 그리드 + 업로드-바인딩 자동화
 * 좌: RAG 라이브러리 리스트 + 새 지식 업로드 | 우: Knowledge Summary Card
 * 업로드 → POST rag/documents → POST knowledge/bind (즉시 바인딩)
 */

import type { CatalogCodeItemDto, AgentKnowledgeItemDto, RegisterRagDocumentRequest } from '@dwp-frontend/shared-utils';

import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showToast, getRagDocuments, bindAgentKnowledge, registerRagDocument, unbindAgentKnowledge, getAgentKnowledgeCatalog, registerRagDocumentMultipart } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { RegisterRagDocumentModal } from '../../rag/components/register-rag-document-modal';

const KNOWLEDGE_QUERY_KEY = (agentId: string) => ['synapse', 'agents', 'knowledge', agentId];
const AGENT_DETAIL_QUERY_KEY = (id: string) => ['synapse', 'agents', 'detail', id];
const AGENTS_QUERY_KEY = ['synapse', 'agents'];
const RAG_QUERY_KEY = ['synapse', 'rag'];

const STATUS_META: Record<string, { labelKey: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  indexed: { labelKey: 'agentConfig.knowledge.status.ready', color: 'success' },
  indexing: { labelKey: 'agentConfig.knowledge.status.processing', color: 'warning' },
  error: { labelKey: 'agentConfig.knowledge.status.error', color: 'error' },
  processing: { labelKey: 'agentConfig.knowledge.status.processing', color: 'warning' },
  default: { labelKey: 'agentConfig.knowledge.status.pending', color: 'default' },
};

type AgentKnowledgeTabProps = {
  selectedAgentId: string | null;
  docTypes: CatalogCodeItemDto[];
  boundDocIds: Array<string | number>;
  onUpdateDocIds: (docIds: Array<string | number>) => Promise<void>;
};

const docTypeLabel = (docTypes: CatalogCodeItemDto[], key: string): string =>
  docTypes.find((d) => d.key === key)?.value ?? key;

export const AgentKnowledgeTab = ({
  selectedAgentId,
  docTypes,
  boundDocIds,
  onUpdateDocIds,
}: AgentKnowledgeTabProps) => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  const { data: res, isLoading } = useQuery({
    queryKey: KNOWLEDGE_QUERY_KEY(selectedAgentId ?? ''),
    queryFn: () =>
      getAgentKnowledgeCatalog({
        agentId: selectedAgentId!,
        size: 50,
      }),
    enabled: !!selectedAgentId,
  });

  const { data: ragDocsRes, isLoading: ragDocsLoading } = useQuery({
    queryKey: ['synapse', 'rag', 'documents', 'all'],
    queryFn: () => getRagDocuments({ size: 200 }),
    enabled: mappingOpen,
  });

  const registerAndBindMutation = useMutation({
    mutationFn: async (payload: FormData | RegisterRagDocumentRequest) => {
      const registerRes =
        payload instanceof FormData
          ? await registerRagDocumentMultipart(payload)
          : await registerRagDocument(payload);
      if (registerRes.status !== 'SUCCESS' && registerRes.status !== 'OK') {
        throw new Error(registerRes.message ?? t('agentConfig.knowledge.errors.registerFailed'));
      }
      const docId = registerRes.data?.docId;
      if (!docId || !selectedAgentId) {
        throw new Error(t('agentConfig.knowledge.errors.missingDocId'));
      }
      const numId = typeof docId === 'string' ? Number(docId) : docId;
      if (Number.isNaN(numId)) throw new Error(t('agentConfig.knowledge.errors.invalidDocId'));
      const bindRes = await bindAgentKnowledge(selectedAgentId, numId);
      if (bindRes.status !== 'SUCCESS' && bindRes.status !== 'OK') {
        throw new Error(bindRes.message ?? t('agentConfig.knowledge.errors.bindFailed'));
      }
      return { docId: numId };
    },
    onSuccess: () => {
      setUploadOpen(false);
      if (selectedAgentId) {
        queryClient.invalidateQueries({ queryKey: KNOWLEDGE_QUERY_KEY(selectedAgentId) });
        queryClient.invalidateQueries({ queryKey: AGENT_DETAIL_QUERY_KEY(selectedAgentId) });
        queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: RAG_QUERY_KEY });
      }
      showToast(t('agentConfig.knowledge.toasts.registeredAndBound'), 'success');
    },
    onError: (err) => {
      showToast(
        err instanceof Error ? err.message : t('agentConfig.knowledge.errors.registerBindFailed'),
        'error'
      );
    },
  });

  const bindMutation = useMutation({
    mutationFn: ({ docId }: { docId: number }) =>
      bindAgentKnowledge(selectedAgentId!, docId),
    onSuccess: () => {
      if (selectedAgentId) {
        queryClient.invalidateQueries({ queryKey: KNOWLEDGE_QUERY_KEY(selectedAgentId) });
        queryClient.invalidateQueries({ queryKey: AGENT_DETAIL_QUERY_KEY(selectedAgentId) });
        queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
      }
      showToast(t('agentConfig.knowledge.toasts.bound'), 'success');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('agentConfig.knowledge.errors.bindFailed'), 'error');
    },
  });

  const unbindMutation = useMutation({
    mutationFn: ({ docId }: { docId: number }) =>
      unbindAgentKnowledge(selectedAgentId!, docId),
    onSuccess: () => {
      if (selectedAgentId) {
        queryClient.invalidateQueries({ queryKey: KNOWLEDGE_QUERY_KEY(selectedAgentId) });
        queryClient.invalidateQueries({ queryKey: AGENT_DETAIL_QUERY_KEY(selectedAgentId) });
        queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
      }
      showToast(t('agentConfig.knowledge.toasts.unbound'), 'success');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('agentConfig.knowledge.errors.unbindFailed'), 'error');
    },
  });

  const items = useMemo<AgentKnowledgeItemDto[]>(() => res?.data?.items ?? [], [res?.data?.items]);
  const ragDocs = useMemo(() => ragDocsRes?.data?.items ?? [], [ragDocsRes?.data?.items]);
  const boundDocIdSet = useMemo(() => {
    if (boundDocIds.length > 0) return new Set(boundDocIds.map(String));
    return new Set(items.filter((d) => d.isBound).map((d) => String(d.docId)));
  }, [boundDocIds, items]);

  const summary = useMemo(() => {
    const bound = items.filter((d) => d.isBound);
    const byType = items.reduce<Record<string, number>>((acc, d) => {
      const k = d.docType ?? d.sourceType ?? 'GENERAL';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    const keywords = [...new Set(items.flatMap((d) => (d.title ?? '').split(/\s+/).filter(Boolean)))].slice(0, 8);
    return { boundCount: bound.length, totalCount: items.length, byType, keywords };
  }, [items]);

  const handleToggle = (docId: string | number, bound: boolean) => {
    if (!selectedAgentId) return;
    const numId = typeof docId === 'string' ? Number(docId) : docId;
    if (Number.isNaN(numId)) return;
    if (bound) bindMutation.mutate({ docId: numId });
    else unbindMutation.mutate({ docId: numId });
  };

  const handleUploadSubmit = (payload: FormData | RegisterRagDocumentRequest): Promise<void> =>
    registerAndBindMutation.mutateAsync(payload).then(() => {});

  const pending = bindMutation.isPending || unbindMutation.isPending;
  const updateMappingMutation = useMutation({
    mutationFn: async (docIds: Array<string | number>) => onUpdateDocIds(docIds),
    onSuccess: () => {
      setMappingOpen(false);
      if (selectedAgentId) {
        queryClient.invalidateQueries({ queryKey: KNOWLEDGE_QUERY_KEY(selectedAgentId) });
        queryClient.invalidateQueries({ queryKey: AGENT_DETAIL_QUERY_KEY(selectedAgentId) });
        queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: RAG_QUERY_KEY });
      }
      showToast('지식 맵핑이 업데이트되었습니다.', 'success');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : '지식 맵핑 업데이트에 실패했습니다.', 'error');
    },
  });

  const getStatusMeta = (status: string) => {
    const meta = STATUS_META[status?.toLowerCase()] ?? STATUS_META.default;
    return { ...meta, label: t(meta.labelKey) };
  };
  const handleToggleMapping = (docId: string, checked: boolean) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(docId);
      else next.delete(docId);
      return next;
    });
  };

  useEffect(() => {
    if (mappingOpen) {
      setSelectedDocIds(new Set(boundDocIdSet));
    }
  }, [mappingOpen, boundDocIdSet]);

  if (!selectedAgentId) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Typography variant="body2" color="text.secondary">
          {t('agentConfig.selectAgentPrompt')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
          gap: { xs: 2, md: 4 },
          alignItems: 'stretch',
          '& > *': { minHeight: 0 },
        }}
      >
        {/* 좌측: RAG 라이브러리 리스트 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card
            variant="outlined"
            sx={{
              boxShadow: (theme) => theme.shadows[1],
              borderRadius: 2,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <CardHeader
              title={t('agentConfig.knowledge.title')}
              subheader={t('agentConfig.knowledge.subheader')}
              action={items.length > 0 ? (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Iconify icon="solar:upload-bold" width={18} />}
                  onClick={() => setUploadOpen(true)}
                  disabled={registerAndBindMutation.isPending}
                >
                  {t('agentConfig.knowledge.upload')}
                </Button>
              ) : null}
              sx={{ pb: 0 }}
            />
            <CardContent sx={{ flex: 1, overflow: 'auto', pt: 1 }}>
              {isLoading && (
                <Typography variant="body2" color="text.secondary">
                  {t('agentConfig.knowledge.loading')}
                </Typography>
              )}
              {!isLoading && items.length === 0 && (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Iconify
                    icon="solar:document-text-bold-duotone"
                    width={48}
                    sx={{ color: 'text.disabled', mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('agentConfig.knowledge.empty')}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Iconify icon="solar:upload-bold" width={18} />}
                    onClick={() => setUploadOpen(true)}
                  >
                    {t('agentConfig.knowledge.upload')}
                  </Button>
                </Box>
              )}
              <Stack spacing={1}>
                {items.map((doc) => {
                  const docId = String(doc.docId);
                  const bound = doc.isBound ?? false;
                  const docTypeKey = doc.docType ?? doc.sourceType;
                  const statusMeta = getStatusMeta(doc.status ?? '');
                  return (
                    <Box
                      key={docId}
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        border: 1,
                        borderColor: bound ? 'primary.main' : 'divider',
                        bgcolor: bound ? 'primary.lighter' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                        {bound ? (
                          <Iconify
                            icon="solar:check-circle-bold"
                            width={20}
                            sx={{ color: 'success.main', flexShrink: 0 }}
                          />
                        ) : (
                          <Iconify
                            icon="solar:document-text-bold-duotone"
                            width={20}
                            sx={{ color: 'text.secondary', flexShrink: 0 }}
                          />
                        )}
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {doc.title}
                          </Typography>
                          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                            <Typography variant="caption" color="text.secondary">
                              {docTypeLabel(docTypes, docTypeKey)}
                            </Typography>
                            <Chip
                              label={statusMeta.label}
                              size="small"
                              color={statusMeta.color}
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          </Stack>
                        </Box>
                      </Stack>
                      <FormControlLabel
                        sx={{ m: 0 }}
                        control={
                          <Switch
                            id={`knowledge-bound-${docId}`}
                            name={`knowledge-bound-${docId}`}
                            checked={bound}
                            disabled={pending}
                            onChange={(e) => handleToggle(doc.docId, e.target.checked)}
                          />
                        }
                        label={
                          <Typography variant="caption" color="text.secondary">
                            {bound
                              ? t('agentConfig.knowledge.boundStatus')
                              : t('agentConfig.knowledge.unboundStatus')}
                          </Typography>
                        }
                      />
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* 우측: Knowledge Summary Card */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card
            variant="outlined"
            sx={{
              flex: 1,
              minHeight: 280,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: (theme) => theme.shadows[1],
              borderRadius: 2,
              bgcolor: 'background.paper',
            }}
          >
            <CardHeader
              title={t('agentConfig.knowledge.summaryTitle')}
              subheader={t('agentConfig.knowledge.summarySubheader')}
              action={
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setMappingOpen(true)}
                >
                  맵핑추가
                </Button>
              }
              sx={{ pb: 0 }}
            />
            <CardContent sx={{ flex: 1, pt: 1 }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('agentConfig.knowledge.bound')}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {summary.boundCount}
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                      / {summary.totalCount}
                    </Typography>
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    {t('agentConfig.knowledge.byType')}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {Object.entries(summary.byType).map(([key, count]) => (
                      <Chip
                        key={key}
                        label={`${docTypeLabel(docTypes, key)}: ${count}`}
                        size="small"
                        variant="outlined"
                        sx={{ borderRadius: 1 }}
                      />
                    ))}
                    {Object.keys(summary.byType).length === 0 && (
                      <Typography variant="caption" color="text.disabled">
                        {t('agentConfig.knowledge.none')}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    {t('agentConfig.knowledge.keywords')}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {summary.keywords.slice(0, 8).map((kw) => (
                      <Label key={kw} variant="soft" color="default" sx={{ fontSize: '0.7rem' }}>{kw}</Label>
                    ))}
                    {summary.keywords.length === 0 && (
                      <Typography variant="caption" color="text.disabled">
                        {t('agentConfig.knowledge.noKeywords')}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Dialog open={uploadOpen} onClose={() => !registerAndBindMutation.isPending && setUploadOpen(false)} maxWidth="sm" fullWidth>
        <RegisterRagDocumentModal
          key={uploadOpen ? 'open' : 'closed'}
          onClose={() => setUploadOpen(false)}
          onSubmit={handleUploadSubmit}
          isLoading={registerAndBindMutation.isPending}
          closeOnSubmit={false}
          docTypes={docTypes}
        />
      </Dialog>

      <Dialog
        open={mappingOpen}
        onClose={() => !updateMappingMutation.isPending && setMappingOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: '70%' },
          },
        }}
      >
        <DialogTitle>RAG 문서 맵핑</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {ragDocsLoading && (
            <Typography variant="body2" color="text.secondary">
              문서 목록을 불러오는 중...
            </Typography>
          )}
          {!ragDocsLoading && ragDocs.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              등록된 문서가 없습니다.
            </Typography>
          )}
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {ragDocs.map((doc) => {
              const docId = String(doc.docId);
              const checked = selectedDocIds.has(docId);
              return (
                <Box
                  key={docId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    border: 1,
                    borderColor: checked ? 'primary.main' : 'divider',
                    bgcolor: checked ? 'primary.lighter' : 'transparent',
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        id={`knowledge-map-${docId}`}
                        name={`knowledge-map-${docId}`}
                        checked={checked}
                        onChange={(e) => handleToggleMapping(docId, e.target.checked)}
                      />
                    }
                    label={
                      <Stack spacing={0.5}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {doc.title}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            {doc.sourceType}
                          </Typography>
                          <Chip
                            label={getStatusMeta(doc.status ?? '').label}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        </Stack>
                      </Stack>
                    }
                    sx={{ flex: 1, m: 0 }}
                  />
                </Box>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMappingOpen(false)} disabled={updateMappingMutation.isPending}>
            취소
          </Button>
          <Button
            variant="contained"
            onClick={() => updateMappingMutation.mutate(Array.from(selectedDocIds))}
            disabled={updateMappingMutation.isPending || ragDocsLoading}
          >
            {updateMappingMutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
