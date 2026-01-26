import { useState, useEffect } from 'react';

/**
 * True after mount (client-side). Use to avoid SSR mismatch when using window/document.
 */
export const useIsClient = (): boolean => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
};
