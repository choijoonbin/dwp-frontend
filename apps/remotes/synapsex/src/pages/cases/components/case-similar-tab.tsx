/**
 * Case Similar Tab — API 바인딩
 * @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
 * @see docs/job/PROMPT_FE_CASE_TABS_DEBUG_UX_P11.txt — Debug payload
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useCaseSimilarQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';

import { SYNAPSE_ROUTES } from '../../../routes';
import { useCaseTabsDebug } from '../context/case-tabs-debug-context';
import { TabEmptyState } from '../../../components/ux/tab-empty-state';
import { TabErrorState } from '../../../components/ux/tab-error-state';
import { SeverityBadge } from '../../../components/finance/severity-badge';
import { TabContentSkeleton } from '../../../components/ux/tab-content-skeleton';
import { StatusPill, type Status } from '../../../components/finance/status-pill';

type CaseSimilarTabProps = {
  caseId: string | undefined;
  enabled: boolean;
  tabKey?: string;
};

export const CaseSimilarTab = ({ caseId, enabled, tabKey = 'similar' }: CaseSimilarTabProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const debugCtx = useCaseTabsDebug();
  const { data, isLoading, isError, error, refetch } = useCaseSimilarQuery(caseId, { enabled });

  const setPayload = debugCtx?.setPayload;
  useEffect(() => {
    if (!enabled || !setPayload) return;
    if (isError && error) {
      setPayload(tabKey, {
        status: 'error',
        payload: { message: error instanceof Error ? error.message : String(error) },
        error: error instanceof Error ? error.message : String(error),
      });
    } else if (!isLoading && data !== undefined) {
      setPayload(tabKey, { status: 'success', payload: data });
    }
  }, [enabled, setPayload, isLoading, isError, error, data, tabKey]);

  if (isLoading) {
    return <TabContentSkeleton cards={3} />;
  }

  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <TabErrorState
          title={t('cases.tabs.similar.error.title')}
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
        />
      </Box>
    );
  }

  const items = data?.items ?? data?.cases ?? [];

  if (items.length === 0) {
    const reason = t('cases.tabs.similar.empty.reason.itemsZero');
    return (
      <Box sx={{ p: 2 }}>
        <TabEmptyState
          icon="solar:link-bold-duotone"
          title={t('cases.tabs.similar.empty.title')}
          description={t('cases.tabs.similar.empty.description')}
          reason={reason}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('caseDetail.similarCasesDesc')}
      </Typography>
      <Stack spacing={1.5}>
        {items.map((c) => {
          const id = c.id ?? c.caseId ?? '';
          const caseNumber = c.caseNumber ?? (id ? `CS-${id}` : '');
          const title = c.title ?? caseNumber;
          const similarity = c.similarity ?? 0;
          const status = (c.status ?? '') as Status;

          return (
            <Card
              key={id}
              component={Link}
              to={`${SYNAPSE_ROUTES.CASES}/${id}`}
              sx={{
                textDecoration: 'none',
                cursor: 'pointer',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                transition: 'background-color 0.2s',
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {title}
                      </Typography>
                      {c.severity && (
                        <SeverityBadge
                          severity={c.severity as 'critical' | 'high' | 'medium' | 'low'}
                          size="sm"
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {caseNumber}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {[c.counterparty, c.currency, c.amount != null ? c.amount.toLocaleString() : null]
                        .filter(Boolean)
                        .join(' | ') || '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {similarity}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('caseDetail.similarLabel')}
                    </Typography>
                    {status && (
                      <Box sx={{ mt: 0.5 }}>
                        <StatusPill status={status} size="sm" />
                      </Box>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
};
