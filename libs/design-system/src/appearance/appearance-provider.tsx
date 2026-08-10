import { useMemo, useState, useEffect, useContext, useCallback, createContext } from 'react';

import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';

import { buildDwpTheme } from '../theme';
import { foundationTokens } from '../foundation';
import {
  colorModeOptions,
  densityOptions,
  navigationOptions,
  systemUiFont,
  defaultAppearancePolicy,
} from './appearance-policy';

import type {
  AppearancePolicy,
  TenantAppearance,
  DensityPreference,
  NavigationPattern,
  ColorModePreference,
  UserAppearancePreference,
} from './appearance-policy';

const PREFERENCE_STORAGE_KEY = 'dwp.appearance.v1';

type ResolvedColorMode = 'light' | 'dark';

type AppearanceContextValue = {
  policy: AppearancePolicy;
  tenant: TenantAppearance;
  preference: UserAppearancePreference;
  resolvedMode: ResolvedColorMode;
  effectiveReduceMotion: boolean;
  accentColor: string;
  fontFamily: string;
  navigationPattern: NavigationPattern;
  setMode: (mode: ColorModePreference) => void;
  setDensity: (density: DensityPreference) => void;
  setHighContrast: (enabled: boolean) => void;
  setReduceMotion: (enabled: boolean) => void;
  replacePreference: (preference: UserAppearancePreference) => void;
  resetPreferences: () => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function includesValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function readStoredPreference(policy: AppearancePolicy): UserAppearancePreference {
  if (typeof window === 'undefined') return policy.defaults;

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(PREFERENCE_STORAGE_KEY) ?? '{}'
    ) as Partial<UserAppearancePreference>;

    return {
      mode: includesValue(colorModeOptions, stored.mode) ? stored.mode : policy.defaults.mode,
      density: includesValue(densityOptions, stored.density)
        ? stored.density
        : policy.defaults.density,
      highContrast:
        typeof stored.highContrast === 'boolean'
          ? stored.highContrast
          : policy.defaults.highContrast,
      reduceMotion:
        typeof stored.reduceMotion === 'boolean'
          ? stored.reduceMotion
          : policy.defaults.reduceMotion,
    };
  } catch {
    return policy.defaults;
  }
}

function resolveNavigation(policy: AppearancePolicy, tenant: TenantAppearance): NavigationPattern {
  if (
    policy.tenantControls.navigationPattern &&
    includesValue(navigationOptions, tenant.navigationPattern)
  ) {
    return tenant.navigationPattern;
  }
  return policy.navigation.defaultPattern;
}

function resolveFont(policy: AppearancePolicy, tenant: TenantAppearance): string {
  if (
    policy.tenantControls.fontFamily &&
    tenant.fontFamily &&
    policy.tenantControls.approvedFontFamilies.includes(tenant.fontFamily)
  ) {
    return tenant.fontFamily;
  }
  return systemUiFont;
}

export type DwpThemeProviderProps = {
  children: React.ReactNode;
  policy?: AppearancePolicy;
  tenant?: TenantAppearance;
};

export function DwpThemeProvider({
  children,
  policy = defaultAppearancePolicy,
  tenant = {},
}: DwpThemeProviderProps) {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const systemReduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [preference, setPreference] = useState<UserAppearancePreference>(() =>
    readStoredPreference(policy)
  );

  const resolvedMode: ResolvedColorMode =
    preference.mode === 'system' ? (systemDark ? 'dark' : 'light') : preference.mode;
  const effectiveReduceMotion = preference.reduceMotion || systemReduceMotion;
  const accentColor =
    policy.tenantControls.accentColor && tenant.accentColor
      ? tenant.accentColor
      : foundationTokens.color.product.primary;
  const fontFamily = resolveFont(policy, tenant);
  const navigationPattern = resolveNavigation(policy, tenant);

  const theme = useMemo(
    () =>
      buildDwpTheme({
        mode: resolvedMode,
        density: preference.density,
        highContrast: preference.highContrast,
        reduceMotion: effectiveReduceMotion,
        accentColor,
        fontFamily,
      }),
    [
      accentColor,
      effectiveReduceMotion,
      fontFamily,
      preference.density,
      preference.highContrast,
      resolvedMode,
    ]
  );

  useEffect(() => {
    window.localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(preference));
    document.documentElement.dataset.colorScheme = resolvedMode;
    document.documentElement.dataset.contrast = preference.highContrast ? 'high' : 'standard';
    document.documentElement.dataset.density = preference.density;
    document.documentElement.dataset.motion = effectiveReduceMotion ? 'reduced' : 'full';
  }, [effectiveReduceMotion, preference, resolvedMode]);

  const setMode = useCallback(
    (mode: ColorModePreference) => {
      if (!policy.userControls.mode || !includesValue(colorModeOptions, mode)) return;
      setPreference((current) => ({ ...current, mode }));
    },
    [policy.userControls.mode]
  );

  const setDensity = useCallback(
    (density: DensityPreference) => {
      if (!policy.userControls.density || !includesValue(densityOptions, density)) return;
      setPreference((current) => ({ ...current, density }));
    },
    [policy.userControls.density]
  );

  const setHighContrast = useCallback(
    (enabled: boolean) => {
      if (!policy.userControls.highContrast) return;
      setPreference((current) => ({ ...current, highContrast: enabled }));
    },
    [policy.userControls.highContrast]
  );

  const setReduceMotion = useCallback(
    (enabled: boolean) => {
      if (!policy.userControls.reduceMotion) return;
      setPreference((current) => ({ ...current, reduceMotion: enabled }));
    },
    [policy.userControls.reduceMotion]
  );

  const replacePreference = useCallback(
    (next: UserAppearancePreference) => {
      setPreference({
        mode: includesValue(colorModeOptions, next.mode) ? next.mode : policy.defaults.mode,
        density: includesValue(densityOptions, next.density)
          ? next.density
          : policy.defaults.density,
        highContrast:
          typeof next.highContrast === 'boolean' ? next.highContrast : policy.defaults.highContrast,
        reduceMotion:
          typeof next.reduceMotion === 'boolean' ? next.reduceMotion : policy.defaults.reduceMotion,
      });
    },
    [policy.defaults]
  );

  const resetPreferences = useCallback(() => setPreference(policy.defaults), [policy.defaults]);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      policy,
      tenant,
      preference,
      resolvedMode,
      effectiveReduceMotion,
      accentColor,
      fontFamily,
      navigationPattern,
      setMode,
      setDensity,
      setHighContrast,
      setReduceMotion,
      replacePreference,
      resetPreferences,
    }),
    [
      accentColor,
      effectiveReduceMotion,
      fontFamily,
      navigationPattern,
      policy,
      preference,
      replacePreference,
      resetPreferences,
      resolvedMode,
      setDensity,
      setHighContrast,
      setMode,
      setReduceMotion,
      tenant,
    ]
  );

  return (
    <AppearanceContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance must be used within DwpThemeProvider');
  return value;
}
