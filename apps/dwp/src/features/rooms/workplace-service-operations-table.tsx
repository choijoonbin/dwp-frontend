import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, FormField } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard } from './workplace-member-surfaces';
import { workplaceServiceReference } from './workplace-services-ui-model';

import type { WorkplaceServiceOrder } from '@dwp-frontend/shared-utils';
import type { WorkplaceServiceFulfillmentSort } from './workplace-services-ui-model';

type SortDirection = 'asc' | 'desc';

function primaryTask(order: WorkplaceServiceOrder) {
  return [...order.tasks].sort((left, right) => left.dueAt.localeCompare(right.dueAt))[0] ?? null;
}

function sortValue(
  order: WorkplaceServiceOrder,
  sort: WorkplaceServiceFulfillmentSort,
  korean: boolean
) {
  const task = primaryTask(order);
  if (sort === 'reservation') return order.reservationStartsAt;
  if (sort === 'service') {
    const line = order.lines[0];
    return line ? (korean ? line.nameKo : line.nameEn) : '';
  }
  if (sort === 'provider') return task?.providerCode ?? '';
  if (sort === 'assignee') return task?.assigneeDisplayName ?? '';
  if (sort === 'state') return order.state;
  return task?.dueAt ?? '9999';
}

function searchableText(order: WorkplaceServiceOrder) {
  return [
    order.reservationId,
    order.siteReference,
    order.resourceReference,
    order.state,
    order.reservationImpact,
    ...order.lines.flatMap((line) => [
      line.nameKo,
      line.nameEn,
      line.serviceCode,
      line.providerCode,
    ]),
    ...order.tasks.flatMap((task) => [
      task.providerCode,
      task.assigneeDisplayName,
      task.assigneeSecondaryLabel,
      task.blockerCode,
      task.externalFulfillmentReference,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

const columns: readonly Readonly<{
  key: WorkplaceServiceFulfillmentSort;
  label: string;
}>[] = [
  { key: 'sla', label: 'sla' },
  { key: 'reservation', label: 'reservation' },
  { key: 'service', label: 'service' },
  { key: 'provider', label: 'provider' },
  { key: 'assignee', label: 'assignee' },
  { key: 'state', label: 'state' },
];

export function WorkplaceServiceOperationsTable({
  orders,
  selectedId,
  query,
  sort,
  direction,
  onQuery,
  onSort,
  onSelect,
}: {
  orders: readonly WorkplaceServiceOrder[];
  selectedId: string | null;
  query: string;
  sort: WorkplaceServiceFulfillmentSort;
  direction: SortDirection;
  onQuery: (value: string) => void;
  onSort: (value: WorkplaceServiceFulfillmentSort, direction: SortDirection) => void;
  onSelect: (orderId: string, trigger: HTMLButtonElement) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const korean = locale === 'ko';
  const visible = useMemo(() => {
    const normalized = query.toLocaleLowerCase();
    return orders
      .filter((order) => !normalized || searchableText(order).includes(normalized))
      .map((order, index) => ({ order, index }))
      .sort((left, right) => {
        const comparison = sortValue(left.order, sort, korean).localeCompare(
          sortValue(right.order, sort, korean),
          locale
        );
        return (comparison || left.index - right.index) * (direction === 'asc' ? 1 : -1);
      })
      .map(({ order }) => order);
  }, [direction, korean, locale, orders, query, sort]);

  return (
    <Box sx={{ display: { xs: 'none', lg: 'block' }, minWidth: 0 }}>
      <FormField
        label={t('workplace.services.extensions.operationsSearch')}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        inputProps={{ maxLength: 120 }}
        slotProps={{ input: { startAdornment: <Search size={16} aria-hidden="true" /> } }}
        sx={{ mb: 1.25, maxWidth: 420 }}
      />
      <TableContainer sx={(theme) => ({ ...workplaceMemberCard(theme), overflowX: 'auto' })}>
        <Table size="small" aria-label={t('workplace.services.extensions.operationsTable')}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.key} sortDirection={sort === column.key ? direction : false}>
                  <ActionButton
                    intent="quiet"
                    size="small"
                    endIcon={
                      sort === column.key ? (
                        direction === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : undefined
                    }
                    onClick={() =>
                      onSort(
                        column.key,
                        sort === column.key && direction === 'asc' ? 'desc' : 'asc'
                      )
                    }
                  >
                    {t(`workplace.services.extensions.operationsColumns.${column.label}`)}
                  </ActionButton>
                </TableCell>
              ))}
              <TableCell>{t('workplace.services.extensions.operationsColumns.blocker')}</TableCell>
              <TableCell>{t('workplace.services.extensions.operationsColumns.impact')}</TableCell>
              <TableCell>{t('workplace.services.extensions.operationsColumns.external')}</TableCell>
              <TableCell align="right">
                {t('workplace.services.extensions.operationsColumns.action')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((order) => {
              const task = primaryTask(order);
              const line = order.lines[0];
              return (
                <TableRow
                  key={order.serviceOrderId}
                  selected={selectedId === order.serviceOrderId}
                  hover
                >
                  <TableCell>
                    {task
                      ? formatDate(task.dueAt, { dateStyle: 'short', timeStyle: 'short' }, locale)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {formatDate(
                        order.reservationStartsAt,
                        { dateStyle: 'short', timeStyle: 'short' },
                        locale
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {order.siteReference ??
                        workplaceServiceReference('reservation', order.reservationId)}
                    </Typography>
                  </TableCell>
                  <TableCell>{line ? (korean ? line.nameKo : line.nameEn) : '—'}</TableCell>
                  <TableCell>{task?.providerCode ?? '—'}</TableCell>
                  <TableCell>
                    {task?.assigneeDisplayName ?? t('workplace.services.extensions.unassigned')}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={t(`workplace.services.orderStates.${order.state}`)} />
                  </TableCell>
                  <TableCell>{task?.blockerCode ?? '—'}</TableCell>
                  <TableCell>
                    {t(`workplace.services.impacts.${order.reservationImpact}`)}
                  </TableCell>
                  <TableCell>{task?.externalFulfillmentReference ?? '—'}</TableCell>
                  <TableCell align="right">
                    <ActionButton
                      size="small"
                      intent={selectedId === order.serviceOrderId ? 'primary' : 'quiet'}
                      onClick={(event) => onSelect(order.serviceOrderId, event.currentTarget)}
                    >
                      {t('workplace.services.inspect')}
                    </ActionButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {!visible.length ? (
        <Typography variant="body2" color="text.secondary" mt={1}>
          {t('workplace.services.extensions.operationsNoMatch')}
        </Typography>
      ) : null}
    </Box>
  );
}
