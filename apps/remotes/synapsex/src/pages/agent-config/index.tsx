/**
 * Agent Studio — 에이전트 스튜디오 통합 관리
 * BE: GET/POST/DELETE /api/synapse/agents, GET/PUT /api/synapse/agents/{id}
 * Catalog: GET /api/synapse/agents/tools/catalog, 지식 = getRagDocuments
 */

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  showToast,
  getAgents,
  createAgent,
  deleteAgent,
  getAgentConfig,
  usePermissions,
  updateAgentConfig,
  type AgentDetailDto,
  type ToolSchemaJson,
  getAgentToolsCatalog,
  type AgentListItemDto,
  type AgentConfigPayload,
  type CreateAgentRequest,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Drawer from '@mui/material/Drawer';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import useMediaQuery from '@mui/material/useMediaQuery';
import CircularProgress from '@mui/material/CircularProgress';

import { useAgentCatalog } from '../../hooks/use-agent-catalog';
import { useAgentConfigState } from './hooks/use-agent-config-state';
import {
  SandboxChat,
  AgentSidebar,
  AgentModelTab,
  AgentToolsTab,
  AgentPromptTab,
  CreateAgentModal,
  AgentKnowledgeTab,
} from './components';

const AGENTS_QUERY_KEY = ['synapse', 'agents'];
const AGENT_DETAIL_QUERY_KEY = (id: string) => ['synapse', 'agents', 'detail', id];

const ADMIN_RESOURCE = 'menu.governance-config.admin';

