export async function fetchSameOriginStaticAsset(
  href: string,
  signal: AbortSignal
): Promise<Response> {
  const origin = globalThis.location?.origin;
  if (!origin) throw new TypeError('A browser origin is required for static assets.');

  const url = new URL(href, origin);
  if (
    url.origin !== origin ||
    !/^https?:$/.test(url.protocol) ||
    !url.pathname.startsWith('/assets/') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new TypeError('Static assets must use a canonical same-origin /assets/ URL.');
  }

  return fetch(url.href, {
    signal,
    credentials: 'omit',
    redirect: 'error',
    mode: 'same-origin',
    cache: 'force-cache',
  });
}
