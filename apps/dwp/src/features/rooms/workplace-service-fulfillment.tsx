import { useMemo, useRef } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  getWorkplaceServiceFulfillmentOrder,
  getWorkplaceServiceFulfillmentQueue,
} from '@dwp-frontend/shared-utils';
import { ActionButton, EmptyState, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { FulfillmentInspector, QueueItem } from './workplace-service-fulfillment-panels';
import { WorkplaceServiceOperationsTable } from './workplace-service-operations-table';
import { WorkplaceMobileReservationInspector } from './workplace-mobile-reservation-inspector';
import { workplaceMemberCard } from './workplace-member-surfaces';
import {
  parseWorkplaceServiceFulfillmentDirection,
  parseWorkplaceServiceFulfillmentQuery,
  parseWorkplaceServiceFulfillmentSort,
  parseWorkplaceServiceFulfillmentState,
  updateWorkplaceServiceFulfillmentSearch,
} from './workplace-services-ui-model';

import type { WorkplaceServiceOrderState } from '@dwp-frontend/shared-utils';

export default function WorkplaceServiceFulfillmentPage() {
  const { t } = useTranslation('rooms');
  const capabilities = useRoomsCapabilities();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('order');
  const state = parseWorkplaceServiceFulfillmentState(params.get('state'));
  const operationsQuery = parseWorkplaceServiceFulfillmentQuery(params.get('q'));
  const operationsSort = parseWorkplaceServiceFulfillmentSort(params.get('sort'));
  const operationsDirection = parseWorkplaceServiceFulfillmentDirection(params.get('direction'));
  const queueQuery = useInfiniteQuery({
    queryKey: ['workplace', 'services', 'fulfillment', state],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      getWorkplaceServiceFulfillmentQueue(state || undefined, {
        cursor: pageParam,
        limit: 50,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    retry: 1,
  });
  const orders = useMemo(
    () => queueQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [queueQuery.data]
  );
  const selectedFromQueue = useMemo(
    () => orders.find((order) => order.serviceOrderId === selectedId) ?? null,
    [orders, selectedId]
  );
  const detailQuery = useQuery({
    queryKey: ['workplace', 'services', 'fulfillment', 'detail', selectedId],
    queryFn: () => getWorkplaceServiceFulfillmentOrder(selectedId!),
    enabled: capabilities.canViewWorkplaceAdmin && Boolean(selectedId) && !selectedFromQueue,
    initialData: selectedFromQueue ?? undefined,
  });
  const selected = selectedFromQueue ?? detailQuery.data ?? null;

  return (
    <Box
      data-testid="workplace-service-fulfillment"
      sx={{ width: '100%', maxWidth: 1440, mx: 'auto', p: { xs: 2, md: 3 } }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        gap={2}
        mb={2.5}
      >
        <Box>
          <Typography variant="overline" color="primary.main">
            {t('workplace.services.adminEyebrow')}
          </Typography>
          <Typography
            ref={headingRef}
            tabIndex={-1}
            component="h1"
            variant="h4"
            fontWeight="fontWeightBold"
          >
            {t('workplace.services.fulfillmentTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {t('workplace.services.fulfillmentDescription')}
          </Typography>
        </Box>
        <SelectField
          label={t('workplace.services.orderStateFilter')}
          value={state}
          options={[
            { value: '', label: t('workplace.services.allStates') },
            ...(
              [
                'SUBMITTED',
                'ACCEPTED',
                'IN_PREPARATION',
                'PARTIALLY_FULFILLED',
                'BLOCKED',
                'DELAYED',
                'RESULT_UNKNOWN',
              ] as WorkplaceServiceOrderState[]
            ).map((value) => ({ value, label: t(`workplace.services.orderStates.${value}`) })),
          ]}
          onValueChange={(value) =>
            setParams(
              updateWorkplaceServiceFulfillmentSearch(params, {
                state: value as WorkplaceServiceOrderState | '',
              })
            )
          }
          sx={{ minWidth: { md: 240 } }}
        />
      </Stack>
      {!capabilities.isLoaded || queueQuery.isLoading ? (
        <Typography color="text.secondary">{t('workplace.services.loading')}</Typography>
      ) : !capabilities.canViewWorkplaceAdmin ? (
        <InlineFeedback severity="warning">{t('workplace.services.adminDenied')}</InlineFeedback>
      ) : queueQuery.isError ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton
              intent="quiet"
              startIcon={<RefreshCw size={16} />}
              onClick={() => void queueQuery.refetch()}
            >
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.services.fulfillmentError')}
        </InlineFeedback>
      ) : !orders.length ? (
        <EmptyState title={t('workplace.services.fulfillmentEmpty')} />
      ) : (
        <Stack spacing={1.5}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.8fr) minmax(360px, 0.9fr)' },
              gap: 2,
            }}
          >
            <Stack spacing={1.25} minWidth={0}>
              <WorkplaceServiceOperationsTable
                orders={orders}
                selectedId={selected?.serviceOrderId ?? null}
                query={operationsQuery}
                sort={operationsSort}
                direction={operationsDirection}
                onQuery={(query) =>
                  setParams(updateWorkplaceServiceFulfillmentSearch(params, { query }))
                }
                onSort={(sort, direction) =>
                  setParams(updateWorkplaceServiceFulfillmentSearch(params, { sort, direction }))
                }
                onSelect={(orderId, trigger) => {
                  openerRef.current = trigger;
                  setParams(updateWorkplaceServiceFulfillmentSearch(params, { orderId }));
                }}
              />
              <Stack
                component="ul"
                spacing={1.25}
                sx={{
                  p: 0,
                  m: 0,
                  display: { xs: selected ? 'none' : 'flex', md: 'flex', lg: 'none' },
                }}
              >
                {orders.map((order) => (
                  <QueueItem
                    key={order.serviceOrderId}
                    order={order}
                    active={selected?.serviceOrderId === order.serviceOrderId}
                    onClick={(trigger) => {
                      openerRef.current = trigger;
                      setParams(
                        updateWorkplaceServiceFulfillmentSearch(params, {
                          orderId: order.serviceOrderId,
                        })
                      );
                    }}
                  />
                ))}
              </Stack>
              {queueQuery.hasNextPage ? (
                <ActionButton
                  intent="quiet"
                  loading={queueQuery.isFetchingNextPage}
                  onClick={() => void queueQuery.fetchNextPage()}
                >
                  {t('workplace.services.loadMore')}
                </ActionButton>
              ) : null}
            </Stack>
            {selected ? (
              <WorkplaceMobileReservationInspector
                closeLabel={t('actions.close')}
                label={t('workplace.services.fulfillmentInspectorLabel')}
                openerRef={openerRef}
                fallbackFocusRef={headingRef}
                onClose={() =>
                  setParams(updateWorkplaceServiceFulfillmentSearch(params, { orderId: null }))
                }
              >
                <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                  <FulfillmentInspector
                    order={selected}
                    canManage={capabilities.canManageWorkplaceAdmin}
                  />
                </Box>
              </WorkplaceMobileReservationInspector>
            ) : (
              <Box component="aside" sx={(theme) => ({ ...workplaceMemberCard(theme), p: 2 })}>
                <EmptyState title={t('workplace.services.selectOrder')} />
              </Box>
            )}
          </Box>
        </Stack>
      )}
    </Box>
  );
}
