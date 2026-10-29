import type { TFunction } from 'i18next';

type TranslationValue = string | number | null | undefined;

/** Keeps isolated renders readable while the application i18n provider is still mounting. */
export function translatePerformance(
  t: TFunction<'hcm'>,
  key: string,
  defaultValue: string,
  values: Readonly<Record<string, TranslationValue>> = {}
): string {
  const translated = String(t(key, { defaultValue, ...values }));
  return translated.replace(/\{\{\s*([\w.-]+)\s*\}\}/gu, (placeholder, name: string) => {
    const value = values[name];
    return value === null || value === undefined ? placeholder : String(value);
  });
}
