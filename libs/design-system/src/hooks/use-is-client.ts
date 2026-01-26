import { useState, useEffect } from 'react';

/**
 * True after mount (client-side). Used by Chart to avoid SSR mismatch.
 */
export const useIsClient = (): boolean => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
};
