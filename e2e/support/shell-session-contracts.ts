import type { Route } from '@playwright/test';
import type { LocalizationRevisionState, ResourceRoleDTO } from '@dwp-frontend/shared-utils';

type Appearance = {
  mode: 'system' | 'light' | 'dark';
  density: 'compact' | 'standard' | 'comfortable';
  highContrast: boolean;
  reduceMotion: boolean;
};

export type ShellSessionOptions = {
  userId?: number;
  /** null deliberately omits the field for identity-plane contract tests. */
  identityPlane?: string | null;
  personPublicId?: string | null;
  locale?: 'en' | 'ko';
  displayName?: string;
  jobTitle?: string;
  department?: string;
  workerNumber?: string;
  identitySourceType?: string;
  mfaEnabled?: boolean;
  email?: string;
  appearance?: Appearance;
  localizationState?: LocalizationRevisionState;
  groups?: Array<{ groupRef: string; displayName: string }>;
  resourceRoles?: ResourceRoleDTO[];
  permissions?: Array<{
    resourceType: string;
    resourceKey: string;
    permissionCode: string;
    effect: 'ALLOW' | 'DENY';
  }>;
};

export type MockHomeSurface = {
  schemaVersion: 5;
  surfaceKey: 'workspace-home' | 'hcm-home' | 'approval-home';
  customized: boolean;
  layout: {
    appLayout: Record<string, unknown> | null;
    presentation: 'balanced' | 'expressive' | 'focused';
    widgets: Array<{
      widgetKey: string;
      visible: boolean;
      size: 'fifth' | 'quarter' | 'compact' | 'medium' | 'large' | 'full';
    }>;
  };
  version: number;
  allowedModes?: Array<'CLASSIC' | 'FLOW_V1' | 'MZ_V1'>;
  enabledModes?: Array<'CLASSIC' | 'FLOW_V1' | 'MZ_V1'>;
  disabledModeReasons?: Partial<
    Record<'CLASSIC' | 'FLOW_V1' | 'MZ_V1', 'ROLLOUT_OR_KILL_SWITCH_DISABLED'>
  >;
  defaultMode?: 'CLASSIC' | 'FLOW_V1' | 'MZ_V1';
  currentMode?: 'CLASSIC' | 'FLOW_V1' | 'MZ_V1';
  warnings?: string[];
  updatedAt: string | null;
};

export const PROVIDER_GOV = [
  'RESOURCE_GOVERNANCE_READ',
  'RESOURCE_GOVERNANCE_WRITE',
  'RESOURCE_GOVERNANCE_APPROVE',
  'TENANT_LIFECYCLE_GOVERNANCE_APPROVE',
  'ARTIFACT_GOVERNANCE_READ',
  'ARTIFACT_GOVERNANCE_WRITE',
  'ARTIFACT_GOVERNANCE_APPROVE',
] as const;

export function identity(provider: boolean, options: ShellSessionOptions) {
  return {
    department: provider ? null : (options.department ?? null),
    workerNumber: provider ? null : (options.workerNumber ?? null),
    identitySourceType: provider ? null : (options.identitySourceType ?? 'LOCAL'),
    mfaEnabled: provider ? false : (options.mfaEnabled ?? true),
  };
}

export function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

export function scimPage(items: unknown[], hasMore = false) {
  return {
    items,
    limit: 100,
    hasMore,
    coverageState: hasMore ? 'TRUNCATED_AT_LIMIT' : 'COMPLETE_WITHIN_FILTER',
  };
}

export function integrityPage(items: unknown[], hasMore = false) {
  return {
    items,
    limit: 90,
    hasMore,
    coverageState: hasMore ? 'TRUNCATED_AT_LIMIT' : 'COMPLETE_WITHIN_FILTER',
  };
}

export function scimEvidence(connector: { connectorId: string; displayName: string }) {
  return [
    {
      eventId: 'scim-event-1',
      connectorId: connector.connectorId,
      connectorName: connector.displayName,
      operation: 'PATCH',
      resourceType: 'GROUP',
      resourceId: 'engineering-managers',
      outcome: 'FAILED',
      correlationId: 'scim-correlation-1',
      summary: 'Group member reference could not be resolved',
      occurredAt: '2026-08-12T01:45:00Z',
    },
    {
      eventId: 'scim-event-2',
      connectorId: connector.connectorId,
      connectorName: connector.displayName,
      operation: 'CREATE',
      resourceType: 'USER',
      resourceId: 'dana.kim@example.com',
      outcome: 'SUCCESS',
      correlationId: 'scim-correlation-2',
      summary: 'User provisioned',
      occurredAt: '2026-08-12T01:40:00Z',
    },
  ];
}

export const PRODUCTIVITY_SUBJECTS = {
  items: [
    {
      subjectId: 'subject-1',
      connectorId: 'connector-microsoft-graph',
      userId: 1,
      consentState: 'CONNECTED',
      grantedScopes: ['Mail.Read', 'Calendars.Read'],
      tokenExpiresAt: '2026-08-11T01:00:00Z',
      lastSuccessfulSyncAt: '2026-08-10T23:58:00Z',
    },
  ],
  hasMore: false,
  limit: 200,
};

export const PRODUCTIVITY_RUNS = {
  items: [
    {
      runId: 'productivity-run-1',
      connectorId: 'connector-microsoft-graph',
      userId: 1,
      resourceKind: 'CALENDAR',
      syncMode: 'DELTA',
      runState: 'SUCCEEDED',
      startedAt: '2026-08-10T23:57:00Z',
      completedAt: '2026-08-10T23:58:00Z',
      upsertCount: 18,
      deleteCount: 1,
      skipCount: 4,
      errorCount: 0,
      partialResult: false,
      correlationId: 'corr-productivity-1',
    },
  ],
  hasMore: false,
  limit: 200,
};
