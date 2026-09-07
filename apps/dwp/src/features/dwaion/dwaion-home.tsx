import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { PageCanvas } from '@dwp-frontend/design-system';
import {
  createDwaionQuestionLaunchState,
  createQuestionLaunch,
  getDwaionConversations,
  getDwaionProposals,
  getWorkspaceWorkQueue,
  getWorkplaceActions,
  isAppResourceEntitled,
  listRuntimeRegistryEntries,
  type RuntimeRegistryEntry,
  useAuth,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DWAION_AGENT_KEY,
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
  dwaionWorkspaceRoute,
  type DwaionAgentKey,
} from './dwaion-contract';
import { DwaionHomeContent } from './dwaion-home-content';
import { homeLoadState, homePriorityWork, homeVerifiedAt } from './dwaion-home-model';
import { DwaionHomeQuestion } from './dwaion-home-question';
import { DwaionHomeSignals, type HomeSignal } from './dwaion-home-signals';

const USER_AGENT_KEYS = new Set([DWAION_AGENT_KEY, DWAION_APPROVAL_EXPERT_AGENT_KEY]);

export function DwaionHome() {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const auth = useAuth();
  const { permissions } = usePermissions();
  const [query, setQuery] = useState('');
  const [launchPending, setLaunchPending] = useState(false);
  const [launchFailed, setLaunchFailed] = useState(false);
  const launching = useRef(false);
  const conversations = useQuery({
    queryKey: ['dwaion', 'conversations'],
    queryFn: getDwaionConversations,
    staleTime: 20_000,
  });
  const work = useQuery({
    queryKey: ['workspace', 'work-queue'],
    queryFn: getWorkspaceWorkQueue,
    staleTime: 30_000,
  });
  const agents = useQuery({
    queryKey: ['dwaion', 'runtime-agents'],
    queryFn: () => listRuntimeRegistryEntries('AGENT'),
    staleTime: 60_000,
  });
  const actions = useQuery({
    queryKey: ['dwaion', 'actions'],
    queryFn: getWorkplaceActions,
    staleTime: 60_000,
  });
  const proposals = useQuery({
    queryKey: ['dwaion', 'proposals', 'ACTIVE', 'home'],
    queryFn: () => getDwaionProposals('ACTIVE', 1),
    staleTime: 20_000,
  });
  const canUseApprovalExpert = isAppResourceEntitled('APP.APPROVALS', permissions);
  const visibleAgents = useMemo(
    () =>
      (agents.data ?? []).filter(
        (agent): agent is RuntimeRegistryEntry & { entryKey: DwaionAgentKey } =>
          USER_AGENT_KEYS.has(agent.entryKey as DwaionAgentKey) &&
          (agent.entryKey !== DWAION_APPROVAL_EXPERT_AGENT_KEY || canUseApprovalExpert)
      ),
    [agents.data, canUseApprovalExpert]
  );
  const priorityWork = useMemo(() => homePriorityWork(work.data?.items ?? []), [work.data?.items]);
  const resources = [work, conversations, proposals, agents, actions];
  const refreshing = resources.some((resource) => resource.isFetching);
  const signals: HomeSignal[] = [
    {
      key: 'priorityWork',
      state: homeLoadState(work),
      value: work.data?.summary.dueSoon ?? 0,
      detail: t('dwaionHome.metrics.priorityWorkDetail'),
    },
    {
      key: 'conversations',
      state: homeLoadState(conversations),
      value: conversations.data?.length ?? 0,
      detail: t('dwaionHome.metrics.conversationsDetail'),
    },
    {
      key: 'proposals',
      state: homeLoadState(proposals),
      value: proposals.data?.summary.active ?? 0,
      detail: t('dwaionHome.metrics.proposalsDetail', {
        count: proposals.data?.summary.highPriority ?? 0,
      }),
    },
    {
      key: 'agents',
      state: homeLoadState(agents),
      value: visibleAgents.length,
      detail: t('dwaionHome.metrics.agentsDetail'),
    },
    {
      key: 'actions',
      state: homeLoadState(actions),
      value: actions.data?.length ?? 0,
      detail: t('dwaionHome.metrics.actionsDetail'),
    },
  ];

  const start = async (value: string, agentKey?: DwaionAgentKey) => {
    if (launching.current) return;
    const normalized = value.trim();
    if (!normalized) {
      navigate(dwaionWorkspaceRoute(undefined, undefined, agentKey));
      return;
    }
    launching.current = true;
    setQuery(normalized);
    setLaunchPending(true);
    setLaunchFailed(false);
    try {
      const receipt = await createQuestionLaunch(normalized);
      const state = createDwaionQuestionLaunchState(receipt.launchId);
      if (!state) throw new Error('Question launch receipt is invalid.');
      navigate(dwaionWorkspaceRoute(undefined, undefined, agentKey), { state });
    } catch {
      setLaunchFailed(true);
    } finally {
      launching.current = false;
      setLaunchPending(false);
    }
  };

  useEffect(() => {
    if (!searchParams.has('q')) return;
    const sanitized = new URLSearchParams(searchParams);
    sanitized.delete('q');
    setSearchParams(sanitized, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <PageCanvas>
      <Box
        data-testid="dwaion-home"
        sx={{ maxWidth: 1480, mx: 'auto', minWidth: 0, overflowWrap: 'anywhere' }}
      >
        <Stack
          component="header"
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          gap={2}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box
                component="img"
                src="/assets/assistants/dwaion-link-v1.png"
                alt=""
                sx={{ width: 28, height: 28, objectFit: 'contain' }}
              />
              <Typography variant="overline" color="primary.main">
                {t('dwaionHome.eyebrow')}
              </Typography>
            </Stack>
            <Typography
              component="h1"
              variant="h4"
              sx={{ mt: 0.6, fontSize: 24, lineHeight: 1.4, fontWeight: 750 }}
            >
              {t('dwaionHome.title', { name: auth.user?.displayName ?? t('dwaionHome.member') })}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {t('dwaionHome.description')}
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ color: 'success.main', maxWidth: 300 }}
          >
            <ShieldCheck size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary">
              {t('dwaionHome.permissionBoundary')}
            </Typography>
          </Stack>
        </Stack>
        <DwaionHomeQuestion
          value={query}
          loading={launchPending}
          failed={launchFailed}
          onChange={(value) => {
            setQuery(value);
            setLaunchFailed(false);
          }}
          onStart={(value) => void start(value)}
        />
        <DwaionHomeSignals
          items={signals}
          refreshing={refreshing}
          verifiedAt={homeVerifiedAt(resources)}
          onRefresh={() => {
            resources.forEach((resource) => {
              void resource.refetch();
            });
          }}
        />
        <DwaionHomeContent
          work={{
            items: priorityWork,
            state: homeLoadState(work),
            retry: () => void work.refetch(),
          }}
          conversations={{
            items: conversations.data ?? [],
            state: homeLoadState(conversations),
            retry: () => void conversations.refetch(),
          }}
          agents={{
            items: visibleAgents,
            state: homeLoadState(agents),
            retry: () => void agents.refetch(),
          }}
          launchPending={launchPending}
          onStartAgent={(key) => void start('', key)}
        />
      </Box>
    </PageCanvas>
  );
}
