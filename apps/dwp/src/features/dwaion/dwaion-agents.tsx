import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bot, MessageSquarePlus, ShieldCheck } from 'lucide-react';
import { ActionButton, GuidedEmptyState, PageCanvas } from '@dwp-frontend/design-system';
import {
  isAppResourceEntitled,
  listRuntimeRegistryEntries,
  type RuntimeRegistryEntry,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DWAION_AGENT_KEY,
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
  dwaionWorkspaceRoute,
  type DwaionAgentKey,
} from './dwaion-contract';

const USER_AGENT_KEYS = new Set([DWAION_AGENT_KEY, DWAION_APPROVAL_EXPERT_AGENT_KEY]);

function isDwaionRuntimeAgent(
  agent: RuntimeRegistryEntry
): agent is RuntimeRegistryEntry & { entryKey: DwaionAgentKey } {
  return USER_AGENT_KEYS.has(agent.entryKey as DwaionAgentKey);
}

export function DwaionAgents() {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const { permissions } = usePermissions();
  const query = useQuery({
    queryKey: ['dwaion', 'runtime-agents'],
    queryFn: () => listRuntimeRegistryEntries('AGENT'),
    staleTime: 60_000,
  });
  const canUseApprovalExpert = isAppResourceEntitled('APP.APPROVALS', permissions);
  const agents = useMemo(
    () =>
      (query.data ?? []).filter(
        (agent): agent is RuntimeRegistryEntry & { entryKey: DwaionAgentKey } =>
          isDwaionRuntimeAgent(agent) &&
          (agent.entryKey !== DWAION_APPROVAL_EXPERT_AGENT_KEY || canUseApprovalExpert)
      ),
    [canUseApprovalExpert, query.data]
  );

  return (
    <PageCanvas>
      <Box>
        <Typography component="h1" variant="h4">
          {t('dwaionAgents.title', { defaultValue: '업무 에이전트' })}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6, maxWidth: 760 }}>
          {t('dwaionAgents.description', {
            defaultValue:
              '운영 레지스트리에 게시되고 현재 사용자에게 허용된 에이전트만 표시합니다.',
          })}
        </Typography>
      </Box>

      {query.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAgents.loadError', {
            defaultValue: '에이전트 카탈로그를 불러오지 못했습니다.',
          })}
        </Alert>
      )}

      <Box
        component="section"
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        {query.isLoading ? (
          [0, 1].map((index) => <Skeleton key={index} variant="rounded" height={220} />)
        ) : agents.length ? (
          agents.map((agent) => (
            <Box
              key={agent.entryKey}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2.5 }}
            >
              <Stack direction="row" justifyContent="space-between" gap={2}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    color: 'primary.main',
                  }}
                >
                  <Bot size={22} aria-hidden="true" />
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<ShieldCheck size={13} />}
                  label={agent.riskTier}
                />
              </Stack>
              <Typography component="h2" variant="h6" fontWeight={850} sx={{ mt: 2 }}>
                {agent.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, minHeight: 42 }}>
                {agent.description}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
                {t('dwaionAgents.version', {
                  defaultValue: '버전 {{version}} · 리비전 {{revision}}',
                  version: agent.artifactVersion,
                  revision: agent.revision,
                })}
              </Typography>
              <ActionButton
                intent="primary"
                startIcon={<MessageSquarePlus size={16} />}
                onClick={() => navigate(dwaionWorkspaceRoute(undefined, undefined, agent.entryKey))}
                sx={{ mt: 2 }}
              >
                {t('dwaionAgents.start', { defaultValue: '대화 시작' })}
              </ActionButton>
            </Box>
          ))
        ) : (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <GuidedEmptyState
              kind="permission"
              title={t('dwaionAgents.emptyTitle', {
                defaultValue: '사용 가능한 에이전트가 없습니다',
              })}
              description={t('dwaionAgents.emptyDescription', {
                defaultValue: '게시 상태와 현재 사용자의 앱 권한을 확인하세요.',
              })}
            />
          </Box>
        )}
      </Box>
    </PageCanvas>
  );
}
