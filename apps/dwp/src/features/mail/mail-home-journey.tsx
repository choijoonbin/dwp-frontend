import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Inbox,
  MessageCircleReply,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import type { MailHome } from '@dwp-frontend/shared-utils';

const COMPACT_RADIUS = `${foundationTokens.radius.compact}px`;

const FLOW_TONES = ['success', 'error', 'warning', 'info', 'primary'] as const;

export function MailDailyFlow({
  metrics,
  accounts,
  generatedAt,
  onNavigate,
}: {
  metrics: MailHome['metrics'];
  accounts: MailHome['accounts'];
  generatedAt: string;
  onNavigate: (path: string) => void;
}) {
  const { t, i18n } = useTranslation('mail');
  const theme = useTheme();
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
      path: '/mail/inbox?state=SNOOZED',
    },
    {
      key: 'assistant',
      value: metrics.activeProposals,
      icon: Sparkles,
      path: '/mail/home#mail-assistant-title',
    },
  ] as const;
  const attention = metrics.urgent + metrics.needsReply;
  const attentionPath = metrics.needsReply
    ? '/mail/inbox?lane=NEEDS_REPLY'
    : '/mail/inbox?lane=PRIORITY';
  const unhealthyAccounts = accounts.filter(
    (account) => account.connectionState !== 'ACTIVE' || account.synchronizationState === 'DEGRADED'
  ).length;

  return (
    <Box component="section" aria-labelledby="mail-daily-flow-title" sx={{ minWidth: 0 }}>
      <Box
        sx={(theme) => ({
          px: { xs: 1.5, md: 2 },
          py: { xs: 1.35, md: 1.5 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'auto minmax(0, 1fr) auto' },
          gap: { xs: 1.25, md: 1.5 },
          alignItems: 'center',
          border: 1,
          borderColor: alpha(theme.palette.primary.main, 0.2),
          borderRadius: COMPACT_RADIUS,
          bgcolor: alpha(theme.palette.primary.main, 0.045),
        })}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            display: 'grid',
            placeItems: 'center',
            borderRadius: COMPACT_RADIUS,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          <Sparkles size={18} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography
              id="mail-daily-flow-title"
              component="h2"
              variant="subtitle2"
              fontWeight="fontWeightBold"
            >
              {attention
                ? t('home.journey.attentionTitle', { count: attention })
                : t('home.journey.clearTitle')}
            </Typography>
            <Chip
              size="small"
              icon={unhealthyAccounts ? <TriangleAlert size={13} /> : <CheckCircle2 size={13} />}
              color={unhealthyAccounts ? 'warning' : 'success'}
              variant="outlined"
              label={
                unhealthyAccounts
                  ? t('home.journey.accountWarning', { count: unhealthyAccounts })
                  : t('home.journey.accountHealthy')
              }
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
            {t('home.journey.description')}{' '}
            <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
              ·{' '}
              {t('home.journey.updatedAt', {
                value: formatDate(
                  generatedAt,
                  { dateStyle: 'medium', timeStyle: 'short' },
                  resolveSupportedLocale(i18n.resolvedLanguage ?? i18n.language)
                ),
              })}
            </Box>
          </Typography>
        </Box>
        <ActionButton
          intent="primary"
          size="small"
          endIcon={<ArrowRight size={15} />}
          onClick={() => onNavigate(attention ? attentionPath : '/mail/inbox')}
        >
          {attention ? t('home.journey.start') : t('home.journey.openInbox')}
        </ActionButton>
      </Box>

      <Box
        aria-label={t('home.signalSummary')}
        sx={{
          mt: 1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(5, minmax(0, 1fr))' },
          gap: 0.75,
          '@media (min-width: 390px) and (max-width: 899.95px)': {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          },
        }}
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          const proposal = item.key === 'assistant';
          const palette = theme.palette[FLOW_TONES[index]];
          const tone = theme.palette.mode === 'dark' ? palette.light : palette.dark;
          return (
            <Box
              key={item.key}
              component="button"
              type="button"
              onClick={() => onNavigate(item.path)}
              sx={(theme) => ({
                appearance: 'none',
                border: 1,
                borderColor: proposal ? alpha(theme.palette.primary.main, 0.22) : alpha(tone, 0.16),
                borderRadius: COMPACT_RADIUS,
                bgcolor: proposal
                  ? alpha(theme.palette.primary.main, 0.055)
                  : theme.palette.background.paper,
                color: 'text.primary',
                textAlign: 'left',
                px: 1.35,
                py: 1.05,
                minHeight: 64,
                minWidth: 0,
                cursor: 'pointer',
                boxShadow: 'none',
                transition: theme.transitions.create([
                  'background-color',
                  'border-color',
                  'box-shadow',
                ]),
                '&:hover': {
                  bgcolor: proposal
                    ? alpha(theme.palette.primary.main, 0.085)
                    : theme.palette.action.hover,
                  borderColor: proposal ? theme.palette.primary.main : alpha(tone, 0.34),
                  boxShadow: 'none',
                },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: 2,
                },
                '@media (min-width: 390px) and (max-width: 899.95px)': {
                  gridColumn: index === items.length - 1 ? '1 / -1' : 'auto',
                },
              })}
            >
              {proposal ? (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: COMPACT_RADIUS,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={17} />
                  </Box>
                  <SignalContent
                    eyebrow={t(`home.metricEyebrows.${item.key}`)}
                    label={t(`home.metrics.${item.key}`)}
                    value={item.value}
                    tone={tone}
                  />
                </Stack>
              ) : (
                <SignalContent
                  eyebrow={t(`home.metricEyebrows.${item.key}`)}
                  label={t(`home.metrics.${item.key}`)}
                  value={item.value}
                  tone={tone}
                  dot
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function SignalContent({
  eyebrow,
  label,
  value,
  tone,
  dot = false,
}: {
  eyebrow: string;
  label: string;
  value: number;
  tone: string;
  dot?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Stack direction="row" spacing={0.55} alignItems="center">
        {dot && (
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tone, flexShrink: 0 }} />
        )}
        <Typography
          component="span"
          sx={{
            color: tone,
            fontSize: 'caption.fontSize',
            lineHeight: 'body2.lineHeight',
            fontWeight: 'fontWeightBold',
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </Typography>
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        justifyContent="space-between"
        alignItems="baseline"
        mt={0.45}
      >
        <Typography variant="body2" fontWeight="fontWeightBold" noWrap>
          {label}
        </Typography>
        <Typography component="span" variant="subtitle1" fontWeight="fontWeightBold" color={tone}>
          {value}
        </Typography>
      </Stack>
    </Box>
  );
}
