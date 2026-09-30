const TENANT_EXECUTION_STATES = new Set([
  'NOT_STARTED',
  'NOT_REQUIRED',
  'MANUAL_ACTION_REQUIRED',
  'COMPLETED',
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

export function tenantExecutionPresentationState(value: string): string {
  return TENANT_EXECUTION_STATES.has(value) ? value : 'UNAVAILABLE';
}
