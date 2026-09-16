import {
  HOME_DEVICE_CLASSES,
  isLegacyHomeDeviceClass,
  normalizeHomeDeviceClass,
} from '@dwp-frontend/shared-utils';

import type { HomeDeviceLayout, HomeView } from '@dwp-frontend/shared-utils';

export type HomeViewConflict = Readonly<{
  expectedVersion?: number;
  actualVersion?: number;
  expectedDeviceVersion?: number | null;
  actualDeviceVersion?: number | null;
  latestDeviceLayout?: HomeDeviceLayout;
  latestView?: HomeView;
  changedFields: readonly string[];
  operation?: string;
}>;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finiteVersion(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function homeView(value: unknown): HomeView | undefined {
  const candidate = record(value);
  if (
    !candidate ||
    typeof candidate.viewId !== 'string' ||
    typeof candidate.viewKey !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.version !== 'number' ||
    !record(candidate.layout) ||
    !Array.isArray(record(candidate.layout)?.widgets)
  ) {
    return undefined;
  }
  return candidate as HomeView;
}

function deviceLayout(value: unknown): HomeDeviceLayout | undefined {
  const candidate = record(value);
  const deviceClass = candidate?.deviceClass;
  if (
    !candidate ||
    typeof candidate.viewId !== 'string' ||
    typeof deviceClass !== 'string' ||
    (!HOME_DEVICE_CLASSES.includes(deviceClass as HomeDeviceLayout['deviceClass']) &&
      !isLegacyHomeDeviceClass(deviceClass)) ||
    typeof candidate.version !== 'number' ||
    !record(candidate.overlay)
  ) {
    return undefined;
  }
  return {
    ...(candidate as HomeDeviceLayout),
    deviceClass: normalizeHomeDeviceClass(
      deviceClass as HomeDeviceLayout['deviceClass'] | 'DESKTOP' | 'MOBILE'
    ),
  };
}

function nullableVersion(value: unknown): number | null | undefined {
  return value === null ? null : finiteVersion(value);
}

/**
 * Home conflicts have shipped in both a direct error body and the shared API envelope.
 * Keep the reader tolerant during the rolling backend deployment while validating the
 * fields that drive the recovery UI.
 */
export function parseHomeViewConflict(details: unknown): HomeViewConflict | null {
  const envelope = record(details);
  if (!envelope) return null;
  const payload =
    record(envelope.data)?.conflict ??
    record(envelope.data) ??
    record(envelope.details)?.conflict ??
    record(envelope.details) ??
    envelope.conflict ??
    envelope;
  const conflict = record(payload);
  if (!conflict) return null;

  const code = [envelope.errorCode, envelope.code, conflict.errorCode, conflict.code]
    .find((value): value is string => typeof value === 'string')
    ?.toUpperCase();
  const expectedVersion = finiteVersion(conflict.expectedVersion);
  const actualVersion =
    finiteVersion(conflict.actualVersion) ??
    finiteVersion(conflict.latestVersion) ??
    finiteVersion(record(conflict.latestView)?.version);
  const changedFields = Array.isArray(conflict.changedFields)
    ? conflict.changedFields.filter(
        (field): field is string => typeof field === 'string' && field.trim().length > 0
      )
    : [];
  const latestView = homeView(conflict.latestView);
  const latestDeviceLayout = deviceLayout(conflict.latestDeviceLayout);
  const actualDeviceVersion = nullableVersion(conflict.actualDeviceVersion);
  const recognized =
    code?.includes('CONFLICT') ||
    expectedVersion !== undefined ||
    actualVersion !== undefined ||
    latestView !== undefined;
  if (!recognized) return null;

  return {
    expectedVersion,
    actualVersion,
    expectedDeviceVersion: nullableVersion(conflict.expectedDeviceVersion),
    actualDeviceVersion:
      actualDeviceVersion !== undefined ? actualDeviceVersion : latestDeviceLayout?.version,
    latestDeviceLayout,
    latestView,
    changedFields,
    operation: typeof conflict.operation === 'string' ? conflict.operation : undefined,
  };
}
