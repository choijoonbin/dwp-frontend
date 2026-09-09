import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Bot,
  History,
  Inbox,
  ListChecks,
  RefreshCw,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { ActionButton, LoadingState } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HOME_INTERACTION } from './dwaion-home-surfaces';
import type { HomeLoadState } from './dwaion-home-model';

export type HomeSignal = {
  key: 'priorityWork' | 'conversations' | 'proposals' | 'agents' | 'actions';
  state: HomeLoadState;
  value: number;
  detail: string;
};

const SIGNALS: Record<HomeSignal['key'], { icon: LucideIcon; color: string; route: string }> = {
  priorityWork: { icon: ListChecks, color: 'warning.main', route: '/work/queue' },
  conversations: { icon: History, color: 'text.secondary', route: '/dwaion/conversations' },
  proposals: { icon: Inbox, color: 'primary.main', route: '/dwaion/proposals' },
  agents: { icon: Bot, color: 'info.main', route: '/dwaion/agents' },
  actions: { icon: Workflow, color: 'success.main', route: '/dwaion/actions' },
};

export function DwaionHomeSignals({
  items,
  refreshing,
  verifiedAt,
  onRefresh,
}: {
  items: HomeSignal[];
  refreshing: boolean;
  verifiedAt: number | null;
  onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const failed = items.filter((item) => item.state === 'error');
  const available = items.filter((item) => item.state === 'ready').length;
  return (
    <Box
      component="section"
      aria-label={t('dwaionHome.signalSummary')}
      sx={{ mt: { xs: 1.5, md: 2.5 }, minWidth: 0 }}
    >
      <Box
        sx={{
          display: { xs: 'flex', md: 'grid' },
          gridTemplateColumns: {
            md: 'repeat(5, minmax(0, 1fr))',
          },
          gap: { xs: 0.75, md: 1.5 },
          overflowX: { xs: 'auto', md: 'visible' },
          mx: { xs: -2, md: 0 },
          px: { xs: 2, md: 0 },
          pb: { xs: 0.25, md: 0 },
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {items.map((item) => {
          const { icon: Icon, color, route } = SIGNALS[item.key];
          const emphasis = item.key === 'proposals' && item.state === 'ready' && item.value > 0;
          return (
            <ButtonBase
              component={RouterLink}
              to={route}
              key={item.key}
              data-testid={`dwaion-signal-${item.key}`}
              aria-busy={item.state === 'loading'}
              sx={{
                ...HOME_INTERACTION,
                minWidth: 0,
                flex: { xs: '0 0 auto', md: 'initial' },
                display: { xs: 'flex', md: 'block' },
                alignItems: 'center',
                gap: { xs: 0.75, md: 0 },
                textAlign: 'left',
                p: { xs: '7px 10px', md: 1.75 },
                border: 1,
                borderColor: emphasis ? 'primary.main' : 'divider',
                borderRadius: (theme) => ({
                  xs: Number(theme.shape.borderRadius) * 1.5 + 'px',
                  md: Number(theme.shape.borderRadius) * 1 + 'px',
                }),
                bgcolor: emphasis ? 'var(--dwp-product-soft)' : 'background.paper',
                color: 'text.primary',
                minHeight: { xs: 36, md: 112 },
                whiteSpace: { xs: 'nowrap', md: 'normal' },
                '&:hover': {
                  bgcolor: 'action.hover',
                  borderColor: 'primary.main',
                  transform: 'translateY(-2px)',
                  boxShadow: (theme) => theme.shadows[1],
                },
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                  '&:hover': { transform: 'none' },
                },
              }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color, minWidth: 0 }}>
                <Box
                  aria-hidden="true"
                  sx={{
                    display: { xs: 'block', md: 'none' },
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'currentColor',
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ display: { xs: 'none', md: 'contents' } }}>
                  <Icon size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                </Box>
                <Typography variant="caption" fontWeight="fontWeightBold" sx={{ flex: 1 }}>
                  {t(`dwaionHome.metrics.${item.key}`)}
                </Typography>
                <Box sx={{ display: { xs: 'none', md: 'contents' } }}>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Box>
              </Stack>
              <Typography
                component="div"
                sx={{
                  fontSize: (theme) => ({ xs: 14, md: theme.typography.h4.fontSize }),
                  lineHeight: (theme) => ({ xs: 1.2, md: theme.typography.h4.lineHeight }),
                  fontWeight: 'fontWeightBold',
                  mt: { xs: 0, md: 1 },
                  color: emphasis ? 'primary.main' : 'text.primary',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {item.state === 'loading' ? (
                  <Box sx={{ width: 40 }}>
                    <LoadingState
                      embedded
                      variant="skeleton"
                      skeletonRows={1}
                      skeletonHeight={32}
                      label={t('dwaionHome.loading')}
                    />
                  </Box>
                ) : item.state === 'error' ? (
                  <span aria-label={t('dwaionHome.unavailable')}>-</span>
                ) : (
                  item.value
                )}
              </Typography>
              <Typography
                variant="caption"
                color={item.state === 'error' ? 'warning.main' : 'text.secondary'}
                sx={{ display: { xs: 'none', md: 'block' }, mt: 0.5 }}
              >
                {item.state === 'loading'
                  ? t('dwaionHome.loading')
                  : item.state === 'error'
                    ? t('dwaionHome.unavailable')
                    : item.detail}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        gap={1}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{
          display: { xs: 'none', md: 'flex' },
          mt: 2,
          px: 1.5,
          py: 1,
          bgcolor: 'action.hover',
          borderBlock: 1,
          borderColor: 'divider',
          minHeight: 48,
        }}
      >
        <Stack
          role="status"
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ minWidth: 0, flex: 1 }}
        >
          <Activity size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
          <Typography variant="caption" color={failed.length ? 'warning.main' : 'text.secondary'}>
            {refreshing
              ? t('dwaionHome.sync.refreshing')
              : failed.length
                ? t('dwaionHome.sync.partial', {
                    sources: failed.map((item) => t(`dwaionHome.metrics.${item.key}`)).join(', '),
                  })
                : t('dwaionHome.sync.ready', { count: available })}
          </Typography>
        </Stack>
        <Stack
          direction="row"
          gap={1}
          alignItems="center"
          justifyContent="space-between"
          flexShrink={0}
        >
          {verifiedAt && (
            <Typography variant="caption" color="text.secondary">
              {t('dwaionHome.sync.verifiedAt', {
                time: formatDate(
                  new Date(verifiedAt),
                  { hour: '2-digit', minute: '2-digit' },
                  locale
                ),
              })}
            </Typography>
          )}
          <ActionButton
            intent="quiet"
            size="small"
            disabled={refreshing}
            loading={refreshing}
            loadingLabel={t('dwaionHome.sync.refreshing')}
            onClick={onRefresh}
            startIcon={<RefreshCw size={14} />}
          >
            {t('dwaionHome.sync.refresh')}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}
