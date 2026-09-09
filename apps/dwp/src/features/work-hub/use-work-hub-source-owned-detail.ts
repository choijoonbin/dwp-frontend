import { useQuery } from '@tanstack/react-query';
import {
  getApprovalTask,
  getApprovalRequestDetail,
} from '@dwp-frontend/shared-utils/api/approval-api';
import { getServiceMyRequest } from '@dwp-frontend/shared-utils/api/service-center-api';

import { useWorkHubOperationOwner } from './use-work-hub-operation-owner';
import type { WorkHubItem } from './work-hub-contracts';
import {
  projectApprovalSourceDetail,
  projectApprovalRequestSourceDetail,
  projectServiceSourceDetail,
  WorkHubSourceDetailMismatchError,
  type WorkHubSourceDetailProjection,
} from './work-hub-source-owned-detail-model';

export function useWorkHubSourceOwnedDetail(item: WorkHubItem) {
  const owner = useWorkHubOperationOwner();
  const supported =
    item.sourceContext?.kind === 'APPROVAL_TASK' ||
    item.sourceContext?.kind === 'APPROVAL_REQUEST' ||
    item.sourceContext?.kind === 'SERVICE_REQUEST';
  return useQuery<WorkHubSourceDetailProjection>({
    queryKey: [
      'work-hub',
      'source-owned-detail',
      owner,
      item.key,
      item.version,
      item.sourceStatus,
      item.sourceContext?.kind ?? 'UNSUPPORTED',
    ],
    enabled: owner !== null && supported,
    queryFn: async ({ signal }) => {
      signal.throwIfAborted();
      const projection =
        item.sourceContext?.kind === 'APPROVAL_TASK'
          ? projectApprovalSourceDetail(
              item,
              await getApprovalTask(item.reference.sourceReference, undefined, signal)
            )
          : item.sourceContext?.kind === 'APPROVAL_REQUEST'
            ? projectApprovalRequestSourceDetail(
                item,
                await getApprovalRequestDetail(item.reference.sourceReference, undefined, signal)
              )
            : item.sourceContext?.kind === 'SERVICE_REQUEST'
              ? projectServiceSourceDetail(
                  item,
                  await getServiceMyRequest(item.reference.sourceReference, signal)
                )
              : null;
      signal.throwIfAborted();
      if (!projection) throw new WorkHubSourceDetailMismatchError();
      return projection;
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always',
    meta: { accessSensitive: true, ownerFingerprint: owner },
  });
}
