import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApprovalDraftRevision, getApprovalDraftRevisions } from '@dwp-frontend/shared-utils';

import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

import type { ApprovalRequest } from '@dwp-frontend/shared-utils';

export function useApprovalRequestRevisionHistory({
  request,
  enabled,
}: {
  request?: ApprovalRequest;
  enabled: boolean;
}) {
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const [page, setPage] = useState(0);
  const [selectedRevision, setSelectedRevision] = useState<number>();
  const identity = JSON.stringify([requestScope.cacheKey, request?.requestId, request?.version]);
  useEffect(() => {
    setPage(0);
    setSelectedRevision(undefined);
  }, [identity]);
  const revisions = useQuery({
    queryKey: [
      'approvals',
      ...requestScope.cacheKey,
      'requests',
      request?.requestId,
      request?.version,
      'revisions',
      page,
    ],
    queryFn: ({ signal }) =>
      getApprovalDraftRevisions(
        request!.requestId,
        { page, size: 10 },
        requestScope.contextScopeKey,
        signal
      ),
    enabled: enabled && requestScope.ready && Boolean(request),
    meta: requestScope.queryMeta,
    retry: false,
    staleTime: 0,
  });
  const selected =
    revisions.data?.items.find((revision) => revision.revision === selectedRevision) ??
    revisions.data?.items[0];
  const detail = useQuery({
    queryKey: [
      'approvals',
      ...requestScope.cacheKey,
      'requests',
      request?.requestId,
      request?.version,
      'revision',
      selected?.revision,
    ],
    queryFn: ({ signal }) =>
      getApprovalDraftRevision(
        request!.requestId,
        selected!.revision,
        requestScope.contextScopeKey,
        signal
      ),
    enabled:
      enabled &&
      requestScope.ready &&
      Boolean(request) &&
      !revisions.isFetching &&
      !revisions.isError &&
      Boolean(selected),
    meta: requestScope.queryMeta,
    retry: false,
    staleTime: 0,
  });
  const visible =
    enabled &&
    requestScope.ready &&
    !revisions.isFetching &&
    !revisions.isError &&
    !detail.isFetching &&
    !detail.isError &&
    detail.data?.revision.revision === selected?.revision
      ? detail.data
      : undefined;
  const ready =
    enabled &&
    requestScope.ready &&
    Boolean(revisions.data) &&
    !revisions.isFetching &&
    !revisions.isError &&
    (!selected || Boolean(visible));
  return { revisions, detail, selected, visible, ready, page, setPage, setSelectedRevision };
}
