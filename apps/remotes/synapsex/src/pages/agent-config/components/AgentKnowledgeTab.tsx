/**
 * Agent Studio — 지식 탭: 2단 그리드
 * 좌: 등록(맵핑)된 RAG 목록 + 지식추가 | 우: Knowledge Summary Card
 * 지식추가 → RAG 라이브러리 목록 선택 → POST knowledge/bind?doc_id=...
 */

import type { CatalogCodeItemDto, AgentKnowledgeItemDto } from '@dwp-frontend/shared-utils';

import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { ConfirmDialog, Iconify, Label } from '@dwp-frontend/design-system';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  showToast,
  getRagDocuments,
  bindAgentKnowledge,
  unbindAgentKnowledge,
  getAgentKnowledgeCatalog,
} from '@dwp-frontend/shared-utils';

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
import Skeleton from '@mui/material/Skeleton';

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
  const [addKnowledgeOpen, setAddKnowledgeOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [unbindConfirmOpen, setUnbindConfirmOpen] = useState(false);
  const [unbindTargetDocId, setUnbindTargetDocId] = useState<number | null>(null);
  const [addKnowledgeSelectedIds, setAddKnowledgeSelectedIds] = useState<Set<string>>(new Set());

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
    enabled: mappingOpen || addKnowledgeOpen,
  });

  const bindMultipleMutation = useMutation({
    mutationFn: async (docIds: string[]) => {
      if (!selectedAgentId) throw new Error(t('agentConfig.knowledge.errors.bindFailed'));
      for (const idStr of docIds) {
        const numId = Number(idStr);
        if (Number.isNaN(numId)) continue;
        const bindRes = await bindAgentKnowledge(selectedAgentId, numId);
        if (bindRes.status !== 'SUCCESS' && bindRes.status !== 'OK') {
          throw new Error(bindRes.message ?? t('agentConfig.knowledge.errors.bindFailed'));
        }
      }
    },
    onSuccess: () => {
      setAddKnowledgeOpen(false);
      setAddKnowledgeSelectedIds(new Set());
      if (selectedAgentId) {
        queryClient.invalidateQueries({ queryKey: KNOWLEDGE_QUERY_KEY(selectedAgentId) });
        queryClient.invalidateQueries({ queryKey: AGENT_DETAIL_QUERY_KEY(selectedAgentId) });
        queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: RAG_QUERY_KEY });
      }
      showToast(t('agentConfig.knowledge.toasts.bound'), 'success');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('agentConfig.knowledge.errors.bindFailed'), 'error');
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
    if (bound) {
      bindMutation.mutate({ docId: numId });
    } else {
      setUnbindTargetDocId(numId);
      setUnbindConfirmOpen(true);
    }
  };

  const handleUnbindConfirm = () => {
    if (unbindTargetDocId == null) return;
    unbindMutation.mutate(
      { docId: unbindTargetDocId },
      {
        onSettled: () => {
          setUnbindConfirmOpen(false);
          setUnbindTargetDocId(null);
        },
      }
    );
  };

  const handleAddKnowledgeToggle = (docId: string, checked: boolean) => {
    setAddKnowledgeSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(docId);
      else next.delete(docId);
      return next;
    });
  };

  const handleAddKnowledgeSubmit = () => {
    const ids = Array.from(addKnowledgeSelectedIds);
    const toBind = ids.filter((id) => !boundDocIdSet.has(id));
    if (toBind.length === 0) {
      showToast('추가할 지식을 선택해 주세요.', 'warning');
      return;
    }
    bindMultipleMutation.mutate(toBind);
  };

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

  useEffect(() => {
    if (addKnowledgeOpen) {
      setAddKnowledgeSelectedIds(new Set());
    }
  }, [addKnowledgeOpen]);

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
              action={
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Iconify icon="solar:add-circle-bold" width={18} />}
                  onClick={() => setAddKnowledgeOpen(true)}
                  disabled={bindMultipleMutation.isPending}
                >
                  {t('agentConfig.knowledge.addKnowledge')}
                </Button>
              }
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
                    startIcon={<Iconify icon="solar:add-circle-bold" width={18} />}
                    onClick={() => setAddKnowledgeOpen(true)}
                  >
                    {t('agentConfig.knowledge.addKnowledge')}
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

      {/* 지식추가: RAG 라이브러리 목록에서 선택 후 바인딩 */}
      <Dialog
        open={addKnowledgeOpen}
        onClose={() => !bindMultipleMutation.isPending && setAddKnowledgeOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 24,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pb: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Iconify icon="solar:document-add-bold-duotone" width={24} sx={{ color: 'primary.main' }} />
          {t('agentConfig.knowledge.addKnowledge')}
        </DialogTitle>
        <DialogContent sx={{ py: 3, minHeight: 280 }}>
          {ragDocsLoading && (
            <Stack spacing={1.5}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rounded" height={56} animation="wave" />
              ))}
            </Stack>
          )}
          {!ragDocsLoading && ragDocs.length === 0 && (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <Iconify icon="solar:folder-open-bold-duotone" width={48} sx={{ color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                RAG 라이브러리에 등록된 문서가 없습니다.
              </Typography>
            </Stack>
          )}
          {!ragDocsLoading && ragDocs.length > 0 && (
            <Stack spacing={1} sx={{ maxHeight: 320, overflowY: 'auto', pr: 0.5 }}>
              {ragDocs
                .filter((doc) => !boundDocIdSet.has(String(doc.docId)))
                .map((doc) => {
                  const docId = String(doc.docId);
                  const checked = addKnowledgeSelectedIds.has(docId);
                  return (
                    <Box
                      key={docId}
                      onClick={() => handleAddKnowledgeToggle(docId, !checked)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddKnowledgeToggle(docId, !checked)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        px: 2,
                        py: 1.5,
                        borderRadius: 1.5,
                        border: 1,
                        cursor: 'pointer',
                        borderColor: checked ? 'primary.main' : 'divider',
                        bgcolor: checked ? 'primary.lighter' : 'background.neutral',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: checked ? 'primary.dark' : 'action.hover',
                          bgcolor: checked ? 'primary.lighter' : 'action.hover',
                        },
                      }}
                    >
                      <Checkbox
                        checked={checked}
                        onChange={(e) => handleAddKnowledgeToggle(docId, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ p: 0, mr: 0.5 }}
                      />
                      <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap>
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
                            color={getStatusMeta(doc.status ?? '').color}
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
              {ragDocs.filter((d) => !boundDocIdSet.has(String(d.docId))).length === 0 && (
                <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
                  <Iconify icon="solar:check-circle-bold-duotone" width={48} sx={{ color: 'success.main', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    추가할 수 있는 미바인딩 문서가 없습니다.
                  </Typography>
                </Stack>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            gap: 1,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Button variant="outlined" onClick={() => setAddKnowledgeOpen(false)} disabled={bindMultipleMutation.isPending}>
            취소
          </Button>
          <Button
            variant="contained"
            startIcon={<Iconify icon="solar:add-circle-bold" width={18} />}
            onClick={handleAddKnowledgeSubmit}
            disabled={bindMultipleMutation.isPending || ragDocsLoading || addKnowledgeSelectedIds.size === 0}
          >
            {bindMultipleMutation.isPending ? '등록 중...' : `등록 (${addKnowledgeSelectedIds.size})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 바인딩 해제 확인 팝업 */}
      <ConfirmDialog
        open={unbindConfirmOpen}
        title={t('agentConfig.knowledge.unbindConfirmTitle')}
        description={t('agentConfig.knowledge.unbindConfirmMessage')}
        confirmText="해제"
        cancelText="취소"
        severity="danger"
        loading={unbindMutation.isPending}
        onConfirm={handleUnbindConfirm}
        onClose={() => !unbindMutation.isPending && setUnbindConfirmOpen(false)}
      />

      {/* RAG 문서 맵핑 */}
      <Dialog
        open={mappingOpen}
        onClose={() => !updateMappingMutation.isPending && setMappingOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 24,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pb: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Iconify icon="solar:document-text-bold-duotone" width={24} sx={{ color: 'primary.main' }} />
          RAG 문서 맵핑
        </DialogTitle>
        <DialogContent sx={{ py: 3, minHeight: 280 }}>
          {ragDocsLoading && (
            <Stack spacing={1.5}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} variant="rounded" height={56} animation="wave" />
              ))}
            </Stack>
          )}
          {!ragDocsLoading && ragDocs.length === 0 && (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <Iconify icon="solar:folder-open-bold-duotone" width={48} sx={{ color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                등록된 문서가 없습니다.
              </Typography>
            </Stack>
          )}
          {!ragDocsLoading && ragDocs.length > 0 && (
            <Stack spacing={1} sx={{ maxHeight: 320, overflowY: 'auto', pr: 0.5 }}>
              {ragDocs.map((doc) => {
                const docId = String(doc.docId);
                const checked = selectedDocIds.has(docId);
                return (
                  <Box
                    key={docId}
                    onClick={() => handleToggleMapping(docId, !checked)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleToggleMapping(docId, !checked)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      px: 2,
                      py: 1.5,
                      borderRadius: 1.5,
                      border: 1,
                      cursor: 'pointer',
                      borderColor: checked ? 'primary.main' : 'divider',
                      bgcolor: checked ? 'primary.lighter' : 'background.neutral',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: checked ? 'primary.dark' : 'action.hover',
                        bgcolor: checked ? 'primary.lighter' : 'action.hover',
                      },
                    }}
                  >
                    <Checkbox
                      id={`knowledge-map-${docId}`}
                      name={`knowledge-map-${docId}`}
                      checked={checked}
                      onChange={(e) => handleToggleMapping(docId, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ p: 0, mr: 0.5 }}
                    />
                    <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
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
                          color={getStatusMeta(doc.status ?? '').color}
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            gap: 1,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Button variant="outlined" onClick={() => setMappingOpen(false)} disabled={updateMappingMutation.isPending}>
            취소
          </Button>
          <Button
            variant="contained"
            startIcon={<Iconify icon="solar:diskette-bold" width={18} />}
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
