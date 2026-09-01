import { foundationTokens } from '../foundation';

export const colorModeOptions = ['system', 'light', 'dark'] as const;
export const densityOptions = ['compact', 'standard', 'comfortable'] as const;
export const navigationOptions = ['sidebar', 'rail', 'top'] as const;

export type ColorModePreference = (typeof colorModeOptions)[number];
export type DensityPreference = (typeof densityOptions)[number];
export type NavigationPattern = (typeof navigationOptions)[number];

export type UserAppearancePreference = {
  mode: ColorModePreference;
  density: DensityPreference;
  highContrast: boolean;
  reduceMotion: boolean;
};

export type TenantAppearance = {
  accentColor?: string;
  fontFamily?: string;
  navigationPattern?: NavigationPattern;
  productName?: string;
};

export type AppearancePolicy = {
  defaults: UserAppearancePreference;
  userControls: {
    mode: boolean;
    density: boolean;
    highContrast: boolean;
    reduceMotion: boolean;
  };
  tenantControls: {
    accentColor: boolean;
    fontFamily: boolean;
    navigationPattern: boolean;
    approvedFontFamilies: readonly string[];
  };
  navigation: {
    defaultPattern: NavigationPattern;
    allowCollapse: boolean;
  };
};

export const systemUiFont = foundationTokens.font.ui;

export const defaultAppearancePolicy: AppearancePolicy = {
  defaults: {
    mode: 'system',
    density: 'standard',
    highContrast: false,
    reduceMotion: false,
  },
  userControls: {
    mode: true,
    density: true,
    highContrast: true,
    reduceMotion: true,
  },
  tenantControls: {
    accentColor: true,
    fontFamily: true,
    navigationPattern: true,
    approvedFontFamilies: [systemUiFont],
  },
  navigation: {
    defaultPattern: 'sidebar',
    allowCollapse: true,
  },
};
