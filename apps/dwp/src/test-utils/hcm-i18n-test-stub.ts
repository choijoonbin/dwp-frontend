import hcm from '@dwp-frontend/shared-i18n/locales/en/hcm.json';
import workforce from '@dwp-frontend/shared-i18n/locales/en/workforce.json';

type TranslationOptions = Readonly<Record<string, unknown>>;

function translate(
  resource: Readonly<Record<string, unknown>>,
  key: string,
  options: TranslationOptions
): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (current, segment) =>
        current && typeof current === 'object'
          ? (current as Readonly<Record<string, unknown>>)[segment]
          : undefined,
      resource
    );
  if (typeof value !== 'string') return key;
  return value.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/gu, (_match, name: string) =>
    options[name] === undefined ? `{{${name}}}` : String(options[name])
  );
}

export function hcmTestTranslation(key: string, options: TranslationOptions = {}): string {
  return translate(hcm, key, options);
}

export function hcmTestUseTranslation(namespace?: string | readonly string[]) {
  const namespaces = Array.isArray(namespace) ? namespace : [namespace];
  const resource = namespaces.includes('workforce') ? workforce : hcm;
  return {
    t: (key: string, options: TranslationOptions = {}) => translate(resource, key, options),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  };
}
