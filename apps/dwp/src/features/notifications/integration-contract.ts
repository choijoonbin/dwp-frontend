export const notificationQueryKeys = {
  root: ['notifications'] as const,
  capabilities: () => ['notifications', 'capabilities'] as const,
  summary: () => ['notifications', 'summary'] as const,
  appSummaryRoot: () => ['notifications', 'app-summary'] as const,
  appSummary: (scope: Record<string, unknown>) => ['notifications', 'app-summary', scope] as const,
  inboxRoot: () => ['notifications', 'inbox'] as const,
  inbox: (scope: Record<string, unknown>) => ['notifications', 'inbox', scope] as const,
  detail: (notificationId: string | null) => ['notifications', 'detail', notificationId] as const,
  preferences: () => ['notifications', 'preferences'] as const,
  effectiveSettings: () => ['notifications', 'effective-settings'] as const,
  adminOverview: () => ['notifications', 'admin', 'overview'] as const,
  adminTypes: (scope: Record<string, unknown>) =>
    ['notifications', 'admin', 'types', scope] as const,
  adminPolicies: () => ['notifications', 'admin', 'policies'] as const,
  adminTemplates: () => ['notifications', 'admin', 'templates'] as const,
  adminOperations: () => ['notifications', 'admin', 'operations'] as const,
  adminSuppressions: () => ['notifications', 'admin', 'suppressions'] as const,
};
