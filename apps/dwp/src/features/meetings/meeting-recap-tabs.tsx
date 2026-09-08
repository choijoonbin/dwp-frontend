import { useEffect, useRef, useState } from 'react';
import Tabs, { type TabsProps } from '@mui/material/Tabs';

/** Current horizontal geometry, not stale intersection entries, permits scroll controls. */
export function MeetingRecapTabs(props: TabsProps) {
  const root = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = root.current;
    const list = element?.querySelector<HTMLElement>('[role="tablist"]');
    if (!element || !list) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const style = getComputedStyle(element);
      const available =
        element.clientWidth -
        (Number.parseFloat(style.paddingLeft) || 0) -
        (Number.parseFloat(style.paddingRight) || 0);
      const required = list.scrollWidth;
      // Hidden/unmounted layout is not evidence that the visible rail fits.
      if (available > 0 && required > 0) setOverflows(required > available + 1);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    observer?.observe(list);
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    document.fonts?.addEventListener('loadingdone', measure);
    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, []);
  return <Tabs {...props} ref={root} scrollButtons={overflows ? 'auto' : false} />;
}
