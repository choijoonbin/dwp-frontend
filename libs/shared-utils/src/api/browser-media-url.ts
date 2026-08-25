/**
 * Tenant media is served through authenticated gateway routes with a
 * same-origin resource policy. Keep gateway-relative paths on the current
 * origin so browsers do not reject otherwise valid images as cross-origin
 * embeds when VITE_API_URL points at a separate development origin.
 */
export function resolveBrowserMediaUrl(value: string): string {
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:')) {
    return value;
  }
  return value.startsWith('/') ? value : `/${value}`;
}
