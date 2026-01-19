// ----------------------------------------------------------------------

/**
 * Build returnUrl from current location
 * @param location - Current location object (from react-router)
 * @returns Safe returnUrl string (internal path only)
 */
export function buildReturnUrl(location: { pathname: string; search?: string }): string {
  const { pathname, search } = location;
  // Exclude sign-in and 403 pages from returnUrl
  if (pathname === '/sign-in' || pathname === '/403' || pathname === '/404') {
    return '/';
  }
  return pathname + (search || '');
}

/**
 * Validate and sanitize returnUrl to prevent open redirect attacks
 * Only allows same-origin internal paths
 * @param value - returnUrl value from query string
 * @returns Safe internal path or null if invalid
 */
export function safeReturnUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  // Remove leading/trailing whitespace
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Reject external URLs (http://, https://, //)
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('//')
  ) {
    return null;
  }

  // Reject paths starting with /../ or containing ../
  if (trimmed.includes('../')) {
    return null;
  }

  // Only allow paths starting with /
  if (!trimmed.startsWith('/')) {
    return null;
  }

  // Reject sign-in and error pages as returnUrl
  if (trimmed === '/sign-in' || trimmed === '/403' || trimmed === '/404') {
    return null;
  }

  return trimmed;
}

/**
 * Redirect to sign-in page with returnUrl
 * @param navigate - Navigate function from react-router
 * @param location - Current location object
 * @param returnUrl - Optional returnUrl (if not provided, will be built from location)
 */
export function redirectToSignIn(
  navigate: (to: string) => void,
  location: { pathname: string; search?: string },
  returnUrl?: string | null
): void {
  const safeUrl = returnUrl || buildReturnUrl(location);
  const query = safeUrl && safeUrl !== '/' ? `?returnUrl=${encodeURIComponent(safeUrl)}` : '';
  navigate(`/sign-in${query}`);
}
