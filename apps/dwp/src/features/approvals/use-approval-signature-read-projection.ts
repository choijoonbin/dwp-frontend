import { useQuery } from '@tanstack/react-query';
import { getApprovalSignatureProviders } from '@dwp-frontend/shared-utils';
import { useApprovalManagementScopeReady } from './approval-management-scope';
import {
  approvalSignatureSourceState,
  retryApprovalSignatureRead,
} from './approval-signature-source-state';
import { parseApprovalSignatureReadProjection } from './approval-signature-read-projection';
import { useApprovalManagementRequestScope } from './use-approval-experience';

export function useApprovalSignatureReadProjection() {
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const source = useQuery({
    queryKey: ['approvals', 'admin', 'signatures', 'projection', ...requestScope.cacheKey],
    queryFn: async ({ signal }) => {
      const response: unknown = await getApprovalSignatureProviders(
        requestScope.contextScopeKey,
        signal
      );
      return parseApprovalSignatureReadProjection(response);
    },
    enabled: scopeReady,
    staleTime: 60_000,
    retry: retryApprovalSignatureRead,
  });

  return {
    scopeReady,
    source,
    sourceState: approvalSignatureSourceState(source),
  };
}
