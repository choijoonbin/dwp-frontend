import { axiosInstance } from '../axios-instance';
import { resolveBrowserMediaUrl } from './browser-media-url';

import type { ApiResponse } from '../types';
import type { HomeWidgetHeight } from './home-preference-api';

export type HomeBackgroundPosition = 'LEFT' | 'CENTER' | 'RIGHT';
export type HomeContentAlignment = 'LEFT' | 'CENTER' | 'RIGHT';

export type LocalizedHomeCopy = {
  headline?: string | null;
  subheadline?: string | null;
};

export type HomeLaunchpadGroup = {
  groupKey: string;
  labels: Record<string, string>;
  descriptions: Record<string, string>;
  sortOrder: number;
  enabled: boolean;
};

export type HomeAppPlacement = {
  resourceKey: string;
  groupKey: string;
  sortOrder: number;
};

export type HomeLaunchpadConfiguration = {
  schemaVersion: 1;
  groups: HomeLaunchpadGroup[];
  placements: HomeAppPlacement[];
};

export type HomePersonalZoneKey = 'workspace-tools';
export type HomeGovernedZoneKey = 'announcements';
export type HomeGovernedZonePlacement = 'HERO' | 'CANVAS';
export const HOME_EXPERIENCE_VARIANTS = ['CLASSIC', 'FLOW_V1', 'MZ_V1'] as const;
export type HomeExperienceVariant = (typeof HOME_EXPERIENCE_VARIANTS)[number];
export type HomePreferenceStore = 'LEGACY' | 'VIEWS';
export const HOME_COMPOSITION_DEVICE_CLASSES = [
  'DESKTOP_WIDE',
  'DESKTOP_STANDARD',
  'MOBILE_STANDARD',
  'MOBILE_COMPACT',
] as const;
export type HomeCompositionDeviceClass = (typeof HOME_COMPOSITION_DEVICE_CLASSES)[number];
export type HomeModeLayoutContract = {
  layoutScope: 'MODE_SCOPED_VIEW';
  deviceClasses: HomeCompositionDeviceClass[];
};
export type HomeModeLayouts = Record<HomeExperienceVariant, HomeModeLayoutContract>;
export const HOME_CONTRACT_CAPABILITIES = {
  compositionV4: 'HOME_COMPOSITION_V4',
  modeScopedViews: 'MODE_SCOPED_HOME_VIEWS',
  fourDeviceLayouts: 'FOUR_DEVICE_LAYOUTS',
} as const;
export type HomeContractCapability =
  (typeof HOME_CONTRACT_CAPABILITIES)[keyof typeof HOME_CONTRACT_CAPABILITIES];

export type GovernedHomeZone = {
  zoneKey: HomeGovernedZoneKey;
  placement: HomeGovernedZonePlacement;
  visible: boolean;
  size: 'compact' | 'medium' | 'large' | 'full';
  height: HomeWidgetHeight;
  sortOrder: number;
};

/** Tenant-level mode and governed-zone policy; distinct from a personal Home view layout. */
export type TenantHomeCompositionPolicyV4 = {
  schemaVersion: 4;
  /** Compatibility alias; upgraded servers keep it equal to defaultMode. */
  experienceVariant: HomeExperienceVariant;
  allowedModes: HomeExperienceVariant[];
  defaultMode: HomeExperienceVariant;
  personalCustomizationEnabled: boolean;
  governedZones: GovernedHomeZone[];
  modeLayouts: HomeModeLayouts;
};

/** Compatibility name retained for existing consumers of the tenant policy API. */
export type HomeCompositionPolicy = TenantHomeCompositionPolicyV4;

export type TenantHomeCompositionPolicyV3 = Omit<
  TenantHomeCompositionPolicyV4,
  'schemaVersion' | 'modeLayouts' | 'allowedModes' | 'defaultMode'
> & { schemaVersion: 3 };

export type LegacyHomeCompositionPolicy = {
  schemaVersion: 1 | 2;
  personalCustomizationEnabled?: boolean;
  governedZones?: GovernedHomeZone[];
};

export type HomeCompositionPolicyPayload =
  HomeCompositionPolicy | TenantHomeCompositionPolicyV3 | LegacyHomeCompositionPolicy;

export type HomeCompositionPolicyPreview = Readonly<{
  policy: HomeCompositionPolicy;
  enabledModes: HomeExperienceVariant[];
  effectiveDefaultMode: HomeExperienceVariant;
  warnings: string[];
}>;

export function createHomeModeLayouts(): HomeModeLayouts {
  const contract = (): HomeModeLayoutContract => ({
    layoutScope: 'MODE_SCOPED_VIEW',
    deviceClasses: [...HOME_COMPOSITION_DEVICE_CLASSES],
  });
  return { CLASSIC: contract(), FLOW_V1: contract(), MZ_V1: contract() };
}

