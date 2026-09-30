export type EffectiveSettingValuePresentation = {
  labelKey: string;
  count?: number;
};

const KNOWN_SETTING_KEYS = new Set([
  'authentication.defaultLoginType',
  'authentication.requireMfa',
  'authentication.tokenTtlSec',
  'identity.preferredLocale',
]);

const LOCALE_LABELS: Readonly<Record<string, string>> = {
  en: 'settingsHome.overview.governance.effective.values.locales.en',
  'en-US': 'settingsHome.overview.governance.effective.values.locales.en-US',
  ko: 'settingsHome.overview.governance.effective.values.locales.ko',
  'ko-KR': 'settingsHome.overview.governance.effective.values.locales.ko-KR',
};

const unknownValue = (): EffectiveSettingValuePresentation => ({
  labelKey: 'settingsHome.overview.governance.effective.unknownValue',
});

export function isKnownEffectiveSetting(settingKey: string): boolean {
  return KNOWN_SETTING_KEYS.has(settingKey);
}

export function effectiveSettingValuePresentation(
  settingKey: string,
  value: unknown
): EffectiveSettingValuePresentation {
  if (!isKnownEffectiveSetting(settingKey)) return unknownValue();
  if (settingKey === 'authentication.defaultLoginType') {
    if (value !== 'LOCAL' && value !== 'SSO') return unknownValue();
    return {
      labelKey: `settingsHome.overview.governance.effective.values.login.${value}`,
    };
  }
  if (settingKey === 'authentication.requireMfa') {
    if (typeof value !== 'boolean') return unknownValue();
    return {
      labelKey: `settingsHome.overview.governance.effective.values.${value ? 'required' : 'optional'}`,
    };
  }
  if (settingKey === 'authentication.tokenTtlSec') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return unknownValue();
    return {
      labelKey: 'settingsHome.overview.governance.effective.values.minutes',
      count: Math.round(value / 60),
    };
  }
  if (typeof value !== 'string' || !LOCALE_LABELS[value]) return unknownValue();
  return { labelKey: LOCALE_LABELS[value] };
}

export function effectiveSettingSourceLabelKey(source: string): string {
  if (source === 'PROVIDER' || source === 'TENANT' || source === 'USER') {
    return `settingsHome.overview.governance.effective.sources.${source}`;
  }
  return 'settingsHome.overview.governance.effective.sources.UNKNOWN';
}

export function effectiveSettingLineageLabelKey(level: string): string {
  if (level === 'PROVIDER' || level === 'TENANT' || level === 'USER') {
    return `settingsHome.overview.governance.effective.lineage.${level}`;
  }
  return 'settingsHome.overview.governance.effective.lineage.UNKNOWN';
}
