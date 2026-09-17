import {
  createHomeModeLayouts,
  HOME_EXPERIENCE_VARIANTS,
  isHomeModeLayouts,
} from '@dwp-frontend/shared-utils';

import type {
  GovernedHomeZone,
  HomeCompositionPolicy,
  HomeCompositionPolicyPayload,
  HomeExperienceVariant,
  HomeGovernedZoneKey,
  HomePersonalZoneKey,
  HomeWidgetHeight,
  HomeWidgetSize,
  TenantHomeCompositionPolicyV3,
} from '@dwp-frontend/shared-utils';

export type HomeGovernedZoneDefinition = Readonly<{
  key: HomeGovernedZoneKey;
  placement: 'HERO' | 'CANVAS';
  defaultSize: HomeWidgetSize;
  allowedSizes: readonly HomeWidgetSize[];
  defaultHeight: HomeWidgetHeight;
  allowedHeights: readonly HomeWidgetHeight[];
  defaultOrder: number;
  manifest: Readonly<{
    owner: string;
    dataSource: string;
    privacyClass: 'INTERNAL' | 'CONFIDENTIAL';
  }>;
}>;

export const HOME_GOVERNED_ZONE_REGISTRY: readonly HomeGovernedZoneDefinition[] = [
  {
    key: 'announcements',
    placement: 'CANVAS',
    defaultSize: 'compact',
    allowedSizes: ['compact', 'medium', 'large', 'full'],
    defaultHeight: 'short',
    allowedHeights: ['short', 'standard'],
    defaultOrder: 20,
    manifest: {
      owner: 'Employee Communications',
      dataSource: 'DWP_COMMUNICATIONS',
      privacyClass: 'INTERNAL',
    },
  },
];

export const HOME_PERSONAL_ZONE_KEYS: readonly HomePersonalZoneKey[] = ['workspace-tools'];

export const HOME_GOVERNED_ZONE_KEYS: readonly HomeGovernedZoneKey[] =
  HOME_GOVERNED_ZONE_REGISTRY.map((zone) => zone.key);

const definitionByKey = new Map(HOME_GOVERNED_ZONE_REGISTRY.map((zone) => [zone.key, zone]));

function normalizeModeLayouts(value: unknown): {
  layouts: HomeCompositionPolicy['modeLayouts'];
  implicitAllowedModes: HomeExperienceVariant[];
} | null {
  if (isHomeModeLayouts(value)) {
    return { layouts: structuredClone(value), implicitAllowedModes: [...HOME_EXPERIENCE_VARIANTS] };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    Object.keys(candidate).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(candidate, 'CLASSIC') ||
    !Object.prototype.hasOwnProperty.call(candidate, 'FLOW_V1')
  ) {
    return null;
  }
  const upgraded = {
    ...createHomeModeLayouts(),
    CLASSIC: candidate.CLASSIC,
    FLOW_V1: candidate.FLOW_V1,
  };
  return isHomeModeLayouts(upgraded)
    ? { layouts: upgraded, implicitAllowedModes: ['CLASSIC', 'FLOW_V1'] }
    : null;
}

export function defaultHomeCompositionPolicy(): HomeCompositionPolicy {
  return {
    schemaVersion: 4,
    experienceVariant: 'CLASSIC',
    allowedModes: [...HOME_EXPERIENCE_VARIANTS],
    defaultMode: 'CLASSIC',
    personalCustomizationEnabled: true,
    modeLayouts: createHomeModeLayouts(),
    governedZones: HOME_GOVERNED_ZONE_REGISTRY.map((definition) => ({
      zoneKey: definition.key,
      placement: definition.placement,
      visible: true,
      size: definition.defaultSize as GovernedHomeZone['size'],
      height: definition.defaultHeight,
      sortOrder: definition.defaultOrder,
    })),
  };
}

export function failClosedHomeCompositionPolicy(): HomeCompositionPolicy {
  return {
    ...defaultHomeCompositionPolicy(),
    personalCustomizationEnabled: false,
  };
}

