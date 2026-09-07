import { useEffect, useState } from 'react';

export function useApprovalQueueClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const instant = Date.now();
      setNow(instant);
      const date = new Date(instant);
      const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - instant + 50);
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return now;
}
