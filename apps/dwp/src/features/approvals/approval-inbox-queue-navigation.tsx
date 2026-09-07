import { CalendarClock, ListChecks, ShieldAlert, Siren } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getApprovalTasks } from '@dwp-frontend/shared-utils/api/approval-api';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  APPROVAL_QUEUE_FILTERS,
  approvalQueueCounts,
  parseApprovalQueueFilter,
} from './approval-command-center-model';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { useApprovalQueueClock } from './use-approval-queue-clock';

import type { ApprovalQueueFilter } from './approval-command-center-model';
import type { LucideIcon } from 'lucide-react';

const FILTER_ICONS: Record<ApprovalQueueFilter, LucideIcon> = {
  ALL: ListChecks,
  URGENT: Siren,
  DUE_TODAY: CalendarClock,
  HIGH_RISK: ShieldAlert,
};

export function ApprovalInboxQueueNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('approvals');
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const nowMs = useApprovalQueueClock();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const tasks = useQuery({
    queryKey: ['approvals', 'command-tasks', 'INBOX', ...requestScope.cacheKey],
    queryFn: () => getApprovalTasks('INBOX', requestScope.contextScopeKey),
    enabled: requestScope.ready && location.pathname === '/approvals/inbox',
    staleTime: 20_000,
    retry: 1,
    meta: requestScope.queryMeta,
  });

  if (location.pathname !== '/approvals/inbox') return null;

  const activeFilter = parseApprovalQueueFilter(searchParams.get('queue'));
  const counts =
    tasks.data && !tasks.isError && tasks.failureCount === 0
      ? approvalQueueCounts(tasks.data, nowMs)
      : undefined;

  return (
    <Box
      component="nav"
      aria-label={t('home.commandCenter.queueNavigation')}
      sx={{ mt: 0.4, mb: 0.75, ml: 1.25, pl: 1.25, borderLeft: 1, borderColor: 'divider' }}
    >
      <Stack gap={0.25}>
        {APPROVAL_QUEUE_FILTERS.map((filter) => {
          const Icon = FILTER_ICONS[filter];
          const selected = filter === activeFilter;
          const count = counts?.[filter];
          return (
            <ButtonBase
              key={filter}
              style={{ borderRadius: foundationTokens.radius.surface }}
              aria-pressed={selected}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (filter === 'ALL') next.delete('queue');
                else next.set('queue', filter);
                next.delete('task');
                setSearchParams(next);
                onNavigate?.();
              }}
              sx={{
                width: 1,
                minHeight: 38,
                minWidth: 0,
                px: 1,
                py: 0.6,
                display: 'flex',
                justifyContent: 'flex-start',
                gap: 1,
                color: selected ? 'var(--dwp-product-accent)' : 'text.secondary',
                bgcolor: selected ? 'var(--dwp-product-selection)' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
                '@media (forced-colors: active)': selected
                  ? { outline: '2px solid Highlight', outlineOffset: -2 }
                  : undefined,
              }}
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                {t(`home.commandCenter.filters.${filter}`)}
              </Typography>
              <Box
                component="span"
                style={{ borderRadius: foundationTokens.radius.control }}
                aria-label={
                  count == null
                    ? t('home.commandCenter.countUnavailable')
                    : t('home.commandCenter.filterCount', { count })
                }
                sx={{
                  minWidth: 24,
                  height: 22,
                  px: 0.65,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: selected ? 'primary.main' : 'action.selected',
                  color: selected ? 'primary.contrastText' : 'text.secondary',
                  typography: 'caption',
                  fontWeight: 'fontWeightBold',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {count ?? '–'}
              </Box>
            </ButtonBase>
          );
        })}
      </Stack>
    </Box>
  );
}
