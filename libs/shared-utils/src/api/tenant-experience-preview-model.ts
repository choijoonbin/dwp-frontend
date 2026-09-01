import type {
  HomeBackgroundPosition,
  HomeCompositionPolicyPayload,
  HomeExperienceVariant,
  HomeLaunchpadConfiguration,
  LocalizedHomeCopy,
} from './home-experience-api';

export type TenantExperiencePreview = {
  contractVersion: 'tenant-experience-preview.v1';
  previewMode: 'TENANT_CONFIGURATION_ONLY';
  generatedAt: string;
  branding: {
    organizationName?: string | null;
    accentColor: string;
    logoConfigured: boolean;
    logoWidth?: number | null;
    logoHeight?: number | null;
    version: number;
  };
  home: {
    headline?: string | null;
    subheadline?: string | null;
    localizedContent: Record<string, LocalizedHomeCopy>;
    defaultLocale: string;
    backgroundConfigured: boolean;
    backgroundPosition: HomeBackgroundPosition;
    backgroundFocalX: number;
    backgroundFocalY: number;
    mobileBackgroundFocalX: number;
    mobileBackgroundFocalY: number;
    contentAlignment: HomeBackgroundPosition;
    overlayOpacity: number;
    backgroundWidth?: number | null;
    backgroundHeight?: number | null;
    launchpadConfiguration: HomeLaunchpadConfiguration;
    compositionPolicy: HomeCompositionPolicyPayload;
    effectiveExperienceVariant: HomeExperienceVariant;
    version: number;
  };
  excludedData: string[];
};
