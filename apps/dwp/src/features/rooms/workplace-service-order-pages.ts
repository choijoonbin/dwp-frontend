import { useInfiniteQuery } from '@tanstack/react-query';
import {
  getWorkplaceServiceOrderAttachments,
  getWorkplaceServiceOrderEvents,
  getWorkplaceServiceOrderMessages,
} from '@dwp-frontend/shared-utils';

const pageSize = 50;

function pageQueryKey(
  orderId: string,
  collection: 'events' | 'messages' | 'attachments',
  administrator: boolean
) {
  return ['workplace', 'services', administrator ? 'admin' : 'own', orderId, collection] as const;
}

export function useWorkplaceServiceOrderEventPages(orderId: string, administrator = false) {
  return useInfiniteQuery({
    queryKey: pageQueryKey(orderId, 'events', administrator),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      getWorkplaceServiceOrderEvents(
        orderId,
        { cursor: pageParam, limit: pageSize },
        administrator
      ),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    retry: false,
  });
}

export function useWorkplaceServiceOrderMessagePages(orderId: string, administrator = false) {
  return useInfiniteQuery({
    queryKey: pageQueryKey(orderId, 'messages', administrator),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      getWorkplaceServiceOrderMessages(
        orderId,
        { cursor: pageParam, limit: pageSize },
        administrator
      ),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    retry: false,
  });
}

export function useWorkplaceServiceOrderAttachmentPages(orderId: string, administrator = false) {
  return useInfiniteQuery({
    queryKey: pageQueryKey(orderId, 'attachments', administrator),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      getWorkplaceServiceOrderAttachments(
        orderId,
        { cursor: pageParam, limit: pageSize },
        administrator
      ),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    retry: false,
  });
}
