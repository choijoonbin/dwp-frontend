import type { Theme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Bot,
  Clock3,
  FileCheck2,
  MessageSquare,
  MessageSquarePlus,
} from 'lucide-react';
import { ActionButton, GuidedEmptyState } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import type {
  DwaionConversationSummary,
  RuntimeRegistryEntry,
  WorkspaceWorkItem,
} from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DWAION_APPROVAL_EXPERT_AGENT_KEY, type DwaionAgentKey } from './dwaion-contract';
import {
  homeIsOverdue,
  homeRecentConversations,
  homeWorkRoute,
  type HomeLoadState,
} from './dwaion-home-model';
import { DwaionHomeResource, DwaionHomeSection, HOME_INTERACTION } from './dwaion-home-surfaces';

type Resource<T> = { items: T[]; state: HomeLoadState; retry: () => void };
type HomeAgent = RuntimeRegistryEntry & { entryKey: DwaionAgentKey };
const ROW_STYLE = {
  ...HOME_INTERACTION,
  display: 'flex',
  width: 1,
  minWidth: 0,
  textAlign: 'left',
  p: 1.75,
  gap: 1.5,
  border: 1,
  borderColor: 'divider',
  borderRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
  bgcolor: 'background.paper',
  color: 'text.primary',
} as const;

