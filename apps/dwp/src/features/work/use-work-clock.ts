import { useEffect, useState } from 'react';

/** Re-evaluate freshness while a queue remains open without claiming a live subscription. */
export function useWorkClock(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
