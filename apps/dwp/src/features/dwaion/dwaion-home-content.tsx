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
  ShieldCheck,
} from 'lucide-react';
import { ActionButton, GuidedEmptyState, foundationTokens } from '@dwp-frontend/design-system';
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
  p: { xs: 1.5, md: 1.25 },
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
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          lg: 'minmax(0, 1.75fr) minmax(280px, 0.8fr)',
        },
        gap: { xs: 2, md: 2 },
        mt: { xs: 2.5, md: 3 },
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
                      position: 'relative',
                      overflow: 'hidden',
                      borderColor:
                        item.priority === 'high'
                          ? 'error.light'
                          : item.priority === 'medium'
                            ? 'warning.light'
                            : 'divider',
                      '&::before': {
                        content: '""',
                        display: { xs: 'block', sm: 'none' },
                        position: 'absolute',
                        inset: '0 auto 0 0',
                        width: 4,
                        bgcolor:
                          item.priority === 'high'
                            ? 'error.main'
                            : item.priority === 'medium'
                              ? 'warning.main'
                              : 'divider',
                      },
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
                        {item.sourceReference && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: { xs: 'none', md: 'block' } }}
                          >
                            {item.sourceReference}
                          </Typography>
                        )}
                        {item.dataClassification && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={item.dataClassification}
                            sx={{
                              display: { xs: 'none', md: 'inline-flex' },
                              height: 20,
                              '& .MuiChip-label': { px: 0.65, fontSize: 'overline.fontSize' },
                            }}
                          />
                        )}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: { xs: 'none', md: 'block' } }}
                        >
                          {item.owner}
                        </Typography>
                      </Stack>
                      <Typography component="h3" variant="body2" fontWeight="fontWeightBold">
                        {item.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: { xs: 'none', sm: 'block' }, mt: 0.5 }}
                      >
                        {item.reason || item.summary || item.recommendedNext}
                      </Typography>
                    </Box>
                    <Stack
                      direction={{ xs: 'row', sm: 'column' }}
                      gap={1}
                      alignItems={{ xs: 'center', sm: 'flex-end' }}
                      justifyContent="space-between"
                      sx={{ width: { xs: 1, sm: 'auto' }, maxWidth: { sm: 150 }, flexShrink: 0 }}
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
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <DwaionHomeSection
          title={t('dwaionHome.recent.title')}
          description={t('dwaionHome.recent.description')}
          actionLabel={t('dwaionHome.recent.open')}
          onAction={() => navigate('/dwaion/conversations')}
        >
          <DwaionHomeResource state={conversations.state} onRetry={conversations.retry}>
            {conversations.items.length ? (
              <Stack spacing={1}>
                {homeRecentConversations(conversations.items).map((conversation, index) => (
                  <ButtonBase
                    key={conversation.conversationId}
                    component={RouterLink}
                    to={`/dwaion/conversations/${encodeURIComponent(conversation.conversationId)}`}
                    sx={{
                      ...ROW_STYLE,
                      display: { xs: index > 1 ? 'none' : 'flex', md: 'flex' },
                    }}
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
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.35 }}
                      >
                        {t('dwaionHome.recent.messageEvidence', {
                          messages: conversation.messageCount,
                          evidence: conversation.evidenceCount,
                        })}
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
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'minmax(0, 1fr)' },
                  gap: 1,
                }}
              >
                {agents.items.map((agent) => {
                  const approval = agent.entryKey === DWAION_APPROVAL_EXPERT_AGENT_KEY;
                  const Icon = approval ? FileCheck2 : Bot;
                  return (
                    <Stack
                      key={agent.entryKey}
                      direction="row"
                      alignItems="flex-start"
                      spacing={1.25}
                      sx={{
                        p: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
                        bgcolor: 'background.paper',
                        flexWrap: 'wrap',
                        rowGap: 1,
                        minWidth: 0,
                        position: 'relative',
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
                        <Stack
                          direction="row"
                          gap={0.65}
                          useFlexGap
                          flexWrap="wrap"
                          sx={{ mt: 0.65, display: { xs: 'none', md: 'flex' } }}
                        >
                          <Chip
                            size="small"
                            variant="outlined"
                            label={agent.riskTier}
                            sx={{
                              height: 20,
                              '& .MuiChip-label': { px: 0.65, fontSize: 'overline.fontSize' },
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {agent.artifactVersion}
                          </Typography>
                        </Stack>
                      </Box>
                      <ActionButton
                        intent="quiet"
                        size="small"
                        startIcon={<MessageSquarePlus size={14} />}
                        disabled={launchPending}
                        onClick={() => onStartAgent(agent.entryKey)}
                        aria-label={t('dwaionHome.agents.startNamed', { name: agent.name })}
                        sx={{
                          flexShrink: 0,
                          width: { md: '100%' },
                          border: { md: 1 },
                          borderColor: 'divider',
                          '@media (max-width: 599.95px)': {
                            position: 'absolute',
                            inset: 0,
                            minWidth: 0,
                            opacity: 0,
                          },
                        }}
                      >
                        {t('dwaionHome.agents.start')}
                      </ActionButton>
                    </Stack>
                  );
                })}
              </Box>
            ) : (
              <GuidedEmptyState
                kind="empty"
                title={t('dwaionHome.agents.emptyTitle')}
                description={t('dwaionHome.agents.emptyDescription')}
              />
            )}
          </DwaionHomeResource>
        </DwaionHomeSection>
        <Box
          component="section"
          sx={{
            p: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: foundationTokens.radius.surface + 'px',
          }}
        >
          <Stack direction="row" gap={0.75} alignItems="center">
            <ShieldCheck size={16} aria-hidden="true" color="var(--mui-palette-success-main)" />
            <Typography component="h2" variant="subtitle2">
              {t('dwaionStudio.trustTitle')}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {t('askPage.evidence.privacy')}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
