import type { ApprovalPage, ApprovalRequest, ApprovalTask } from '@dwp-frontend/shared-utils';

export function approvalTaskSearchPage(
  url: URL,
  source: readonly ApprovalTask[],
  nowMs = Date.now()
): ApprovalPage<ApprovalTask> {
  const params = url.searchParams;
  const query = (params.get('query') ?? '').trim().toLocaleLowerCase();
  const priority = params.get('priority');
  const status = params.get('status');
  const minRisk = Number(params.get('minRiskScore') ?? '0');
  const today = new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 10);
  const items = source.filter((task) => {
    const dueMs = Date.parse(task.dueAt ?? '');
    const day = Number.isFinite(dueMs)
      ? new Date(dueMs + 9 * 3600_000).toISOString().slice(0, 10)
      : '';
    return (
      (params.get('view') === 'COMPLETED'
        ? ['APPROVED', 'REJECTED']
        : ['PENDING', 'CLAIMED', 'INFO_REQUESTED']
      ).includes(task.status) &&
      (!query ||
        [task.title, task.summary, task.requestNumber].some((value) =>
          value.toLocaleLowerCase().includes(query)
        )) &&
      (!priority || task.priority === priority) &&
      (!status || task.status === status) &&
      task.riskScore >= minRisk &&
      (params.get('due') !== 'TODAY' || day === today) &&
      (params.get('due') !== 'OVERDUE' || dueMs < nowMs)
    );
  });
  const rank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  items.sort((left, right) => {
    if (params.get('sort') === 'NEWEST')
      return Date.parse(right.submittedAt ?? '') - Date.parse(left.submittedAt ?? '');
    if (params.get('sort') === 'OLDEST')
      return Date.parse(left.submittedAt ?? '') - Date.parse(right.submittedAt ?? '');
    return (
      rank[left.priority] - rank[right.priority] ||
      right.riskScore - left.riskScore ||
      left.taskId.localeCompare(right.taskId)
    );
  });
  const page = Number(params.get('page') ?? '0');
  const size = Number(params.get('size') ?? '25');
  return {
    items: items.slice(page * size, (page + 1) * size),
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
    page,
    size,
    hasNext: (page + 1) * size < items.length,
    evaluatedAt: new Date(nowMs).toISOString(),
  };
}

export function approvalRequestSearchPage(
  url: URL,
  source: readonly ApprovalRequest[],
  nowMs = Date.now()
): ApprovalPage<ApprovalRequest> {
  const params = url.searchParams;
  const query = (params.get('query') ?? '').trim().toLocaleLowerCase();
  const statuses: Record<string, readonly string[]> = {
    SUBMITTED: ['SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO'],
    DRAFTS: ['DRAFT'],
    DELETED: ['DRAFT'],
    ARCHIVE: ['APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'],
    NEEDS_INFO: ['NEEDS_INFO'],
  };
  const items = source.filter(
    (request) =>
      (statuses[params.get('view') ?? 'SUBMITTED'] ?? []).includes(request.status) &&
      (!params.get('status') || request.status === params.get('status')) &&
      (!params.get('priority') || request.priority === params.get('priority')) &&
      (!query ||
        [request.title, request.summary, request.requestNumber].some((value) =>
          value.toLocaleLowerCase().includes(query)
        ))
  );
  items.sort((left, right) => {
    const compared =
      Date.parse(left.completedAt ?? left.submittedAt ?? '') -
      Date.parse(right.completedAt ?? right.submittedAt ?? '');
    return (
      (params.get('sort') === 'OLDEST' ? compared : -compared) ||
      left.requestId.localeCompare(right.requestId)
    );
  });
  const page = Number(params.get('page') ?? '0');
  const size = Number(params.get('size') ?? '25');
  return {
    items: items.slice(page * size, (page + 1) * size),
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
    page,
    size,
    hasNext: (page + 1) * size < items.length,
    evaluatedAt: new Date(nowMs).toISOString(),
  };
}