export function reconcileHomeCompositionPolicy(value: unknown): HomeCompositionPolicy {
  const fallback = defaultHomeCompositionPolicy();
  if (!value || typeof value !== 'object') return failClosedHomeCompositionPolicy();
  const candidate = value as Partial<HomeCompositionPolicyPayload> & {
    schemaVersion?: unknown;
    experienceVariant?: unknown;
    allowedModes?: unknown;
    defaultMode?: unknown;
    modeLayouts?: unknown;
  };
  const supportedSchema =
    candidate.schemaVersion === 1 ||
    candidate.schemaVersion === 2 ||
    candidate.schemaVersion === 3 ||
    candidate.schemaVersion === 4;
  if (!supportedSchema) return failClosedHomeCompositionPolicy();
  const hasVariant = candidate.schemaVersion === 3 || candidate.schemaVersion === 4;
  const legacyExperienceVariant: HomeExperienceVariant =
    hasVariant &&
    (candidate.experienceVariant === 'FLOW_V1' || candidate.experienceVariant === 'MZ_V1')
      ? candidate.experienceVariant
      : 'CLASSIC';
  const normalizedModeLayouts = normalizeModeLayouts(candidate.modeLayouts);
  const requestedAllowedModes = Array.isArray(candidate.allowedModes)
    ? candidate.allowedModes.filter(
        (mode): mode is HomeExperienceVariant =>
          typeof mode === 'string' &&
          HOME_EXPERIENCE_VARIANTS.includes(mode as HomeExperienceVariant)
      )
    : [];
  const allowedModes = [
    ...new Set(
      requestedAllowedModes.length > 0
        ? requestedAllowedModes
        : candidate.schemaVersion === 4 && normalizedModeLayouts
          ? normalizedModeLayouts.implicitAllowedModes
          : candidate.schemaVersion === 4
            ? HOME_EXPERIENCE_VARIANTS
            : (['CLASSIC', legacyExperienceVariant] as const)
    ),
  ];
  const defaultMode: HomeExperienceVariant =
    typeof candidate.defaultMode === 'string' &&
    HOME_EXPERIENCE_VARIANTS.includes(candidate.defaultMode as HomeExperienceVariant) &&
    allowedModes.includes(candidate.defaultMode as HomeExperienceVariant)
      ? (candidate.defaultMode as HomeExperienceVariant)
      : allowedModes.includes(legacyExperienceVariant)
        ? legacyExperienceVariant
        : allowedModes[0]!;
  const experienceVariant = defaultMode;
  const invalidVersionedVariant =
    hasVariant &&
    candidate.experienceVariant !== 'CLASSIC' &&
    candidate.experienceVariant !== 'FLOW_V1' &&
    candidate.experienceVariant !== 'MZ_V1';
  const invalidModePolicy =
    candidate.schemaVersion === 4 &&
    ((candidate.allowedModes !== undefined &&
      (!Array.isArray(candidate.allowedModes) ||
        candidate.allowedModes.length === 0 ||
        requestedAllowedModes.length !== candidate.allowedModes.length)) ||
      (candidate.defaultMode !== undefined &&
        (!HOME_EXPERIENCE_VARIANTS.includes(candidate.defaultMode as HomeExperienceVariant) ||
          !allowedModes.includes(candidate.defaultMode as HomeExperienceVariant))));
  const invalidModeLayouts = candidate.schemaVersion === 4 && normalizedModeLayouts === null;
  const requested = Array.isArray(candidate.governedZones) ? candidate.governedZones : [];
  const used = new Set<HomeGovernedZoneKey>();
  const zones: GovernedHomeZone[] = [];

  requested.forEach((zone) => {
    if (!zone || typeof zone !== 'object') return;
    const definition = definitionByKey.get(zone.zoneKey as HomeGovernedZoneKey);
    if (!definition || used.has(definition.key)) return;
    used.add(definition.key);
    zones.push({
      zoneKey: definition.key,
      placement: definition.placement,
      visible: zone.visible !== false,
      size: definition.allowedSizes.includes(zone.size as HomeWidgetSize)
        ? (zone.size as GovernedHomeZone['size'])
        : (definition.defaultSize as GovernedHomeZone['size']),
      height: definition.allowedHeights.includes(zone.height as HomeWidgetHeight)
        ? (zone.height as HomeWidgetHeight)
        : definition.defaultHeight,
      sortOrder:
        Number.isInteger(zone.sortOrder) &&
        (zone.sortOrder ?? -1) >= 0 &&
        (zone.sortOrder ?? 10_001) <= 10_000
          ? zone.sortOrder
          : definition.defaultOrder,
    });
  });

  fallback.governedZones.forEach((zone) => {
    if (!used.has(zone.zoneKey)) zones.push(zone);
  });
  zones.sort(
    (left, right) => left.sortOrder - right.sortOrder || left.zoneKey.localeCompare(right.zoneKey)
  );
  return {
    schemaVersion: 4,
    experienceVariant,
    allowedModes,
    defaultMode,
    personalCustomizationEnabled:
      !invalidVersionedVariant &&
      !invalidModePolicy &&
      !invalidModeLayouts &&
      candidate.personalCustomizationEnabled === true,
    governedZones: zones,
    modeLayouts: normalizedModeLayouts?.layouts ?? createHomeModeLayouts(),
  };
}

export function isFlowHomeVariant(policy: HomeCompositionPolicy): boolean {
  return policy.schemaVersion === 4 && policy.experienceVariant === 'FLOW_V1';
}

export function isMzHomeVariant(policy: HomeCompositionPolicy): boolean {
  return policy.schemaVersion === 4 && policy.experienceVariant === 'MZ_V1';
}

export function homeCompositionPolicyWritePayload(
  policy: HomeCompositionPolicy,
  v4Supported: boolean
): HomeCompositionPolicy | TenantHomeCompositionPolicyV3 {
  if (v4Supported) return policy;
  return {
    schemaVersion: 3,
    experienceVariant: policy.experienceVariant,
    personalCustomizationEnabled: policy.personalCustomizationEnabled,
    governedZones: policy.governedZones,
  };
}

export function governedHomeZone(
  policy: HomeCompositionPolicy,
  zoneKey: HomeGovernedZoneKey
): GovernedHomeZone {
  return (
    policy.governedZones.find((zone) => zone.zoneKey === zoneKey) ??
    defaultHomeCompositionPolicy().governedZones.find((zone) => zone.zoneKey === zoneKey)!
  );
}
