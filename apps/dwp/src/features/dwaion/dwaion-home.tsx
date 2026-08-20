import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  Clock3,
  History,
  ListChecks,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { ActionButton, GuidedEmptyState, PageCanvas } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  getDwaionConversations,
  getWorkspaceWorkQueue,
  getWorkplaceActions,
  isAppResourceEntitled,
  listRuntimeRegistryEntries,
  type RuntimeRegistryEntry,
  useAuth,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DWAION_AGENT_KEY,
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
  dwaionWorkspaceRoute,
  type DwaionAgentKey,
} from './dwaion-contract';
import { DwaionWorkspaceComposer } from './dwaion-workspace-composer';
import { visibleWorkItems } from './dwaion-workspace-model';

const USER_AGENT_KEYS = new Set([DWAION_AGENT_KEY, DWAION_APPROVAL_EXPERT_AGENT_KEY]);

function isDwaionRuntimeAgent(
  agent: RuntimeRegistryEntry
): agent is RuntimeRegistryEntry & { entryKey: DwaionAgentKey } {
  return USER_AGENT_KEYS.has(agent.entryKey as DwaionAgentKey);
}

export function DwaionHome() {
  const { t, i18n } = useTranslation('work');
  const navigate = useNavigate();
  const auth = useAuth();
  const { permissions } = usePermissions();
  const [query, setQuery] = useState('');
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
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const canUseApprovalExpert = isAppResourceEntitled('APP.APPROVALS', permissions);
  const visibleAgents = useMemo(
    () =>
      (agents.data ?? []).filter(
        (agent): agent is RuntimeRegistryEntry & { entryKey: DwaionAgentKey } =>
          isDwaionRuntimeAgent(agent) &&
          (agent.entryKey !== DWAION_APPROVAL_EXPERT_AGENT_KEY || canUseApprovalExpert)
      ),
    [agents.data, canUseApprovalExpert]
  );
  const priorityWork = useMemo(
    () => visibleWorkItems(work.data?.items ?? []).slice(0, 4),
    [work.data?.items]
  );

  const start = (value = query, agentKey?: DwaionAgentKey) => {
    const normalized = value.trim();
    navigate(dwaionWorkspaceRoute(normalized || undefined, undefined, agentKey));
  };

  return (
    <PageCanvas>
      <Box
        component="header"
        sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}
      >
        <Box>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Sparkles size={15} color="var(--dwp-product-accent)" aria-hidden="true" />
            <Typography variant="overline" color="primary.main">
              {t('dwaionHome.eyebrow')}
            </Typography>
          </Stack>
          <Typography component="h1" variant="h4" sx={{ mt: 0.4 }}>
            {t('dwaionHome.title', {
              name: auth.user?.displayName ?? t('dwaionHome.member'),
            })}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {t('dwaionHome.description')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <ShieldCheck size={17} color="var(--dwp-product-secondary)" aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {t('dwaionHome.permissionBoundary')}
          </Typography>
        </Stack>
      </Box>

      <Box component="section" aria-labelledby="dwaion-home-question" sx={{ mt: 3, maxWidth: 980 }}>
        <Typography id="dwaion-home-question" component="h2" variant="h6" fontWeight={850}>
          {t('dwaionHome.askTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, mb: 1.25 }}>
          {t('dwaionHome.askDescription')}
        </Typography>
        <DwaionWorkspaceComposer
          value={query}
          loading={false}
          onChange={setQuery}
          onSubmit={() => start()}
        />
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
          {(['brief', 'blockers', 'meeting'] as const).map((mode) => (
            <ActionButton
              key={mode}
              intent="quiet"
              size="small"
              onClick={() => start(t(`askPage.modes.items.${mode}.prompt`))}
            >
              {t(`askPage.modes.items.${mode}.title`)}
            </ActionButton>
          ))}
        </Stack>
      </Box>

      <Box
        component="section"
        aria-label={t('dwaionHome.signalSummary')}
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        <HomeMetric
          icon={ListChecks}
          label={t('dwaionHome.metrics.priorityWork')}
          value={work.data?.summary.dueSoon ?? 0}
          detail={t('dwaionHome.metrics.priorityWorkDetail')}
        />
        <HomeMetric
          icon={History}
          label={t('dwaionHome.metrics.conversations')}
          value={conversations.data?.length ?? 0}
          detail={t('dwaionHome.metrics.conversationsDetail')}
        />
        <HomeMetric
          icon={Bot}
          label={t('dwaionHome.metrics.agents')}
          value={visibleAgents.length}
          detail={t('dwaionHome.metrics.agentsDetail')}
        />
        <HomeMetric
          icon={ArrowRight}
          label={t('dwaionHome.metrics.actions')}
          value={actions.data?.length ?? 0}
          detail={t('dwaionHome.metrics.actionsDetail')}
        />
      </Box>

      {(work.isError || conversations.isError || agents.isError || actions.isError) && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {t('dwaionHome.partialLoadError')}
        </Alert>
      )}

      <Box
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.25fr) minmax(340px, 0.75fr)' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <HomeSection
          title={t('dwaionHome.work.title')}
          description={t('dwaionHome.work.description')}
          actionLabel={t('dwaionHome.work.open')}
          onAction={() => navigate('/work')}
        >
          {work.isLoading ? (
            <Skeleton variant="rounded" height={260} />
          ) : priorityWork.length ? (
            priorityWork.map((item, index) => (
              <Box key={item.id}>
                {index > 0 && <Divider />}
                <Box
                  component="button"
                  type="button"
                  onClick={() => navigate(item.sourceRoute || `/work?item=${item.id}`)}
                  sx={{
                    width: 1,
                    p: 1.75,
                    border: 0,
                    bgcolor: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" gap={2}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={750} noWrap>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.reason || item.recommendedNext || item.sourceSystem}
                      </Typography>
                    </Box>
                    {item.dueAt && (
                      <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
                        <Clock3 size={14} aria-hidden="true" />
                        <Typography variant="caption">
                          {formatDate(item.dueAt, { month: 'short', day: 'numeric' }, locale)}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Box>
              </Box>
            ))
          ) : (
            <GuidedEmptyState
              kind="empty"
              title={t('dwaionHome.work.emptyTitle')}
              description={t('dwaionHome.work.emptyDescription')}
            />
          )}
        </HomeSection>

        <Stack spacing={3}>
          <HomeSection
            title={t('dwaionHome.recent.title')}
            description={t('dwaionHome.recent.description')}
            actionLabel={t('dwaionHome.recent.open')}
            onAction={() => navigate('/dwaion/conversations')}
          >
            {conversations.isLoading ? (
              <Skeleton variant="rounded" height={180} />
            ) : conversations.data?.length ? (
              conversations.data.slice(0, 4).map((conversation, index) => (
                <Box key={conversation.conversationId}>
                  {index > 0 && <Divider />}
                  <Box
                    component="button"
                    type="button"
                    onClick={() => navigate(`/dwaion/conversations/${conversation.conversationId}`)}
                    sx={{
                      width: 1,
                      p: 1.5,
                      border: 0,
                      bgcolor: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Typography variant="body2" fontWeight={750} noWrap>
                      {conversation.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(
                        conversation.lastMessageAt,
                        { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
                        locale
                      )}
                    </Typography>
                  </Box>
                </Box>
              ))
            ) : (
              <GuidedEmptyState
                kind="empty"
                title={t('dwaionHome.recent.emptyTitle')}
                description={t('dwaionHome.recent.emptyDescription')}
                actionLabel={t('dwaionHome.recent.start')}
                onAction={() => navigate('/dwaion/new')}
              />
            )}
          </HomeSection>

          <HomeSection
            title={t('dwaionHome.agents.title')}
            description={t('dwaionHome.agents.description')}
            actionLabel={t('dwaionHome.agents.open')}
            onAction={() => navigate('/dwaion/agents')}
          >
            {visibleAgents.map((agent, index) => (
              <Box key={agent.entryKey}>
                {index > 0 && <Divider />}
                <Box sx={{ p: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" gap={1.5}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={750} noWrap>
                        {agent.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="p">
                        {agent.description}
                      </Typography>
                    </Box>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      startIcon={<MessageSquarePlus size={15} />}
                      onClick={() => start('', agent.entryKey)}
                    >
                      {t('dwaionHome.agents.start')}
                    </ActionButton>
                  </Stack>
                </Box>
              </Box>
            ))}
          </HomeSection>
        </Stack>
      </Box>
    </PageCanvas>
  );
}

function HomeMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Box sx={{ px: 2, py: 1.75, borderRight: { xs: 0, lg: 1 }, borderColor: 'divider' }}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Icon size={16} color="var(--dwp-product-accent)" aria-hidden="true" />
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Stack>
      <Typography variant="h5" sx={{ mt: 0.6 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Box>
  );
}

function HomeSection({
  title,
  description,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <Box component="section">
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={1.25}>
        <Box>
          <Typography component="h2" variant="h6" fontWeight={850}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {description}
          </Typography>
        </Box>
        <ActionButton
          intent="quiet"
          size="small"
          endIcon={<ArrowRight size={15} />}
          onClick={onAction}
        >
          {actionLabel}
        </ActionButton>
      </Stack>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        {children}
      </Box>
    </Box>
  );
}
