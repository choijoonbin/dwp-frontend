const SCOPE_LABEL_KEYS: Record<string, string> = {
  TENANT: 'security.privileged.scope.TENANT',
  ORG_UNIT: 'security.privileged.scope.ORG_UNIT',
  RESOURCE: 'security.privileged.scope.RESOURCE',
};

const STATE_LABEL_KEYS: Record<string, string> = {
  PENDING_APPROVAL: 'security.privileged.state.PENDING_APPROVAL',
  DENIED: 'security.privileged.state.DENIED',
  CANCELLED: 'security.privileged.state.CANCELLED',
  REVOKED: 'security.privileged.state.REVOKED',
  EXPIRED: 'security.privileged.state.EXPIRED',
  ACTIVE: 'security.privileged.state.ACTIVE',
};

export function privilegedScopeLabelKey(value: string): string {
  return SCOPE_LABEL_KEYS[value] ?? 'security.privileged.scope.UNAVAILABLE';
}

export function privilegedStateLabelKey(value: string): string {
  return STATE_LABEL_KEYS[value] ?? 'security.privileged.state.UNAVAILABLE';
}
