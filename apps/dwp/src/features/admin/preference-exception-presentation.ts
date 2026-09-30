export type PreferenceExceptionValuePresentation =
  { kind: 'literal'; value: string } | { kind: 'translation'; key: string };

const PATH_LABEL_KEYS: Record<string, string> = {
  'appearance.fontFamily': 'preferenceExceptions.paths.appearance.fontFamily',
  'appearance.accentColor': 'preferenceExceptions.paths.appearance.accentColor',
  'navigation.pattern': 'preferenceExceptions.paths.navigation.pattern',
  'accessibility.highContrast': 'preferenceExceptions.paths.accessibility.highContrast',
  'accessibility.reduceMotion': 'preferenceExceptions.paths.accessibility.reduceMotion',
  'accessibility.underlineLinks': 'preferenceExceptions.paths.accessibility.underlineLinks',
  'accessibility.reduceTransparency': 'preferenceExceptions.paths.accessibility.reduceTransparency',
};

const BOOLEAN_PATHS = new Set([
  'accessibility.highContrast',
  'accessibility.reduceMotion',
  'accessibility.underlineLinks',
  'accessibility.reduceTransparency',
]);

const NAVIGATION_VALUE_KEYS: Record<string, string> = {
  sidebar: 'preferenceExceptions.values.navigation.sidebar',
  rail: 'preferenceExceptions.values.navigation.rail',
  top: 'preferenceExceptions.values.navigation.top',
};

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

const OWNER_LABEL_KEYS: Record<string, string> = {
  TENANT_ADMIN: 'preferenceExceptions.owners.tenantAdmin',
  SETTINGS_ADMIN: 'preferenceExceptions.owners.settingsAdmin',
};

const STATE_PRESENTATIONS: Record<
  string,
  { labelKey: string; color: 'warning' | 'success' | 'error' | 'default' }
> = {
  PENDING: { labelKey: 'preferenceExceptions.states.PENDING', color: 'warning' },
  APPROVED: { labelKey: 'preferenceExceptions.states.APPROVED', color: 'success' },
  REJECTED: { labelKey: 'preferenceExceptions.states.REJECTED', color: 'error' },
  CANCELLED: { labelKey: 'preferenceExceptions.states.CANCELLED', color: 'default' },
  EXPIRED: { labelKey: 'preferenceExceptions.states.EXPIRED', color: 'default' },
};

export function preferenceExceptionStatePresentation(value: string): {
  labelKey: string;
  color: 'warning' | 'success' | 'error' | 'default';
  known: boolean;
} {
  const known = STATE_PRESENTATIONS[value];
  return known
    ? { ...known, known: true }
    : { labelKey: 'preferenceExceptions.states.UNKNOWN', color: 'warning', known: false };
}

export function preferenceExceptionPathLabelKey(path: string): string {
  return PATH_LABEL_KEYS[path] ?? 'preferenceExceptions.paths.unknown';
}

export function preferenceExceptionOwnerLabelKey(ownerRef: string): string {
  return OWNER_LABEL_KEYS[ownerRef] ?? 'preferenceExceptions.owners.managed';
}

export function preferenceExceptionValuePresentation(
  path: string,
  value: unknown
): PreferenceExceptionValuePresentation {
  if (BOOLEAN_PATHS.has(path) && typeof value === 'boolean') {
    return {
      kind: 'translation',
      key: value ? 'preferenceExceptions.values.enabled' : 'preferenceExceptions.values.disabled',
    };
  }
  if (path === 'navigation.pattern' && typeof value === 'string') {
    return {
      kind: 'translation',
      key: NAVIGATION_VALUE_KEYS[value] ?? 'preferenceExceptions.values.unavailable',
    };
  }
  if (
    path === 'appearance.fontFamily' &&
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 80 &&
    !containsControlCharacter(value)
  ) {
    return { kind: 'literal', value };
  }
  if (
    path === 'appearance.accentColor' &&
    typeof value === 'string' &&
    /^#[0-9a-f]{6}$/iu.test(value)
  ) {
    return { kind: 'literal', value: value.toUpperCase() };
  }
  return { kind: 'translation', key: 'preferenceExceptions.values.unavailable' };
}
