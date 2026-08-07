import type { Location, NavigateFunction } from 'react-router-dom';

export function safeReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value.startsWith('/sign-in')) return null;
  return value;
}

export function redirectToSignIn(navigate: NavigateFunction, location: Location): void {
  const returnUrl = safeReturnUrl(location.pathname + location.search);
  const target = returnUrl ? '/sign-in?returnUrl=' + encodeURIComponent(returnUrl) : '/sign-in';
  navigate(target, { replace: true });
}
