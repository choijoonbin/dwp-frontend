import type {
  PersonalPreferencePatch,
  PersonalPreferenceValues,
} from '@dwp-frontend/shared-utils/api/personal-preference-api';

export type PersonalPreferenceConflictChoice = 'local' | 'remote';

export type PersonalPreferenceConflict = {
  path: string;
  baseValue: unknown;
  localValue: unknown;
  remoteValue: unknown;
};

type PatchEntry = {
  path: string;
  value: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === undefined || right === undefined) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

function flattenPatch(value: unknown, prefix = ''): PatchEntry[] {
  if (!isRecord(value)) return prefix ? [{ path: prefix, value }] : [];

  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isRecord(child) ? flattenPatch(child, path) : [{ path, value: child }];
  });
}

function valueAtPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) return undefined;
    return current[key];
  }, source);
}

function setPatchValue(target: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split('.');
  let cursor = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    const next = cursor[segment];
    if (!isRecord(next)) cursor[segment] = {};
    cursor = cursor[segment] as Record<string, unknown>;
  });
}

export function findPersonalPreferenceConflicts(
  base: PersonalPreferenceValues,
  remote: PersonalPreferenceValues,
  patch: PersonalPreferencePatch
): PersonalPreferenceConflict[] {
  return flattenPatch(patch).flatMap(({ path, value: localValue }) => {
    const baseValue = valueAtPath(base, path);
    const remoteValue = valueAtPath(remote, path);
    if (sameValue(baseValue, remoteValue) || sameValue(localValue, remoteValue)) return [];
    return [{ path, baseValue, localValue, remoteValue }];
  });
}

export function resolvePersonalPreferenceConflictPatch(
  patch: PersonalPreferencePatch,
  choices: Readonly<Record<string, PersonalPreferenceConflictChoice>>
): PersonalPreferencePatch | null {
  const resolved: Record<string, unknown> = {};
  flattenPatch(patch).forEach(({ path, value }) => {
    if (choices[path] === 'remote') return;
    setPatchValue(resolved, path, value);
  });
  return Object.keys(resolved).length > 0 ? (resolved as PersonalPreferencePatch) : null;
}

export function buildPersonalPreferenceUndoPatch(
  before: PersonalPreferenceValues,
  appliedPatch: PersonalPreferencePatch
): PersonalPreferencePatch | null {
  const reverse: Record<string, unknown> = {};
  flattenPatch(appliedPatch).forEach(({ path }) => {
    const previousValue = valueAtPath(before, path);
    setPatchValue(reverse, path, previousValue === undefined ? null : previousValue);
  });
  return Object.keys(reverse).length > 0 ? (reverse as PersonalPreferencePatch) : null;
}
