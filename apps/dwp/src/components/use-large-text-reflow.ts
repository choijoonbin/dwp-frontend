import { useEffect, useState } from 'react';

const LARGE_TEXT_ROOT_FONT_SIZE_PX = 24;

/**
 * Browser text-only zoom changes the computed root font without changing the
 * CSS viewport. Observe both sources so layout contracts can reflow rather
 * than truncate localized labels.
 */
export function useLargeTextReflow(): boolean {
  const [largeText, setLargeText] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const rootSize = Number.parseFloat(window.getComputedStyle(root).fontSize);
      setLargeText(Number.isFinite(rootSize) && rootSize >= LARGE_TEXT_ROOT_FONT_SIZE_PX);
    };
    const resizeObserver = new ResizeObserver(sync);
    const mutationObserver = new MutationObserver(sync);
    resizeObserver.observe(root);
    mutationObserver.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', sync);
    sync();
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, []);

  return largeText;
}
