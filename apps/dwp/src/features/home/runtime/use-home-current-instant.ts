import { useEffect, useState } from 'react';
import { HOME_NOTIFICATION_BADGE_FRESHNESS_MS } from '../home-app-badge-policy';

export function useHomeCurrentInstant() {
  const [currentInstant, setCurrentInstant] = useState(() => new Date());

  useEffect(() => {
    const refreshClock = () => setCurrentInstant(new Date());
    const timer = window.setInterval(refreshClock, HOME_NOTIFICATION_BADGE_FRESHNESS_MS);
    const refreshVisibleClock = () => {
      if (document.visibilityState === 'visible') refreshClock();
    };
    document.addEventListener('visibilitychange', refreshVisibleClock);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshVisibleClock);
    };
  }, []);

  return currentInstant;
}
