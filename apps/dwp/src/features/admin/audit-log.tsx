import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ScrollText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listIdentityAuditEvents, listPlatformAuditEvents } from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';

import type { GridColDef } from '@mui/x-data-grid';
import type { PlatformAuditEvent } from '@dwp-frontend/shared-utils';

type UnifiedAuditEvent = PlatformAuditEvent & {
  source: 'IDENTITY' | 'PLATFORM';
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatTimestamp(value: string): string {
  return formatDate(value, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

function fallbackAuditAction(action: string): string {
  return action
    .split(/[.-]/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function AuditLog() {
  const { t } = useTranslation('admin');
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('sm'));
  const auditQuery = useQuery({
    queryKey: ['admin', 'audit-events'],
    queryFn: async () => {
      const [platform, identity] = await Promise.all([
        listPlatformAuditEvents(),
        listIdentityAuditEvents(),
      ]);
      return [
        ...platform.content.map((event) => ({ ...event, source: 'PLATFORM' as const })),
        ...identity.content.map((event) => ({ ...event, source: 'IDENTITY' as const })),
      ].sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
    },
  });

  const columns = useMemo<GridColDef<UnifiedAuditEvent>[]>(
    () => [
      {
        field: 'occurredAt',
        headerName: t('audit.columns.time'),
        minWidth: 190,
        flex: 0.9,
        renderCell: ({ row }) => formatTimestamp(row.occurredAt),
      },
      {
        field: 'source',
        headerName: t('audit.columns.source'),
        width: 104,
        renderCell: ({ row }) => (
          <Chip label={t(`audit.sources.${row.source}`)} size="small" variant="outlined" />
        ),
      },
      {
        field: 'action',
        headerName: t('audit.columns.action'),
        minWidth: 200,
        flex: 1,
        renderCell: ({ row }) => (
          <Typography variant="body2" fontWeight={700}>
            {t(`audit.actions.${row.action}`, { defaultValue: fallbackAuditAction(row.action) })}
          </Typography>
        ),
      },
      {
        field: 'targetId',
        headerName: t('audit.columns.target'),
        minWidth: 180,
        flex: 1,
      },
      {
        field: 'actorId',
        headerName: t('audit.columns.actor'),
        width: 116,
        renderCell: ({ row }) =>
          `${t(`audit.actorTypes.${row.actorType}`, { defaultValue: row.actorType })} ${
            row.actorId ?? '—'
          }`,
      },
      {
        field: 'outcome',
        headerName: t('audit.columns.outcome'),
        width: 112,
        renderCell: ({ row }) => (
          <Chip
            label={t(`common.status.${row.outcome}`, { defaultValue: row.outcome })}
            size="small"
            color={row.outcome === 'SUCCESS' ? 'success' : 'error'}
            variant="outlined"
          />
        ),
      },
      {
        field: 'correlationId',
        headerName: t('audit.columns.correlation'),
        minWidth: 180,
        flex: 0.8,
        renderCell: ({ row }) => row.correlationId || '—',
      },
    ],
    [t]
  );

  if (auditQuery.isLoading) return <AdminPanelLoading label={t('audit.loading')} />;
  if (auditQuery.isError) {
    return <AdminPanelError message={errorMessage(auditQuery.error, t('audit.loadError'))} />;
  }

  const events = auditQuery.data ?? [];
  return (
    <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ minHeight: 64, px: 2 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScrollText size={18} strokeWidth={1.8} aria-hidden="true" />
          <Typography component="h2" variant="subtitle1">
            {t('audit.title')}
          </Typography>
          <Chip label={events.length} size="small" variant="outlined" />
        </Box>
        <Tooltip title={t('audit.refresh')}>
          <IconButton aria-label={t('audit.refresh')} onClick={() => void auditQuery.refetch()}>
            <RefreshCw size={18} strokeWidth={1.8} />
          </IconButton>
        </Tooltip>
      </Stack>
      {desktop && (
        <Box>
          <EnterpriseDataGrid
            ariaLabel={t('audit.events')}
            rows={events}
            columns={columns}
            getRowId={(row) => row.auditEventId}
            hideFooter={events.length <= 25}
            initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
            slots={{
              noRowsOverlay: () => (
                <Box sx={{ height: 1, display: 'grid', placeItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('audit.noEvents')}
                  </Typography>
                </Box>
              ),
            }}
            sx={{ border: 0, borderRadius: 0 }}
          />
        </Box>
      )}
      {!desktop && (
        <Box
          component="ol"
          aria-label={t('audit.events')}
          sx={{ display: 'grid', listStyle: 'none', p: 0, m: 0 }}
        >
          {events.length ? (
            events.map((event) => (
              <Box
                component="li"
                key={event.auditEventId}
                sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
              >
                <Stack
                  direction="row"
                  alignItems="flex-start"
                  justifyContent="space-between"
                  gap={2}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="h3" variant="subtitle2">
                      {t(`audit.actions.${event.action}`, {
                        defaultValue: fallbackAuditAction(event.action),
                      })}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.25, overflowWrap: 'anywhere' }}
                    >
                      {event.targetId}
                    </Typography>
                  </Box>
                  <Chip
                    label={t(`common.status.${event.outcome}`, {
                      defaultValue: event.outcome,
                    })}
                    size="small"
                    color={event.outcome === 'SUCCESS' ? 'success' : 'error'}
                    variant="outlined"
                  />
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1 }}
                >
                  {formatTimestamp(event.occurredAt)} / {t(`audit.sources.${event.source}`)} /{' '}
                  {t(`audit.actorTypes.${event.actorType}`, { defaultValue: event.actorType })}{' '}
                  {event.actorId ?? '—'}
                </Typography>
                {event.correlationId && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
                  >
                    {event.correlationId}
                  </Typography>
                )}
              </Box>
            ))
          ) : (
            <Box component="li" sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('audit.noEvents')}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
