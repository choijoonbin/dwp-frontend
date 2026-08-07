const ACCESS_TOKEN_KEY = 'dwp.accessToken';
const TOKEN_EVENT = 'dwp-auth-token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

export function clearAccessToken(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

export const authTokenEventName = TOKEN_EVENT;

