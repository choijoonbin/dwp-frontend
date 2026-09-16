import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, EmptyState, ErrorState, LoadingState } from '@dwp-frontend/design-system';
import { listHomeStudioAuditEvents } from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function HomeStudioAuditPanel() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(0);
  const pageSize = 100;
  const auditQuery = useQuery({
    queryKey: ['admin', 'audit-events', 'home-studio', page, pageSize],
    queryFn: () => listHomeStudioAuditEvents(page, pageSize),
    staleTime: 10_000,
  });
  const events = auditQuery.data?.content ?? [];
  const totalPages = auditQuery.data?.totalPages ?? 0;

  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  if (auditQuery.isLoading) {
    return <LoadingState label={t('homeStudio.audit.loading')} variant="skeleton" />;
  }
  if (auditQuery.isError) {
    return (
      <ErrorState
        title={t('homeStudio.audit.loadFailed')}
        retryLabel={t('homeWidgets.controlPlane.retry')}
        retrying={auditQuery.isFetching}
        onRetry={() => void auditQuery.refetch()}
      />
    );
  }
  if (events.length === 0 && page === 0) {
    return (
      <EmptyState
        icon={<ScrollText size={28} />}
        title={t('homeStudio.audit.empty')}
        description={t('homeStudio.audit.emptyDescription')}
      />
    );
  }

  return (
    <Stack gap={2} data-testid="admin-home-audit">
      <Box>
        <Typography component="h2" variant="h5">
          {t('homeStudio.audit.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('homeStudio.audit.description')}
        </Typography>
      </Box>
      <Stack
        component="ol"
        divider={<Divider flexItem />}
        sx={{ listStyle: 'none', p: 0, m: 0, borderBlock: 1, borderColor: 'divider' }}
      >
        {events.map((event) => (
          <Stack component="li" key={event.auditEventId} gap={0.75} sx={{ px: 1, py: 2 }}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle2">{event.action}</Typography>
              <Chip
                size="small"
                color={event.outcome === 'SUCCESS' ? 'success' : 'error'}
                label={event.outcome}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {event.targetType} · {event.targetId}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(event.occurredAt, { dateStyle: 'medium', timeStyle: 'medium' })} ·{' '}
              {event.correlationId ?? t('homeStudio.audit.noCorrelation')}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary" aria-live="polite">
          {t('homeStudio.audit.page', {
            page: page + 1,
            total: Math.max(totalPages, 1),
          })}
        </Typography>
        <Stack direction="row" gap={1}>
          <ActionButton
            intent="quiet"
            size="small"
            disabled={page === 0 || auditQuery.isFetching}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            {t('homeStudio.audit.previousPage')}
          </ActionButton>
          <ActionButton
            intent="quiet"
            size="small"
            disabled={page + 1 >= totalPages || auditQuery.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('homeStudio.audit.nextPage')}
          </ActionButton>
        </Stack>
      </Stack>
    </Stack>
  );
}