export const AgentConfigPage = () => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  /** 모바일+태블릿(xs, sm): Drawer. 데스크탑(md+): 고정 사이드바 (LAYOUT_GUIDE: xs~600, sm~900, md~1200) */
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission(ADMIN_RESOURCE, 'VIEW');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [promptSaveSuccessCount, setPromptSaveSuccessCount] = useState(0);

  const { data: agentsRes } = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: () => getAgents(),
  });
  const rawAgents = agentsRes?.data ?? [];
  const agents: AgentListItemDto[] = rawAgents.map((a) => {
    const raw = a as AgentListItemDto & { agentId?: number; tenant_id?: number };
    return {
      ...a,
      id: a.id || String(raw.agentId ?? ''),
      tenantId: a.tenantId ?? raw.tenant_id,
    };
  });
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;

  const { data: detailRes } = useQuery({
    queryKey: AGENT_DETAIL_QUERY_KEY(selectedAgentId ?? ''),
    queryFn: () => getAgentConfig(selectedAgentId!),
    enabled: !!selectedAgentId,
  });
  const agentDetail = detailRes?.data ?? null;

  const { data: toolsCatalogRes } = useQuery({
    queryKey: ['synapse', 'agents', 'tools', 'catalog'],
    queryFn: () => getAgentToolsCatalog(),
  });
  const catalogToolList = useMemo(() => toolsCatalogRes?.data ?? [], [toolsCatalogRes?.data]);
  const toolIdByKey = useMemo(
    () =>
      new Map<string, number | undefined>(
        catalogToolList
          .filter((tool) => tool.key ?? (tool as { toolName?: string }).toolName)
          .map((tool) => [tool.key ?? (tool as { toolName?: string }).toolName!, tool.toolId])
      ),
    [catalogToolList]
  );
  const state = useAgentConfigState(selectedAgentId);
  const {
    engineKey,
    temperature,
    maxTokens,
    domainKey,
    systemPrompt,
    tools,
    hydrateFromDetail,
    setToolsFromList,
  } = state;
  const buildConfigPayload = useCallback(
    (overrides?: Partial<AgentConfigPayload>): AgentConfigPayload => {
      const selectedToolNames = Object.entries(tools)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const toolIdsFromCatalog = selectedToolNames
        .map((k) => toolIdByKey.get(k))
        .filter((id): id is number => typeof id === 'number');
      return {
        modelName: engineKey,
        temperature,
        maxTokens,
        ...(domainKey && { domain: domainKey }),
        systemInstruction: systemPrompt,
        ...(toolIdsFromCatalog.length > 0
          ? { toolIds: toolIdsFromCatalog }
          : { toolNames: selectedToolNames }),
        ...(overrides ?? {}),
      };
    },
    [
      tools,
      engineKey,
      temperature,
      maxTokens,
      domainKey,
      systemPrompt,
      toolIdByKey,
    ]
  );
  /** Config API tools가 유일한 출처. catalog와 병합하지 않음 (선택 에이전트에 매핑된 도구만 표시) */
  const toolList = useMemo(() => {
    const configTools = agentDetail?.tools ?? [];
    return configTools.map((tool) => ({
      key: tool.toolName,
      label: tool.toolName,
      description: tool.description,
      schemaJson: tool.schemaJson as ToolSchemaJson | undefined,
    }));
  }, [agentDetail?.tools]);

  const { models: catalogModels, domains: catalogDomains, docTypes: catalogDocTypes, isLoading: catalogLoading, isError: catalogError, catalogErrorMessage } = useAgentCatalog();
  const engines = catalogModels.map((m) => ({ key: m.key, label: m.value }));
  const domains = catalogDomains.map((d) => ({ key: d.key, label: d.value }));

  useEffect(() => {
    if (agents.length > 0 && selectedAgentId === null) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  useEffect(() => {
    hydrateFromDetail(agentDetail);
  }, [agentDetail, hydrateFromDetail]);

  useEffect(() => {
    if (toolList.length > 0) {
      const keys = toolList.map((item) => item.key ?? (item as { toolName?: string }).toolName).filter(Boolean);
      if (keys.length > 0) setToolsFromList(keys, false);
    }
  }, [toolList, selectedAgentId, setToolsFromList]);

  const handleSaveAndDeploy = useCallback(async () => {
    if (!selectedAgentId) return;
    setSaveLoading(true);
    try {
      await updateAgentConfig(selectedAgentId, buildConfigPayload());
      await queryClient.invalidateQueries({ queryKey: AGENT_DETAIL_QUERY_KEY(selectedAgentId) });
      await queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
      setPromptSaveSuccessCount((c) => c + 1);
      showToast(t('agentConfig.deploySuccessPersona'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '배포에 실패했습니다.', 'error');
    } finally {
      setSaveLoading(false);
    }
  }, [selectedAgentId, buildConfigPayload, queryClient, t]);

  const handleUpdateKnowledgeDocIds = useCallback(
    async (docIds: Array<string | number>) => {
      if (!selectedAgentId) return;
      const normalizedDocIds = docIds.map(String);
      await updateAgentConfig(selectedAgentId, buildConfigPayload({ docIds: normalizedDocIds }));
      await queryClient.invalidateQueries({ queryKey: AGENT_DETAIL_QUERY_KEY(selectedAgentId) });
      await queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
    [selectedAgentId, buildConfigPayload, queryClient]
  );

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
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
        sx={{
          p: { xs: 2, md: 2 },
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ minWidth: 0, flex: { xs: '1 1 100%', sm: '0 0 auto' }, order: { xs: 1, sm: 0 } }}
        >
          {isMobile && (
            <IconButton
              onClick={() => setSidebarOpen(true)}
              size="medium"
              aria-label={t('agentConfig.openAgentList')}
              sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
            >
              <Iconify icon="solar:hamburger-menu-bold" width={24} />
            </IconButton>
          )}
          <Iconify icon="solar:robot-bold-duotone" width={24} sx={{ color: 'primary.main', flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
              <Typography variant="h5" sx={{ fontWeight: 700 }} noWrap>
                {t('agentConfig.title')}
              </Typography>
              {selectedAgent && (agentDetail?.tenantId ?? selectedAgent?.tenantId) != null && (
                isAdmin && (agentDetail?.tenantId ?? selectedAgent?.tenantId) === 0 ? (
                  <Chip label={t('agentConfig.systemAgentBadge')} size="small" color="info" variant="outlined" />
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {t('agentConfig.tenantId', { id: String(agentDetail?.tenantId ?? selectedAgent?.tenantId) })}
                  </Typography>
                )
              )}
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', md: 'block' } }}
              noWrap
            >
              {t('agentConfig.subtitle')}
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: { xs: 'flex-end', sm: 'flex-end' },
            flex: { xs: '0 0 auto', sm: '0 0 auto' },
            order: { xs: 2, sm: 0 },
          }}
        >
          {isMobile ? (
            <>
              <IconButton
                aria-label="테스트 채팅"
                sx={{
                  minWidth: 44,
                  minHeight: 44,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
                onClick={() => setSandboxOpen((v) => !v)}
              >
                <Iconify icon="solar:chat-round-dots-bold" width={22} />
              </IconButton>
              <IconButton
                color="primary"
                aria-label={saveLoading ? '저장 중' : '저장 및 배포'}
                sx={{
                  minWidth: 44,
                  minHeight: 44,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&:disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
                }}
                onClick={handleSaveAndDeploy}
                disabled={!selectedAgentId || saveLoading}
              >
                {saveLoading ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  <Iconify icon="solar:diskette-bold" width={22} />
                )}
              </IconButton>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                size="medium"
                aria-label="테스트 채팅"
                sx={{ minHeight: 44 }}
                startIcon={<Iconify icon="solar:chat-round-dots-bold" width={18} />}
                onClick={() => setSandboxOpen((v) => !v)}
              >
                테스트 채팅
              </Button>
              <Button
                variant="contained"
                size="medium"
                aria-label={saveLoading ? '저장 중' : '저장 및 배포'}
                sx={{ px: 2.5, minHeight: 44 }}
                startIcon={saveLoading ? <CircularProgress size={18} color="inherit" /> : <Iconify icon="solar:diskette-bold" width={18} />}
                onClick={handleSaveAndDeploy}
                disabled={!selectedAgentId || saveLoading}
              >
                {saveLoading ? '저장 중...' : '저장 및 배포'}
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {!isMobile && (
          <AgentSidebar
            agents={agents}
            selectedId={selectedAgentId}
            onSelect={setSelectedAgentId}
            onAddClick={() => setCreateModalOpen(true)}
            onDelete={(id) => setDeleteConfirmId(id)}
          />
        )}
        {isMobile && (
          <Drawer
            anchor="left"
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            sx={{ '& .MuiDrawer-paper': { width: 280 } }}
          >
            <Box sx={{ pt: 2, height: '100%', overflow: 'auto' }}>
              <AgentSidebar
                agents={agents}
                selectedId={selectedAgentId}
                onSelect={(id) => {
                  setSelectedAgentId(id);
                  setSidebarOpen(false);
                }}
                onAddClick={() => {
                  setCreateModalOpen(true);
                  setSidebarOpen(false);
                }}
                onDelete={(id) => setDeleteConfirmId(id)}
              />
            </Box>
          </Drawer>
        )}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
          >
            <Tab icon={<Iconify icon="solar:magic-stick-bold-duotone" width={18} />} iconPosition="start" label={t('agentConfig.model')} sx={{ minHeight: 56 }} />
            <Tab icon={<Iconify icon="solar:document-text-bold-duotone" width={18} />} iconPosition="start" label={t('agentConfig.prompts')} sx={{ minHeight: 56 }} />
            <Tab icon={<Iconify icon="ph:git-branch-duotone" width={18} />} iconPosition="start" label={t('agentConfig.tools')} sx={{ minHeight: 56 }} />
            <Tab icon={<Iconify icon="solar:database-bold-duotone" width={18} />} iconPosition="start" label={t('agentConfig.knowledgeTab')} sx={{ minHeight: 56 }} />
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
                hasSelectedAgent={!!selectedAgentId}
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
              <AgentPromptTab
                systemPrompt={state.systemPrompt}
                onSystemPromptChange={state.setSystemPrompt}
                saveSuccessCount={promptSaveSuccessCount}
              />
            )}
            {!catalogLoading && !catalogError && tabValue === 2 && (
              <AgentToolsTab toolList={toolList} selectedTools={state.tools} onToggle={state.toggleTool} />
            )}
            {!catalogLoading && !catalogError && tabValue === 3 && (
              <AgentKnowledgeTab
                selectedAgentId={selectedAgentId}
                docTypes={catalogDocTypes}
                boundDocIds={agentDetail?.docIds ?? agentDetail?.knowledgeIds ?? []}
                onUpdateDocIds={handleUpdateKnowledgeDocIds}
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
