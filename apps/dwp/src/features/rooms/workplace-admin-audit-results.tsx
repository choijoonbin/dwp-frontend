import { cloneElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { foundationTokens, EmptyState } from '@dwp-frontend/design-system';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { OperationsPagination, ResultSkeleton } from './workplace-operations-ui';
import { WorkplaceOperationJsonDetails } from './workplace-operation-json-details';
import type { WorkplaceAuditEvent, WorkplaceAuditEventPage } from '@dwp-frontend/shared-utils';

type AuditRenderSlots = Record<
  'desktopAction' | 'mobileAction' | 'desktopCorrelation' | 'mobileCorrelation',
  ReactElement<{ children?: ReactNode }>
>;

export function AuditResults({
  data,
  loading,
  mobile,
  page,
  size,
  formatInstant,
  slots,
  onPage,
  onSize,
}: {
  data?: WorkplaceAuditEventPage;
  loading: boolean;
  mobile: boolean;
  page: number;
  size: number;
  formatInstant: (value: string) => string;
  slots: AuditRenderSlots;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const { t } = useTranslation('rooms');
  if (loading && !data) return <ResultSkeleton />;
  if (!data?.content.length) {
    return (
      <EmptyState
        size="standard"
        icon={<ShieldCheck size={28} />}
        title={t('workplace.admin.operations.audit.empty')}
        description={t('workplace.admin.operations.audit.emptyDescription')}
      />
    );
  }
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.control + 'px',
        overflow: 'hidden',
      }}
    >
      {mobile ? (
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {data.content.map((event) => (
            <AuditMobileRow
              key={event.auditEventId}
              event={event}
              formatInstant={formatInstant}
              slots={slots}
            />
          ))}
        </Stack>
      ) : (
        <TableContainer>
          <Table size="small" aria-label={t('workplace.admin.operations.audit.tableLabel')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('workplace.admin.operations.audit.occurredAt')}</TableCell>
                <TableCell>{t('workplace.admin.operations.audit.action')}</TableCell>
                <TableCell>{t('workplace.admin.operations.audit.aggregate')}</TableCell>
                <TableCell>{t('workplace.admin.operations.audit.actor')}</TableCell>
                <TableCell>{t('workplace.admin.operations.audit.correlation')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.content.map((event) => (
                <TableRow key={event.auditEventId} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatInstant(event.occurredAt)}
                  </TableCell>
                  <TableCell sx={{ overflowWrap: 'anywhere' }}>
                    {cloneElement(slots.desktopAction, undefined, event.action)}
                    <WorkplaceOperationJsonDetails
                      snapshot={event.snapshot}
                      label={t('workplace.admin.operations.audit.details')}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{event.aggregateType}</Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {event.aggregateId ?? '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>#{event.actorUserId}</TableCell>
                  {cloneElement(slots.desktopCorrelation, undefined, event.correlationId ?? '-')}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <OperationsPagination
        count={data.totalElements}
        page={page}
        size={size}
        onPage={onPage}
        onSize={onSize}
      />
    </Box>
  );
}

function AuditMobileRow({
  event,
  formatInstant,
  slots,
}: {
  event: WorkplaceAuditEvent;
  formatInstant: (value: string) => string;
  slots: AuditRenderSlots;
}) {
  const { t } = useTranslation('rooms');
  return (
    <Box sx={{ p: 2, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {formatInstant(event.occurredAt)}
      </Typography>
      {cloneElement(slots.mobileAction, undefined, event.action)}
      <Typography variant="body2" sx={{ mt: 1 }}>
        {event.aggregateType} · {event.aggregateId ?? '-'}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        {t('workplace.admin.operations.audit.actorValue', { actor: event.actorUserId })}
      </Typography>
      {cloneElement(
        slots.mobileCorrelation,
        undefined,
        t('workplace.admin.operations.audit.correlationValue', {
          correlation: event.correlationId ?? '-',
        })
      )}
      <WorkplaceOperationJsonDetails
        snapshot={event.snapshot}
        label={t('workplace.admin.operations.audit.details')}
      />
    </Box>
  );
}
