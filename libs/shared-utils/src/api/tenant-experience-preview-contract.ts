import type {
  GovernedHomeZone,
  HomeAppPlacement,
  HomeCompositionPolicy,
  HomeLaunchpadConfiguration,
  HomeLaunchpadGroup,
  LocalizedHomeCopy,
} from './home-experience-api';
import type { TenantExperiencePreview } from './tenant-experience-preview-api';

const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/;
const HEX_COLOR = /^#[\dA-Fa-f]{6}$/;
const LOCALE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const GROUP_KEY = /^[a-z][a-z0-9-]{1,39}$/;
const RESOURCE_KEY = /^[A-Z][A-Z0-9_.-]{2,119}$/;
const ALIGNMENTS = ['LEFT', 'CENTER', 'RIGHT'] as const;
const EXPERIENCE_VARIANTS = ['CLASSIC', 'FLOW_V1'] as const;
const EXCLUDED_DATA = [
  'USER_PERSONALIZATION',
  'USER_CONTENT',
  'WORKFORCE_DATA',
  'LIVE_ANNOUNCEMENTS',
  'ASSET_LOCATIONS',
  'AUDIT_ACTOR_METADATA',
] as const;

export class TenantExperiencePreviewContractError extends Error {
  constructor(path: string, reason: string) {
    super(`Invalid tenant-experience-preview.v1 contract at ${path}: ${reason}`);
    this.name = 'TenantExperiencePreviewContractError';
  }
}

function fail(path: string, reason: string): never {
  throw new TenantExperiencePreviewContractError(path, reason);
}

function record(value: unknown, path: string, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'expected an object');
  }
  const result = value as Record<string, unknown>;
  const unknown = Object.keys(result).filter((key) => !fields.includes(key));
  if (unknown.length > 0) fail(path, `unknown field ${unknown[0]}`);
  const missing = fields.filter((key) => !(key in result));
  if (missing.length > 0) fail(path, `missing field ${missing[0]}`);
  return result;
}

function string(value: unknown, path: string, maximum: number, nullable: true): string | null;
function string(value: unknown, path: string, maximum: number, nullable?: false): string;
function string(value: unknown, path: string, maximum: number, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'string') return fail(path, 'expected a string');
  if (value.length > maximum) return fail(path, `exceeds ${maximum} characters`);
  return value;
}

function nonBlankString(value: unknown, path: string, maximum: number): string {
  const result = string(value, path, maximum);
  if (!result.trim()) return fail(path, 'must not be blank');
  return result;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return fail(path, 'expected a boolean');
  return value;
}

function integer(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    return fail(path, `expected an integer from ${minimum} to ${maximum}`);
  }
  return Number(value);
}

function nullableDimension(value: unknown, path: string): number | null {
  return value === null ? null : integer(value, path, 1, 16_384);
}

function isRfc3339Timestamp(value: string): boolean {
  const match = RFC3339.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second, offsetHour = 0, offsetMinute = 0] = match
    .slice(1)
    .map(Number);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return false;
  }
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= (daysInMonth[month - 1] ?? 0) && Number.isFinite(Date.parse(value));
}

