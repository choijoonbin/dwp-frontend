import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { getApprovalAdminV2Workspace } from '@dwp-frontend/shared-utils/api/approval-admin-v2-api';

import { useApprovalManagementScopeReady } from '../approval-management-scope';
import { useApprovalManagementRequestScope } from '../use-approval-experience';
import {
  approvalAdminV2SourceState,
  retryApprovalAdminV2Read,
} from './approval-admin-v2-runtime-model';

import type {
  ApprovalAdminV2ReadKind,
  ApprovalAdminV2ReadResult,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-api';

export function useApprovalAdminV2Source<K extends ApprovalAdminV2ReadKind>(
  kind: K,
  empty: (data: ApprovalAdminV2ReadResult[K]) => boolean
) {
  const { i18n } = useTranslation();
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const queryKey = useMemo(
    () => ['approvals', 'admin-v2', kind, locale, ...requestScope.cacheKey] as const,
    [kind, locale, requestScope.cacheKey]
  );
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      getApprovalAdminV2Workspace(kind, requestScope.contextScopeKey, signal, locale),
    enabled: scopeReady,
    retry: retryApprovalAdminV2Read,
    staleTime: 30_000,
    notifyOnChangeProps: 'all',
  });
  return {
    data: query.data,
    state: approvalAdminV2SourceState(query, scopeReady, empty),
    scopeReady,
    queryKey,
    requestScope,
    refetch: query.refetch,
    isFetching: query.isFetching,
  } as const;
}
