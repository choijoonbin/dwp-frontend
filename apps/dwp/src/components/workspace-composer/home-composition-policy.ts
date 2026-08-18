import type {
  GovernedHomeZone,
  HomeCompositionPolicy,
  HomeGovernedZoneKey,
  HomePersonalZoneKey,
  HomeWidgetHeight,
  HomeWidgetSize,
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

export function defaultHomeCompositionPolicy(): HomeCompositionPolicy {
  return {
    schemaVersion: 2,
    personalCustomizationEnabled: true,
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
  const candidate = value as Partial<HomeCompositionPolicy>;
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
    schemaVersion: 2,
    personalCustomizationEnabled: candidate.personalCustomizationEnabled === true,
    governedZones: zones,
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
