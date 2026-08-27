export async function loadLocaleResource(lang: string, namespace: string): Promise<unknown> {
  const module = await import(`../locales/${lang}/${namespace}.json`);
  return module.default;
}