export function DwaionHomeContent({
  work,
  conversations,
  agents,
  launchPending,
  onStartAgent,
}: {
  work: Resource<WorkspaceWorkItem>;
  conversations: Resource<DwaionConversationSummary>;
  agents: Resource<HomeAgent>;
  launchPending: boolean;
  onStartAgent: (key: DwaionAgentKey) => void;
}) {
  const { t, i18n } = useTranslation('work');
  const navigate = useNavigate();
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.35fr) minmax(0, 1fr)' },
        gap: 3,
        mt: 3,
        alignItems: 'start',
      }}
    >
      <DwaionHomeSection
        title={t('dwaionHome.work.title')}
        description={t('dwaionHome.work.description')}
        actionLabel={t('dwaionHome.work.open')}
        onAction={() => navigate('/work/queue')}
      >
        <DwaionHomeResource state={work.state} onRetry={work.retry}>
          {work.items.length ? (
            <Stack spacing={1}>
              {work.items.map((item) => {
                const overdue = homeIsOverdue(item, Date.now());
                return (
                  <ButtonBase
                    key={item.id}
                    component={RouterLink}
                    to={homeWorkRoute(item)}
                    sx={{
                      ...ROW_STYLE,
                      alignItems: 'stretch',
                      flexDirection: { xs: 'column', sm: 'row' },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.75}
                        useFlexGap
                        flexWrap="wrap"
                        mb={0.8}
                      >
                        <Chip
                          label={t(`dwaionHome.priority.${item.priority}`)}
                          size="small"
                          color={
                            item.priority === 'high'
                              ? 'error'
                              : item.priority === 'medium'
                                ? 'warning'
                                : 'default'
                          }
                          variant="outlined"
                          sx={{
                            height: 'auto',
                            minHeight: 22,
                            '& .MuiChip-label': { whiteSpace: 'normal', px: 0.75, py: 0.15 },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {item.sourceSystem}
                        </Typography>
                      </Stack>
                      <Typography component="h3" variant="body2" fontWeight="fontWeightBold">
                        {item.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {item.reason || item.summary || item.recommendedNext}
                      </Typography>
                    </Box>
                    <Stack
                      gap={1}
                      alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
                      justifyContent="space-between"
                      sx={{ maxWidth: { sm: 150 }, flexShrink: 0 }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        sx={{ color: overdue ? 'error.main' : 'text.secondary' }}
                      >
                        <Clock3 size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
                        <Typography variant="caption">
                          {item.dueAt
                            ? `${overdue ? `${t('dwaionHome.work.overdue')} · ` : ''}${formatDate(item.dueAt, { month: 'short', day: 'numeric' }, locale)}`
                            : t(`dwaionHome.status.${item.status}`)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} alignItems="center" color="primary.main">
                        <Typography variant="caption" fontWeight="fontWeightBold">
                          {t('dwaionHome.work.review')}
                        </Typography>
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </Stack>
                    </Stack>
                  </ButtonBase>
                );
              })}
            </Stack>
          ) : (
            <GuidedEmptyState
              kind="empty"
              title={t('dwaionHome.work.emptyTitle')}
              description={t('dwaionHome.work.emptyDescription')}
            />
          )}
        </DwaionHomeResource>
      </DwaionHomeSection>
      <Stack spacing={3} sx={{ minWidth: 0 }}>
        <DwaionHomeSection
          title={t('dwaionHome.recent.title')}
          description={t('dwaionHome.recent.description')}
          actionLabel={t('dwaionHome.recent.open')}
          onAction={() => navigate('/dwaion/conversations')}
        >
          <DwaionHomeResource state={conversations.state} onRetry={conversations.retry}>
            {conversations.items.length ? (
              <Stack spacing={1}>
                {homeRecentConversations(conversations.items).map((conversation) => (
                  <ButtonBase
                    key={conversation.conversationId}
                    component={RouterLink}
                    to={`/dwaion/conversations/${encodeURIComponent(conversation.conversationId)}`}
                    sx={ROW_STYLE}
                  >
                    <MessageSquare size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="body2"
                        fontWeight="fontWeightBold"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
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
                    <ArrowUpRight size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                  </ButtonBase>
                ))}
              </Stack>
            ) : (
              <GuidedEmptyState
                kind="empty"
                title={t('dwaionHome.recent.emptyTitle')}
                description={t('dwaionHome.recent.emptyDescription')}
                actionLabel={t('dwaionHome.recent.start')}
                onAction={() => navigate('/dwaion/new')}
              />
            )}
          </DwaionHomeResource>
        </DwaionHomeSection>
        <DwaionHomeSection
          title={t('dwaionHome.agents.title')}
          description={t('dwaionHome.agents.description')}
          actionLabel={t('dwaionHome.agents.open')}
          onAction={() => navigate('/dwaion/agents')}
        >
          <DwaionHomeResource state={agents.state} onRetry={agents.retry}>
            {agents.items.length ? (
              <Stack spacing={1}>
                {agents.items.map((agent) => {
                  const approval = agent.entryKey === DWAION_APPROVAL_EXPERT_AGENT_KEY;
                  const Icon = approval ? FileCheck2 : Bot;
                  return (
                    <Stack
                      key={agent.entryKey}
                      direction="row"
                      alignItems="center"
                      spacing={1.25}
                      sx={{
                        p: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
                        bgcolor: 'background.paper',
                        flexWrap: { xs: 'wrap', sm: 'nowrap' },
                        rowGap: 1,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'grid',
                          placeItems: 'center',
                          width: 36,
                          height: 36,
                          flexShrink: 0,
                          borderRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
                          bgcolor: 'action.hover',
                          color: approval ? 'success.main' : 'primary.main',
                        }}
                      >
                        <Icon size={19} aria-hidden="true" />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: '1 1 120px' }}>
                        <Typography variant="body2" fontWeight="fontWeightBold">
                          {agent.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.3 }}
                        >
                          {agent.description}
                        </Typography>
                      </Box>
                      <ActionButton
                        intent="quiet"
                        size="small"
                        startIcon={<MessageSquarePlus size={14} />}
                        disabled={launchPending}
                        onClick={() => onStartAgent(agent.entryKey)}
                        aria-label={t('dwaionHome.agents.startNamed', { name: agent.name })}
                        sx={{ flexShrink: 0 }}
                      >
                        {t('dwaionHome.agents.start')}
                      </ActionButton>
                    </Stack>
                  );
                })}
              </Stack>
            ) : (
              <GuidedEmptyState
                kind="empty"
                title={t('dwaionHome.agents.emptyTitle')}
                description={t('dwaionHome.agents.emptyDescription')}
              />
            )}
          </DwaionHomeResource>
        </DwaionHomeSection>
      </Stack>
    </Box>
  );
}
