export type ProductDateLocale = 'en' | 'ko';

export function resolveProductDateLocale(locale: string | undefined): ProductDateLocale {
  return locale?.toLowerCase().split('-')[0] === 'ko' ? 'ko' : 'en';
}

export function isValidTimeZone(value: string | undefined): value is string {
  if (!value?.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function resolveProductTimeZone(...candidates: Array<string | null | undefined>): string {
  const configured = candidates.find((candidate) => isValidTimeZone(candidate ?? undefined));
  if (configured) return configured;
  const system = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(system) ? system : 'UTC';
}
