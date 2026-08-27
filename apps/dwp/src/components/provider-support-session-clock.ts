import { useEffect, useState } from 'react';
import { formatRelativeTime, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const CLOCK_REFRESH_MS = 30_000;

export function providerSupportRemainingTime(
  expiresAt: string,
  language?: string,
  now = Date.now()
): string {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) return '—';
  const remaining = Math.max(0, expiry - now);
  const locale = resolveSupportedLocale(language);
  if (remaining < HOUR_MS) {
    return formatRelativeTime(
      Math.ceil(remaining / MINUTE_MS),
      'minute',
      { numeric: 'always' },
      locale
    );
  }
  if (remaining < DAY_MS) {
    return formatRelativeTime(
      Math.ceil(remaining / HOUR_MS),
      'hour',
      { numeric: 'always' },
      locale
    );
  }
  return formatRelativeTime(Math.ceil(remaining / DAY_MS), 'day', { numeric: 'always' }, locale);
}

export function useProviderSupportClock(expiresAt: string): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), CLOCK_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  return now;
}