export function isHomeModeLayouts(value: unknown): value is HomeModeLayouts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const layouts = value as Record<string, unknown>;
  if (
    Object.keys(layouts).length !== HOME_EXPERIENCE_VARIANTS.length ||
    !Object.prototype.hasOwnProperty.call(layouts, 'CLASSIC') ||
    !Object.prototype.hasOwnProperty.call(layouts, 'FLOW_V1') ||
    !Object.prototype.hasOwnProperty.call(layouts, 'MZ_V1')
  ) {
    return false;
  }
  return HOME_EXPERIENCE_VARIANTS.every((mode) => {
    const contract = layouts[mode];
    if (!contract || typeof contract !== 'object' || Array.isArray(contract)) return false;
    const candidate = contract as Record<string, unknown>;
    return (
      Object.keys(candidate).length === 2 &&
      Object.prototype.hasOwnProperty.call(candidate, 'layoutScope') &&
      Object.prototype.hasOwnProperty.call(candidate, 'deviceClasses') &&
      candidate.layoutScope === 'MODE_SCOPED_VIEW' &&
      Array.isArray(candidate.deviceClasses) &&
      candidate.deviceClasses.length === HOME_COMPOSITION_DEVICE_CLASSES.length &&
      candidate.deviceClasses.every(
        (deviceClass, index) => deviceClass === HOME_COMPOSITION_DEVICE_CLASSES[index]
      )
    );
  });
}

