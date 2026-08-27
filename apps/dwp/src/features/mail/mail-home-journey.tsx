import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  CircleAlert,
  Clock3,
  Inbox,
  ListFilter,
  MessageCircleReply,
  Sparkles,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MailHome, MailOrganization } from '@dwp-frontend/shared-utils';

const FLOW_TONES = ['#176B63', '#B4233F', '#B66A0A', '#5267A8', '#7C3AED'] as const;

export function MailDailyFlow({
  metrics,
  onNavigate,
}: {
  metrics: MailHome['metrics'];
  onNavigate: (path: string) => void;
}) {
  const { t } = useTranslation('mail');
  const items = [
    {
      key: 'unread',
      value: metrics.unread,
      icon: Inbox,
      path: '/mail/inbox',
    },
    {
      key: 'urgent',
      value: metrics.urgent,
      icon: CircleAlert,
      path: '/mail/inbox?lane=PRIORITY',
    },
    {
      key: 'needsReply',
      value: metrics.needsReply,
      icon: MessageCircleReply,
      path: '/mail/inbox?lane=NEEDS_REPLY',
    },
    {
      key: 'snoozed',
      value: metrics.snoozed,
      icon: Clock3,
      path: '/mail/inbox',
    },
    {
      key: 'assistant',
      value: metrics.activeProposals,
      icon: Sparkles,
      path: '/mail/home#mail-assistant-title',
    },
  ] as const;
  const attention = metrics.urgent + metrics.needsReply;
  const maximum = Math.max(1, ...items.map((item) => item.value));

  return (
    <Box
      component="section"
      aria-labelledby="mail-daily-flow-title"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(260px, .8fr) minmax(0, 1.4fr)' },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          p: { xs: 2.25, md: 3 },
          bgcolor: 'rgba(23, 107, 99, 0.055)',
          borderRight: { lg: 1 },
          borderBottom: { xs: 1, lg: 0 },
          borderColor: 'divider',
        }}
      >
        <Chip
          size="small"
          icon={<Sparkles size={14} />}
          label={t('home.journey.badge')}
          variant="outlined"
        />
        <Typography
          id="mail-daily-flow-title"
          component="h2"
          variant="h5"
          fontWeight={850}
          sx={{ mt: 1.75, maxWidth: 360, lineHeight: 1.35 }}
        >
          {attention
            ? t('home.journey.attentionTitle', { count: attention })
            : t('home.journey.clearTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 420 }}>
          {t('home.journey.description')}
        </Typography>
        <ActionButton
          intent="primary"
          size="small"
          endIcon={<ArrowRight size={15} />}
          sx={{ mt: 2.25 }}
          onClick={() => onNavigate(attention ? '/mail/inbox?lane=NEEDS_REPLY' : '/mail/inbox')}
        >
          {attention ? t('home.journey.start') : t('home.journey.openInbox')}
        </ActionButton>
      </Box>

      <Box sx={{ p: { xs: 2.25, md: 3 }, minWidth: 0 }}>
        <Typography variant="subtitle2" fontWeight={800}>
          {t('home.journey.flowTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('home.journey.flowDescription')}
        </Typography>
        <Box
          sx={{
            mt: 2.25,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(5, minmax(0, 1fr))' },
            gap: { xs: 1.5, sm: 0 },
          }}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <Box
                key={item.key}
                component="button"
                type="button"
                onClick={() => onNavigate(item.path)}
                sx={{
                  appearance: 'none',
                  border: 0,
                  borderLeft: { sm: index ? 1 : 0 },
                  borderColor: 'divider',
                  bgcolor: 'transparent',
                  color: 'text.primary',
                  textAlign: 'left',
                  px: { xs: 0, sm: 2 },
                  py: 0.5,
                  minWidth: 0,
                  cursor: 'pointer',
                  '&:hover .mail-flow-label': { color: 'primary.main' },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: 3,
                  },
                }}
              >
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Icon size={16} color={FLOW_TONES[index]} />
                  <Typography className="mail-flow-label" variant="caption" fontWeight={750}>
                    {t(`home.metrics.${item.key}`)}
                  </Typography>
                </Stack>
                <Typography variant="h4" fontWeight={850} sx={{ mt: 0.75 }}>
                  {item.value}
                </Typography>
                <Box sx={{ height: 5, bgcolor: 'action.hover', mt: 1.25, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: `${Math.max(item.value ? 10 : 0, (item.value / maximum) * 100)}%`,
                      height: 1,
                      bgcolor: FLOW_TONES[index],
                      transition: 'width 240ms ease-out',
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

export function MailAutomationRhythm({
  organization,
  onOpen,
}: {
  organization?: MailOrganization;
  onOpen: () => void;
}) {
  const { t } = useTranslation('mail');
  const folders = organization?.folders.filter((item) => item.folderType === 'CUSTOM') ?? [];
  const rules = organization?.rules ?? [];
  const enabledRules = rules.filter((item) => item.enabled);
  const latestRun = organization?.recentRuns[0];

  return (
    <Box component="section" aria-labelledby="mail-automation-rhythm-title">
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={1.25}>
        <Box>
          <Typography
            id="mail-automation-rhythm-title"
            component="h2"
            variant="h6"
            fontWeight={800}
          >
            {t('home.automation.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {t('home.automation.description')}
          </Typography>
        </Box>
        <ActionButton
          intent="quiet"
          size="small"
          endIcon={<ArrowRight size={15} />}
          onClick={onOpen}
        >
          {t('home.automation.manage')}
        </ActionButton>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <RhythmItem
          icon={<ListFilter size={17} />}
          label={t('home.automation.activeRules')}
          value={enabledRules.length}
          detail={t('home.automation.activeRulesDetail')}
        />
        <RhythmItem
          icon={<Inbox size={17} />}
          label={t('home.automation.personalFolders')}
          value={folders.length}
          detail={t('home.automation.personalFoldersDetail')}
        />
        <RhythmItem
          icon={<Sparkles size={17} />}
          label={t('home.automation.latestRun')}
          value={latestRun?.changedCount ?? 0}
          detail={
            latestRun
              ? t('home.automation.latestRunDetail', { count: latestRun.matchedCount })
              : t('home.automation.neverRun')
          }
        />
      </Box>
    </Box>
  );
}

function RhythmItem({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderLeft: { md: 1 },
        borderTop: { xs: 1, md: 0 },
        borderColor: 'divider',
        '&:first-of-type': { borderLeft: 0, borderTop: 0 },
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" color="text.secondary">
        {icon}
        <Typography variant="caption" fontWeight={750}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="h5" fontWeight={850} sx={{ mt: 0.75 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Box>
  );
}
