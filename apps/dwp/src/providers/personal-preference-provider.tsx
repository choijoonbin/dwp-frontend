import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPersonalPreference,
  patchPersonalPreference,
  resetPersonalPreference,
  type PersonalPreference,
  type PersonalPreferencePatch,
  type PersonalPreferenceValues,
} from '@dwp-frontend/shared-utils/api/personal-preference-api';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import {
  defaultRegionalPreference,
  normalizeRegionalPreference,
  writeRegionalPreference,
} from '@dwp-frontend/shared-utils/regional-preference';
import { useToast } from '@dwp-frontend/shared-utils/toast/toast-store';
import { useAppearance } from '@dwp-frontend/design-system/appearance';

import {
  asPersonalPreferenceView,
  type PersonalPreferenceView,
  type ProviderLocalPreferenceState,
} from './provider-local-preference-model';

import type { UserAppearancePreference } from '@dwp-frontend/design-system/appearance';

export type PersonalPreferenceSaveState = 'idle' | 'saving' | 'saved' | 'error';

type PersonalPreferenceContextValue = {
  preference: PersonalPreferenceView | null;
  isLoading: boolean;
  isSaving: boolean;
  loadFailed: boolean;
  saveState: PersonalPreferenceSaveState;
  lastSavedAt: string | null;
  update: (patch: PersonalPreferencePatch) => void;
  reset: () => void;
  retry: () => void;
};

const PersonalPreferenceContext = createContext<PersonalPreferenceContextValue | null>(null);
const SAVE_DEBOUNCE_MS = 250;
const PROVIDER_PREFERENCE_STORAGE_PREFIX = 'dwp.provider-realm-preference.v2';
const LEGACY_PROVIDER_PREFERENCE_STORAGE_PREFIX = 'dwp.provider-preference.v1';
const PROVIDER_REALM_KEY = 'DWP_PROVIDER';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergePatch<T>(target: T, patch: unknown): T {
  if (!isRecord(patch)) return patch as T;
  const result: Record<string, unknown> = isRecord(target) ? { ...target } : {};
  Object.entries(patch).forEach(([key, value]) => {
    if (value === null) delete result[key];
    else result[key] = mergePatch(result[key], value);
  });
  return result as T;
}

function mergeQueuedPatch(
  current: PersonalPreferencePatch | null,
  next: PersonalPreferencePatch
): PersonalPreferencePatch {
  return mergePatch(current ?? {}, next);
}

function normalizeValues(
  values: Partial<PersonalPreferenceValues> | undefined,
  defaults: UserAppearancePreference
): PersonalPreferenceValues {
  const appearance: Record<string, unknown> = isRecord(values?.appearance) ? values.appearance : {};
  const accessibility: Record<string, unknown> = isRecord(values?.accessibility)
    ? values.accessibility
    : {};
  return {
    ...(values ?? {}),
    appearance: {
      mode:
        appearance.mode === 'light' || appearance.mode === 'dark' || appearance.mode === 'system'
          ? appearance.mode
          : defaults.mode,
      density:
        appearance.density === 'compact' ||
        appearance.density === 'comfortable' ||
        appearance.density === 'standard'
          ? appearance.density
          : defaults.density,
    },
    accessibility: {
      highContrast:
        typeof accessibility.highContrast === 'boolean'
          ? accessibility.highContrast
          : defaults.highContrast,
      reduceMotion:
        typeof accessibility.reduceMotion === 'boolean'
          ? accessibility.reduceMotion
          : defaults.reduceMotion,
      underlineLinks:
        typeof accessibility.underlineLinks === 'boolean' ? accessibility.underlineLinks : false,
      reduceTransparency:
        typeof accessibility.reduceTransparency === 'boolean'
          ? accessibility.reduceTransparency
          : false,
    },
    regional: normalizeRegionalPreference(values?.regional ?? defaultRegionalPreference),
  };
}

function normalizePreference(
  preference: PersonalPreference,
  defaults: UserAppearancePreference
): PersonalPreference {
  return {
    ...preference,
    schemaVersion: 2,
    preferences: normalizeValues(preference.preferences, defaults),
  };
}

function normalizeProviderValues(
  values: Partial<PersonalPreferenceValues> | undefined,
  defaults: UserAppearancePreference
): PersonalPreferenceValues {
  const normalized = normalizeValues(values, defaults);
  // Provider-local storage is a strict personal-settings boundary. Never retain
  // tenant-owned or future wire namespaces that may be present in copied data.
  return {
    appearance: normalized.appearance,
    accessibility: normalized.accessibility,
    regional: normalized.regional,
  };
}