export type HomeExperience = {
  headline?: string | null;
  subheadline?: string | null;
  localizedContent: Record<string, LocalizedHomeCopy>;
  defaultLocale: string;
  backgroundPosition: HomeBackgroundPosition;
  /** Optional while older platform nodes are rolling forward. */
  backgroundFocalX?: number;
  /** Optional while older platform nodes are rolling forward. */
  backgroundFocalY?: number;
  /** Optional while older platform nodes are rolling forward. */
  mobileBackgroundFocalX?: number;
  /** Optional while older platform nodes are rolling forward. */
  mobileBackgroundFocalY?: number;
  /** Runtime copy/dock alignment, independent from image focal position. */
  contentAlignment?: HomeContentAlignment;
  overlayOpacity: number;
  backgroundUrl?: string | null;
  backgroundOriginalName?: string | null;
  backgroundContentType?: string | null;
  backgroundSizeBytes?: number | null;
  backgroundWidth?: number | null;
  backgroundHeight?: number | null;
  launchpadConfiguration: HomeLaunchpadConfiguration;
  compositionPolicy: HomeCompositionPolicyPayload;
  /** Server-resolved variant after policy and runtime kill-switch evaluation. */
  effectiveExperienceVariant?: HomeExperienceVariant;
  /** Server capability flags are optional for backward-compatible, fail-closed clients. */
  advancedPersonalizationEnabled?: boolean;
  composerEnabled?: boolean;
  homePreferenceStore?: HomePreferenceStore;
  /** Absent or empty until the backend fleet can safely serve the Wave 1 contracts. */
  homeContractCapabilities?: string[];
  version: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export function hasHomeContractCapability(
  experience: Pick<HomeExperience, 'homeContractCapabilities'> | null | undefined,
  capability: HomeContractCapability
): boolean {
  return experience?.homeContractCapabilities?.includes(capability) === true;
}

export type HomeExperienceRevision = {
  revisionId: number;
  sourceVersion: number;
  changeType:
    | 'BASELINE'
    | 'SETTINGS_PUBLISHED'
    | 'ASSET_PUBLISHED'
    | 'ASSET_RESET'
    | 'EXPERIENCE_PUBLISHED'
    | 'ROLLBACK';
  headline?: string | null;
  backgroundOriginalName?: string | null;
  backgroundWidth?: number | null;
  backgroundHeight?: number | null;
  localeCount: number;
  /** Domains restored by this revision. Older servers may omit this list. */
  affectedScopes?: string[];
  current: boolean;
  createdAt: string;
  createdBy?: number | null;
};

export type UpdateHomeExperienceRequest = Pick<
  HomeExperience,
  | 'headline'
  | 'subheadline'
  | 'localizedContent'
  | 'defaultLocale'
  | 'backgroundPosition'
  | 'backgroundFocalX'
  | 'backgroundFocalY'
  | 'mobileBackgroundFocalX'
  | 'mobileBackgroundFocalY'
  | 'contentAlignment'
  | 'overlayOpacity'
  | 'version'
>;

export const DEFAULT_HOME_BACKGROUND_URL = '/assets/home/default/agentic-workspace-hero-v2.png';

export function resolveHomeBackgroundUrl(experience?: HomeExperience | null): string {
  return experience?.backgroundUrl
    ? resolveBrowserMediaUrl(experience.backgroundUrl)
    : DEFAULT_HOME_BACKGROUND_URL;
}

export function resolveAdminHomeBackgroundUrl(experience?: HomeExperience | null): string {
  return experience?.backgroundUrl
    ? resolveBrowserMediaUrl(
        experience.backgroundUrl.replace('/v1/home-experience/', '/v1/admin/home-experience/')
      )
    : DEFAULT_HOME_BACKGROUND_URL;
}

export async function getHomeExperience(): Promise<HomeExperience> {
  const response = await axiosInstance.get<ApiResponse<HomeExperience>>(
    '/api/platform/v1/home-experience'
  );
  return response.data.data;
}

export async function getAdminHomeExperience(): Promise<HomeExperience> {
  const response = await axiosInstance.get<ApiResponse<HomeExperience>>(
    '/api/platform/v1/admin/home-experience'
  );
  return response.data.data;
}

export async function updateHomeExperience(
  request: UpdateHomeExperienceRequest
): Promise<HomeExperience> {
  const response = await axiosInstance.put<
    ApiResponse<HomeExperience>,
    UpdateHomeExperienceRequest
  >('/api/platform/v1/admin/home-experience', request);
  return response.data.data;
}

/** Publishes presentation settings and an optional background as one server transaction. */
export async function publishHomeExperience(
  request: UpdateHomeExperienceRequest,
  file?: File | null,
  resetBackground = false
): Promise<HomeExperience> {
  const form = new FormData();
  form.set(
    'settings',
    new Blob([JSON.stringify(request)], { type: 'application/json' }),
    'settings.json'
  );
  if (file) form.set('file', file);
  if (resetBackground) form.set('resetBackground', 'true');
  const response = await axiosInstance.post<ApiResponse<HomeExperience>, FormData>(
    '/api/platform/v1/admin/home-experience/publish',
    form
  );
  return response.data.data;
}

export async function updateHomeLaunchpadConfiguration(
  configuration: HomeLaunchpadConfiguration,
  version: number
): Promise<HomeExperience> {
  const response = await axiosInstance.put<
    ApiResponse<HomeExperience>,
    { configuration: HomeLaunchpadConfiguration; version: number }
  >('/api/platform/v1/admin/home-experience/launchpad', { configuration, version });
  return response.data.data;
}

export async function updateHomeCompositionPolicy(
  policy: HomeCompositionPolicy | TenantHomeCompositionPolicyV3,
  version: number
): Promise<HomeExperience> {
  const response = await axiosInstance.put<
    ApiResponse<HomeExperience>,
    { policy: HomeCompositionPolicy | TenantHomeCompositionPolicyV3; version: number }
  >('/api/platform/v1/admin/home-experience/composition', { policy, version });
  return response.data.data;
}

export async function previewHomeCompositionPolicy(
  policy: HomeCompositionPolicy
): Promise<HomeCompositionPolicyPreview> {
  const response = await axiosInstance.post<
    ApiResponse<HomeCompositionPolicyPreview>,
    { policy: HomeCompositionPolicy }
  >('/api/platform/v1/admin/home-experience/composition/preview', { policy });
  return response.data.data;
}

export async function uploadHomeBackground(file: File, version: number): Promise<HomeExperience> {
  const form = new FormData();
  form.set('file', file);
  const response = await axiosInstance.post<ApiResponse<HomeExperience>, FormData>(
    `/api/platform/v1/admin/home-experience/background?version=${version}`,
    form
  );
  return response.data.data;
}

export async function resetHomeBackground(version: number): Promise<HomeExperience> {
  const response = await axiosInstance.post<ApiResponse<HomeExperience>, { version: number }>(
    '/api/platform/v1/admin/home-experience/background/reset',
    { version }
  );
  return response.data.data;
}

export async function getHomeExperienceRevisions(limit = 20): Promise<HomeExperienceRevision[]> {
  const response = await axiosInstance.get<ApiResponse<HomeExperienceRevision[]>>(
    `/api/platform/v1/admin/home-experience/revisions?limit=${limit}`
  );
  return response.data.data;
}

export async function rollbackHomeExperience(
  revisionId: number,
  version: number
): Promise<HomeExperience> {
  const response = await axiosInstance.post<ApiResponse<HomeExperience>, { version: number }>(
    `/api/platform/v1/admin/home-experience/revisions/${revisionId}/rollback`,
    { version }
  );
  return response.data.data;
}
