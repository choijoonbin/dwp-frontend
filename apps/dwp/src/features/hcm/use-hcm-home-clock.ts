import { useEffect, useState } from 'react';

export const HCM_HOME_CLOCK_REFRESH_MS = 30_000;

/**
 * Keeps freshness and tenant-local business dates honest while the HRIS home
 * remains open. Focus/visibility refreshes cover suspended background tabs.
 */
export function useHcmHomeClock(): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const timer = window.setInterval(refresh, HCM_HOME_CLOCK_REFRESH_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, []);

  return now;
}
