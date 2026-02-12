/**
 * Agent Studio — 에이전트 스튜디오 통합 관리
 * BE: GET/POST/DELETE /api/synapse/agents, GET/PUT /api/synapse/agents/{id}
 * Catalog: GET /api/synapse/agents/tools/catalog, 지식 = getRagDocuments
 */

import { useState, useEffect, useCallback } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import {
  showToast,
  getAgents,
  getAgentById,
  getAgentToolsCatalog,
  updateAgentConfig,
  createAgent,
  deleteAgent,
  type AgentListItemDto,
  type AgentConfigPayload,
  type AgentDetailDto,
  type CreateAgentRequest,
} from '@dwp-frontend/shared-utils';

import { useAgentCatalog } from '../../hooks/use-agent-catalog';
import { useAgentConfigState } from './hooks/use-agent-config-state';
import {
  AgentSidebar,
  CreateAgentModal,
  AgentModelTab,
  AgentPromptTab,
  AgentToolsTab,
  AgentKnowledgeTab,
  SandboxChat,
} from './components';

const AGENTS_QUERY_KEY = ['synapse', 'agents'];
const AGENT_DETAIL_QUERY_KEY = (id: string) => ['synapse', 'agents', 'detail', id];

export const AgentConfigPage = () => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: agentsRes } = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: () => getAgents(),
  });
  const rawAgents = agentsRes?.data ?? [];
  const agents: AgentListItemDto[] = rawAgents.map((a) => ({
    ...a,
    id: a.id || String((a as { agentId?: number }).agentId ?? ''),
  }));
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;

  const { data: detailRes } = useQuery({
    queryKey: AGENT_DETAIL_QUERY_KEY(selectedAgentId ?? ''),
    queryFn: () => getAgentById(selectedAgentId!),
    enabled: !!selectedAgentId,
  });
  const agentDetail = detailRes?.data ?? null;

  const { data: toolsCatalogRes } = useQuery({
    queryKey: ['synapse', 'agents', 'tools', 'catalog'],
    queryFn: () => getAgentToolsCatalog(),
  });
  const toolList = toolsCatalogRes?.data ?? [];
  const toolIdByKey = new Map(toolList.map((tool) => [tool.key, tool.toolId]));
  const allowedToolIds = new Set(selectedAgent?.toolIds ?? []);
  const filteredToolList = toolList.filter(
    (tool) => tool.toolId != null && allowedToolIds.has(tool.toolId)
  );

  const { models: catalogModels, domains: catalogDomains, docTypes: catalogDocTypes, isLoading: catalogLoading, isError: catalogError, catalogErrorMessage } = useAgentCatalog();
  const engines = catalogModels.map((m) => ({ key: m.key, label: m.value }));
  const domains = catalogDomains.map((d) => ({ key: d.key, label: d.value }));

  const state = useAgentConfigState(selectedAgentId);

  useEffect(() => {
    if (agents.length > 0 && selectedAgentId === null) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  useEffect(() => {
    state.hydrateFromDetail(agentDetail);
  }, [agentDetail, state.hydrateFromDetail]);

  useEffect(() => {
    if (toolList.length > 0) {
      state.setToolsFromList(toolList.map((item) => item.key), false);
    }
  }, [toolList, selectedAgentId, state.setToolsFromList]);

  const handleSaveAndDeploy = useCallback(async () => {
    if (!selectedAgentId) return;
    setSaveLoading(true);
    try {
      const payload: AgentConfigPayload = {
        modelName: state.engineKey,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        ...(state.domainKey && { domain: state.domainKey }),
        systemInstruction: state.systemPrompt,
        toolIds: Object.entries(state.tools)
          .filter(([, v]) => v)
          .map(([k]) => toolIdByKey.get(k))
          .filter((id): id is number => typeof id === 'number'),
        ...(state.boundKnowledgeIds.size > 0 && { knowledgeIds: Array.from(state.boundKnowledgeIds) }),
      };
      await updateAgentConfig(selectedAgentId, payload);
      await queryClient.invalidateQueries({ queryKey: AGENT_DETAIL_QUERY_KEY(selectedAgentId) });
      await queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
      showToast(t('agentConfig.deploySuccessPersona'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '배포에 실패했습니다.', 'error');
    } finally {
      setSaveLoading(false);
    }
  }, [selectedAgentId, state.engineKey, state.temperature, state.maxTokens, state.domainKey, state.systemPrompt, state.tools, state.boundKnowledgeIds, queryClient, t]);

  const handleCreateSubmit = useCallback(
    async (payload: CreateAgentRequest) => {
      const res = await createAgent(payload);
      const data = res.data as AgentDetailDto & { agentId?: number } | undefined;
      const newId = data?.id ?? (data?.agentId != null ? String(data.agentId) : '');
      await queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
      if (newId) {
        await queryClient.invalidateQueries({ queryKey: AGENT_DETAIL_QUERY_KEY(newId) });
        setSelectedAgentId(newId);
      }
      showToast(t('agentConfig.createSuccess'), 'success');
      return { id: newId };
    },
    [queryClient, t]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmId) return;
    setDeleteLoading(true);
    try {
      await deleteAgent(deleteConfirmId);
      await queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: AGENT_DETAIL_QUERY_KEY(deleteConfirmId) });
      setSelectedAgentId((prev) => (prev === deleteConfirmId ? null : prev));
      setDeleteConfirmId(null);
      showToast(t('agentConfig.deleteSuccess'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('agentConfig.deleteError'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteConfirmId, queryClient, t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="solar:robot-bold-duotone" width={24} sx={{ color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{t('agentConfig.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('agentConfig.subtitle')}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Iconify icon="solar:chat-round-dots-bold" width={18} />} onClick={() => setSandboxOpen((v) => !v)}>
            테스트 채팅
          </Button>
          <Button
            variant="contained"
            size="medium"
            sx={{ px: 2.5 }}
            startIcon={saveLoading ? <CircularProgress size={18} color="inherit" /> : <Iconify icon="solar:diskette-bold" width={18} />}
            onClick={handleSaveAndDeploy}
            disabled={!selectedAgentId || saveLoading}
          >
            {saveLoading ? '저장 중...' : '저장 및 배포'}
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <AgentSidebar
          agents={agents}
          selectedId={selectedAgentId}
          onSelect={setSelectedAgentId}
          onAddClick={() => setCreateModalOpen(true)}
          onDelete={(id) => setDeleteConfirmId(id)}
        />

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
            <Tab icon={<Iconify icon="solar:magic-stick-bold-duotone" width={18} />} iconPosition="start" label={t('agentConfig.model')} sx={{ minHeight: 56 }} />
            <Tab icon={<Iconify icon="solar:document-text-bold-duotone" width={18} />} iconPosition="start" label={t('agentConfig.prompts')} sx={{ minHeight: 56 }} />
            <Tab icon={<Iconify icon="solar:wrench-bold-duotone" width={18} />} iconPosition="start" label={t('agentConfig.tools')} sx={{ minHeight: 56 }} />
            <Tab icon={<Iconify icon="solar:database-bold-duotone" width={18} />} iconPosition="start" label="지식" sx={{ minHeight: 56 }} />
          </Tabs>

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {catalogError && (
              <Alert severity="error" sx={{ m: 2 }}>{catalogErrorMessage}</Alert>
            )}
            {catalogLoading && !catalogError && (
              <Stack spacing={2} sx={{ p: 3 }}>
                <Skeleton variant="rounded" height={56} />
                <Skeleton variant="rounded" height={120} />
                <Skeleton variant="rounded" height={48} width={400} />
              </Stack>
            )}
            {!catalogLoading && !catalogError && tabValue === 0 && (
              <AgentModelTab
                engines={engines}
                engineKey={state.engineKey}
                onEngineChange={state.setEngineKey}
                domains={domains}
                domainKey={state.domainKey}
                onDomainChange={state.setDomainKey}
                temperature={state.temperature}
                onTemperatureChange={state.setTemperature}
                maxTokens={state.maxTokens}
                onMaxTokensChange={state.setMaxTokens}
              />
            )}
            {!catalogLoading && !catalogError && tabValue === 1 && (
              <AgentPromptTab systemPrompt={state.systemPrompt} onSystemPromptChange={state.setSystemPrompt} />
            )}
            {!catalogLoading && !catalogError && tabValue === 2 && (
              <AgentToolsTab toolList={filteredToolList} selectedTools={state.tools} onToggle={state.toggleTool} />
            )}
            {!catalogLoading && !catalogError && tabValue === 3 && (
              <AgentKnowledgeTab
                docTypes={catalogDocTypes}
                boundIds={state.boundKnowledgeIds}
                onToggleBinding={state.toggleKnowledgeBinding}
              />
            )}
          </Box>
        </Box>
      </Box>

      {sandboxOpen && (
        <SandboxChat selectedAgentId={selectedAgentId} fallbackSystemPrompt={state.systemPrompt} engineKey={state.engineKey} temperature={state.temperature} onClose={() => setSandboxOpen(false)} />
      )}

      <CreateAgentModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
        domains={domains}
        models={engines}
      />

      <Dialog open={!!deleteConfirmId} onClose={() => !deleteLoading && setDeleteConfirmId(null)}>
        <DialogTitle>{t('agentConfig.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('agentConfig.deleteConfirmMessage')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)} disabled={deleteLoading}>
            {t('agentConfig.cancel')}
          </Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleteLoading}>
            {deleteLoading ? t('agentConfig.deleteSubmitting') : t('agentConfig.deleteConfirmButton')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
