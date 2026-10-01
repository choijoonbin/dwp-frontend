const TENANT_EXECUTION_STATES = new Set([
  'NOT_STARTED',
  'NOT_REQUIRED',
  'MANUAL_ACTION_REQUIRED',
  'COMPLETED',
]);
const TENANT_LIFECYCLE_CANCELLABLE_STATES = new Set([
  'DRAFT',
  'BLOCKED_BY_HOLD',
  'PENDING_APPROVAL',
]);

export function canDecideResourceChange({
  canApprove,
  operatorId,
  requestedBy,
}: {
  canApprove: boolean;
  operatorId?: number | null;
  requestedBy: number;
}): boolean {
  return canApprove && operatorId != null && operatorId !== requestedBy;
}

export function canDecideTenantLifecycle({
  canApprove,
  operatorId,
  requestedBy,
  submittedBy,
}: {
  canApprove: boolean;
  operatorId?: number | null;
  requestedBy: number;
  submittedBy?: number | null;
}): boolean {
  return (
    canApprove && operatorId != null && operatorId !== requestedBy && operatorId !== submittedBy
  );
}

export function canCancelTenantLifecycle({
  canWrite,
  operatorId,
  requestedBy,
  lifecycleState,
}: {
  canWrite: boolean;
  operatorId?: number | null;
  requestedBy: number;
  lifecycleState: string;
}): boolean {
  return (
    canWrite &&
    operatorId != null &&
    operatorId === requestedBy &&
    TENANT_LIFECYCLE_CANCELLABLE_STATES.has(lifecycleState)
  );
}

export function tenantExecutionPresentationState(value: string): string {
  return TENANT_EXECUTION_STATES.has(value) ? value : 'UNAVAILABLE';
}