function enumeration<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    return fail(path, `expected one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function localizedStrings(
  value: unknown,
  path: string,
  maximumLength: number,
  required = false
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'expected a localized string map');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if ((required && entries.length === 0) || entries.length > 20) {
    return fail(path, 'must contain between 1 and 20 locales');
  }
  return Object.fromEntries(
    entries.map(([locale, text]) => {
      if (!LOCALE.test(locale)) fail(`${path}.${locale}`, 'invalid locale code');
      const resolved = string(text, `${path}.${locale}`, maximumLength);
      if (required && !resolved.trim()) fail(`${path}.${locale}`, 'must not be blank');
      return [locale, resolved];
    })
  );
}

function localizedCopy(value: unknown, path: string): LocalizedHomeCopy {
  const source = record(value, path, ['headline', 'subheadline']);
  return {
    headline: string(source.headline, `${path}.headline`, 160, true),
    subheadline: string(source.subheadline, `${path}.subheadline`, 500, true),
  };
}

function localizedContent(value: unknown, path: string): Record<string, LocalizedHomeCopy> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'expected a localized content map');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 20) fail(path, 'exceeds 20 locales');
  return Object.fromEntries(
    entries.map(([locale, copy]) => {
      if (!LOCALE.test(locale)) fail(`${path}.${locale}`, 'invalid locale code');
      return [locale, localizedCopy(copy, `${path}.${locale}`)];
    })
  );
}

function launchpadGroup(value: unknown, path: string): HomeLaunchpadGroup {
  const source = record(value, path, [
    'groupKey',
    'labels',
    'descriptions',
    'sortOrder',
    'enabled',
  ]);
  const groupKey = nonBlankString(source.groupKey, `${path}.groupKey`, 40);
  if (!GROUP_KEY.test(groupKey)) fail(`${path}.groupKey`, 'invalid group key');
  return {
    groupKey,
    labels: localizedStrings(source.labels, `${path}.labels`, 80, true),
    descriptions: localizedStrings(source.descriptions, `${path}.descriptions`, 200),
    sortOrder: integer(source.sortOrder, `${path}.sortOrder`, 0, 10_000),
    enabled: boolean(source.enabled, `${path}.enabled`),
  };
}

function appPlacement(value: unknown, path: string): HomeAppPlacement {
  const source = record(value, path, ['resourceKey', 'groupKey', 'sortOrder']);
  const resourceKey = nonBlankString(source.resourceKey, `${path}.resourceKey`, 120);
  if (!RESOURCE_KEY.test(resourceKey)) fail(`${path}.resourceKey`, 'invalid resource key');
  const groupKey = nonBlankString(source.groupKey, `${path}.groupKey`, 40);
  if (!GROUP_KEY.test(groupKey)) fail(`${path}.groupKey`, 'invalid group key');
  return {
    resourceKey,
    groupKey,
    sortOrder: integer(source.sortOrder, `${path}.sortOrder`, 0, 10_000),
  };
}

function launchpad(value: unknown, path: string): HomeLaunchpadConfiguration {
  const source = record(value, path, ['schemaVersion', 'groups', 'placements']);
  if (source.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'expected version 1');
  if (!Array.isArray(source.groups) || source.groups.length < 1 || source.groups.length > 8) {
    return fail(`${path}.groups`, 'must contain between 1 and 8 groups');
  }
  if (!Array.isArray(source.placements) || source.placements.length > 200) {
    return fail(`${path}.placements`, 'must contain at most 200 placements');
  }
  const groups = source.groups.map((group, index) =>
    launchpadGroup(group, `${path}.groups[${index}]`)
  );
  const placements = source.placements.map((placement, index) =>
    appPlacement(placement, `${path}.placements[${index}]`)
  );
  const groupKeys = new Set(groups.map((group) => group.groupKey));
  if (groupKeys.size !== groups.length) fail(`${path}.groups`, 'group keys must be unique');
  if (!groups.some((group) => group.enabled)) fail(`${path}.groups`, 'one group must be enabled');
  const resources = new Set(placements.map((placement) => placement.resourceKey));
  if (resources.size !== placements.length) {
    fail(`${path}.placements`, 'resource keys must be unique');
  }
  placements.forEach((placement, index) => {
    if (!groupKeys.has(placement.groupKey)) {
      fail(`${path}.placements[${index}].groupKey`, 'references an unknown group');
    }
  });
  return { schemaVersion: 1, groups, placements };
}

function governedZone(value: unknown, path: string): GovernedHomeZone {
  const source = record(value, path, [
    'zoneKey',
    'placement',
    'visible',
    'size',
    'height',
    'sortOrder',
  ]);
  if (source.zoneKey !== 'announcements') fail(`${path}.zoneKey`, 'unknown governed zone');
  if (source.placement !== 'CANVAS') fail(`${path}.placement`, 'invalid governed placement');
  return {
    zoneKey: 'announcements',
    placement: 'CANVAS',
    visible: boolean(source.visible, `${path}.visible`),
    size: enumeration(source.size, `${path}.size`, ['compact', 'medium', 'large', 'full']),
    height: enumeration(source.height, `${path}.height`, ['short', 'standard']),
    sortOrder: integer(source.sortOrder, `${path}.sortOrder`, 0, 10_000),
  };
}

function compositionPolicy(value: unknown, path: string): HomeCompositionPolicy {
  const source = record(value, path, [
    'schemaVersion',
    'experienceVariant',
    'personalCustomizationEnabled',
    'governedZones',
  ]);
  if (source.schemaVersion !== 3) fail(`${path}.schemaVersion`, 'expected version 3');
  if (!Array.isArray(source.governedZones) || source.governedZones.length > 1) {
    return fail(`${path}.governedZones`, 'invalid governed zone count');
  }
  const governedZones = source.governedZones.map((zone, index) =>
    governedZone(zone, `${path}.governedZones[${index}]`)
  );
  return {
    schemaVersion: 3,
    experienceVariant: enumeration(
      source.experienceVariant,
      `${path}.experienceVariant`,
      EXPERIENCE_VARIANTS
    ),
    personalCustomizationEnabled: boolean(
      source.personalCustomizationEnabled,
      `${path}.personalCustomizationEnabled`
    ),
    governedZones,
  };
}

function decodeBranding(value: unknown): TenantExperiencePreview['branding'] {
  const source = record(value, 'branding', [
    'organizationName',
    'accentColor',
    'logoConfigured',
    'logoWidth',
    'logoHeight',
    'version',
  ]);
  const accentColor = nonBlankString(source.accentColor, 'branding.accentColor', 7);
  if (!HEX_COLOR.test(accentColor)) fail('branding.accentColor', 'invalid hex color');
  return {
    organizationName: string(source.organizationName, 'branding.organizationName', 160, true),
    accentColor,
    logoConfigured: boolean(source.logoConfigured, 'branding.logoConfigured'),
    logoWidth: nullableDimension(source.logoWidth, 'branding.logoWidth'),
    logoHeight: nullableDimension(source.logoHeight, 'branding.logoHeight'),
    version: integer(source.version, 'branding.version', 0, Number.MAX_SAFE_INTEGER),
  };
}

function decodeHome(value: unknown): TenantExperiencePreview['home'] {
  const source = record(value, 'home', [
    'headline',
    'subheadline',
    'localizedContent',
    'defaultLocale',
    'backgroundConfigured',
    'backgroundPosition',
    'backgroundFocalX',
    'backgroundFocalY',
    'mobileBackgroundFocalX',
    'mobileBackgroundFocalY',
    'contentAlignment',
    'overlayOpacity',
    'backgroundWidth',
    'backgroundHeight',
    'launchpadConfiguration',
    'compositionPolicy',
    'effectiveExperienceVariant',
    'version',
  ]);
  const defaultLocale = nonBlankString(source.defaultLocale, 'home.defaultLocale', 35);
  if (!LOCALE.test(defaultLocale)) fail('home.defaultLocale', 'invalid locale code');
  return {
    headline: string(source.headline, 'home.headline', 160, true),
    subheadline: string(source.subheadline, 'home.subheadline', 500, true),
    localizedContent: localizedContent(source.localizedContent, 'home.localizedContent'),
    defaultLocale,
    backgroundConfigured: boolean(source.backgroundConfigured, 'home.backgroundConfigured'),
    backgroundPosition: enumeration(
      source.backgroundPosition,
      'home.backgroundPosition',
      ALIGNMENTS
    ),
    backgroundFocalX: integer(source.backgroundFocalX, 'home.backgroundFocalX', 0, 100),
    backgroundFocalY: integer(source.backgroundFocalY, 'home.backgroundFocalY', 0, 100),
    mobileBackgroundFocalX: integer(
      source.mobileBackgroundFocalX,
      'home.mobileBackgroundFocalX',
      0,
      100
    ),
    mobileBackgroundFocalY: integer(
      source.mobileBackgroundFocalY,
      'home.mobileBackgroundFocalY',
      0,
      100
    ),
    contentAlignment: enumeration(source.contentAlignment, 'home.contentAlignment', ALIGNMENTS),
    overlayOpacity: integer(source.overlayOpacity, 'home.overlayOpacity', 0, 70),
    backgroundWidth: nullableDimension(source.backgroundWidth, 'home.backgroundWidth'),
    backgroundHeight: nullableDimension(source.backgroundHeight, 'home.backgroundHeight'),
    launchpadConfiguration: launchpad(source.launchpadConfiguration, 'home.launchpadConfiguration'),
    compositionPolicy: compositionPolicy(source.compositionPolicy, 'home.compositionPolicy'),
    effectiveExperienceVariant: enumeration(
      source.effectiveExperienceVariant,
      'home.effectiveExperienceVariant',
      EXPERIENCE_VARIANTS
    ),
    version: integer(source.version, 'home.version', 0, Number.MAX_SAFE_INTEGER),
  };
}

export function decodeTenantExperiencePreview(value: unknown): TenantExperiencePreview {
  const source = record(value, '$', [
    'contractVersion',
    'previewMode',
    'generatedAt',
    'branding',
    'home',
    'excludedData',
  ]);
  if (source.contractVersion !== 'tenant-experience-preview.v1') {
    fail('$.contractVersion', 'unsupported contract version');
  }
  if (source.previewMode !== 'TENANT_CONFIGURATION_ONLY') {
    fail('$.previewMode', 'unsupported preview mode');
  }
  const generatedAt = nonBlankString(source.generatedAt, '$.generatedAt', 40);
  if (!isRfc3339Timestamp(generatedAt)) {
    fail('$.generatedAt', 'expected an RFC3339 timestamp');
  }
  if (!Array.isArray(source.excludedData)) fail('$.excludedData', 'expected an array');
  const excludedData = source.excludedData.map((code, index) =>
    enumeration(code, `$.excludedData[${index}]`, EXCLUDED_DATA)
  );
  if (
    new Set(excludedData).size !== EXCLUDED_DATA.length ||
    EXCLUDED_DATA.some((code) => !excludedData.includes(code))
  ) {
    fail('$.excludedData', 'must contain the complete exclusion registry');
  }
  return {
    contractVersion: 'tenant-experience-preview.v1',
    previewMode: 'TENANT_CONFIGURATION_ONLY',
    generatedAt,
    branding: decodeBranding(source.branding),
    home: decodeHome(source.home),
    excludedData,
  };
}
