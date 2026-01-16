// ----------------------------------------------------------------------

const USER_ID_KEY = 'dwp-user-id';

/**
 * Get user ID from localStorage
 */
export function getUserId(): string | null {
  return window.localStorage.getItem(USER_ID_KEY);
}

/**
 * Set user ID to localStorage
 */
export function setUserId(userId: string) {
  window.localStorage.setItem(USER_ID_KEY, userId);
}

/**
 * Clear user ID from localStorage
 */
export function clearUserId() {
  window.localStorage.removeItem(USER_ID_KEY);
}

/**
 * Extract user ID from JWT token payload
 * Note: This is a simple implementation. In production, use a proper JWT library.
 */
export function extractUserIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || payload.userId || payload.user_id || null;
  } catch {
    return null;
  }
}
