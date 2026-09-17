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

export function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}
