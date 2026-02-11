/**
 * Case status select — 코드 기반 옵션, 변경 핸들러, 현재 API 값
 */

import { useMemo } from 'react';
import { useCodesByGroupQuery, useUpdateCaseStatusMutation } from '@dwp-frontend/shared-utils';

export const ALLOWED_CASE_STATUSES = ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'] as const;
export type CaseStatusApi = (typeof ALLOWED_CASE_STATUSES)[number];

export const displayStatusToApi = (s: string): CaseStatusApi => {
  const lower = (s ?? '').toLowerCase();
  if (lower === 'open') return 'OPEN';
  if (lower === 'triage' || lower === 'triaged') return 'TRIAGED';
  if (lower === 'in_progress') return 'IN_PROGRESS';
  if (lower === 'resolved') return 'RESOLVED';
  if (lower === 'dismissed') return 'DISMISSED';
  return 'TRIAGED';
};

type CodeItem = { codeKey?: string; code?: string; codeName?: string; name?: string; sortOrder?: number };

export const useCaseStatusSelect = (caseId: string | undefined, currentStatus?: string) => {
  const updateStatusMutation = useUpdateCaseStatusMutation();
  const { data: caseStatusCodes } = useCodesByGroupQuery('CASE_STATUS');

  const currentStatusApi = displayStatusToApi(currentStatus ?? '');

  const statusOptions = useMemo(() => {
    if (!caseStatusCodes) return [];
    const allowed = new Set(ALLOWED_CASE_STATUSES);
    const excludeTriaged = currentStatusApi !== 'TRIAGED';
    return (caseStatusCodes as CodeItem[])
      .filter((c) => {
        const code = (c.codeKey ?? c.code ?? '').toUpperCase() as CaseStatusApi;
        return allowed.has(code) && (!excludeTriaged || code !== 'TRIAGED');
      })
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((c) => ({
        value: (c.codeKey ?? c.code ?? '').toUpperCase() as CaseStatusApi,
        label: (((c.codeName ?? c.name ?? '') as string).trim() || (c.codeKey ?? c.code)) ?? '',
      }));
  }, [caseStatusCodes, currentStatusApi]);

  const handleStatusChange = (newStatus: CaseStatusApi) => {
    if (!caseId || newStatus === currentStatusApi) return;
    updateStatusMutation.mutate({ caseId, status: newStatus });
  };

  return {
    statusOptions,
    currentStatusApi,
    handleStatusChange,
    isStatusMutating: updateStatusMutation.isPending,
  };
};