export function providerPreferenceStorageKey(identity: string): string {
  return `${PROVIDER_PREFERENCE_STORAGE_PREFIX}:${identity}`;
}

export function providerRealmPreferenceIdentity(userId: number | string): string {
  return `realm:${PROVIDER_REALM_KEY}:user:${userId}`;
}

export function legacyProviderPreferenceStorageKey(identity: string): string {
  return `${LEGACY_PROVIDER_PREFERENCE_STORAGE_PREFIX}:${identity}`;
}

function createProviderLocalPreferenceState(
  values: Partial<PersonalPreferenceValues> | undefined,
  defaults: UserAppearancePreference,
  updatedAt: string | null = null
): ProviderLocalPreferenceState {
  return {
    schemaVersion: 2,
    customized: Boolean(values),
    preferences: normalizeProviderValues(values, defaults),
    version: 0,
    updatedAt,
  };
}

function createProviderLocalPreference(
  values: Partial<PersonalPreferenceValues> | undefined,
  defaults: UserAppearancePreference,
  updatedAt: string | null = null
): PersonalPreferenceView {
  return asPersonalPreferenceView(createProviderLocalPreferenceState(values, defaults, updatedAt));
}

export function readProviderLocalPreference(
  identity: string,
  legacyIdentity: string,
  defaults: UserAppearancePreference
): PersonalPreferenceView {
  if (typeof window === 'undefined') return createProviderLocalPreference(undefined, defaults);
  try {
    const targetKey = providerPreferenceStorageKey(identity);
    const legacyKey = legacyProviderPreferenceStorageKey(legacyIdentity);
    const current = window.localStorage.getItem(targetKey);
    const legacy = current === null ? window.localStorage.getItem(legacyKey) : null;
    const stored = JSON.parse(current ?? legacy ?? 'null') as {
      preferences?: Partial<PersonalPreferenceValues>;
      updatedAt?: string | null;
    } | null;
    const preference = createProviderLocalPreferenceState(
      stored?.preferences,
      defaults,
      stored?.updatedAt ?? null
    );
    if (stored) writeProviderLocalPreference(identity, preference);
    if (legacy !== null) window.localStorage.removeItem(legacyKey);
    return asPersonalPreferenceView(preference);
  } catch {
    return createProviderLocalPreference(undefined, defaults);
  }
}

function writeProviderLocalPreference(
  identity: string,
  preference: ProviderLocalPreferenceState,
  storage?: Pick<Storage, 'setItem'>
) {
  const target = storage ?? (typeof window === 'undefined' ? null : window.localStorage);
  if (!target) return;
  target.setItem(
    providerPreferenceStorageKey(identity),
    JSON.stringify({
      preferences: preference.preferences,
      updatedAt: preference.updatedAt ?? null,
    })
  );
}

export function updateProviderLocalPreference(
  identity: string,
  current: PersonalPreferenceView,
  patch: PersonalPreferencePatch,
  defaults: UserAppearancePreference,
  updatedAt: string,
  storage?: Pick<Storage, 'setItem'>
): PersonalPreferenceView {
  const next = createProviderLocalPreferenceState(
    mergePatch(current.preferences, patch),
    defaults,
    updatedAt
  );
  writeProviderLocalPreference(identity, next, storage);
  return asPersonalPreferenceView(next);
}

function toAppearance(
  values: PersonalPreferenceValues,
  defaults: UserAppearancePreference
): UserAppearancePreference {
  return {
    mode: values.appearance?.mode ?? defaults.mode,
    density: values.appearance?.density ?? defaults.density,
    highContrast: values.accessibility?.highContrast ?? defaults.highContrast,
    reduceMotion: values.accessibility?.reduceMotion ?? defaults.reduceMotion,
  };
}

function applyDocumentPreferences(values: PersonalPreferenceValues, persistRegional = true) {
  const normalizedRegional = normalizeRegionalPreference(values.regional);
  const regional = persistRegional
    ? writeRegionalPreference(normalizedRegional)
    : normalizedRegional;
  document.documentElement.dataset.underlineLinks = values.accessibility.underlineLinks
    ? 'always'
    : 'standard';
  document.documentElement.dataset.transparency = values.accessibility.reduceTransparency
    ? 'reduced'
    : 'full';
  document.documentElement.dataset.timeZone = regional.timeZone;
  document.documentElement.dataset.firstDayOfWeek = regional.firstDayOfWeek;
}

function optimisticPreference(
  current: PersonalPreference,
  patch: PersonalPreferencePatch,
  defaults: UserAppearancePreference
): PersonalPreference {
  return {
    ...current,
    customized: true,
    preferences: normalizeValues(mergePatch(current.preferences, patch), defaults),
  };
}

