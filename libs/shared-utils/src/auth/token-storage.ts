// ----------------------------------------------------------------------

const ACCESS_TOKEN_KEY = 'dwp-access-token';

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  window.dispatchEvent(new Event('dwp-auth-token'));
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.dispatchEvent(new Event('dwp-auth-token'));
}

