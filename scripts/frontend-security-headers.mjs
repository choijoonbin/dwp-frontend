export function trustedHttpOrigin(value) {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return '';
    }
    return url.origin;
  } catch {
    return '';
  }
}

export function trustedWebSocketOrigin(value, allowInsecure = false) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'wss:' && !(allowInsecure && url.protocol === 'ws:')) return '';
    if (!url.hostname || url.username || url.password) return '';
    return url.origin;
  } catch {
    return '';
  }
}

export function securityHeaders(development = false, apiOrigin = '', realtimeOrigin = '') {
  const trustedApiSource = apiOrigin ? ` ${apiOrigin}` : '';
  const trustedRealtimeSource = realtimeOrigin ? ` ${realtimeOrigin}` : '';
  return {
    'Content-Security-Policy':
      `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'${development ? " 'unsafe-inline'" : ''}; ` +
      "style-src 'self' 'unsafe-inline'; " +
      `img-src 'self' data: blob:${trustedApiSource}; font-src 'self' data:; ` +
      `connect-src 'self'${development ? ' ws:' : ''}${trustedApiSource}${trustedRealtimeSource}; ` +
      "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    'Permissions-Policy':
      'camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}