export function PersonalPreferenceProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const providerAccount = isProviderIdentity(auth.user);
  const appearance = useAppearance();
  const appearanceDefaults = appearance.policy.defaults;
  const replaceAppearancePreference = appearance.replacePreference;
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('account');
  const appliedIdentity = useRef<string | null>(null);
  const serverPreference = useRef<PersonalPreference | null>(null);
  const queuedPatch = useRef<PersonalPreferencePatch | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [saveState, setSaveState] = useState<PersonalPreferenceSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [providerPreference, setProviderPreference] = useState<PersonalPreferenceView | null>(null);
  const identity = auth.user
    ? providerAccount
      ? providerRealmPreferenceIdentity(auth.user.userId)
      : `tenant:${auth.user.tenantId}:${auth.user.userId}`
    : null;
  const legacyProviderIdentity = auth.user
    ? `provider:${auth.user.tenantId}:${auth.user.userId}`
    : null;
  const queryKey = useMemo(
    () => ['personal-preference', auth.user?.tenantId, auth.user?.userId] as const,
    [auth.user?.tenantId, auth.user?.userId]
  );
  const preferenceQuery = useQuery({
    queryKey,
    queryFn: async () => normalizePreference(await getPersonalPreference(), appearanceDefaults),
    enabled: Boolean(auth.user) && !providerAccount,
    staleTime: 0,
    retry: 1,
    refetchOnMount: 'always',
  });

  const applyPreference = useCallback(
    (next: PersonalPreference) => {
      queryClient.setQueryData(queryKey, next);
      replaceAppearancePreference(toAppearance(next.preferences, appearanceDefaults));
      applyDocumentPreferences(next.preferences);
    },
    [appearanceDefaults, queryClient, queryKey, replaceAppearancePreference]
  );

  const flushQueue = useCallback(async () => {
    if (inFlight.current || !queuedPatch.current || !serverPreference.current) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    const patch = queuedPatch.current;
    queuedPatch.current = null;
    inFlight.current = true;
    if (mounted.current) setSaveState('saving');
    let base = serverPreference.current;

    try {
      let saved: PersonalPreference;
      try {
        saved = await patchPersonalPreference(patch, base.version);
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 409) throw error;
        base = normalizePreference(await getPersonalPreference(), appearanceDefaults);
        saved = await patchPersonalPreference(patch, base.version);
      }

      const normalized = normalizePreference(saved, appearanceDefaults);
      serverPreference.current = normalized;
      const local = queuedPatch.current
        ? optimisticPreference(normalized, queuedPatch.current, appearanceDefaults)
        : normalized;
      applyPreference(local);
      if (mounted.current) {
        setLastSavedAt(normalized.updatedAt ?? new Date().toISOString());
        setSaveState(queuedPatch.current ? 'saving' : 'saved');
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] });
    } catch {
      queuedPatch.current = null;
      applyPreference(base);
      if (mounted.current) setSaveState('error');
      toast.error(t('personalPreferences.saveError'));
    } finally {
      inFlight.current = false;
      if (queuedPatch.current && mounted.current) {
        saveTimer.current = setTimeout(() => void flushQueue(), 0);
      }
    }
  }, [appearanceDefaults, applyPreference, queryClient, t, toast]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushQueue(), SAVE_DEBOUNCE_MS);
  }, [flushQueue]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!identity) {
      appliedIdentity.current = null;
      serverPreference.current = null;
      queuedPatch.current = null;
      setProviderPreference(null);
      setSaveState('idle');
      return;
    }
    if (appliedIdentity.current !== identity) {
      appliedIdentity.current = identity;
      serverPreference.current = null;
      queuedPatch.current = null;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (providerAccount) {
        const localPreference = readProviderLocalPreference(
          identity,
          legacyProviderIdentity ?? '',
          appearanceDefaults
        );
        setProviderPreference(localPreference);
        replaceAppearancePreference(toAppearance(localPreference.preferences, appearanceDefaults));
        applyDocumentPreferences(localPreference.preferences, false);
        setLastSavedAt(localPreference.updatedAt ?? null);
        setSaveState('idle');
        return;
      }
      setProviderPreference(null);
      replaceAppearancePreference(appearanceDefaults);
      applyDocumentPreferences({
        appearance: { mode: appearanceDefaults.mode, density: appearanceDefaults.density },
        accessibility: {
          highContrast: appearanceDefaults.highContrast,
          reduceMotion: appearanceDefaults.reduceMotion,
          underlineLinks: false,
          reduceTransparency: false,
        },
        regional: defaultRegionalPreference,
      });
    }
    if (providerAccount) return;
    if (preferenceQuery.data && !inFlight.current && !queuedPatch.current) {
      serverPreference.current = preferenceQuery.data;
      replaceAppearancePreference(
        toAppearance(preferenceQuery.data.preferences, appearanceDefaults)
      );
      applyDocumentPreferences(preferenceQuery.data.preferences);
      setLastSavedAt(preferenceQuery.data.updatedAt ?? null);
    }
  }, [
    appearanceDefaults,
    identity,
    preferenceQuery.data,
    providerAccount,
    legacyProviderIdentity,
    replaceAppearancePreference,
  ]);

  const update = useCallback(
    (patch: PersonalPreferencePatch) => {
      if (providerAccount) {
        if (!identity || !providerPreference) return;
        const updatedAt = new Date().toISOString();
        const next = updateProviderLocalPreference(
          identity,
          providerPreference,
          patch,
          appearanceDefaults,
          updatedAt
        );
        setProviderPreference(next);
        replaceAppearancePreference(toAppearance(next.preferences, appearanceDefaults));
        applyDocumentPreferences(next.preferences, false);
        setLastSavedAt(updatedAt);
        setSaveState('saved');
        return;
      }
      const current = queryClient.getQueryData<PersonalPreference>(queryKey);
      if (!current || preferenceQuery.isError) return;
      queuedPatch.current = mergeQueuedPatch(queuedPatch.current, patch);
      applyPreference(optimisticPreference(current, patch, appearanceDefaults));
      setSaveState('saving');
      scheduleSave();
    },
    [
      appearanceDefaults,
      applyPreference,
      identity,
      preferenceQuery.isError,
      providerAccount,
      providerPreference,
      queryClient,
      queryKey,
      replaceAppearancePreference,
      scheduleSave,
    ]
  );

  const reset = useCallback(async () => {
    if (providerAccount) {
      if (!identity) return;
      const next = createProviderLocalPreference(undefined, appearanceDefaults);
      window.localStorage.removeItem(providerPreferenceStorageKey(identity));
      if (legacyProviderIdentity) {
        window.localStorage.removeItem(legacyProviderPreferenceStorageKey(legacyProviderIdentity));
      }
      setProviderPreference(next);
      replaceAppearancePreference(toAppearance(next.preferences, appearanceDefaults));
      applyDocumentPreferences(next.preferences, false);
      setLastSavedAt(null);
      setSaveState('idle');
      return;
    }
    if (!serverPreference.current || inFlight.current || queuedPatch.current) return;
    inFlight.current = true;
    setSaveState('saving');
    const previous = serverPreference.current;
    try {
      const next = normalizePreference(
        await resetPersonalPreference(serverPreference.current.version),
        appearanceDefaults
      );
      serverPreference.current = next;
      applyPreference(
        queuedPatch.current
          ? optimisticPreference(next, queuedPatch.current, appearanceDefaults)
          : next
      );
      setLastSavedAt(new Date().toISOString());
      setSaveState(queuedPatch.current ? 'saving' : 'saved');
    } catch {
      applyPreference(previous);
      setSaveState('error');
      toast.error(t('personalPreferences.saveError'));
    } finally {
      inFlight.current = false;
      if (queuedPatch.current) scheduleSave();
    }
  }, [
    appearanceDefaults,
    applyPreference,
    identity,
    legacyProviderIdentity,
    providerAccount,
    replaceAppearancePreference,
    scheduleSave,
    t,
    toast,
  ]);

  const retry = useCallback(() => {
    if (providerAccount) return;
    void preferenceQuery.refetch();
  }, [preferenceQuery, providerAccount]);

  const value = useMemo<PersonalPreferenceContextValue>(
    () => ({
      preference: providerAccount ? providerPreference : (preferenceQuery.data ?? null),
      isLoading: providerAccount
        ? Boolean(identity) && !providerPreference
        : preferenceQuery.isPending,
      isSaving: saveState === 'saving',
      loadFailed: providerAccount ? false : preferenceQuery.isError,
      saveState,
      lastSavedAt,
      update,
      reset: () => void reset(),
      retry,
    }),
    [
      lastSavedAt,
      identity,
      preferenceQuery.data,
      preferenceQuery.isError,
      preferenceQuery.isPending,
      providerAccount,
      providerPreference,
      reset,
      retry,
      saveState,
      update,
    ]
  );

  return (
    <PersonalPreferenceContext.Provider value={value}>
      {children}
    </PersonalPreferenceContext.Provider>
  );
}

export function usePersonalPreference(): PersonalPreferenceContextValue {
  const value = useContext(PersonalPreferenceContext);
  if (!value) {
    throw new Error('usePersonalPreference must be used within PersonalPreferenceProvider');
  }
  return value;
}
